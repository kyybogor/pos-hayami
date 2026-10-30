import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// Ensure table tb_log_user exists
async function ensureLogTableExists() {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS tb_log_user (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_user VARCHAR(100) NOT NULL,
      nm_user VARCHAR(100) DEFAULT '',
      grup VARCHAR(100) DEFAULT '',
      menu VARCHAR(100) NOT NULL,
      aktivitas TEXT NOT NULL,
      ip_address VARCHAR(50) DEFAULT '127.0.0.1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_id_user (id_user),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  await pool.query(createTableSql);
}

// GET: Fetch activity logs with pagination and filters
export async function GET(req: Request) {
  try {
    await ensureLogTableExists();

    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Fetch user & menu options for filters
    if (getOptions) {
      try {
        const [tbUserRows] = await pool.query<RowDataPacket[]>(
          'SELECT DISTINCT id_user, nm_user FROM tb_user WHERE id_user IS NOT NULL AND id_user != "" ORDER BY id_user ASC'
        );

        let logUserRows: RowDataPacket[] = [];
        try {
          const [lRows] = await pool.query<RowDataPacket[]>(
            'SELECT DISTINCT id_user, nm_user FROM tb_log_user WHERE id_user IS NOT NULL AND id_user != "" ORDER BY id_user ASC'
          );
          logUserRows = lRows;
        } catch {}

        const userMap = new Map<string, string>();
        tbUserRows.forEach((r) => {
          if (r.id_user) userMap.set(r.id_user, r.nm_user || r.id_user);
        });
        logUserRows.forEach((r) => {
          if (r.id_user && !userMap.has(r.id_user)) {
            userMap.set(r.id_user, r.nm_user || r.id_user);
          }
        });

        const users = Array.from(userMap.entries()).map(([id_user, nm_user]) => ({
          id_user,
          label: nm_user && nm_user !== id_user ? `${id_user} (${nm_user})` : id_user,
        }));

        let menus: string[] = [];
        try {
          const [menuRows] = await pool.query<RowDataPacket[]>(
            'SELECT DISTINCT menu FROM tb_log_user WHERE menu IS NOT NULL AND menu != "" ORDER BY menu ASC'
          );
          menus = menuRows.map((r) => r.menu);
        } catch {}

        return NextResponse.json({
          success: true,
          options: {
            users,
            menus,
          },
        });
      } catch (optErr: any) {
        console.error('Fetch options error in log-user:', optErr);
        return NextResponse.json({
          success: false,
          options: { users: [], menus: [] },
        });
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const tgl_from = searchParams.get('tgl_from') || '';
    const tgl_to = searchParams.get('tgl_to') || '';
    const userFilter = searchParams.get('user') || '';
    const menuFilter = searchParams.get('menu') || '';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10));
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    if (userFilter.trim() !== '') {
      whereSql += ' AND (id_user = ? OR nm_user = ?)';
      params.push(userFilter.trim(), userFilter.trim());
    }

    if (menuFilter.trim() !== '') {
      whereSql += ' AND menu = ?';
      params.push(menuFilter.trim());
    }

    if (tgl_from && tgl_to) {
      whereSql += ' AND (created_at BETWEEN ? AND ?)';
      params.push(`${tgl_from} 00:00:00`, `${tgl_to} 23:59:59`);
    } else if (tgl_from) {
      whereSql += ' AND created_at >= ?';
      params.push(`${tgl_from} 00:00:00`);
    } else if (tgl_to) {
      whereSql += ' AND created_at <= ?';
      params.push(`${tgl_to} 23:59:59`);
    }

    // Total count query
    const countSql = `SELECT COUNT(*) as total_count FROM tb_log_user ${whereSql}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const totalItems = Number(countRows[0]?.total_count) || 0;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Data query
    const dataSql = `
      SELECT id, id_user, nm_user, grup, menu, aktivitas, ip_address, created_at
      FROM tb_log_user
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const [logRows] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

    // Summary stats
    const [[activeUsersRows], [todayLogsRows]] = await Promise.all([
      pool.query<RowDataPacket[]>(
        'SELECT COUNT(DISTINCT id_user) as active_count FROM tb_log_user WHERE DATE(created_at) = CURDATE()'
      ),
      pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as today_count FROM tb_log_user WHERE DATE(created_at) = CURDATE()'
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: logRows,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
        },
        summary: {
          total_logs: totalItems,
          today_logs: Number(todayLogsRows[0]?.today_count) || 0,
          active_users_today: Number(activeUsersRows[0]?.active_count) || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Log User error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data log user.' },
      { status: 500 }
    );
  }
}

// POST: Insert a new activity log
export async function POST(req: Request) {
  try {
    await ensureLogTableExists();

    const body = await req.json().catch(() => ({}));
    const { menu, aktivitas, ip_address = '127.0.0.1' } = body;

    if (!menu || !aktivitas) {
      return NextResponse.json(
        { success: false, message: 'Menu dan aktivitas wajib diisi' },
        { status: 400 }
      );
    }

    // Extract logged in user from pos_session cookie
    let id_user = 'guest';
    let nm_user = 'Guest';
    let grup = 'General';

    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('pos_session')?.value;
      if (token) {
        const session = await verifySessionToken(token);
        if (session) {
          id_user = session.id_user || session.nm_user || 'admin';
          nm_user = session.nm_user || id_user;
          grup = session.grup || session.branch || 'General';
        }
      }
    } catch (err) {
      console.error('Verify session error in log-user:', err);
    }

    const insertSql = `
      INSERT INTO tb_log_user (id_user, nm_user, grup, menu, aktivitas, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await pool.query(insertSql, [id_user, nm_user, grup, menu, aktivitas, ip_address]);

    return NextResponse.json({
      success: true,
      message: 'Log aktivitas berhasil disimpan',
    });
  } catch (error: any) {
    console.error('Insert Log User error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan log user' },
      { status: 500 }
    );
  }
}
