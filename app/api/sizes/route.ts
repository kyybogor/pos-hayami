import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT nm_size FROM m_size ORDER BY nm_size ASC'
    );
    return NextResponse.json({
      success: true,
      data: rows.map((r) => r.nm_size),
    });
  } catch (error: any) {
    console.error('Fetch sizes error:', error);
    return NextResponse.json({ success: false, data: [] });
  }
}
