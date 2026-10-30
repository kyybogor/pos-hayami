import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json(
        { success: false, message: 'ID Customer Type tidak valid.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { nm_type, percentage } = body;

    if (!nm_type || typeof nm_type !== 'string' || !nm_type.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nama Type customer wajib diisi.' },
        { status: 400 }
      );
    }

    const pct = parseInt(String(percentage), 10);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return NextResponse.json(
        { success: false, message: 'Percentage harus berupa angka antara 0 dan 100.' },
        { status: 400 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE tb_cust_type SET nm_type = ?, percentage = ? WHERE id_cust_type = ?',
      [nm_type.trim(), pct, idNum]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Data Customer Type tidak ditemukan.' },
        { status: 404 }
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cust_type, nm_type, percentage FROM tb_cust_type WHERE id_cust_type = ?',
      [idNum]
    );

    return NextResponse.json({
      success: true,
      message: 'Data Type Customer berhasil diperbarui.',
      data: rows[0],
    });
  } catch (error: any) {
    console.error('Update tb_cust_type error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui data Type Customer.' },
      { status: 500 }
    );
  }
}

