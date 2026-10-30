import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET /api/master-cabang/[id] - Ambil detail 1 cabang
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cabangId = parseInt(id, 10);

    if (isNaN(cabangId) || cabangId <= 0) {
      return NextResponse.json(
        { success: false, message: 'ID Cabang tidak valid.' },
        { status: 400 }
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang, alamat, city, npwp, nomor_telepon, jenis_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1',
      [cabangId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data cabang tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rows[0],
    });
  } catch (error: any) {
    console.error('Fetch detail cabang error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil detail cabang.' },
      { status: 500 }
    );
  }
}

// PUT /api/master-cabang/[id] - Update data cabang (NAMA CABANG TIDAK DAPAT DIEDIT)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cabangId = parseInt(id, 10);

    if (isNaN(cabangId) || cabangId <= 0) {
      return NextResponse.json(
        { success: false, message: 'ID Cabang tidak valid.' },
        { status: 400 }
      );
    }

    // Pastikan cabang ada di database
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1',
      [cabangId]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data cabang tidak ditemukan.' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      alamat = '',
      city = '',
      npwp = '',
      nomor_telepon = '',
      jenis_cabang = '',
    } = body;

    // Catatan: Sesuai instruksi, `nama_cabang` TIDAK BOLEH diedit untuk menjaga integritas transaksi
    await pool.query<ResultSetHeader>(
      `UPDATE tb_cabang 
       SET alamat = ?, 
           city = ?, 
           npwp = ?, 
           nomor_telepon = ?, 
           jenis_cabang = ? 
       WHERE id_cabang = ?`,
      [
        (alamat || '').trim(),
        (city || '').trim(),
        (npwp || '').trim(),
        (nomor_telepon || '').trim(),
        (jenis_cabang || '').trim(),
        cabangId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Data cabang "${existing[0].nama_cabang}" berhasil diperbarui! (Nama cabang tetap terkunci)`,
    });
  } catch (error: any) {
    console.error('Update master cabang error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui data cabang.' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-cabang/[id] - Hapus cabang dengan proteksi integritas data
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cabangId = parseInt(id, 10);

    if (isNaN(cabangId) || cabangId <= 0) {
      return NextResponse.json(
        { success: false, message: 'ID Cabang tidak valid.' },
        { status: 400 }
      );
    }

    // Ambil data cabang
    const [cabangRows] = await pool.query<RowDataPacket[]>(
      'SELECT id_cabang, nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1',
      [cabangId]
    );

    if (cabangRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data cabang tidak ditemukan.' },
        { status: 404 }
      );
    }

    const { nama_cabang } = cabangRows[0];
    const strId = String(cabangId);

    // Cek apakah cabang ini digunakan dalam transaksi penjualan (tb_barang_keluar)
    try {
      const [bkRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM tb_barang_keluar WHERE id_cabang = ? OR id_cabang = ? LIMIT 1',
        [strId, nama_cabang]
      );
      if (bkRows[0]?.cnt > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Cabang "${nama_cabang}" tidak dapat dihapus karena memiliki riwayat transaksi Penjualan (${bkRows[0].cnt.toLocaleString()} transaksi).`,
          },
          { status: 400 }
        );
      }
    } catch (err) {
      console.warn('Check tb_barang_keluar skipped or error:', err);
    }

    // Cek apakah cabang ini digunakan dalam transaksi barang masuk (tb_barang_masuk)
    try {
      const [bmRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM tb_barang_masuk WHERE id_cabang = ? OR id_cabang = ? LIMIT 1',
        [strId, nama_cabang]
      );
      if (bmRows[0]?.cnt > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Cabang "${nama_cabang}" tidak dapat dihapus karena memiliki riwayat transaksi Barang Masuk.`,
          },
          { status: 400 }
        );
      }
    } catch (err) {
      console.warn('Check tb_barang_masuk skipped or error:', err);
    }

    // Cek apakah cabang ini digunakan di user login (tb_user)
    try {
      const [userRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM tb_user WHERE grup = ? OR grup = ? LIMIT 1',
        [strId, nama_cabang]
      );
      if (userRows[0]?.cnt > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Cabang "${nama_cabang}" tidak dapat dihapus karena terhubung dengan ${userRows[0].cnt} akun pengguna login.`,
          },
          { status: 400 }
        );
      }
    } catch (err) {
      console.warn('Check tb_user skipped or error:', err);
    }

    // Eksekusi penghapusan jika aman
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM tb_cabang WHERE id_cabang = ?',
      [cabangId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Gagal menghapus cabang.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cabang "${nama_cabang}" berhasil dihapus!`,
    });
  } catch (error: any) {
    console.error('Delete master cabang error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menghapus data cabang.' },
      { status: 500 }
    );
  }
}
