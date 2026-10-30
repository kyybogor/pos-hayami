import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/auth';
import pool from '@/lib/db';
import poolServerPos from '@/lib/db_server_pos';
import { RowDataPacket } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

const POS_TABLES_TO_SYNC = [
  'tb_barang_keluar',
  'tb_pembayaran',
  'tb_barang_masuk',
  'tb_retur',
  'tb_petty_cash',
  'setor_gudang',
  'tb_closing_harian',
  'tb_closing_harian_detail',
  'inv_adjust_in',
  'inv_adjust_out',
  'inv_adjust',
  'tb_stock',
  'tb_bahan',
  'tb_customer',
  'tb_karyawan',
  'tb_akun',
  'tb_satuan',
  'm_size',
  'tb_cabang',
  'm_akun',
  'm_kategori_akun',
  'm_product',
  'surat_jalan',
  'sj1',
  'sj2',
  'pengiriman',
  'tb_jurnal_umum',
  'tb_move_location',
  'tb_move_location_detail',
  'tb_location_stock',
  'tb_operasional',
  'tb_beban',
  'm_branch_stock',
  'm_ingredients',
  'm_tipe_jadi',
  'm_user',
  'tb_cust_type',
  'tb_address',
  'tb_user_akses',
];

const EXCLUDED_TABLES = [
  'gudang',
  'gudang_lama',
  'tbl_kodepos',
  'add_harga',
  'backup_barang_keluar',
  'tb_setup',
  'tb_lock_location',
  'tb_log_user',
  'retur_temp',
  'review',
];

