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

    let imageRes = await fetch(fullImageUrl).catch(() => null);

    // If direct fetch fails or 404, try proxying or alternative Hayami domains
    if (!imageRes || !imageRes.ok) {
      const cleanPath = imageUrl
        .replace(/^https?:\/\/[^\/]+\//i, '')
        .replace(/^[\\\/]+/, '');

      const altCandidates = [
        new URL(`/api/pos/image-proxy?img=${encodeURIComponent(cleanPath)}`, request.url).toString(),
        `https://hayami.id/apps/erp/${encodeURI(cleanPath)}`,
        `https://hayami.id/apps/erp/img/${encodeURI(cleanPath)}`,
        `https://new-program.hayami.id/${encodeURI(cleanPath)}`,
      ];

      for (const alt of altCandidates) {
        try {
          const res = await fetch(alt, { signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            imageRes = res;
            break;
          }
        } catch {
          // Continue
        }
      }
    }

    if (!imageRes || !imageRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch image from source' },
        { status: imageRes ? imageRes.status : 404 }
      );
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
