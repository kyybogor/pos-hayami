'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  Users,
  UserCheck,
  CreditCard,
  Package,
  Truck,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  ClipboardList,
  RotateCcw,
  FileText,
  Wallet,
  Calculator,
  Boxes,
  History,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  MapPin,
  Tag,
  Building2,
  Shield,
} from 'lucide-react';
import { UserSession } from '@/lib/auth';

interface SidebarProps {
  isOpen: boolean;
  user?: UserSession | null;
  allowedMenus?: string[];
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
}

export default function Sidebar({
  isOpen,
  user,
  allowedMenus,
  onMouseLeave,
  onMouseEnter,
}: SidebarProps) {
  const pathname = usePathname();

  const isSuperAdmin =
    (user?.role || '').toLowerCase() === 'superadmin' ||
    (user?.role || '').toLowerCase() === 'super';

  const canAccess = (path: string): boolean => {
    if (path === '/master-akses-user') {
      return isSuperAdmin;
    }
    if (isSuperAdmin) {
      return true;
    }
    if (!allowedMenus || allowedMenus.length === 0 || allowedMenus.includes('*')) {
      return true;
    }
    return allowedMenus.includes(path);
  };

  // Accordion Expand States
  const isMasterActive = pathname.startsWith('/master-') || pathname.startsWith('/log-user');
  const isBarangMasukActive = pathname.startsWith('/barang-masuk-') || pathname.startsWith('/purchase-order');
  const isBarangKeluarActive = pathname.startsWith('/barang-keluar') || pathname.startsWith('/pos') || pathname.startsWith('/retur-barang');
  const isInventoryActive = pathname.startsWith('/inventory-list') || pathname.startsWith('/stock-card-') || pathname.startsWith('/transfer-stock') || pathname.startsWith('/opname') || pathname.startsWith('/move-location');
  const isLaporanActive = pathname.startsWith('/laporan-') || pathname.startsWith('/rekapitulasi-') || pathname.startsWith('/stock-detail') || pathname.startsWith('/barang-retur-rekap');
  const isAkuntingActive = pathname.startsWith('/petty-cash') || pathname.startsWith('/akunting') || pathname.startsWith('/laporan-piutang') || pathname.startsWith('/closing-harian') || pathname.startsWith('/penerimaan-harian') || pathname.startsWith('/laporan-pengeluaran');

  const [masterExpanded, setMasterExpanded] = useState(isMasterActive);
  const [barangMasukExpanded, setBarangMasukExpanded] = useState(isBarangMasukActive);
  const [barangKeluarExpanded, setBarangKeluarExpanded] = useState(isBarangKeluarActive);
  const [inventoryExpanded, setInventoryExpanded] = useState(isInventoryActive);
  const [laporanExpanded, setLaporanExpanded] = useState(isLaporanActive);
  const [akuntingExpanded, setAkuntingExpanded] = useState(isAkuntingActive);

  // Auto-expand menus when active route matches
  useEffect(() => {
    if (pathname.startsWith('/master-') || pathname.startsWith('/log-user')) {
      setMasterExpanded(true);
    }
    if (pathname.startsWith('/barang-masuk-') || pathname.startsWith('/purchase-order')) {
      setBarangMasukExpanded(true);
    }
    if (pathname.startsWith('/barang-keluar') || pathname.startsWith('/pos') || pathname.startsWith('/retur-barang')) {
      setBarangKeluarExpanded(true);
    }
    if (pathname.startsWith('/inventory-list') || pathname.startsWith('/stock-card-') || pathname.startsWith('/transfer-stock') || pathname.startsWith('/opname') || pathname.startsWith('/move-location')) {
      setInventoryExpanded(true);
    }
    if (pathname.startsWith('/laporan-') || pathname.startsWith('/rekapitulasi-') || pathname.startsWith('/stock-detail') || pathname.startsWith('/barang-retur-rekap')) {
      setLaporanExpanded(true);
    }
    if (pathname.startsWith('/petty-cash') || pathname.startsWith('/akunting') || pathname.startsWith('/laporan-piutang') || pathname.startsWith('/closing-harian') || pathname.startsWith('/penerimaan-harian') || pathname.startsWith('/laporan-pengeluaran')) {
      setAkuntingExpanded(true);
    }
  }, [pathname]);

  // Visibility flags for parent categories
  const hasMaster =
    isSuperAdmin ||
    [
      '/master-customer',
      '/master-customer-type',
      '/master-barang',
      '/master-user-login',
      '/master-akses-user',
      '/master-account',
      '/master-location',
      '/master-cabang',
      '/log-user',
    ].some(canAccess);

  const hasInbound =
    isSuperAdmin ||
    ['/barang-masuk-online', '/barang-masuk-offline', '/purchase-order'].some(canAccess);

  const hasSales =
    isSuperAdmin || ['/pos', '/barang-keluar', '/retur-barang'].some(canAccess);

  const hasInventory =
    isSuperAdmin ||
    [
      '/inventory-list',
      '/stock-card-detail',
      '/stock-card-general',
      '/transfer-stock',
      '/opname',
      '/move-location',
    ].some(canAccess);

  const hasFinance =
    isSuperAdmin ||
    [
      '/petty-cash',
      '/laporan-piutang',
      '/closing-harian',
      '/penerimaan-harian',
      '/laporan-pengeluaran',
    ].some(canAccess);

  const hasReport =
    isSuperAdmin ||
    [
      '/laporan-barang-masuk',
      '/rekapitulasi-penjualan',
      '/stock-detail',
      '/laporan-retur',
      '/barang-retur-rekap',
    ].some(canAccess);

  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`bg-slate-50 border-slate-200 transition-all duration-300 ease-in-out flex flex-col z-20 shrink-0 ${
        isOpen
          ? 'w-64 border-r opacity-100 pointer-events-auto shadow-lg'
          : 'w-0 border-r-0 opacity-0 pointer-events-none overflow-hidden'
      }`}
    >
      <div className="w-64 flex flex-col h-full">
        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {/* Main Dashboard Link */}
          {canAccess('/dashboard') && (
            <div>
              <Link
                href="/dashboard"
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  pathname === '/dashboard'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <LayoutDashboard
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    pathname === '/dashboard' ? 'text-white' : 'text-slate-500 group-hover:text-emerald-600'
                  }`}
                />
                <div className="flex-1 flex items-center justify-between">
                  <span>Dashboard</span>
                </div>
              </Link>
            </div>
          )}

          {/* Master Collapsible Parent Menu */}
          {hasMaster && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setMasterExpanded(!masterExpanded)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${
                  isMasterActive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Database
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      isMasterActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'
                    }`}
                  />
                  <span>Master</span>
                </div>
                {masterExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Accordion Submenu Items under Master */}
              {masterExpanded && (
                <div className="pl-4 space-y-1 border-l-2 border-emerald-500/20 ml-4 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {canAccess('/master-customer') && (
                    <Link
                      href="/master-customer"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-customer'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Users className={`w-4 h-4 ${pathname === '/master-customer' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master Customer</span>
                    </Link>
                  )}

                  {canAccess('/master-customer-type') && (
                    <Link
                      href="/master-customer-type"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-customer-type'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Tag className={`w-4 h-4 ${pathname === '/master-customer-type' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master Type Customer</span>
                    </Link>
                  )}

                  {canAccess('/master-barang') && (
                    <Link
                      href="/master-barang"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-barang'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Package className={`w-4 h-4 ${pathname === '/master-barang' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master Barang</span>
                    </Link>
                  )}

                  {canAccess('/master-user-login') && (
                    <Link
                      href="/master-user-login"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-user-login'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <UserCheck className={`w-4 h-4 ${pathname === '/master-user-login' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master User Login</span>
                    </Link>
                  )}

                  {canAccess('/master-akses-user') && (
                    <Link
                      href="/master-akses-user"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-akses-user'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Shield className={`w-4 h-4 ${pathname === '/master-akses-user' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master Akses User</span>
                    </Link>
                  )}

                  {canAccess('/master-account') && (
                    <Link
                      href="/master-account"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-account'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <CreditCard className={`w-4 h-4 ${pathname === '/master-account' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master Account</span>
                    </Link>
                  )}

                  {canAccess('/master-location') && (
                    <Link
                      href="/master-location"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-location'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <MapPin className={`w-4 h-4 ${pathname === '/master-location' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master Location</span>
                    </Link>
                  )}

                  {canAccess('/master-cabang') && (
                    <Link
                      href="/master-cabang"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/master-cabang'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Building2 className={`w-4 h-4 ${pathname === '/master-cabang' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Master Cabang</span>
                    </Link>
                  )}

                  {canAccess('/log-user') && (
                    <Link
                      href="/log-user"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/log-user' || pathname.startsWith('/log-user')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <History className={`w-4 h-4 ${pathname.startsWith('/log-user') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Log User</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Barang Masuk Collapsible Parent Menu */}
          {hasInbound && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setBarangMasukExpanded(!barangMasukExpanded)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${
                  isBarangMasukActive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Truck
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      isBarangMasukActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'
                    }`}
                  />
                  <span>Inbound</span>
                </div>
                {barangMasukExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Accordion Submenu Items under Barang Masuk */}
              {barangMasukExpanded && (
                <div className="pl-4 space-y-1 border-l-2 border-emerald-500/20 ml-4 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {canAccess('/barang-masuk-online') && (
                    <Link
                      href="/barang-masuk-online"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname.startsWith('/barang-masuk-online')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <ArrowDownRight className={`w-4 h-4 ${pathname.startsWith('/barang-masuk-online') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Inbound</span>
                    </Link>
                  )}
                  {canAccess('/barang-masuk-offline') && (
                    <Link
                      href="/barang-masuk-offline"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname.startsWith('/barang-masuk-offline')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Truck className={`w-4 h-4 ${pathname.startsWith('/barang-masuk-offline') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Inbound List</span>
                    </Link>
                  )}
                  {canAccess('/purchase-order') && (
                    <Link
                      href="/purchase-order"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname.startsWith('/purchase-order')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <ClipboardList className={`w-4 h-4 ${pathname.startsWith('/purchase-order') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Purchase Order</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Barang Keluar Collapsible Parent Menu */}
          {hasSales && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setBarangKeluarExpanded(!barangKeluarExpanded)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${
                  isBarangKeluarActive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <ShoppingBag
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      isBarangKeluarActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'
                    }`}
                  />
                  <span>Penjualan / Sales</span>
                </div>
                {barangKeluarExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Accordion Submenu Items under Barang Keluar */}
              {barangKeluarExpanded && (
                <div className="pl-4 space-y-1 border-l-2 border-emerald-500/20 ml-4 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {canAccess('/pos') && (
                    <Link
                      href="/pos"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname.startsWith('/pos')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <ShoppingCart className={`w-4 h-4 ${pathname.startsWith('/pos') ? 'text-white' : 'text-slate-400'}`} />
                      <span>POS</span>
                    </Link>
                  )}

                  {canAccess('/barang-keluar') && (
                    <Link
                      href="/barang-keluar"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/barang-keluar' || (pathname.startsWith('/barang-keluar') && !pathname.startsWith('/pos'))
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Receipt className={`w-4 h-4 ${pathname.startsWith('/barang-keluar') ? 'text-white' : 'text-slate-400'}`} />
                      <span>List Penjualan</span>
                    </Link>
                  )}

                  {canAccess('/retur-barang') && (
                    <Link
                      href="/retur-barang"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname.startsWith('/retur-barang')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <RotateCcw className={`w-4 h-4 ${pathname.startsWith('/retur-barang') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Retur Barang</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Inventory Collapsible Parent Menu */}
          {hasInventory && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setInventoryExpanded(!inventoryExpanded)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${
                  isInventoryActive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Boxes
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      isInventoryActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'
                    }`}
                  />
                  <span>Inventory</span>
                </div>
                {inventoryExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Accordion Submenu Items under Inventory */}
              {inventoryExpanded && (
                <div className="pl-4 space-y-1 border-l-2 border-emerald-500/20 ml-4 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {canAccess('/inventory-list') && (
                    <Link
                      href="/inventory-list"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/inventory-list' || pathname.startsWith('/inventory-list')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Boxes className={`w-4 h-4 ${pathname.startsWith('/inventory-list') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Inventory List</span>
                    </Link>
                  )}

                  {canAccess('/stock-card-detail') && (
                    <Link
                      href="/stock-card-detail"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/stock-card-detail' || pathname.startsWith('/stock-card-detail')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <ClipboardList className={`w-4 h-4 ${pathname.startsWith('/stock-card-detail') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Stock Card Detail</span>
                    </Link>
                  )}

                  {canAccess('/stock-card-general') && (
                    <Link
                      href="/stock-card-general"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/stock-card-general' || pathname.startsWith('/stock-card-general')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Package className={`w-4 h-4 ${pathname.startsWith('/stock-card-general') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Stock Card General</span>
                    </Link>
                  )}

                  {canAccess('/transfer-stock') && (
                    <Link
                      href="/transfer-stock"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/transfer-stock' || pathname.startsWith('/transfer-stock')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <ArrowRightLeft className={`w-4 h-4 ${pathname.startsWith('/transfer-stock') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Transfer Stock</span>
                    </Link>
                  )}

                  {canAccess('/opname') && (
                    <Link
                      href="/opname"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname.startsWith('/opname')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <ClipboardList className={`w-4 h-4 ${pathname.startsWith('/opname') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Stock Opname</span>
                    </Link>
                  )}

                  {canAccess('/move-location') && (
                    <Link
                      href="/move-location"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/move-location' || pathname.startsWith('/move-location')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <ArrowRightLeft className={`w-4 h-4 ${pathname.startsWith('/move-location') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Move Location</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Finance / Akunting Collapsible Parent Menu */}
          {hasFinance && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setAkuntingExpanded(!akuntingExpanded)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${
                  isAkuntingActive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Calculator
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      isAkuntingActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'
                    }`}
                  />
                  <span>Finance</span>
                </div>
                {akuntingExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Accordion Submenu Items under Finance */}
              {akuntingExpanded && (
                <div className="pl-4 space-y-1 border-l-2 border-emerald-500/20 ml-4 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {canAccess('/petty-cash') && (
                    <Link
                      href="/petty-cash"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/petty-cash' || pathname.startsWith('/petty-cash')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Wallet className={`w-4 h-4 ${pathname.startsWith('/petty-cash') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Petty Cash</span>
                    </Link>
                  )}

                  {canAccess('/laporan-piutang') && (
                    <Link
                      href="/laporan-piutang"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/laporan-piutang' || pathname.startsWith('/laporan-piutang')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <CreditCard className={`w-4 h-4 ${pathname.startsWith('/laporan-piutang') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Account Receivable</span>
                    </Link>
                  )}

                  {canAccess('/closing-harian') && (
                    <Link
                      href="/closing-harian"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/closing-harian' || pathname.startsWith('/closing-harian')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Calculator className={`w-4 h-4 ${pathname.startsWith('/closing-harian') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Closing Harian</span>
                    </Link>
                  )}

                  {canAccess('/penerimaan-harian') && (
                    <Link
                      href="/penerimaan-harian"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/penerimaan-harian' || pathname.startsWith('/penerimaan-harian')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <TrendingUp className={`w-4 h-4 ${pathname.startsWith('/penerimaan-harian') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Laporan Penerimaan Harian</span>
                    </Link>
                  )}

                  {canAccess('/laporan-pengeluaran') && (
                    <Link
                      href="/laporan-pengeluaran"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/laporan-pengeluaran' || pathname.startsWith('/laporan-pengeluaran')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <TrendingDown className={`w-4 h-4 ${pathname.startsWith('/laporan-pengeluaran') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Laporan Pengeluaran Harian</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Report Collapsible Parent Menu */}
          {hasReport && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setLaporanExpanded(!laporanExpanded)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer group ${
                  isLaporanActive
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FileText
                    className={`w-5 h-5 shrink-0 transition-transform ${
                      isLaporanActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'
                    }`}
                  />
                  <span>Report</span>
                </div>
                {laporanExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Accordion Submenu Items under Report */}
              {laporanExpanded && (
                <div className="pl-4 space-y-1 border-l-2 border-emerald-500/20 ml-4 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {canAccess('/laporan-barang-masuk') && (
                    <Link
                      href="/laporan-barang-masuk"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/laporan-barang-masuk' || pathname.startsWith('/laporan-barang-masuk')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <FileText className={`w-4 h-4 ${pathname.startsWith('/laporan-barang-masuk') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Laporan Barang Masuk</span>
                    </Link>
                  )}

                  {canAccess('/rekapitulasi-penjualan') && (
                    <Link
                      href="/rekapitulasi-penjualan"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/rekapitulasi-penjualan' || pathname.startsWith('/rekapitulasi-penjualan')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Receipt className={`w-4 h-4 ${pathname.startsWith('/rekapitulasi-penjualan') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Rekapitulasi Penjualan</span>
                    </Link>
                  )}

                  {canAccess('/stock-detail') && (
                    <Link
                      href="/stock-detail"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/stock-detail' || pathname.startsWith('/stock-detail')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Package className={`w-4 h-4 ${pathname.startsWith('/stock-detail') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Stock Detail</span>
                    </Link>
                  )}

                  {canAccess('/laporan-retur') && (
                    <Link
                      href="/laporan-retur"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/laporan-retur' || pathname.startsWith('/laporan-retur')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <RotateCcw className={`w-4 h-4 ${pathname.startsWith('/laporan-retur') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Laporan Retur</span>
                    </Link>
                  )}

                  {canAccess('/barang-retur-rekap') && (
                    <Link
                      href="/barang-retur-rekap"
                      className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === '/barang-retur-rekap' || pathname.startsWith('/barang-retur-rekap')
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <Receipt className={`w-4 h-4 ${pathname.startsWith('/barang-retur-rekap') ? 'text-white' : 'text-slate-400'}`} />
                      <span>Rekapitulasi Retur</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-100/60 text-[11px] text-slate-500 text-center">
          POS Hayami &copy; 2026
        </div>
      </div>
    </aside>
  );
}
