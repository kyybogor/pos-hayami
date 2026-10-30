import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/retur-barang/[id] (Fetch detail transaction)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id_transaksi = decodeURIComponent(resolvedParams.id);

    if (!id_transaksi) {
      return NextResponse.json(
        { success: false, message: 'ID Retur Barang tidak valid.' },
        { status: 400 }
      );
    }

    const [lines] = await pool.query<RowDataPacket[]>(
      `SELECT 
        r.no_id,
        r.id_transaksi,
        r.invret,
        r.tgl_transaksi,
        r.id_customer,
        c.nama_customer,
        r.id_bahan,
        r.model,
        r.ukuran,
        r.qty,
        r.uom,
        r.harga,
        r.subtotal,
        r.total,
        r.keterangan,
        r.status_keluar,
        r.sales,
        r.akun,
        r.id_cabang
       FROM tb_retur r
       LEFT JOIN tb_customer c ON r.id_customer = c.id_customer
       WHERE r.id_transaksi = ?
       ORDER BY r.no_id ASC`,
      [id_transaksi]
    );

    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi Retur Barang tidak ditemukan.' },
        { status: 404 }
      );
    }

    const header = lines[0];

    return NextResponse.json({
      success: true,
      data: {
        id_transaksi: header.id_transaksi,
        tgl_transaksi: header.tgl_transaksi ? new Date(header.tgl_transaksi).toISOString().split('T')[0] : '',
        id_customer: header.id_customer || 'CASH',
        nama_customer: header.nama_customer || header.id_customer || 'CASH',
        status_keluar: header.status_keluar, // 'd' or 's'
        keterangan: header.keterangan || '',
        sales: header.sales || '',
        akun: header.akun || 'CASH',
        id_cabang: header.id_cabang || '',
        items: lines.map((l) => ({
          no_id: l.no_id,
          invret: l.invret || '',
          id_bahan: l.id_bahan,
          model: l.model || '',
          ukuran: l.ukuran || '',
          qty: Number(l.qty) || 0,
          uom: l.uom || 'PCS',
          harga: Number(l.harga) || 0,
          subtotal: Number(l.subtotal) || 0,
        })),
      },
    });
  } catch (error: any) {
    console.error('Fetch retur detail error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil detail retur barang.' },
      { status: 500 }
    );
  }
}

// DELETE /api/retur-barang/[id] (Delete transaction with rollback if authorized)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const connection = await pool.getConnection();
  try {
    const resolvedParams = await params;
    const id_transaksi = decodeURIComponent(resolvedParams.id);

    if (!id_transaksi) {
      return NextResponse.json(
        { success: false, message: 'ID Retur Barang wajib diisi.' },
        { status: 400 }
      );
    }

    const [existingLines] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM tb_retur WHERE id_transaksi = ?`,
      [id_transaksi]
    );

    if (existingLines.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi Retur Barang tidak ditemukan.' },
        { status: 404 }
      );
    }

    await connection.beginTransaction();

    const firstRow = existingLines[0];
    const custId = firstRow.id_customer || 'CASH';

    // IF AUTHORIZED ('s'): Rollback stock in tb_stock
    if (firstRow.status_keluar === 's') {
      for (const line of existingLines) {
        const qtyToAdjust = Number(line.qty) || 0;
        const idBahan = line.id_bahan;
        const modelStr = line.model || 'Diskon';
        const ukuranStr = line.ukuran || '';
        const branch = line.id_cabang || 'TKA-JATINEGARA-JAKARTA';

        if (custId !== 'Hayami') {
          // Revert: subtract stock_retur back
          await connection.query(
            `UPDATE tb_stock 
             SET stock_retur = stock_retur - ? 
             WHERE (id_bahan = ? OR id_bahan IN (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?)) 
               AND model = ? AND ukuran = ? AND id_cabang = ?`,
            [qtyToAdjust, idBahan, idBahan, modelStr, ukuranStr, branch]
          );
        } else {
          // Revert: add stock_retur back
          await connection.query(
            `UPDATE tb_stock 
             SET stock_retur = stock_retur + ? 
             WHERE (id_bahan = ? OR id_bahan IN (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?)) 
               AND model = ? AND ukuran = ? AND id_cabang = ?`,
            [qtyToAdjust, idBahan, idBahan, modelStr, ukuranStr, branch]
          );
        }
      }
    }

    // Delete records from tb_retur
    await connection.query(`DELETE FROM tb_retur WHERE id_transaksi = ?`, [id_transaksi]);

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: 'Berhasil menghapus transaksi retur barang.',
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Delete retur error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus transaksi retur barang.' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
