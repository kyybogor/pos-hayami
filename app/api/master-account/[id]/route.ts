import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// PUT /api/master-account/[id] - Update Account
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { tipe, bank, nama_akun, no_akun } = body;

    const id_akun = decodeURIComponent(id);

    if (!id_akun) {
      return NextResponse.json(
        { success: false, message: 'ID Akun tidak valid.' },
        { status: 400 }
      );
    }

    if (!tipe || !tipe.trim()) {
      return NextResponse.json(
        { success: false, message: 'Tipe Akun wajib diisi!' },
        { status: 400 }
      );
    }

    await pool.query(
      `UPDATE tb_akun SET
        tipe = ?,
        bank = ?,
        nama_akun = ?,
        no_akun = ?
      WHERE id_akun = ?`,
      [
        tipe.trim(),
        bank ? bank.trim() : '',
        nama_akun ? nama_akun.trim() : '',
        no_akun ? no_akun.trim() : '',
        id_akun,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Ubah data account berhasil!',
    });
  } catch (error: any) {
    console.error('Update account error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui data account.' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-account/[id] - Delete Account
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const id_akun = decodeURIComponent(id);

    if (!id_akun) {
      return NextResponse.json(
        { success: false, message: 'ID Akun tidak valid.' },
        { status: 400 }
      );
    }

    const [result]: any = await pool.query(
      'DELETE FROM tb_akun WHERE id_akun = ?',
      [id_akun]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Account tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hapus account berhasil!',
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus data account.' },
      { status: 500 }
    );
  }
}
