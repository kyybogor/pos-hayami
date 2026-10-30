import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id_cust_type, nm_type, percentage FROM tb_cust_type ORDER BY id_cust_type ASC`
    );

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('Fetch tb_cust_type error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data klasifikasi customer.' },
      { status: 500 }
    );
  }
}
