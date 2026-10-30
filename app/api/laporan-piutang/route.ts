import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Fetch dropdown options for customers and accounts if requested
    if (getOptions) {
      const [custRows] = await pool.query<RowDataPacket[]>(`
        SELECT DISTINCT c.id_customer, c.nama_customer 
        FROM tb_customer c
        WHERE c.nama_customer IS NOT NULL AND c.nama_customer != ''
        ORDER BY c.nama_customer ASC
      `);

      const [akunRows] = await pool.query<RowDataPacket[]>(`
        SELECT id_akun, tipe, bank, nama_akun, no_akun FROM tb_akun ORDER BY tipe ASC, bank ASC
      `);

      return NextResponse.json({
        success: true,
        options: {
          customers: custRows.map((r) => ({
            id: r.id_customer,
            nama: r.nama_customer || r.id_customer,
          })),
          akuns: akunRows.map((r) => ({
            id: r.id_akun,
            tipe: r.tipe,
            bank: r.bank,
            nama_akun: r.nama_akun,
            no_akun: r.no_akun,
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
    const statusFilter = searchParams.get('status') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10));
    const offset = (page - 1) * limit;

    let whereSql = "WHERE a.status_keluar <> 'd' AND UPPER(TRIM(a.akun)) = 'HUTANG' AND a.id_customer != ''";
    const params: any[] = [];

    if (effectiveBranch) {
      whereSql += ' AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereSql += ' AND (a.tgl_transaksi BETWEEN ? AND ?)';
      params.push(
        tgl_from.trim().includes(' ') ? tgl_from.trim() : `${tgl_from.trim()} 00:00:00`,
        tgl_to.trim().includes(' ') ? tgl_to.trim() : `${tgl_to.trim()} 23:59:59`
      );
    } else if (tgl_from) {
      whereSql += ' AND a.tgl_transaksi >= ?';
      params.push(tgl_from.trim().includes(' ') ? tgl_from.trim() : `${tgl_from.trim()} 00:00:00`);
    } else if (tgl_to) {
      whereSql += ' AND a.tgl_transaksi <= ?';
      params.push(tgl_to.trim().includes(' ') ? tgl_to.trim() : `${tgl_to.trim()} 23:59:59`);
    }

    if (customerFilter.trim() !== '') {
      whereSql += ' AND (a.id_customer = ? OR c.nama_customer LIKE ?)';
      params.push(customerFilter.trim(), `%${customerFilter.trim()}%`);
    }

    // Base subquery grouped by transaction ID
    const baseSubquery = `
      SELECT 
        a.id_transaksi,
        a.id_customer,
        c.nama_customer,
        a.tgl_transaksi,
        a.tgl_jatuh_tempo,
        a.disc,
        a.disc_invoice,
        a.sisa_bayar,
        a.akun,
        a.status as status_db,
        SUM(a.qty / 12) as lsn,
        SUM(a.subtotal) as sbttl
      FROM tb_barang_keluar a
      LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
      ${whereSql}
      GROUP BY a.id_transaksi, a.id_customer, c.nama_customer, a.tgl_transaksi, a.tgl_jatuh_tempo, a.disc, a.disc_invoice, a.sisa_bayar, a.akun, a.status
    `;

    // Fetch all records for the current filter to calculate status & summary totals accurately
    const [allRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM (${baseSubquery}) t ORDER BY t.tgl_transaksi DESC, t.id_transaksi DESC`,
      params
    );

    // Map and calculate fields
    const processedItems = allRows.map((r) => {
      const disc = (Number(r.disc) || 0) + (Number(r.disc_invoice) || 0);
      const sbttl = Number(r.sbttl) || 0;
      const total = sbttl - disc;
      const sisaBayar = Number(r.sisa_bayar) || 0;
      const outstanding = Math.max(0, total - sisaBayar);

      let status = 'Belum Lunas';
      if (sisaBayar > 0) {
        if (Math.round(sisaBayar) >= Math.round(total)) {
          status = 'Lunas';
        } else {
          status = 'Bayar Sebagian';
        }
      } else if (r.status_db === 'Lunas') {
        status = 'Lunas';
      }

      return {
        id_transaksi: r.id_transaksi,
        tgl_transaksi: r.tgl_transaksi,
        tgl_jatuh_tempo: r.tgl_jatuh_tempo || r.tgl_transaksi,
        id_customer: r.id_customer,
        nama_customer: r.nama_customer || r.id_customer,
        lusin: Number(r.lsn) || 0,
        total,
        terbayar: sisaBayar,
        outstanding,
        status,
      };
    });

    // Filter by calculated status if status filter applied
    let filteredItems = processedItems;
    if (statusFilter && statusFilter !== 'Semua') {
      filteredItems = processedItems.filter((item) => {
        if (
          statusFilter === 'Bayar Sebagian' ||
          statusFilter === 'Cicil' ||
          statusFilter === 'Partially Paid'
        ) {
          return (
            item.status === 'Bayar Sebagian' ||
            item.status === 'Cicil' ||
            item.status === 'Partially Paid'
          );
        }
        return item.status === statusFilter;
      });
    }

    const totalItems = filteredItems.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Paginate in memory after status calculation
    const paginatedItems = filteredItems.slice(offset, offset + limit);

    // Calculate Grand Totals
    let grandTotalLusin = 0;
    let grandTotalTagihan = 0;
    let grandTotalTerbayar = 0;
    let grandTotalOutstanding = 0;

    filteredItems.forEach((item) => {
      grandTotalLusin += item.lusin;
      grandTotalTagihan += item.total;
      grandTotalTerbayar += item.terbayar;
      grandTotalOutstanding += item.outstanding;
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
          total_lusin: grandTotalLusin,
          total_tagihan: grandTotalTagihan,
          total_terbayar: grandTotalTerbayar,
          total_outstanding: grandTotalOutstanding,
        },
        filters: {
          tgl_from,
          tgl_to,
          customer: customerFilter,
          status: statusFilter,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Laporan Piutang error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data laporan piutang customer.' },
      { status: 500 }
    );
  }
}
