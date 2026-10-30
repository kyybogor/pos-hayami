import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import crypto from 'crypto';
import { verifySessionToken } from '@/lib/auth';

function hashPassword(pass: string): string {
  return crypto.createHash('md5').update(pass).digest('hex');
}

// Helper to ensure 'tipe' column exists in tb_karyawan
async function ensureTipeColumnExists() {
  try {
    const [cols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM tb_karyawan');
    const colNames = cols.map((c) => c.Field);
    if (!colNames.includes('tipe')) {
      await pool.query("ALTER TABLE tb_karyawan ADD COLUMN tipe VARCHAR(50) DEFAULT 'offline'");
    }
  } catch (err) {
    console.error('Error ensuring tipe column in tb_karyawan:', err);
  }
}

// Helper to resolve the creator user's tipe (online / offline), branch, and role
async function getCreatorSessionInfo(): Promise<{
  creatorTipe: string;
  creatorBranch: string;
  creatorRole: string;
  isSuperAdmin: boolean;
}> {
  let creatorTipe = 'offline';
  let creatorBranch = '';
  let creatorRole = 'admin';
  let isSuperAdmin = false;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;

    if (token) {
      const session = await verifySessionToken(token);
      if (session) {
        if (session.tipe) {
          creatorTipe = String(session.tipe).trim().toLowerCase();
        }
        if (session.role) {
          creatorRole = String(session.role).trim().toLowerCase();
        }

        // 1. Ambil cabang & grup dari tb_karyawan terlebih dahulu (sumber data nama cabang paling akurat pembuat akun)
        try {
          const [kRows] = await pool.query<RowDataPacket[]>(
            'SELECT cabang, grup, tipe FROM tb_karyawan WHERE user_id = ? LIMIT 1',
            [session.id_user]
          );
          if (kRows[0]?.cabang && kRows[0].cabang.trim() !== '') {
            creatorBranch = kRows[0].cabang.trim();
          }
          if (kRows[0]?.grup) {
            const kg = String(kRows[0].grup).trim().toLowerCase();
            if (kg === 'super') {
              creatorRole = 'superadmin';
            }
          }
          if (kRows[0]?.tipe) {
            creatorTipe = String(kRows[0].tipe).trim().toLowerCase();
          }
        } catch (e) {
          console.warn('Error reading tb_karyawan cabang:', e);
        }

        // 2. Query tb_user untuk role, tipe & grup
        try {
          const [uRows] = await pool.query<RowDataPacket[]>(
            'SELECT role, tipe, grup FROM tb_user WHERE id_user = ? OR nm_user = ? LIMIT 1',
            [session.id_user, session.nm_user]
          );
          if (uRows[0]?.role) {
            creatorRole = String(uRows[0].role).trim().toLowerCase();
          }
          if (uRows[0]?.tipe) {
            creatorTipe = String(uRows[0].tipe).trim().toLowerCase();
          }
          if (!creatorBranch && uRows[0]?.grup) {
            creatorBranch = uRows[0].grup.trim();
          }
        } catch (e) {
          console.warn('Error checking tb_user for creator info:', e);
        }

        // 3. Fallback ke session token cabang user yang menambahkan
        if (!creatorBranch && (session.branch || session.grup)) {
          creatorBranch = (session.branch || session.grup || '').trim();
        }

        isSuperAdmin = creatorRole === 'superadmin' || creatorRole === 'super';
      }
    }
  } catch (err) {
    console.error('Error in getCreatorSessionInfo:', err);
  }

  return { creatorTipe, creatorBranch, creatorRole, isSuperAdmin };
}

// GET /api/master-user-login
export async function GET(req: Request) {
  try {
    await ensureTipeColumnExists();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const queryParams: any[] = [];

    if (search.trim() !== '') {
      whereClause = ' WHERE user_id LIKE ? OR nama_lengkap LIKE ? OR no_telp LIKE ? OR grup LIKE ? OR tipe LIKE ?';
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term, term, term);
    }

    // Query Total Count
    const countSql = `SELECT COUNT(*) as total FROM tb_karyawan${whereClause}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, queryParams);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Query Paginated Records (include 'tipe')
    const dataSql = `
      SELECT id_karyawan, user_id, nama_lengkap, alamat, no_telp, grup, jenis_pajak, cabang, tipe 
      FROM tb_karyawan${whereClause} 
      ORDER BY id_karyawan ASC 
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...queryParams, limit, offset];
    const [items] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

    const { creatorTipe, creatorBranch, creatorRole, isSuperAdmin } = await getCreatorSessionInfo();

    // Query list cabang dari tb_cabang kolom nama_cabang
    let cabangList: string[] = [];
    try {
      const [cRows] = await pool.query<RowDataPacket[]>(
        'SELECT DISTINCT nama_cabang FROM tb_cabang WHERE nama_cabang IS NOT NULL AND TRIM(nama_cabang) != "" ORDER BY nama_cabang ASC'
      );
      cabangList = cRows.map((c) => c.nama_cabang);
    } catch (cErr) {
      console.warn('Error fetching cabang list:', cErr);
    }

    return NextResponse.json({
      success: true,
      data: items,
      creatorTipe,
      creatorBranch,
      creatorRole,
      isSuperAdmin,
      cabangList,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch user login error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data user login.' },
      { status: 500 }
    );
  }
}

