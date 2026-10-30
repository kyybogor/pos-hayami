import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'File gambar tidak ditemukan.' }, { status: 400 });
    }

    // Validasi mime type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Format file tidak didukung. Harap upload format JPG, PNG, atau WEBP.' },
        { status: 400 }
      );
    }

    // Batas ukuran 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'Ukuran file gambar terlalu besar (maksimal 5MB).' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Simpan ke direktori public/uploads/products
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate nama file unik & bersih
    const originalExt = path.extname(file.name) || '.jpg';
    const cleanExt = originalExt.toLowerCase();
    const rawBase = path.basename(file.name, originalExt).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeBase = rawBase.slice(0, 30) || 'item';
    const filename = `PO_${Date.now()}_${safeBase}${cleanExt}`;
    const filePath = path.join(uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/products/${filename}`;

    return NextResponse.json({
      success: true,
      message: 'Upload gambar berhasil.',
      url: publicUrl,
      filename,
    });
  } catch (error: any) {
    console.error('Error uploading product image:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengupload gambar.' },
      { status: 500 }
    );
  }
}
