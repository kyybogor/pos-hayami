import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// PUT /api/master-barang/[id] - Update Image
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const decodedId = decodeURIComponent(id || '').trim();

    if (!decodedId) {
      return NextResponse.json(
        { success: false, message: 'ID/Nama Barang tidak valid.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const image = typeof body.image === 'string' ? body.image.trim() : '';

    // Update tb_stock
    await pool.query(
      'UPDATE tb_stock SET image = ? WHERE id_bahan = ?',
      [image, decodedId]
    );

    // Sync tb_bahan
    try {
      await pool.query(
        'UPDATE tb_bahan SET image = ? WHERE nama_bahan = ? OR id_bahan = ?',
        [image, decodedId, decodedId]
      );
    } catch (err) {
      console.warn('Sync image error:', err);
    }

    return NextResponse.json({
      success: true,
      message: 'Gambar produk berhasil diperbarui!',
      id_bahan: decodedId,
      image,
    });
  } catch (error: any) {
    console.error('Update image error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui gambar produk.' },
      { status: 500 }
    );
  }
}
