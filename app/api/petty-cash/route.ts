import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 1. GET: Fetch Petty Cash Listing & Balances
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const defaultFrom = `${year}-${month}-01`;
    const defaultTo = `${year}-${month}-${day}`;

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const tgl_from = searchParams.get('tgl_from') || searchParams.get('from') || defaultFrom;
    const tgl_to = searchParams.get('tgl_to') || searchParams.get('to') || defaultTo;
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    let cabangFilterSql = '';
    const cabangParams: any[] = [];
    if (effectiveBranch) {
      cabangFilterSql = ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
      cabangParams.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    // A. Calculate Initial Balance (Saldo Awal) before tgl_from
    const [saldoAwalRows] = await pool.query<RowDataPacket[]>(
      `SELECT SUM(in_cash) as ttl_in, SUM(out_cash) as ttl_out 
       FROM tb_petty_cash 
       WHERE tgl < ? ${cabangFilterSql}`,
      [tgl_from, ...cabangParams]
    );

    const ttlInAwal = Number(saldoAwalRows[0]?.ttl_in) || 0;
    const ttlOutAwal = Number(saldoAwalRows[0]?.ttl_out) || 0;
    const saldoAwal = ttlInAwal - ttlOutAwal;

    // B. Fetch all records within the date range to compute running balances
    const [allPeriodRows] = await pool.query<RowDataPacket[]>(
      `SELECT id_petty, tgl, keterangan, in_cash, out_cash, bukti_petty, dibuat_oleh, dibuat_tgl, diubah_oleh, diubah_tgl
       FROM tb_petty_cash 
       WHERE tgl BETWEEN ? AND ? ${cabangFilterSql}
       ORDER BY tgl ASC, id_petty ASC`,
      [tgl_from, tgl_to, ...cabangParams]
    );

    let runningSaldo = saldoAwal;
    let totalInCash = 0;
    let totalOutCash = 0;

    const processedItems = allPeriodRows.map((r) => {
      const inVal = Number(r.in_cash) || 0;
      const outVal = Number(r.out_cash) || 0;

      totalInCash += inVal;
      totalOutCash += outVal;

      runningSaldo = runningSaldo + inVal - outVal;

      return {
        id_petty: r.id_petty,
        tgl: r.tgl,
        keterangan: r.keterangan || '',
        in_cash: inVal,
        out_cash: outVal,
        saldo: runningSaldo,
        bukti_petty: r.bukti_petty || '',
        dibuat_oleh: r.dibuat_oleh || '',
        dibuat_tgl: r.dibuat_tgl,
      };
    });

    const saldoAkhir = runningSaldo;
    const totalItems = processedItems.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    // Paginate in memory
    const paginatedItems = processedItems.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        items: paginatedItems,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
          from_item: totalItems > 0 ? offset + 1 : 0,
          to_item: Math.min(offset + limit, totalItems),
        },
        summary: {
          saldo_awal: saldoAwal,
          total_in: totalInCash,
          total_out: totalOutCash,
          saldo_akhir: saldoAkhir,
        },
        filters: {
          tgl_from,
          tgl_to,
        },
      },
    });
  } catch (error: any) {
    console.error('Fetch Petty Cash error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data petty cash.' },
      { status: 500 }
    );
  }
}

// 2. POST: Create or Update Petty Cash Entry
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id_petty, petty_tipe, tgl_petty, keterangan, jumlah, id_cabang } = body;

    if (!petty_tipe || !tgl_petty || jumlah === undefined) {
      return NextResponse.json(
        { success: false, message: 'Tipe, Tanggal, dan Jumlah wajib diisi.' },
        { status: 400 }
      );
    }

    let branchName = id_cabang || '';
    if (!branchName) {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('pos_session')?.value;
        if (token) {
          const session = await verifySessionToken(token);
          if (session) {
            branchName = session.grup || session.branch || '';
          }
        }
      } catch (e) {}
    }
    if (!branchName) {
      branchName = 'TKA-JATINEGARA-JAKARTA';
    }

    const branchCode = getBranchCode(branchName);

    const numJumlah = Math.abs(parseFloat(String(jumlah).replace(/,/g, ''))) || 0;
    const inCash = petty_tipe === 'in' ? numJumlah : 0;
    const outCash = petty_tipe === 'out' ? numJumlah : 0;
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (!id_petty || id_petty.trim() === '') {
      // Auto-generate new Kode Petty: PTY-JTG-YY-000001
      const yearSuffix = new Date().getFullYear().toString().slice(-2);
      const prefixPattern = `PTY-${branchCode}-${yearSuffix}-%`;

      const [maxRows] = await pool.query<RowDataPacket[]>(
        `SELECT max(id_petty) as kodeTerbesar FROM tb_petty_cash WHERE id_petty LIKE ? OR id_petty LIKE ?`,
        [prefixPattern, `PTY-${yearSuffix}-%`]
      );

      let newKode = `PTY-${branchCode}-${yearSuffix}-000001`;
      if (maxRows[0]?.kodeTerbesar) {
        const kodeStr = maxRows[0].kodeTerbesar;
        const match = kodeStr.match(/\d+$/);
        if (match) {
          const currentUrutan = parseInt(match[0], 10) || 0;
          const nextUrutan = currentUrutan + 1;
          newKode = `PTY-${branchCode}-${yearSuffix}-${String(nextUrutan).padStart(6, '0')}`;
        }
      }

      await pool.query<ResultSetHeader>(
        `INSERT INTO tb_petty_cash (
           id_petty, tgl, keterangan, in_cash, out_cash, bukti_petty, dibuat_oleh, dibuat_tgl, id_cabang
         ) VALUES (?, ?, ?, ?, ?, '', 'admin', ?, ?)`,
        [newKode, tgl_petty, keterangan || '', inCash, outCash, nowStr, branchName]
      );

      return NextResponse.json({
        success: true,
        message: 'Berhasil menambah data petty cash.',
        id_petty: newKode,
      });
    } else {
      // Update existing Petty Cash entry
      await pool.query<ResultSetHeader>(
        `UPDATE tb_petty_cash SET
           tgl = ?,
           keterangan = ?,
           in_cash = ?,
           out_cash = ?,
           diubah_oleh = 'admin',
           diubah_tgl = ?
         WHERE id_petty = ?`,
        [tgl_petty, keterangan || '', inCash, outCash, nowStr, id_petty]
      );

      return NextResponse.json({
        success: true,
        message: 'Berhasil memperbarui data petty cash.',
        id_petty,
      });
    }
  } catch (error: any) {
    console.error('Save Petty Cash error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan data petty cash.' },
      { status: 500 }
    );
  }
}

// 3. DELETE: Remove Petty Cash Entry
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id_petty = searchParams.get('id_petty');

    if (!id_petty) {
      return NextResponse.json(
        { success: false, message: 'ID Petty Cash wajib diisi.' },
        { status: 400 }
      );
    }

    await pool.query<ResultSetHeader>(
      `DELETE FROM tb_petty_cash WHERE id_petty = ?`,
      [id_petty]
    );

    return NextResponse.json({
      success: true,
      message: 'Berhasil menghapus data petty cash.',
    });
  } catch (error: any) {
    console.error('Delete Petty Cash error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus data petty cash.' },
      { status: 500 }
    );
  }
}
