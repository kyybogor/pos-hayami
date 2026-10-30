import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang ORDER BY id_cabang ASC'
    );
    return NextResponse.json({ success: true, cabang: rows });
  } catch (error: any) {
    console.error('Error fetching cabang:', error);
    return NextResponse.json({ success: false, cabang: [] }, { status: 500 });
  }
}
