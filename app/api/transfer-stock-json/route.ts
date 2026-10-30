import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Ensure tables transfer_stock and transfer_stock_detail exist
async function ensureTransferTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transfer_stock (
      id_transfer VARCHAR(100) PRIMARY KEY,
      tgl_transfer DATETIME NOT NULL,
      tujuan VARCHAR(150) NOT NULL,
      keterangan TEXT,
      total_qty INT NOT NULL DEFAULT 0,
      dibuat_oleh VARCHAR(100) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tgl (tgl_transfer),
      INDEX idx_tujuan (tujuan)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transfer_stock_detail (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_transfer VARCHAR(100) NOT NULL,
      id_bahan VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      ukuran VARCHAR(50) NOT NULL,
      qty INT NOT NULL DEFAULT 0,
      uom VARCHAR(50) DEFAULT 'PCS',
      INDEX idx_id_transfer (id_transfer),
      INDEX idx_item (id_bahan, model, ukuran)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/**
 * GET /api/transfer-stock-json
 * 
 * Query Parameters:
 * - id_transfer / id: (Optional) Get specific transfer record by ID
 * - tgl_from / from: (Optional) Filter start date (YYYY-MM-DD)
 * - tgl_to / to: (Optional) Filter end date (YYYY-MM-DD)
 * - search / q: (Optional) Search keyword for id_transfer, tujuan, or keterangan
 * - page: (Optional) Page number (default: 1)
 * - limit: (Optional) Items per page (default: 50, max: 500)
 */
export async function GET(request: NextRequest) {
  try {
    await ensureTransferTablesExist();

    const { searchParams } = new URL(request.url);
    const idTransferParam = searchParams.get('id_transfer') || searchParams.get('id') || '';
    const tglFrom = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tglTo = searchParams.get('tgl_to') || searchParams.get('to') || '';
    const search = searchParams.get('search') || searchParams.get('q') || '';
    
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(500, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
    const offset = (page - 1) * limit;

    let whereConditions: string[] = ['1=1'];
    const params: any[] = [];

    // Filter by specific transaction ID if requested
    if (idTransferParam.trim() !== '') {
      whereConditions.push('id_transfer = ?');
      params.push(idTransferParam.trim());
    }

    // Filter by date range
    if (tglFrom && tglTo) {
      whereConditions.push('tgl_transfer BETWEEN ? AND ?');
      params.push(`${tglFrom} 00:00:00`, `${tglTo} 23:59:59`);
    } else if (tglFrom) {
      whereConditions.push('tgl_transfer >= ?');
      params.push(`${tglFrom} 00:00:00`);
    } else if (tglTo) {
      whereConditions.push('tgl_transfer <= ?');
      params.push(`${tglTo} 23:59:59`);
    }

    // Filter by search keyword
    if (search.trim() !== '') {
      whereConditions.push('(id_transfer LIKE ? OR tujuan LIKE ? OR keterangan LIKE ? OR dibuat_oleh LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = `WHERE ${whereConditions.join(' AND ')}`;

    // Get total count for pagination
    const countSql = `SELECT COUNT(*) as total_count FROM transfer_stock ${whereSql}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const totalItems = Number(countRows[0]?.total_count) || 0;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Fetch header records
    const headerSql = `
      SELECT 
        id_transfer, 
        tgl_transfer, 
        tujuan, 
        keterangan, 
        total_qty, 
        dibuat_oleh, 
        created_at
      FROM transfer_stock
      ${whereSql}
      ORDER BY tgl_transfer DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;

    const headerParams = [...params, limit, offset];
    const [headerRows] = await pool.query<RowDataPacket[]>(headerSql, headerParams);

    if (headerRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada data transfer stock yang ditemukan.',
        total: 0,
        pagination: {
          page,
          limit,
          total_items: 0,
          total_pages: 0,
        },
        data: [],
      });
    }

    // Extract transaction IDs to batch fetch details
    const transferIds = headerRows.map((row) => row.id_transfer);
    const placeholders = transferIds.map(() => '?').join(',');

    const detailSql = `
      SELECT 
        id, 
        id_transfer, 
        id_bahan, 
        model, 
        ukuran, 
        qty, 
        uom 
      FROM transfer_stock_detail
      WHERE id_transfer IN (${placeholders})
      ORDER BY id ASC
    `;

    const [detailRows] = await pool.query<RowDataPacket[]>(detailSql, transferIds);

    // Group details by id_transfer
    const detailMap = new Map<string, any[]>();
    for (const d of detailRows) {
      const idTrf = d.id_transfer;
      if (!detailMap.has(idTrf)) {
        detailMap.set(idTrf, []);
      }
      detailMap.get(idTrf)!.push({
        id: d.id,
        id_transfer: d.id_transfer,
        id_bahan: d.id_bahan || '',
        model: d.model || '',
        ukuran: d.ukuran || '',
        qty: Number(d.qty) || 0,
        uom: d.uom || 'PCS',
        nama_barang: [d.id_bahan, d.model, d.ukuran].filter(Boolean).join('-'),
      });
    }

    // Merge head data (transfer_stock) and details (transfer_stock_detail)
    const result = headerRows.map((head) => {
      const details = detailMap.get(head.id_transfer) || [];
      return {
        id_transfer: head.id_transfer,
        tgl_transfer: head.tgl_transfer,
        tujuan: head.tujuan || '',
        keterangan: head.keterangan || '',
        total_qty: Number(head.total_qty) || 0,
        dibuat_oleh: head.dibuat_oleh || '',
        created_at: head.created_at,
        details_count: details.length,
        details: details,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Berhasil mengambil data API transfer stock.',
      total: totalItems,
      pagination: {
        page,
        limit,
        total_items: totalItems,
        total_pages: totalPages,
      },
      data: result,
    });
  } catch (error: any) {
    console.error('API Transfer Stock JSON Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal mengambil data API JSON transfer stock: ' + (error.message || String(error)),
      },
      { status: 500 }
    );
  }
}
