import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';
import { RowDataPacket } from 'mysql2';

// Helper to generate Next Retur Transaction Key (e.g. RTO-JTG/0926/0001)
async function generateReturKey(prefix: string, branchCode: string): Promise<string> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const pattern = `${prefix}-${branchCode}/${mm}${yy}/%`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(id_transaksi) as maxId FROM tb_retur WHERE id_transaksi LIKE ? OR id_transaksi LIKE ?`,
    [pattern, `${prefix}/${mm}${yy}/%`]
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

  return `${prefix}-${branchCode}/${mm}${yy}/${String(sequence).padStart(4, '0')}`;
}

// Helper to generate Next Retur Line Item ID (e.g. NR-JTG-0926000001)
async function generateReturLineId(branchCode: string): Promise<string> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `NR-${branchCode}-${mm}${yy}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT no_id FROM tb_retur WHERE no_id LIKE ?`,
    [`${prefix}%`]
  );

  let sequence = 1;
  let maxFound = 0;
  for (const row of rows) {
    const idStr = String(row.no_id || '');
    if (idStr.startsWith(prefix)) {
      const suffix = idStr.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num < 1000000 && num > maxFound) {
          maxFound = num;
        }
      }
    }
  }
  sequence = maxFound + 1;

  let candidate = `${prefix}${String(sequence).padStart(6, '0')}`;
  let attempts = 0;
  while (attempts < 1000) {
    const [exist] = await pool.query<RowDataPacket[]>(
      `SELECT no_id FROM tb_retur WHERE no_id = ? LIMIT 1`,
      [candidate]
    );
    if (exist.length === 0) break;
    sequence++;
    candidate = `${prefix}${String(sequence).padStart(6, '0')}`;
    attempts++;
  }

  return candidate;
}

// Helper to generate Petty Cash ID (e.g. PTY-JTG-26-000001)
async function generatePettyCashId(branchCode: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const prefixPattern = `PTY-${branchCode}-${yy}-%`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(id_petty) as maxId FROM tb_petty_cash WHERE id_petty LIKE ? OR id_petty LIKE ?`,
    [prefixPattern, `PTY-${yy}-%`]
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

  return `PTY-${branchCode}-${yy}-${String(sequence).padStart(6, '0')}`;
}

