import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';

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
    const tgl_transaksi_raw = searchParams.get('tgl_transaksi') || searchParams.get('tgl') || '';
    let id_cabang = (searchParams.get('id_cabang') || '').trim();

    // If id_cabang is empty or ALL, attempt resolving from session
    if (!id_cabang || id_cabang === 'ALL') {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('pos_session')?.value;
        if (token) {
          const session = await verifySessionToken(token);
          if (session?.branch && session.branch !== 'ALL') {
            id_cabang = session.branch;
          }
        }
      } catch (err) {
        console.error('Session branch resolution error in preview:', err);
      }
    }

    if (!id_cabang || id_cabang === 'ALL') {
      return NextResponse.json(
        {
          success: false,
          message: 'Cabang harus ditentukan. Setiap cabang harus melakukan closing masing-masing.',
        },
        { status: 400 }
      );
    }

    const cleanDate = parseToYmd(tgl_transaksi_raw) || new Date().toISOString().split('T')[0];

    // Resolve branch id & branch name directly to avoid SQL collation issues between tb_barang_keluar & tb_cabang
    const [cabangRows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang WHERE id_cabang = ? OR nama_cabang = ? LIMIT 1',
      [id_cabang, id_cabang]
    );
    const branchIdStr = cabangRows[0] ? String(cabangRows[0].id_cabang) : id_cabang;
    const branchNameStr = cabangRows[0] ? String(cabangRows[0].nama_cabang) : id_cabang;
    const displayCabang = cabangRows[0]?.nama_cabang || id_cabang;

    // 1. Fetch unclosed sales from tb_barang_keluar
    let salesWhere = "WHERE (DATE(a.tgl_transaksi) = ? OR a.tgl_transaksi LIKE CONCAT(?, '%')) AND a.status_keluar <> 'd' AND (a.is_closing = 0 OR a.is_closing IS NULL)";
    const salesParams: any[] = [cleanDate, cleanDate];

    salesWhere += ' AND (a.id_cabang = ? OR a.id_cabang = ?)';
    salesParams.push(branchIdStr, branchNameStr);

    const [salesRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        a.id_transaksi,
        a.id_customer,
        a.akun,
        a.disc,
        a.disc_invoice,
        a.id_bahan,
        a.model,
        a.ukuran,
        a.qty,
        a.harga,
        a.subtotal,
        a.id_cabang
      FROM tb_barang_keluar a
      ${salesWhere}
      ORDER BY a.id_transaksi ASC`,
      salesParams
    );

    // 2. Fetch unclosed retur from tb_retur
    let returWhere = "WHERE (DATE(r.tgl_transaksi) = ? OR r.tgl_transaksi LIKE CONCAT(?, '%')) AND r.status_keluar <> 'd' AND (r.is_closing = 0 OR r.is_closing IS NULL)";
    const returParams: any[] = [cleanDate, cleanDate];

    returWhere += ' AND (r.id_cabang = ? OR r.id_cabang = ?)';
    returParams.push(branchIdStr, branchNameStr);

    const [returRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        r.id_transaksi,
        r.id_bahan,
        r.model,
        r.ukuran,
        r.qty,
        r.harga,
        r.subtotal
      FROM tb_retur r
      ${returWhere}
      ORDER BY r.id_transaksi ASC`,
      returParams
    );

    // Calculate next sequential no_penutupan
    const [maxNoRows] = await pool.query<RowDataPacket[]>(
      `SELECT MAX(CAST(no_penutupan AS UNSIGNED)) as max_no FROM tb_closing_harian`
    );
    const maxNo = maxNoRows[0]?.max_no;
    const nextNoPenutupan = maxNo ? String(Number(maxNo) + 1) : '638';

    // Group sales transactions to calculate total sales and payment breakdowns
    const distinctTx = new Set<string>();
    let totalPenjualanKotor = 0;
    let totalDiskon = 0;
    let nominalCash = 0;
    let nominalHutang = 0;
    let nominalTransfer = 0;
    const akunBreakdown: Record<string, number> = {};

    // Grouping by invoice id_transaksi for proper invoice discount handling
    const txMap: Record<string, { akun: string; disc: number; disc_invoice: number; subtotal: number }> = {};

    salesRows.forEach((r) => {
      const txId = r.id_transaksi;
      distinctTx.add(txId);

      if (!txMap[txId]) {
        txMap[txId] = {
          akun: String(r.akun || 'CASH').trim(),
          disc: Number(r.disc) || 0,
          disc_invoice: Number(r.disc_invoice) || 0,
          subtotal: 0,
        };
      }
      txMap[txId].subtotal += Number(r.subtotal) || 0;
    });

    Object.values(txMap).forEach((tx) => {
      const totalNota = Math.max(0, tx.subtotal - (tx.disc + tx.disc_invoice));
      totalPenjualanKotor += totalNota;
      totalDiskon += tx.disc + tx.disc_invoice;

      const upperAkun = tx.akun.toUpperCase();
      if (upperAkun === 'CASH') {
        nominalCash += totalNota;
      } else if (upperAkun === 'HUTANG') {
        nominalHutang += totalNota;
      } else {
        nominalTransfer += totalNota;
      }

      akunBreakdown[tx.akun] = (akunBreakdown[tx.akun] || 0) + totalNota;
    });

    // Calculate retur
    let totalRetur = 0;
    let totalQtyRetur = 0;
    returRows.forEach((r) => {
      totalRetur += Number(r.subtotal) || 0;
      totalQtyRetur += Number(r.qty) || 0;
    });

    // Group products sold & retur
    interface ProductAgg {
      id_bahan: string;
      model: string;
      ukuran: string;
      nama_barang: string;
      qty_penjualan: number;
      qty_retur: number;
      total_qty: number;
      harga_satuan: number;
      total_penjualan: number;
    }

    const productMap: Record<string, ProductAgg> = {};

    salesRows.forEach((r) => {
      const idBahan = (r.id_bahan || '').trim();
      const model = (r.model || '').trim();
      const ukuran = (r.ukuran || '').trim();
      const key = `${idBahan}___${model}___${ukuran}`;

      let displayName = '';
      if (model && ukuran) {
        displayName = `${model} (${ukuran})`;
      } else if (model) {
        displayName = model;
      } else if (idBahan && ukuran) {
        displayName = `${idBahan} (${ukuran})`;
      } else {
        displayName = idBahan || 'Item';
      }

      const qty = Number(r.qty) || 0;
      const subtotal = Number(r.subtotal) || 0;
      const harga = Number(r.harga) || (qty > 0 ? subtotal / qty : 0);

      if (!productMap[key]) {
        productMap[key] = {
          id_bahan: idBahan,
          model,
          ukuran,
          nama_barang: displayName,
          qty_penjualan: 0,
          qty_retur: 0,
          total_qty: 0,
          harga_satuan: harga,
          total_penjualan: 0,
        };
      }

      productMap[key].qty_penjualan += qty;
      productMap[key].total_penjualan += subtotal;
      productMap[key].total_qty += qty;
    });

    // Merge retur into products
    returRows.forEach((r) => {
      const idBahan = (r.id_bahan || '').trim();
      const model = (r.model || '').trim();
      const ukuran = (r.ukuran || '').trim();
      const key = `${idBahan}___${model}___${ukuran}`;

      let displayName = '';
      if (model && ukuran) {
        displayName = `${model} (${ukuran})`;
      } else if (model) {
        displayName = model;
      } else if (idBahan && ukuran) {
        displayName = `${idBahan} (${ukuran})`;
      } else {
        displayName = idBahan || 'Item';
      }

      const qty = Number(r.qty) || 0;

      if (!productMap[key]) {
        productMap[key] = {
          id_bahan: idBahan,
          model,
          ukuran,
          nama_barang: displayName,
          qty_penjualan: 0,
          qty_retur: 0,
          total_qty: 0,
          harga_satuan: Number(r.harga) || 0,
          total_penjualan: 0,
        };
      }

      productMap[key].qty_retur += qty;
      productMap[key].total_qty -= qty;
    });

    const productsList = Object.values(productMap);
    let totalQtyPenjualan = 0;
    productsList.forEach((p) => {
      totalQtyPenjualan += p.qty_penjualan;
    });

    const totalBersih = Math.max(0, totalPenjualanKotor - totalRetur);
    const totalQtyBersih = Math.max(0, totalQtyPenjualan - totalQtyRetur);

    return NextResponse.json({
      success: true,
      data: {
        tgl_transaksi: cleanDate,
        id_cabang: displayCabang,
        next_no_penutupan: nextNoPenutupan,
        total_transaksi: distinctTx.size,
        total_penjualan: totalPenjualanKotor,
        total_diskon: totalDiskon,
        total_retur: totalRetur,
        total_bersih: totalBersih,
        total_qty_penjualan: totalQtyPenjualan,
        total_qty_retur: totalQtyRetur,
        total_qty_bersih: totalQtyBersih,
        nominal_cash: nominalCash,
        nominal_hutang: nominalHutang,
        nominal_transfer: nominalTransfer,
        akun_breakdown: akunBreakdown,
        products: productsList,
      },
    });
  } catch (error: any) {
    console.error('Error fetching closing preview:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil pratinjau closing.' },
      { status: 500 }
    );
  }
}
