import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

let isLocationStockEnsured = false;
async function maybeEnsureLocationStockTable() {
  if (isLocationStockEnsured) return;
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
    isLocationStockEnsured = true;
  } catch {
    isLocationStockEnsured = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await maybeEnsureLocationStockTable();

    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get('code') || searchParams.get('q') || '';
    const cleanCode = rawCode.trim();

    if (!cleanCode) {
      return NextResponse.json(
        { success: false, message: 'Kode barcode wajib diisi.' },
        { status: 400 }
      );
    }

    let qty = 1;
    let baseBarcode = cleanCode;
    let hasQtySuffix = false;

    // Check if cleanCode is a barcode with a 2-digit quantity suffix
    // Standard barcode in tb_stock is 7 digits. When printed on packs, it is 9 digits (7-digit barcode + 2-digit pcs).
    // Example: 276056506 -> base: 2760565, qty: 6 pcs
    // Example: 276056503 -> base: 2760565, qty: 3 pcs
    // Example: 276056512 -> base: 2760565, qty: 12 pcs
    if (/^\d{8,}$/.test(cleanCode)) {
      const last2 = cleanCode.slice(-2);
      const parsedQty = parseInt(last2, 10);
      if (!isNaN(parsedQty) && parsedQty > 0) {
        qty = parsedQty;
        baseBarcode = cleanCode.slice(0, -2);
        hasQtySuffix = true;
      }
    } else if (/^\d{3,7}$/.test(cleanCode)) {
      // For other numeric codes, check if baseBarcode exists in tb_stock
      const potentialBase = cleanCode.slice(0, -2);
      const [chk] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM tb_stock WHERE barcode = ? LIMIT 1',
        [potentialBase]
      );
      if (chk.length > 0) {
        const parsedQty = parseInt(cleanCode.slice(-2), 10);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          qty = parsedQty;
          baseBarcode = potentialBase;
          hasQtySuffix = true;
        }
      }
    }

    let matchedItem: RowDataPacket | null = null;
    let finalQty = 1;

    const baseQuery = `
      SELECT 
        s.id AS stock_id,
        s.id_bahan,
        s.model,
        s.ukuran,
        GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) AS stock,
        s.harga AS harga_lusin,
        s.uom,
        s.barcode,
        COALESCE(
          NULLIF(s.image, ''),
          (
            SELECT bm.image 
            FROM tb_barang_masuk bm 
            WHERE (bm.id_product = s.id_bahan OR bm.id_product = b.nama_bahan)
              AND bm.model = s.model 
              AND bm.image IS NOT NULL 
              AND bm.image != '' 
            ORDER BY bm.no_id DESC 
            LIMIT 1
          ),
          ''
        ) AS image,
        b.harga AS harga_bahan_pcs
       FROM tb_stock s
       LEFT JOIN tb_bahan b ON (s.id_bahan = b.id_bahan OR s.id_bahan = b.nama_bahan)
       LEFT JOIN (
         SELECT id_bahan, model, ukuran, SUM(qty) AS loc_qty
         FROM tb_location_stock
         GROUP BY id_bahan, model, ukuran
       ) loc ON s.id_bahan = loc.id_bahan AND s.model = loc.model AND s.ukuran = loc.ukuran
    `;

    // STEP 1: Priority 1 - If barcode has 2-digit quantity suffix, lookup baseBarcode directly with extracted Qty
    if (hasQtySuffix && baseBarcode) {
      const [baseRows] = await pool.query<RowDataPacket[]>(
        `${baseQuery}
         WHERE s.barcode = ? OR s.id_bahan = ? OR s.model = ? OR s.id = ?
         ORDER BY (GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) > 0) DESC, s.id ASC
         LIMIT 1`,
        [baseBarcode, baseBarcode, baseBarcode, baseBarcode]
      );

      if (baseRows.length > 0) {
        matchedItem = baseRows[0];
        finalQty = qty; // Extracted Qty from suffix applied (e.g. 06 -> 6 pcs, 03 -> 3 pcs)
      }
    }

    // STEP 2: Priority 2 - Exact full match with scanned cleanCode (Qty = 1)
    if (!matchedItem) {
      const [exactFullRows] = await pool.query<RowDataPacket[]>(
        `${baseQuery}
         WHERE s.barcode = ? OR s.id_bahan = ? OR s.model = ? OR s.id = ?
         ORDER BY (GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) > 0) DESC, s.id ASC
         LIMIT 1`,
        [cleanCode, cleanCode, cleanCode, cleanCode]
      );

      if (exactFullRows.length > 0) {
        matchedItem = exactFullRows[0];
        finalQty = 1; // Full code matched an item directly
      }
    }

    // STEP 3: Priority 3 - Fallback LIKE search using baseBarcode (Qty = extracted qty)
    if (!matchedItem && hasQtySuffix && baseBarcode.length >= 3) {
      const [likeBaseRows] = await pool.query<RowDataPacket[]>(
        `${baseQuery}
         WHERE s.barcode LIKE ? OR s.id_bahan LIKE ? OR s.model LIKE ?
         ORDER BY (GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) > 0) DESC, s.id ASC
         LIMIT 1`,
        [`%${baseBarcode}%`, `%${baseBarcode}%`, `%${baseBarcode}%`]
      );

      if (likeBaseRows.length > 0) {
        matchedItem = likeBaseRows[0];
        finalQty = qty;
      }
    }

    // STEP 4: Priority 4 - Fallback LIKE search using full cleanCode (Qty = 1)
    if (!matchedItem && cleanCode.length >= 3) {
      const [likeFullRows] = await pool.query<RowDataPacket[]>(
        `${baseQuery}
         WHERE s.barcode LIKE ? OR s.id_bahan LIKE ? OR s.model LIKE ?
         ORDER BY (GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) > 0) DESC, s.id ASC
         LIMIT 1`,
        [`%${cleanCode}%`, `%${cleanCode}%`, `%${cleanCode}%`]
      );

      if (likeFullRows.length > 0) {
        matchedItem = likeFullRows[0];
        finalQty = 1;
      }
    }

    if (!matchedItem) {
      return NextResponse.json({
        success: false,
        message: `Produk dengan barcode "${cleanCode}" tidak ditemukan di tb_stock.`,
      });
    }

    let hargaPcs = 0;
    const hargaLusin = Number(matchedItem.harga_lusin || 0);
    if (hargaLusin > 0) {
      hargaPcs = hargaLusin;
    } else if (matchedItem.harga_bahan_pcs && Number(matchedItem.harga_bahan_pcs) > 0) {
      hargaPcs = Number(matchedItem.harga_bahan_pcs);
    }

    return NextResponse.json({
      success: true,
      data: {
        stock_id: matchedItem.stock_id,
        id_bahan: matchedItem.id_bahan,
        model: matchedItem.model,
        ukuran: matchedItem.ukuran,
        stock: Number(matchedItem.stock || 0),
        uom: matchedItem.uom || 'PCS',
        harga_lusin: hargaLusin,
        harga_pcs: Math.max(0, hargaPcs),
        scanned_qty: finalQty,
        scanned_code: cleanCode,
        barcode: matchedItem.barcode || matchedItem.id_bahan,
        image: matchedItem.image || '',
      },
    });
  } catch (error: any) {
    console.error('Error scanning barcode in POS:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses scan barcode.' },
      { status: 500 }
    );
  }
}
