import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ResultSetHeader } from 'mysql2';

// PUT /api/master-location/[id] - Update location name
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const locationId = parseInt(id, 10);

    if (isNaN(locationId) || locationId <= 0) {
      return NextResponse.json(
        { success: false, message: 'ID Lokasi tidak valid.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { nama_lokasi } = body;

    if (!nama_lokasi || !nama_lokasi.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nama Lokasi wajib diisi!' },
        { status: 400 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE location SET nama_lokasi = ? WHERE id = ?',
      [nama_lokasi.trim(), locationId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Data lokasi tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Ubah data lokasi berhasil!',
    });
  } catch (error: any) {
    console.error('Update location error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui data lokasi.' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-location/[id] - Delete location entry
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const locationId = parseInt(id, 10);

    if (isNaN(locationId) || locationId <= 0) {
      return NextResponse.json(
        { success: false, message: 'ID Lokasi tidak valid.' },
        { status: 400 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM location WHERE id = ?',
      [locationId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Data lokasi tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hapus data lokasi berhasil!',
    });
  } catch (error: any) {
    console.error('Delete location error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghapus data lokasi.' },
      { status: 500 }
    );
  }
}
