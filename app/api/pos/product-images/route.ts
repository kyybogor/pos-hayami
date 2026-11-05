import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// In-memory cache for fast repeated calls
let cachedMap: Record<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    const now = Date.now();
    if (cachedMap && now - cacheTime < CACHE_TTL_MS && Object.keys(cachedMap).length > 0) {
      return NextResponse.json({
        success: true,
        source: 'memory-cache',
        count: Object.keys(cachedMap).length,
        data: cachedMap,
      });
    }

    const imgMap: Record<string, string> = {};

    // 1. Try fetching online API with domain=https://hayami.id/apps/erp
    let onlineSuccess = false;
    try {
      const res = await fetch(
        'https://new-program.hayami.id/api/product-images?domain=https://hayami.id/apps/erp',
        {
          signal: AbortSignal.timeout(4500),
          headers: {
            'User-Agent': 'Mozilla/5.0 POS-Hayami-Server',
          },
        }
      );

      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          for (const item of items) {
            if (item.tipe && item.gambar) {
              const key = `${item.tipe.trim().toLowerCase()}|||${item.gambar.trim().toLowerCase()}`;
              const targetImg = item.img || item.url || '';
              imgMap[key] = `/api/pos/image-proxy?img=${encodeURIComponent(targetImg)}&label=${encodeURIComponent(item.tipe)}`;
            }
          }
          onlineSuccess = true;
        }
      }
    } catch {
      // Remote fetch failed or timed out, fallback to local database
    }

    // 2. If online fetch failed or returned empty, fallback to local MySQL hayami.tb_harga_size
    if (!onlineSuccess || Object.keys(imgMap).length === 0) {
      try {
        const [rows] = await pool.query<RowDataPacket[]>(`
          SELECT TRIM(tipe) AS tipe, TRIM(gambar) AS gambar, TRIM(img) AS img
          FROM hayami.tb_harga_size
          WHERE img IS NOT NULL AND img != '' AND tipe IS NOT NULL AND tipe != ''
          GROUP BY TRIM(tipe), TRIM(gambar)
        `);

        for (const r of rows) {
          if (r.tipe && r.gambar && r.img) {
            const key = `${r.tipe.trim().toLowerCase()}|||${r.gambar.trim().toLowerCase()}`;
            imgMap[key] = `/api/pos/image-proxy?img=${encodeURIComponent(r.img)}&label=${encodeURIComponent(r.tipe)}`;
          }
        }
      } catch (dbErr) {
        console.warn('Fallback to local hayami.tb_harga_size failed:', dbErr);
      }
    }

    if (Object.keys(imgMap).length > 0) {
      cachedMap = imgMap;
      cacheTime = now;
    }

    return NextResponse.json({
      success: true,
      source: onlineSuccess ? 'online-api' : 'local-db-fallback',
      count: Object.keys(imgMap).length,
      data: imgMap,
    });
  } catch (error: any) {
    console.error('Error fetching product images metadata:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memuat metadata gambar.' },
      { status: 500 }
    );
  }
}