// POST /api/retur-barang/save
export async function POST(req: Request) {
  const connection = await pool.getConnection();
  try {
    const body = await req.json();
    let {
      id_transaksi,
      tgl_transaksi,
      id_customer,
      sales,
      akun,
      keterangan,
      status_keluar, // 'd' (Draft) or 's' (Close / Authorized)
      items, // array of { no_id, invret, id_bahan, model, ukuran, qty, uom, harga }
      id_cabang,
      create_by,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Detail barang retur tidak boleh kosong.' },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const formattedDate = tgl_transaksi || todayStr;
    const currentStatus = status_keluar === 's' ? 's' : 'd';
    
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
    const userStr = create_by || 'admin';
    const custId = (id_customer || 'CASH').split(' | ')[0].trim();
    const accountStr = akun || 'CASH';
    const salesStr = sales || '';

    await connection.beginTransaction();

    // Generate new Retur Transaction Key if empty or 'new'
    const isNew = !id_transaksi || id_transaksi === 'new';
    if (isNew) {
      id_transaksi = await generateReturKey('RTO', branchCode);
    }

    // Delete existing lines if updating existing draft
    if (!isNew) {
      const [existingStatusRows] = await connection.query<RowDataPacket[]>(
        `SELECT status_keluar FROM tb_retur WHERE id_transaksi = ? LIMIT 1`,
        [id_transaksi]
      );
      if (existingStatusRows.length > 0 && existingStatusRows[0].status_keluar === 's') {
        await connection.rollback();
        return NextResponse.json(
          { success: false, message: 'Transaksi retur yang sudah di-otorisasi (Close) tidak dapat diubah kembali.' },
          { status: 400 }
        );
      }

      await connection.query(`DELETE FROM tb_retur WHERE id_transaksi = ?`, [id_transaksi]);
    }

    // Calculate total values
    let totalSubtotal = 0;
    const formattedNow = new Date().toISOString().slice(0, 19).replace('T', ' ');

    for (const item of items) {
      let no_id = item.no_id;
      if (!no_id || no_id === 'new' || no_id.startsWith('new_')) {
        no_id = await generateReturLineId(branchCode);
      }

      const idBahan = item.id_bahan || item.nama_bahan;
      const modelStr = item.model || 'Diskon';
      const ukuranStr = item.ukuran || '';
      const uomStr = item.uom || 'PCS';
      const qty = Number(item.qty) || 0;
      const harga = Number(item.harga) || 0;
      const subtotal = qty * harga;
      totalSubtotal += subtotal;

      await connection.query(
        `INSERT INTO tb_retur (
          no_id,
          id_transaksi,
          invret,
          tgl_transaksi,
          id_customer,
          id_bahan,
          model,
          ukuran,
          qty,
          uom,
          harga,
          subtotal,
          total,
          keterangan,
          status_keluar,
          sales,
          akun,
          dibuat_oleh,
          dibuat_tgl,
          id_cabang,
          by_user_pajak
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          no_id,
          id_transaksi,
          item.invret || '',
          formattedDate,
          custId,
          idBahan,
          modelStr,
          ukuranStr,
          qty,
          uomStr,
          harga,
          subtotal,
          subtotal,
          keterangan || '',
          currentStatus,
          salesStr,
          accountStr,
          userStr,
          formattedNow,
          branch,
          '1',
        ]
      );
    }

    // Update total amount on all rows of this transaction
    await connection.query(
      `UPDATE tb_retur SET total = ? WHERE id_transaksi = ?`,
      [totalSubtotal, id_transaksi]
    );

    // IF AUTHORIZED ('s'): Execute stock update & petty cash
    if (currentStatus === 's') {
      const [allReturLines] = await connection.query<RowDataPacket[]>(
        `SELECT * FROM tb_retur WHERE id_transaksi = ?`,
        [id_transaksi]
      );

      for (const line of allReturLines) {
        const qtyToAdjust = Number(line.qty) || 0;
        const idBahan = line.id_bahan;
        const modelStr = line.model || 'Diskon';
        const ukuranStr = line.ukuran || '';
        const uomStr = line.uom || 'PCS';

        if (custId !== 'Hayami') {
          // Customer return -> Stock increases
          await connection.query(
            `UPDATE tb_stock 
             SET stock_retur = stock_retur + ?, sts = '0' 
             WHERE (id_bahan = ? OR id_bahan IN (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?)) 
               AND model = ? AND ukuran = ? AND id_cabang = ?`,
            [qtyToAdjust, idBahan, idBahan, modelStr, ukuranStr, branch]
          );
        } else {
          // Return to warehouse -> Stock decreases
          await connection.query(
            `UPDATE tb_stock 
             SET stock_retur = stock_retur - ?, sts = '0' 
             WHERE (id_bahan = ? OR id_bahan IN (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?)) 
               AND model = ? AND ukuran = ? AND id_cabang = ?`,
            [qtyToAdjust, idBahan, idBahan, modelStr, ukuranStr, branch]
          );
        }
      }

      // Log petty cash out entry if customer is not Hayami
      if (custId !== 'Hayami') {
        const pettyId = await generatePettyCashId(branchCode);
        await connection.query(
          `INSERT INTO tb_petty_cash (
            id_petty, tgl, keterangan, out_cash, dibuat_oleh, dibuat_tgl, id_cabang
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pettyId,
            formattedDate,
            `Retur ${id_transaksi} Customer ${custId}`,
            totalSubtotal,
            userStr,
            formattedNow,
            branch,
          ]
        );
      }

      // Mark original sales invoices in tb_barang_keluar as 'Retur'
      for (const line of allReturLines) {
        if (line.invret && line.invret.trim() !== '') {
          await connection.query(
            `UPDATE tb_barang_keluar SET status = 'Retur' WHERE id_transaksi = ?`,
            [line.invret.trim()]
          );
        }
      }
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: currentStatus === 's' ? 'Simpan & Otorisasi Retur berhasil!' : 'Simpan Draft Retur berhasil!',
      id_transaksi,
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Save retur barang error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menyimpan transaksi retur barang.' },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
