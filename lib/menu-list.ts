export interface MenuItem {
  id: string;
  name: string;
  path: string;
  category: MenuCategoryKey;
  icon: string;
  description: string;
  superadminOnly?: boolean;
}

export type MenuCategoryKey =
  | 'dashboard'
  | 'master'
  | 'inbound'
  | 'sales'
  | 'inventory'
  | 'finance'
  | 'report';

export interface MenuCategory {
  key: MenuCategoryKey;
  name: string;
  description: string;
  icon: string;
}

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    description: 'Menu ringkasan dan statistik utama sistem POS',
    icon: 'LayoutDashboard',
  },
  {
    key: 'master',
    name: 'Master Data',
    description: 'Master customer, barang, user, cabang, dan data induk',
    icon: 'Database',
  },
  {
    key: 'inbound',
    name: 'Inbound / Barang Masuk',
    description: 'Penerimaan stok barang masuk online, offline, dan PO',
    icon: 'Truck',
  },
  {
    key: 'sales',
    name: 'Penjualan / Sales',
    description: 'Point of Sales (POS), riwayat penjualan, dan retur',
    icon: 'ShoppingBag',
  },
  {
    key: 'inventory',
    name: 'Inventory / Stok',
    description: 'Daftar stok, kartu stok, transfer, opname, dan lokasi',
    icon: 'Boxes',
  },
  {
    key: 'finance',
    name: 'Finance / Keuangan',
    description: 'Petty cash, piutang, closing harian, dan penerimaan/pengeluaran',
    icon: 'Calculator',
  },
  {
    key: 'report',
    name: 'Report / Laporan',
    description: 'Laporan barang masuk, penjualan, retur, dan rekapitulasi',
    icon: 'FileText',
  },
];