// POST /api/master-user-login
export async function POST(req: Request) {
  try {
    await ensureTipeColumnExists();

    const body = await req.json();
    const { user_id, pass, nama_lengkap, alamat, no_telp, grup, jenis_pajak, cabang } = body;

    if (!user_id || !user_id.trim()) {
      return NextResponse.json(
        { success: false, message: 'User ID (Username) wajib diisi!' },
        { status: 400 }
      );
    }

    if (!pass || !pass.trim()) {
      return NextResponse.json(
        { success: false, message: 'Password wajib diisi!' },
        { status: 400 }
      );
    }

    if (!nama_lengkap || !nama_lengkap.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nama Lengkap wajib diisi!' },
        { status: 400 }
      );
    }

    // Check if user_id exists in tb_karyawan
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id_karyawan FROM tb_karyawan WHERE user_id = ?',
      [user_id.trim()]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, message: `User ID "${user_id}" sudah terdaftar!` },
        { status: 400 }
      );
    }

    // Ambil tipe, cabang & role pembuat akun (creator)
    const { creatorTipe, creatorBranch, isSuperAdmin } = await getCreatorSessionInfo();
    
    // Jika pembuat akun adalah Superadmin: bebas memilih cabang manapun (data dari tb_cabang)
    // Jika bukan Superadmin: cabang otomatis dikunci sesuai cabang akun pembuatnya (creatorBranch)
    let targetBranch = creatorBranch;
    if (isSuperAdmin && cabang && typeof cabang === 'string' && cabang.trim() !== '') {
      targetBranch = cabang.trim();
    } else if (!targetBranch && cabang && typeof cabang === 'string' && cabang.trim() !== '') {
      targetBranch = cabang.trim();
    }

    const hashedPass = hashPassword(pass);

    // 1. Simpan ke tb_karyawan dengan kolom tipe = creatorTipe
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO tb_karyawan (
        user_id, pass, nama_lengkap, alamat, no_telp, grup, jenis_pajak, cabang, tipe
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id.trim(),
        hashedPass,
        nama_lengkap.trim(),
        alamat || '',
        no_telp || '',
        grup || 'admin',
        jenis_pajak || '1',
        targetBranch,
        creatorTipe, // Tipe disamakan sesuai user yang menambahkan
      ]
    );

    // 2. Sinkronisasikan ke tb_user agar kompatibel penuh dengan autentikasi / login
    try {
      await pool.query(
        `INSERT INTO tb_user (
          id_user, pass_user, nm_user, telp_user, alamat_user, grup, role, tipe, dibuat_tgl
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          pass_user = VALUES(pass_user),
          nm_user = VALUES(nm_user),
          telp_user = VALUES(telp_user),
          alamat_user = VALUES(alamat_user),
          grup = VALUES(grup),
          role = VALUES(role),
          tipe = VALUES(tipe)`,
        [
          user_id.trim(),
          hashedPass,
          nama_lengkap.trim(),
          no_telp || '',
          alamat || '',
          targetBranch,
          grup || 'admin',
          creatorTipe, // Tipe disamakan sesuai user yang menambahkan
        ]
      );
    } catch (userErr) {
      console.warn('Sync into tb_user error (non-fatal):', userErr);
    }

    return NextResponse.json({
      success: true,
      message: `Tambah User Login berhasil! (Tipe akun diset ke: ${creatorTipe.toUpperCase()})`,
      id_karyawan: result.insertId,
      tipe: creatorTipe,
    });
  } catch (error: any) {
    console.error('Create user login error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan data user login.' },
      { status: 500 }
    );
  }
}
