import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Cache directory inside public/cache/product-images
const CACHE_DIR = path.join(process.cwd(), 'public', 'cache', 'product-images');

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch {
      // Ignore directory creation error
    }
  }
}

// Generate fallback SVG placeholder
function getFallbackSvg(title?: string): string {
  const label = (title || 'Hayami').replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="225" viewBox="0 0 300 225" fill="none">
    <rect width="300" height="225" fill="#F8FAFC"/>
    <rect x="1" y="1" width="298" height="223" rx="12" stroke="#E2E8F0" stroke-width="2"/>
    <g transform="translate(130, 80)">
      <path d="M20 2L3.5 11.5L20 21L36.5 11.5L20 2Z" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3.5 11.5V30.5L20 40V21" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M36.5 11.5V30.5L20 40" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 6.8L28.5 16.2" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="150" y="150" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94A3B8" letter-spacing="1">${label.toUpperCase()}</text>
  </svg>`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawTarget = searchParams.get('img') || searchParams.get('url') || searchParams.get('path') || '';
    const label = searchParams.get('label') || '';

    if (!rawTarget.trim()) {
      return new NextResponse(getFallbackSvg(label), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const decodedTarget = decodeURIComponent(rawTarget.trim());

    // 1. If it's a local file upload (e.g. /uploads/... or /images/...)
    if (decodedTarget.startsWith('/uploads/') || decodedTarget.startsWith('/images/')) {
      const localFilePath = path.join(process.cwd(), 'public', decodedTarget);
      if (fs.existsSync(localFilePath)) {
        const fileBuf = await fs.promises.readFile(localFilePath);
        const ext = path.extname(localFilePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return new NextResponse(fileBuf, {
          headers: {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
          },
        });
      }
    }

    // 2. Extract clean path (removing domain prefix if any)
    let cleanPath = decodedTarget
      .replace(/^https?:\/\/[^\/]+\//i, '')
      .replace(/^[\\\/]+/, '')
      .replace(/\\/g, '/');

    // Build unique cache key and cache file path
    ensureCacheDir();
    const hash = crypto.createHash('md5').update(cleanPath.toLowerCase()).digest('hex');
    const cachedFilePath = path.join(CACHE_DIR, `${hash}.jpg`);

    // Check disk cache first for instant response
    if (fs.existsSync(cachedFilePath)) {
      try {
        const cachedData = await fs.promises.readFile(cachedFilePath);
        if (cachedData.length > 500) {
          return new NextResponse(cachedData, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
              'X-Cache': 'HIT',
            },
          });
        }
      } catch {
        // Fall through to fetch if read fails
      }
    }

    // 3. Build candidate URLs to try across Hayami servers
    const candidateUrls: string[] = [];

    // Form variant with img/ and without img/
    let withImg = cleanPath;
    let withoutImg = cleanPath;
    if (cleanPath.startsWith('img/')) {
      withoutImg = cleanPath.slice(4);
    } else if (!cleanPath.startsWith('dist/') && !cleanPath.startsWith('uploads/')) {
      withImg = 'img/' + cleanPath;
    }

    // Primary: hayami.id/apps/erp (main catalog images)
    candidateUrls.push(`https://hayami.id/apps/erp/${encodeURI(withImg)}`);
    candidateUrls.push(`https://hayami.id/apps/erp/${encodeURI(withoutImg)}`);

    // Secondary: new-program.hayami.id (new WhatsApp uploads)
    candidateUrls.push(`https://new-program.hayami.id/${encodeURI(withImg)}`);
    candidateUrls.push(`https://new-program.hayami.id/${encodeURI(withoutImg)}`);

    // Tertiary: hayami.id direct
    candidateUrls.push(`https://hayami.id/${encodeURI(withImg)}`);
    candidateUrls.push(`https://hayami.id/${encodeURI(withoutImg)}`);

    // If dist/img/gambar path from tb_stock
    if (cleanPath.includes('dist/img/gambar/')) {
      candidateUrls.push(`https://hayami.id/apps/erp/${encodeURI(cleanPath)}`);
      candidateUrls.push(`https://new-program.hayami.id/${encodeURI(cleanPath)}`);
      candidateUrls.push(`https://hayami.id/${encodeURI(cleanPath)}`);
    }

    // Attempt fetching from candidates
    for (const testUrl of candidateUrls) {
      try {
        const res = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS-Hayami-Proxy',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(3500),
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          if (contentType.includes('image')) {
            const arrayBuf = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);

            // Save to disk cache asynchronously
            fs.promises.writeFile(cachedFilePath, buffer).catch((err) => {
              console.warn('Failed to write image cache:', err);
            });

            return new NextResponse(buffer, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
                'X-Cache': 'MISS',
                'X-Source': testUrl,
              },
            });
          }
        }
      } catch {
        // Continue to next candidate
      }
    }

    // 4. If all remote servers fail, return clean fallback SVG instead of broken 404
    return new NextResponse(getFallbackSvg(label), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'X-Cache': 'FALLBACK',
      },
    });
  } catch (error) {
    console.error('Error in pos image proxy:', error);
    return new NextResponse(getFallbackSvg(), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}

