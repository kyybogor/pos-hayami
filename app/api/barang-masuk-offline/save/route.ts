import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import poolLocal from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

async function generateTransactionKey(branchCode: string): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefixPattern = `PO-${branchCode}/${yy}${mm}/%`;

  const [rows] = await poolLocal.query<RowDataPacket[]>(
    'SELECT id_transaksi FROM tb_barang_masuk WHERE id_transaksi LIKE ? OR id_transaksi LIKE ? ORDER BY id_transaksi DESC LIMIT 10',
    [prefixPattern, `PO/${yy}${mm}/%`]
  );

  let maxSeq = 0;
  for (const r of rows) {
    const lastKey = String(r.id_transaksi || '');
    const match = lastKey.match(/(\d+)$/);
    if (match) {
      const numPart = parseInt(match[1], 10);
      if (!isNaN(numPart) && numPart > maxSeq && numPart < 10000) {
        maxSeq = numPart;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `PO-${branchCode}/${yy}${mm}/${String(nextSeq).padStart(4, '0')}`;
}

async function getStartNoIdSeq(branchCode: string): Promise<number> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const prefixPattern = `IM-${branchCode}-${mm}${yy}%`;

  const [rows] = await poolLocal.query<RowDataPacket[]>(
    `SELECT no_id FROM tb_barang_masuk 
     WHERE (no_id LIKE ? OR no_id LIKE ? OR no_id LIKE ?)
       AND no_id NOT LIKE '%e+%'
     ORDER BY no_id DESC LIMIT 100`,
    [prefixPattern, `IM-${branchCode}-${yy}${mm}%`, `IM${mm}${yy}%`]
  );

  let maxSeq = 0;
  for (const r of rows) {
    const lastId = String(r.no_id || '');
    if (lastId.includes('e+') || lastId.length > 45) continue;
    const match = lastId.match(/(\d{6})$/);
    if (match) {
      const numPart = parseInt(match[1], 10);
      if (!isNaN(numPart) && numPart > maxSeq && numPart < 1000000) {
        maxSeq = numPart;
      }
    }
  }

  return maxSeq + 1;
}

function formatNoId(seq: number, branchCode: string): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `IM-${branchCode}-${mm}${yy}-${String(seq).padStart(6, '0')}`;
}

async function getNextUniqueNoId(startSeq: number, branchCode: string): Promise<{ noId: string; nextSeq: number }> {
  let seq = startSeq;
  while (true) {
    const candidate = formatNoId(seq++, branchCode);
    const [existing] = await poolLocal.query<RowDataPacket[]>(
      'SELECT no_id FROM tb_barang_masuk WHERE no_id = ? LIMIT 1',
      [candidate]
    );
    if (existing.length === 0) {
      return { noId: candidate, nextSeq: seq };
    }
  }
}

async function getStartStockSeq(branchCode: string): Promise<number> {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const prefixPattern = `SB-${branchCode}-${mm}${yy}%`;

  const [rows] = await poolLocal.query<RowDataPacket[]>(
    `SELECT id FROM tb_stock 
     WHERE (id LIKE ? OR id LIKE ? OR id LIKE ?)
       AND id NOT LIKE '%e+%'
     ORDER BY id DESC LIMIT 100`,
    [prefixPattern, `SB-${branchCode}-${yy}${mm}%`, `SB${mm}${yy}%`]
  );

  let maxSeq = 0;
  for (const r of rows) {
    const lastId = String(r.id || '');
    if (lastId.includes('e+') || lastId.length > 45) continue;
    const match = lastId.match(/(\d{6})$/);
    if (match) {
      const numPart = parseInt(match[1], 10);
      if (!isNaN(numPart) && numPart > maxSeq && numPart < 1000000) {
        maxSeq = numPart;
      }
    }
  }

  return maxSeq + 1;
}

function formatStockId(seq: number, branchCode: string): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `SB-${branchCode}-${mm}${yy}-${String(seq).padStart(6, '0')}`;
}

async function getNextUniqueStockId(startSeq: number, branchCode: string): Promise<{ stockId: string; nextSeq: number }> {
  let seq = startSeq;
  while (true) {
    const candidate = formatStockId(seq++, branchCode);
    const [existing] = await poolLocal.query<RowDataPacket[]>(
      'SELECT id FROM tb_stock WHERE id = ? LIMIT 1',
      [candidate]
    );
    if (existing.length === 0) {
      return { stockId: candidate, nextSeq: seq };
    }
  }
}

// Check database column existence dynamically so missing image column doesn't crash 500
let hasCheckedColumns = false;
let bmHasImageColumn = true;
let stockHasImageColumn = true;

