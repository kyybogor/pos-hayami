import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // Return filter dropdown options from tb_stock
    if (getOptions) {
      const [[tipeRows], [modelRows], [ukuranRows], [cabangRows]] = await Promise.all([
        pool.query<RowDataPacket[]>(
          'SELECT DISTINCT id_bahan FROM tb_stock WHERE id_bahan IS NOT NULL AND id_bahan != "" ORDER BY id_bahan ASC'
        ),
        pool.query<RowDataPacket[]>(
          'SELECT DISTINCT model FROM tb_stock WHERE model IS NOT NULL AND model != "" ORDER BY model ASC'
        ),
        pool.query<RowDataPacket[]>(
          'SELECT DISTINCT ukuran FROM tb_stock WHERE ukuran IS NOT NULL AND ukuran != "" ORDER BY ukuran ASC'
        ),
        pool.query<RowDataPacket[]>(
          'SELECT id_cabang, nama_cabang FROM tb_cabang ORDER BY id_cabang ASC'
        ),
      ]);

      return NextResponse.json({
        success: true,
        options: {
          tipe: tipeRows.map((r) => r.id_bahan),
          model: modelRows.map((r) => r.model),
          ukuran: ukuranRows.map((r) => r.ukuran),
          cabang: cabangRows,
        },
      });
    }

    const tipe = searchParams.get('tipe') || '';
    const model = searchParams.get('model') || '';
    const ukuran = searchParams.get('ukuran') || '';
    const search = searchParams.get('search') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE stock > 0';
    const params: any[] = [];

    if (effectiveBranch) {
      whereSql += ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tipe.trim() !== '') {
      whereSql += ' AND id_bahan = ?';
      params.push(tipe.trim());
    }

    if (model.trim() !== '') {
      whereSql += ' AND model = ?';
      params.push(model.trim());
    }

    if (ukuran.trim() !== '') {
      whereSql += ' AND ukuran = ?';
      params.push(ukuran.trim());
    }

    if (search.trim() !== '') {
      whereSql += ' AND (id_bahan LIKE ? OR model LIKE ? OR ukuran LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    // 1. Get summary and total count
    const countSql = `SELECT COUNT(*) as total_count, SUM(stock) as total_stock FROM tb_stock ${whereSql}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);

    const totalItems = Number(countRows[0]?.total_count) || 0;
    const totalStock = Number(countRows[0]?.total_stock) || 0;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // 2. Fetch paginated data
    const dataSql = `
      SELECT id_bahan, model, ukuran, stock 
      FROM tb_stock 
      ${whereSql}
      ORDER BY id_bahan ASC, model ASC, ukuran ASC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

    const items = rows.map((r, idx) => {
      const stockNum = Number(r.stock) || 0;
      const idBahanStr = r.id_bahan || '';
      const modelStr = r.model || '';
      const ukuranStr = r.ukuran || '';

      const namaBarang = [idBahanStr, modelStr, ukuranStr].filter(Boolean).join(' - ');

      return {
        row_num: offset + idx + 1,
        id_bahan: idBahanStr,
        model: modelStr,
        ukuran: ukuranStr,
        nama_barang: namaBarang,
        stock: stockNum,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
          from_item: totalItems > 0 ? offset + 1 : 0,
          to_item: Math.min(offset + limit, totalItems),
        },
        summary: {
          total_items: totalItems,
          total_stock: totalStock,
        },
        filters: {
          tipe,
          model,
          ukuran,
          search,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Stock Card General error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data stock card general.' },
      { status: 500 }
    );
  }
}
