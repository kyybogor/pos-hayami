import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Fetch dropdown options for customers if requested
    if (getOptions) {
      const [custRows] = await pool.query<RowDataPacket[]>(`
        SELECT DISTINCT c.id_customer, c.nama_customer 
        FROM tb_customer c 
        WHERE c.nama_customer IS NOT NULL AND c.nama_customer != '' 
        ORDER BY c.nama_customer ASC
      `);

      return NextResponse.json({
        success: true,
        options: {
          customers: custRows.map((r) => ({
            id: r.id_customer,
            nama: r.nama_customer || r.id_customer,
          })),
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
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10));
    const offset = (page - 1) * limit;

    let whereSql = "WHERE a.status_keluar <> 'd' AND a.id_customer != ''";
    const params: any[] = [];

    if (effectiveBranch) {
      whereSql += ' AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereSql += ' AND (a.tgl_transaksi BETWEEN ? AND ?)';
      params.push(tgl_from, tgl_to);
    } else if (tgl_from) {
      whereSql += ' AND a.tgl_transaksi >= ?';
      params.push(tgl_from);
    } else if (tgl_to) {
      whereSql += ' AND a.tgl_transaksi <= ?';
      params.push(tgl_to);
    }

    if (customerFilter.trim() !== '') {
      whereSql += ' AND (a.id_customer = ? OR c.nama_customer LIKE ?)';
      params.push(customerFilter.trim(), `%${customerFilter.trim()}%`);
    }

    // Query all rows matching filter for accurate summary calculation
    const querySql = `
      SELECT 
        a.tgl_transaksi,
        a.tgl_jatuh_tempo,
        a.id_customer,
        c.nama_customer,
        a.id_transaksi,
        a.disc,
        a.disc_invoice,
        a.akun,
        a.status as status_db,
        SUM(a.qty / 12) as lsn,
        SUM(a.subtotal) as sbttl
      FROM tb_retur a
      LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
      ${whereSql}
      GROUP BY a.id_transaksi, a.id_customer, c.nama_customer, a.tgl_transaksi, a.tgl_jatuh_tempo, a.disc, a.disc_invoice, a.akun, a.status
      ORDER BY a.tgl_transaksi DESC, a.id_transaksi DESC
    `;

    const [allRows] = await pool.query<RowDataPacket[]>(querySql, params);

    const processedItems = allRows.map((r) => {
      const lsn = Number(r.lsn) || 0;
      const sbttl = Number(r.sbttl) || 0;
      const disc = (Number(r.disc) || 0) + (Number(r.disc_invoice) || 0);
      const total = sbttl - disc;

      let status = 'Lunas';
      if (r.akun === 'HUTANG' && r.status_db === 'Belum Lunas') {
        status = 'Belum Lunas';
      }

      return {
        id_transaksi: r.id_transaksi,
        tgl_transaksi: r.tgl_transaksi,
        tgl_jatuh_tempo: r.tgl_jatuh_tempo || r.tgl_transaksi,
        id_customer: r.id_customer,
        nama_customer: r.nama_customer || r.id_customer,
        lusin: lsn,
        subtotal: sbttl,
        diskon: disc,
        total,
        status,
      };
    });

    const totalItems = processedItems.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Paginate in memory
    const paginatedItems = processedItems.slice(offset, offset + limit);

    // Calculate Grand Totals
    let grandLusin = 0;
    let grandSubtotal = 0;
    let grandDiskon = 0;
    let grandTotal = 0;

    processedItems.forEach((item) => {
      grandLusin += item.lusin;
      grandSubtotal += item.subtotal;
      grandDiskon += item.diskon;
      grandTotal += item.total;
    });

    return NextResponse.json({
      success: true,
      data: {
        items: paginatedItems,
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
          grand_lusin: grandLusin,
          grand_subtotal: grandSubtotal,
          grand_diskon: grandDiskon,
          grand_total: grandTotal,
        },
        filters: {
          tgl_from,
          tgl_to,
          customer: customerFilter,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Barang Retur Rekap error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data rekapitulasi retur.' },
      { status: 500 }
    );
  }
}
