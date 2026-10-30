import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Fetch dropdown options for tipe, model, and ukuran concurrently
    if (getOptions) {
      const [[tipeRows], [modelRows], [ukuranRows]] = await Promise.all([
        pool.query<RowDataPacket[]>(
          'SELECT DISTINCT id_bahan FROM tb_stock WHERE id_bahan IS NOT NULL AND id_bahan != "" ORDER BY id_bahan ASC'
        ),
        pool.query<RowDataPacket[]>(
          'SELECT DISTINCT model FROM tb_stock WHERE model IS NOT NULL AND model != "" ORDER BY model ASC'
        ),
        pool.query<RowDataPacket[]>(
          'SELECT DISTINCT ukuran FROM tb_stock WHERE ukuran IS NOT NULL AND ukuran != "" ORDER BY ukuran ASC'
        ),
      ]);

      return NextResponse.json({
        success: true,
        options: {
          tipe: tipeRows.map((r) => r.id_bahan),
          model: modelRows.map((r) => r.model),
          ukuran: ukuranRows.map((r) => r.ukuran),
        },
      });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    // 2. Filters
    const tipe = searchParams.get('tipe') || searchParams.get('nama_tipe') || '';
    const model = searchParams.get('model') || searchParams.get('nama_barang') || '';
    const ukuran = searchParams.get('ukuran') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE stock <> 0';
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

    // A. Count total Tipe/Bahan groups matching filter
    const countSql = `
      SELECT COUNT(DISTINCT id_bahan) as total_tipe, SUM(stock) as grand_total_stock 
      FROM tb_stock 
      ${whereSql}
    `;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const totalTipe = Number(countRows[0]?.total_tipe) || 0;
    const totalPages = Math.ceil(totalTipe / limit) || 1;

    // B. Fetch Tipe/Bahan groups for current page
    const groupsSql = `
      SELECT id_bahan, SUM(stock) as total_stock_pcs, COUNT(*) as item_count 
      FROM tb_stock 
      ${whereSql}
      GROUP BY id_bahan 
      ORDER BY (CASE WHEN SUM(stock) > 0 THEN 1 ELSE 0 END) DESC, SUM(stock) DESC, id_bahan ASC
      LIMIT ? OFFSET ?
    `;

    const groupParams = [...params, limit, offset];
    const [groupRows] = await pool.query<RowDataPacket[]>(groupsSql, groupParams);

    if (groupRows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          groups: [],
          pagination: {
            page,
            limit,
            total_items: 0,
            total_pages: 1,
            from_item: 0,
            to_item: 0,
          },
          summary: {
            total_tipe: 0,
            total_items: 0,
            total_stock_pcs: 0,
            total_nilai_stok: 0,
          },
          filters: { tipe, model, ukuran },
        },
      });
    }

    // C. Fetch all detailed stock rows for the page's Tipe/Bahan list
    const bahanList = groupRows.map((g) => g.id_bahan);
    let detailWhereSql = 'WHERE stock <> 0 AND id_bahan IN (?)';
    const detailParams: any[] = [bahanList];

    if (effectiveBranch) {
      detailWhereSql += ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
      detailParams.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (model.trim() !== '') {
      detailWhereSql += ' AND model = ?';
      detailParams.push(model.trim());
    }

    if (ukuran.trim() !== '') {
      detailWhereSql += ' AND ukuran = ?';
      detailParams.push(ukuran.trim());
    }

    const detailSql = `
      SELECT id, id_transaksi_stock, tgl_masuk, id_bahan, model, ukuran, stock, uom, harga, barcode
      FROM tb_stock
      ${detailWhereSql}
      ORDER BY id_bahan ASC, model ASC, ukuran ASC, tgl_masuk DESC
    `;

    const [detailRows] = await pool.query<RowDataPacket[]>(detailSql, detailParams);

    // Group detailed rows by id_bahan
    const detailMap = new Map<string, any[]>();
    detailRows.forEach((row) => {
      const bKey = row.id_bahan;
      if (!detailMap.has(bKey)) {
        detailMap.set(bKey, []);
      }

      const rawHarga = Number(row.harga) || 0;
      const hargaPcs = Math.round(rawHarga / 12);
      const stockPcs = Number(row.stock) || 0;
      const subtotalNilai = stockPcs * hargaPcs;

      detailMap.get(bKey)!.push({
        id: row.id,
        id_transaksi_stock: row.id_transaksi_stock || '-',
        tgl_masuk: row.tgl_masuk,
        id_bahan: row.id_bahan,
        model: row.model || '-',
        ukuran: row.ukuran || '-',
        stock: stockPcs,
        uom: row.uom || 'PCS',
        harga_lusin: rawHarga,
        harga_pcs: hargaPcs,
        subtotal_nilai: subtotalNilai,
        barcode: row.barcode || '',
      });
    });

    // Build response groups
    let overallStockPcs = 0;
    let overallNilaiStok = 0;
    let overallItemsCount = 0;

    const groups = groupRows.map((g) => {
      const bKey = g.id_bahan;
      const items = detailMap.get(bKey) || [];

      let groupStockPcs = 0;
      let groupNilaiStok = 0;

      items.forEach((item) => {
        groupStockPcs += item.stock;
        groupNilaiStok += item.subtotal_nilai;
      });

      overallStockPcs += groupStockPcs;
      overallNilaiStok += groupNilaiStok;
      overallItemsCount += items.length;

      return {
        id_bahan: bKey,
        nama_tipe: bKey,
        total_stock_pcs: groupStockPcs,
        total_items: items.length,
        total_nilai_stok: groupNilaiStok,
        items,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        groups,
        pagination: {
          page,
          limit,
          total_items: totalTipe,
          total_pages: totalPages,
          from_item: totalTipe > 0 ? offset + 1 : 0,
          to_item: Math.min(offset + limit, totalTipe),
        },
        summary: {
          total_tipe: totalTipe,
          total_items: overallItemsCount,
          total_stock_pcs: overallStockPcs,
          total_nilai_stok: overallNilaiStok,
        },
        filters: {
          tipe,
          model,
          ukuran,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Stock Detail error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data stock detail.' },
      { status: 500 }
    );
  }
}
