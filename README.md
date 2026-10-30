<div align="center">

# 🛒 POS Hayami - Modern Point of Sale & Retail Management System

![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

<p align="center">
  <b>Sistem Point of Sale (POS), Manajemen Inventaris Multi-Cabang, Keuangan Kasir, dan Pelaporan Terintegrasi untuk Hayami Retail.</b>
</p>

</div>

---

## 📌 Tentang Sistem

**POS Hayami** adalah platform retail enterprise modern berbasis web yang dibangun untuk mengotomatisasi dan mempermudah seluruh alur operasional toko fisik maupun multi-cabang. Sistem ini menggabungkan antarmuka kasir (*Point of Sale*) yang cepat dan responsif, pengelolaan stok inventaris real-time, alur barang masuk/keluar, pencatatan keuangan harian kasir, manajemen absensi & log aktivitas kerja staf, hingga pelaporan berkala berformat Excel.

Aplikasi ini dirancang dengan arsitektur **Next.js App Router**, **React 19**, **TypeScript**, dan basis data relasional **MySQL**, menjamin kinerja tinggi, keandalan transaksi data, dan antarmuka pengguna yang bersih serta intuitif.

---

## ✨ Fitur Utama Sistem

### 1. 📊 Dashboard Eksekutif & Analitik
- Ringkasan omset penjualan harian, mingguan, dan bulanan secara *real-time*.
- Visualisasi metrik transaksi kasir, tren barang terlaris, dan status stok kritis.
- Navigasi cepat ke seluruh modul operasional toko.

### 2. 💳 Point of Sales (POS) & Penjualan
- **Antarmuka Kasir Cepat**: Mendukung pemindaian barcode produk, pencarian barang instan, dan penentuan kuantiti dinamis.
- **Multi-Metode Pembayaran**: Pembayaran tunai (*cash*), transfer bank, debit/kredit, dan pencatatan uang kembalian otomatis.
- **Cetak Struk & Nota**: Format cetak struk thermal kasir dan invoice penjualan siap cetak.
- **Retur Penjualan**: Penanganan pengembalian produk dari pelanggan dengan verifikasi nota transaksi dan pembaruan stok otomatis.
- **Riwayat Penjualan (Barang Keluar)**: Tracking seluruh invoice dan riwayat transaksi yang diterbitkan.

### 3. 📦 Inbound & Pengadaan Barang
- **Barang Masuk Online**: Sinkronisasi penerimaan pengiriman barang dari server pusat atau gudang utama ke cabang.
- **Barang Masuk Offline**: Input manual penerimaan barang langsung dari supplier lokal.
- **Purchase Order (PO)**: Manajemen surat pesanan pembelian produk ke supplier, lengkap dengan fitur lampiran nota/gambar bukti fisik.

### 4. 🏢 Manajemen Inventaris & Pergudangan
- **Inventory List**: Pantauan kuantiti stok terkini seluruh produk per cabang secara akurat.
- **Kartu Stok (Stock Card Detail & General)**: Pencatatan mutasi riwayat keluar-masuk barang yang transparan per batch/transaksi.
- **Transfer Stock**: Fitur mutasi dan pengiriman stok antar-cabang toko Hayami.
- **Stock Opname**: Rekonsiliasi berkala antara stok fisik di toko/gudang dengan stok di sistem untuk mendeteksi selisih.
- **Move Location**: Penataan dan pemindahan lokasi rak atau slot penempatan barang di gudang.

### 5. 💰 Keuangan & Rekonsiliasi Kasir
- **Closing Harian Kasir**: Tutup buku harian kasir, menghitung total uang tunai fisik di laci kasir vs pencatatan sistem (*cash drawer reconciliation*).
- **Petty Cash (Kas Kecil)**: Pengelolaan dana operasional harian toko berskala kecil.
- **Laporan Piutang (Account Receivable)**: Manajemen transaksi tempo/kredit pelanggan dan pencatatan cicilan pelunasan.
- **Laporan Arus Kas**: Rekap penerimaan kas harian dan pengeluaran operasional toko.

### 6. 👥 Master Data & Hak Akses Pengguna (RBAC)
- **Master Barang**: Katalog produk lengkap dengan SKU, barcode, harga beli, harga jual, dan satuan.
- **Master Customer & Customer Type**: Data pelanggan beserta segmentasi diskon/kategori khusus.
- **Master Cabang**: Pengaturan identitas outlet/cabang operasional.
- **Master Akun Bank**: Pengaturan rekening kas dan bank penampung dana transaksi.
- **Master User Login**: Manajemen kredensial kasir, kepala toko, staf gudang, dan administrator.
- **Role-Based Access Control (RBAC)**: Kontrol hak akses menu yang dapat disesuaikan per level pengguna (hanya dapat diakses oleh Superadmin).

### 7. ⏱️ Presensi, Kehadiran & Audit Trail
- **Log User**: Audit trail komprehensif yang mencatat waktu login, logout, sesi kasir aktif, dan rekaman aktivitas user selama jam operasional.
- Terintegrasi dengan ekosistem manajemen kehadiran/shift kerja kasir guna memastikan transparansi operasional toko.

### 8. 📑 Laporan Komprehensif & Export Excel
- Rekapitulasi penjualan per tanggal, kasir, atau cabang.
- Laporan barang masuk, retur, dan kartu persediaan stok.
- Ekspor data laporan langsung ke file spreadsheet **Microsoft Excel (.xlsx)** dengan format tabel profesional menggunakan `exceljs`.

---

## 🛠️ Tech Stack & Arsitektur

| Komponen | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) (v16 App Router) | Fullstack React framework dengan Server & Client Components |
| **UI Library** | [React](https://react.dev/) (v19) | Pembangunan komponen antarmuka yang reaktif |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) (v4) | Utility-first styling modern dan responsive |
| **Icons** | [Lucide React](https://lucide.dev/) | Icon library modern dan ringan |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (v5) | Static typing untuk keamanan dan skalabilitas kode |
| **Database** | [MySQL](https://www.mysql.com/) + `mysql2` | Database relasional untuk penyimpanan data transaksi dan master |
| **Auth** | [Jose](https://github.com/panva/jose) (JWT) | JSON Web Token authentication pada Next.js Edge/Middleware |
| **Export Engine**| [ExcelJS](https://github.com/exceljs/exceljs) | Generate file laporan spreadsheet XLSX |

---

## 📂 Struktur Direktori Proyek

```plaintext
pos-hayami/
├── app/
│   ├── api/                     # Next.js API Routes (Backend handlers)
│   ├── dashboard/               # Halaman utama ringkasan sistem
│   ├── pos/                     # Halaman kasir Point of Sales
│   ├── barang-keluar/           # Riwayat transaksi penjualan & invoice
│   ├── barang-masuk-online/     # Penerimaan barang via server pusat
│   ├── barang-masuk-offline/    # Penerimaan barang lokal
│   ├── purchase-order/          # Manajemen order pembelian & upload bukti
│   ├── inventory-list/          # Monitoring stok barang real-time
│   ├── stock-card-detail/       # Kartu stok detail per transaksi
│   ├── stock-card-general/      # Kartu stok ringkasan
│   ├── transfer-stock/          # Mutasi stok antar-cabang
│   ├── opname/                  # Stock opname fisik berkala
│   ├── move-location/           # Penataan lokasi rak gudang
│   ├── retur-barang/            # Proses input retur barang
│   ├── closing-harian/          # Tutup buku kasir & rekonsiliasi kas
│   ├── petty-cash/              # Pengelolaan kas kecil toko
│   ├── penerimaan-harian/       # Laporan pemasukan harian
│   ├── laporan-pengeluaran/     # Laporan pengeluaran operasional
│   ├── laporan-piutang/         # Tracking piutang & cicilan customer
│   ├── rekapitulasi-penjualan/  # Laporan omset & penjualan
│   ├── master-*/                # Manajemen Master Data (Barang, User, Customer, dll.)
│   ├── log-user/                # Catatan log aktivitas dan sesi pengguna
│   ├── print/                   # Layout cetak nota & invoice
│   ├── login/                   # Halaman autentikasi login pengguna
│   └── page.tsx                 # Redirect root ke /dashboard
├── components/                  # Komponen UI modular (Navbar, Sidebar, Modals, Cards)
├── lib/
│   ├── auth.ts                  # Autentikasi token & verifikasi session
│   ├── db.ts                    # Koneksi MySQL pool database lokal
│   ├── db_server.ts             # Koneksi MySQL server pusat
│   ├── menu-list.ts             # Definisi navigasi & izin akses menu
│   └── excel-export-utils.ts    # Helper generator export laporan Excel
├── middleware.ts                # Next.js Middleware untuk proteksi rute & JWT
├── public/                      # Aset statis gambar, logo Hayami, dan folder upload
├── scripts/                     # Script migrasi dan utility database
├── .env.example                 # Contoh variabel lingkungan
└── package.json                 # Konfigurasi dependensi proyek
```

---

## 🚀 Panduan Instalasi & Menjalankan Proyek

### 1. Prasyarat Sistem
Pastikan telah menginstal:
- **Node.js** versi 18.18 atau lebih baru (disarankan Node.js LTS).
- **MySQL Server** (melalui XAMPP, Laragon, Docker, atau instalasi standalone).
- **Git** untuk version control.

### 2. Kloning Repositori
```bash
git clone https://github.com/kyybogor/pos-hayami.git
cd pos-hayami
```

### 3. Instal Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment Variables
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Sesuaikan konfigurasi koneksi database Anda di `.env.local`:
```env
# Konfigurasi Database MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=pos_hayami

# Kunci Enkripsi JWT
JWT_SECRET=rahasia_jwt_super_aman_pos_hayami_2026
```

### 5. Setup Database
Pastikan database MySQL dengan nama `pos_hayami` sudah dibuat pada server MySQL Anda. Jalankan skema tabel master dan relasi yang diperlukan.

### 6. Menjalankan Server Development
```bash
npm run dev
```

Buka peramban (*browser*) dan akses:
```
http://localhost:3000
```

### 7. Membangun untuk Production
```bash
npm run build
npm run start
```

---

## 🔒 Keamanan & Hak Akses

- **JWT Session Tokens**: Menggunakan otentikasi berbasis token dengan cookie `httpOnly` yang diverifikasi secara instan melalui Next.js Edge Middleware.
- **Role Permission Checking**: Setiap menu dan API endpoint memvalidasi hak akses pengguna secara dinamis sehingga staf kasir, staf gudang, dan superadmin memiliki visibilitas yang sesuai dengan wewenang masing-masing.
- **SQL Sanitization**: Query dieksekusi dengan *parameterized queries* via library `mysql2` untuk mencegah celah keamanan SQL Injection.

---

## 👨‍💻 Kontributor & Pengembang

Dikembangkan dan dikelola oleh:
- **GitHub**: [@kyybogor](https://github.com/kyybogor)
- **Repository**: [https://github.com/kyybogor/pos-hayami](https://github.com/kyybogor/pos-hayami)

---

<div align="center">
  <sub>Dibuat dengan ❤️ untuk operasional retail Hayami yang lebih efisien dan modern.</sub>
</div>
