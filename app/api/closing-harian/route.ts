import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
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
    const id = searchParams.get('id') || '';
    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || '';
    const id_cabang = searchParams.get('id_cabang') || '';
    const search = (searchParams.get('search') || '').trim();

    // 1. If fetching single closing detail
    if (id) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM tb_closing_harian WHERE id = ? OR no_penutupan = ? LIMIT 1`,
        [id, id]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Data closing tidak ditemukan.' },
          { status: 404 }
        );
      }

      const closing = rows[0];

      // Fetch product detail from tb_closing_harian_detail
      const [detailRows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM tb_closing_harian_detail WHERE id_closing = ? ORDER BY id ASC`,
        [closing.id]
      );

      let products = detailRows;
      if (products.length === 0 && closing.produk_json) {
        try {
          products = JSON.parse(closing.produk_json);
        } catch {
          products = [];
        }
      }

      let pembayaran: Record<string, number> = {};
      if (closing.pembayaran_json) {
        try {
          pembayaran = JSON.parse(closing.pembayaran_json);
        } catch {}
      } else {
        if (Number(closing.nominal_cash) > 0) pembayaran['CASH'] = Number(closing.nominal_cash);
        if (Number(closing.nominal_transfer) > 0) pembayaran['TRANSFER'] = Number(closing.nominal_transfer);
        if (Number(closing.nominal_hutang) > 0) pembayaran['HUTANG'] = Number(closing.nominal_hutang);
      }

      return NextResponse.json({
        success: true,
        data: {
          closing: {
            ...closing,
            pembayaran,
          },
          products,
          pembayaran,
        },
      });
    }

    // 2. Query closed data from tb_closing_harian
    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    if (tgl_from && tgl_to) {
      whereSql += ' AND (tgl_transaksi BETWEEN ? AND ? OR DATE(tgl_closing) BETWEEN ? AND ?)';
      params.push(tgl_from, tgl_to, tgl_from, tgl_to);
    } else if (tgl_from) {
      whereSql += ' AND (tgl_transaksi >= ? OR DATE(tgl_closing) >= ?)';
      params.push(tgl_from, tgl_from);
    } else if (tgl_to) {
      whereSql += ' AND (tgl_transaksi <= ? OR DATE(tgl_closing) <= ?)';
      params.push(tgl_to, tgl_to);
    }

    if (id_cabang && id_cabang !== 'ALL') {
      whereSql += ' AND id_cabang = ?';
      params.push(id_cabang);
    }

    if (search) {
      whereSql += ' AND (no_penutupan LIKE ? OR kasir LIKE ? OR catatan LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM tb_closing_harian ${whereSql} ORDER BY tgl_closing DESC, id DESC`,
      params
    );

    // Calculate Summary Metrics
    let grandTotalTransaksi = 0;
    let grandTotalQty = 0;
    let grandTotalPenjualan = 0;
    let grandTotalRetur = 0;
    let grandTotalBersih = 0;
    let grandNominalCash = 0;
    let grandNominalHutang = 0;
    let grandNominalTransfer = 0;

    const items = rows.map((r) => {
      let parsedProducts = [];
      if (r.produk_json) {
        try {
          parsedProducts = JSON.parse(r.produk_json);
        } catch {}
      }

      const totalPenjualan = Number(r.total_penjualan) || 0;
      const totalRetur = Number(r.total_retur) || 0;
      const totalBersih = Number(r.total_bersih) || Math.max(0, totalPenjualan - totalRetur);
      const totalQty = Number(r.total_qty_bersih) || Number(r.total_qty_penjualan) || 0;
      const totalTx = Number(r.total_transaksi) || 0;
      const nomCash = Number(r.nominal_cash) || 0;
      const nomHutang = Number(r.nominal_hutang) || 0;
      const nomTransfer = Number(r.nominal_transfer) || 0;

      grandTotalTransaksi += totalTx;
      grandTotalQty += totalQty;
      grandTotalPenjualan += totalPenjualan;
      grandTotalRetur += totalRetur;
      grandTotalBersih += totalBersih;
      grandNominalCash += nomCash;
      grandNominalHutang += nomHutang;
      grandNominalTransfer += nomTransfer;

      let parsedPembayaran: Record<string, number> = {};
      if (r.pembayaran_json) {
        try {
          parsedPembayaran = JSON.parse(r.pembayaran_json);
        } catch {}
      } else {
        if (nomCash > 0) parsedPembayaran['CASH'] = nomCash;
        if (nomTransfer > 0) parsedPembayaran['TRANSFER'] = nomTransfer;
        if (nomHutang > 0) parsedPembayaran['HUTANG'] = nomHutang;
      }

      return {
        id: r.id,
        no_penutupan: r.no_penutupan,
        tgl_closing: r.tgl_closing,
        tgl_transaksi: r.tgl_transaksi,
        id_cabang: r.id_cabang || '-',
        kasir: r.kasir,
        kas_pembukaan: Number(r.kas_pembukaan) || 0,
        total_penjualan: totalPenjualan,
        total_retur: totalRetur,
        total_bersih: totalBersih,
        total_qty_penjualan: Number(r.total_qty_penjualan) || 0,
        total_qty_retur: Number(r.total_qty_retur) || 0,
        total_qty_bersih: totalQty,
        total_transaksi: totalTx,
        nominal_cash: nomCash,
        nominal_hutang: nomHutang,
        nominal_transfer: nomTransfer,
        catatan: r.catatan || '',
        products: parsedProducts,
        pembayaran: parsedPembayaran,
      };
    });

    // Fetch branches for filter and modal
    const [branchRows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang ORDER BY id_cabang ASC'
    );

    return NextResponse.json({
      success: true,
      data: {
        items,
        branches: branchRows,
        summary: {
          total_closing: items.length,
          grand_total_transaksi: grandTotalTransaksi,
          grand_total_qty: grandTotalQty,
          grand_total_penjualan: grandTotalPenjualan,
          grand_total_retur: grandTotalRetur,
          grand_total_bersih: grandTotalBersih,
          grand_nominal_cash: grandNominalCash,
          grand_nominal_hutang: grandNominalHutang,
          grand_nominal_transfer: grandNominalTransfer,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Closing Harian error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data closing harian.' },
      { status: 500 }
    );
  }
}
