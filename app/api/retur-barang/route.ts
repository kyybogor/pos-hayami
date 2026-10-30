import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/retur-barang (List transactions with filters and totals)
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
    const customer = searchParams.get('customer') || '';
    const akun = searchParams.get('akun') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const offset = (page - 1) * limit;

    let whereConditions: string[] = ["no_id LIKE '%NR%'"];
    const params: any[] = [];

    if (effectiveBranch) {
      whereConditions.push("(id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)");
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereConditions.push("DATE_FORMAT(tgl_transaksi, '%Y-%m-%d') BETWEEN ? AND ?");
      params.push(tgl_from, tgl_to);
    }

    if (customer.trim()) {
      whereConditions.push("(id_customer = ? OR id_customer LIKE ?)");
      const custId = customer.split(' | ')[0].trim();
      params.push(custId, `%${custId}%`);
    }

    if (akun.trim()) {
      whereConditions.push("akun = ?");
      params.push(akun.trim());
    }

    if (search.trim()) {
      whereConditions.push("(id_transaksi LIKE ? OR keterangan LIKE ? OR id_bahan LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 1. Query Total Count
    const countSql = `SELECT COUNT(DISTINCT id_transaksi) as total FROM tb_retur ${whereClause}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // 2. Query Paginated Transaction Headers
    const headersSql = `
      SELECT 
        a.id_transaksi,
        a.tgl_transaksi,
        a.id_customer,
        c.nama_customer,
        a.keterangan,
        a.status_keluar,
        a.sales,
        a.akun,
        a.disc,
        a.disc_invoice,
        a.id_cabang,
        SUM(a.subtotal) as total_belanja
      FROM tb_retur a
      LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
      ${whereClause}
      GROUP BY a.id_transaksi
      ORDER BY a.id_transaksi DESC
      LIMIT ? OFFSET ?
    `;
    const headerParams = [...params, limit, offset];
    const [headerRows] = await pool.query<RowDataPacket[]>(headersSql, headerParams);

    // 3. Fetch items for each transaction
    const transactions = await Promise.all(
      headerRows.map(async (h) => {
        const [itemRows] = await pool.query<RowDataPacket[]>(
          `SELECT 
            no_id,
            invret,
            id_bahan,
            model,
            ukuran,
            qty,
            uom,
            harga,
            subtotal
           FROM tb_retur 
           WHERE id_transaksi = ?
           ORDER BY no_id ASC`,
          [h.id_transaksi]
        );

        return {
          id_transaksi: h.id_transaksi,
          tgl_transaksi: h.tgl_transaksi ? new Date(h.tgl_transaksi).toISOString().split('T')[0] : '',
          id_customer: h.id_customer || '',
          nama_customer: h.nama_customer || h.id_customer || 'CASH',
          status_keluar: h.status_keluar, // 'd' = Draft, 's' = Close
          keterangan: h.keterangan || '',
          sales: h.sales || '',
          akun: h.akun || 'CASH',
          total_belanja: Number(h.total_belanja) || 0,
          items: itemRows.map((it) => ({
            no_id: it.no_id,
            invret: it.invret || '',
            id_bahan: it.id_bahan,
            model: it.model || '',
            ukuran: it.ukuran || '',
            qty: Number(it.qty) || 0,
            uom: it.uom || 'PCS',
            harga: Number(it.harga) || 0,
            subtotal: Number(it.subtotal) || 0,
          })),
        };
      })
    );

    // 4. Calculate Customer Retur Total & Gudang Retur Total
    const [customerReturRows] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(subtotal) as total_cust 
       FROM tb_retur 
       ${whereClause ? whereClause + " AND id_customer != 'Hayami'" : "WHERE no_id LIKE '%NR%' AND id_customer != 'Hayami'"}`,
      params
    );

    const [gudangReturRows] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(subtotal) as total_gudang 
       FROM tb_retur 
       ${whereClause ? whereClause + " AND id_customer = 'Hayami'" : "WHERE no_id LIKE '%NR%' AND id_customer = 'Hayami'"}`,
      params
    );

    const totalReturCustomer = Number(customerReturRows[0]?.total_cust) || 0;
    const totalReturGudang = Number(gudangReturRows[0]?.total_gudang) || 0;

    return NextResponse.json({
      success: true,
      data: transactions,
      summary: {
        totalReturCustomer,
        totalReturGudang,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch retur barang error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data retur barang.' },
      { status: 500 }
    );
  }
}
