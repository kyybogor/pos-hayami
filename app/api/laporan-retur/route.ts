import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Fetch dropdown options for customers and bahan concurrently
    if (getOptions) {
      const [[custRows], [bahanRows]] = await Promise.all([
        pool.query<RowDataPacket[]>(`
          SELECT DISTINCT c.id_customer, c.nama_customer 
          FROM tb_customer c 
          WHERE c.nama_customer IS NOT NULL AND c.nama_customer != '' 
          ORDER BY c.nama_customer ASC
        `),
        pool.query<RowDataPacket[]>(`
          SELECT DISTINCT nama_bahan 
          FROM tb_bahan 
          WHERE nama_bahan IS NOT NULL AND nama_bahan != '' 
          ORDER BY nama_bahan ASC
        `),
      ]);

      return NextResponse.json({
        success: true,
        options: {
          customers: custRows.map((r) => ({
            id: r.id_customer,
            nama: r.nama_customer || r.id_customer,
          })),
          bahan: bahanRows.map((r) => r.nama_bahan),
        },
      });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    // 2. Filters
    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || '';
    const customerFilter = searchParams.get('customer') || searchParams.get('nama_customer') || '';
    const bahanFilter = searchParams.get('bahan') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10));
    const offset = (page - 1) * limit;

    let whereSql = "WHERE r.status <> 'd'";
    const params: any[] = [];

    if (effectiveBranch) {
      whereSql += ' AND (r.id_cabang = ? OR r.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = r.id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereSql += ' AND (r.tgl_transaksi BETWEEN ? AND ?)';
      params.push(
        tgl_from.trim().includes(' ') ? tgl_from.trim() : `${tgl_from.trim()} 00:00:00`,
        tgl_to.trim().includes(' ') ? tgl_to.trim() : `${tgl_to.trim()} 23:59:59`
      );
    } else if (tgl_from) {
      whereSql += ' AND r.tgl_transaksi >= ?';
      params.push(tgl_from.trim().includes(' ') ? tgl_from.trim() : `${tgl_from.trim()} 00:00:00`);
    } else if (tgl_to) {
      whereSql += ' AND r.tgl_transaksi <= ?';
      params.push(tgl_to.trim().includes(' ') ? tgl_to.trim() : `${tgl_to.trim()} 23:59:59`);
    }

    if (customerFilter.trim() !== '') {
      whereSql += ' AND (r.id_customer = ? OR c.nama_customer LIKE ?)';
      params.push(customerFilter.trim(), `%${customerFilter.trim()}%`);
    }

    if (bahanFilter.trim() !== '') {
      whereSql += ' AND r.id_bahan = ?';
      params.push(bahanFilter.trim());
    }

    // Subquery grouped by transaction ID
    const baseSubquery = `
      SELECT 
        r.id_transaksi,
        r.id_customer,
        c.nama_customer,
        r.tgl_transaksi,
        COALESCE(r.ppn, 0) as ppn
      FROM tb_retur r
      LEFT JOIN tb_customer c ON r.id_customer = c.id_customer
      ${whereSql}
      GROUP BY r.id_transaksi, r.id_customer, c.nama_customer, r.tgl_transaksi, r.ppn
    `;

    // Fetch all transactions matching filter to calculate summary totals
    const [allTrxRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM (${baseSubquery}) t ORDER BY t.tgl_transaksi DESC, t.id_transaksi DESC`,
      params
    );

    const totalItems = allTrxRows.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Paginate transactions
    const paginatedTrxRows = allTrxRows.slice(offset, offset + limit);

    if (allTrxRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          items: [],
          pagination: {
            page,
            limit,
            total_items: 0,
            total_pages: 1,
            from_item: 0,
            to_item: 0,
          },
          summary: {
            total_transaksi: 0,
            total_qty: 0,
            total_retur_customer: 0,
            total_retur_gudang: 0,
            grand_total_retur: 0,
          },
          filters: { tgl_from, tgl_to, customer: customerFilter, bahan: bahanFilter },
        },
      });
    }

    // Fetch details for ALL matching transactions to calculate grand summary
    const allTrxIds = allTrxRows.map((t) => t.id_transaksi);
    const [allDetails] = await pool.query<RowDataPacket[]>(
      `SELECT 
         r.no_id,
         r.id_transaksi,
         r.tgl_transaksi,
         r.id_customer,
         c.nama_customer,
         r.id_bahan,
         r.model,
         r.ukuran,
         r.qty,
         r.uom,
         r.harga,
         r.total,
         r.ppn
       FROM tb_retur r
       LEFT JOIN tb_customer c ON r.id_customer = c.id_customer
       WHERE r.status <> 'd' AND r.id_transaksi IN (?)
       ORDER BY r.tgl_transaksi DESC, r.id_transaksi DESC, r.no_id ASC`,
      [allTrxIds]
    );

    // Build map for item details grouped by transaction ID
    const detailsMap = new Map<string, any[]>();
    let overallQty = 0;
    let grandTotalRetur = 0;
    let grandReturGudang = 0;

    // First, group all details
    allDetails.forEach((row) => {
      const trxId = row.id_transaksi;
      if (!detailsMap.has(trxId)) {
        detailsMap.set(trxId, []);
      }

      const qty = Number(row.qty) || 0;
      const harga = Number(row.harga) || 0;
      const total = Number(row.total) || 0;

      overallQty += qty;

      detailsMap.get(trxId)!.push({
        no_id: row.no_id,
        id_bahan: row.id_bahan || '',
        model: row.model || '',
        ukuran: row.ukuran || '',
        nama_barang: `${row.id_bahan || ''} - ${row.model || ''}`.trim(),
        qty,
        uom: row.uom || 'PCS',
        harga,
        total,
      });
    });

    // Compute grand totals per transaction
    allTrxRows.forEach((trx) => {
      const trxId = trx.id_transaksi;
      const items = detailsMap.get(trxId) || [];
      const subtotal = items.reduce((acc, it) => acc + it.total, 0);
      const ppnPercent = Number(trx.ppn) || 0;
      const ppnAmount = subtotal * (ppnPercent / 100);
      const trxGrandTotal = subtotal + ppnAmount;

      grandTotalRetur += trxGrandTotal;

      const custName = (trx.nama_customer || trx.id_customer || '').trim().toLowerCase();
      if (custName === 'hayami' || trx.id_customer === 'Hayami') {
        grandReturGudang += trxGrandTotal;
      }
    });

    const grandReturCustomer = grandTotalRetur - grandReturGudang;

    // Build response transactions list for the current page
    const pageTrxList = paginatedTrxRows.map((trx) => {
      const trxId = trx.id_transaksi;
      const items = detailsMap.get(trxId) || [];
      const subtotal = items.reduce((acc, it) => acc + it.total, 0);
      const ppnPercent = Number(trx.ppn) || 0;
      const ppnAmount = subtotal * (ppnPercent / 100);
      const totalDenganPpn = subtotal + ppnAmount;

      return {
        id_transaksi: trxId,
        tgl_transaksi: trx.tgl_transaksi,
        id_customer: trx.id_customer,
        nama_customer: trx.nama_customer || trx.id_customer,
        is_retur_gudang: (trx.id_customer || '').toLowerCase() === 'hayami',
        subtotal,
        ppn_percent: ppnPercent,
        ppn_amount: ppnAmount,
        total: totalDenganPpn,
        item_count: items.length,
        items,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: pageTrxList,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
          from_item: totalItems > 0 ? offset + 1 : 0,
          to_item: Math.min(offset + limit, totalItems),
        },
        summary: {
          total_transaksi: totalItems,
          total_qty: overallQty,
          total_retur_customer: grandReturCustomer,
          total_retur_gudang: grandReturGudang,
          grand_total_retur: grandTotalRetur,
        },
        filters: {
          tgl_from,
          tgl_to,
          customer: customerFilter,
          bahan: bahanFilter,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Laporan Retur error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data laporan retur.' },
      { status: 500 }
    );
  }
}
