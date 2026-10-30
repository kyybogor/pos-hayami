import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET /api/master-cabang - Mendapatkan daftar cabang dengan pagination & search
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = '';
    const queryParams: any[] = [];

    if (search.trim() !== '') {
      whereClause = `
        WHERE nama_cabang LIKE ? 
           OR alamat LIKE ? 
           OR city LIKE ? 
           OR npwp LIKE ? 
           OR nomor_telepon LIKE ? 
           OR CAST(id_cabang AS CHAR) LIKE ?
      `;
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term, term, term, term);
    }

    // Query Total Count
    const countSql = `SELECT COUNT(*) as total FROM tb_cabang ${whereClause}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, queryParams);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Query Paginated Data
    const dataSql = `
      SELECT id_cabang, nama_cabang, alamat, city, npwp, nomor_telepon, jenis_cabang 
      FROM tb_cabang 
      ${whereClause} 
      ORDER BY id_cabang ASC 
      LIMIT ? OFFSET ?
    `;
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
    console.error('Fetch master cabang error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data cabang dari database.' },
      { status: 500 }
    );
  }
}

// POST /api/master-cabang - Tambah data cabang baru
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      nama_cabang,
      alamat = '',
      city = '',
      npwp = '',
      nomor_telepon = '',
      jenis_cabang = '',
    } = body;

    const trimmedNama = (nama_cabang || '').trim();

    if (!trimmedNama) {
      return NextResponse.json(
        { success: false, message: 'Nama Cabang wajib diisi!' },
        { status: 400 }
      );
    }

    // Cek duplikasi nama cabang
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang WHERE LOWER(TRIM(nama_cabang)) = LOWER(?) LIMIT 1',
      [trimmedNama]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Nama cabang "${trimmedNama}" sudah digunakan. Silakan gunakan nama cabang yang berbeda.`,
        },
        { status: 400 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO tb_cabang (nama_cabang, alamat, city, npwp, nomor_telepon, jenis_cabang) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        trimmedNama,
        alamat.trim(),
        city.trim(),
        npwp.trim(),
        nomor_telepon.trim(),
        jenis_cabang.trim(),
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Cabang "${trimmedNama}" berhasil ditambahkan!`,
      id_cabang: result.insertId,
    });
  } catch (error: any) {
    console.error('Create master cabang error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan data cabang baru.' },
      { status: 500 }
    );
  }
}
