const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: '',
    database: 'pos_hayami',
  });

  try {
    // 1. Add columns to tb_barang_keluar if not present
    const [colsBK] = await conn.query('SHOW COLUMNS FROM tb_barang_keluar');
    const existingColsBK = colsBK.map((c) => c.Field);

    if (!existingColsBK.includes('is_closing')) {
      await conn.query('ALTER TABLE tb_barang_keluar ADD COLUMN is_closing TINYINT(1) NOT NULL DEFAULT 0');
      console.log('Added is_closing to tb_barang_keluar');
    }
    if (!existingColsBK.includes('closing_by')) {
      await conn.query('ALTER TABLE tb_barang_keluar ADD COLUMN closing_by VARCHAR(100) DEFAULT NULL');
      console.log('Added closing_by to tb_barang_keluar');
    }
    if (!existingColsBK.includes('tgl_closing')) {
      await conn.query('ALTER TABLE tb_barang_keluar ADD COLUMN tgl_closing DATETIME DEFAULT NULL');
      console.log('Added tgl_closing to tb_barang_keluar');
    }
    if (!existingColsBK.includes('id_closing')) {
      await conn.query('ALTER TABLE tb_barang_keluar ADD COLUMN id_closing INT DEFAULT NULL');
      console.log('Added id_closing to tb_barang_keluar');
    }

    // 2. Add columns to tb_retur if not present
    const [colsRet] = await conn.query('SHOW COLUMNS FROM tb_retur');
    const existingColsRet = colsRet.map((c) => c.Field);

    if (!existingColsRet.includes('is_closing')) {
      await conn.query('ALTER TABLE tb_retur ADD COLUMN is_closing TINYINT(1) NOT NULL DEFAULT 0');
      console.log('Added is_closing to tb_retur');
    }
    if (!existingColsRet.includes('closing_by')) {
      await conn.query('ALTER TABLE tb_retur ADD COLUMN closing_by VARCHAR(100) DEFAULT NULL');
      console.log('Added closing_by to tb_retur');
    }
    if (!existingColsRet.includes('tgl_closing')) {
      await conn.query('ALTER TABLE tb_retur ADD COLUMN tgl_closing DATETIME DEFAULT NULL');
      console.log('Added tgl_closing to tb_retur');
    }
    if (!existingColsRet.includes('id_closing')) {
      await conn.query('ALTER TABLE tb_retur ADD COLUMN id_closing INT DEFAULT NULL');
      console.log('Added id_closing to tb_retur');
    }

    // 3. Create tb_closing_harian
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tb_closing_harian (
        id INT AUTO_INCREMENT PRIMARY KEY,
        no_penutupan VARCHAR(50) NOT NULL UNIQUE,
        tgl_closing DATETIME NOT NULL,
        tgl_transaksi DATE NOT NULL,
        id_cabang VARCHAR(50) DEFAULT NULL,
        kasir VARCHAR(100) NOT NULL,
        kas_pembukaan DECIMAL(15,2) DEFAULT 0,
        total_penjualan DECIMAL(15,2) DEFAULT 0,
        total_retur DECIMAL(15,2) DEFAULT 0,
        total_bersih DECIMAL(15,2) DEFAULT 0,
        total_qty_penjualan FLOAT DEFAULT 0,
        total_qty_retur FLOAT DEFAULT 0,
        total_qty_bersih FLOAT DEFAULT 0,
        total_transaksi INT DEFAULT 0,
        nominal_cash DECIMAL(15,2) DEFAULT 0,
        nominal_hutang DECIMAL(15,2) DEFAULT 0,
        nominal_transfer DECIMAL(15,2) DEFAULT 0,
        catatan TEXT DEFAULT NULL,
        produk_json LONGTEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tgl_closing (tgl_closing),
        INDEX idx_tgl_transaksi (tgl_transaksi),
        INDEX idx_id_cabang (id_cabang),
        INDEX idx_no_penutupan (no_penutupan)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created or verified tb_closing_harian');

    // 4. Create tb_closing_harian_detail
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tb_closing_harian_detail (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_closing INT NOT NULL,
        no_penutupan VARCHAR(50) NOT NULL,
        id_bahan VARCHAR(100) DEFAULT NULL,
        model VARCHAR(100) DEFAULT NULL,
        ukuran VARCHAR(50) DEFAULT NULL,
        nama_barang VARCHAR(255) DEFAULT NULL,
        qty_penjualan FLOAT DEFAULT 0,
        qty_retur FLOAT DEFAULT 0,
        total_qty FLOAT DEFAULT 0,
        harga_satuan DECIMAL(15,2) DEFAULT 0,
        total_penjualan DECIMAL(15,2) DEFAULT 0,
        INDEX idx_id_closing (id_closing),
        INDEX idx_no_penutupan_detail (no_penutupan)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created or verified tb_closing_harian_detail');

    console.log('Database migration completed successfully!');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
