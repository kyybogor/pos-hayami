import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Helper to generate Next Header Opname ID (e.g. OP-JTG-2609000001)
async function generateNextOpnameId(branchCode: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefixPattern = `OP-${branchCode}-${yy}${mm}%`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(id_inv_in) as maxId FROM inv_adjust_in WHERE id_inv_in LIKE ? OR id_inv_in LIKE ?`,
    [prefixPattern, `OP-${yy}${mm}%`]
  );

  let sequence = 1;
  if (rows.length > 0 && rows[0].maxId) {
    const lastId = String(rows[0].maxId);
    const match = lastId.match(/\d+$/);
    if (match) {
      const numPart = parseInt(match[0], 10);
      if (!isNaN(numPart)) {
        sequence = numPart + 1;
      }
    }
  }

  return `OP-${branchCode}-${yy}${mm}${String(sequence).padStart(6, '0')}`;
}

// Helper to generate Line Item Opname ID (e.g. IP-JTG-2609000001)
async function generateNextLineOpnameId(branchCode: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefixPattern = `IP-${branchCode}-${mm}${yy}%`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(inv_in_id) as maxId FROM inv_adjust_in WHERE inv_in_id LIKE ? OR inv_in_id LIKE ?`,
    [prefixPattern, `IP${mm}${yy}%`]
  );

  let sequence = 1;
  if (rows.length > 0 && rows[0].maxId) {
    const lastId = String(rows[0].maxId);
    const match = lastId.match(/\d+$/);
    if (match) {
      const numPart = parseInt(match[0], 10);
      if (!isNaN(numPart)) {
        sequence = numPart + 1;
      }
    }
  }

  return `IP-${branchCode}-${mm}${yy}${String(sequence).padStart(6, '0')}`;
}

// POST /api/opname/save
export async function POST(req: Request) {
  const connection = await pool.getConnection();
  try {
    const body = await req.json();
    let {
      id_inv_in,
      inv_date,
      keterangan,
      status, // 'd' (Draft) or 's' (Close / Authorized)
      items, // array of { inv_in_id, id_product, model, ukuran, uom, stock_awal, stock_change }
      id_cabang,
      create_by,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Detail barang opname tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const formattedDate = inv_date || todayStr;
    const currentStatus = status === 's' ? 's' : 'd';
    
    let branch = id_cabang || '';
    if (!branch) {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('pos_session')?.value;
        if (token) {
          const session = await verifySessionToken(token);
          if (session) {
            branch = session.grup || session.branch || '';
          }
        }
      } catch (e) {}
    }
    if (!branch) {
      branch = 'TKA-JATINEGARA-JAKARTA';
    }

    const branchCode = getBranchCode(branch);

    await connection.beginTransaction();

    // Generate new Header ID if empty or 'new'
    const isNew = !id_inv_in || id_inv_in === 'new';
    if (isNew) {
      id_inv_in = await generateNextOpnameId(branchCode);
    }

    // Delete existing lines for this header before re-inserting items
    if (!isNew) {
      // Check if it was already authorized
      const [existingStatusRows] = await connection.query<RowDataPacket[]>(
        `SELECT status FROM inv_adjust_in WHERE id_inv_in = ? LIMIT 1`,
        [id_inv_in]
      );
      if (existingStatusRows.length > 0 && existingStatusRows[0].status === 's') {
        await connection.rollback();
        return NextResponse.json(
          { success: false, message: 'Transaksi yang sudah di-otorisasi (Close) tidak dapat diubah kembali.' },
          { status: 400 }
        );
      }

      await connection.query(`DELETE FROM inv_adjust_in WHERE id_inv_in = ?`, [id_inv_in]);
    }

    // Insert line items
    const nowFormatted = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const item of items) {
      let inv_in_id = item.inv_in_id;
      if (!inv_in_id || inv_in_id === 'new') {
        inv_in_id = await generateNextLineOpnameId(branchCode);
      }

      const id_product = item.id_product || item.nama_bahan || '';
      const model = item.model || 'Diskon';
      const ukuran = item.ukuran || '';
      const uom = item.uom || 'PCS';
      const stock_awal = Number(item.stock_awal) || 0;
      const stock_change = Number(item.stock_change) || 0;
      const stock_opname = stock_change - stock_awal; // delta

      await connection.query(
        `INSERT INTO inv_adjust_in (
          inv_in_id,
          id_inv_in,
          inv_date,
          status,
          id_product,
          model,
          ukuran,
          uom,
          stock_awal,
          stock_change,
          stock_opname,
          keterangan,
          create_by,
          create_date,
          id_cabang,
          by_user_pajak
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inv_in_id,
          id_inv_in,
          formattedDate,
          currentStatus,
          id_product,
          model,
          ukuran,
          uom,
          stock_awal,
          stock_change,
          stock_opname,
          keterangan || '',
          create_by || 'admin',
          nowFormatted,
          branch,
          '1',
        ]
      );
    }

    // IF AUTHORIZED ('s'): Execute stock updates
    if (currentStatus === 's') {
      const [allOpnameLines] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM inv_adjust_in WHERE id_inv_in = ?`,
        [id_inv_in]
      );

      for (const line of allOpnameLines) {
        const delta = Number(line.stock_opname) || 0;
        const productName = line.id_product;
        const modelStr = line.model || '';
        const ukuranStr = line.ukuran || '';
        const uomStr = line.uom || 'PCS';

        // 1. Update tb_stock
        await connection.query(
          `UPDATE tb_stock 
           SET stock = stock + ?, sts = '0' 
           WHERE (id_bahan = ? OR id_bahan IN (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?)) 
             AND model = ? AND ukuran = ? AND uom = ?`,
          [delta, productName, productName, modelStr, ukuranStr, uomStr]
        );

        // 2. Update tb_bahan
        const qtyDozens = Math.round((delta / 12) * 100) / 100;
        await connection.query(
          `UPDATE tb_bahan 
           SET total_qty = total_qty + ?, total_pcs = total_pcs + ?, sts = '0' 
           WHERE nama_bahan = ? OR id_bahan = ?`,
          [qtyDozens, delta, productName, productName]
        );
      }
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: currentStatus === 's' ? 'Simpan & Otorisasi berhasil!' : 'Simpan Draft berhasil!',
      id_inv_in,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Save opname error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan transaksi Stock Opname.' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
