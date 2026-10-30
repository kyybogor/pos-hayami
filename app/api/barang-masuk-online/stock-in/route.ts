import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import poolServer from '@/lib/db_server';
import poolLocal from '@/lib/db';
import { verifySessionToken } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Generator for id_transaksi (PO/YYMM/xxxx)
async function generateBarangMasukKey(): Promise<string> {
  const now = new Date();
  const yearStr = now.getFullYear().toString().slice(-2);
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `PO/${yearStr}${monthStr}/`;

  const [rows] = await poolLocal.query<RowDataPacket[]>(
    'SELECT max(id_transaksi) as kodeTerbesar FROM tb_barang_masuk WHERE id_transaksi LIKE ?',
    [`${prefix}%`]
  );

  let sequence = 1;
  if (rows.length > 0 && rows[0].kodeTerbesar) {
    const numPart = parseInt(rows[0].kodeTerbesar.split('/').pop() || '0', 10);
    if (!isNaN(numPart)) {
      sequence = numPart + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
}

async function getStartNoIdSeq(): Promise<number> {
  const now = new Date();
  const yearStr = now.getFullYear().toString().slice(-2);
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `IM${monthStr}${yearStr}`;

  const [rows] = await poolLocal.query<RowDataPacket[]>(
    'SELECT max(no_id) as kodeTerbesar FROM tb_barang_masuk WHERE no_id LIKE ?',
    [`${prefix}%`]
  );

  let sequence = 1;
  if (rows.length > 0 && rows[0].kodeTerbesar) {
    const lastCode = rows[0].kodeTerbesar;
    const numPart = parseInt(lastCode.slice(6), 10);
    if (!isNaN(numPart)) {
      sequence = numPart + 1;
    }
  }

  return sequence;
}

function formatNoId(seq: number): string {
  const now = new Date();
  const yearStr = now.getFullYear().toString().slice(-2);
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `IM${monthStr}${yearStr}`;
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

async function getStartBahanSeq(): Promise<number> {
  const [rows] = await poolLocal.query<RowDataPacket[]>(
    "SELECT MAX(id_bahan) as maxId FROM tb_bahan WHERE id_bahan LIKE 'BA%'"
  );
  let sequence = 1;
  if (rows.length > 0 && rows[0].maxId) {
    const numPart = parseInt(rows[0].maxId.replace(/^BA/i, ''), 10);
    if (!isNaN(numPart)) {
      sequence = numPart + 1;
    }
  }
  return sequence;
}

function formatBahanId(seq: number): string {
  return `BA${String(seq).padStart(6, '0')}`;
}

// POST /api/barang-masuk-online/stock-in
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    const session = token ? await verifySessionToken(token) : null;

    const { id_do1, no_inv } = await req.json();

    if (!id_do1 || !no_inv) {
      return NextResponse.json(
        { success: false, message: 'ID DO dan No. Invoice wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Check if already stocked in locally to prevent double Stock In
    const cleanNoInv = (no_inv || '').trim();
    const cleanIdDo = (id_do1 || '').trim();

    const conditions: string[] = [];
    const params: any[] = [];
    if (cleanNoInv) {
      conditions.push('keterangan LIKE ?');
      params.push(`%${cleanNoInv}%`);
    }
    if (cleanIdDo) {
      conditions.push('keterangan LIKE ?');
      params.push(`%${cleanIdDo}%`);
    }

    if (conditions.length > 0) {
      const sql = `SELECT no_id FROM tb_barang_masuk WHERE ${conditions.join(' OR ')} LIMIT 1`;
      const [existingLocal] = await poolLocal.query<RowDataPacket[]>(sql, params);
      if (existingLocal.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: 'Transaksi ini sudah pernah di-Stock In sebelumnya dan tidak dapat di-Stock In ulang.',
          },
          { status: 400 }
        );
      }
    }

    // 2. Query items from remote server database (gdo2)
    const [gdo2Items] = await poolServer.query<RowDataPacket[]>(
      'SELECT a.*, SUM(a.qty) as qtyall FROM gdo2 a WHERE a.id_do1 = ? GROUP BY a.tipe, a.size, a.gambar',
      [id_do1]
    );

    if (gdo2Items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada item barang pada invoice online ini.' },
        { status: 404 }
      );
    }

    // Generate transaction key
    const idTransaksi = await generateBarangMasukKey();
    const today = new Date().toISOString().split('T')[0];
    const userBranch = session?.branch || '';
    const userId = session?.id_user || 'system';
    const byUserPajak = session?.by_user_pajak || '';

    let currentNoIdSeq = await getStartNoIdSeq();
    let currentBahanSeq = await getStartBahanSeq();

    // 3. Process each item into local database
    for (const item of gdo2Items) {
      const idBahan = item.tipe || '';
      const model = item.gambar || '';
      const size = item.size || '';
      const qtyBarang = Number(item.qtyall) || 0;
      const harga = Number(item.harga) || 0;
      const ttlHarga = harga * qtyBarang;

      // Check if item exists in local tb_bahan
      const [tipeCheck] = await poolLocal.query<RowDataPacket[]>(
        'SELECT id_bahan FROM tb_bahan WHERE nama_bahan = ?',
        [idBahan]
      );

      if (tipeCheck.length === 0) {
        // Fetch type size from server m_tipe_jadi
        let sizeValue = size;
        try {
          const [tipeInfo] = await poolServer.query<RowDataPacket[]>(
            'SELECT nm_tipe_jadi, size FROM m_tipe_jadi WHERE nm_tipe_jadi = ?',
            [idBahan]
          );
          if (tipeInfo.length > 0) {
            sizeValue = tipeInfo[0].size || size;
          }
        } catch (err) {
          console.warn('Failed to query server m_tipe_jadi:', err);
        }

        const newBahanId = formatBahanId(currentBahanSeq++);

        await poolLocal.query<ResultSetHeader>(
          `INSERT INTO tb_bahan (id_bahan, nama_bahan, ukuran, uom, id_cabang)
           VALUES (?, ?, ?, ?, ?)`,
          [newBahanId, idBahan, sizeValue, 'PCS', userBranch]
        );
      }

      // Generate local transaction line no_id sequentially
      const noId = formatNoId(currentNoIdSeq++);
      const keterangan = `INBOUND BARANG WAREHOUSE ONLINE - ${id_do1} - ${no_inv}`;

      // Insert into local tb_barang_masuk
      await poolLocal.query<ResultSetHeader>(
        `INSERT INTO tb_barang_masuk (
          no_id,
          id_transaksi,
          tgl_transaksi,
          id_supplier,
          id_product,
          model,
          ukuran,
          qty,
          uom,
          harga,
          total,
          subtotal,
          keterangan,
          status,
          by_user_pajak,
          dibuat_oleh,
          dibuat_tgl,
          id_cabang
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          noId,
          idTransaksi,
          today,
          'Hayami',
          idBahan,
          model,
          size,
          qtyBarang,
          'PCS',
          harga,
          ttlHarga,
          ttlHarga,
          keterangan,
          'd',
          byUserPajak,
          userId,
          today,
          userBranch,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Proses Stock In berhasil disimpan ke database lokal!',
      id_transaksi: idTransaksi,
    });
  } catch (error: any) {
    console.error('Stock In error:', error);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan saat memproses Stock In.' },
      { status: 500 }
    );
  }
}
