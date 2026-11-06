import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// GET /api/opname/products
// Supports:
// 1. Barcode lookup: ?barcode=463353606 or ?code=...
// 2. Tipe / Material list: default or ?search=...
// 3. Models list for selected id_bahan: ?id_bahan=...
// 4. Ukuran / Variants for selected id_bahan & model: ?id_bahan=...&model=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get('barcode') || searchParams.get('code') || '';
    const id_bahan = searchParams.get('id_bahan') || searchParams.get('nama_bahan') || '';
    const model = searchParams.get('model') || '';
    const search = searchParams.get('search') || searchParams.get('q') || '';

    // 1. BARCODE SCAN LOOKUP
    // Rule: Barcode scanner emits e.g. 463353606 -> extract before last 2 digits: 4633536
    // Also supports exact 7-digit barcode matching (e.g. 4633536)
    if (barcode.trim()) {
      const rawCode = barcode.trim();
      const cleanDigits = rawCode.replace(/\D/g, '');
      const cleanCode = cleanDigits || rawCode;

      // Candidate 1: Before last 2 digits (e.g. 463353606 -> 4633536)
      const candidateBefore2 = cleanCode.length > 2 ? cleanCode.slice(0, -2) : cleanCode;
      // Candidate 2: Full clean code (e.g. 4633536)
      const candidateFull = cleanCode;

      // Query prioritizing the candidate before last 2 digits, then exact full code
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, barcode, id_bahan, model, ukuran, uom, stock 
         FROM tb_stock 
         WHERE barcode IN (?, ?) OR id IN (?, ?)
         ORDER BY 
           (barcode = ?) DESC,
           (barcode = ?) DESC,
           (stock > 0) DESC, 
           id ASC 
         LIMIT 1`,
        [candidateBefore2, candidateFull, candidateBefore2, candidateFull, candidateBefore2, candidateFull]
      );

      if (rows.length === 0) {
        return NextResponse.json({
          success: false,
          message: `Barang dengan barcode "${candidateBefore2}" (${candidateFull}) tidak ditemukan di tb_stock.`,
        });
      }

      const item = rows[0];
      return NextResponse.json({
        success: true,
        item: {
          id: item.id,
          barcode: item.barcode,
          id_bahan: item.id_bahan,
          nama_bahan: item.id_bahan,
          model: item.model || 'Diskon',
          ukuran: item.ukuran || '#',
          uom: item.uom || 'PCS',
          stock: Number(item.stock) || 0,
        },
      });
    }

    // 2. FETCH MODELS & VARIANTS FOR A GIVEN id_bahan (Tipe)
    if (id_bahan.trim()) {
      const bahan = id_bahan.trim();

      // If both id_bahan and model are provided, fetch variants & ukurans
      if (model.trim()) {
        const m = model.trim();
        const [stockRows] = await pool.query<RowDataPacket[]>(
          `SELECT id, barcode, id_bahan, model, ukuran, uom, stock 
           FROM tb_stock 
           WHERE id_bahan = ? AND model = ?
           ORDER BY ukuran ASC`,
          [bahan, m]
        );

        const ukurans = Array.from(new Set(stockRows.map((r) => r.ukuran || ''))).filter(Boolean);
        const uoms = Array.from(new Set(stockRows.map((r) => r.uom || 'PCS'))).filter(Boolean);

        return NextResponse.json({
          success: true,
          stockVariants: stockRows,
          models: [m],
          ukurans: ukurans.length > 0 ? ukurans : ['#'],
          uoms: uoms.length > 0 ? uoms : ['PCS'],
        });
      }

      // If only id_bahan provided: fetch distinct models and all variants for that id_bahan
      const [[modelRows], [stockRows]] = await Promise.all([
        pool.query<RowDataPacket[]>(
          `SELECT DISTINCT model 
           FROM tb_stock 
           WHERE id_bahan = ? AND model IS NOT NULL AND model != '' 
           ORDER BY model ASC`,
          [bahan]
        ),
        pool.query<RowDataPacket[]>(
          `SELECT id, barcode, id_bahan, model, ukuran, uom, stock 
           FROM tb_stock 
           WHERE id_bahan = ?
           ORDER BY model ASC, ukuran ASC`,
          [bahan]
        ),
      ]);

      const models = modelRows.map((r) => r.model).filter(Boolean);
      const ukurans = Array.from(new Set(stockRows.map((r) => r.ukuran || ''))).filter(Boolean);
      const uoms = Array.from(new Set(stockRows.map((r) => r.uom || 'PCS'))).filter(Boolean);

      return NextResponse.json({
        success: true,
        stockVariants: stockRows,
        models: models.length > 0 ? models : ['Diskon'],
        ukurans: ukurans.length > 0 ? ukurans : ['#'],
        uoms: uoms.length > 0 ? uoms : ['PCS'],
      });
    }

    // 3. FETCH DISTINCT id_bahan (Tipe / Nama Barang) FROM tb_stock
    let query = `
      SELECT DISTINCT id_bahan 
      FROM tb_stock 
      WHERE id_bahan IS NOT NULL AND id_bahan != ''
    `;
    const params: any[] = [];

    if (search.trim()) {
      query += ` AND id_bahan LIKE ?`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY id_bahan ASC`;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    const tipes = rows.map((r) => r.id_bahan);

    return NextResponse.json({
      success: true,
      tipes,
      data: tipes.map((t) => ({
        id_bahan: t,
        nama_bahan: t,
        label: t,
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
