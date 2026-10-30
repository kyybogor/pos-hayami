import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface CartItemInput {
  id_bahan: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  subtotal: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cart,
      id_customer = 'CASH',
      sales = '',
      keterangan = '',
      akun = 'CASH',
      disc_invoice = 0,
      diskon_lusin_total = 0,
      cash_amount = 0,
      top_hari = 0,
      top = 0,
    } = body;

    const cartItems: CartItemInput[] = cart || [];

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Keranjang belanja kosong.' },
        { status: 400 }
      );
    }

    // Extract logged-in user & user's branch/group from session / tb_user
    let createdBy = 'admin';
    let userGrup = '';

    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('pos_session')?.value;
      if (token) {
        const session = await verifySessionToken(token);
        if (session) {
          createdBy = session.id_user || session.nm_user || 'admin';
          userGrup = session.grup || session.branch || '';
        }
      }
    } catch (e) {
      console.error('Session verify error in checkout:', e);
    }

    // Query tb_user directly if userGrup is not set or empty
    if (!userGrup || userGrup === '1') {
      try {
        const [uRows] = await pool.query<RowDataPacket[]>(
          'SELECT grup FROM tb_user WHERE id_user = ? OR nm_user = ? LIMIT 1',
          [createdBy, createdBy]
        );
        if (uRows.length > 0 && uRows[0].grup) {
          userGrup = uRows[0].grup;
        }
      } catch (e) {
        console.error('Fetch tb_user grup error:', e);
      }
    }

    if (!userGrup) {
      userGrup = 'TKA-JATINEGARA-JAKARTA';
    }

    const branchCode = getBranchCode(userGrup);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. STRICT STOCK CHECK BEFORE DEDUCTION (Subtracting stock allocated in tb_location_stock)
      for (const item of cartItems) {
        const [stockRows] = await connection.query<RowDataPacket[]>(
          `SELECT SUM(GREATEST(0, s.stock - COALESCE(loc.loc_qty, 0))) AS total_available 
           FROM tb_stock s
           LEFT JOIN (
             SELECT id_bahan, model, ukuran, SUM(qty) AS loc_qty
             FROM tb_location_stock
             GROUP BY id_bahan, model, ukuran
           ) loc ON s.id_bahan = loc.id_bahan AND s.model = loc.model AND s.ukuran = loc.ukuran
           WHERE s.id_bahan = ? AND s.model = ? AND s.ukuran = ?`,
          [item.id_bahan, item.model, item.ukuran]
        );

        const currentStock = Number(stockRows[0]?.total_available || 0);

        if (currentStock <= 0 || item.qty > currentStock) {
          await connection.rollback();
          return NextResponse.json(
            {
              success: false,
              message: `Stock tidak mencukupi! Barang ${item.id_bahan} - ${item.model} (${item.ukuran}) sisa ${currentStock} pcs (sudah dikurangi lokasi), permintaan: ${item.qty} pcs.`,
            },
            { status: 400 }
          );
        }
      }

      // 2. GENERATE TRANSACTION ID (e.g. SO-JTG/2609/0001)
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);

      const [setupRows] = await connection.query<RowDataPacket[]>(
        `SELECT ket3 FROM tb_setup WHERE nama_setup = 'SO' AND ket1 = ? AND ket2 = ?`,
        [mm, yy]
      );

      let seqNo = 1;
      if (setupRows.length > 0 && setupRows[0].ket3) {
        seqNo = Number(setupRows[0].ket3);
      } else {
        const [maxSoRows] = await connection.query<RowDataPacket[]>(
          `SELECT id_transaksi FROM tb_barang_keluar WHERE id_transaksi LIKE ?`,
          [`SO-${branchCode}/${yy}${mm}/%`]
        );
        let maxFoundSo = 0;
        for (const row of maxSoRows) {
          const parts = String(row.id_transaksi || '').split('/');
          const numStr = parts[parts.length - 1];
          if (/^\d+$/.test(numStr)) {
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxFoundSo) maxFoundSo = num;
          }
        }
        seqNo = maxFoundSo + 1;
      }

      // Collision check to guarantee unique id_transaksi
      let id_transaksi = `SO-${branchCode}/${yy}${mm}/${String(seqNo).padStart(4, '0')}`;
      let checkSoAttempts = 0;
      while (checkSoAttempts < 1000) {
        const [soExist] = await connection.query<RowDataPacket[]>(
          `SELECT id_transaksi FROM tb_barang_keluar WHERE id_transaksi = ? LIMIT 1`,
          [id_transaksi]
        );
        if (soExist.length === 0) {
          break;
        }
        seqNo++;
        id_transaksi = `SO-${branchCode}/${yy}${mm}/${String(seqNo).padStart(4, '0')}`;
        checkSoAttempts++;
      }

      // Update next SO sequence in tb_setup
      const nextSoSeq = seqNo + 1;
      if (setupRows.length > 0) {
        await connection.query(
          `UPDATE tb_setup SET ket3 = ? WHERE nama_setup = 'SO' AND ket1 = ? AND ket2 = ?`,
          [nextSoSeq, mm, yy]
        );
      } else {
        await connection.query(
          `INSERT INTO tb_setup (nama_setup, ket1, ket2, ket3) VALUES ('SO', ?, ?, ?)`,
          [mm, yy, nextSoSeq]
        );
      }

      // Calculate total subtotal
      let grandSubtotal = 0;
      cartItems.forEach((i) => {
        grandSubtotal += i.subtotal;
      });

      const grandTotalCalculated = Math.max(0, grandSubtotal - (diskon_lusin_total + disc_invoice));

      const upperAkun = String(akun || 'CASH').trim().toUpperCase();
      const isHutang = upperAkun === 'HUTANG' || upperAkun.startsWith('HUTANG');
      const statusTx = isHutang ? 'Belum Lunas' : 'Lunas';
      const sisaBayar = isHutang ? 0 : grandTotalCalculated;
      const cashVal = isHutang ? 0 : (cash_amount || grandTotalCalculated);
      const akunValue = isHutang ? 'HUTANG' : akun;

      // Extract TOP days as integer number (saved into jatuh_tempo column)
      const parsedTop = parseInt(String(top_hari || top || 0), 10);
      const topDays = isHutang ? (parsedTop > 0 ? parsedTop : 30) : 0;
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const getLocalDateTimeStr = (d = new Date()) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      const getLocalDateStr = (d = new Date()) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      const tglTransaksiStr = getLocalDateTimeStr(now);
      const tglJatuhTempoStr = isHutang
        ? getLocalDateStr(new Date(now.getTime() + topDays * 24 * 60 * 60 * 1000))
        : getLocalDateStr(now);

      // Generate unique base row ID sequence for line items (e.g. IK-TKA-JATINEGARA-JAKARTA-0926000001)
      const ikPrefix = `IK-${branchCode}-${mm}${yy}`;
      const setupKeyIK = `IK_${branchCode}`;

      const [ikSetupRows] = await connection.query<RowDataPacket[]>(
        `SELECT ket3 FROM tb_setup WHERE nama_setup = ? AND ket1 = ? AND ket2 = ?`,
        [setupKeyIK, mm, yy]
      );

      let startIkSeq = 1;
      if (ikSetupRows.length > 0 && ikSetupRows[0].ket3) {
        startIkSeq = Number(ikSetupRows[0].ket3);
      } else {
        // Query existing matching rows to find valid max sequence
        const [existingIkRows] = await connection.query<RowDataPacket[]>(
          `SELECT no_id FROM tb_barang_keluar WHERE no_id LIKE ?`,
          [`${ikPrefix}%`]
        );

        let maxFoundIk = 0;
        for (const row of existingIkRows) {
          const idStr = String(row.no_id || '');
          if (idStr.startsWith(ikPrefix)) {
            const suffix = idStr.slice(ikPrefix.length);
            if (/^\d+$/.test(suffix)) {
              const num = parseInt(suffix, 10);
              // Ignore corrupted numbers >= 1,000,000 (such as 0926926000007)
              if (!isNaN(num) && num < 1000000 && num > maxFoundIk) {
                maxFoundIk = num;
              }
            }
          }
        }
        startIkSeq = maxFoundIk + 1;
      }

      // Generate non-conflicting IDs for each item in cart
      let currentIkSeq = startIkSeq;
      const assignedRowNoIds: string[] = [];

      for (let idx = 0; idx < cartItems.length; idx++) {
        let candidateId = `${ikPrefix}${String(currentIkSeq).padStart(6, '0')}`;
        let ikAttempts = 0;

        while (ikAttempts < 1000) {
          const [checkExist] = await connection.query<RowDataPacket[]>(
            `SELECT no_id FROM tb_barang_keluar WHERE no_id = ? LIMIT 1`,
            [candidateId]
          );
          if (checkExist.length === 0 && !assignedRowNoIds.includes(candidateId)) {
            break;
          }
          currentIkSeq++;
          candidateId = `${ikPrefix}${String(currentIkSeq).padStart(6, '0')}`;
          ikAttempts++;
        }

        assignedRowNoIds.push(candidateId);
        currentIkSeq++;
      }

      // Update next IK sequence in tb_setup
      const nextIkSeq = currentIkSeq;
      if (ikSetupRows.length > 0) {
        await connection.query(
          `UPDATE tb_setup SET ket3 = ? WHERE nama_setup = ? AND ket1 = ? AND ket2 = ?`,
          [nextIkSeq, setupKeyIK, mm, yy]
        );
      } else {
        await connection.query(
          `INSERT INTO tb_setup (nama_setup, ket1, ket2, ket3) VALUES (?, ?, ?, ?)`,
          [setupKeyIK, mm, yy, nextIkSeq]
        );
      }

      // 3. INSERT ITEMS & DEDUCT STOCK
      for (let idx = 0; idx < cartItems.length; idx++) {
        const item = cartItems[idx];
        const rowNoId = assignedRowNoIds[idx];

        // Insert line item into tb_barang_keluar (using session user's grup as id_cabang)
        await connection.query(
          `INSERT INTO tb_barang_keluar (
            no_id, id_transaksi, tgl_transaksi, id_customer, sales, keterangan,
            id_bahan, model, ukuran, qty, uom, harga, subtotal, total,
            disc, disc_invoice, status_keluar, jatuh_tempo, tgl_jatuh_tempo,
            by_user_pajak, non_stock, sisa_bayar, cash, status, akun,
            dibuat_oleh, dibuat_tgl, id_cabang, sts, sts_void
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 's', ?, ?, 1, 0, ?, ?, ?, ?, ?, CURDATE(), ?, 0, 0)`,
          [
            rowNoId,
            id_transaksi,
            tglTransaksiStr,
            id_customer,
            sales,
            keterangan,
            item.id_bahan,
            item.model,
            item.ukuran,
            item.qty,
            item.uom || 'PCS',
            item.harga,
            item.subtotal,
            grandTotalCalculated,
            diskon_lusin_total,
            disc_invoice,
            topDays,
            tglJatuhTempoStr,
            sisaBayar,
            cashVal,
            statusTx,
            akunValue,
            createdBy,
            userGrup,
          ]
        );

        // Deduct from tb_stock
        await connection.query(
          `UPDATE tb_stock 
           SET stock = stock - ? 
           WHERE id_bahan = ? AND model = ? AND ukuran = ?`,
          [item.qty, item.id_bahan, item.model, item.ukuran]
        );

        // Deduct summary stock from tb_bahan
        const qtyLusin = Number((item.qty / 12).toFixed(2));
        await connection.query(
          `UPDATE tb_bahan 
           SET total_qty = total_qty - ?, total_pcs = total_pcs - ? 
           WHERE nama_bahan = ?`,
          [qtyLusin, item.qty, item.id_bahan]
        );
      }

      // 4. INSERT PAYMENT ENTRY (if not HUTANG)
      if (!isHutang) {
        await connection.query(
          `INSERT INTO tb_pembayaran (
            no_id, id_pembayaran, tgl_bayar, metode, nominal, keterangan, dibuat_oleh, dibuat_tgl, id_cabang
          ) VALUES ('', ?, CURDATE(), ?, ?, ?, ?, NOW(), ?)`,
          [
            id_transaksi,
            akun,
            cash_amount || grandTotalCalculated,
            `Pembayaran POS Transaksi ${id_transaksi} (${id_customer})`,
            createdBy,
            userGrup,
          ]
        );
      }

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Transaksi POS berhasil disimpan!',
        id_transaksi,
      });
    } catch (err: any) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('Error in POS checkout:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses transaksi POS.' },
      { status: 500 }
    );
  }
}
