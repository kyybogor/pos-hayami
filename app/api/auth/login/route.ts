import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { md5, createSessionToken, UserSession } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function POST(req: Request) {
  try {
    const { username, pass } = await req.json();

    if (!username || !pass) {
      return NextResponse.json(
        { success: false, message: 'Username dan Password wajib diisi!' },
        { status: 400 }
      );
    }

    const hashedPass = md5(pass);

    // Query database for matching user_id and pass
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM tb_karyawan WHERE user_id = ? AND pass = ?',
      [username, hashedPass]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Maaf, Login Gagal. Username atau Password salah.' },
        { status: 401 }
      );
    }

    const user = rows[0];

    // Query tb_user to get the specific branch/group, role, and tipe (online/offline) for this user
    const [tbUserRows] = await pool.query<RowDataPacket[]>(
      'SELECT grup, role, tipe FROM tb_user WHERE id_user = ? OR nm_user = ? OR id_user = ? OR nm_user = ? LIMIT 1',
      [username, username, user.user_id || username, user.nama_lengkap || username]
    );
    // Ambil cabang user secara dinamis dari tb_karyawan (user.cabang) atau tb_user (tbUserRows[0].grup)
    const userBranch = (user.cabang || tbUserRows[0]?.grup || user.grup || '').trim();
    const userRoleFromTbUser = tbUserRows[0]?.role || (user.grup === 'super' ? 'superadmin' : user.grup || 'user');
    const rawTipe = user.tipe || tbUserRows[0]?.tipe;
    const userTipeFromTbUser = rawTipe ? String(rawTipe).trim().toLowerCase() : 'offline';

    const sessionPayload: UserSession = {
      id_user: user.user_id || username,
      nm_user: username,
      branch: userBranch,
      grup: userBranch,
      group: userBranch,
      role: userRoleFromTbUser,
      tipe: userTipeFromTbUser,
      jenis_pajak: user.jenis_pajak || '',
      by_user_pajak: user.jenis_pajak || '',
    };

    const token = await createSessionToken(sessionPayload);

    const cookieStore = await cookies();
    cookieStore.set('pos_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({
      success: true,
      message: 'Login Berhasil',
      user: sessionPayload,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server database.' },
      { status: 500 }
    );
  }
}
