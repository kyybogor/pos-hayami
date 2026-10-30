import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Return options for filter dropdowns (Tipe, Model, Ukuran, Lokasi, Cabang)
    if (getOptions) {
      try {
        const [[tipeRows], [modelRows], [ukuranRows], [locationRows], [cabangRows]] = await Promise.all([
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
            'SELECT id, nama_lokasi FROM location ORDER BY nama_lokasi ASC'
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
            locations: locationRows.map((r) => ({
              id: r.id,
              nama_lokasi: r.nama_lokasi,
            })),
            cabang: cabangRows.map((c) => ({
              id_cabang: c.id_cabang,
              nama_cabang: c.nama_cabang,
            })),
          },
        });
      } catch (optErr: any) {
        console.error('Fetch filter options error in inventory-list:', optErr);
        return NextResponse.json({
          success: false,
          options: { tipe: [], model: [], ukuran: [], locations: [], cabang: [] },
        });
      }
    }

    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || '';

    const tipe = (searchParams.get('tipe') || searchParams.get('id_bahan') || '').trim();
    const model = (searchParams.get('model') || '').trim();
    const ukuran = (searchParams.get('ukuran') || '').trim();
    const lokasi = (searchParams.get('lokasi') || searchParams.get('id_location') || '').trim();
    const cabang = (searchParams.get('cabang') || '').trim();

    const isExport = searchParams.get('export') === 'true';

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = isExport ? 10000 : Math.max(1, parseInt(searchParams.get('limit') || '15', 10));
    const offset = isExport ? 0 : (page - 1) * limit;

    // Resolve branch filtering
    const [allCabang] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang ORDER BY id_cabang ASC'
    );

    let cabangFilterVals: string[] = [];
    let isCabangFiltered = false;

    if (cabang && cabang !== 'ALL' && cabang !== '') {
      isCabangFiltered = true;
      const match = allCabang.find(
        (c) => String(c.id_cabang) === String(cabang) || String(c.nama_cabang) === String(cabang)
      );
      if (match) {
        cabangFilterVals = [String(match.id_cabang), String(match.nama_cabang)];
      } else {
        cabangFilterVals = [cabang];
      }
    }

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    if (tipe !== '') {
      whereSql += ' AND s.id_bahan = ?';
      params.push(tipe);
    }

    if (model !== '') {
      whereSql += ' AND s.model = ?';
      params.push(model);
    }

    if (ukuran !== '') {
      whereSql += ' AND s.ukuran = ?';
      params.push(ukuran);
    }

    if (isCabangFiltered) {
      if (cabangFilterVals.length === 2) {
        whereSql += ' AND (s.id_cabang = ? OR s.id_cabang = ?)';
        params.push(cabangFilterVals[0], cabangFilterVals[1]);
      } else {
        whereSql += ' AND s.id_cabang = ?';
        params.push(cabangFilterVals[0]);
      }
    }

    // Filter by location from `location` table / `tb_location_stock`
    if (lokasi !== '' && lokasi !== 'ALL') {
      if (lokasi === 'MAIN_INVENTORY') {
        whereSql += ` AND (s.stock - COALESCE((
          SELECT SUM(loc.qty) 
          FROM tb_location_stock loc 
          WHERE loc.id_bahan = s.id_bahan 
            AND loc.model = s.model 
            AND loc.ukuran = s.ukuran
        ), 0)) > 0`;
      } else {
        whereSql += ` AND EXISTS (
          SELECT 1 FROM tb_location_stock loc 
          WHERE loc.id_bahan = s.id_bahan 
            AND loc.model = s.model 
            AND loc.ukuran = s.ukuran 
            AND (loc.nama_lokasi = ? OR loc.id_location = ?) 
            AND loc.qty > 0
        )`;
        params.push(lokasi, isNaN(Number(lokasi)) ? -1 : Number(lokasi));
      }
    }

    // Date range filtering setup if provided
    let hasDateFilter = false;
    let fromStart = '';
    let toEnd = '';
    if (tgl_from && tgl_to) {
      hasDateFilter = true;
      fromStart = `${tgl_from} 00:00:00`;
      toEnd = `${tgl_to} 23:59:59`;
    }

    // 2. Fetch total count of items matching filters
    const countSql = `SELECT COUNT(*) as total_count FROM tb_stock s ${whereSql}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const totalItems = Number(countRows[0]?.total_count) || 0;
    const totalPages = Math.ceil(totalItems / (isExport ? 10000 : Math.max(1, parseInt(searchParams.get('limit') || '15', 10)))) || 1;

    // 3. Fetch stock items
    const stockSql = `
      SELECT s.id_bahan, s.model, s.ukuran, s.uom, s.stock, s.id_cabang 
      FROM tb_stock s 
      ${whereSql}
      ORDER BY 
        (CASE WHEN s.stock > 0 THEN 1 ELSE 0 END) DESC,
        s.stock DESC,
        s.id_bahan ASC,
        s.model ASC,
        s.ukuran ASC
      LIMIT ? OFFSET ?
    `;

    const stockParams = [...params, limit, offset];
    const [stockRows] = await pool.query<RowDataPacket[]>(stockSql, stockParams);

    // Fetch all active location stock entries to map across items
    const locationStockMap: Record<
      string,
      { id_location: number; nama_lokasi: string; qty: number; updated_at?: string; id_cabang?: string }[]
    > = {};

    if (stockRows.length > 0) {
      let locStockSql = `SELECT id, id_location, nama_lokasi, id_bahan, model, ukuran, qty, updated_at, id_cabang FROM tb_location_stock WHERE qty > 0`;
      const locParams: any[] = [];
      if (isCabangFiltered) {
        if (cabangFilterVals.length === 2) {
          locStockSql += ` AND (id_cabang = ? OR id_cabang = ? OR id_cabang = '' OR id_cabang IS NULL)`;
          locParams.push(cabangFilterVals[0], cabangFilterVals[1]);
        } else {
          locStockSql += ` AND (id_cabang = ? OR id_cabang = '' OR id_cabang IS NULL)`;
          locParams.push(cabangFilterVals[0]);
        }
      }

      const [allLocRows] = await pool.query<RowDataPacket[]>(locStockSql, locParams);

      allLocRows.forEach((r) => {
        const key = `${r.id_bahan}___${r.model}___${r.ukuran}`;
        if (!locationStockMap[key]) locationStockMap[key] = [];
        locationStockMap[key].push({
          id_location: r.id_location,
          nama_lokasi: r.nama_lokasi,
          qty: Number(r.qty) || 0,
          updated_at: r.updated_at,
          id_cabang: r.id_cabang || '',
        });
      });
    }

    let grandTotalSisaStock = 0;
    let grandTotalMasuk = 0;
    let grandTotalKeluar = 0;
    let grandTotalRetur = 0;
    let grandTotalMove = 0;

    // 4. Process each stock item and retrieve stock movements & location details
    const inventoryList = await Promise.all(
      stockRows.map(async (stk) => {
        try {
          const idBahan = stk.id_bahan || '';
          const modelStr = stk.model || '';
          const ukuranStr = stk.ukuran || '';
          const sisaStock = Number(stk.stock) || 0;
          const uomStr = stk.uom || 'PCS';
          const itemCabang = stk.id_cabang || '';

          // Combined stock name: id_bahan-model-ukuran
          const namaStock = `${idBahan}-${modelStr}-${ukuranStr}`;

          // Location details for this specific product
          const locKey = `${idBahan}___${modelStr}___${ukuranStr}`;
          const itemLocations = locationStockMap[locKey] || [];
          const totalDiLokasiLain = itemLocations.reduce((sum, l) => sum + l.qty, 0);
          const stokUtama = Math.max(0, sisaStock - totalDiLokasiLain);

          let masukWhere = `WHERE id_product = ? AND model = ? AND ukuran = ? AND status = 's'`;
          let keluarWhere = `WHERE id_bahan = ? AND model = ? AND ukuran = ? AND status_keluar = 's' AND non_stock = '0'`;
          let returWhere = `WHERE id_bahan = ? AND model = ? AND ukuran = ? AND (status_keluar IS NULL OR status_keluar <> 'd')`;
          let moveWhere = `WHERE d.id_bahan = ? AND d.model = ? AND d.ukuran = ?`;
          let transferWhere = `WHERE d.id_bahan = ? AND d.model = ? AND d.ukuran = ?`;

          const masukParams = [idBahan, modelStr, ukuranStr];
          const keluarParams = [idBahan, modelStr, ukuranStr];
          const returParams = [idBahan, modelStr, ukuranStr];
          const moveParams = [idBahan, modelStr, ukuranStr];
          const transferParams = [idBahan, modelStr, ukuranStr];

          if (hasDateFilter) {
            masukWhere += ` AND (tgl_transaksi BETWEEN ? AND ?)`;
            keluarWhere += ` AND (tgl_transaksi BETWEEN ? AND ?)`;
            returWhere += ` AND (tgl_transaksi BETWEEN ? AND ?)`;
            moveWhere += ` AND (m.tgl_move BETWEEN ? AND ?)`;
            transferWhere += ` AND (t.tgl_transfer BETWEEN ? AND ?)`;
            masukParams.push(fromStart, toEnd);
            keluarParams.push(fromStart, toEnd);
            returParams.push(fromStart, toEnd);
            moveParams.push(fromStart, toEnd);
            transferParams.push(fromStart, toEnd);
          }

          if (isCabangFiltered) {
            if (cabangFilterVals.length === 2) {
              masukWhere += ` AND (id_cabang = ? OR id_cabang = ?)`;
              keluarWhere += ` AND (id_cabang = ? OR id_cabang = ?)`;
              returWhere += ` AND (id_cabang = ? OR id_cabang = ?)`;
              moveWhere += ` AND (m.id_cabang = ? OR m.id_cabang = ?)`;
              transferWhere += ` AND (t.id_cabang = ? OR t.id_cabang = ?)`;

              masukParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              keluarParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              returParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              moveParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              transferParams.push(cabangFilterVals[0], cabangFilterVals[1]);
            } else {
              masukWhere += ` AND id_cabang = ?`;
              keluarWhere += ` AND id_cabang = ?`;
              returWhere += ` AND id_cabang = ?`;
              moveWhere += ` AND m.id_cabang = ?`;
              transferWhere += ` AND t.id_cabang = ?`;

              masukParams.push(cabangFilterVals[0]);
              keluarParams.push(cabangFilterVals[0]);
              returParams.push(cabangFilterVals[0]);
              moveParams.push(cabangFilterVals[0]);
              transferParams.push(cabangFilterVals[0]);
            }
          }

          const mutParams = [...masukParams, ...keluarParams, ...returParams, ...moveParams, ...transferParams];

          const movementsSql = `
            SELECT 
              tgl_transaksi as tgl_transaksi, 
              COALESCE(NULLIF(id_transaksi, ''), no_id) as id_transaksi, 
              'BARANG_MASUK' as tipe_trx, 
              (CASE WHEN LOWER(uom) = 'lusin' THEN qty * 12 ELSE qty END) as qty_masuk, 
              0 as qty_keluar,
              0 as qty_retur,
              0 as qty_move,
              keterangan
            FROM tb_barang_masuk 
            ${masukWhere}

            UNION ALL

            SELECT 
              tgl_transaksi as tgl_transaksi, 
              COALESCE(NULLIF(id_transaksi, ''), id_invoice, no_id) as id_transaksi, 
              'BARANG_KELUAR' as tipe_trx, 
              0 as qty_masuk, 
              qty as qty_keluar,
              0 as qty_retur,
              0 as qty_move,
              keterangan
            FROM tb_barang_keluar 
            ${keluarWhere}

            UNION ALL

            SELECT 
              tgl_transaksi as tgl_transaksi, 
              COALESCE(NULLIF(invret, ''), NULLIF(id_transaksi, ''), no_id) as id_transaksi, 
              'RETUR_BARANG' as tipe_trx, 
              0 as qty_masuk, 
              0 as qty_keluar,
              (CASE WHEN LOWER(uom) = 'lusin' THEN qty * 12 ELSE qty END) as qty_retur,
              0 as qty_move,
              COALESCE(id_customer, 'Retur Customer') as keterangan
            FROM tb_retur 
            ${returWhere}

            UNION ALL

            SELECT 
              m.tgl_move as tgl_transaksi, 
              d.id_move as id_transaksi, 
              'MOVE_LOCATION' as tipe_trx, 
              0 as qty_masuk, 
              0 as qty_keluar,
              0 as qty_retur,
              (CASE WHEN LOWER(d.uom) = 'lusin' THEN d.qty * 12 ELSE d.qty END) as qty_move,
              CONCAT('Pindah Lokasi ke ', d.nama_lokasi, IF(m.keterangan IS NOT NULL AND m.keterangan != '', CONCAT(' (', m.keterangan, ')'), '')) as keterangan
            FROM tb_move_location_detail d
            INNER JOIN tb_move_location m ON d.id_move = m.id_move
            ${moveWhere}

            UNION ALL

            SELECT 
              t.tgl_transfer as tgl_transaksi, 
              d.id_transfer as id_transaksi, 
              'TRANSFER_STOCK' as tipe_trx, 
              0 as qty_masuk, 
              (CASE WHEN LOWER(d.uom) = 'lusin' THEN d.qty * 12 ELSE d.qty END) as qty_keluar,
              0 as qty_retur,
              0 as qty_move,
              CONCAT('Transfer Stock ke ', t.tujuan, IF(t.keterangan IS NOT NULL AND t.keterangan != '', CONCAT(' (', t.keterangan, ')'), '')) as keterangan
            FROM transfer_stock_detail d
            INNER JOIN transfer_stock t ON d.id_transfer = t.id_transfer
            ${transferWhere}

            ORDER BY tgl_transaksi DESC, id_transaksi DESC
          `;

          let movementsRows: RowDataPacket[] = [];
          try {
            const [mRows] = await pool.query<RowDataPacket[]>(movementsSql, mutParams);
            movementsRows = mRows;
          } catch (mErr) {
            console.error('Fetch movements error for item:', idBahan, modelStr, mErr);
          }

          let totalMasuk = 0;
          let totalKeluar = 0;
          let totalRetur = 0;
          let totalMove = 0;

          const detailMovements = movementsRows.map((m) => {
            const inVal = Number(m.qty_masuk) || 0;
            const outVal = Number(m.qty_keluar) || 0;
            const returVal = Number(m.qty_retur) || 0;
            const moveVal = Number(m.qty_move) || 0;
            totalMasuk += inVal;
            totalKeluar += outVal;
            totalRetur += returVal;
            totalMove += moveVal;

            return {
              id_transaksi: m.id_transaksi || '-',
              tgl_transaksi: m.tgl_transaksi || '-',
              tipe_trx: m.tipe_trx,
              qty_masuk: inVal,
              qty_keluar: outVal,
              qty_retur: returVal,
              qty_move: moveVal,
              keterangan: m.keterangan || '',
            };
          });

          grandTotalSisaStock += sisaStock;
          grandTotalMasuk += totalMasuk;
          grandTotalKeluar += totalKeluar;
          grandTotalRetur += totalRetur;
          grandTotalMove += totalMove;

          return {
            id_bahan: idBahan,
            model: modelStr,
            ukuran: ukuranStr,
            uom: uomStr,
            nama_stock: namaStock,
            sisa_stock: sisaStock,
            id_cabang: itemCabang,
            stok_utama: stokUtama,
            total_di_lokasi_lain: totalDiLokasiLain,
            locations: itemLocations,
            total_masuk: totalMasuk,
            total_keluar: totalKeluar,
            total_retur: totalRetur,
            total_move: totalMove,
            total_pergerakan: detailMovements.length,
            movements: detailMovements,
          };
        } catch (itemErr) {
          console.error('Error processing stock row:', itemErr);
          return {
            id_bahan: stk.id_bahan || '',
            model: stk.model || '',
            ukuran: stk.ukuran || '',
            uom: stk.uom || 'PCS',
            nama_stock: `${stk.id_bahan || ''}-${stk.model || ''}-${stk.ukuran || ''}`,
            sisa_stock: Number(stk.stock) || 0,
            id_cabang: stk.id_cabang || '',
            stok_utama: Number(stk.stock) || 0,
            total_di_lokasi_lain: 0,
            locations: [],
            total_masuk: 0,
            total_keluar: 0,
            total_retur: 0,
            total_move: 0,
            total_pergerakan: 0,
            movements: [],
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        items: inventoryList,
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
          total_sisa_stock: grandTotalSisaStock,
          total_masuk: grandTotalMasuk,
          total_keluar: grandTotalKeluar,
          total_retur: grandTotalRetur,
          total_move: grandTotalMove,
        },
        filters: {
          tgl_from,
          tgl_to,
          tipe,
          model,
          ukuran,
          lokasi,
          cabang,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Inventory List error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data inventory list: ' + error.message },
      { status: 500 }
    );
  }
}
