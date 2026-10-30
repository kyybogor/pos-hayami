import { NextResponse } from 'next/server';
import poolLocal from '@/lib/db';
import { RowDataPacket } from 'mysql2';

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
    const { searchParams } = new URL(req.url);
    const id_transaksi = searchParams.get('id_transaksi');

    // 1. Fetch available Suppliers from tb_customer
    const [suppliers] = await poolLocal.query<RowDataPacket[]>(
      'SELECT id_customer, nama_customer, kota, alamat_lengkap FROM tb_customer ORDER BY nama_customer ASC'
    );

    // 2. Fetch available Products from tb_bahan
    const [products] = await poolLocal.query<RowDataPacket[]>(
      'SELECT DISTINCT id_bahan, nama_bahan, ukuran, uom, harga FROM tb_bahan ORDER BY nama_bahan ASC'
    );

    // 3. Fetch models and sizes for selection
    const [models] = await poolLocal.query<RowDataPacket[]>(
      'SELECT DISTINCT model FROM tb_stock WHERE model IS NOT NULL AND model != "" ORDER BY model ASC'
    );

    const [sizes] = await poolLocal.query<RowDataPacket[]>(
      'SELECT DISTINCT ukuran FROM tb_stock WHERE ukuran IS NOT NULL AND ukuran != "" ORDER BY ukuran ASC'
    );

    // If new transaction requested
    if (!id_transaksi || id_transaksi === 'new') {
      return NextResponse.json({
        success: true,
        data: {
          header: {
            id_transaksi: 'NEW',
            tgl_transaksi: new Date().toISOString().split('T')[0],
            id_supplier: suppliers.length > 0 ? suppliers[0].id_customer : '',
            keterangan: '',
            jenis: '0',
            status: 'd',
            status_lunas: 0,
          },
          items: [],
          options: {
            suppliers: suppliers.map((s) => ({
              id: s.id_customer,
              name: s.nama_customer,
              display: `${s.id_customer} | ${s.nama_customer}`,
            })),
            products: products.map((p) => ({
              id: p.id_bahan,
              name: p.nama_bahan || p.id_bahan,
              display: `${p.id_bahan} | ${p.nama_bahan || p.id_bahan}`,
              harga: Number(p.harga) || 0,
              uom: p.uom || 'PCS',
            })),
            models: models.map((m) => m.model),
            sizes: sizes.map((s) => s.ukuran),
          },
        },
      });
    }

    // Existing transaction lookup
    const [rows] = await poolLocal.query<RowDataPacket[]>(
      'SELECT * FROM tb_barang_masuk WHERE id_transaksi = ? ORDER BY no_id ASC',
      [id_transaksi]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Transaksi barang masuk tidak ditemukan.' },
        { status: 404 }
      );
    }

    const first = rows[0];

    // Get supplier name
    let supplierName = first.id_supplier;
    const matchedCust = suppliers.find((s) => s.id_customer === first.id_supplier);
    if (matchedCust) {
      supplierName = matchedCust.nama_customer;
    }

    const items = rows.map((r) => ({
      no_id: r.no_id,
      id_product: r.id_product,
      model: r.model || '',
      ukuran: r.ukuran || '',
      qty: Number(r.qty) || 0,
      uom: r.uom || 'PCS',
      harga: Number(r.harga) || 0,
      subtotal: Number(r.subtotal) || Number(r.total) || (Number(r.harga) * Number(r.qty)),
      image: r.image || '',
    }));

    return NextResponse.json({
      success: true,
      data: {
        header: {
          id_transaksi: first.id_transaksi,
          tgl_transaksi: formatDateOnly(first.tgl_transaksi),
          id_supplier: first.id_supplier,
          nama_supplier: supplierName,
          display_supplier: `${first.id_supplier} | ${supplierName}`,
          keterangan: first.keterangan || '',
          jenis: first.jenis || '0',
          status: first.status, // 'd' or 's'
          status_lunas: first.status_lunas,
        },
        items,
        options: {
          suppliers: suppliers.map((s) => ({
            id: s.id_customer,
            name: s.nama_customer,
            display: `${s.id_customer} | ${s.nama_customer}`,
          })),
          products: products.map((p) => ({
            id: p.id_bahan,
            name: p.nama_bahan || p.id_bahan,
            display: `${p.id_bahan} | ${p.nama_bahan || p.id_bahan}`,
            harga: Number(p.harga) || 0,
            uom: p.uom || 'PCS',
          })),
          models: models.map((m) => m.model),
          sizes: sizes.map((s) => s.ukuran),
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch barang masuk offline detail error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil detail transaksi.' },
      { status: 500 }
    );
  }
}
