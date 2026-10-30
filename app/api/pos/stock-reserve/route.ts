import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface CartItem {
  id_bahan: string;
  model: string;
  ukuran: string;
  qty: number;
}

/**
 * PATCH /api/pos/stock-reserve
 * Body: { action: 'hold' | 'release', items: CartItem[] }
 *
 * 'hold'    → stock_reserve += qty  (when saving to pending cart)
 * 'release' → stock_reserve -= qty, min 0  (when restoring or deleting pending cart)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, items } = body as { action: 'hold' | 'release'; items: CartItem[] };

    if (!action || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Parameter action dan items wajib diisi.' },
        { status: 400 }
      );
    }

    if (action !== 'hold' && action !== 'release') {
      return NextResponse.json(
        { success: false, message: 'action harus berupa "hold" atau "release".' },
        { status: 400 }
      );
    }

    const conn = await (pool as any).getConnection();
    try {
      await conn.beginTransaction();

      for (const item of items) {
        if (!item.id_bahan || !item.model || !item.ukuran || item.qty <= 0) continue;

        if (action === 'hold') {
          // Add to reserve: stock_reserve = COALESCE(stock_reserve, 0) + qty
          await conn.query(
            `UPDATE tb_stock
             SET stock_reserve = COALESCE(stock_reserve, 0) + ?
             WHERE id_bahan = ? AND model = ? AND ukuran = ?`,
            [item.qty, item.id_bahan, item.model, item.ukuran]
          );
        } else {
          // Release from reserve: stock_reserve = GREATEST(0, COALESCE(stock_reserve, 0) - qty)
          await conn.query(
            `UPDATE tb_stock
             SET stock_reserve = GREATEST(0, COALESCE(stock_reserve, 0) - ?)
             WHERE id_bahan = ? AND model = ? AND ukuran = ?`,
            [item.qty, item.id_bahan, item.model, item.ukuran]
          );
        }
      }

      await conn.commit();
      return NextResponse.json({ success: true, action, count: items.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('Error updating stock_reserve:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengupdate stock_reserve.' },
      { status: 500 }
    );
  }
}

