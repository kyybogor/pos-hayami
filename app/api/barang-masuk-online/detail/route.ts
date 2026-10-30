import { NextResponse } from 'next/server';
import poolServer from '@/lib/db_server';
import poolLocal from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id_do1 = searchParams.get('id_do1');
    const id_cust = searchParams.get('id_cust');
    const no_inv = searchParams.get('no_inv');
    const categoryMode = searchParams.get('category') === 'true' || searchParams.get('category') === '1';

    if (!id_do1) {
      return NextResponse.json(
        { success: false, message: 'ID DO (id_do1) tidak ditemukan.' },
        { status: 400 }
      );
    }

    // 1. Query Invoice Header from Server (gdo1)
    const [headerRows] = await poolServer.query<RowDataPacket[]>(
      'SELECT c.* FROM gdo1 c WHERE c.id_do1 = ?',
      [id_do1]
    );

    if (headerRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invoice tidak ditemukan pada server online.' },
        { status: 404 }
      );
    }

    const header = headerRows[0];

    // 2. Query Customer Details from Server (m_customer)
    let customerInfo = null;
    const custSearchName = id_cust || header.id_cust;
    if (custSearchName) {
      const [custRows] = await poolServer.query<RowDataPacket[]>(
        'SELECT c.* FROM m_customer c WHERE nm_customer = ? OR name = ?',
        [custSearchName, custSearchName]
      );
      if (custRows.length > 0) {
        customerInfo = custRows[0];
      }
    }

    // 3. Query Line Items from Server (gdo2)
    let totalQty = 0;
    let grandTotal = 0;
    const items: {
      sku: string;
      tipe: string;
      size: string;
      gambar: string;
      qty: number;
      harga: number;
      subtotal: number;
    }[] = [];

    if (!categoryMode) {
      // View Detail mode (SKU breakdown) - matching printdosku.php logic
      let skuRows: RowDataPacket[] = [];
      try {
        const [rows] = await poolServer.query<RowDataPacket[]>(
          `SELECT distinct c.harga, h.tipe, h.gambar, h.size, c.sku
           FROM gdo2 c 
           JOIN tb_harga_size h USING(sku) 
           WHERE c.id_do1 = ? 
           ORDER BY h.tipe ASC, h.gambar ASC`,
          [id_do1]
        );
        skuRows = rows;
      } catch (err) {
        console.warn('tb_harga_size join error, fallback to gdo2 grouping:', err);
      }

      if (skuRows.length > 0) {
        for (const row of skuRows) {
          const tipeName = row.tipe || '';
          const gambarName = row.gambar || '';
          const sizeName = row.size || '';
          const skuCode = (tipeName && gambarName && sizeName) ? `${tipeName}-${gambarName}-${sizeName}` : (row.sku || '');

          const [sumRows] = await poolServer.query<RowDataPacket[]>(
            'SELECT SUM(c.qty) as qty FROM gdo2 c WHERE id_do1 = ? AND (sku = ? OR (tipe = ? AND gambar = ? AND size = ?))',
            [id_do1, skuCode, tipeName, gambarName, sizeName]
          );

          const itemQty = Math.round(Number(sumRows[0]?.qty) || 0);
          const harga = Number(row.harga) || 0;
          const subtotal = harga * itemQty;
          totalQty += itemQty;
          grandTotal += subtotal;

          items.push({
            sku: skuCode,
            tipe: tipeName,
            size: sizeName,
            gambar: gambarName,
            qty: itemQty,
            harga,
            subtotal,
          });
        }
      } else {
        // Fallback direct gdo2 query grouping
        const [rows] = await poolServer.query<RowDataPacket[]>(
          `SELECT SUM(c.qty) as qty, c.tipe, c.gambar, c.size, c.harga, c.sku 
           FROM gdo2 c 
           WHERE c.id_do1 = ? 
           GROUP BY c.sku, c.tipe, c.gambar, c.size, c.harga 
           ORDER BY c.tipe ASC, c.gambar ASC, c.size ASC`,
          [id_do1]
        );

        for (const row of rows) {
          const itemQty = Math.round(Number(row.qty) || 0);
          const harga = Number(row.harga) || 0;
          const subtotal = harga * itemQty;
          totalQty += itemQty;
          grandTotal += subtotal;

          const tipeName = row.tipe || '';
          const gambarName = row.gambar || '';
          const sizeName = row.size || '';
          const displaySku = (tipeName && gambarName && sizeName) ? `${tipeName}-${gambarName}-${sizeName}` : (row.sku || tipeName || 'Item');

          items.push({
            sku: displaySku,
            tipe: tipeName,
            size: sizeName,
            gambar: gambarName,
            qty: itemQty,
            harga,
            subtotal,
          });
        }
      }
    } else {
      // View mode (Category / Type summary)
      let catRows: RowDataPacket[] = [];
      try {
        const [rows] = await poolServer.query<RowDataPacket[]>(
          `SELECT SUM(c.qty) as qty, h.tipe, h.size, c.harga 
           FROM gdo2 c 
           LEFT JOIN tb_harga_size h USING(sku) 
           LEFT JOIN m_size s ON s.nm_size = c.size 
           WHERE c.id_do1 = ? 
           GROUP BY h.tipe, h.size, c.harga 
           ORDER BY h.tipe ASC, s.number ASC`,
          [id_do1]
        );
        catRows = rows;
      } catch (err) {
        console.warn('Category query error, fallback to gdo2:', err);
      }

      if (catRows.length === 0) {
        const [rows] = await poolServer.query<RowDataPacket[]>(
          `SELECT SUM(c.qty) as qty, c.tipe, c.size, c.harga 
           FROM gdo2 c 
           WHERE c.id_do1 = ? 
           GROUP BY c.tipe, c.size, c.harga`,
          [id_do1]
        );
        catRows = rows;
      }

      for (const row of catRows) {
        const itemQty = Math.round(Number(row.qty) || 0);
        const harga = Number(row.harga) || 0;
        const subtotal = harga * itemQty;
        totalQty += itemQty;
        grandTotal += subtotal;

        const tipeName = row.tipe || '';
        const sizeName = row.size || '';
        const displaySku = (tipeName && sizeName) ? `${tipeName}-${sizeName}` : (tipeName || 'Item');

        items.push({
          sku: displaySku,
          tipe: tipeName,
          size: sizeName,
          gambar: '',
          qty: itemQty,
          harga,
          subtotal,
        });
      }
    }

    // 4. Check local Stock In status (Cek apakah Nota No / id_do1 sudah pernah masuk ke tb_barang_masuk via kolom keterangan)
    let isStockedIn = false;
    const cleanNoInv = (no_inv || header.no_inv || '').trim();
    const cleanIdDo = (id_do1 || header.id_do1 || '').trim();

    if (cleanNoInv || cleanIdDo) {
      try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (cleanNoInv) {
          conditions.push('keterangan LIKE ?');
          params.push(`%${cleanNoInv}%`);
        }
        if (cleanIdDo) {
          conditions.push('keterangan LIKE ?');
          params.push(`%${cleanIdDo}%`);
        }

        if (conditions.length > 0) {
          const sql = `SELECT no_id FROM tb_barang_masuk WHERE ${conditions.join(' OR ')} LIMIT 1`;
          const [localCheck] = await poolLocal.query<RowDataPacket[]>(sql, params);
          isStockedIn = localCheck.length > 0;
        }
      } catch (err) {
        console.warn('Local stock check error:', err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        header: {
          id_do1: header.id_do1,
          no_inv: header.no_inv,
          id_cust: header.id_cust,
          tgl: header.tgl,
          tgltop: header.tgltop,
          qty: Number(header.qty) || 0,
          ttlhrg: Number(header.ttlhrg) || 0,
          disc: Number(header.disc) || 0,
          tax: Number(header.tax) || 0,
          ppn: Number(header.ppn) || 0,
          grandttl: Number(header.grandttl) || 0,
        },
        customerInfo: customerInfo
          ? {
              name: customerInfo.name || customerInfo.nm_customer || '',
              address: customerInfo.address || '',
              city: customerInfo.city || '',
              salesman: customerInfo.salesman || '',
            }
          : null,
        items,
        totalQty,
        grandTotal,
        isStockedIn,
      },
    });
  } catch (error: any) {
    console.error('Fetch invoice detail error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil detail invoice dari server online.' },
      { status: 500 }
    );
  }
}
