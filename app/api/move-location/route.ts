import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Ensure tables for move location exist
async function ensureMoveLocationTablesExist() {
  // 1. Header table for Move Location transactions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tb_move_location (
      id_move VARCHAR(100) PRIMARY KEY,
      tgl_move DATETIME NOT NULL,
      id_location INT NOT NULL,
      nama_lokasi VARCHAR(255) NOT NULL,
      keterangan TEXT,
      total_qty INT NOT NULL DEFAULT 0,
      dibuat_oleh VARCHAR(100) DEFAULT '',
      id_cabang VARCHAR(100) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tgl (tgl_move),
      INDEX idx_location (id_location),
      INDEX idx_id_cabang (id_cabang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 2. Detail table for moved items in a transaction
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tb_move_location_detail (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_move VARCHAR(100) NOT NULL,
      id_bahan VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      ukuran VARCHAR(50) NOT NULL,
      nama_stock VARCHAR(255) NOT NULL,
      qty INT NOT NULL DEFAULT 0,
      uom VARCHAR(50) DEFAULT 'PCS',
      id_location INT NOT NULL,
      nama_lokasi VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_id_move (id_move),
      INDEX idx_item (id_bahan, model, ukuran),
      INDEX idx_location (id_location)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 3. Location Stock Tracking table for items allocated per location
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
      id_cabang VARCHAR(100) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_location_item (id_location, id_bahan, model, ukuran),
      INDEX idx_location (id_location),
      INDEX idx_nama_stock (nama_stock),
      INDEX idx_id_cabang (id_cabang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 4. Lock Location table (if used for location reservation/locking per branch)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tb_lock_location (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_location INT NOT NULL,
      nama_lokasi VARCHAR(255) NOT NULL,
      id_bahan VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      ukuran VARCHAR(50) NOT NULL,
      nama_stock VARCHAR(255) NOT NULL,
      qty INT NOT NULL DEFAULT 0,
      id_cabang VARCHAR(100) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_lock_item (id_location, id_bahan, model, ukuran),
      INDEX idx_location (id_location),
      INDEX idx_id_cabang (id_cabang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Safely ensure id_cabang column exists on existing tables
  try {
    await pool.query(`ALTER TABLE tb_move_location ADD COLUMN id_cabang VARCHAR(100) DEFAULT ''`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE tb_location_stock ADD COLUMN id_cabang VARCHAR(100) DEFAULT ''`);
  } catch (e) {}
  try {
    await pool.query(`ALTER TABLE tb_lock_location ADD COLUMN id_cabang VARCHAR(100) DEFAULT ''`);
  } catch (e) {}
}

// Generate unique move location ID: MVL-YYYYMMDD-XXXX
async function generateMoveId(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `MVL-${dateStr}-`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_move FROM tb_move_location WHERE id_move LIKE ? ORDER BY id_move DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0 && rows[0].id_move) {
    const parts = rows[0].id_move.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      seq = lastNum + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Helper to get logged-in user info
async function getLoggedInUserInfo(): Promise<{ userName: string; branch: string }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    if (!token) return { userName: 'Admin', branch: 'DEFAULT' };
    const payload = await verifySessionToken(token);
    return {
      userName: payload?.nm_user || payload?.id_user || 'Admin',
      branch: payload?.grup || payload?.branch || payload?.id_cabang || 'DEFAULT',
    };
  } catch {
    return { userName: 'Admin', branch: 'DEFAULT' };
  }
}

// GET /api/move-location
export async function GET(req: Request) {
  try {
    await ensureMoveLocationTablesExist();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // 1. Return stock options with available unallocated stock > 0
    if (action === 'stock-options') {
      const search = searchParams.get('search') || '';
      let sql = `
        SELECT 
          s.id_bahan, 
          s.model, 
          s.ukuran, 
          s.uom, 
          GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) AS stock 
        FROM tb_stock s
        LEFT JOIN (
          SELECT id_bahan, model, ukuran, SUM(qty) AS loc_qty
          FROM tb_location_stock
          GROUP BY id_bahan, model, ukuran
        ) loc ON s.id_bahan = loc.id_bahan AND s.model = loc.model AND s.ukuran = loc.ukuran
        WHERE GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) > 0
      `;
      const params: any[] = [];

      if (search.trim() !== '') {
        sql += ` AND (CONCAT(s.id_bahan, '-', s.model, '-', s.ukuran) LIKE ? OR s.id_bahan LIKE ? OR s.model LIKE ? OR s.ukuran LIKE ?)`;
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term);
      }

      sql += ` ORDER BY s.id_bahan ASC, s.model ASC, s.ukuran ASC LIMIT 200`;

      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      const data = rows.map((r) => ({
        id_bahan: r.id_bahan,
        model: r.model,
        ukuran: r.ukuran,
        nama_stock: `${r.id_bahan}-${r.model}-${r.ukuran}`,
        stock: Number(r.stock) || 0,
        uom: r.uom || 'PCS',
      }));

      return NextResponse.json({ success: true, data });
    }

    // 2. Return locations list from `location` table
    if (action === 'locations') {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, nama_lokasi FROM location ORDER BY nama_lokasi ASC`
      );
      return NextResponse.json({ success: true, data: rows });
    }

    // 3. Return tracked stock per location
    if (action === 'tracked-stock') {
      const id_location = searchParams.get('id_location') || '';
      const search = searchParams.get('search') || '';
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = Math.max(1, parseInt(searchParams.get('limit') || '15', 10));
      const offset = (page - 1) * limit;

      let whereSql = 'WHERE qty > 0';
      const params: any[] = [];

      if (id_location.trim() !== '') {
        whereSql += ' AND id_location = ?';
        params.push(parseInt(id_location, 10));
      }

      if (search.trim() !== '') {
        whereSql += ' AND (nama_stock LIKE ? OR nama_lokasi LIKE ? OR id_bahan LIKE ? OR model LIKE ? OR ukuran LIKE ?)';
        const term = `%${search.trim()}%`;
        params.push(term, term, term, term, term);
      }

      const countSql = `SELECT COUNT(*) as total FROM tb_location_stock ${whereSql}`;
      const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
      const total = Number(countRows[0]?.total) || 0;
      const totalPages = Math.ceil(total / limit) || 1;

      const dataSql = `
        SELECT id, id_location, nama_lokasi, id_bahan, model, ukuran, nama_stock, qty, id_cabang, created_at, updated_at
        FROM tb_location_stock
        ${whereSql}
        ORDER BY nama_lokasi ASC, nama_stock ASC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const [items] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

      return NextResponse.json({
        success: true,
        data: items,
        pagination: { page, limit, total, totalPages },
      });
    }

    // 4. Default: Return list of Move Location transactions
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || '';
    const search = searchParams.get('search') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '15', 10));
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

    if (effectiveBranch) {
      whereSql += ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereSql += ' AND (tgl_move BETWEEN ? AND ?)';
      params.push(`${tgl_from} 00:00:00`, `${tgl_to} 23:59:59`);
    } else if (tgl_from) {
      whereSql += ' AND tgl_move >= ?';
      params.push(`${tgl_from} 00:00:00`);
    } else if (tgl_to) {
      whereSql += ' AND tgl_move <= ?';
      params.push(`${tgl_to} 23:59:59`);
    }

    if (search.trim() !== '') {
      whereSql += ' AND (id_move LIKE ? OR nama_lokasi LIKE ? OR keterangan LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const countSql = `SELECT COUNT(*) as total FROM tb_move_location ${whereSql}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const total = Number(countRows[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const dataSql = `
      SELECT id_move, tgl_move, id_location, nama_lokasi, keterangan, total_qty, dibuat_oleh, id_cabang, created_at
      FROM tb_move_location
      ${whereSql}
      ORDER BY tgl_move DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];
    const [headers] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

    // Fetch details for each move transaction
    const transactions = await Promise.all(
      headers.map(async (h) => {
        const [details] = await pool.query<RowDataPacket[]>(
          `SELECT id, id_move, id_bahan, model, ukuran, nama_stock, qty, uom, id_location, nama_lokasi 
           FROM tb_move_location_detail 
           WHERE id_move = ? 
           ORDER BY id ASC`,
          [h.id_move]
        );
        return {
          ...h,
          items: details,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: { page, limit, total, totalPages },
    });
  } catch (error: any) {
    console.error('Fetch move location error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data pemindahan lokasi.' },
      { status: 500 }
    );
  }
}

// POST /api/move-location - Save new move location transaction
export async function POST(req: Request) {
  try {
    await ensureMoveLocationTablesExist();

    const body = await req.json();
    const { id_location, keterangan, items, id_cabang: bodyBranch } = body;

    if (!id_location) {
      return NextResponse.json(
        { success: false, message: 'Pilih lokasi tujuan pemindahan terlebih dahulu!' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Daftar barang yang akan dipindahkan tidak boleh kosong!' },
        { status: 400 }
      );
    }

    // 1. Verify location exists
    const [locRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, nama_lokasi FROM location WHERE id = ?`,
      [parseInt(id_location, 10)]
    );

    if (locRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Lokasi tujuan tidak ditemukan!' },
        { status: 400 }
      );
    }

    const targetLocation = locRows[0];
    const namaLokasi = targetLocation.nama_lokasi;

    // 2. Validate stock availability for all items
    let totalQty = 0;
    for (const item of items) {
      const { id_bahan, model, ukuran, qty } = item;
      const moveQty = parseInt(qty, 10);

      if (!id_bahan || !model || !ukuran) {
        return NextResponse.json(
          { success: false, message: 'Data barang tidak lengkap!' },
          { status: 400 }
        );
      }

      if (isNaN(moveQty) || moveQty <= 0) {
        return NextResponse.json(
          { success: false, message: `Jumlah pemindahan untuk ${id_bahan}-${model}-${ukuran} harus lebih dari 0!` },
          { status: 400 }
        );
      }

      // Check current available stock considering stock already moved to locations
      const [stkRows] = await pool.query<RowDataPacket[]>(
        `SELECT GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0)) AS available_stock 
         FROM tb_stock s
         LEFT JOIN (
           SELECT id_bahan, model, ukuran, SUM(qty) AS loc_qty
           FROM tb_location_stock
           GROUP BY id_bahan, model, ukuran
         ) loc ON s.id_bahan = loc.id_bahan AND s.model = loc.model AND s.ukuran = loc.ukuran
         WHERE s.id_bahan = ? AND s.model = ? AND s.ukuran = ?`,
        [id_bahan, model, ukuran]
      );

      const availableStock = stkRows.length > 0 ? Number(stkRows[0].available_stock) || 0 : 0;
      if (availableStock < moveQty) {
        const namaStock = `${id_bahan}-${model}-${ukuran}`;
        return NextResponse.json(
          {
            success: false,
            message: `Stok untuk ${namaStock} tidak mencukupi! Stok tersedia: ${availableStock} Pcs, diminta: ${moveQty} Pcs.`,
          },
          { status: 400 }
        );
      }

      totalQty += moveQty;
    }

    // 3. Process Transaction
    const idMove = await generateMoveId();
    const { userName: currentUser, branch: userBranch } = await getLoggedInUserInfo();
    const idCabang = bodyBranch || userBranch || 'DEFAULT';
    const now = new Date();

    // Insert Header
    await pool.query<ResultSetHeader>(
      `INSERT INTO tb_move_location 
        (id_move, tgl_move, id_location, nama_lokasi, keterangan, total_qty, dibuat_oleh, id_cabang)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idMove,
        now,
        targetLocation.id,
        namaLokasi,
        keterangan || '',
        totalQty,
        currentUser,
        idCabang,
      ]
    );

    // Insert Details & Update Stock Tables
    for (const item of items) {
      const { id_bahan, model, ukuran, qty, uom } = item;
      const moveQty = parseInt(qty, 10);
      const namaStock = `${id_bahan}-${model}-${ukuran}`;
      const itemUom = uom || 'PCS';

      // Insert detail
      await pool.query<ResultSetHeader>(
        `INSERT INTO tb_move_location_detail 
          (id_move, id_bahan, model, ukuran, nama_stock, qty, uom, id_location, nama_lokasi)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idMove,
          id_bahan,
          model,
          ukuran,
          namaStock,
          moveQty,
          itemUom,
          targetLocation.id,
          namaLokasi,
        ]
      );

      // Upsert into tb_location_stock (Location stock tracks moved items, which dynamically deducts available stock in POS)
      await pool.query(
        `INSERT INTO tb_location_stock 
          (id_location, nama_lokasi, id_bahan, model, ukuran, nama_stock, qty, id_cabang)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
          qty = qty + VALUES(qty),
          nama_lokasi = VALUES(nama_lokasi),
          id_cabang = VALUES(id_cabang),
          updated_at = CURRENT_TIMESTAMP`,
        [
          targetLocation.id,
          namaLokasi,
          id_bahan,
          model,
          ukuran,
          namaStock,
          moveQty,
          idCabang,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pemindahan lokasi berhasil disimpan dengan No. Transaksi ${idMove}!`,
      id_move: idMove,
    });
  } catch (error: any) {
    console.error('Save move location error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan pemindahan lokasi.' },
      { status: 500 }
    );
  }
}
