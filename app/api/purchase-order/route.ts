import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import poolLocal from '@/lib/db';
import { getBranchCode } from '@/lib/branch';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export const dynamic = 'force-dynamic';

function parseDateParts(dateStr?: string): { yearStr: string; monthStr: string; dateOnlyStr: string } {
  if (dateStr && typeof dateStr === 'string') {
    const clean = dateStr.trim().slice(0, 10);
    const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return {
        yearStr: match[1].slice(-2),
        monthStr: match[2],
        dateOnlyStr: clean,
      };
    }
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return {
    yearStr: String(y).slice(-2),
    monthStr: m,
    dateOnlyStr: `${y}-${m}-${d}`,
  };
}

function formatDateOnly(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    const match = val.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

// Generator for id_transaksi matching Barang Masuk Online (PO/YYMM/xxxx)
async function generateBarangMasukKey(dateStr?: string): Promise<string> {
  const { yearStr, monthStr } = parseDateParts(dateStr);
  const prefix = `PO/${yearStr}${monthStr}/`;

  const [rows] = await poolLocal.query<RowDataPacket[]>(
    'SELECT max(id_transaksi) as kodeTerbesar FROM tb_barang_masuk WHERE id_transaksi LIKE ?',
    [`${prefix}%`]
  );

  let sequence = 1;
  if (rows.length > 0 && rows[0].kodeTerbesar) {
    const numPart = parseInt(String(rows[0].kodeTerbesar).split('/').pop() || '0', 10);
    if (!isNaN(numPart)) {
      sequence = numPart + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function getStartNoIdSeq(dateStr?: string): Promise<number> {
  const { yearStr, monthStr } = parseDateParts(dateStr);
  const prefix = `IM${monthStr}${yearStr}`;

  const [rows] = await poolLocal.query<RowDataPacket[]>(
    'SELECT max(no_id) as kodeTerbesar FROM tb_barang_masuk WHERE no_id LIKE ?',
    [`${prefix}%`]
  );

  let sequence = 1;
  if (rows.length > 0 && rows[0].kodeTerbesar) {
    const lastCode = String(rows[0].kodeTerbesar);
    const numPart = parseInt(lastCode.slice(6), 10);
    if (!isNaN(numPart)) {
      sequence = numPart + 1;
    }
  }

  return sequence;
}

function formatNoId(seq: number, dateStr?: string): string {
  const { yearStr, monthStr } = parseDateParts(dateStr);
  const prefix = `IM${monthStr}${yearStr}`;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

// Ensure image column exists in tb_barang_masuk and tb_stock
async function ensureImageColumns() {
  try {
    const [bmCols] = await poolLocal.query<RowDataPacket[]>('SHOW COLUMNS FROM tb_barang_masuk');
    if (!bmCols.map((c) => c.Field).includes('image')) {
      await poolLocal.query("ALTER TABLE tb_barang_masuk ADD COLUMN image VARCHAR(255) DEFAULT ''");
    }
  } catch (err) {
    console.warn('Error checking image column in tb_barang_masuk:', err);
  }
}

// 1. GET: Fetch Purchase Orders (jenis = '1') or Form Options
export async function GET(req: Request) {
  try {
    await ensureImageColumns();
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const isSuperAdmin = (session?.role || '').toLowerCase() === 'superadmin';
    const userBranch = session?.branch || '';

    const { searchParams } = new URL(req.url);
    const optionsOnly = searchParams.get('options') === 'true';

    // A. Return dropdown options for creating PO
    if (optionsOnly) {
      const [bahanRows] = await poolLocal.query<RowDataPacket[]>(
        `SELECT DISTINCT id_bahan 
         FROM tb_stock 
         WHERE id_bahan IS NOT NULL AND TRIM(id_bahan) != '' 
         ORDER BY id_bahan ASC`
      );

      const [modelRows] = await poolLocal.query<RowDataPacket[]>(
        `SELECT DISTINCT model 
         FROM tb_stock 
         WHERE model IS NOT NULL AND TRIM(model) != '' 
         ORDER BY model ASC`
      );

      const [sizeRows] = await poolLocal.query<RowDataPacket[]>(
        `SELECT DISTINCT nm_size 
         FROM m_size 
         WHERE nm_size IS NOT NULL AND TRIM(nm_size) != '' 
         ORDER BY number ASC, nm_size ASC`
      );

      const [supplierRows] = await poolLocal.query<RowDataPacket[]>(
        `SELECT id_customer, nama_customer 
         FROM tb_customer 
         WHERE nama_customer IS NOT NULL AND TRIM(nama_customer) != ''
         ORDER BY nama_customer ASC 
         LIMIT 100`
      );

      return NextResponse.json({
        success: true,
        data: {
          bahans: bahanRows.map((r) => r.id_bahan as string),
          models: modelRows.map((r) => r.model as string),
          sizes: sizeRows.map((r) => r.nm_size as string),
          suppliers: supplierRows.map((r) => ({
            id: r.id_customer as string,
            nama: r.nama_customer as string,
          })),
        },
      });
    }

    // B. Fetch PO List where jenis = '1'
    const tgl_from = searchParams.get('tgl_from');
    const tgl_to = searchParams.get('tgl_to');
    const inv = searchParams.get('inv');
    const cabangParam = searchParams.get('cabang') || '';

    let effectiveBranch = userBranch;
    if (isSuperAdmin) {
      effectiveBranch = cabangParam && cabangParam !== 'ALL' ? cabangParam : '';
    }

    let whereClause = "WHERE a.jenis = '1'";
    const params: any[] = [];

    if (effectiveBranch) {
      whereClause += " AND (a.id_cabang = ? OR a.id_cabang = (SELECT nama_cabang FROM tb_cabang WHERE id_cabang = ? LIMIT 1) OR (SELECT CAST(id_cabang AS CHAR) FROM tb_cabang WHERE nama_cabang = ? LIMIT 1) = a.id_cabang)";
      params.push(effectiveBranch, effectiveBranch, effectiveBranch);
    }

    if (tgl_from && tgl_to) {
      whereClause += " AND a.tgl_transaksi BETWEEN ? AND ?";
      params.push(tgl_from, tgl_to);
    }

    if (inv) {
      whereClause += " AND (a.id_transaksi LIKE ? OR a.keterangan LIKE ?)";
      params.push(`%${inv}%`, `%${inv}%`);
    }

    const headersQuery = `
      SELECT 
        a.id_transaksi, 
        a.tgl_transaksi, 
        a.id_supplier, 
        a.status, 
        a.keterangan, 
        a.status_lunas, 
        a.jenis, 
        a.id_cabang,
        COALESCE(c.nama_customer, a.id_supplier, 'Supplier') as nama_supplier
      FROM tb_barang_masuk a
      LEFT JOIN tb_customer c ON a.id_supplier = c.id_customer
      ${whereClause}
      GROUP BY a.id_transaksi
      ORDER BY a.tgl_transaksi DESC, a.id_transaksi DESC
      LIMIT 100
    `;

    const [headerRows] = await poolLocal.query<RowDataPacket[]>(headersQuery, params);

    const transactions = await Promise.all(
      headerRows.map(async (h) => {
        const [itemRows] = await poolLocal.query<RowDataPacket[]>(
          `SELECT no_id, id_product, model, ukuran, qty, uom, harga, subtotal, image 
           FROM tb_barang_masuk 
           WHERE id_transaksi = ?
           ORDER BY no_id ASC`,
          [h.id_transaksi]
        );

        return {
          id_transaksi: h.id_transaksi,
          tgl_transaksi: formatDateOnly(h.tgl_transaksi),
          id_supplier: h.id_supplier,
          nama_supplier: h.nama_supplier,
          status: h.status, // 'd' = Draft, 's' = Close/Diterima
          keterangan: h.keterangan || '',
          status_lunas: h.status_lunas,
          jenis: h.jenis,
          id_cabang: h.id_cabang,
          total_qty: itemRows.reduce((acc, it) => acc + (Number(it.qty) || 0), 0),
          total_nilai: itemRows.reduce((acc, it) => acc + (Number(it.subtotal) || (Number(it.qty) * Number(it.harga)) || 0), 0),
          items: itemRows.map((it) => ({
            no_id: it.no_id,
            id_product: it.id_product,
            model: it.model,
            ukuran: it.ukuran,
            qty: Number(it.qty) || 0,
            uom: it.uom || 'PCS',
            harga: Number(it.harga) || 0,
            subtotal: Number(it.subtotal) || (Number(it.qty) * Number(it.harga)) || 0,
            image: it.image || '',
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    console.error('Fetch Purchase Order error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal mengambil data Purchase Order.' },
      { status: 500 }
    );
  }
}

// 2. POST: Create New Purchase Order (jenis = '1')
export async function POST(req: Request) {
  try {
    await ensureImageColumns();
    const body = await req.json();
    let { tgl_transaksi, id_supplier, keterangan, items, id_cabang } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Daftar barang pada Purchase Order tidak boleh kosong.' },
        { status: 400 }
      );
    }

    let branchId = id_cabang || '';
    if (!branchId || branchId === 'ALL') {
      try {
        const cookieStore = await cookies();
        const token = cookieStore.get('pos_session')?.value;
        if (token) {
          const session = await verifySessionToken(token);
          if (session) {
            branchId = session.grup || session.branch || '';
          }
        }
      } catch (e) {}
    }

    if (!branchId || branchId === 'ALL') {
      branchId = 'TKA-JATINEGARA-JAKARTA';
    }

    const { dateOnlyStr } = parseDateParts(tgl_transaksi);
    const id_transaksi = await generateBarangMasukKey(dateOnlyStr);
    const tglDate = dateOnlyStr;

    let currentNoIdSeq = await getStartNoIdSeq(tglDate);

    for (const item of items) {
      const noId = formatNoId(currentNoIdSeq++, tglDate);
      const qtyNum = Number(item.qty) || 0;
      const hargaNum = Number(item.harga) || 0;
      const subtotalNum = Number(item.subtotal) || (qtyNum * hargaNum);

      const imgPath = item.image ? String(item.image).trim() : '';

      await poolLocal.query(
        `INSERT INTO tb_barang_masuk (
          no_id, id_transaksi, tgl_transaksi, id_supplier, id_product, model, ukuran, 
          qty, uom, harga, subtotal, total, keterangan, status, jenis, id_cabang, by_user_pajak, status_lunas, image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          noId,
          id_transaksi,
          tglDate,
          id_supplier || 'Hayami',
          item.id_product, // Tipe
          item.model || '',
          item.ukuran || '', // Size
          qtyNum,
          item.uom || 'PCS',
          hargaNum,
          subtotalNum,
          subtotalNum,
          keterangan || '',
          'd', // Draft (akan diotorisasi / diterima di inbound list)
          '1', // jenis = 1 untuk Purchase Order
          branchId,
          1,
          0,
          imgPath,
        ]
      );

      // Teruskan update gambar ke tb_stock jika gambar ada dan barang sudah ada di tb_stock
      if (imgPath) {
        try {
          await poolLocal.query(
            `UPDATE tb_stock 
             SET image = ? 
             WHERE (id_bahan = ? OR id_bahan = (SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ? LIMIT 1))
               AND model = ?
               AND (image IS NULL OR image = '' OR image NOT LIKE '/%')`,
            [imgPath, item.id_product, item.id_product, item.model || '']
          );
        } catch (stkErr) {
          console.warn('Sync image to tb_stock warning:', stkErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Purchase Order berhasil dibuat.',
      data: {
        id_transaksi,
        tgl_transaksi: tglDate,
        id_cabang: branchId,
        total_items: items.length,
      },
    });
  } catch (error: any) {
    console.error('Create Purchase Order error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal membuat Purchase Order.' },
      { status: 500 }
    );
  }
}

// 3. DELETE: Delete Purchase Order (Draft only)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id_transaksi = searchParams.get('id_transaksi');

    if (!id_transaksi) {
      return NextResponse.json(
        { success: false, message: 'ID Transaksi wajib diisi.' },
        { status: 400 }
      );
    }

    const [existing] = await poolLocal.query<RowDataPacket[]>(
      'SELECT status, jenis FROM tb_barang_masuk WHERE id_transaksi = ? LIMIT 1',
      [id_transaksi]
    );

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data Purchase Order tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (existing[0].status === 's') {
      return NextResponse.json(
        { success: false, message: 'Purchase Order yang sudah diterima (Close) tidak dapat dihapus.' },
        { status: 400 }
      );
    }

    await poolLocal.query(
      'DELETE FROM tb_barang_masuk WHERE id_transaksi = ? AND jenis = "1"',
      [id_transaksi]
    );

    return NextResponse.json({
      success: true,
      message: 'Purchase Order berhasil dihapus.',
    });
  } catch (error: any) {
    console.error('Delete Purchase Order error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal menghapus Purchase Order.' },
      { status: 500 }
    );
  }
}
