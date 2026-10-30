import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || '';
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || '';
    const date_detail_raw = searchParams.get('date_detail') || '';
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    // 1. IF DATE DETAIL IS REQUESTED (Modal View)
    if (date_detail_raw) {
      const cleanDate = parseToYmd(date_detail_raw);

      let branchSql = '';
      const detailParams: any[] = [cleanDate, cleanDate];
      if (effectiveBranch) {
        branchSql = ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
        detailParams.push(effectiveBranch, effectiveBranch, effectiveBranch);
      }

      const [detailRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
          id_petty,
          DATE_FORMAT(tgl, '%Y-%m-%d') as tgl,
          keterangan,
          out_cash,
          bukti_petty,
          dibuat_oleh,
          dibuat_tgl
         FROM tb_petty_cash
         WHERE out_cash > 0 AND (DATE(tgl) = ? OR tgl LIKE CONCAT(?, '%')) ${branchSql}
         ORDER BY id_petty DESC`,
        detailParams
      );

      const items = detailRows.map((r) => ({
        id_petty: r.id_petty,
        tgl: r.tgl || cleanDate,
        keterangan: r.keterangan || '-',
        out_cash: Number(r.out_cash) || 0,
        bukti_petty: r.bukti_petty || '',
        dibuat_oleh: r.dibuat_oleh || 'admin',
        dibuat_tgl: r.dibuat_tgl,
      }));

      const totalOut = items.reduce((acc, curr) => acc + curr.out_cash, 0);

      return NextResponse.json({
        success: true,
        data: {
          tgl_transaksi: cleanDate,
          total_pengeluaran: totalOut,
          count_items: items.length,
          items,
        },
      });
    }

    // 2. DAILY AGGREGATION SUMMARY
    let whereSql = 'WHERE out_cash > 0';
    const params: any[] = [];

    if (effectiveBranch) {
      whereSql += ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereSql += ' AND (DATE(tgl) BETWEEN ? AND ?)';
      params.push(tgl_from, tgl_to);
    } else if (tgl_from) {
      whereSql += ' AND DATE(tgl) >= ?';
      params.push(tgl_from);
    } else if (tgl_to) {
      whereSql += ' AND DATE(tgl) <= ?';
      params.push(tgl_to);
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        DATE_FORMAT(tgl, '%Y-%m-%d') as tgl_key,
        SUM(out_cash) as total_pengeluaran,
        COUNT(id_petty) as total_items
       FROM tb_petty_cash
       ${whereSql}
       GROUP BY DATE_FORMAT(tgl, '%Y-%m-%d')
       ORDER BY tgl_key DESC`,
      params
    );

    const list = rows.map((r) => {
      const dateKey = parseToYmd(String(r.tgl_key || ''));
      return {
        tgl_transaksi: dateKey,
        total_pengeluaran: Number(r.total_pengeluaran) || 0,
        count_transaksi: Number(r.total_items) || 0,
      };
    });

    const grandTotalOut = list.reduce((sum, item) => sum + item.total_pengeluaran, 0);
    const totalTransactions = list.reduce((sum, item) => sum + item.count_transaksi, 0);
    const totalDays = list.length;
    const avgDaily = totalDays > 0 ? Math.round(grandTotalOut / totalDays) : 0;

    return NextResponse.json({
      success: true,
      summary: {
        total_pengeluaran: grandTotalOut,
        total_transaksi: totalTransactions,
        total_hari: totalDays,
        rata_rata_harian: avgDaily,
      },
      data: list,
    });
  } catch (error: any) {
    console.error('Error in GET /api/laporan-pengeluaran:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
