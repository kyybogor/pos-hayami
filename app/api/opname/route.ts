import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/opname (List transactions with filters)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const search = searchParams.get('search') || '';
    const tgl_from = searchParams.get('tgl_from') || '';
    const tgl_to = searchParams.get('tgl_to') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const offset = (page - 1) * limit;

    let whereConditions: string[] = ["id_inv_in LIKE '%OP%'"];
    const params: any[] = [];

    if (effectiveBranch) {
      whereConditions.push("(id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)");
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereConditions.push("inv_date BETWEEN ? AND ?");
      params.push(tgl_from, tgl_to);
    }

    if (search.trim()) {
      whereConditions.push("(id_inv_in LIKE ? OR keterangan LIKE ? OR id_product LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 1. Get total distinct opname headers count
    const countSql = `SELECT COUNT(DISTINCT id_inv_in) as total FROM inv_adjust_in ${whereClause}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // 2. Query distinct opname header records
    const headersSql = `
      SELECT 
        id_inv_in,
        inv_date,
        status,
        keterangan,
        id_cabang,
        by_user_pajak,
        MAX(create_date) as create_date
      FROM inv_adjust_in
      ${whereClause}
      GROUP BY id_inv_in
      ORDER BY id_inv_in DESC
      LIMIT ? OFFSET ?
    `;
    const headerParams = [...params, limit, offset];
    const [headerRows] = await pool.query<RowDataPacket[]>(headersSql, headerParams);

    // 3. For each header, fetch its line items for summary
    const transactions = await Promise.all(
      headerRows.map(async (h) => {
        const [itemRows] = await pool.query<RowDataPacket[]>(
          `SELECT 
            i.inv_in_id,
            i.id_product,
            i.model,
            i.ukuran,
            i.uom,
            i.stock_awal,
            i.stock_change,
            i.stock_opname,
            b.id_bahan
           FROM inv_adjust_in i
           LEFT JOIN tb_bahan b ON b.nama_bahan = i.id_product
           WHERE i.id_inv_in = ?
           ORDER BY i.inv_in_id ASC`,
          [h.id_inv_in]
        );

        return {
          id_inv_in: h.id_inv_in,
          inv_date: h.inv_date ? new Date(h.inv_date).toISOString().split('T')[0] : '',
          status: h.status, // 'd' = Draft, 's' = Close
          keterangan: h.keterangan || '',
          id_cabang: h.id_cabang || '',
          create_date: h.create_date,
          items: itemRows.map((it) => ({
            inv_in_id: it.inv_in_id,
            id_product: it.id_product,
            id_bahan: it.id_bahan || '',
            model: it.model || '',
            ukuran: it.ukuran || '',
            uom: it.uom || 'PCS',
            stock_awal: Number(it.stock_awal) || 0,
            stock_change: Number(it.stock_change) || 0,
            stock_opname: Number(it.stock_opname) || 0,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch opname error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data stock opname.' },
      { status: 500 }
    );
  }
}
