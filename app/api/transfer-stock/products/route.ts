import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || searchParams.get('search') || '';

    let whereSql = 'WHERE stock > 0 AND id_bahan IS NOT NULL AND id_bahan != ""';
    const params: any[] = [];

    const rawSearch = search.trim();
    if (rawSearch !== '') {
      const cleanDigits = rawSearch.replace(/\D/g, '');
      const candidate7 = cleanDigits.length === 9 ? cleanDigits.slice(0, 7) : '';

      const words = rawSearch.split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (candidate7) {
          whereSql += ' AND (id_bahan LIKE ? OR model LIKE ? OR ukuran LIKE ? OR COALESCE(barcode, "") LIKE ? OR barcode = ?)';
          const pattern = `%${w}%`;
          params.push(pattern, pattern, pattern, pattern, candidate7);
        } else {
          whereSql += ' AND (id_bahan LIKE ? OR model LIKE ? OR ukuran LIKE ? OR COALESCE(barcode, "") LIKE ?)';
          const pattern = `%${w}%`;
          params.push(pattern, pattern, pattern, pattern);
        }
      }
    }

    const limit = rawSearch !== '' ? 300 : 500;

    const querySql = `
      SELECT id_bahan, model, ukuran, uom, stock, barcode
      FROM tb_stock
      ${whereSql}
      ORDER BY ${rawSearch !== '' ? 'id_bahan ASC, model ASC, ukuran ASC' : 'stock DESC, id_bahan ASC, model ASC, ukuran ASC'}
      LIMIT ${limit}
    `;

    const [rows] = await pool.query<RowDataPacket[]>(querySql, params);

    const products = rows.map((r) => {
      const idBahan = r.id_bahan || '';
      const modelStr = r.model || '';
      const ukuranStr = r.ukuran || '';
      const stockVal = Number(r.stock) || 0;
      const uomStr = r.uom || 'PCS';

      return {
        id_bahan: idBahan,
        model: modelStr,
        ukuran: ukuranStr,
        uom: uomStr,
        stock: stockVal,
        barcode: r.barcode || '',
        nama_barang: `${idBahan}-${modelStr}-${ukuranStr}`,
        label: `${idBahan} - ${modelStr} - ${ukuranStr} (Stok: ${stockVal} ${uomStr})`,
      };
    });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error: any) {
    console.error('Fetch transfer stock products error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil daftar barang berstok.' },
      { status: 500 }
    );
  }
}
