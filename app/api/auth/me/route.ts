import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';

import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('pos_session')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // Ensure role and tipe are fetched from tb_user
  try {
    const [tbUserRows] = await pool.query<RowDataPacket[]>(
      'SELECT grup, role, tipe FROM tb_user WHERE id_user = ? OR nm_user = ? LIMIT 1',
      [session.id_user, session.nm_user]
    );
    if (tbUserRows[0]?.role) {
      session.role = tbUserRows[0].role;
    }
    try {
      const [kRows] = await pool.query<RowDataPacket[]>(
        'SELECT cabang FROM tb_karyawan WHERE user_id = ? LIMIT 1',
        [session.id_user]
      );
      if (kRows[0]?.cabang) {
        session.branch = kRows[0].cabang;
        session.grup = kRows[0].cabang;
      } else if (tbUserRows[0]?.grup) {
        session.branch = tbUserRows[0].grup;
        session.grup = tbUserRows[0].grup;
      }
    } catch {
      if (tbUserRows[0]?.grup) {
        session.branch = tbUserRows[0].grup;
        session.grup = tbUserRows[0].grup;
      }
    }
    if (tbUserRows[0]?.tipe !== undefined && tbUserRows[0]?.tipe !== null) {
      session.tipe = String(tbUserRows[0].tipe).trim().toLowerCase();
    } else if (!session.tipe) {
      session.tipe = 'offline';
    }
  } catch (err) {
    console.error('Error fetching role/tipe in auth/me:', err);
  }

  // Fetch allowed menus from tb_user_akses
  try {
    const { getUserAllowedMenus } = await import('@/lib/user-akses');
    const { allowedMenus } = await getUserAllowedMenus(session.id_user, session.role);
    (session as any).allowedMenus = allowedMenus;
  } catch (menuErr) {
    console.warn('Error fetching user allowed menus in auth/me:', menuErr);
    (session as any).allowedMenus = ['*'];
  }

  return NextResponse.json({ authenticated: true, user: session });
}
