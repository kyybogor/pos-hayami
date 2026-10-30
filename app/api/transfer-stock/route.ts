import { NextResponse, NextRequest } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';
import { RowDataPacket } from 'mysql2';

// Ensure tables transfer_stock and transfer_stock_detail exist
async function ensureTransferTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transfer_stock (
      id_transfer VARCHAR(100) PRIMARY KEY,
      tgl_transfer DATETIME NOT NULL,
      tujuan VARCHAR(150) NOT NULL,
      keterangan TEXT,
      total_qty INT NOT NULL DEFAULT 0,
      dibuat_oleh VARCHAR(100) DEFAULT '',
      id_cabang VARCHAR(100) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tgl (tgl_transfer),
      INDEX idx_tujuan (tujuan),
      INDEX idx_id_cabang (id_cabang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transfer_stock_detail (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_transfer VARCHAR(100) NOT NULL,
      id_bahan VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      ukuran VARCHAR(50) NOT NULL,
      qty INT NOT NULL DEFAULT 0,
      uom VARCHAR(50) DEFAULT 'PCS',
      INDEX idx_id_transfer (id_transfer),
      INDEX idx_item (id_bahan, model, ukuran)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  try {
    await pool.query(`ALTER TABLE transfer_stock ADD COLUMN id_cabang VARCHAR(100) DEFAULT ''`);
  } catch (e) {}
}

// GET: Fetch transfer transactions list with pagination and filters
export async function GET(req: Request) {
  try {
    await ensureTransferTablesExist();

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const { searchParams } = new URL(req.url);
    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || '';
    const search = searchParams.get('search') || searchParams.get('q') || '';
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
      whereSql += ' AND (tgl_transfer BETWEEN ? AND ?)';
      params.push(`${tgl_from} 00:00:00`, `${tgl_to} 23:59:59`);
    } else if (tgl_from) {
      whereSql += ' AND tgl_transfer >= ?';
      params.push(`${tgl_from} 00:00:00`);
    } else if (tgl_to) {
      whereSql += ' AND tgl_transfer <= ?';
      params.push(`${tgl_to} 23:59:59`);
    }

    if (search.trim() !== '') {
      whereSql += ' AND (id_transfer LIKE ? OR tujuan LIKE ? OR keterangan LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total_count FROM transfer_stock ${whereSql}`;
    const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
    const totalItems = Number(countRows[0]?.total_count) || 0;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Data query
    const dataSql = `
      SELECT id_transfer, tgl_transfer, tujuan, keterangan, total_qty, dibuat_oleh, id_cabang, created_at
      FROM transfer_stock
      ${whereSql}
      ORDER BY tgl_transfer DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const [headerRows] = await pool.query<RowDataPacket[]>(dataSql, dataParams);

    // Fetch details for each transaction
    const transactions = await Promise.all(
      headerRows.map(async (row) => {
        const [detailRows] = await pool.query<RowDataPacket[]>(
          `SELECT id, id_transfer, id_bahan, model, ukuran, qty, uom 
           FROM transfer_stock_detail 
           WHERE id_transfer = ? 
           ORDER BY id ASC`,
          [row.id_transfer]
        );

        return {
          id_transfer: row.id_transfer,
          tgl_transfer: row.tgl_transfer,
          tujuan: row.tujuan || '',
          keterangan: row.keterangan || '',
          total_qty: Number(row.total_qty) || 0,
          dibuat_oleh: row.dibuat_oleh || '',
          id_cabang: row.id_cabang || '',
          items: detailRows.map((d) => ({
            id: d.id,
            id_bahan: d.id_bahan || '',
            model: d.model || '',
            ukuran: d.ukuran || '',
            qty: Number(d.qty) || 0,
            uom: d.uom || 'PCS',
            nama_barang: `${d.id_bahan || ''}-${d.model || ''}-${d.ukuran || ''}`,
          })),
        };
      })
    );

    // Summary stats
    const [[todayRows], [sumQtyRows]] = await Promise.all([
      pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as today_count FROM transfer_stock WHERE DATE(tgl_transfer) = CURDATE()'
      ),
      pool.query<RowDataPacket[]>(
        'SELECT SUM(total_qty) as sum_qty FROM transfer_stock'
      ),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: transactions,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
        },
        summary: {
          total_transaksi: totalItems,
          today_transaksi: Number(todayRows[0]?.today_count) || 0,
          grand_total_qty: Number(sumQtyRows[0]?.sum_qty) || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Transfer Stock error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data transfer stock.' },
      { status: 500 }
    );
  }
}

// POST: Create new Transfer Stock transaction and deduct stock in tb_stock
export async function POST(req: NextRequest) {
  try {
    await ensureTransferTablesExist();

    const body = await req.json().catch(() => ({}));
    const {
      tgl_transfer = new Date().toISOString().split('T')[0],
      tujuan = '',
      keterangan = '',
      items = [],
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Daftar barang transfer tidak boleh kosong!' },
        { status: 400 }
      );
    }

    // Extract logged in user & user's branch
    let createdBy = 'admin';
    let userGrup = 'JATINEGARA';

    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('pos_session')?.value;
      if (token) {
        const session = await verifySessionToken(token);
        if (session) {
          createdBy = session.id_user || session.nm_user || 'admin';
          userGrup = session.grup || session.branch || 'JATINEGARA';
        }
      }
    } catch (e) {
      console.error('Session verify error in transfer-stock POST:', e);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Verify stock availability for all items before deducting
      for (const item of items) {
        const idBahan = item.id_bahan || '';
        const modelStr = item.model || '';
        const ukuranStr = item.ukuran || '';
        const qtyReq = Number(item.qty) || 0;

        if (qtyReq <= 0) {
          await connection.rollback();
          return NextResponse.json(
            {
              success: false,
              message: `Jumlah transfer untuk item ${idBahan}-${modelStr} (${ukuranStr}) harus lebih dari 0.`,
            },
            { status: 400 }
          );
        }

        const [stockRows] = await connection.query<RowDataPacket[]>(
          `SELECT stock FROM tb_stock WHERE id_bahan = ? AND model = ? AND ukuran = ?`,
          [idBahan, modelStr, ukuranStr]
        );

        const currentStock = Number(stockRows[0]?.stock || 0);

        if (stockRows.length === 0 || currentStock < qtyReq) {
          await connection.rollback();
          return NextResponse.json(
            {
              success: false,
              message: `Stock tidak mencukupi untuk item ${idBahan}-${modelStr} (${ukuranStr})! Sisa stock saat ini: ${currentStock} pcs, dipinta transfer: ${qtyReq} pcs.`,
            },
            { status: 400 }
          );
        }
      }

      // 2. Generate unique ID (e.g. TRF-JTG/2609/0001)
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const branchCode = getBranchCode(userGrup);

      const pattern = `TRF-${branchCode}/${mm}${yy}/%`;
      const [seqRows] = await connection.query<RowDataPacket[]>(
        `SELECT MAX(id_transfer) as maxId FROM transfer_stock WHERE id_transfer LIKE ?`,
        [pattern]
      );

      let seq = 1;
      if (seqRows.length > 0 && seqRows[0].maxId) {
        const lastId = String(seqRows[0].maxId);
        const match = lastId.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num)) seq = num + 1;
        }
      }

      const idTransfer = `TRF-${branchCode}/${mm}${yy}/${String(seq).padStart(4, '0')}`;

      let totalQty = 0;
      for (const item of items) {
        totalQty += Number(item.qty) || 0;
      }

      const formattedTgl = `${tgl_transfer} ${now.toTimeString().split(' ')[0]}`;

      const idCabang = userGrup || 'DEFAULT';

      // 3. Insert Header Table (transfer_stock)
      await connection.query(
        `INSERT INTO transfer_stock (id_transfer, tgl_transfer, tujuan, keterangan, total_qty, dibuat_oleh, id_cabang)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [idTransfer, formattedTgl, tujuan.trim(), keterangan.trim(), totalQty, createdBy, idCabang]
      );

      // 4. Insert Detail Table (transfer_stock_detail) & Update tb_stock
      for (const item of items) {
        const idBahan = item.id_bahan || '';
        const modelStr = item.model || '';
        const ukuranStr = item.ukuran || '';
        const qtyReq = Number(item.qty) || 0;
        const uomStr = item.uom || 'PCS';

        await connection.query(
          `INSERT INTO transfer_stock_detail (id_transfer, id_bahan, model, ukuran, qty, uom)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [idTransfer, idBahan, modelStr, ukuranStr, qtyReq, uomStr]
        );

        // Deduct stock in tb_stock
        await connection.query(
          `UPDATE tb_stock SET stock = stock - ? WHERE id_bahan = ? AND model = ? AND ukuran = ?`,
          [qtyReq, idBahan, modelStr, ukuranStr]
        );
      }

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: `Transaksi Transfer Stock (${idTransfer}) berhasil dibuat & stock lokal telah diperbarui!`,
        id_transfer: idTransfer,
      });
    } catch (dbErr: any) {
      await connection.rollback();
      console.error('Transfer stock transaction DB error:', dbErr);
      return NextResponse.json(
        { success: false, message: 'Gagal menyimpan transaksi transfer stock: ' + (dbErr.message || String(dbErr)) },
        { status: 500 }
      );
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.error('Transfer stock POST error:', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan pada server database.' },
      { status: 500 }
    );
  }
}
