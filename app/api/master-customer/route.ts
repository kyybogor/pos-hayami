import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { md5 } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Helper to auto-generate Next Customer ID (matching native generate_customer())
async function generateNextCustomerId(): Promise<string> {
  const now = new Date();
  const yearShort = now.getFullYear().toString().slice(-2);
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `CUS-${yearShort}${monthStr}`;

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT MAX(id_customer) as kodeTerbesar FROM tb_customer WHERE id_customer LIKE ?',
    [`%${prefix}%`]
  );

  let sequence = 1;
  if (rows.length > 0 && rows[0].kodeTerbesar) {
    const lastCode = rows[0].kodeTerbesar;
    const numPart = parseInt(lastCode.slice(-6), 10);
    if (!isNaN(numPart)) {
      sequence = numPart + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(6, '0')}`;
}

// GET /api/master-customer
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || searchParams.get('search_nm_cust') || '';
    const getNextId = searchParams.get('generate_id') === 'true';

    if (getNextId) {
      const nextId = await generateNextCustomerId();
      return NextResponse.json({ success: true, nextId });
    }

    let query = 'SELECT * FROM tb_customer';
    const queryParams: any[] = [];

    if (search.trim() !== '') {
      query += ' WHERE nama_customer LIKE ? OR id_customer LIKE ? OR kota LIKE ? OR no_telp LIKE ?';
      const term = `%${search.trim()}%`;
      queryParams.push(term, term, term, term);
    }

    query += ' ORDER BY id_customer ASC LIMIT 100';

    const [customers] = await pool.query<RowDataPacket[]>(query, queryParams);

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    console.error('Fetch customer error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data customer dari database.' },
      { status: 500 }
    );
  }
}

// POST /api/master-customer (Create or Upsert)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let {
      id_customer,
      nama_customer,
      kota,
      alamat_lengkap,
      no_telp,
      email,
      diskon_lusin,
      source_customer,
      no_npwp,
      nama_npwp,
      alamat_npwp,
      id_login,
      pass_login,
    } = body;

    if (!nama_customer || nama_customer.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Nama Customer wajib diisi!' },
        { status: 400 }
      );
    }

    // Auto generate ID if not provided
    if (!id_customer || id_customer.trim() === '') {
      id_customer = await generateNextCustomerId();
    }

    // Check if customer already exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id_customer FROM tb_customer WHERE id_customer = ?',
      [id_customer]
    );

    if (existing.length > 0) {
      // UPDATE existing customer
      let passUpdateSql = '';
      const updateParams: any[] = [
        nama_customer || '',
        kota || '',
        alamat_lengkap || '',
        no_telp || '',
        email || '',
        diskon_lusin || '0',
        source_customer || ' ',
        no_npwp || '',
        nama_npwp || '',
        alamat_npwp || '',
        id_login || '',
      ];

      if (pass_login && pass_login.trim() !== '') {
        passUpdateSql = 'pass_login = ?, ';
        updateParams.unshift(md5(pass_login));
      }

      updateParams.push(id_customer);

      await pool.query(
        `UPDATE tb_customer SET
          ${passUpdateSql}
          nama_customer = ?,
          kota = ?,
          alamat_lengkap = ?,
          no_telp = ?,
          email = ?,
          diskon_lusin = ?,
          source_customer = ?,
          no_npwp = ?,
          nama_npwp = ?,
          alamat_npwp = ?,
          id_login = ?
        WHERE id_customer = ?`,
        updateParams
      );

      return NextResponse.json({
        success: true,
        message: 'Ubah data customer berhasil!',
        id_customer,
      });
    } else {
      // INSERT new customer
      const hashedPass = pass_login && pass_login.trim() !== '' ? md5(pass_login) : '';

      await pool.query<ResultSetHeader>(
        `INSERT INTO tb_customer (
          id_customer,
          nama_customer,
          kota,
          alamat_lengkap,
          no_telp,
          email,
          diskon_lusin,
          source_customer,
          no_npwp,
          nama_npwp,
          alamat_npwp,
          id_login,
          pass_login
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id_customer,
          nama_customer,
          kota || '',
          alamat_lengkap || '',
          no_telp || '',
          email || '',
          diskon_lusin || '0',
          source_customer || ' ',
          no_npwp || '',
          nama_npwp || '',
          alamat_npwp || '',
          id_login || '',
          hashedPass,
        ]
      );

      return NextResponse.json({
        success: true,
        message: 'Simpan data customer berhasil!',
        id_customer,
      });
    }
  } catch (error: any) {
    console.error('Save customer error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menyimpan data customer.' },
      { status: 500 }
    );
  }
}
