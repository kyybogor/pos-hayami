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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS setor_gudang (
        id VARCHAR(50) NOT NULL PRIMARY KEY,
        tgl_setor DATE NOT NULL,
        grandtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
        hutang DECIMAL(15,2) NOT NULL DEFAULT 0,
        id_cabang VARCHAR(50) NOT NULL,
        total_masuk DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_keluar DECIMAL(15,2) NOT NULL DEFAULT 0,
        saldo_sebelum DECIMAL(15,2) NOT NULL DEFAULT 0,
        nominal_setor DECIMAL(15,2) NOT NULL DEFAULT 0,
        saldo_akhir DECIMAL(15,2) NOT NULL DEFAULT 0,
        keterangan TEXT DEFAULT NULL,
        dibuat_oleh VARCHAR(50) NOT NULL,
        dibuat_tgl DATETIME NOT NULL,
        id_petty VARCHAR(50) DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'SELESAI',
        is_sync TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_setor_cabang (id_cabang),
        INDEX idx_setor_tgl (tgl_setor)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Successfully created or verified setor_gudang table');

    const [cols] = await conn.query('SHOW COLUMNS FROM setor_gudang');
    const existingCols = cols.map((c) => c.Field);
    if (!existingCols.includes('is_sync')) {
      await conn.query('ALTER TABLE setor_gudang ADD COLUMN is_sync TINYINT(1) DEFAULT 0');
      console.log('Added is_sync column');
    }
  } catch (err) {
    console.error('Error creating setor_gudang table:', err);
  } finally {
    await conn.end();
  }
}

run();
