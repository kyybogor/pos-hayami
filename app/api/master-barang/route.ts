import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/master-barang (Mengambil data dari tb_stock dikelompokkan berdasarkan id_bahan)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();
    const offset = (page - 1) * limit;

    let countSql = '';
    let dataSql = '';
    let countParams: any[] = [];
    let dataParams: any[] = [];

    if (search !== '') {
      const term = `%${search}%`;
      countSql = `
        SELECT COUNT(*) as total FROM (
          SELECT id_bahan
          FROM tb_stock
          WHERE id_bahan IS NOT NULL AND TRIM(id_bahan) != ''
          GROUP BY id_bahan
          HAVING (
            id_bahan LIKE ? 
            OR GROUP_CONCAT(DISTINCT NULLIF(TRIM(ukuran), '') SEPARATOR ', ') LIKE ?
            OR GROUP_CONCAT(DISTINCT NULLIF(TRIM(model), '') SEPARATOR ' ') LIKE ?
          )
        ) as t
      `;
      countParams = [term, term, term];

      dataSql = `
        SELECT 
          id_bahan,
          GROUP_CONCAT(DISTINCT NULLIF(TRIM(ukuran), '') ORDER BY ukuran ASC SEPARATOR ', ') as ukuran,
          MAX(NULLIF(image, '')) as image,
          MAX(uom) as uom,
          COUNT(*) as total_variants,
          SUM(stock) as total_stock
        FROM tb_stock
        WHERE id_bahan IS NOT NULL AND TRIM(id_bahan) != ''
        GROUP BY id_bahan
        HAVING (
          id_bahan LIKE ? 
          OR ukuran LIKE ?
          OR GROUP_CONCAT(DISTINCT NULLIF(TRIM(model), '') SEPARATOR ' ') LIKE ?
        )
        ORDER BY id_bahan ASC
        LIMIT ? OFFSET ?
      `;
      dataParams = [term, term, term, limit, offset];
    } else {
      countSql = `
        SELECT COUNT(DISTINCT id_bahan) as total 
        FROM tb_stock 
        WHERE id_bahan IS NOT NULL AND TRIM(id_bahan) != ''
      `;
      countParams = [];

      dataSql = `
        SELECT 
          id_bahan,
          GROUP_CONCAT(DISTINCT NULLIF(TRIM(ukuran), '') ORDER BY ukuran ASC SEPARATOR ', ') as ukuran,
          MAX(NULLIF(image, '')) as image,
          MAX(uom) as uom,
          COUNT(*) as total_variants,
          SUM(stock) as total_stock
        FROM tb_stock
        WHERE id_bahan IS NOT NULL AND TRIM(id_bahan) != ''
        GROUP BY id_bahan
        ORDER BY id_bahan ASC
        LIMIT ? OFFSET ?
      `;
      dataParams = [limit, offset];
    }

    const [countRows] = await pool.query<RowDataPacket[]>(countSql, countParams);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

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
    console.error('Fetch barang dari tb_stock error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data barang dari database.' },
      { status: 500 }
    );
  }
}

// PUT /api/master-barang (Update Image untuk id_bahan)
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id_bahan, image } = body;

    if (!id_bahan || typeof id_bahan !== 'string' || id_bahan.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Nama Barang (id_bahan) wajib diisi!' },
        { status: 400 }
      );
    }

    const trimmedIdBahan = id_bahan.trim();
    const finalImage = typeof image === 'string' ? image.trim() : '';

    // Update tb_stock untuk semua baris dengan id_bahan tersebut
    await pool.query(
      'UPDATE tb_stock SET image = ? WHERE id_bahan = ?',
      [finalImage, trimmedIdBahan]
    );

    // Sinkronisasi ke tb_bahan jika ada
    try {
      await pool.query(
        'UPDATE tb_bahan SET image = ? WHERE nama_bahan = ? OR id_bahan = ?',
        [finalImage, trimmedIdBahan, trimmedIdBahan]
      );
    } catch (syncErr) {
      console.warn('Sync image to tb_bahan warning:', syncErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Gambar produk berhasil diperbarui!',
      id_bahan: trimmedIdBahan,
      image: finalImage,
    });
  } catch (error: any) {
    console.error('Update image error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui gambar produk.' },
      { status: 500 }
    );
  }
}
