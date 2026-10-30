import { NextResponse } from 'next/server';
import poolLocal from '@/lib/db';
import { RowDataPacket } from 'mysql2';

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const no_id = searchParams.get('no_id');

    if (!no_id) {
      return NextResponse.json(
        { success: false, message: 'no_id item wajib diisi.' },
        { status: 400 }
      );
    }

    await poolLocal.query('DELETE FROM tb_barang_masuk WHERE no_id = ?', [no_id]);

    return NextResponse.json({
      success: true,
      message: 'Item berhasil dihapus.',
    });
  } catch (error: any) {
    console.error('Delete item error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus item.' },
      { status: 500 }
    );
  }
}
