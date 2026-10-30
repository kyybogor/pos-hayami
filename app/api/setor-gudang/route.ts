import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import { getBranchCode } from '@/lib/branch';

export const dynamic = 'force-dynamic';

function formatMMYY(dateStr?: string): { mm: string; yy: string } {
  let d = new Date();
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      d = parsed;
    }
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return { mm, yy };
}

// 1. GET: Fetch previous deposits or preview current petty cash balance
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const preview = searchParams.get('preview') === '1';
    let cabang = searchParams.get('cabang') || '';

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';

    if (!isSuperAdmin && session?.branch) {
      cabang = session.branch;
    }

    // A. Detail single setor
    if (id) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.*, 
                c.alamat as cabang_alamat, 
                c.nomor_telepon as cabang_telp, 
                c.city as cabang_city
         FROM setor_gudang s
         LEFT JOIN tb_cabang c ON (c.nama_cabang = s.id_cabang COLLATE utf8mb4_unicode_ci OR CAST(c.id_cabang AS CHAR) = s.id_cabang COLLATE utf8mb4_unicode_ci)
         WHERE s.id = ? LIMIT 1`,
        [id]
      );

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Data setoran tidak ditemukan.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: rows[0],
      });
    }

    // B. Preview current petty cash balance for depositing (setoran harian)
    if (preview) {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetDate = searchParams.get('tgl') || searchParams.get('date') || todayStr;
      const cleanDate = /^\d{4}-\d{2}-\d{2}/.test(targetDate) ? targetDate.substring(0, 10) : todayStr;

      let branchFilterSql = '';
      const branchParams: any[] = [];
      if (cabang && cabang !== 'ALL') {
        branchFilterSql = ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
        branchParams.push(cabang, cabang, cabang);
      }

      // Filter khusus transaksi harian (tgl = cleanDate) agar transaksi keluar/masuk hari lain tidak ikut terhitung
      const [balanceRows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(in_cash), 0) as ttl_in, COALESCE(SUM(out_cash), 0) as ttl_out 
         FROM tb_petty_cash 
         WHERE tgl = ? ${branchFilterSql}`,
        [cleanDate, ...branchParams]
      );

      const ttlIn = Number(balanceRows[0]?.ttl_in) || 0;
      const ttlOut = Number(balanceRows[0]?.ttl_out) || 0;
      const saldoAktif = Math.max(0, ttlIn - ttlOut);

      const { mm, yy } = formatMMYY(cleanDate);
      const prefix = `INV-TOKO/${mm}${yy}/`;

      const [maxRows] = await pool.query<RowDataPacket[]>(
        `SELECT MAX(id) as max_id FROM setor_gudang WHERE id LIKE ?`,
        [`${prefix}%`]
      );

      const maxIdStr = String(maxRows[0]?.max_id || '');
      const seqMatch = maxIdStr.match(/\/(\d+)$/);
      const nextSeq = seqMatch ? Number(seqMatch[1]) + 1 : 1;
      const nextId = `${prefix}${String(nextSeq).padStart(4, '0')}`;

      // Get branch info
      let cabangInfo = null;
      if (cabang && cabang !== 'ALL') {
        const [cRows] = await pool.query<RowDataPacket[]>(
          `SELECT * FROM tb_cabang WHERE nama_cabang = ? OR id_cabang = ? LIMIT 1`,
          [cabang, cabang]
        );
        if (cRows.length > 0) cabangInfo = cRows[0];
      }

      return NextResponse.json({
        success: true,
        data: {
          next_id: nextId,
          total_in: ttlIn,
          total_out: ttlOut,
          saldo_aktif: saldoAktif,
          id_cabang: cabang,
          cabang_info: cabangInfo,
        },
      });
    }

    // C. List previous deposits
    let listWhere = '';
    const listParams: any[] = [];
    if (cabang && cabang !== 'ALL') {
      listWhere = ' WHERE id_cabang = ?';
      listParams.push(cabang);
    }

    const [listRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM setor_gudang ${listWhere} ORDER BY tgl_setor DESC, created_at DESC LIMIT 50`,
      listParams
    );

    return NextResponse.json({
      success: true,
      data: listRows,
    });
  } catch (error: any) {
    console.error('GET Setor Gudang error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data setor gudang.' },
      { status: 500 }
    );
  }
}

// 2. POST: Execute deposit ("Setor Kas ke Gudang")
export async function POST(req: NextRequest) {
  const conn = await pool.getConnection();
  try {
    const body = await req.json();
    let { id_cabang, nominal_setor, tgl_setor, keterangan, kasir } = body;

    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';

    if (!isSuperAdmin && session?.branch) {
      id_cabang = session.branch;
    }

    if (!id_cabang || id_cabang === 'ALL') {
      return NextResponse.json(
        { success: false, message: 'Cabang toko wajib ditentukan untuk proses setor kas.' },
        { status: 400 }
      );
    }

    // Resolve numeric id_cabang to nama_cabang if necessary
    if (/^\d+$/.test(String(id_cabang).trim())) {
      const [bRows] = await conn.query<RowDataPacket[]>(
        'SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1',
        [id_cabang]
      );
      if (bRows.length > 0 && bRows[0].nama_cabang) {
        id_cabang = bRows[0].nama_cabang;
      }
    }

    if (!kasir) {
      kasir = session?.nm_user || session?.id_user || 'Admin';
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const cleanDate = tgl_setor && /^\d{4}-\d{2}-\d{2}/.test(tgl_setor) ? tgl_setor.substring(0, 10) : todayStr;

    await conn.beginTransaction();

    // 1. Calculate and lock current daily petty cash balance for this branch and date
    const branchFilterSql = ' AND (id_cabang = ? OR id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = id_cabang)';
    const [balanceRows] = await conn.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(in_cash), 0) as ttl_in, COALESCE(SUM(out_cash), 0) as ttl_out 
       FROM tb_petty_cash 
       WHERE tgl = ? ${branchFilterSql} FOR UPDATE`,
      [cleanDate, id_cabang, id_cabang, id_cabang]
    );

    const ttlIn = Number(balanceRows[0]?.ttl_in) || 0;
    const ttlOut = Number(balanceRows[0]?.ttl_out) || 0;
    const saldoSebelum = ttlIn - ttlOut;

    if (saldoSebelum <= 0) {
      await conn.rollback();
      return NextResponse.json(
        { success: false, message: `Saldo kas kecil saat ini adalah Rp ${saldoSebelum.toLocaleString('id-ID')}. Tidak ada saldo untuk disetor.` },
        { status: 400 }
      );
    }

    // Default nominal setor to entire remaining balance if not explicitly specified
    const nominal = nominal_setor !== undefined && nominal_setor !== null && nominal_setor !== '' 
      ? Number(nominal_setor) 
      : saldoSebelum;

    if (isNaN(nominal) || nominal <= 0) {
      await conn.rollback();
      return NextResponse.json(
        { success: false, message: 'Nominal setor harus berupa angka lebih dari 0.' },
        { status: 400 }
      );
    }

    if (nominal > saldoSebelum) {
      await conn.rollback();
      return NextResponse.json(
        { 
          success: false, 
          message: `Nominal setor (Rp ${nominal.toLocaleString('id-ID')}) melebihi sisa saldo kas saat ini (Rp ${saldoSebelum.toLocaleString('id-ID')}).` 
        },
        { status: 400 }
      );
    }

    // 2. Generate ID manual: INV-TOKO/MMYY/XXXX
    const { mm, yy } = formatMMYY(cleanDate);
    const prefix = `INV-TOKO/${mm}${yy}/`;

    const [maxSetorRows] = await conn.query<RowDataPacket[]>(
      `SELECT MAX(id) as max_id FROM setor_gudang WHERE id LIKE ? FOR UPDATE`,
      [`${prefix}%`]
    );

    const maxIdStr = String(maxSetorRows[0]?.max_id || '');
    const seqMatch = maxIdStr.match(/\/(\d+)$/);
    const nextSeq = seqMatch ? Number(seqMatch[1]) + 1 : 1;
    const idSetor = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    // 3. Generate Petty Cash ID for out_cash entry
    const branchCode = getBranchCode(id_cabang);
    const pettyPrefix = `PTY-${branchCode}-${yy}-`;
    const [maxPettyRows] = await conn.query<RowDataPacket[]>(
      `SELECT MAX(id_petty) as max_id FROM tb_petty_cash 
       WHERE id_petty LIKE ? OR id_petty LIKE ? FOR UPDATE`,
      [`${pettyPrefix}%`, `PTY-${yy}-%`]
    );

    const lastPettySequence = String(maxPettyRows[0]?.max_id || '').match(/\d+$/);
    const nextPettySequence = lastPettySequence ? Number(lastPettySequence[0]) + 1 : 1;
    const pettyId = `${pettyPrefix}${String(nextPettySequence).padStart(6, '0')}`;

    const defaultKet = keterangan?.trim() || `Setoran Kas Kecil Toko ke Gudang (${idSetor})`;

    // 4. Insert into tb_petty_cash as out_cash (reducing petty cash balance)
    await conn.query<ResultSetHeader>(
      `INSERT INTO tb_petty_cash (
        id_petty, tgl, keterangan, in_cash, out_cash, bukti_petty, dibuat_oleh, dibuat_tgl, id_cabang
      ) VALUES (?, ?, ?, 0, ?, ?, ?, NOW(), ?)`,
      [
        pettyId,
        cleanDate,
        defaultKet,
        nominal,
        idSetor,
        kasir,
        id_cabang,
      ]
    );

    const saldoAkhir = saldoSebelum - nominal;
    const grandtotal = nominal;
    const hutang = nominal; // Sesuai instruksi: grandtotal dan hutang nilainya sama

    // 5. Insert into setor_gudang table
    await conn.query<ResultSetHeader>(
      `INSERT INTO setor_gudang (
        id, tgl_setor, grandtotal, hutang, id_cabang,
        total_masuk, total_keluar, saldo_sebelum, nominal_setor, saldo_akhir,
        keterangan, dibuat_oleh, dibuat_tgl, id_petty, status, is_sync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'SELESAI', 0)`,
      [
        idSetor,
        cleanDate,
        grandtotal,
        hutang,
        id_cabang,
        ttlIn,
        ttlOut + nominal,
        saldoSebelum,
        nominal,
        saldoAkhir,
        defaultKet,
        kasir,
        pettyId,
      ]
    );

    await conn.commit();

    // 6. Fetch branch details for receipt header
    const [cRows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM tb_cabang WHERE nama_cabang = ? OR id_cabang = ? LIMIT 1`,
      [id_cabang, id_cabang]
    );
    const cabangInfo = cRows.length > 0 ? cRows[0] : null;

    return NextResponse.json({
      success: true,
      message: 'Setoran kas ke gudang berhasil diproses.',
      data: {
        id: idSetor,
        tgl_setor: cleanDate,
        grandtotal,
        hutang,
        id_cabang,
        total_masuk: ttlIn,
        total_keluar: ttlOut + nominal,
        saldo_sebelum: saldoSebelum,
        nominal_setor: nominal,
        saldo_akhir: saldoAkhir,
        keterangan: defaultKet,
        dibuat_oleh: kasir,
        dibuat_tgl: new Date().toISOString(),
        id_petty: pettyId,
        cabang_info: cabangInfo,
      },
    });
  } catch (error: any) {
    await conn.rollback();
    console.error('POST Setor Gudang error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memproses setoran ke gudang.' },
      { status: 500 }
    );
  } finally {
    conn.release();
  }
}
