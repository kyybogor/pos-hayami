import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Helper to auto-generate Next ID Akun (e.g. AK000001)
async function generateNextAkunId(): Promise<string> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT MAX(id_akun) as maxId FROM tb_akun WHERE id_akun LIKE 'AK%'"
  );
  let sequence = 1;
  if (rows.length > 0 && rows[0].maxId) {
    const numPart = parseInt(rows[0].maxId.replace(/^AK/i, ''), 10);
    if (!isNaN(numPart)) {
      sequence = numPart + 1;
    }
  }
  return `AK${String(sequence).padStart(6, '0')}`;
}

// GET /api/master-account
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getNextId = searchParams.get('generate_id') === 'true';

    if (getNextId) {
      const nextId = await generateNextAkunId();
      return NextResponse.json({ success: true, nextId });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const queryParams: any[] = [];

    if (search.trim() !== '') {
      whereClause = ' WHERE id_akun LIKE ? OR tipe LIKE ? OR bank LIKE ? OR nama_akun LIKE ? OR no_akun LIKE ?';
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term, term, term);
    }

    // Query Total Count
    const countSql = `SELECT COUNT(*) as total FROM tb_akun${whereClause}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, queryParams);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Query Paginated Records
    const dataSql = `SELECT * FROM tb_akun${whereClause} ORDER BY id_akun ASC LIMIT ? OFFSET ?`;
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
    console.error('Fetch account error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data akun dari database.' },
      { status: 500 }
    );
  }
}

// POST /api/master-account (Create or Upsert)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { id_akun, tipe, bank, nama_akun, no_akun } = body;

    if (!tipe || !tipe.trim()) {
      return NextResponse.json(
        { success: false, message: 'Tipe Akun wajib diisi!' },
        { status: 400 }
      );
    }

    // Auto-generate ID if empty
    if (!id_akun || !id_akun.trim()) {
      id_akun = await generateNextAkunId();
    }

    // Check if ID exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id_akun FROM tb_akun WHERE id_akun = ?',
      [id_akun.trim()]
    );

    if (existing.length > 0) {
      // UPDATE
      await pool.query(
        `UPDATE tb_akun SET
          tipe = ?,
          bank = ?,
          nama_akun = ?,
          no_akun = ?
        WHERE id_akun = ?`,
        [
          tipe.trim(),
          bank ? bank.trim() : '',
          nama_akun ? nama_akun.trim() : '',
          no_akun ? no_akun.trim() : '',
          id_akun.trim(),
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Ubah data account berhasil!',
        id_akun,
      });
    } else {
      // INSERT
      await pool.query<ResultSetHeader>(
        `INSERT INTO tb_akun (
          id_akun, tipe, bank, nama_akun, no_akun
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          id_akun.trim(),
          tipe.trim(),
          bank ? bank.trim() : '',
          nama_akun ? nama_akun.trim() : '',
          no_akun ? no_akun.trim() : '',
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Simpan data account berhasil!',
        id_akun,
      });
    }
  } catch (error: any) {
    console.error('Save account error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan data account.' },
      { status: 500 }
    );
  }
}
