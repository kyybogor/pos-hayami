import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // Return options for filter dropdowns (customers)
    if (getOptions) {
      const [customers] = await pool.query<RowDataPacket[]>(
        'SELECT id_customer, nama_customer FROM tb_customer ORDER BY nama_customer ASC'
      );

      return NextResponse.json({
        success: true,
        options: {
          suppliers: customers.map((c) => ({
            id: c.id_customer,
            name: c.nama_customer,
          })),
        },
      });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const today = new Date().toISOString().split('T')[0];
    const tgl_from = searchParams.get('tgl_from') || today;
    const tgl_to = searchParams.get('tgl_to') || today;
    const supplier = searchParams.get('supplier') || searchParams.get('customer') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const fromStr = tgl_from.trim().includes(' ') ? tgl_from.trim() : `${tgl_from.trim()} 00:00:00`;
    const toStr = tgl_to.trim().includes(' ') ? tgl_to.trim() : `${tgl_to.trim()} 23:59:59`;

    let whereSql = "WHERE (a.tgl_transaksi BETWEEN ? AND ?) AND a.status_keluar <> 'd' AND a.id_customer != ''";
    const params: any[] = [fromStr, toStr];

    if (effectiveBranch) {
      whereSql += ' AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (supplier.trim() !== '') {
      const suppPart = supplier.split(' | ')[0].trim();
      whereSql += ' AND (a.id_customer = ? OR c.nama_customer LIKE ?)';
      params.push(suppPart, `%${supplier.trim()}%`);
    }

    const mainQuery = `
      SELECT 
        a.tgl_transaksi,
        a.tgl_jatuh_tempo,
        a.id_customer,
        a.id_transaksi,
        a.disc,
        a.disc_invoice,
        a.akun,
        a.status,
        SUM(a.qty / 12) as lsn,
        SUM(a.subtotal) as sbttl,
        c.nama_customer
      FROM tb_barang_keluar a
      LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
      ${whereSql}
      GROUP BY a.id_transaksi
      ORDER BY a.tgl_transaksi ASC, a.id_transaksi ASC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(mainQuery, params);

    let grandTotal = 0;
    let grandDiskon = 0;
    let grandLusin = 0;

    const data = rows.map((r) => {
      const discVal = Number(r.disc) || 0;
      const discInvoiceVal = Number(r.disc_invoice) || 0;
      const totalDiskon = discVal + discInvoiceVal;

      const subtotalVal = Number(r.sbttl) || 0;
      const totalVal = subtotalVal - totalDiskon;
      const lusinVal = Number(r.lsn) || 0;

      let statusStr = 'Lunas';
      if (r.akun === 'HUTANG' && r.status === 'Belum Lunas') {
        statusStr = 'Belum Lunas';
      }

      grandTotal += totalVal;
      grandDiskon += totalDiskon;
      grandLusin += lusinVal;

      return {
        tgl_transaksi: r.tgl_transaksi,
        tgl_jatuh_tempo: r.tgl_jatuh_tempo,
        id_transaksi: r.id_transaksi,
        id_customer: r.id_customer,
        nama_customer: r.nama_customer || r.id_customer || 'Customer',
        lusin: lusinVal,
        subtotal: subtotalVal,
        diskon: totalDiskon,
        total: totalVal,
        status: statusStr,
        akun: r.akun || '',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        transactions: data,
        summary: {
          total_transactions: data.length,
          grand_total: grandTotal,
          grand_diskon: grandDiskon,
          grand_lusin: grandLusin,
        },
        filters: {
          tgl_from,
          tgl_to,
          supplier,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Rekapitulasi Penjualan error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data rekapitulasi penjualan.' },
      { status: 500 }
    );
  }
}
