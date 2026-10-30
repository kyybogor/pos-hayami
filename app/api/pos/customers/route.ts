import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id_customer, nama_customer, diskon_lusin, no_telp, alamat_lengkap, kota, email FROM tb_customer ORDER BY nama_customer ASC`
    );

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data customer.' },
      { status: 500 }
    );
  }
}
