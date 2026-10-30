import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id_transaksi = searchParams.get('id_transaksi');

    if (!id_transaksi) {
      return NextResponse.json(
        { success: false, message: 'ID Transaksi wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Fetch transaction header & summary details
    const [headerRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        a.id_transaksi,
        a.id_customer,
        c.nama_customer,
        a.tgl_transaksi,
        a.tgl_jatuh_tempo,
        a.sisa_bayar,
        a.status as status_db,
        a.disc,
        a.disc_invoice,
        SUM(a.qty / 12) as lsn,
        SUM(a.subtotal) as sbttl
       FROM tb_barang_keluar a
       LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
       WHERE a.id_transaksi = ? AND a.status_keluar <> 'd'
       GROUP BY a.id_transaksi, a.id_customer, c.nama_customer, a.tgl_transaksi, a.tgl_jatuh_tempo, a.sisa_bayar, a.status, a.disc, a.disc_invoice`,
      [id_transaksi]
    );

    if (headerRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi tidak ditemukan.' },
        { status: 404 }
      );
    }

    const row = headerRows[0];
    const discTotal = (Number(row.disc) || 0) + (Number(row.disc_invoice) || 0);
    const totalTagihan = (Number(row.sbttl) || 0) - discTotal;
    const terbayar = Number(row.sisa_bayar) || 0;
    const outstanding = Math.max(0, totalTagihan - terbayar);

    let status = 'Belum Lunas';
    if (terbayar > 0) {
      if (Math.round(terbayar) >= Math.round(totalTagihan)) {
        status = 'Lunas';
      } else {
        status = 'Bayar Sebagian';
      }
    } else if (row.status_db === 'Lunas') {
      status = 'Lunas';
    }

    const header = {
      id_transaksi: row.id_transaksi,
      id_customer: row.id_customer,
      nama_customer: row.nama_customer || row.id_customer,
      tgl_transaksi: row.tgl_transaksi,
      tgl_jatuh_tempo: row.tgl_jatuh_tempo || row.tgl_transaksi,
      total: totalTagihan,
      terbayar,
      outstanding,
      status,
    };

    // 2. Fetch payment logs from tb_pembayaran
    const [historyRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        no_id,
        id_pembayaran,
        tgl_bayar,
        metode,
        nominal,
        keterangan,
        dibuat_oleh,
        dibuat_tgl
       FROM tb_pembayaran
       WHERE id_pembayaran = ?
       ORDER BY tgl_bayar DESC, no_id DESC`,
      [id_transaksi]
    );

    const history = historyRows.map((h) => ({
      no_id: h.no_id,
      id_pembayaran: h.id_pembayaran,
      tgl_bayar: h.tgl_bayar,
      metode: h.metode || 'CASH',
      nominal: Number(h.nominal) || 0,
      keterangan: h.keterangan || '',
      dibuat_oleh: h.dibuat_oleh || 'admin',
      dibuat_tgl: h.dibuat_tgl,
    }));

    return NextResponse.json({
      success: true,
      data: {
        header,
        history,
      },
    });
  } catch (error: any) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil riwayat pembayaran.' },
      { status: 500 }
    );
  }
}