function safeFormatValue(val: any) {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      return null;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())} ${pad(val.getHours())}:${pad(val.getMinutes())}:${pad(val.getSeconds())}`;
  }
  return val;
}

export async function POST() {
  // Cek apakah user sedang login dengan tipe 'online'
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('pos_session')?.value;
    if (token) {
      const session = await verifySessionToken(token);
      if (session?.tipe && String(session.tipe).trim().toLowerCase() === 'online') {
        return NextResponse.json({
          success: true,
          message: 'User berstatus ONLINE: Database transaksi sudah langsung terhubung ke database online, closing sinkronisasi tidak diperlukan.',
          skipped: true,
        });
      }
    }
  } catch (authErr) {
    console.error('Session check error in closing-sync:', authErr);
  }

  let serverConn: any = null;

  try {
    // 1. Get all local tables that exist
    let localTableList: string[] = [];
    try {
      const [rows] = await pool.query<RowDataPacket[]>('SHOW TABLES');
      const allLocalTables = rows.map((r) => Object.values(r)[0] as string);

      // Prioritize known tables in POS_TABLES_TO_SYNC
      const prioritized = POS_TABLES_TO_SYNC.filter((t) => allLocalTables.includes(t));

      // Also dynamically include any other non-backup local tables
      const extraTables = allLocalTables.filter(
        (t) => !prioritized.includes(t) && !EXCLUDED_TABLES.includes(t)
      );

      localTableList = [...prioritized, ...extraTables];
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal mengambil daftar tabel dari database lokal: ' + (err.message || 'Error lokal'),
        },
        { status: 500 }
      );
    }

    // 2. Connect to Online Server DB & Start Transaction
    try {
      serverConn = await poolServerPos.getConnection();
      await serverConn.beginTransaction();
    } catch (connErr: any) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Gagal terhubung ke server database online. Silakan periksa koneksi internet Anda. (' +
            (connErr.message || 'Connection timeout') +
            ')',
        },
        { status: 503 }
      );
    }

    // 3. Fetch existing tables on the online server
    const [serverTablesRows]: any = await serverConn.query('SHOW TABLES');
    const serverTableNames = new Set((serverTablesRows || []).map((r: any) => Object.values(r)[0] as string));

    let syncedTableCount = 0;
    let totalRowsSynced = 0;
    const syncSummary: { table: string; rows: number }[] = [];

    // 4. Process each table with Automatic Schema Sync & Safe Columns
    for (const tableName of localTableList) {
      let localRows: RowDataPacket[] = [];
      try {
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM \`${tableName}\``);
        localRows = rows;
      } catch (e) {
        continue;
      }

      // A. If table does NOT exist on the server, auto-create it using local DDL
      if (!serverTableNames.has(tableName)) {
        try {
          const [createRows] = await pool.query<RowDataPacket[]>(`SHOW CREATE TABLE \`${tableName}\``);
          if (createRows.length > 0) {
            const createSql = createRows[0]['Create Table'];
            await serverConn.query(createSql);
            serverTableNames.add(tableName);
            console.log(`[Closing Sync] Auto-created table on online server: ${tableName}`);
          }
        } catch (createErr: any) {
          console.warn(`[Closing Sync] Skip table ${tableName}, could not auto-create on server:`, createErr.message);
          continue;
        }
      }

      // B. Fetch server columns and local columns to detect any missing columns
      let serverCols = new Set<string>();
      try {
        const [serverColRows]: any = await serverConn.query(`SHOW COLUMNS FROM \`${tableName}\``);
        serverCols = new Set((serverColRows || []).map((c: any) => c.Field));
      } catch (colErr: any) {
        console.warn(`[Closing Sync] Could not fetch columns for ${tableName} on server:`, colErr.message);
        continue;
      }

      try {
        const [localColRows] = await pool.query<RowDataPacket[]>(`SHOW COLUMNS FROM \`${tableName}\``);
        for (const col of localColRows) {
          if (!serverCols.has(col.Field)) {
            // Auto add missing column on the online server
            try {
              let colDef = `${col.Type}`;
              if (col.Null === 'NO') colDef += ' NOT NULL';
              if (col.Default !== null && col.Default !== undefined) {
                colDef += ` DEFAULT '${col.Default}'`;
              } else if (col.Null !== 'NO') {
                colDef += ' DEFAULT NULL';
              }
              await serverConn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.Field}\` ${colDef}`);
              serverCols.add(col.Field);
              console.log(`[Closing Sync] Auto-added column \`${col.Field}\` to online table \`${tableName}\``);
            } catch (alterErr: any) {
              console.warn(`[Closing Sync] Could not alter table ${tableName} for col ${col.Field}:`, alterErr.message);
            }
          }
        }
      } catch (schemaErr: any) {
        console.warn(`[Closing Sync] Schema inspection skipped for ${tableName}:`, schemaErr.message);
      }

      if (!localRows || localRows.length === 0) {
        continue;
      }

      // C. Filter columns to only those that exist on the online server (prevents "Unknown column" errors!)
      const rawColumns = Object.keys(localRows[0]);
      const safeColumns = rawColumns.filter((col) => serverCols.has(col));
      if (safeColumns.length === 0) continue;

      const colNamesStr = safeColumns.map((col) => `\`${col}\``).join(', ');

      // D. Batch REPLACE INTO with 500 rows per batch
      const BATCH_SIZE = 500;
      for (let i = 0; i < localRows.length; i += BATCH_SIZE) {
        const batch = localRows.slice(i, i + BATCH_SIZE);
        const valuePlaceholders: string[] = [];
        const queryValues: any[] = [];

        for (const row of batch) {
          const rowPlaceholders = safeColumns.map(() => '?').join(', ');
          valuePlaceholders.push(`(${rowPlaceholders})`);
          for (const col of safeColumns) {
            queryValues.push(safeFormatValue(row[col]));
          }
        }

        const replaceSql = `REPLACE INTO \`${tableName}\` (${colNamesStr}) VALUES ${valuePlaceholders.join(
          ', '
        )}`;

        await serverConn.query(replaceSql, queryValues);
      }

      syncedTableCount++;
      totalRowsSynced += localRows.length;
      syncSummary.push({ table: tableName, rows: localRows.length });
    }

    // 5. Commit transaction on success
    await serverConn.commit();

    return NextResponse.json({
      success: true,
      message: `Proses closing harian & sinkronisasi data ke server online berhasil dilakukan (${syncedTableCount} tabel, ${totalRowsSynced} data).`,
      timestamp: new Date().toISOString(),
      summary: syncSummary,
    });
  } catch (err: any) {
    if (serverConn) {
      try {
        await serverConn.rollback();
      } catch (rbErr) {
        console.error('Rollback failed:', rbErr);
      }
    }

    console.error('Closing sync error:', err);
    return NextResponse.json(
      {
        success: false,
        message:
          'Gagal melakukan closing karena error data atau koneksi terputus. Pengiriman dibatalkan sepenuhnya (0 data masuk). Detail: ' +
          (err.message || String(err)),
        error: err.message || String(err),
      },
      { status: 500 }
    );
  } finally {
    if (serverConn) {
      serverConn.release();
    }
  }
}
