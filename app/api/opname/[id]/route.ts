import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/opname/[id] (Get detail for single transaction)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id_inv_in = resolvedParams.id;

    if (!id_inv_in) {
      return NextResponse.json(
        { success: false, message: 'ID Stock Opname tidak valid.' },
        { status: 400 }
      );
    }

    const [lines] = await pool.query<RowDataPacket[]>(
      `SELECT 
        i.inv_in_id,
        i.id_inv_in,
        i.inv_date,
        i.status,
        i.id_product,
        i.model,
        i.ukuran,
        i.uom,
        i.stock_awal,
        i.stock_change,
        i.stock_opname,
        i.keterangan,
        i.create_by,
        i.create_date,
        i.id_cabang,
        b.id_bahan
       FROM inv_adjust_in i
       LEFT JOIN tb_bahan b ON b.nama_bahan = i.id_product
       WHERE i.id_inv_in = ?
       ORDER BY i.inv_in_id ASC`,
      [id_inv_in]
    );

    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi Stock Opname tidak ditemukan.' },
        { status: 404 }
      );
    }

    const header = lines[0];

    return NextResponse.json({
      success: true,
      data: {
        id_inv_in: header.id_inv_in,
        inv_date: header.inv_date ? new Date(header.inv_date).toISOString().split('T')[0] : '',
        status: header.status, // 'd' or 's'
        keterangan: header.keterangan || '',
        id_cabang: header.id_cabang || '',
        items: lines.map((l) => ({
          inv_in_id: l.inv_in_id,
          id_product: l.id_product,
          id_bahan: l.id_bahan || '',
          model: l.model || '',
          ukuran: l.ukuran || '',
          uom: l.uom || 'PCS',
          stock_awal: Number(l.stock_awal) || 0,
          stock_change: Number(l.stock_change) || 0,
          stock_opname: Number(l.stock_opname) || 0,
        })),
      },
    });
  } catch (error: any) {
    console.error('Fetch opname detail error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil detail Stock Opname.' },
      { status: 500 }
    );
  }
}

// DELETE /api/opname/[id] (Delete transaction with rollback if authorized)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const connection = await pool.getConnection();
  try {
    const resolvedParams = await params;
    const id_inv_in = resolvedParams.id;

    if (!id_inv_in) {
      return NextResponse.json(
        { success: false, message: 'ID Stock Opname wajib diisi.' },
        { status: 400 }
      );
    }

    const [existingLines] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM inv_adjust_in WHERE id_inv_in = ?`,
      [id_inv_in]
    );

    if (existingLines.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi Stock Opname tidak ditemukan.' },
        { status: 404 }
      );
    }

    await connection.beginTransaction();

    const firstRow = existingLines[0];

    // IF AUTHORIZED ('s'): Rollback stock in tb_stock & tb_bahan
    if (firstRow.status === 's') {
      for (const line of existingLines) {
        const delta = Number(line.stock_opname) || 0;
        const productName = line.id_product;
        const modelStr = line.model || '';
        const ukuranStr = line.ukuran || '';
        const uomStr = line.uom || 'PCS';

        // Revert tb_stock (subtract delta back)
        await connection.query(
          `UPDATE tb_stock 
           SET stock = stock - ? 
           WHERE (id_bahan = ? OR id_bahan IN (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?)) 
             AND model = ? AND ukuran = ? AND uom = ?`,
          [delta, productName, productName, modelStr, ukuranStr, uomStr]
        );

        // Revert tb_bahan
        const qtyDozens = Math.round((delta / 12) * 100) / 100;
        await connection.query(
          `UPDATE tb_bahan 
           SET total_qty = total_qty - ?, total_pcs = total_pcs - ? 
           WHERE nama_bahan = ? OR id_bahan = ?`,
          [qtyDozens, delta, productName, productName]
        );
      }
    }

    // Delete records from inv_adjust_in
    await connection.query(`DELETE FROM inv_adjust_in WHERE id_inv_in = ?`, [id_inv_in]);

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: 'Berhasil menghapus transaksi Stock Opname.',
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Delete opname error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus transaksi Stock Opname.' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
