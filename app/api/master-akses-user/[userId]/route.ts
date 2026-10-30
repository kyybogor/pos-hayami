import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken, UserSession } from '@/lib/auth';
import {
  ensureUserAksesTable,
  getUserAllowedMenus,
  saveUserAllowedMenus,
  resetUserAllowedMenus,
} from '@/lib/user-akses';
import { SYSTEM_MENUS } from '@/lib/menu-list';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

// Helper to check superadmin session and branch scope
async function checkSuperadminAuth(targetUserId: string): Promise<{
  authorized: boolean;
  session?: UserSession;
  targetUser?: any;
  status: number;
  message?: string;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get('pos_session')?.value;
  if (!token) {
    return { authorized: false, status: 401, message: 'Silakan login terlebih dahulu.' };
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return { authorized: false, status: 401, message: 'Sesi login tidak valid.' };
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
  } catch { }

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
  } catch { }

  const roleLower = (session.role || '').toLowerCase();
  const isSuperAdmin = roleLower === 'superadmin' || roleLower === 'super';

  if (!isSuperAdmin) {
    return {
      authorized: false,
      status: 403,
      message: 'Akses Ditolak. Menu ini hanya dapat diakses oleh user dengan role Superadmin.',
    };
  }

  // Fetch target user to check branch scope
  const [targetRows] = await pool.query<RowDataPacket[]>(
    'SELECT id_karyawan, user_id, nama_lengkap, grup, cabang, tipe FROM tb_karyawan WHERE user_id = ? LIMIT 1',
    [targetUserId]
  );

  let targetUser = targetRows[0];
  if (!targetUser) {
    // Check tb_user
    const [tbUserRows] = await pool.query<RowDataPacket[]>(
      'SELECT id_user as user_id, nm_user as nama_lengkap, role as grup, grup as cabang, tipe FROM tb_user WHERE id_user = ? LIMIT 1',
      [targetUserId]
    );
    targetUser = tbUserRows[0];
  }

  if (!targetUser) {
    return { authorized: false, status: 404, message: `User "${targetUserId}" tidak ditemukan.` };
  }

  const isOnlineSuperadmin = (session.tipe || '').toLowerCase() === 'online';
  const superadminBranch = (session.branch || session.grup || '').trim().toLowerCase();
  const targetBranch = (targetUser.cabang || targetUser.grup || '').trim().toLowerCase();

  // If superadmin is OFFLINE: can ONLY manage users from their own branch!
  if (!isOnlineSuperadmin && superadminBranch && targetBranch && superadminBranch !== targetBranch) {
    return {
      authorized: false,
      status: 403,
      message: `Akun offline hanya dapat mengelola hak akses user di cabang sendiri (${session.branch}). User "${targetUserId}" berada di cabang "${targetUser.cabang || targetUser.grup}".`,
    };
  }

  return { authorized: true, status: 200, session, targetUser };
}

// GET /api/master-akses-user/[userId] - Get permissions for a specific user
export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const auth = await checkSuperadminAuth(userId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    await ensureUserAksesTable();

    const { targetUser } = auth;
    const isTargetSuperadmin =
      (targetUser.grup || '').toLowerCase() === 'super' ||
      (targetUser.role || '').toLowerCase() === 'superadmin';

    const { hasCustomAccess, allowedMenus } = await getUserAllowedMenus(userId, targetUser.grup);

    return NextResponse.json({
      success: true,
      userId,
      user: {
        user_id: targetUser.user_id,
        nama_lengkap: targetUser.nama_lengkap,
        role: isTargetSuperadmin ? 'superadmin' : (targetUser.grup || 'user'),
        cabang: targetUser.cabang || targetUser.grup || 'Semua Cabang',
        tipe: targetUser.tipe || 'offline',
        isSuperadmin: isTargetSuperadmin,
      },
      hasCustomAccess,
      allowedMenus,
      systemMenus: SYSTEM_MENUS,
    });
  } catch (error: any) {
    console.error('Error GET /api/master-akses-user/[userId]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memuat hak akses user.' },
      { status: 500 }
    );
  }
}

// POST / PUT /api/master-akses-user/[userId] - Save permissions for a user
export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const auth = await checkSuperadminAuth(userId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const body = await req.json();
    const { allowedMenus } = body;

    if (!Array.isArray(allowedMenus)) {
      return NextResponse.json(
        { success: false, message: 'Data allowedMenus harus berupa array path URL menu.' },
        { status: 400 }
      );
    }

    // Save into tb_user_akses
    await saveUserAllowedMenus(userId, allowedMenus);

    return NextResponse.json({
      success: true,
      message: `Hak akses menu untuk user "${auth.targetUser.nama_lengkap || userId}" berhasil disimpan!`,
      allowedMenus,
    });
  } catch (error: any) {
    console.error('Error POST /api/master-akses-user/[userId]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan hak akses user.' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-akses-user/[userId] - Reset permissions to default
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, message: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const auth = await checkSuperadminAuth(userId);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    await resetUserAllowedMenus(userId);

    return NextResponse.json({
      success: true,
      message: `Hak akses user "${auth.targetUser.nama_lengkap || userId}" berhasil di-reset ke default.`,
    });
  } catch (error: any) {
    console.error('Error DELETE /api/master-akses-user/[userId]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal me-reset hak akses user.' },
      { status: 500 }
    );
  }
}
