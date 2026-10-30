import { NextResponse } from 'next/server';
import poolLocal from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id_po = searchParams.get('id_po') || searchParams.get('id_transaksi');
    const sku_id = searchParams.get('sku_id');
    const all = searchParams.get('all');
    const tipe = searchParams.get('tipe');
    const model = searchParams.get('model');
    const ukuran = searchParams.get('ukuran');

    if (!id_po && (!tipe || !model || !ukuran)) {
      return NextResponse.json(
        { success: false, message: 'ID Transaksi atau Tipe/Model/Ukuran wajib diisi.' },
        { status: 400 }
      );
    }

    let rows: RowDataPacket[] = [];

    if (tipe && model && ukuran) {
      // Fetch item from tb_stock by tipe, model, and ukuran
      const [result] = await poolLocal.query<RowDataPacket[]>(
        `SELECT id AS no_id, id_bahan, model, ukuran, stock, COALESCE(barcode, '') AS barcode
         FROM tb_stock
         WHERE id_bahan = ? AND model = ? AND ukuran = ?`,
        [tipe, model, ukuran]
      );
      rows = result;
    } else if (all === '1' || !sku_id) {
      // Fetch all items for the transaction
      const [result] = await poolLocal.query<RowDataPacket[]>(
        `SELECT c.no_id, c.id_product AS id_bahan, c.model, c.ukuran, c.qty AS stock, COALESCE(b.barcode, '') AS barcode
         FROM tb_barang_masuk c
         LEFT JOIN tb_stock b ON c.id_product = b.id_bahan AND c.model = b.model AND c.ukuran = b.ukuran
         WHERE c.id_transaksi = ?
         ORDER BY c.no_id ASC`,
        [id_po]
      );
      rows = result;
    } else {
      // Fetch specific items by sku_id (comma-separated or single)
      const skuList = sku_id
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (skuList.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }

      const placeholders = skuList.map(() => '?').join(',');
      const [result] = await poolLocal.query<RowDataPacket[]>(
        `SELECT c.no_id, c.id_product AS id_bahan, c.model, c.ukuran, c.qty AS stock, COALESCE(b.barcode, '') AS barcode
         FROM tb_barang_masuk c
         LEFT JOIN tb_stock b ON c.id_product = b.id_bahan AND c.model = b.model AND c.ukuran = b.ukuran
         WHERE c.no_id IN (${placeholders})
         ORDER BY c.no_id ASC`,
        skuList
      );
      rows = result;
    }

    // Format output
    const data = rows.map((r) => ({
      no_id: r.no_id,
      id_bahan: r.id_bahan || '',
      model: r.model || '',
      ukuran: r.ukuran || '',
      stock: Number(r.stock) || 0,
      barcode: r.barcode || r.id_bahan || '',
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Fetch barcode print data error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data barcode print.' },
      { status: 500 }
    );
  }
}
