import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Helper to ensure the location table exists in MySQL database
async function ensureLocationTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS location (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama_lokasi VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

// GET /api/master-location - Retrieve paginated location list or search results
export async function GET(req: Request) {
  try {
    await ensureLocationTableExists();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const queryParams: any[] = [];

    if (search.trim() !== '') {
      whereClause = ' WHERE nama_lokasi LIKE ? OR id LIKE ?';
      const term = `%${search.trim()}%`;
      queryParams.push(term, term);
    }

    // Query Total Count
    const countSql = `SELECT COUNT(*) as total FROM location${whereClause}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, queryParams);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Query Paginated Data
    const dataSql = `SELECT id, nama_lokasi, created_at FROM location${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`;
    const dataParams = [...queryParams, limit, offset];
    const [items] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch location error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data lokasi dari database.' },
      { status: 500 }
    );
  }
}

// POST /api/master-location - Create a new location entry
export async function POST(req: Request) {
  try {
    await ensureLocationTableExists();

    const body = await req.json();
    const { nama_lokasi } = body;

    if (!nama_lokasi || !nama_lokasi.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nama Lokasi wajib diisi!' },
        { status: 400 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO location (nama_lokasi) VALUES (?)',
      [nama_lokasi.trim()]
    );

    return NextResponse.json({
      success: true,
      message: 'Tambah data lokasi berhasil!',
      id: result.insertId,
    });
  } catch (error: any) {
    console.error('Create location error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan data lokasi.' },
      { status: 500 }
    );
  }
}
