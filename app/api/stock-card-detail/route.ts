import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // 1. Fetch options for filter dropdowns (Tipe, Model, Ukuran, Cabang)
    if (getOptions) {
      try {
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
            cabang: cabangRows.map((c) => ({
              id_cabang: c.id_cabang,
              nama_cabang: c.nama_cabang,
            })),
          },
        });
      } catch (optErr: any) {
        console.error('Fetch filter options error in stock-card-detail:', optErr);
        return NextResponse.json({
          success: false,
          options: { tipe: [], model: [], ukuran: [], cabang: [] },
        });
      }
    }

    // 2. Read query parameters
    const tgl_from = (searchParams.get('tgl_from') || searchParams.get('from') || '').trim();
    const tgl_to = (searchParams.get('tgl_to') || searchParams.get('to') || '').trim();

    const tipe = (searchParams.get('tipe') || searchParams.get('nama_tipe') || '').trim();
    const model = (searchParams.get('model') || searchParams.get('nama_barang') || '').trim();
    const ukuran = (searchParams.get('ukuran') || '').trim();
    const cabang = (searchParams.get('cabang') || '').trim();

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '10', 10));
    const offset = (page - 1) * limit;

    // Fetch branches for matching
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
      whereSql += ' AND id_bahan = ?';
      params.push(tipe);
    }

    if (model !== '') {
      whereSql += ' AND model = ?';
      params.push(model);
    }

    if (ukuran !== '') {
      whereSql += ' AND ukuran = ?';
      params.push(ukuran);
    }

    if (isCabangFiltered) {
      if (cabangFilterVals.length === 2) {
        whereSql += ' AND (id_cabang = ? OR id_cabang = ?)';
        params.push(cabangFilterVals[0], cabangFilterVals[1]);
      } else {
        whereSql += ' AND id_cabang = ?';
        params.push(cabangFilterVals[0]);
      }
    }

    // Date range setup
    let hasDateFilter = false;
    let fromStart = '';
    let toEnd = '';
    if (tgl_from !== '' && tgl_to !== '') {
      hasDateFilter = true;
      fromStart = `${tgl_from} 00:00:00`;
      toEnd = `${tgl_to} 23:59:59`;
    }

    // 3. Count total matching items
    const countSql = `SELECT COUNT(*) as total_count FROM tb_stock ${whereSql}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const totalItems = Number(countRows[0]?.total_count) || 0;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // 4. Fetch stock items for the current page
    const stockSql = `
      SELECT id, id_transaksi_stock, tgl_masuk, id_bahan, model, ukuran, uom, stock, id_cabang 
      FROM tb_stock 
      ${whereSql}
      ORDER BY 
        (CASE WHEN stock > 0 THEN 1 ELSE 0 END) DESC,
        stock DESC,
        id_bahan ASC,
        model ASC,
        ukuran ASC
      LIMIT ? OFFSET ?
    `;

    const stockParams = [...params, limit, offset];
    const [stockRows] = await pool.query<RowDataPacket[]>(stockSql, stockParams);

    let grandTotalStokAwal = 0;
    let grandTotalMasuk = 0;
    let grandTotalKeluar = 0;
    let grandTotalRetur = 0;
    let grandTotalMove = 0;
    let grandTotalStokAkhir = 0;

    // Helper to generate branch filter snippet & params for a given table alias/prefix
    const getCabangClause = (colName = 'id_cabang') => {
      if (!isCabangFiltered) return { sql: '', p: [] };
      if (cabangFilterVals.length === 2) {
        return {
          sql: ` AND (${colName} = ? OR ${colName} = ?)`,
          p: [cabangFilterVals[0], cabangFilterVals[1]],
        };
      }
      return {
        sql: ` AND ${colName} = ?`,
        p: [cabangFilterVals[0]],
      };
    };

    // 5. Process each stock item and compute chronological mutations
    const stockDetails = await Promise.all(
      stockRows.map(async (stk) => {
        try {
          const idBahan = stk.id_bahan || '';
          const modelStr = stk.model || '';
          const ukuranStr = stk.ukuran || '';
          const uomStr = stk.uom || 'PCS';
          const idCabangStr = stk.id_cabang || '';
          const stkIdTransaksi = stk.id_transaksi_stock || '';
          const stkTglMasuk = stk.tgl_masuk || '';

          // A. Calculate Initial Stock (before tgl_from) if date filter is active
          let stokAwal = 0;

          if (hasDateFilter) {
            const cBm = getCabangClause('id_cabang');
            const cBk = getCabangClause('id_cabang');
            const cRet = getCabangClause('id_cabang');
            const cTrf = getCabangClause('t.id_cabang');
            const cOpn = getCabangClause('id_cabang');

            const [masukAwalRows] = await pool.query<RowDataPacket[]>(
              `SELECT SUM(CASE WHEN LOWER(uom) = 'lusin' THEN qty * 12 ELSE qty END) as qty_masuk 
               FROM tb_barang_masuk 
               WHERE id_product = ? AND model = ? AND ukuran = ? AND status = 's' AND tgl_transaksi < ? ${cBm.sql}`,
              [idBahan, modelStr, ukuranStr, fromStart, ...cBm.p]
            );

            const [keluarAwalRows] = await pool.query<RowDataPacket[]>(
              `SELECT SUM(qty) as qty_keluar 
               FROM tb_barang_keluar 
               WHERE id_bahan = ? AND model = ? AND ukuran = ? AND status_keluar = 's' AND non_stock = '0' AND tgl_transaksi < ? ${cBk.sql}`,
              [idBahan, modelStr, ukuranStr, fromStart, ...cBk.p]
            );

            const [returAwalRows] = await pool.query<RowDataPacket[]>(
              `SELECT SUM(CASE WHEN id_customer = 'Hayami' THEN -(CASE WHEN LOWER(uom) = 'lusin' THEN qty * 12 ELSE qty END) ELSE (CASE WHEN LOWER(uom) = 'lusin' THEN qty * 12 ELSE qty END) END) as qty_retur 
               FROM tb_retur 
               WHERE id_bahan = ? AND model = ? AND ukuran = ? AND (status_keluar IS NULL OR status_keluar <> 'd') AND tgl_transaksi < ? ${cRet.sql}`,
              [idBahan, modelStr, ukuranStr, fromStart, ...cRet.p]
            );

            const [trfAwalRows] = await pool.query<RowDataPacket[]>(
              `SELECT SUM(CASE WHEN LOWER(d.uom) = 'lusin' THEN d.qty * 12 ELSE d.qty END) as qty_trf
               FROM transfer_stock_detail d
               INNER JOIN transfer_stock t ON d.id_transfer = t.id_transfer
               WHERE d.id_bahan = ? AND d.model = ? AND d.ukuran = ? AND t.tgl_transfer < ? ${cTrf.sql}`,
              [idBahan, modelStr, ukuranStr, fromStart, ...cTrf.p]
            );

            const [opnameAwalRows] = await pool.query<RowDataPacket[]>(
              `SELECT SUM(stock_opname) as stock_opname 
               FROM inv_adjust_in 
               WHERE id_product = ? AND model = ? AND ukuran = ? AND status = 's' AND inv_date < ? ${cOpn.sql}`,
              [idBahan, modelStr, ukuranStr, tgl_from, ...cOpn.p]
            );

            const awalMasuk = Number(masukAwalRows[0]?.qty_masuk) || 0;
            const awalKeluar = Number(keluarAwalRows[0]?.qty_keluar) || 0;
            const awalRetur = Number(returAwalRows[0]?.qty_retur) || 0;
            const awalTrf = Number(trfAwalRows[0]?.qty_trf) || 0;
            const awalOpname = Number(opnameAwalRows[0]?.stock_opname) || 0;

            stokAwal = awalMasuk - awalKeluar + awalRetur - awalTrf + awalOpname;
          }

          // B. Fetch Chronological Mutations (Barang Masuk, Keluar, Retur, Move Location, Transfer Stock, Opname)
          let bmWhere = `WHERE id_product = ? AND model = ? AND ukuran = ? AND status = 's'`;
          let bkWhere = `WHERE id_bahan = ? AND model = ? AND ukuran = ? AND status_keluar = 's' AND non_stock = '0'`;
          let retWhere = `WHERE id_bahan = ? AND model = ? AND ukuran = ? AND (status_keluar IS NULL OR status_keluar <> 'd')`;
          let mvWhere = `WHERE d.id_bahan = ? AND d.model = ? AND d.ukuran = ?`;
          let trfWhere = `WHERE d.id_bahan = ? AND d.model = ? AND d.ukuran = ?`;
          let opnWhere = `WHERE id_product = ? AND model = ? AND ukuran = ? AND status = 's'`;

          const bmParams: any[] = [idBahan, modelStr, ukuranStr];
          const bkParams: any[] = [idBahan, modelStr, ukuranStr];
          const retParams: any[] = [idBahan, modelStr, ukuranStr];
          const mvParams: any[] = [idBahan, modelStr, ukuranStr];
          const trfParams: any[] = [idBahan, modelStr, ukuranStr];
          const opnParams: any[] = [idBahan, modelStr, ukuranStr];

          if (hasDateFilter) {
            bmWhere += ` AND (tgl_transaksi BETWEEN ? AND ?)`;
            bkWhere += ` AND (tgl_transaksi BETWEEN ? AND ?)`;
            retWhere += ` AND (tgl_transaksi BETWEEN ? AND ?)`;
            mvWhere += ` AND (m.tgl_move BETWEEN ? AND ?)`;
            trfWhere += ` AND (t.tgl_transfer BETWEEN ? AND ?)`;
            opnWhere += ` AND (inv_date BETWEEN ? AND ?)`;

            bmParams.push(fromStart, toEnd);
            bkParams.push(fromStart, toEnd);
            retParams.push(fromStart, toEnd);
            mvParams.push(fromStart, toEnd);
            trfParams.push(fromStart, toEnd);
            opnParams.push(tgl_from, tgl_to);
          }

          if (isCabangFiltered) {
            if (cabangFilterVals.length === 2) {
              bmWhere += ` AND (id_cabang = ? OR id_cabang = ?)`;
              bkWhere += ` AND (id_cabang = ? OR id_cabang = ?)`;
              retWhere += ` AND (id_cabang = ? OR id_cabang = ?)`;
              mvWhere += ` AND (m.id_cabang = ? OR m.id_cabang = ?)`;
              trfWhere += ` AND (t.id_cabang = ? OR t.id_cabang = ?)`;
              opnWhere += ` AND (id_cabang = ? OR id_cabang = ?)`;

              bmParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              bkParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              retParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              mvParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              trfParams.push(cabangFilterVals[0], cabangFilterVals[1]);
              opnParams.push(cabangFilterVals[0], cabangFilterVals[1]);
            } else {
              bmWhere += ` AND id_cabang = ?`;
              bkWhere += ` AND id_cabang = ?`;
              retWhere += ` AND id_cabang = ?`;
              mvWhere += ` AND m.id_cabang = ?`;
              trfWhere += ` AND t.id_cabang = ?`;
              opnWhere += ` AND id_cabang = ?`;

              bmParams.push(cabangFilterVals[0]);
              bkParams.push(cabangFilterVals[0]);
              retParams.push(cabangFilterVals[0]);
              mvParams.push(cabangFilterVals[0]);
              trfParams.push(cabangFilterVals[0]);
              opnParams.push(cabangFilterVals[0]);
            }
          }

          const mutationsSql = `
            SELECT 
              tgl_transaksi as tgl, 
              COALESCE(NULLIF(id_transaksi, ''), no_id) as id_transaksi, 
              'BARANG_MASUK' as tipe_trx, 
              (CASE WHEN LOWER(uom) = 'lusin' THEN qty * 12 ELSE qty END) as masuk, 
              0 as keluar,
              0 as retur,
              0 as move,
              keterangan
            FROM tb_barang_masuk 
            ${bmWhere}

            UNION ALL

            SELECT 
              tgl_transaksi as tgl, 
              COALESCE(NULLIF(id_transaksi, ''), id_invoice, no_id) as id_transaksi, 
              'BARANG_KELUAR' as tipe_trx, 
              0 as masuk, 
              qty as keluar,
              0 as retur,
              0 as move,
              keterangan
            FROM tb_barang_keluar 
            ${bkWhere}

            UNION ALL

            SELECT 
              tgl_transaksi as tgl, 
              COALESCE(NULLIF(invret, ''), NULLIF(id_transaksi, ''), no_id) as id_transaksi, 
              'RETUR_BARANG' as tipe_trx, 
              0 as masuk, 
              0 as keluar,
              (CASE WHEN LOWER(uom) = 'lusin' THEN qty * 12 ELSE qty END) as retur,
              0 as move,
              COALESCE(NULLIF(id_customer, ''), keterangan, 'Retur Barang') as keterangan
            FROM tb_retur 
            ${retWhere}

            UNION ALL

            SELECT 
              m.tgl_move as tgl, 
              d.id_move as id_transaksi, 
              'MOVE_LOCATION' as tipe_trx, 
              0 as masuk, 
              0 as keluar,
              0 as retur,
              (CASE WHEN LOWER(d.uom) = 'lusin' THEN d.qty * 12 ELSE d.qty END) as move,
              CONCAT('Pindah ke ', d.nama_lokasi, IF(m.keterangan IS NOT NULL AND m.keterangan != '', CONCAT(' (', m.keterangan, ')'), '')) as keterangan
            FROM tb_move_location_detail d
            INNER JOIN tb_move_location m ON d.id_move = m.id_move
            ${mvWhere}

            UNION ALL

            SELECT 
              t.tgl_transfer as tgl, 
              d.id_transfer as id_transaksi, 
              'TRANSFER_STOCK' as tipe_trx, 
              0 as masuk, 
              (CASE WHEN LOWER(d.uom) = 'lusin' THEN d.qty * 12 ELSE d.qty END) as keluar,
              0 as retur,
              0 as move,
              CONCAT('Transfer ke ', t.tujuan, IF(t.keterangan IS NOT NULL AND t.keterangan != '', CONCAT(' (', t.keterangan, ')'), '')) as keterangan
            FROM transfer_stock_detail d
            INNER JOIN transfer_stock t ON d.id_transfer = t.id_transfer
            ${trfWhere}

            UNION ALL

            SELECT 
              inv_date as tgl, 
              id_inv_in as id_transaksi, 
              'OPNAME' as tipe_trx, 
              (CASE WHEN stock_opname >= 0 THEN stock_opname ELSE 0 END) as masuk, 
              (CASE WHEN stock_opname < 0 THEN ABS(stock_opname) ELSE 0 END) as keluar,
              0 as retur,
              0 as move,
              keterangan
            FROM inv_adjust_in 
            ${opnWhere}

            ORDER BY tgl ASC, id_transaksi ASC
          `;

          const allMutParams = [
            ...bmParams,
            ...bkParams,
            ...retParams,
            ...mvParams,
            ...trfParams,
            ...opnParams,
          ];

          const [mutRows] = await pool.query<RowDataPacket[]>(mutationsSql, allMutParams);

          // If no date filter is applied, and mutations are empty but tb_stock has stock, use stk.stock as initial
          if (!hasDateFilter && mutRows.length === 0 && Number(stk.stock) > 0) {
            stokAwal = Number(stk.stock) || 0;
          }

          let runningSaldo = stokAwal;
          let periodMasuk = 0;
          let periodKeluar = 0;
          let periodRetur = 0;
          let periodMove = 0;

          const mutations = mutRows.map((m) => {
            const inVal = Number(m.masuk) || 0;
            const outVal = Number(m.keluar) || 0;
            const returVal = Number(m.retur) || 0;
            const moveVal = Number(m.move) || 0;

            periodMasuk += inVal;
            periodKeluar += outVal;
            periodRetur += returVal;
            periodMove += moveVal;

            if (m.tipe_trx === 'RETUR_BARANG') {
              runningSaldo += returVal;
            } else {
              runningSaldo += inVal - outVal;
            }

            return {
              tgl: m.tgl,
              id_transaksi: m.id_transaksi || '-',
              tipe_trx: m.tipe_trx,
              masuk: inVal,
              keluar: outVal,
              retur: returVal,
              move: moveVal,
              saldo: runningSaldo,
              keterangan: m.keterangan || '',
            };
          });

          const stokAkhir = runningSaldo;

          grandTotalStokAwal += stokAwal;
          grandTotalMasuk += periodMasuk;
          grandTotalKeluar += periodKeluar;
          grandTotalRetur += periodRetur;
          grandTotalMove += periodMove;
          grandTotalStokAkhir += stokAkhir;

          return {
            id_bahan: idBahan,
            model: modelStr,
            ukuran: ukuranStr,
            uom: uomStr,
            id_cabang: idCabangStr,
            id_transaksi_stock: stkIdTransaksi,
            tgl_masuk: stkTglMasuk,
            nama_barang: `${idBahan} - ${modelStr} ${ukuranStr}`.trim(),
            stok_awal: stokAwal,
            total_masuk: periodMasuk,
            total_keluar: periodKeluar,
            total_retur: periodRetur,
            total_move: periodMove,
            stok_akhir: stokAkhir,
            total_mutasi: mutations.length,
            mutations,
          };
        } catch (itemErr) {
          console.error('Error processing stock card item:', stk, itemErr);
          return {
            id_bahan: stk.id_bahan || '',
            model: stk.model || '',
            ukuran: stk.ukuran || '',
            uom: stk.uom || 'PCS',
            id_cabang: stk.id_cabang || '',
            id_transaksi_stock: stk.id_transaksi_stock || '',
            tgl_masuk: stk.tgl_masuk || '',
            nama_barang: `${stk.id_bahan} - ${stk.model} ${stk.ukuran}`.trim(),
            stok_awal: 0,
            total_masuk: 0,
            total_keluar: 0,
            total_retur: 0,
            total_move: 0,
            stok_akhir: Number(stk.stock) || 0,
            total_mutasi: 0,
            mutations: [],
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        items: stockDetails,
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
          total_stok_awal: grandTotalStokAwal,
          total_masuk: grandTotalMasuk,
          total_keluar: grandTotalKeluar,
          total_retur: grandTotalRetur,
          total_move: grandTotalMove,
          total_stok_akhir: grandTotalStokAkhir,
        },
        filters: {
          tgl_from,
          tgl_to,
          tipe,
          model,
          ukuran,
          cabang,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Stock Card Detail error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data stock card detail.' },
      { status: 500 }
    );
  }
}
