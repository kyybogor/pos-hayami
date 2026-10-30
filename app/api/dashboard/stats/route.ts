import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'monthly'; // 'today', 'daily', 'range', 'monthly', 'yearly'
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const tglFrom = searchParams.get('tgl_from') || new Date().toISOString().split('T')[0];
    const tglTo = searchParams.get('tgl_to') || new Date().toISOString().split('T')[0];
    const month = searchParams.get('month') || String(new Date().getMonth() + 1);
    const year = searchParams.get('year') || String(new Date().getFullYear());
    const cabang = searchParams.get('cabang') || 'ALL';

    // 1. Fetch Cabang List from DB to prevent collation mismatch
    const [cabangRows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang ORDER BY id_cabang ASC'
    );

    let cabangFilterSQL = '';
    const cabangParams: string[] = [];

    if (cabang && cabang !== 'ALL') {
      const match = cabangRows.find(
        (c) => String(c.id_cabang) === String(cabang) || String(c.nama_cabang) === String(cabang)
      );
      if (match) {
        cabangFilterSQL = ` AND (id_cabang = ? OR id_cabang = ?)`;
        cabangParams.push(String(match.id_cabang), String(match.nama_cabang));
      } else {
        cabangFilterSQL = ` AND id_cabang = ?`;
        cabangParams.push(cabang);
      }
    }

    // 2. Prepare Base SQL WHERE Clauses for Date Filtering
    let salesWhere = `WHERE (sts_void IS NULL OR sts_void != 1)`;
    let stockInWhere = `WHERE 1=1`;
    let returWhere = `WHERE 1=1`;
    let pettyWhere = `WHERE 1=1`;

    const salesParams: any[] = [];
    const stockInParams: any[] = [];
    const returParams: any[] = [];
    const pettyParams: any[] = [];

    if (mode === 'today') {
      salesWhere += ` AND DATE(tgl_transaksi) = CURDATE()`;
      stockInWhere += ` AND DATE(tgl_transaksi) = CURDATE()`;
      returWhere += ` AND DATE(tgl_transaksi) = CURDATE()`;
      pettyWhere += ` AND DATE(tgl) = CURDATE()`;
    } else if (mode === 'daily' && date) {
      salesWhere += ` AND DATE(tgl_transaksi) = ?`;
      salesParams.push(date);
      stockInWhere += ` AND DATE(tgl_transaksi) = ?`;
      stockInParams.push(date);
      returWhere += ` AND DATE(tgl_transaksi) = ?`;
      returParams.push(date);
      pettyWhere += ` AND DATE(tgl) = ?`;
      pettyParams.push(date);
    } else if (mode === 'range' && tglFrom && tglTo) {
      salesWhere += ` AND DATE(tgl_transaksi) BETWEEN ? AND ?`;
      salesParams.push(tglFrom, tglTo);
      stockInWhere += ` AND DATE(tgl_transaksi) BETWEEN ? AND ?`;
      stockInParams.push(tglFrom, tglTo);
      returWhere += ` AND DATE(tgl_transaksi) BETWEEN ? AND ?`;
      returParams.push(tglFrom, tglTo);
      pettyWhere += ` AND DATE(tgl) BETWEEN ? AND ?`;
      pettyParams.push(tglFrom, tglTo);
    } else if (mode === 'yearly' && year) {
      salesWhere += ` AND YEAR(tgl_transaksi) = ?`;
      salesParams.push(year);
      stockInWhere += ` AND YEAR(tgl_transaksi) = ?`;
      stockInParams.push(year);
      returWhere += ` AND YEAR(tgl_transaksi) = ?`;
      returParams.push(year);
      pettyWhere += ` AND YEAR(tgl) = ?`;
      pettyParams.push(year);
    } else {
      // Monthly
      salesWhere += ` AND YEAR(tgl_transaksi) = ? AND MONTH(tgl_transaksi) = ?`;
      salesParams.push(year, month);
      stockInWhere += ` AND YEAR(tgl_transaksi) = ? AND MONTH(tgl_transaksi) = ?`;
      stockInParams.push(year, month);
      returWhere += ` AND YEAR(tgl_transaksi) = ? AND MONTH(tgl_transaksi) = ?`;
      returParams.push(year, month);
      pettyWhere += ` AND YEAR(tgl) = ? AND MONTH(tgl) = ?`;
      pettyParams.push(year, month);
    }

    // Append Cabang Filter SQL
    if (cabangFilterSQL) {
      salesWhere += cabangFilterSQL;
      salesParams.push(...cabangParams);

      stockInWhere += cabangFilterSQL;
      stockInParams.push(...cabangParams);

      returWhere += cabangFilterSQL;
      returParams.push(...cabangParams);

      pettyWhere += cabangFilterSQL;
      pettyParams.push(...cabangParams);
    }

    // 3. Fetch Sales Summary (Omset Penjualan)
    const salesQuery = `
      SELECT 
        COUNT(DISTINCT id_transaksi) as total_tx,
        SUM(subtotal) as subtotal_all,
        SUM(disc) as disc_cust,
        SUM(disc_invoice) as disc_inv,
        SUM(qty) as total_qty
      FROM tb_barang_keluar
      ${salesWhere}
    `;
    const [salesRows] = await pool.query<RowDataPacket[]>(salesQuery, salesParams);
    const subtotalAll = Number(salesRows[0]?.subtotal_all) || 0;
    const discCust = Number(salesRows[0]?.disc_cust) || 0;
    const discInv = Number(salesRows[0]?.disc_inv) || 0;
    const totalOmset = Math.max(0, subtotalAll - (discCust + discInv));
    const totalDiscount = discCust + discInv;

    // 4. Fetch Payment Breakdown
    const paymentQuery = `
      SELECT 
        UPPER(TRIM(akun)) as akun_name,
        SUM(subtotal - IFNULL(disc,0) - IFNULL(disc_invoice,0)) as total_rp
      FROM tb_barang_keluar
      ${salesWhere}
      GROUP BY UPPER(TRIM(akun))
    `;
    const [payRows] = await pool.query<RowDataPacket[]>(paymentQuery, salesParams);

    let cashAmount = 0;
    let debetAmount = 0;
    let transferAmount = 0;
    let hutangAmount = 0;

    payRows.forEach((r) => {
      const name = r.akun_name || '';
      const rp = Math.max(0, Number(r.total_rp) || 0);
      if (name.includes('CASH')) cashAmount += rp;
      else if (name.includes('DEBET') || name.includes('EDC')) debetAmount += rp;
      else if (name.includes('TRANSFER')) transferAmount += rp;
      else if (name.includes('HUTANG')) hutangAmount += rp;
      else cashAmount += rp;
    });

    // 5. Fetch Stock In Summary (Barang Masuk)
    const stockInQuery = `
      SELECT 
        COUNT(DISTINCT id_transaksi) as total_tx,
        SUM(subtotal) as total_rp,
        SUM(qty) as total_qty
      FROM tb_barang_masuk
      ${stockInWhere}
    `;
    const [stockInRows] = await pool.query<RowDataPacket[]>(stockInQuery, stockInParams);

    // 6. Fetch Retur Summary
    const returQuery = `
      SELECT 
        COUNT(DISTINCT id_transaksi) as total_tx,
        SUM(subtotal) as total_rp
      FROM tb_retur
      ${returWhere}
    `;
    const [returRows] = await pool.query<RowDataPacket[]>(returQuery, returParams);

    // 7. Fetch Petty Cash Summary
    const pettyQuery = `
      SELECT 
        COUNT(DISTINCT id_petty) as total_tx,
        SUM(out_cash) as total_out,
        SUM(in_cash) as total_in
      FROM tb_petty_cash
      ${pettyWhere}
    `;
    const [pettyRows] = await pool.query<RowDataPacket[]>(pettyQuery, pettyParams);

    // 8b. Fetch Piutang Pending (unpaid hutang)
    const piutangQuery = `
      SELECT SUM(subtotal - IFNULL(disc,0) - IFNULL(disc_invoice,0) - IFNULL(sisa_bayar,0)) as total_piutang
      FROM tb_barang_keluar
      ${salesWhere} AND UPPER(TRIM(akun)) = 'HUTANG' AND (status IS NULL OR status != 'Lunas')
    `;
    let totalPiutangPending = 0;
    try {
      const [piutangRows] = await pool.query<RowDataPacket[]>(piutangQuery, salesParams);
      totalPiutangPending = Math.max(0, Number(piutangRows[0]?.total_piutang) || 0);
    } catch (e) {
      console.warn('Piutang query warning:', e);
    }

    // 8c. Fetch Low Stock Count & Items
    let lowStockCount = 0;
    let lowStockItems: RowDataPacket[] = [];
    try {
      const [lowCountRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total_low FROM tb_stock WHERE stock <= 10`
      );
      lowStockCount = Number(lowCountRows[0]?.total_low) || 0;
      const [lowItems] = await pool.query<RowDataPacket[]>(
        `SELECT id_bahan, model, ukuran, stock FROM tb_stock WHERE stock <= 10 ORDER BY stock ASC LIMIT 5`
      );
      lowStockItems = lowItems;
    } catch (e) {
      console.warn('Low stock query warning:', e);
    }

    // 8d. Aging Stock (tb_stock stock>0 JOIN tb_barang_masuk, latest tgl_transaksi, hitung hari)
    let agingStockItems: RowDataPacket[] = [];
    try {
      const [agingRows] = await pool.query<RowDataPacket[]>(
        `SELECT
           s.id_bahan,
           s.model,
           s.ukuran,
           s.stock,
           MAX(m.tgl_transaksi) AS last_restock,
           DATEDIFF(CURDATE(), MAX(m.tgl_transaksi)) AS aging_days
         FROM tb_stock s
         LEFT JOIN tb_barang_masuk m
           ON m.id_product = s.id_bahan
           AND m.model = s.model
           AND m.ukuran = s.ukuran
         WHERE s.stock > 0
         GROUP BY s.id_bahan, s.model, s.ukuran, s.stock
         ORDER BY aging_days DESC
         LIMIT 50`
      );
      agingStockItems = agingRows;
    } catch (e) {
      console.warn('Aging stock query warning:', e);
    }

    // 8e. Top 10 Customers (tb_barang_keluar, id_customer not empty, most frequent buyer)
    let topCustomers: RowDataPacket[] = [];
    try {
      const [custRows] = await pool.query<RowDataPacket[]>(
        `SELECT
           a.id_customer,
           IFNULL(c.nama_customer, a.id_customer) AS nama_customer,
           COUNT(DISTINCT a.id_transaksi) AS total_transaksi,
           SUM(a.subtotal - IFNULL(a.disc,0) - IFNULL(a.disc_invoice,0)) AS total_belanja
         FROM tb_barang_keluar a
         LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
         WHERE a.id_customer IS NOT NULL
           AND TRIM(a.id_customer) != ''
           AND (a.sts_void IS NULL OR a.sts_void != 1)
         GROUP BY a.id_customer, nama_customer
         ORDER BY total_transaksi DESC
         LIMIT 10`
      );
      topCustomers = custRows;
    } catch (e) {
      console.warn('Top customers query warning:', e);
    }

    // 8. Chart Trend Data Generation (Normal Daily/Monthly/Yearly Trend)
    const chartTrend: { label: string; sales: number; stockIn: number; txCount: number }[] = [];

    if (mode === 'today' || mode === 'daily') {
      // 7 Days Daily Trend up to selected date
      const targetDay = mode === 'today' ? new Date().toISOString().split('T')[0] : date;
      const trendWhere = `WHERE (sts_void IS NULL OR sts_void != 1) AND DATE(tgl_transaksi) BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ? ${cabangFilterSQL}`;
      const trendParams = [targetDay, targetDay, ...cabangParams];

      const trendSalesQuery = `
        SELECT 
          DATE_FORMAT(tgl_transaksi, '%d/%m') as period_label,
          DATE(tgl_transaksi) as dt,
          SUM(subtotal - IFNULL(disc,0) - IFNULL(disc_invoice,0)) as total_sales,
          COUNT(DISTINCT id_transaksi) as tx_count
        FROM tb_barang_keluar
        ${trendWhere}
        GROUP BY DATE(tgl_transaksi), period_label
        ORDER BY DATE(tgl_transaksi) ASC
      `;
      const [trendSalesRows] = await pool.query<RowDataPacket[]>(trendSalesQuery, trendParams);

      trendSalesRows.forEach((r) => {
        chartTrend.push({
          label: r.period_label || '-',
          sales: Math.max(0, Number(r.total_sales) || 0),
          stockIn: 0,
          txCount: Number(r.tx_count) || 0,
        });
      });
    } else if (mode === 'monthly') {
      // Daily Trend for all days of the selected month
      const targetYear = Number(year) || new Date().getFullYear();
      const targetMonth = Number(month) || new Date().getMonth() + 1;
      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

      const trendSalesQuery = `
        SELECT 
          DAY(tgl_transaksi) as dy,
          SUM(subtotal - IFNULL(disc,0) - IFNULL(disc_invoice,0)) as total_sales,
          COUNT(DISTINCT id_transaksi) as tx_count
        FROM tb_barang_keluar
        ${salesWhere}
        GROUP BY dy
        ORDER BY dy ASC
      `;
      const [salesDy] = await pool.query<RowDataPacket[]>(trendSalesQuery, salesParams);

      const dySalesMap = new Map<number, { sales: number; txCount: number }>();
      salesDy.forEach((r) => dySalesMap.set(Number(r.dy), { sales: Math.max(0, Number(r.total_sales) || 0), txCount: Number(r.tx_count) || 0 }));

      for (let d = 1; d <= daysInMonth; d++) {
        const dayLabel = String(d).padStart(2, '0');
        const salesData = dySalesMap.get(d) || { sales: 0, txCount: 0 };
        chartTrend.push({
          label: dayLabel,
          sales: salesData.sales,
          stockIn: 0,
          txCount: salesData.txCount,
        });
      }
    } else if (mode === 'yearly') {
      // 12 Months Trend for the selected year
      const monthsNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

      const trendSalesQuery = `
        SELECT 
          MONTH(tgl_transaksi) as mth,
          SUM(subtotal - IFNULL(disc,0) - IFNULL(disc_invoice,0)) as total_sales,
          COUNT(DISTINCT id_transaksi) as tx_count
        FROM tb_barang_keluar
        ${salesWhere}
        GROUP BY mth
        ORDER BY mth ASC
      `;
      const [salesMth] = await pool.query<RowDataPacket[]>(trendSalesQuery, salesParams);

      const mthSalesMap = new Map<number, { sales: number; txCount: number }>();
      salesMth.forEach((r) => mthSalesMap.set(Number(r.mth), { sales: Math.max(0, Number(r.total_sales) || 0), txCount: Number(r.tx_count) || 0 }));

      for (let m = 1; m <= 12; m++) {
        const monthLabel = monthsNames[m - 1];
        const salesData = mthSalesMap.get(m) || { sales: 0, txCount: 0 };
        chartTrend.push({
          label: monthLabel,
          sales: salesData.sales,
          stockIn: 0,
          txCount: salesData.txCount,
        });
      }
    } else {
      // Range Mode (Daily Trend between tglFrom and tglTo)
      const trendSalesQuery = `
        SELECT 
          DATE_FORMAT(tgl_transaksi, '%d/%m') as period_label,
          DATE(tgl_transaksi) as dt,
          SUM(subtotal - IFNULL(disc,0) - IFNULL(disc_invoice,0)) as total_sales,
          COUNT(DISTINCT id_transaksi) as tx_count
        FROM tb_barang_keluar
        ${salesWhere}
        GROUP BY dt, period_label
        ORDER BY dt ASC
        LIMIT 31
      `;
      const [trendSalesRows] = await pool.query<RowDataPacket[]>(trendSalesQuery, salesParams);

      trendSalesRows.forEach((r) => {
        chartTrend.push({
          label: r.period_label || '-',
          sales: Math.max(0, Number(r.total_sales) || 0),
          stockIn: 0,
          txCount: Number(r.tx_count) || 0,
        });
      });
    }

    // 9. Fetch Top 5 Selling Products
    const topProductsQuery = `
      SELECT 
        id_bahan,
        model,
        ukuran,
        SUM(qty) as total_qty,
        SUM(subtotal - IFNULL(disc,0) - IFNULL(disc_invoice,0)) as total_rp
      FROM tb_barang_keluar
      ${salesWhere}
      GROUP BY id_bahan, model, ukuran
      ORDER BY total_qty DESC
      LIMIT 5
    `;
    const [topProducts] = await pool.query<RowDataPacket[]>(topProductsQuery, salesParams);

    // 10. Fetch 5 Recent Transactions
    const recentTxWhere = salesWhere.replaceAll('id_cabang', 'a.id_cabang').replaceAll('tgl_transaksi', 'a.tgl_transaksi').replaceAll('sts_void', 'a.sts_void');
    const recentTxQuery = `
      SELECT 
        a.id_transaksi,
        a.tgl_transaksi,
        IFNULL(c.nama_customer, a.id_customer) AS nama_customer,
        a.akun,
        a.status,
        SUM(a.subtotal - IFNULL(a.disc,0) - IFNULL(a.disc_invoice,0)) AS total_belanja
      FROM tb_barang_keluar a
      LEFT JOIN tb_customer c ON a.id_customer = c.id_customer
      ${recentTxWhere}
      GROUP BY a.id_transaksi
      ORDER BY a.tgl_transaksi DESC, a.id_transaksi DESC
      LIMIT 5
    `;
    const [recentTransactions] = await pool.query<RowDataPacket[]>(recentTxQuery, salesParams);

    const totalTxCount = Number(salesRows[0]?.total_tx) || 0;
    const totalQtySold = Number(salesRows[0]?.total_qty) || 0;
    const totalReturRp = Number(returRows[0]?.total_rp) || 0;
    const netOmset = Math.max(0, totalOmset - totalReturRp);
    const avgOrderValue = totalTxCount > 0 ? Math.round(totalOmset / totalTxCount) : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalOmset,
        netOmset,
        totalTransactions: totalTxCount,
        totalQtySold,
        avgOrderValue,
        totalDiscount,
        totalStockInRp: Number(stockInRows[0]?.total_rp) || 0,
        totalStockInTx: Number(stockInRows[0]?.total_tx) || 0,
        totalStockInQty: Number(stockInRows[0]?.total_qty) || 0,
        totalReturRp,
        totalPettyCash: Number(pettyRows[0]?.total_out) || 0,
        totalPiutangPending,
        lowStockCount,
      },
      paymentBreakdown: {
        cash: cashAmount,
        debet: debetAmount,
        transfer: transferAmount,
        hutang: hutangAmount,
      },
      chartTrend,
      topProducts,
      recentTransactions,
      lowStockItems,
      agingStockItems,
      topCustomers,
      cabangList: cabangRows,
    });
  } catch (error: any) {
    console.error('Error in dashboard stats API:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data statistik dashboard.' },
      { status: 500 }
    );
  }
}
