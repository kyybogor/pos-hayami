import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

const parseToYmd = (val: string): string => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.split('T')[0].substring(0, 10);
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return val;
  }
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || '';
    const date_detail_raw = searchParams.get('date_detail') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    // 1. IF DATE DETAIL IS REQUESTED (For Modal View)
    if (date_detail_raw) {
      const cleanDate = parseToYmd(date_detail_raw);

      let detailSalesBranchSql = '';
      const detailSalesParams: any[] = [cleanDate, cleanDate];
      if (effectiveBranch) {
        detailSalesBranchSql = ' AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)';
        detailSalesParams.push(effectiveBranch, effectiveBranch, effectiveBranch);
      }

      // Fetch sales transactions created on this date
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          a.id_transaksi,
          DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d') as tgl_transaksi,
          a.id_customer,
          c.nama_customer,
          a.akun,
          a.sisa_bayar,
          a.status,
          a.disc,
          a.disc_invoice,
          SUM(a.qty) as pcs,
          SUM(a.qty / 12) as lusin,
          SUM(a.subtotal) as subtotal_raw
         FROM tb_barang_keluar a
         LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
         WHERE (DATE(a.tgl_transaksi) = ? OR a.tgl_transaksi LIKE CONCAT(?, '%')) AND a.status_keluar <> 'd' ${detailSalesBranchSql}
         GROUP BY a.id_transaksi, DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d'), a.id_customer, c.nama_customer, a.akun, a.sisa_bayar, a.status, a.disc, a.disc_invoice
         ORDER BY a.id_transaksi DESC`,
        detailSalesParams
      );

      const penjualanItems = salesRows.map((r) => {
        const disc = (Number(r.disc) || 0) + (Number(r.disc_invoice) || 0);
        const totalNota = (Number(r.subtotal_raw) || 0) - disc;
        const akun = String(r.akun || 'CASH').trim();
        const isHutang = akun.toUpperCase() === 'HUTANG';
        const pcs = Number(r.pcs) || 0;
        const lusin = Number(r.lusin) || (pcs / 12);
        
        let terbayar = totalNota;
        if (isHutang) {
          terbayar = Number(r.sisa_bayar) || 0;
        }

        return {
          id_transaksi: r.id_transaksi,
          tgl_transaksi: r.tgl_transaksi || cleanDate,
          id_customer: r.id_customer,
          nama_customer: r.nama_customer || r.id_customer,
          akun,
          pcs,
          lusin,
          total_nota: totalNota,
          penerimaan: terbayar,
          status: r.status || '',
        };
      });

      let detailArBranchSql = '';
      const detailArParams: any[] = [cleanDate, cleanDate];
      if (effectiveBranch) {
        detailArBranchSql = ' AND (COALESCE(NULLIF(p.id_cabang, \'\'), bk.id_cabang) = ? OR COALESCE(NULLIF(p.id_cabang, \'\'), bk.id_cabang) = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = COALESCE(NULLIF(p.id_cabang, \'\'), bk.id_cabang))';
        detailArParams.push(effectiveBranch, effectiveBranch, effectiveBranch);
      }

      // Fetch AR payments received on this date
      const [arRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          p.no_id,
          p.id_pembayaran as id_transaksi,
          DATE_FORMAT(p.tgl_bayar, '%Y-%m-%d') as tgl_bayar,
          p.metode,
          p.nominal,
          p.keterangan,
          p.dibuat_oleh,
          bk.id_customer,
          c.nama_customer
         FROM tb_pembayaran p
         LEFT JOIN (
           SELECT DISTINCT id_transaksi, id_customer, id_cabang 
           FROM tb_barang_keluar 
           WHERE status_keluar <> 'd'
         ) bk ON p.id_pembayaran = bk.id_transaksi
         LEFT JOIN tb_customer c ON bk.id_customer = c.id_customer
         WHERE (DATE(p.tgl_bayar) = ? OR p.tgl_bayar LIKE CONCAT(?, '%')) ${detailArBranchSql}
         ORDER BY p.no_id DESC`,
        detailArParams
      );

      const arItems = arRows.map((r) => ({
        no_id: r.no_id,
        id_transaksi: r.id_transaksi,
        id_customer: r.id_customer || '-',
        nama_customer: r.nama_customer || r.id_customer || 'AR Customer',
        tgl_bayar: r.tgl_bayar || cleanDate,
        metode: r.metode || 'CASH',
        nominal: Number(r.nominal) || 0,
        keterangan: r.keterangan || '',
        dibuat_oleh: r.dibuat_oleh || 'admin',
      }));

      const totalPenjualanDirect = penjualanItems.reduce((acc, item) => acc + item.penerimaan, 0);
      const totalArReceived = arItems.reduce((acc, item) => acc + item.nominal, 0);

      return NextResponse.json({
        success: true,
        data: {
          tgl_transaksi: cleanDate,
          summary: {
            total_penjualan_direct: totalPenjualanDirect,
            total_ar_received: totalArReceived,
            grand_total: totalPenjualanDirect + totalArReceived,
          },
          penjualan: penjualanItems,
          penerimaan_ar: arItems,
        },
      });
    }

    // 2. SUMMARY BY DATE (Daily Aggregates)
    let salesWhere = "WHERE a.status_keluar <> 'd'";
    let arWhere = "WHERE 1=1";
    const salesParams: any[] = [];
    const arParams: any[] = [];

    if (effectiveBranch) {
      salesWhere += ' AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)';
      salesParams.push(effectiveBranch, effectiveBranch, effectiveBranch);

      arWhere += ' AND (COALESCE(NULLIF(p.id_cabang, \'\'), bk.id_cabang) = ? OR COALESCE(NULLIF(p.id_cabang, \'\'), bk.id_cabang) = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = COALESCE(NULLIF(p.id_cabang, \'\'), bk.id_cabang))';
      arParams.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      salesWhere += ' AND (DATE(a.tgl_transaksi) BETWEEN ? AND ?)';
      salesParams.push(tgl_from, tgl_to);

      arWhere += ' AND (DATE(p.tgl_bayar) BETWEEN ? AND ?)';
      arParams.push(tgl_from, tgl_to);
    } else if (tgl_from) {
      salesWhere += ' AND DATE(a.tgl_transaksi) >= ?';
      salesParams.push(tgl_from);

      arWhere += ' AND DATE(p.tgl_bayar) >= ?';
      arParams.push(tgl_from);
    } else if (tgl_to) {
      salesWhere += ' AND DATE(a.tgl_transaksi) <= ?';
      salesParams.push(tgl_to);

      arWhere += ' AND DATE(p.tgl_bayar) <= ?';
      arParams.push(tgl_to);
    }

    // Direct Sales query
    const [salesRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        a.id_transaksi,
        DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d') as tgl_key,
        a.akun,
        a.disc,
        a.disc_invoice,
        a.sisa_bayar,
        SUM(a.subtotal) as sbttl
       FROM tb_barang_keluar a
       ${salesWhere}
       GROUP BY a.id_transaksi, DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d'), a.akun, a.disc, a.disc_invoice, a.sisa_bayar`,
      salesParams
    );

    // AR Payments query
    const [arRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        p.no_id,
        p.id_pembayaran as id_transaksi,
        DATE_FORMAT(p.tgl_bayar, '%Y-%m-%d') as tgl_key,
        p.metode,
        p.nominal
       FROM tb_pembayaran p
       LEFT JOIN (
         SELECT DISTINCT id_transaksi, id_cabang 
         FROM tb_barang_keluar 
         WHERE status_keluar <> 'd'
       ) bk ON p.id_pembayaran = bk.id_transaksi
       ${arWhere}`,
      arParams
    );

    const dailyMap: Record<
      string,
      {
        tgl_transaksi: string;
        penjualan_tunai: number;
        penerimaan_ar: number;
        total_penerimaan: number;
        count_penjualan: number;
        count_ar: number;
        breakdown: Record<string, number>;
      }
    > = {};

    const getOrCreateDate = (dateKey: string) => {
      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = {
          tgl_transaksi: dateKey,
          penjualan_tunai: 0,
          penerimaan_ar: 0,
          total_penerimaan: 0,
          count_penjualan: 0,
          count_ar: 0,
          breakdown: {},
        };
      }
      return dailyMap[dateKey];
    };

    // Process Sales
    salesRows.forEach((r) => {
      const dateKey = parseToYmd(String(r.tgl_key || ''));
      if (!dateKey) return;

      const obj = getOrCreateDate(dateKey);
      const disc = (Number(r.disc) || 0) + (Number(r.disc_invoice) || 0);
      const sbttl = Number(r.sbttl) || 0;
      const totalNota = sbttl - disc;
      const akun = String(r.akun || 'CASH').trim();
      const isHutang = akun.toUpperCase() === 'HUTANG';

      let received = totalNota;
      if (isHutang) {
        received = Number(r.sisa_bayar) || 0;
      }

      if (received > 0) {
        obj.penjualan_tunai += received;
        obj.total_penerimaan += received;
        obj.count_penjualan += 1;

        const method = isHutang ? 'DP HUTANG' : akun.toUpperCase();
        obj.breakdown[method] = (obj.breakdown[method] || 0) + received;
      }
    });

    // Process AR Payments
    arRows.forEach((r) => {
      const dateKey = parseToYmd(String(r.tgl_key || ''));
      if (!dateKey) return;

      const obj = getOrCreateDate(dateKey);
      const nominal = Number(r.nominal) || 0;
      const metode = String(r.metode || 'CASH').trim().toUpperCase();

      if (nominal > 0) {
        obj.penerimaan_ar += nominal;
        obj.total_penerimaan += nominal;
        obj.count_ar += 1;

        const methodKey = `AR (${metode})`;
        obj.breakdown[methodKey] = (obj.breakdown[methodKey] || 0) + nominal;
      }
    });

    // Sort by date descending
    const list = Object.values(dailyMap).sort((a, b) => (a.tgl_transaksi < b.tgl_transaksi ? 1 : -1));

    const grandPenjualan = list.reduce((sum, item) => sum + item.penjualan_tunai, 0);
    const grandAr = list.reduce((sum, item) => sum + item.penerimaan_ar, 0);
    const grandTotal = list.reduce((sum, item) => sum + item.total_penerimaan, 0);

    return NextResponse.json({
      success: true,
      summary: {
        total_penjualan_direct: grandPenjualan,
        total_ar_received: grandAr,
        grand_total: grandTotal,
        total_hari: list.length,
      },
      data: list,
    });
  } catch (error: any) {
    console.error('Error in GET /api/penerimaan-harian:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
