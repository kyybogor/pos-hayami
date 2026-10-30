import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import poolServer from '@/lib/db_server';
import poolLocal from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;

    const userBranch = session?.branch || '';
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';

    const { searchParams } = new URL(req.url);
    const tglFrom = searchParams.get('tgl_from');
    const tglTo = searchParams.get('tgl_to');
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    // Build query for remote server database (gdo1 table)
    let whereClause = "WHERE a.status != 'Void' AND a.no_inv != ''";
    const queryParams: any[] = [];

    if (effectiveBranch) {
      whereClause += ' AND a.id_cust = ?';
      queryParams.push(effectiveBranch);
    }

    if (tglFrom && tglTo) {
      whereClause += ' AND a.tgl BETWEEN ? AND ?';
      queryParams.push(tglFrom, tglTo);
    }

    const limitClause = tglFrom && tglTo ? '' : ' LIMIT 50';

    const serverSql = `SELECT a.* FROM gdo1 a ${whereClause} GROUP BY a.id_do1 ORDER BY a.tgl DESC${limitClause}`;

    // Query remote server
    let serverRows: RowDataPacket[] = [];
    try {
      const [rows] = await poolServer.query<RowDataPacket[]>(serverSql, queryParams);
      serverRows = rows;
    } catch (err) {
      console.error('Remote server connection error:', err);
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal terhubung ke Database Server Online (103.127.133.167).',
        },
        { status: 502 }
      );
    }

    // For each record, check local status in tb_barang_masuk
    const processedRows = await Promise.all(
      serverRows.map(async (row) => {
        let isApproved = false;
        let isStockedIn = false;
        let localStatus = 'Unapproved';

        const cleanNoInv = (row.no_inv || '').trim();
        const cleanIdDo = (row.id_do1 || '').trim();

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

          let localCheck: RowDataPacket[] = [];
          if (conditions.length > 0) {
            const sql = `SELECT no_id, status FROM tb_barang_masuk WHERE ${conditions.join(' OR ')} LIMIT 1`;
            const [rows] = await poolLocal.query<RowDataPacket[]>(sql, params);
            localCheck = rows;
          }

          if (localCheck.length > 0) {
            isStockedIn = true;
            const sts = localCheck[0];
            if (sts.status === 's') {
              isApproved = true;
              localStatus = 'Approved';
            } else {
              localStatus = 'Waiting Approval';
            }
          } else {
            isStockedIn = false;
            if (row.approve && row.approve !== '') {
              isApproved = true;
              localStatus = 'Approved';
            } else {
              isApproved = false;
              localStatus = 'Unapproved';
            }
          }
        } catch (localErr) {
          console.warn('Local status check warning:', localErr);
        }

        return {
          id_do1: row.id_do1,
          id_cust: row.id_cust,
          no_inv: row.no_inv,
          tgltop: row.tgltop,
          tgl: row.tgl,
          qty: Number(row.qty) || 0, // Formatted as clean number without trailing .00
          ttlhrg: Number(row.ttlhrg) || 0,
          grandttl: Number(row.grandttl) || 0,
          approve: row.approve,
          status: row.status,
          localStatus,
          isStockedIn,
          isApproved,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: processedRows,
    });
  } catch (error: any) {
    console.error('Barang masuk online error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan sistem saat mengambil data.' },
      { status: 500 }
    );
  }
}
