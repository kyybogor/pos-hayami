import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/retur-barang/invoice-items?invoice=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoice = searchParams.get('invoice') || '';

    if (!invoice.trim()) {
      return NextResponse.json({ success: true, items: [] });
    }

    const invoiceStr = invoice.trim();
    let itemRows: RowDataPacket[] = [];
    let customerId = '';
    let customerName = '';

    // Check if invoice exists in tb_barang_keluar
    const [keluarRows] = await pool.query<RowDataPacket[]>(
      `SELECT k.*, c.nama_customer 
       FROM tb_barang_keluar k 
       LEFT JOIN tb_customer c ON k.id_customer = c.id_customer
       WHERE k.id_transaksi = ? OR k.id_transaksi LIKE ?`,
      [invoiceStr, `%${invoiceStr}%`]
    );

    if (keluarRows.length > 0) {
      itemRows = keluarRows;
      customerId = keluarRows[0].id_customer || '';
      customerName = keluarRows[0].nama_customer || customerId;
    } else {
      // Check in tb_barang_masuk if not found in tb_barang_keluar
      const [masukRows] = await pool.query<RowDataPacket[]>(
        `SELECT m.*, m.id_product as id_bahan, c.nama_customer 
         FROM tb_barang_masuk m 
         LEFT JOIN tb_customer c ON m.id_supplier = c.id_customer
         WHERE m.id_transaksi = ? OR m.id_transaksi LIKE ?`,
        [invoiceStr, `%${invoiceStr}%`]
      );

      if (masukRows.length > 0) {
        itemRows = masukRows;
        customerId = masukRows[0].id_supplier || '';
        customerName = masukRows[0].nama_customer || customerId;
      }
    }

    if (itemRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Faktur / No Invoice tidak ditemukan.',
        items: [],
      });
    }

    // Process and calculate remaining returnable Qty for each item
    const items = await Promise.all(
      itemRows.map(async (row) => {
        const idBahan = row.id_bahan || row.id_product;
        const modelStr = row.model || 'Diskon';
        const ukuranStr = row.ukuran || '';
        const originalQty = Number(row.qty) || 0;

        // Fetch already returned Qty for this item in tb_retur
        const [returnedRows] = await pool.query<RowDataPacket[]>(
          `SELECT SUM(qty) as total_returned 
           FROM tb_retur 
           WHERE invret = ? AND id_bahan = ? AND model = ? AND ukuran = ?`,
          [row.id_transaksi, idBahan, modelStr, ukuranStr]
        );

        const alreadyReturned = Number(returnedRows[0]?.total_returned) || 0;
        const maxReturnQty = Math.max(0, originalQty - alreadyReturned);

        // Fetch product image and details from tb_stock / tb_bahan
        const [stockInfoRows] = await pool.query<RowDataPacket[]>(
          `SELECT image, harga FROM tb_stock 
           WHERE id_bahan = ? AND model = ? AND ukuran = ? 
           LIMIT 1`,
          [idBahan, modelStr, ukuranStr]
        );

        const [bahanInfoRows] = await pool.query<RowDataPacket[]>(
          `SELECT harga, uom, nama_bahan FROM tb_bahan 
           WHERE nama_bahan = ? OR id_bahan = ? 
           LIMIT 1`,
          [idBahan, idBahan]
        );

        const image = stockInfoRows[0]?.image || '';
        const productName = bahanInfoRows[0]?.nama_bahan || idBahan;
        const unitPrice = Number(row.harga) || Number(stockInfoRows[0]?.harga) || Number(bahanInfoRows[0]?.harga) || 0;
        const uomStr = row.uom || bahanInfoRows[0]?.uom || 'PCS';

        return {
          id_transaksi: row.id_transaksi,
          id_bahan: idBahan,
          nama_bahan: productName,
          model: modelStr,
          ukuran: ukuranStr,
          original_qty: originalQty,
          max_return_qty: maxReturnQty,
          already_returned: alreadyReturned,
          uom: uomStr,
          harga: unitPrice,
          image: image,
        };
      })
    );

    return NextResponse.json({
      success: true,
      id_transaksi: itemRows[0].id_transaksi,
      id_customer: customerId,
      nama_customer: customerName,
      items: items.filter((it) => it.max_return_qty > 0),
    });
  } catch (error: any) {
    console.error('Fetch invoice items for retur error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data item faktur.' },
      { status: 500 }
    );
  }
}
