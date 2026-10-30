import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import crypto from 'crypto';

function hashPassword(pass: string): string {
  return crypto.createHash('md5').update(pass).digest('hex');
}

// PUT /api/master-user-login/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { user_id, pass, nama_lengkap, alamat, no_telp, grup, jenis_pajak, tipe, cabang } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Karyawan tidak valid.' },
        { status: 400 }
      );
    }

    if (!nama_lengkap || !nama_lengkap.trim()) {
      return NextResponse.json(
        { success: false, message: 'Nama Lengkap wajib diisi!' },
        { status: 400 }
      );
    }

    const trimmedUserId = user_id ? user_id.trim() : '';
    const normalizedCabang = (cabang && typeof cabang === 'string' && cabang.trim() !== '') ? cabang.trim() : undefined;

    if (pass && pass.trim() !== '') {
      const hashedPass = hashPassword(pass);
      await pool.query(
        `UPDATE tb_karyawan SET
          user_id = ?,
          pass = ?,
          nama_lengkap = ?,
          alamat = ?,
          no_telp = ?,
          grup = ?,
          jenis_pajak = ?
          ${normalizedCabang !== undefined ? ', cabang = ?' : ''}
          ${tipe ? ', tipe = ?' : ''}
        WHERE id_karyawan = ?`,
        [
          trimmedUserId,
          hashedPass,
          nama_lengkap.trim(),
          alamat || '',
          no_telp || '',
          grup || 'admin',
          jenis_pajak || '1',
          ...(normalizedCabang !== undefined ? [normalizedCabang] : []),
          ...(tipe ? [tipe] : []),
          id,
        ]
      );

      // Sinkronisasi ke tb_user
      try {
        if (trimmedUserId) {
          await pool.query(
            `UPDATE tb_user SET 
              pass_user = ?, 
              nm_user = ?, 
              telp_user = ?, 
              alamat_user = ?, 
              role = ?
              ${normalizedCabang !== undefined ? ', grup = ?' : ''}
              ${tipe ? ', tipe = ?' : ''}
            WHERE id_user = ?`,
            [
              hashedPass,
              nama_lengkap.trim(),
              no_telp || '',
              alamat || '',
              grup || 'admin',
              ...(normalizedCabang !== undefined ? [normalizedCabang] : []),
              ...(tipe ? [tipe] : []),
              trimmedUserId,
            ]
          );
        }
      } catch (err) {
        console.warn('Sync tb_user in PUT error:', err);
      }
    } else {
      await pool.query(
        `UPDATE tb_karyawan SET
          user_id = ?,
          nama_lengkap = ?,
          alamat = ?,
          no_telp = ?,
          grup = ?,
          jenis_pajak = ?
          ${normalizedCabang !== undefined ? ', cabang = ?' : ''}
          ${tipe ? ', tipe = ?' : ''}
        WHERE id_karyawan = ?`,
        [
          trimmedUserId,
          nama_lengkap.trim(),
          alamat || '',
          no_telp || '',
          grup || 'admin',
          jenis_pajak || '1',
          ...(normalizedCabang !== undefined ? [normalizedCabang] : []),
          ...(tipe ? [tipe] : []),
          id,
        ]
      );

      // Sinkronisasi ke tb_user
      try {
        if (trimmedUserId) {
          await pool.query(
            `UPDATE tb_user SET 
              nm_user = ?, 
              telp_user = ?, 
              alamat_user = ?, 
              role = ?
              ${normalizedCabang !== undefined ? ', grup = ?' : ''}
              ${tipe ? ', tipe = ?' : ''}
            WHERE id_user = ?`,
            [
              nama_lengkap.trim(),
              no_telp || '',
              alamat || '',
              grup || 'admin',
              ...(normalizedCabang !== undefined ? [normalizedCabang] : []),
              ...(tipe ? [tipe] : []),
              trimmedUserId,
            ]
          );
        }
      } catch (err) {
        console.warn('Sync tb_user in PUT error:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Ubah Data User Login berhasil!',
    });
  } catch (error: any) {
    console.error('Update user login error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui data user login.' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-user-login/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID User tidak valid.' },
        { status: 400 }
      );
    }

    // Ambil user_id sebelum menghapus
    const [kRows]: any = await pool.query('SELECT user_id FROM tb_karyawan WHERE id_karyawan = ?', [id]);
    const delUserId = kRows[0]?.user_id;

    const [result]: any = await pool.query(
      'DELETE FROM tb_karyawan WHERE id_karyawan = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'User tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (delUserId) {
      try {
        await pool.query('DELETE FROM tb_user WHERE id_user = ?', [delUserId]);
      } catch (err) {
        console.warn('Delete tb_user error:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Hapus data user login berhasil!',
    });
  } catch (error: any) {
    console.error('Delete user login error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus data user login.' },
      { status: 500 }
    );
  }
}
