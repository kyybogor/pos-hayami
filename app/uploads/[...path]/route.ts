import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await context.params;

    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    // Resolusi path ke direktori public/uploads
    const baseDir = path.resolve(process.cwd(), 'public', 'uploads');
    const targetFile = path.resolve(baseDir, ...pathSegments);

    // Keamanan: Pastikan path tidak keluar dari folder public/uploads (mencegah path traversal)
    if (!targetFile.startsWith(baseDir)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (!fs.existsSync(targetFile)) {
      return new NextResponse('Image Not Found', { status: 404 });
    }

    const stat = await fs.promises.stat(targetFile);
    if (!stat.isFile()) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const ext = path.extname(targetFile).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fileBuffer = await fs.promises.readFile(targetFile);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err: any) {
    console.error('Error serving uploaded image:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
