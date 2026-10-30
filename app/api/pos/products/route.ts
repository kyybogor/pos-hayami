import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Ensure tb_location_stock table exists so LEFT JOIN does not fail on new database
async function ensureLocationStockTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tb_location_stock (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_location INT NOT NULL,
        nama_lokasi VARCHAR(255) NOT NULL,
        id_bahan VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        ukuran VARCHAR(50) NOT NULL,
        nama_stock VARCHAR(255) NOT NULL,
        qty INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_location_item (id_location, id_bahan, model, ukuran),
        INDEX idx_location (id_location),
        INDEX idx_nama_stock (nama_stock)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch {
    // Ignore error if table exists
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureLocationStockTable();

    const { searchParams } = new URL(request.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Fetch options for Select2 dropdowns (Tipe & Model)
    if (getOptions) {
      const selectedTipe = searchParams.get('tipe') || '';
      const [[tipeRows], [modelRows]] = await Promise.all([
        pool.query<RowDataPacket[]>(
          'SELECT DISTINCT id_bahan FROM tb_stock WHERE id_bahan IS NOT NULL AND id_bahan != "" ORDER BY id_bahan ASC'
        ),
        selectedTipe
          ? pool.query<RowDataPacket[]>(
              `SELECT DISTINCT model FROM tb_stock 
               WHERE (id_bahan = ? OR id_bahan = (SELECT nama_bahan FROM tb_bahan WHERE id_bahan = ? LIMIT 1))
                 AND model IS NOT NULL AND model != "" ORDER BY model ASC`,
              [selectedTipe, selectedTipe]
            )
          : pool.query<RowDataPacket[]>(
              'SELECT DISTINCT model FROM tb_stock WHERE model IS NOT NULL AND model != "" ORDER BY model ASC'
            ),
      ]);

      return NextResponse.json({
        success: true,
        options: {
          tipes: tipeRows.map((r) => r.id_bahan),
          models: modelRows.map((r) => r.model),
        },
      });
    }

    const search = searchParams.get('q') || '';
    const tipe = searchParams.get('tipe') || '';
    const model = searchParams.get('model') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20', 10));

    const conditions: string[] = [];
    const params: any[] = [];

    if (search.trim()) {
      const sTrim = search.trim();
      let sPrefix = '';
      if (sTrim.length > 2 && /^\d{2}$/.test(sTrim.slice(-2))) {
        sPrefix = sTrim.slice(0, -2);
      }

      if (sPrefix) {
        conditions.push(`(s.id_bahan LIKE ? OR s.model LIKE ? OR s.ukuran LIKE ? OR s.barcode LIKE ? OR s.id_bahan LIKE ? OR s.model LIKE ? OR s.ukuran LIKE ? OR s.barcode LIKE ?)`);
        params.push(
          `%${sTrim}%`, `%${sTrim}%`, `%${sTrim}%`, `%${sTrim}%`,
          `%${sPrefix}%`, `%${sPrefix}%`, `%${sPrefix}%`, `%${sPrefix}%`
        );
      } else {
        conditions.push(`(s.id_bahan LIKE ? OR s.model LIKE ? OR s.ukuran LIKE ? OR s.barcode LIKE ?)`);
        params.push(`%${sTrim}%`, `%${sTrim}%`, `%${sTrim}%`, `%${sTrim}%`);
      }
    }

    if (tipe.trim()) {
      conditions.push(`(s.id_bahan = ? OR s.id_bahan = (SELECT nama_bahan FROM tb_bahan WHERE id_bahan = ? LIMIT 1))`);
      params.push(tipe.trim(), tipe.trim());
    }

    if (model.trim()) {
      conditions.push(`s.model = ?`);
      params.push(model.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Get total count of distinct (id_bahan, model) matching search filter
    const countQuery = `
      SELECT COUNT(DISTINCT s.id_bahan, s.model) AS total_count
      FROM tb_stock s
      ${whereClause}
    `;
    const [countRows] = await pool.query<RowDataPacket[]>(countQuery, params);
    const totalCount = Number(countRows[0]?.total_count || 0);

    // 2. Fetch page of models (Available stock = tb_stock.stock - tb_location_stock.qty - stock_reserve)
    const offset = (page - 1) * limit;
    const modelQuery = `
      SELECT 
        p.id_bahan,
        p.model,
        p.image,
        p.uom,
        p.total_stock,
        p.max_harga_lusin,
        b.harga AS harga_bahan_pcs
      FROM (
        SELECT 
          s.id_bahan,
          s.model,
          COALESCE(
            NULLIF(MAX(s.image), ''),
            (
              SELECT bm.image 
              FROM tb_barang_masuk bm 
              WHERE (bm.id_product = s.id_bahan OR bm.id_product = (SELECT b2.nama_bahan FROM tb_bahan b2 WHERE b2.id_bahan = s.id_bahan LIMIT 1))
                AND bm.model = s.model 
                AND bm.image IS NOT NULL 
                AND bm.image != '' 
              ORDER BY bm.no_id DESC 
              LIMIT 1
            ),
            ''
          ) AS image,
          MAX(s.uom) AS uom,
          SUM(GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0) - COALESCE(s.stock_reserve, 0))) AS total_stock,
          MAX(s.harga) AS max_harga_lusin
        FROM tb_stock s
        LEFT JOIN (
          SELECT id_bahan, model, ukuran, SUM(qty) AS loc_qty
          FROM tb_location_stock
          GROUP BY id_bahan, model, ukuran
        ) loc ON s.id_bahan = loc.id_bahan AND s.model = loc.model AND s.ukuran = loc.ukuran
        ${whereClause}
        GROUP BY s.id_bahan, s.model
        ORDER BY (SUM(GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0) - COALESCE(s.stock_reserve, 0))) > 0) DESC, s.id_bahan ASC, s.model ASC
        LIMIT ? OFFSET ?
      ) p
      LEFT JOIN tb_bahan b ON p.id_bahan = b.nama_bahan
    `;

    const modelParams = [...params, limit, offset];
    const [models] = await pool.query<RowDataPacket[]>(modelQuery, modelParams);

    if (models.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        page,
        limit,
        total: totalCount,
        hasMore: false,
      });
    }

    // 3. Fetch variants for these models (Subtract location stock and stock_reserve)
    const pairs = models.map((m) => [m.id_bahan, m.model]);
    const [variantRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        s.id AS stock_id,
        s.id_bahan,
        s.model,
        s.ukuran,
        GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0) - COALESCE(s.stock_reserve, 0)) AS stock,
        s.harga AS harga_lusin,
        s.uom,
        b.harga AS harga_bahan_pcs
       FROM tb_stock s
       LEFT JOIN tb_bahan b ON s.id_bahan = b.nama_bahan
       LEFT JOIN (
         SELECT id_bahan, model, ukuran, SUM(qty) AS loc_qty
         FROM tb_location_stock
         GROUP BY id_bahan, model, ukuran
       ) loc ON s.id_bahan = loc.id_bahan AND s.model = loc.model AND s.ukuran = loc.ukuran
       WHERE (s.id_bahan, s.model) IN (?)
       ORDER BY s.ukuran ASC`,
      [pairs]
    );

    // Map variants to products
    const variantsByModel = new Map<string, any[]>();
    for (const v of variantRows) {
      const key = `${v.id_bahan}|||${v.model}`;
      if (!variantsByModel.has(key)) variantsByModel.set(key, []);

      let hargaPcs = 0;
      if (v.harga_lusin && Number(v.harga_lusin) > 0) {
        hargaPcs = Number(v.harga_lusin);
      } else if (v.harga_bahan_pcs && Number(v.harga_bahan_pcs) > 0) {
        hargaPcs = Number(v.harga_bahan_pcs);
      }

      variantsByModel.get(key)!.push({
        stock_id: v.stock_id,
        ukuran: v.ukuran,
        stock: Number(v.stock || 0),
        harga_lusin: Number(v.harga_lusin || 0),
        harga_pcs: Math.max(0, hargaPcs),
        uom: v.uom || 'PCS',
      });
    }

    // Combine into final product cards
    const products = models.map((m) => {
      const key = `${m.id_bahan}|||${m.model}`;
      const variants = variantsByModel.get(key) || [];

      let minPrice = 0;
      let maxPrice = 0;
      variants.forEach((v) => {
        if (v.harga_pcs > 0) {
          if (minPrice === 0 || v.harga_pcs < minPrice) minPrice = v.harga_pcs;
          if (v.harga_pcs > maxPrice) maxPrice = v.harga_pcs;
        }
      });

      if (minPrice === 0 && m.harga_bahan_pcs) {
        minPrice = Math.max(0, Number(m.harga_bahan_pcs));
        maxPrice = minPrice;
      }

      return {
        key,
        id_bahan: m.id_bahan,
        model: m.model,
        image: m.image || '',
        uom: m.uom || 'PCS',
        total_stock: Number(m.total_stock || 0),
        min_price: minPrice,
        max_price: maxPrice,
        variants,
      };
    });

    const hasMore = offset + limit < totalCount;

    return NextResponse.json({
      success: true,
      data: products,
      page,
      limit,
      total: totalCount,
      hasMore,
    });
  } catch (error: any) {
    console.error('Error fetching POS products:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil catalog produk.' },
      { status: 500 }
    );
  }
}