export const SYSTEM_MENUS: MenuItem[] = [
  // 1. Dashboard
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/dashboard',
    category: 'dashboard',
    icon: 'LayoutDashboard',
    description: 'Halaman utama ringkasan omset dan performa toko',
  },

  // 2. Master
  {
    id: 'master-customer',
    name: 'Master Customer',
    path: '/master-customer',
    category: 'master',
    icon: 'Users',
    description: 'Manajemen data pelanggan dan kontak pembeli',
  },
  {
    id: 'master-customer-type',
    name: 'Master Type Customer',
    path: '/master-customer-type',
    category: 'master',
    icon: 'Tag',
    description: 'Kategori dan klasifikasi jenis customer',
  },
  {
    id: 'master-barang',
    name: 'Master Barang',
    path: '/master-barang',
    category: 'master',
    icon: 'Package',
    description: 'Katalog produk, harga, barcode, dan satuan barang',
  },
  {
    id: 'master-user-login',
    name: 'Master User Login',
    path: '/master-user-login',
    category: 'master',
    icon: 'UserCheck',
    description: 'Pengaturan akun kasir, staf, dan kredensial login',
  },
  {
    id: 'master-akses-user',
    name: 'Master Akses User',
    path: '/master-akses-user',
    category: 'master',
    icon: 'Shield',
    description: 'Kontrol hak akses menu per user (Khusus Superadmin)',
    superadminOnly: true,
  },
  {
    id: 'master-account',
    name: 'Master Account',
    path: '/master-account',
    category: 'master',
    icon: 'CreditCard',
    description: 'Bagan akun rekening kas dan bank untuk pembayaran',
  },
  {
    id: 'master-location',
    name: 'Master Location',
    path: '/master-location',
    category: 'master',
    icon: 'MapPin',
    description: 'Lokasi rak dan penempatan barang di gudang/toko',
  },
  {
    id: 'master-cabang',
    name: 'Master Cabang',
    path: '/master-cabang',
    category: 'master',
    icon: 'Building2',
    description: 'Daftar kantor cabang dan outlet toko Hayami',
  },
  {
    id: 'log-user',
    name: 'Log User',
    path: '/log-user',
    category: 'master',
    icon: 'History',
    description: 'Catatan aktivitas dan histori login pengguna',
  },

  // 3. Inbound
  {
    id: 'barang-masuk-online',
    name: 'Inbound Online',
    path: '/barang-masuk-online',
    category: 'inbound',
    icon: 'ArrowDownRight',
    description: 'Penerimaan barang masuk dari server pusat',
  },
  {
    id: 'barang-masuk-offline',
    name: 'Inbound List',
    path: '/barang-masuk-offline',
    category: 'inbound',
    icon: 'Truck',
    description: 'Daftar penerimaan barang masuk lokal cabang',
  },
  {
    id: 'purchase-order',
    name: 'Purchase Order',
    path: '/purchase-order',
    category: 'inbound',
    icon: 'ClipboardList',
    description: 'Pemesanan barang dan surat pesanan pembelian',
  },

  // 4. Penjualan / Sales
  {
    id: 'pos',
    name: 'POS (Point of Sales)',
    path: '/pos',
    category: 'sales',
    icon: 'ShoppingCart',
    description: 'Mesin kasir untuk input transaksi penjualan langsung',
  },
  {
    id: 'barang-keluar',
    name: 'List Penjualan',
    path: '/barang-keluar',
    category: 'sales',
    icon: 'Receipt',
    description: 'Daftar invoice dan riwayat transaksi penjualan barang keluar',
  },
  {
    id: 'retur-barang',
    name: 'Retur Barang',
    path: '/retur-barang',
    category: 'sales',
    icon: 'RotateCcw',
    description: 'Proses retur pengembalian barang dari customer',
  },

  // 5. Inventory
  {
    id: 'inventory-list',
    name: 'Inventory List',
    path: '/inventory-list',
    category: 'inventory',
    icon: 'Boxes',
    description: 'Daftar sisa stok real-time seluruh barang di cabang',
  },
  {
    id: 'stock-card-detail',
    name: 'Stock Card Detail',
    path: '/stock-card-detail',
    category: 'inventory',
    icon: 'ClipboardList',
    description: 'Kartu stok detail per transaksi masuk dan keluar',
  },
  {
    id: 'stock-card-general',
    name: 'Stock Card General',
    path: '/stock-card-general',
    category: 'inventory',
    icon: 'Package',
    description: 'Ringkasan kartu stok umum per periode waktu',
  },
  {
    id: 'transfer-stock',
    name: 'Transfer Stock',
    path: '/transfer-stock',
    category: 'inventory',
    icon: 'ArrowRightLeft',
    description: 'Mutasi dan pemindahan stok antar cabang toko',
  },
  {
    id: 'opname',
    name: 'Stock Opname',
    path: '/opname',
    category: 'inventory',
    icon: 'ClipboardList',
    description: 'Penyesuaian fisik stok dan koreksi inventaris',
  },
  {
    id: 'move-location',
    name: 'Move Location',
    path: '/move-location',
    category: 'inventory',
    icon: 'ArrowRightLeft',
    description: 'Pemindahan lokasi rak / slot penempatan stok dalam gudang',
  },

  // 6. Finance
  {
    id: 'petty-cash',
    name: 'Petty Cash',
    path: '/petty-cash',
    category: 'finance',
    icon: 'Wallet',
    description: 'Pencatatan kas kecil toko untuk operasional harian',
  },
  {
    id: 'laporan-piutang',
    name: 'Account Receivable (Piutang)',
    path: '/laporan-piutang',
    category: 'finance',
    icon: 'CreditCard',
    description: 'Daftar tagihan dan pelunasan piutang customer',
  },
  {
    id: 'closing-harian',
    name: 'Closing Harian',
    path: '/closing-harian',
    category: 'finance',
    icon: 'Calculator',
    description: 'Tutup buku kasir harian dan rekonsiliasi pembayaran',
  },
  {
    id: 'penerimaan-harian',
    name: 'Laporan Penerimaan Harian',
    path: '/penerimaan-harian',
    category: 'finance',
    icon: 'TrendingUp',
    description: 'Laporan arus uang masuk dari transaksi harian',
  },
  {
    id: 'laporan-pengeluaran',
    name: 'Laporan Pengeluaran Harian',
    path: '/laporan-pengeluaran',
    category: 'finance',
    icon: 'TrendingDown',
    description: 'Laporan arus uang keluar toko dan pengeluaran kas',
  },

  // 7. Report
  {
    id: 'laporan-barang-masuk',
    name: 'Laporan Barang Masuk',
    path: '/laporan-barang-masuk',
    category: 'report',
    icon: 'FileText',
    description: 'Rekap data barang masuk berdasarkan tanggal dan supplier',
  },
  {
    id: 'rekapitulasi-penjualan',
    name: 'Rekapitulasi Penjualan',
    path: '/rekapitulasi-penjualan',
    category: 'report',
    icon: 'Receipt',
    description: 'Rekapitulasi total penjualan, omset, dan kuantiti',
  },
  {
    id: 'stock-detail',
    name: 'Stock Detail',
    path: '/stock-detail',
    category: 'report',
    icon: 'Package',
    description: 'Laporan detail posisi stok dan nilai persediaan',
  },
  {
    id: 'laporan-retur',
    name: 'Laporan Retur',
    path: '/laporan-retur',
    category: 'report',
    icon: 'RotateCcw',
    description: 'Laporan transaksi retur penjualan dan pembelian',
  },
  {
    id: 'barang-retur-rekap',
    name: 'Rekapitulasi Retur',
    path: '/barang-retur-rekap',
    category: 'report',
    icon: 'Receipt',
    description: 'Ringkasan data rekap retur barang per periode',
  },
];
