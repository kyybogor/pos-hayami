import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const filename = searchParams.get('name') || 'download.jpg';

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const fullImageUrl = imageUrl.startsWith('/')
      ? new URL(imageUrl, request.url).toString()
      : imageUrl;

    const imageRes = await fetch(fullImageUrl);

    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch image from source' }, { status: imageRes.status });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageRes.arrayBuffer();

    // Sanitize filename for header
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error in download-image API proxy:', error);
    return NextResponse.json({ error: 'Internal server error downloading image' }, { status: 500 });
  }
}
