import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const id_transaksi = decodeURIComponent(id);

    if (!id_transaksi) {
      return NextResponse.json(
        { success: false, message: 'ID Transaksi wajib diisi.' },
        { status: 400 }
      );
    }

    // Query main header and items
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        bk.*,
        c.nama_customer,
        c.alamat_lengkap,
        c.kota,
        c.diskon_lusin,
        ak.bank AS nama_akun
       FROM tb_barang_keluar bk
       LEFT JOIN tb_customer c ON bk.id_customer = c.id_customer
       LEFT JOIN tb_akun ak ON bk.akun = ak.tipe
       WHERE bk.id_transaksi = ? AND (bk.sts_void IS NULL OR bk.sts_void != 1)
       ORDER BY bk.no_id ASC`,
      [id_transaksi]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi tidak ditemukan.' },
        { status: 404 }
      );
    }

    const header = {
      id_transaksi: rows[0].id_transaksi,
      tgl_transaksi: rows[0].tgl_transaksi,
      tgl_jatuh_tempo: rows[0].tgl_jatuh_tempo,
      jatuh_tempo: rows[0].jatuh_tempo,
      id_customer: rows[0].id_customer,
      nama_customer: rows[0].nama_customer || rows[0].id_customer || 'CASH',
      alamat_lengkap: rows[0].alamat_lengkap || '',
      kota: rows[0].kota || '',
      keterangan: rows[0].keterangan || '',
      sales: rows[0].sales || '',
      akun: rows[0].akun || 'CASH',
      nama_akun: rows[0].nama_akun || rows[0].akun || 'CASH',
      disc_invoice: Number(rows[0].disc_invoice) || 0,
      disc: Number(rows[0].disc) || 0,
      diskon_lusin: Number(rows[0].diskon_lusin) || 0,
      status_keluar: rows[0].status_keluar || '',
      status: rows[0].status || '',
      cash: Number(rows[0].cash) || 0,
      sisa_bayar: Number(rows[0].sisa_bayar) || 0,
      dibuat_oleh: rows[0].dibuat_oleh || 'admin',
      by_user_pajak: rows[0].by_user_pajak || 1,
    };

    const items = rows.map((r) => ({
      no_id: r.no_id,
      id_bahan: r.id_bahan,
      model: r.model,
      ukuran: r.ukuran,
      qty: r.qty,
      uom: r.uom,
      harga: r.harga,
      subtotal: r.subtotal,
    }));

    return NextResponse.json({
      success: true,
      data: {
        header,
        items,
      },
    });
  } catch (error: any) {
    console.error('Error fetching detail barang keluar:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil detail transaksi.' },
      { status: 500 }
    );
  }
}
