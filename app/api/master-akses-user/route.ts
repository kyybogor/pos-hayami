import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken, UserSession } from '@/lib/auth';
import { ensureUserAksesTable } from '@/lib/user-akses';
import { SYSTEM_MENUS } from '@/lib/menu-list';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

// Helper to check if current user is superadmin
async function getSuperadminSession(): Promise<{
  isAuthorized: boolean;
  session: UserSession | null;
  message?: string;
}> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    if (!token) {
      return { isAuthorized: false, session: null, message: 'Silakan login terlebih dahulu.' };
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return { isAuthorized: false, session: null, message: 'Sesi login tidak valid atau telah kedaluwarsa.' };
    }

    // Refresh role, tipe, dan cabang user secara dinamis dari tb_karyawan & tb_user
    try {
      const [kRows] = await pool.query<RowDataPacket[]>(
        'SELECT cabang, tipe, grup FROM tb_karyawan WHERE user_id = ? LIMIT 1',
        [session.id_user]
      );
      if (kRows[0]?.cabang) {
        session.branch = kRows[0].cabang.trim();
        session.grup = kRows[0].cabang.trim();
      }
      if (kRows[0]?.tipe) {
        session.tipe = String(kRows[0].tipe).trim().toLowerCase();
      }
    } catch {
      // fallback
    }

    try {
      const [uRows] = await pool.query<RowDataPacket[]>(
        'SELECT role, tipe, grup FROM tb_user WHERE id_user = ? OR nm_user = ? LIMIT 1',
        [session.id_user, session.nm_user]
      );
      if (uRows[0]?.role) session.role = uRows[0].role;
      if (uRows[0]?.tipe) session.tipe = String(uRows[0].tipe).trim().toLowerCase();
      if (!session.branch && uRows[0]?.grup) {
        session.branch = uRows[0].grup.trim();
        session.grup = uRows[0].grup.trim();
      }
    } catch {
      // fallback to session
    }

    const roleLower = (session.role || '').toLowerCase();
    const isSuperAdmin = roleLower === 'superadmin' || roleLower === 'super';

    if (!isSuperAdmin) {
      return {
        isAuthorized: false,
        session,
        message: 'Akses Ditolak. Menu ini hanya dapat diakses oleh user dengan role Superadmin.',
      };
    }

    return { isAuthorized: true, session };
  } catch (err: any) {
    return { isAuthorized: false, session: null, message: err.message || 'Gagal memverifikasi hak akses.' };
  }
}

// GET /api/master-akses-user - Get list of users filtered by online/offline scope
export async function GET(req: Request) {
  try {
    const auth = await getSuperadminSession();
    if (!auth.isAuthorized || !auth.session) {
      return NextResponse.json(
        { success: false, message: auth.message || 'Unauthorized' },
        { status: 403 }
      );
    }

    await ensureUserAksesTable();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const cabangFilter = (searchParams.get('cabang') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const isOnline = (auth.session.tipe || '').toLowerCase() === 'online';
    const superadminBranch = (auth.session.branch || auth.session.grup || '').trim();

    // Query distinct cabang list (useful for online superadmin filter)
    let cabangList: string[] = [];
    try {
      const [cRows] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT nama_cabang FROM tb_cabang WHERE nama_cabang IS NOT NULL AND TRIM(nama_cabang) != "" ORDER BY nama_cabang ASC'
      );
      cabangList = cRows.map((r) => r.nama_cabang);
    } catch {
      // fallback: try tb_karyawan
      const [kCabang] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT cabang FROM tb_karyawan WHERE cabang IS NOT NULL AND TRIM(cabang) != "" ORDER BY cabang ASC'
      );
      cabangList = kCabang.map((r) => r.cabang);
    }

    // Build WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];

    // Scope Rule:
    // Online superadmin: can access all branches, filterable by query param 'cabang'
    // Offline superadmin: strictly their own branch
    if (!isOnline) {
      whereConditions.push('(cabang = ? OR grup = ?)');
      queryParams.push(superadminBranch, superadminBranch);
    } else if (cabangFilter && cabangFilter.toUpperCase() !== 'ALL') {
      whereConditions.push('(cabang = ? OR grup = ?)');
      queryParams.push(cabangFilter, cabangFilter);
    }

    if (search) {
      whereConditions.push('(user_id LIKE ? OR nama_lengkap LIKE ? OR no_telp LIKE ? OR cabang LIKE ?)');
      const term = `%${search}%`;
      queryParams.push(term, term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count Total
    const countSql = `SELECT COUNT(*) as total FROM tb_karyawan ${whereClause}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, queryParams);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch Users
    const dataSql = `
      SELECT 
        id_karyawan,
        user_id,
        nama_lengkap,
        alamat,
        no_telp,
        grup,
        cabang,
        tipe
      FROM tb_karyawan
      ${whereClause}
      ORDER BY 
        CASE WHEN LOWER(grup) = 'super' THEN 0 ELSE 1 END,
        id_karyawan ASC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...queryParams, limit, offset];
    const [userRows] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

    // Fetch custom access summary for each user from tb_user_akses
    const userIds = userRows.map((u) => u.user_id).filter(Boolean);
    const userAksesMap: Record<string, { totalAllowed: number; hasCustom: boolean }> = {};

    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const [aksesRows] = await pool.query<RowDataPacket[]>(
        `SELECT user_id, menu_key, status FROM tb_user_akses WHERE user_id IN (${placeholders})`,
        userIds
      );

      for (const row of aksesRows) {
        if (!userAksesMap[row.user_id]) {
          userAksesMap[row.user_id] = { totalAllowed: 0, hasCustom: true };
        }
        if (Number(row.status) === 1) {
          userAksesMap[row.user_id].totalAllowed++;
        }
      }
    }

    const standardMenuCount = SYSTEM_MENUS.filter((m) => !m.superadminOnly).length;
    const totalSystemMenuCount = SYSTEM_MENUS.length;

    const formattedUsers = userRows.map((u) => {
      const customInfo = userAksesMap[u.user_id];
      const isSuper = (u.grup || '').toLowerCase() === 'super';

      return {
        id_karyawan: u.id_karyawan,
        user_id: u.user_id,
        nama_lengkap: u.nama_lengkap,
        alamat: u.alamat || '',
        no_telp: u.no_telp || '',
        role: isSuper ? 'superadmin' : (u.grup || 'user'),
        cabang: u.cabang || superadminBranch || 'Kantor Pusat',
        tipe: (u.tipe || 'offline').toLowerCase(),
        hasCustomAccess: isSuper ? true : !!customInfo?.hasCustom,
        activeMenuCount: isSuper
          ? totalSystemMenuCount
          : (customInfo ? customInfo.totalAllowed : standardMenuCount),
        totalAvailableMenus: totalSystemMenuCount,
      };
    });

    return NextResponse.json({
      success: true,
      currentUser: {
        id_user: auth.session.id_user,
        nm_user: auth.session.nm_user,
        role: auth.session.role,
        tipe: auth.session.tipe || 'offline',
        branch: superadminBranch,
        isOnline,
      },
      data: formattedUsers,
      cabangList,
      totalSystemMenus: totalSystemMenuCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error GET /api/master-akses-user:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Terjadi kesalahan saat memuat data user.' },
      { status: 500 }
    );
  }
}
