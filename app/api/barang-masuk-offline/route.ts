import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import poolLocal from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

function formatDateOnly(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const match = val.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const { searchParams } = new URL(req.url);
    const tgl_from = searchParams.get('tgl_from');
    const tgl_to = searchParams.get('tgl_to');
    const inv = searchParams.get('inv');
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    let branchIdStr = effectiveBranch;
    let branchNameStr = effectiveBranch;
    if (effectiveBranch) {
      try {
        const [cabangRows] = await poolLocal.query<RowDataPacket[]>(
          'SELECT id_cabang, nama_cabang FROM tb_cabang WHERE id_cabang = ? OR nama_cabang = ? LIMIT 1',
          [effectiveBranch, effectiveBranch]
        );
        if (cabangRows.length > 0) {
          branchIdStr = String(cabangRows[0].id_cabang);
          branchNameStr = String(cabangRows[0].nama_cabang);
        }
      } catch (cErr) {
        console.warn('Resolve branch error:', cErr);
      }
    }

    let whereClause = "WHERE a.status != '' AND a.id_transaksi LIKE '%PO%'";
    const params: any[] = [];

    if (effectiveBranch) {
      whereClause += " AND (a.id_cabang = ? OR a.id_cabang = ?)";
      params.push(branchIdStr, branchNameStr);
    }

    if (tgl_from && tgl_to) {
      whereClause += " AND a.tgl_transaksi BETWEEN ? AND ?";
      params.push(tgl_from, tgl_to);
    }

    if (inv) {
      whereClause += " AND (a.id_transaksi LIKE ? OR a.keterangan LIKE ?)";
      params.push(`%${inv}%`, `%${inv}%`);
    }

    // Query distinct transaction headers
    const headersQuery = `
      SELECT 
        a.id_transaksi, 
        a.tgl_transaksi, 
        a.id_supplier, 
        a.status, 
        a.keterangan, 
        a.status_lunas, 
        a.jenis, 
        a.id_cabang,
        c.nama_customer as nama_supplier
      FROM tb_barang_masuk a
      LEFT JOIN tb_customer c ON a.id_supplier = c.id_customer
      ${whereClause}
      GROUP BY a.id_transaksi
      ORDER BY a.tgl_transaksi DESC, a.id_transaksi DESC
      LIMIT 100
    `;

    const [headerRows] = await poolLocal.query<RowDataPacket[]>(headersQuery, params);

    // Fetch items for each transaction
    const transactions = await Promise.all(
      headerRows.map(async (h) => {
        const [itemRows] = await poolLocal.query<RowDataPacket[]>(
          `SELECT no_id, id_product, model, ukuran, qty, uom, harga, subtotal, image 
           FROM tb_barang_masuk 
           WHERE id_transaksi = ?
           ORDER BY no_id ASC`,
          [h.id_transaksi]
        );

        return {
          id_transaksi: h.id_transaksi,
          tgl_transaksi: formatDateOnly(h.tgl_transaksi),
          id_supplier: h.id_supplier,
          nama_supplier: h.nama_supplier || h.id_supplier || 'Supplier',
          status: h.status, // 'd' = Draft, 's' = Close
          keterangan: h.keterangan || '',
          status_lunas: h.status_lunas,
          jenis: h.jenis,
          items: itemRows.map((it) => ({
            no_id: it.no_id,
            id_product: it.id_product,
            model: it.model,
            ukuran: it.ukuran,
            qty: Number(it.qty) || 0,
            uom: it.uom || 'PCS',
            harga: Number(it.harga) || 0,
            subtotal: Number(it.subtotal) || 0,
            image: it.image || '',
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    console.error('Fetch barang masuk offline error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data barang masuk offline.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id_transaksi = searchParams.get('id_transaksi');

    if (!id_transaksi) {
      return NextResponse.json(
        { success: false, message: 'ID Transaksi wajib diisi.' },
        { status: 400 }
      );
    }

    // Check if transaction exists and its status
    const [existing] = await poolLocal.query<RowDataPacket[]>(
      'SELECT * FROM tb_barang_masuk WHERE id_transaksi = ?',
      [id_transaksi]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi barang masuk tidak ditemukan.' },
        { status: 404 }
      );
    }

    const firstRow = existing[0];

    // If transaction was authorized ('s'), revert stock from tb_stock & tb_bahan
    if (firstRow.status === 's') {
      for (const row of existing) {
        const qtyToReduce = Number(row.qty) || 0;
        const productId = row.id_product;
        const modelStr = row.model || '';
        const ukuranStr = row.ukuran || '';
        const branchId = row.id_cabang || 'TKA-JATINEGARA-JAKARTA';

        // Revert tb_stock
        await poolLocal.query(
          `UPDATE tb_stock 
           SET stock = stock - ? 
           WHERE id_bahan = ? AND model = ? AND ukuran = ? AND id_cabang = ?`,
          [qtyToReduce, productId, modelStr, ukuranStr, branchId]
        );

        // Revert tb_bahan
        await poolLocal.query(
          `UPDATE tb_bahan 
           SET total_qty = total_qty - ?, total_pcs = total_pcs - ? 
           WHERE nama_bahan = ? OR id_bahan = ?`,
          [qtyToReduce, qtyToReduce, productId, productId]
        );
      }
    }

    // Delete transaction rows from tb_barang_masuk
    await poolLocal.query(
      'DELETE FROM tb_barang_masuk WHERE id_transaksi = ?',
      [id_transaksi]
    );

    return NextResponse.json({
      success: true,
      message: 'Berhasil menghapus transaksi barang masuk.',
    });
  } catch (error: any) {
    console.error('Delete barang masuk offline error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus transaksi barang masuk.' },
      { status: 500 }
    );
  }
}