async function checkColumns() {
  if (hasCheckedColumns) return;
  try {
    const [bmCols] = await poolLocal.query<RowDataPacket[]>("SHOW COLUMNS FROM tb_barang_masuk LIKE 'image'");
    bmHasImageColumn = bmCols.length > 0;
    const [stkCols] = await poolLocal.query<RowDataPacket[]>("SHOW COLUMNS FROM tb_stock LIKE 'image'");
    stockHasImageColumn = stkCols.length > 0;
    hasCheckedColumns = true;
  } catch (err) {
    console.warn('Check image column error:', err);
  }
}

export async function POST(req: Request) {
  try {
    await checkColumns();

    const body = await req.json();
    let { id_transaksi, tgl_transaksi, id_supplier, keterangan, jenis, authorize, items, id_cabang } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Detail barang tidak boleh kosong.' },
        { status: 400 }
      );
    }

    let branchId = id_cabang || '';
    if (!branchId) {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('pos_session')?.value;
        if (token) {
          const session = await verifySessionToken(token);
          if (session) {
            branchId = session.grup || session.branch || '';
          }
        }
      } catch (e) {}
    }
    if (!branchId) {
      branchId = 'TKA-JATINEGARA-JAKARTA';
    }

    const branchCode = getBranchCode(branchId);

    // 1. Check if editing an existing transaction and if it was ALREADY authorized
    let isAlreadyAuthorized = false;
    const existingImagesMap: Record<string, string> = {};
    if (id_transaksi && id_transaksi !== 'new' && id_transaksi !== 'NEW') {
      const selectCols = bmHasImageColumn
        ? 'status, id_product, model, ukuran, image'
        : 'status, id_product, model, ukuran';
      const [existingRows] = await poolLocal.query<RowDataPacket[]>(
        `SELECT ${selectCols} FROM tb_barang_masuk WHERE id_transaksi = ?`,
        [id_transaksi]
      );
      if (existingRows.length > 0) {
        if (existingRows[0].status === 's') {
          isAlreadyAuthorized = true;
        }
        for (const er of existingRows) {
          if (er.image && String(er.image).trim() !== '') {
            const imgVal = String(er.image).trim();
            existingImagesMap[`${er.id_product}|${er.model || ''}|${er.ukuran || ''}`] = imgVal;
            if (!existingImagesMap[`${er.id_product}|${er.model || ''}`]) {
              existingImagesMap[`${er.id_product}|${er.model || ''}`] = imgVal;
            }
          }
        }
      }
    } else {
      id_transaksi = await generateTransactionKey(branchCode);
    }

    const targetStatus = authorize ? 's' : 'd';
    const tglDate = tgl_transaksi ? String(tgl_transaksi).slice(0, 10) : (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();

    // Delete existing rows for this id_transaksi if it was NOT yet authorized
    if (!isAlreadyAuthorized) {
      await poolLocal.query('DELETE FROM tb_barang_masuk WHERE id_transaksi = ?', [id_transaksi]);
    }

    // 2. Insert line items into tb_barang_masuk (only if not already authorized)
    if (!isAlreadyAuthorized) {
      let currentNoIdSeq = await getStartNoIdSeq(branchCode);

      for (const item of items) {
        const { noId, nextSeq } = await getNextUniqueNoId(currentNoIdSeq, branchCode);
        currentNoIdSeq = nextSeq;

        const qtyNum = Number(item.qty) || 0;
        const hargaNum = Number(item.harga) || 0;
        const subtotalNum = Number(item.subtotal) || (qtyNum * hargaNum);

        let itemImg = item.image ? String(item.image).trim() : '';
        if (!itemImg) {
          const k1 = `${item.id_product}|${item.model || ''}|${item.ukuran || ''}`;
          const k2 = `${item.id_product}|${item.model || ''}`;
          itemImg = existingImagesMap[k1] || existingImagesMap[k2] || '';
        }
        if (!itemImg && stockHasImageColumn) {
          try {
            // Check tb_stock
            const [stkRows] = await poolLocal.query<RowDataPacket[]>(
              'SELECT image FROM tb_stock WHERE (id_bahan = ? OR id_bahan = ?) AND model = ? AND image IS NOT NULL AND image != "" LIMIT 1',
              [item.id_product, item.id_product, item.model || '']
            );
            if (stkRows.length > 0 && stkRows[0].image) {
              itemImg = stkRows[0].image;
            }
          } catch (stkErr) {
            console.warn('Check tb_stock image error:', stkErr);
          }
        }
        if (!itemImg && bmHasImageColumn) {
          try {
            // Check tb_barang_masuk history
            const [histRows] = await poolLocal.query<RowDataPacket[]>(
              'SELECT image FROM tb_barang_masuk WHERE id_product = ? AND model = ? AND image IS NOT NULL AND image != "" ORDER BY no_id DESC LIMIT 1',
              [item.id_product, item.model || '']
            );
            if (histRows.length > 0 && histRows[0].image) {
              itemImg = histRows[0].image;
            }
          } catch (histErr) {
            console.warn('Check tb_barang_masuk image error:', histErr);
          }
        }

        if (bmHasImageColumn) {
          await poolLocal.query(
            `INSERT INTO tb_barang_masuk (
              no_id, id_transaksi, tgl_transaksi, id_supplier, id_product, model, ukuran, 
              qty, uom, harga, subtotal, total, keterangan, status, jenis, id_cabang, by_user_pajak, status_lunas, image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              noId,
              id_transaksi,
              tglDate,
              id_supplier || 'Hayami',
              item.id_product,
              item.model || '',
              item.ukuran || '',
              qtyNum,
              item.uom || 'PCS',
              hargaNum,
              subtotalNum,
              subtotalNum,
              keterangan || '',
              targetStatus,
              jenis || '0',
              branchId,
              1,
              0,
              itemImg,
            ]
          );
        } else {
          await poolLocal.query(
            `INSERT INTO tb_barang_masuk (
              no_id, id_transaksi, tgl_transaksi, id_supplier, id_product, model, ukuran, 
              qty, uom, harga, subtotal, total, keterangan, status, jenis, id_cabang, by_user_pajak, status_lunas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              noId,
              id_transaksi,
              tglDate,
              id_supplier || 'Hayami',
              item.id_product,
              item.model || '',
              item.ukuran || '',
              qtyNum,
              item.uom || 'PCS',
              hargaNum,
              subtotalNum,
              subtotalNum,
              keterangan || '',
              targetStatus,
              jenis || '0',
              branchId,
              1,
              0,
            ]
          );
        }
      }
    } else if (authorize) {
      // If already authorized and clicking authorize again, just update header info
      await poolLocal.query(
        `UPDATE tb_barang_masuk 
         SET id_supplier = ?, tgl_transaksi = ?, keterangan = ?, jenis = ? 
         WHERE id_transaksi = ?`,
        [id_supplier, tglDate, keterangan || '', jenis || '0', id_transaksi]
      );
    }

    // 3. Process Stock In Authorization (ONLY IF authorize === true AND NOT already authorized)
    if (authorize && !isAlreadyAuthorized) {
      let currentStockSeq = await getStartStockSeq(branchCode);

      for (const item of items) {
        const qtyNum = Number(item.qty) || 0;
        const hargaNum = Number(item.harga) || 0;
        const productId = item.id_product;
        const modelStr = item.model || '';
        const ukuranStr = item.ukuran || '';

        // Safe resolution of id_bahan
        let resolvedBahanId = productId;
        try {
          const [bRows] = await poolLocal.query<RowDataPacket[]>(
            'SELECT id_bahan FROM tb_bahan WHERE id_bahan = ? OR nama_bahan = ? LIMIT 1',
            [productId, productId]
          );
          if (bRows.length > 0 && bRows[0].id_bahan) {
            resolvedBahanId = bRows[0].id_bahan;
          }
        } catch (bErr) {
          console.warn('Resolve bahan error:', bErr);
        }

        // Check tb_stock matching id_bahan (or nama_bahan), model, and ukuran
        const [stockCheck] = await poolLocal.query<RowDataPacket[]>(
          `SELECT * FROM tb_stock 
           WHERE (id_bahan = ? OR id_bahan = ?)
             AND model = ? AND ukuran = ? LIMIT 1`,
          [productId, resolvedBahanId, modelStr, ukuranStr]
        );

        let imgPath = item.image ? String(item.image).trim() : '';
        if (!imgPath) {
          const k1 = `${productId}|${modelStr}|${ukuranStr}`;
          const k2 = `${productId}|${modelStr}`;
          imgPath = existingImagesMap[k1] || existingImagesMap[k2] || '';
        }
        if (!imgPath && bmHasImageColumn) {
          try {
            const [bmImg] = await poolLocal.query<RowDataPacket[]>(
              `SELECT image FROM tb_barang_masuk 
               WHERE id_product = ? AND model = ? AND image IS NOT NULL AND image != '' 
               ORDER BY no_id DESC LIMIT 1`,
              [productId, modelStr]
            );
            if (bmImg.length > 0 && bmImg[0].image) {
              imgPath = bmImg[0].image;
            }
          } catch (bmErr) {
            console.warn('Check bm image error:', bmErr);
          }
        }

        if (stockCheck.length > 0) {
          // UPDATE existing stock by specific primary key id
          const existingStock = stockCheck[0];
          const finalImg = imgPath || existingStock.image || '';
          if (stockHasImageColumn && finalImg) {
            await poolLocal.query(
              `UPDATE tb_stock 
               SET stock = stock + ?, harga = ?, sts = 0, image = ?
               WHERE id = ?`,
              [qtyNum, hargaNum, finalImg, existingStock.id]
            );
          } else {
            await poolLocal.query(
              `UPDATE tb_stock 
               SET stock = stock + ?, harga = ?, sts = 0 
               WHERE id = ?`,
              [qtyNum, hargaNum, existingStock.id]
            );
          }
        } else {
          // INSERT new stock record with unique sequential ID
          const { stockId, nextSeq } = await getNextUniqueStockId(currentStockSeq, branchCode);
          currentStockSeq = nextSeq;

          const randomBarcode = String(Math.floor(1000000 + Math.random() * 9000000));

          if (stockHasImageColumn) {
            await poolLocal.query(
              `INSERT INTO tb_stock (
                id, id_transaksi_stock, tgl_masuk, id_bahan, model, ukuran, 
                stock, uom, harga, barcode, id_cabang, sts, image
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                stockId,
                '1',
                tglDate,
                productId,
                modelStr,
                ukuranStr,
                qtyNum,
                item.uom || 'PCS',
                hargaNum,
                randomBarcode,
                branchId,
                0,
                imgPath,
              ]
            );
          } else {
            await poolLocal.query(
              `INSERT INTO tb_stock (
                id, id_transaksi_stock, tgl_masuk, id_bahan, model, ukuran, 
                stock, uom, harga, barcode, id_cabang, sts
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                stockId,
                '1',
                tglDate,
                productId,
                modelStr,
                ukuranStr,
                qtyNum,
                item.uom || 'PCS',
                hargaNum,
                randomBarcode,
                branchId,
                0,
              ]
            );
          }
        }

        // Propagate image to all stock entries for this id_bahan and model
        if (imgPath && stockHasImageColumn) {
          try {
            await poolLocal.query(
              `UPDATE tb_stock 
               SET image = ? 
               WHERE (id_bahan = ? OR id_bahan = ?)
                 AND model = ?
                 AND (image IS NULL OR image = '' OR image NOT LIKE '/%')`,
              [imgPath, productId, resolvedBahanId, modelStr]
            );
          } catch (stkErr) {
            console.warn('Sync image to tb_stock warning:', stkErr);
          }
        }

        // UPDATE tb_bahan summary stock or INSERT if item doesn't exist
        try {
          const [updateRes] = await poolLocal.query<ResultSetHeader>(
            `UPDATE tb_bahan 
             SET total_qty = total_qty + ?, total_pcs = total_pcs + ?, sts = 0 
             WHERE id_bahan = ? OR nama_bahan = ?`,
            [qtyNum, qtyNum, productId, productId]
          );

          if (updateRes.affectedRows === 0) {
            const [maxBahanRows] = await poolLocal.query<RowDataPacket[]>(
              "SELECT MAX(id_bahan) as maxId FROM tb_bahan WHERE id_bahan LIKE 'BA%'"
            );
            let bSeq = 1;
            if (maxBahanRows.length > 0 && maxBahanRows[0].maxId) {
              const numPart = parseInt(String(maxBahanRows[0].maxId).replace(/^BA/i, ''), 10);
              if (!isNaN(numPart)) {
                bSeq = numPart + 1;
              }
            }
            const autoBahanId = `BA${String(bSeq).padStart(6, '0')}`;
            await poolLocal.query(
              `INSERT INTO tb_bahan (id_bahan, nama_bahan, ukuran, uom, total_qty, total_pcs, harga, sts, id_cabang, image)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
              [autoBahanId, productId, ukuranStr || '#', item.uom || 'PCS', qtyNum, qtyNum, hargaNum, branchId, imgPath]
            );
          }
        } catch (bUpdateErr) {
          console.warn('Update/Insert tb_bahan warning:', bUpdateErr);
        }
      }

      // Update status in tb_barang_masuk to 's' (Close)
      await poolLocal.query(
        'UPDATE tb_barang_masuk SET status = "s" WHERE id_transaksi = ?',
        [id_transaksi]
      );
    }

    return NextResponse.json({
      success: true,
      id_transaksi,
      message: authorize
        ? 'Simpan & Otorisasi berhasil! Stok barang offline telah diperbarui.'
        : 'Draft barang masuk berhasil disimpan.',
    });
  } catch (error: any) {
    console.error('Save barang masuk offline error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.sqlMessage || error.message || 'Gagal menyimpan transaksi barang masuk offline.' 
      },
      { status: 500 }
    );
  }
}
