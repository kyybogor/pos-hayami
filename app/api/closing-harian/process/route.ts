import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';

const parseToYmd = (val: string): string => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.split('T')[0].substring(0, 10);
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return val;
  }
};

export async function POST(req: NextRequest) {
  const conn = await pool.getConnection();
  try {
    const body = await req.json();
    const tgl_transaksi_raw = body.tgl_transaksi || '';
    let id_cabang = (body.id_cabang || '').trim();
    let kasir = (body.kasir || '').trim();
    const kas_pembukaan = Number(body.kas_pembukaan) || 0;
    let customNoPenutupan = (body.no_penutupan || '').trim();
    let catatan = (body.catatan || '').trim();

    // If id_cabang or kasir is empty, try resolving from session token
    if (!kasir || !id_cabang || id_cabang === 'ALL') {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('pos_session')?.value;
        if (token) {
          const session = await verifySessionToken(token);
          if (session) {
            if (!kasir) kasir = session.nm_user || session.id_user || 'Kasir';
            if ((!id_cabang || id_cabang === 'ALL') && session.branch && session.branch !== 'ALL') {
              id_cabang = session.branch;
            }
          }
        }
      } catch (err) {
        console.error('Session resolution error in process:', err);
      }
    }
    if (!kasir) kasir = 'Kasir';

    const cleanDate = parseToYmd(tgl_transaksi_raw) || new Date().toISOString().split('T')[0];
    if (!catatan) {
      // e.g. "penutupan kasir 09-10-2026"
      const dParts = cleanDate.split('-');
      const formattedDateNotes = dParts.length === 3 ? `${dParts[2]}-${dParts[1]}-${dParts[0]}` : cleanDate;
      catatan = `penutupan kasir ${formattedDateNotes}`;
    }

    await conn.beginTransaction();

    // Resolve branch id & branch name directly to avoid SQL collation issues between tb_barang_keluar & tb_cabang
    let finalCabangName = id_cabang;
    let branchIdStr = id_cabang;
    let branchNameStr = id_cabang;

    if (id_cabang && id_cabang !== 'ALL') {
      const [cbRows] = await conn.query<RowDataPacket[]>(
        `SELECT id_cabang, nama_cabang FROM tb_cabang WHERE id_cabang = ? OR nama_cabang = ? LIMIT 1`,
        [id_cabang, id_cabang]
      );
      if (cbRows.length > 0) {
        branchIdStr = String(cbRows[0].id_cabang);
        branchNameStr = String(cbRows[0].nama_cabang);
        finalCabangName = cbRows[0].nama_cabang;
      }
    }

    // 1. Fetch unclosed sales from tb_barang_keluar
    let salesWhere = "WHERE (DATE(a.tgl_transaksi) = ? OR a.tgl_transaksi LIKE CONCAT(?, '%')) AND a.status_keluar <> 'd' AND (a.is_closing = 0 OR a.is_closing IS NULL)";
    const salesParams: any[] = [cleanDate, cleanDate];

    if (id_cabang && id_cabang !== 'ALL') {
      salesWhere += ' AND (a.id_cabang = ? OR a.id_cabang = ?)';
      salesParams.push(branchIdStr, branchNameStr);
    }

    const [salesRows] = await conn.query<RowDataPacket[]>(
      `SELECT 
        a.no_id,
        a.id_transaksi,
        a.id_customer,
        a.akun,
        a.disc,
        a.disc_invoice,
        a.id_bahan,
        a.model,
        a.ukuran,
        a.qty,
        a.harga,
        a.subtotal,
        a.id_cabang
      FROM tb_barang_keluar a
      ${salesWhere}
      ORDER BY a.id_transaksi ASC FOR UPDATE`,
      salesParams
    );

    if (salesRows.length === 0) {
      await conn.rollback();
      return NextResponse.json(
        {
          success: false,
          message: 'Tidak ada transaksi penjualan yang belum di-closing untuk tanggal dan cabang yang dipilih.',
        },
        { status: 400 }
      );
    }

    // 2. Fetch unclosed retur from tb_retur
    let returWhere = "WHERE (DATE(r.tgl_transaksi) = ? OR r.tgl_transaksi LIKE CONCAT(?, '%')) AND r.status_keluar <> 'd' AND (r.is_closing = 0 OR r.is_closing IS NULL)";
    const returParams: any[] = [cleanDate, cleanDate];

    if (id_cabang && id_cabang !== 'ALL') {
      returWhere += ' AND (r.id_cabang = ? OR r.id_cabang = ?)';
      returParams.push(branchIdStr, branchNameStr);
    }

    const [returRows] = await conn.query<RowDataPacket[]>(
      `SELECT 
        r.no_id,
        r.id_transaksi,
        r.id_bahan,
        r.model,
        r.ukuran,
        r.qty,
        r.harga,
        r.subtotal
      FROM tb_retur r
      ${returWhere}
      ORDER BY r.id_transaksi ASC FOR UPDATE`,
      returParams
    );

    // 3. Determine next no_penutupan
    const [maxNoRows] = await conn.query<RowDataPacket[]>(
      `SELECT MAX(CAST(no_penutupan AS UNSIGNED)) as max_no FROM tb_closing_harian FOR UPDATE`
    );
    const maxNo = maxNoRows[0]?.max_no;
    let finalNoPenutupan = customNoPenutupan;

    if (!finalNoPenutupan) {
      finalNoPenutupan = maxNo ? String(Number(maxNo) + 1) : '638';
    } else {
      // Check if already used
      const [checkExists] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM tb_closing_harian WHERE no_penutupan = ? LIMIT 1`,
        [finalNoPenutupan]
      );
      if (checkExists.length > 0) {
        finalNoPenutupan = maxNo ? String(Number(maxNo) + 1) : '638';
      }
    }

    // 4. Group sales transactions & compute payments
    const distinctTx = new Set<string>();
    let totalPenjualanKotor = 0;
    let nominalCash = 0;
    let nominalHutang = 0;
    let nominalTransfer = 0;
    const akunBreakdown: Record<string, number> = {};

    const cashByBranch = new Map<string, number>();
    const txMap: Record<string, { akun: string; disc: number; disc_invoice: number; subtotal: number; branch: string }> = {};

    salesRows.forEach((r) => {
      const txId = r.id_transaksi;
      distinctTx.add(txId);

      if (!txMap[txId]) {
        txMap[txId] = {
          akun: String(r.akun || 'CASH').trim(),
          disc: Number(r.disc) || 0,
          disc_invoice: Number(r.disc_invoice) || 0,
          subtotal: 0,
          branch: String(r.id_cabang || (id_cabang !== 'ALL' ? id_cabang : '') || '').trim(),
        };
      }
      txMap[txId].subtotal += Number(r.subtotal) || 0;
    });

    Object.values(txMap).forEach((tx) => {
      const totalNota = Math.max(0, tx.subtotal - (tx.disc + tx.disc_invoice));
      totalPenjualanKotor += totalNota;

      const upperAkun = tx.akun.toUpperCase();
      if (upperAkun === 'CASH') {
        nominalCash += totalNota;
        cashByBranch.set(tx.branch, (cashByBranch.get(tx.branch) || 0) + totalNota);
      } else if (upperAkun === 'HUTANG') {
        nominalHutang += totalNota;
      } else {
        nominalTransfer += totalNota;
      }

      akunBreakdown[tx.akun] = (akunBreakdown[tx.akun] || 0) + totalNota;
    });

    // Calculate retur
    let totalRetur = 0;
    let totalQtyRetur = 0;
    returRows.forEach((r) => {
      totalRetur += Number(r.subtotal) || 0;
      totalQtyRetur += Number(r.qty) || 0;
    });

    // 5. Group products sold & retur
    interface ProductAgg {
      id_bahan: string;
      model: string;
      ukuran: string;
      nama_barang: string;
      qty_penjualan: number;
      qty_retur: number;
      total_qty: number;
      harga_satuan: number;
      total_penjualan: number;
    }

    const productMap: Record<string, ProductAgg> = {};

    salesRows.forEach((r) => {
      const idBahan = (r.id_bahan || '').trim();
      const model = (r.model || '').trim();
      const ukuran = (r.ukuran || '').trim();
      const key = `${idBahan}___${model}___${ukuran}`;

      let displayName = '';
      if (model && ukuran) {
        displayName = `${model} (${ukuran})`;
      } else if (model) {
        displayName = model;
      } else if (idBahan && ukuran) {
        displayName = `${idBahan} (${ukuran})`;
      } else {
        displayName = idBahan || 'Item';
      }

      const qty = Number(r.qty) || 0;
      const subtotal = Number(r.subtotal) || 0;
      const harga = Number(r.harga) || (qty > 0 ? subtotal / qty : 0);

      if (!productMap[key]) {
        productMap[key] = {
          id_bahan: idBahan,
          model,
          ukuran,
          nama_barang: displayName,
          qty_penjualan: 0,
          qty_retur: 0,
          total_qty: 0,
          harga_satuan: harga,
          total_penjualan: 0,
        };
      }

      productMap[key].qty_penjualan += qty;
      productMap[key].total_penjualan += subtotal;
      productMap[key].total_qty += qty;
    });

    returRows.forEach((r) => {
      const idBahan = (r.id_bahan || '').trim();
      const model = (r.model || '').trim();
      const ukuran = (r.ukuran || '').trim();
      const key = `${idBahan}___${model}___${ukuran}`;

      let displayName = '';
      if (model && ukuran) {
        displayName = `${model} (${ukuran})`;
      } else if (model) {
        displayName = model;
      } else if (idBahan && ukuran) {
        displayName = `${idBahan} (${ukuran})`;
      } else {
        displayName = idBahan || 'Item';
      }

      const qty = Number(r.qty) || 0;

      if (!productMap[key]) {
        productMap[key] = {
          id_bahan: idBahan,
          model,
          ukuran,
          nama_barang: displayName,
          qty_penjualan: 0,
          qty_retur: 0,
          total_qty: 0,
          harga_satuan: Number(r.harga) || 0,
          total_penjualan: 0,
        };
      }

      productMap[key].qty_retur += qty;
      productMap[key].total_qty -= qty;
    });

    const productsList = Object.values(productMap);
    let totalQtyPenjualan = 0;
    productsList.forEach((p) => {
      totalQtyPenjualan += p.qty_penjualan;
    });

    const totalBersih = Math.max(0, totalPenjualanKotor - totalRetur);
    const totalQtyBersih = Math.max(0, totalQtyPenjualan - totalQtyRetur);

    // 6. Insert into tb_closing_harian
    if (!finalCabangName && salesRows.length > 0 && salesRows[0].id_cabang) {
      finalCabangName = salesRows[0].id_cabang;
    }

    const [insertResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO tb_closing_harian (
        no_penutupan,
        tgl_closing,
        tgl_transaksi,
        id_cabang,
        kasir,
        kas_pembukaan,
        total_penjualan,
        total_retur,
        total_bersih,
        total_qty_penjualan,
        total_qty_retur,
        total_qty_bersih,
        total_transaksi,
        nominal_cash,
        nominal_hutang,
        nominal_transfer,
        catatan,
        produk_json,
        pembayaran_json,
        created_at
      ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        finalNoPenutupan,
        cleanDate,
        finalCabangName || id_cabang || null,
        kasir,
        kas_pembukaan,
        totalPenjualanKotor,
        totalRetur,
        totalBersih,
        totalQtyPenjualan,
        totalQtyRetur,
        totalQtyBersih,
        distinctTx.size,
        nominalCash,
        nominalHutang,
        nominalTransfer,
        catatan,
        JSON.stringify(productsList),
        JSON.stringify(akunBreakdown),
      ]
    );

    const closingId = insertResult.insertId;

    // 7. Bulk insert into tb_closing_harian_detail
    if (productsList.length > 0) {
      const detailValues = productsList.map((p) => [
        closingId,
        finalNoPenutupan,
        p.id_bahan,
        p.model,
        p.ukuran,
        p.nama_barang,
        p.qty_penjualan,
        p.qty_retur,
        p.total_qty,
        p.harga_satuan,
        p.total_penjualan,
      ]);

      await conn.query(
        `INSERT INTO tb_closing_harian_detail (
          id_closing,
          no_penutupan,
          id_bahan,
          model,
          ukuran,
          nama_barang,
          qty_penjualan,
          qty_retur,
          total_qty,
          harga_satuan,
          total_penjualan
        ) VALUES ?`,
        [detailValues]
      );
    }

    // 8. Update tb_barang_keluar to mark as closed
    const updateSalesSql = `UPDATE tb_barang_keluar 
      SET is_closing = 1, closing_by = ?, tgl_closing = NOW(), id_closing = ?
      WHERE no_id IN (?) AND (is_closing = 0 OR is_closing IS NULL)`;
    const updateSalesParams = [kasir, closingId, salesRows.map((r) => r.no_id)];
    await conn.query(updateSalesSql, updateSalesParams);

    // 9. Update tb_retur to mark as closed
    if (returRows.length > 0) {
      await conn.query(
        `UPDATE tb_retur
         SET is_closing = 1, closing_by = ?, tgl_closing = NOW(), id_closing = ?
         WHERE no_id IN (?) AND (is_closing = 0 OR is_closing IS NULL)`,
        [kasir, closingId, returRows.map((r) => r.no_id)]
      );
    }

    // Retur already creates cash out; opening cash is an existing balance.
    // Record only cash sales, separately for each branch, in this transaction.
    const pettyCashEntries: { id_petty: string; id_cabang: string; in_cash: number }[] = [];
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    for (const [branch, cashIn] of cashByBranch) {
      if (cashIn <= 0) continue;

      const prefix = `PTY-${getBranchCode(branch)}-${yearSuffix}-`;
      const [maxPettyRows] = await conn.query<RowDataPacket[]>(
        `SELECT MAX(id_petty) as max_id FROM tb_petty_cash
         WHERE id_petty LIKE ? OR id_petty LIKE ? FOR UPDATE`,
        [`${prefix}%`, `PTY-${yearSuffix}-%`]
      );
      const lastSequence = String(maxPettyRows[0]?.max_id || '').match(/\d+$/);
      const nextSequence = lastSequence ? Number(lastSequence[0]) + 1 : 1;
      const pettyId = `${prefix}${String(nextSequence).padStart(6, '0')}`;

      await conn.query<ResultSetHeader>(
        `INSERT INTO tb_petty_cash (
          id_petty, tgl, keterangan, in_cash, out_cash, bukti_petty,
          dibuat_oleh, dibuat_tgl, id_cabang
        ) VALUES (?, ?, ?, ?, 0, '', ?, NOW(), ?)`,
        [pettyId, cleanDate, `Closing Harian No. ${finalNoPenutupan} - ${catatan}`, cashIn, kasir, branch]
      );
      pettyCashEntries.push({ id_petty: pettyId, id_cabang: branch, in_cash: cashIn });
    }

    // 10. Fetch inserted closing row
    const [savedRow] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM tb_closing_harian WHERE id = ?`,
      [closingId]
    );
    await conn.commit();

    return NextResponse.json({
      success: true,
      message: `Closing Harian berhasil diproses! No Penutupan: ${finalNoPenutupan}`,
      data: {
        closing: {
          ...savedRow[0],
          pembayaran: akunBreakdown,
        },
        products: productsList,
        pembayaran: akunBreakdown,
        petty_cash: pettyCashEntries,
      },
    });
  } catch (error: any) {
    await conn.rollback();
    console.error('Error in process closing harian:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses closing harian.' },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}
