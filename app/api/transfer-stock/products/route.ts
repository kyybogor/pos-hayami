import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || searchParams.get('search') || '';

    let whereSql = 'WHERE stock > 0 AND id_bahan IS NOT NULL AND id_bahan != ""';
    const params: any[] = [];

    if (search.trim() !== '') {
      whereSql += ' AND (id_bahan LIKE ? OR model LIKE ? OR ukuran LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }

    const querySql = `
      SELECT id_bahan, model, ukuran, uom, stock
      FROM tb_stock
      ${whereSql}
      ORDER BY stock DESC, id_bahan ASC, model ASC, ukuran ASC
      LIMIT 100
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
        nama_barang: `${idBahan}-${modelStr}-${ukuranStr}`,
        label: `${idBahan}-${modelStr}-${ukuranStr} (Stock: ${stockVal} ${uomStr})`,
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
