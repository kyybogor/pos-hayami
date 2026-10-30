'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const ROUTE_MENU_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pos': 'POS Penjualan',
  '/barang-keluar': 'List Penjualan',
  '/retur-barang': 'Retur Barang',
  '/inventory-list': 'Inventory List',
  '/stock-card-detail': 'Stock Card Detail',
  '/stock-card-general': 'Stock Card General',
  '/opname': 'Stock Opname',
  '/move-location': 'Move Location',
  '/master-customer': 'Master Customer',
  '/master-barang': 'Master Barang',
  '/master-user-login': 'Master User Login',
  '/master-account': 'Master Account',
  '/master-location': 'Master Location',
  '/master-cabang': 'Master Cabang',
  '/log-user': 'Log User',
  '/barang-masuk-online': 'Inbound Online',
  '/barang-masuk-offline': 'Inbound Offline',
  '/purchase-order': 'Purchase Order',
  '/laporan-barang-masuk': 'Laporan Barang Masuk',
  '/rekapitulasi-penjualan': 'Rekapitulasi Penjualan',
  '/stock-detail': 'Stock Detail',
  '/laporan-piutang': 'Laporan Piutang',
  '/laporan-retur': 'Laporan Retur',
  '/barang-retur-rekap': 'Rekapitulasi Retur',
  '/petty-cash': 'Petty Cash',
  '/login': 'Halaman Login',
};

export default function UserActivityTracker() {
  const pathname = usePathname();
  const lastLoggedPath = useRef<string>('');

  useEffect(() => {
    if (!pathname || pathname === lastLoggedPath.current) return;
    lastLoggedPath.current = pathname;

    // Determine friendly menu name from pathname
    let menuName = 'Aplikasi POS';
    for (const [route, name] of Object.entries(ROUTE_MENU_MAP)) {
      if (pathname === route || pathname.startsWith(`${route}/`)) {
        menuName = name;
        break;
      }
    }

    // Send background log request
    const logActivity = async () => {
      try {
        await fetch('/api/log-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu: menuName,
            aktivitas: `Membuka Halaman ${menuName}`,
          }),
        });
      } catch (err) {
        // Fail silently in background
      }
    };

    logActivity();
  }, [pathname]);

  return null;
}
