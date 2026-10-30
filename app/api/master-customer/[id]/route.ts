import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { md5 } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// PUT /api/master-customer/[id] - Update Customer
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      nama_customer,
      kota,
      alamat_lengkap,
      no_telp,
      email,
      diskon_lusin,
      source_customer,
      no_npwp,
      nama_npwp,
      alamat_npwp,
      id_login,
      pass_login,
    } = body;

    if (!nama_customer || nama_customer.trim() === '') {
      return NextResponse.json(
        { success: false, message: 'Nama Customer wajib diisi!' },
        { status: 400 }
      );
    }

    let passUpdateSql = '';
    const updateParams: any[] = [
      nama_customer || '',
      kota || '',
      alamat_lengkap || '',
      no_telp || '',
      email || '',
      diskon_lusin || '0',
      source_customer || ' ',
      no_npwp || '',
      nama_npwp || '',
      alamat_npwp || '',
      id_login || '',
    ];

    if (pass_login && pass_login.trim() !== '') {
      passUpdateSql = 'pass_login = ?, ';
      updateParams.unshift(md5(pass_login));
    }

    updateParams.push(id);

    await pool.query(
      `UPDATE tb_customer SET
        ${passUpdateSql}
        nama_customer = ?,
        kota = ?,
        alamat_lengkap = ?,
        no_telp = ?,
        email = ?,
        diskon_lusin = ?,
        source_customer = ?,
        no_npwp = ?,
        nama_npwp = ?,
        alamat_npwp = ?,
        id_login = ?
      WHERE id_customer = ?`,
      updateParams
    );

    return NextResponse.json({
      success: true,
      message: 'Ubah data customer berhasil!',
    });
  } catch (error: any) {
    console.error('Update customer error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memperbarui data customer.' },
      { status: 500 }
    );
  }
}

// DELETE /api/master-customer/[id] - Delete Customer
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID Customer tidak valid.' },
        { status: 400 }
      );
    }

    const [result]: any = await pool.query(
      'DELETE FROM tb_customer WHERE id_customer = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Customer tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hapus data customer berhasil!',
    });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus data customer.' },
      { status: 500 }
    );
  }
}
