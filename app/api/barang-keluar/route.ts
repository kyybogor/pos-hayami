import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const { searchParams } = new URL(request.url);
    const tglFrom = searchParams.get('tgl_from') || '';
    const tglTo = searchParams.get('tgl_to') || '';
    const customer = searchParams.get('customer') || '';
    const akun = searchParams.get('akun') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    let whereClause = `WHERE (a.no_id LIKE '%IK%' OR a.id_transaksi LIKE 'SO%' OR a.id_transaksi LIKE 'KRA%') AND (a.sts_void IS NULL OR a.sts_void != 1)`;
    const params: any[] = [];

    if (effectiveBranch) {
      whereClause += ` AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)`;
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tglFrom && tglTo) {
      whereClause += ` AND DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d') BETWEEN ? AND ?`;
      params.push(tglFrom, tglTo);
    } else if (tglFrom) {
      whereClause += ` AND DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d') >= ?`;
      params.push(tglFrom);
    } else if (tglTo) {
      whereClause += ` AND DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d') <= ?`;
      params.push(tglTo);
    } else {
      // Default: Display only TODAY'S transactions (CURDATE)
      whereClause += ` AND DATE_FORMAT(a.tgl_transaksi, '%Y-%m-%d') = CURDATE()`;
    }

    if (customer) {
      whereClause += ` AND (a.id_customer LIKE ? OR c.nama_customer LIKE ?)`;
      params.push(`%${customer}%`, `%${customer}%`);
    }

    if (akun) {
      whereClause += ` AND a.akun LIKE ?`;
      params.push(`%${akun}%`);
    }

    const query = `
      SELECT 
        a.id_transaksi,
        a.tgl_transaksi,
        a.tgl_jatuh_tempo,
        a.id_customer,
        IFNULL(c.nama_customer, a.id_customer) AS nama_customer,
        a.keterangan,
        a.status_keluar,
        a.sisa_bayar,
        a.status,
        a.sales,
        a.akun,
        IFNULL(ak.bank, a.akun) AS nama_akun,
        SUM(a.subtotal) AS subtotal_all,
        MAX(a.disc) AS disc_cust,
        MAX(a.disc_invoice) AS disc_invoice,
        MAX(r.invret) AS is_retur_inv
      FROM tb_barang_keluar a
      LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
      LEFT JOIN tb_akun ak ON a.akun = ak.tipe
      LEFT JOIN (SELECT DISTINCT invret FROM tb_retur WHERE invret IS NOT NULL AND invret != '') r ON a.id_transaksi = r.invret
      ${whereClause}
      GROUP BY a.id_transaksi
      ORDER BY a.id_transaksi DESC
      LIMIT 100
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Format transaction rows with exact total calculation
    const formattedData = rows.map((row) => {
      const subtotalAll = Number(row.subtotal_all) || 0;
      const discCust = Number(row.disc_cust) || 0;
      const discInvoice = Number(row.disc_invoice) || 0;
      const totalBelanja = Math.max(0, subtotalAll - (discCust + discInvoice));
      const isRetur = Boolean(row.is_retur_inv) || row.status === 'Retur';

      return {
        id_transaksi: row.id_transaksi,
        tgl_transaksi: row.tgl_transaksi,
        tgl_jatuh_tempo: row.tgl_jatuh_tempo,
        id_customer: row.id_customer,
        nama_customer: row.nama_customer || row.id_customer || 'CASH',
        keterangan: row.keterangan || '',
        status_keluar: row.status_keluar || '',
        sisa_bayar: Number(row.sisa_bayar) || 0,
        status: isRetur ? 'Retur' : row.status || '',
        is_retur: isRetur,
        sales: row.sales || '',
        akun: row.akun || '',
        nama_akun: row.nama_akun || row.akun || '',
        total_belanja: totalBelanja,
      };
    });

    // Calculate Summary Totals
    let totalCash = 0;
    let totalDebet = 0;
    let totalTransfer = 0;
    let totalHutang = 0;

    formattedData.forEach((item) => {
      const ak = (item.akun || '').toUpperCase();
      if (ak === 'CASH') totalCash += item.total_belanja;
      else if (ak === 'DEBET' || ak === 'EDC') totalDebet += item.total_belanja;
      else if (ak === 'TRANSFER') totalTransfer += item.total_belanja;
      else if (ak === 'HUTANG') totalHutang += item.total_belanja;
      else totalCash += item.total_belanja;
    });

    return NextResponse.json({
      success: true,
      data: formattedData,
      summary: {
        totalCash,
        totalDebet,
        totalTransfer,
        totalHutang,
      },
    });
  } catch (error: any) {
    console.error('Error fetching barang keluar list:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data barang keluar.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id_transaksi } = await request.json();

    if (!id_transaksi) {
      return NextResponse.json(
        { success: false, message: 'ID Transaksi wajib diisi.' },
        { status: 400 }
      );
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get transaction items to restore stock
      const [items] = await connection.query<RowDataPacket[]>(
        `SELECT id_bahan, model, ukuran, qty FROM tb_barang_keluar WHERE id_transaksi = ?`,
        [id_transaksi]
      );

      for (const item of items) {
        const { id_bahan, model, ukuran, qty } = item;

        // Restore stock in tb_stock
        await connection.query(
          `UPDATE tb_stock 
           SET stock = stock + ? 
           WHERE id_bahan = ? AND model = ? AND ukuran = ?`,
          [qty, id_bahan, model, ukuran]
        );

        // Restore summary stock in tb_bahan
        const qtyLusin = Number((qty / 12).toFixed(2));
        await connection.query(
          `UPDATE tb_bahan 
           SET total_qty = total_qty + ?, total_pcs = total_pcs + ? 
           WHERE nama_bahan = ?`,
          [qtyLusin, qty, id_bahan]
        );
      }

      // Mark transaction as void in tb_barang_keluar
      await connection.query(
        `UPDATE tb_barang_keluar SET sts_void = 1, sts = 0 WHERE id_transaksi = ?`,
        [id_transaksi]
      );

      // Delete payments
      await connection.query(
        `DELETE FROM tb_pembayaran WHERE id_pembayaran = ?`,
        [id_transaksi]
      );

      await connection.commit();
      return NextResponse.json({ success: true, message: 'Hapus invoice berhasil!' });
    } catch (err: any) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error('Error voiding barang keluar:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghapus invoice.' },
      { status: 500 }
    );
  }
}
