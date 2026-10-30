import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id_akun, tipe, bank, nama_akun, no_akun FROM tb_akun ORDER BY tipe ASC, bank ASC`
    );

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Error fetching akuns:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data akun.' },
      { status: 500 }
    );
  }
}
