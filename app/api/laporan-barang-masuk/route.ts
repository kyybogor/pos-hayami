import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const getOptions = searchParams.get('options') === 'true';

    // If requesting options for dropdown filters
    if (getOptions) {
      const [customers] = await pool.query<RowDataPacket[]>(
        'SELECT id_customer, nama_customer FROM tb_customer ORDER BY nama_customer ASC'
      );
      const [bahanList] = await pool.query<RowDataPacket[]>(
        'SELECT id_bahan, nama_bahan FROM tb_bahan ORDER BY nama_bahan ASC'
      );

      return NextResponse.json({
        success: true,
        options: {
          suppliers: customers.map((c) => ({
            id: c.id_customer,
            name: c.nama_customer,
          })),
          bahan: bahanList.map((b) => ({
            id: b.id_bahan || b.nama_bahan,
            name: b.nama_bahan,
          })),
        },
      });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    // Default dates = today
    const today = new Date().toISOString().split('T')[0];
    const tgl_from = searchParams.get('tgl_from') || today;
    const tgl_to = searchParams.get('tgl_to') || today;
    const supplier = searchParams.get('supplier') || '';
    const bahan = searchParams.get('bahan') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    let whereSql = "WHERE a.status <> 'd' AND (a.tgl_transaksi BETWEEN ? AND ?)";
    const params: any[] = [tgl_from, tgl_to];

    if (effectiveBranch) {
      whereSql += ' AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (supplier.trim() !== '') {
      const suppPart = supplier.split(' | ')[0].trim();
      whereSql += ' AND (a.id_supplier = ? OR c.nama_customer LIKE ?)';
      params.push(suppPart, `%${supplier.trim()}%`);
    }

    if (bahan.trim() !== '') {
      whereSql += ' AND a.id_product = ?';
      params.push(bahan.trim());
    }

    // Header query grouped by transaction
    const headerQuery = `
      SELECT 
        a.id_transaksi, 
        a.tgl_transaksi, 
        a.id_supplier, 
        a.ppn, 
        a.keterangan,
        a.id_cabang,
        c.nama_customer as nama_supplier
      FROM tb_barang_masuk a
      LEFT JOIN tb_customer c ON a.id_supplier = c.id_customer
      ${whereSql}
      GROUP BY a.id_transaksi
      ORDER BY a.tgl_transaksi DESC, a.id_transaksi DESC
    `;

    const [headers] = await pool.query<RowDataPacket[]>(headerQuery, params);

    let grandTotal = 0;
    let totalQtyAll = 0;

    const transactions = await Promise.all(
      headers.map(async (h) => {
        let itemWhere = 'WHERE id_transaksi = ?';
        const itemParams: any[] = [h.id_transaksi];

        if (supplier.trim() !== '') {
          const suppPart = supplier.split(' | ')[0].trim();
          itemWhere += ' AND id_supplier = ?';
          itemParams.push(suppPart);
        }

        if (bahan.trim() !== '') {
          itemWhere += ' AND id_product = ?';
          itemParams.push(bahan.trim());
        }

        const [itemRows] = await pool.query<RowDataPacket[]>(
          `SELECT no_id, id_product, model, ukuran, qty, uom, harga, subtotal, total 
           FROM tb_barang_masuk 
           ${itemWhere}
           ORDER BY no_id ASC`,
          itemParams
        );

        let subtotalTrx = 0;
        let qtyTrx = 0;

        const items = itemRows.map((it) => {
          const q = Number(it.qty) || 0;
          const price = Number(it.harga) || 0;
          const tot = Number(it.total) || Number(it.subtotal) || (q * price);
          subtotalTrx += tot;
          qtyTrx += q;

          return {
            no_id: it.no_id,
            id_product: it.id_product,
            model: it.model || '',
            ukuran: it.ukuran || '',
            qty: q,
            uom: it.uom || 'PCS',
            harga: price,
            total: tot,
          };
        });

        const ppnPercent = Number(h.ppn) || 0;
        const ppnAmount = (subtotalTrx * ppnPercent) / 100;
        const totalWithPpn = subtotalTrx + ppnAmount;

        grandTotal += totalWithPpn;
        totalQtyAll += qtyTrx;

        return {
          id_transaksi: h.id_transaksi,
          tgl_transaksi: h.tgl_transaksi,
          id_supplier: h.id_supplier,
          nama_supplier: h.nama_supplier || h.id_supplier || 'Supplier',
          keterangan: h.keterangan || '',
          id_cabang: h.id_cabang || '',
          ppn_percent: ppnPercent,
          ppn_amount: ppnAmount,
          subtotal: subtotalTrx,
          total_trx: totalWithPpn,
          total_items: items.length,
          items,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        summary: {
          total_transactions: transactions.length,
          total_qty: totalQtyAll,
          grand_total: grandTotal,
        },
        filters: {
          tgl_from,
          tgl_to,
          supplier,
          bahan,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Laporan Barang Masuk error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data laporan barang masuk.' },
      { status: 500 }
    );
  }
}
