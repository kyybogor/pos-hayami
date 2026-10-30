import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface PaymentItem {
  id_transaksi: string;
  nominal: number;
}

export async function POST(req: NextRequest) {
  const connection = await pool.getConnection();
  try {
    const body = await req.json();
    const { payments, tgl_bayar, metode, keterangan } = body as {
      payments: PaymentItem[];
      tgl_bayar?: string;
      metode?: string;
      keterangan?: string;
    };

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada transaksi yang dipilih untuk dibayar.' },
        { status: 400 }
      );
    }

    const payDate = tgl_bayar || new Date().toISOString().split('T')[0];
    const payMethod = (metode || 'CASH').trim();
    const userHeader = req.headers.get('x-user-id') || 'admin';
    const branchHeader = req.headers.get('x-user-grup') || 'TKA-JATINEGARA-JAKARTA';

    await connection.beginTransaction();

    const results = [];

    for (const p of payments) {
      const nominal = Number(p.nominal) || 0;
      if (nominal <= 0) continue;

      // Fetch transaction total subtotal, discounts, and sisa_bayar
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id_transaksi, id_customer, disc, disc_invoice, sisa_bayar, SUM(subtotal) as total_sub
         FROM tb_barang_keluar
         WHERE id_transaksi = ? AND status_keluar <> 'd'
         GROUP BY id_transaksi, id_customer, disc, disc_invoice, sisa_bayar`,
        [p.id_transaksi]
      );

      if (rows.length === 0) continue;

      const row = rows[0];
      const discTotal = (Number(row.disc) || 0) + (Number(row.disc_invoice) || 0);
      const grandTotal = (Number(row.total_sub) || 0) - discTotal;
      const currentSisaBayar = Number(row.sisa_bayar) || 0;
      const newSisaBayar = currentSisaBayar + nominal;

      // Determine new status based on sisa_bayar vs total
      let newStatus = 'Belum Lunas';
      if (Math.round(newSisaBayar) >= Math.round(grandTotal)) {
        newStatus = 'Lunas';
      } else if (newSisaBayar > 0) {
        newStatus = 'Partially Paid';
      }

      // 1. Update tb_barang_keluar
      await connection.query(
        `UPDATE tb_barang_keluar 
         SET sisa_bayar = ?, status = ?, sts = 0 
         WHERE id_transaksi = ?`,
        [newSisaBayar, newStatus, p.id_transaksi]
      );

      // 2. Insert into tb_pembayaran
      const payKet = keterangan
        ? `Pembayaran Piutang ${p.id_transaksi} (${keterangan})`
        : `Pembayaran Piutang ${p.id_transaksi}`;

      await connection.query(
        `INSERT INTO tb_pembayaran (
          no_id, id_pembayaran, tgl_bayar, metode, nominal, keterangan, dibuat_oleh, dibuat_tgl, id_cabang
        ) VALUES ('', ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [p.id_transaksi, payDate, payMethod, nominal, payKet, userHeader, branchHeader]
      );

      // 3. If CASH, insert into tb_petty_cash (following legacy pos_tabang pattern)
      if (payMethod.toUpperCase() === 'CASH') {
        const yy = String(new Date().getFullYear()).slice(-2);
        const [pettyMax] = await connection.query<RowDataPacket[]>(
          `SELECT max(id_petty) as kodeTerbesar FROM tb_petty_cash WHERE id_petty LIKE ?`,
          [`PTY-${yy}-%`]
        );

        let kodepetty = `PTY-${yy}-000001`;
        if (pettyMax.length > 0 && pettyMax[0].kodeTerbesar) {
          const kb = pettyMax[0].kodeTerbesar;
          const urutan = parseInt(kb.substring(7), 10) + 1;
          kodepetty = `PTY-${yy}-${String(urutan).padStart(6, '0')}`;
        }

        const pettyDesc = `Pembayaran ${p.id_transaksi} Customer ${row.id_customer} ${keterangan || ''}`.trim();
        await connection.query(
          `INSERT INTO tb_petty_cash (id_petty, tgl, keterangan, in_cash, dibuat_oleh, dibuat_tgl, id_cabang)
           VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
          [kodepetty, payDate, pettyDesc, nominal, userHeader, branchHeader]
        );
      }

      results.push({
        id_transaksi: p.id_transaksi,
        nominal,
        status: newStatus,
        outstanding_remaining: Math.max(0, grandTotal - newSisaBayar),
      });
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: `Berhasil memproses pembayaran ${results.length} transaksi piutang.`,
      data: results,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error processing piutang payment:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses pembayaran piutang.' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
