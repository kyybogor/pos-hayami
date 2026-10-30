import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/opname/products?search=...
// or GET /api/opname/products?nama_bahan=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const nama_bahan = searchParams.get('nama_bahan') || '';

    if (nama_bahan) {
      // Fetch available variants/stock for a specific material name
      const [stockRows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT id_bahan, model, ukuran, uom, stock 
         FROM tb_stock 
         WHERE id_bahan = ? OR id_bahan IN (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?)`,
        [nama_bahan, nama_bahan]
      );

      // Fetch distinct models, sizes, uoms for dropdowns
      const models = Array.from(new Set(stockRows.map((r) => r.model || 'Diskon'))).filter(Boolean);
      const ukurans = Array.from(new Set(stockRows.map((r) => r.ukuran || ''))).filter(Boolean);
      const uoms = Array.from(new Set(stockRows.map((r) => r.uom || 'PCS'))).filter(Boolean);

      return NextResponse.json({
        success: true,
        stockVariants: stockRows,
        models,
        ukurans,
        uoms,
      });
    }

    // Search materials list for auto-complete/select dropdown
    let query = `SELECT id_bahan, nama_bahan, ukuran, uom FROM tb_bahan`;
    const params: any[] = [];

    if (search.trim()) {
      query += ` WHERE nama_bahan LIKE ? OR id_bahan LIKE ?`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ` ORDER BY nama_bahan ASC LIMIT 50`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id_bahan: r.id_bahan,
        nama_bahan: r.nama_bahan,
        label: `${r.id_bahan} | ${r.nama_bahan}`,
        ukuran: r.ukuran || '',
        uom: r.uom || 'PCS',
      })),
    });
  } catch (error: any) {
    console.error('Fetch opname products error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data produk opname.' },
      { status: 500 }
    );
  }
}
