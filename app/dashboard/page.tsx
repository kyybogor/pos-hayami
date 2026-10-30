'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  PackageCheck,
  RotateCcw,
  CreditCard,
  Building,
  RefreshCw,
  ArrowUpRight,
  DollarSign,
  PieChart,
  BarChart3,
  Clock,
  AlertTriangle,
  Receipt,
  Tag,
  Wallet,
  ShieldAlert,
  Radio,
  Users,
} from 'lucide-react';
import { UserSession } from '@/lib/auth';

interface DashboardSummary {
  totalOmset: number;
  netOmset: number;
  totalTransactions: number;
  totalQtySold: number;
  avgOrderValue: number;
  totalDiscount: number;
  totalStockInRp: number;
  totalStockInTx: number;
  totalStockInQty: number;
  totalReturRp: number;
  totalPettyCash: number;
  totalPiutangPending: number;
  lowStockCount: number;
}

interface PaymentBreakdown {
  cash: number;
  debet: number;
  transfer: number;
  hutang: number;
}

interface TrendPoint {
  label: string;
  sales: number;
  stockIn: number;
  txCount: number;
}

interface TopProduct {
  id_bahan: string;
  model: string;
  ukuran: string;
  total_qty: number;
  total_rp: number;
}

interface LowStockItem {
  id_bahan: string;
  model: string;
  ukuran: string;
  stock: number;
}

interface RecentTx {
  id_transaksi: string;
  tgl_transaksi: string;
  nama_customer: string;
  akun: string;
  status: string;
  total_belanja: number;
}

interface CabangItem {
  id_cabang: number;
  nama_cabang: string;
}

interface AgingStockItem {
  id_bahan: string;
  model: string;
  ukuran: string;
  stock: number;
  last_restock: string | null;
  aging_days: number | null;
}

interface TopCustomer {
  id_customer: string;
  nama_customer: string;
  total_transaksi: number;
  total_belanja: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserSession | null>(null);

  // Helper date generators
  const getTodayString = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Filter States
  const [filterMode, setFilterMode] = useState<'today' | 'daily' | 'range' | 'monthly' | 'yearly'>('today');
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [tglFrom, setTglFrom] = useState(getTodayString());
  const [tglTo, setTglTo] = useState(getTodayString());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedCabang, setSelectedCabang] = useState<string>('ALL');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [summary, setSummary] = useState<DashboardSummary>({
    totalOmset: 0,
    netOmset: 0,
    totalTransactions: 0,
    totalQtySold: 0,
    avgOrderValue: 0,
    totalDiscount: 0,
    totalStockInRp: 0,
    totalStockInTx: 0,
    totalStockInQty: 0,
    totalReturRp: 0,
    totalPettyCash: 0,
    totalPiutangPending: 0,
    lowStockCount: 0,
  });
  const [payment, setPayment] = useState<PaymentBreakdown>({
    cash: 0,
    debet: 0,
    transfer: 0,
    hutang: 0,
  });
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [agingStockItems, setAgingStockItems] = useState<AgingStockItem[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [cabangList, setCabangList] = useState<CabangItem[]>([]);

  // Load User Session
  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            const isSuper = (data.user.role || '').toLowerCase() === 'superadmin';
            const userBranch = data.user.branch || data.user.grup;
            if (!isSuper && userBranch) {
              setSelectedCabang(userBranch);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      }
    }
    loadSession();
  }, []);

  const isFetchingRef = useRef(false);

  // Fetch Dashboard Stats (with isSilent for background polling)
  const fetchDashboardStats = useCallback(
    async (isSilent = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (!isSilent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const params = new URLSearchParams();
        params.append('mode', filterMode);
        params.append('date', selectedDate);
        params.append('tgl_from', tglFrom);
        params.append('tgl_to', tglTo);
        params.append('month', selectedMonth);
        params.append('year', selectedYear);
        params.append('cabang', selectedCabang);

        const res = await fetch(`/api/dashboard/stats?${params.toString()}`);
        if (!res.ok) return;

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;

        const data = await res.json();

        if (data.success) {
          setSummary(data.summary);
          setPayment(data.paymentBreakdown);
          setTrend(data.chartTrend || []);
          setTopProducts(data.topProducts || []);
          setRecentTx(data.recentTransactions || []);
          setLowStockItems(data.lowStockItems || []);
          setAgingStockItems(data.agingStockItems || []);
          setTopCustomers(data.topCustomers || []);
          if (data.cabangList) {
            setCabangList(data.cabangList);
          }
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        isFetchingRef.current = false;
        if (!isSilent) {
          setLoading(false);
        }
        setIsRefreshing(false);
      }
    },
    [filterMode, selectedDate, tglFrom, tglTo, selectedMonth, selectedYear, selectedCabang]
  );

  // Initial fetch and smart auto-polling (every 15s only for 'today' mode)
  useEffect(() => {
    fetchDashboardStats(false);

    if (filterMode === 'today') {
      const intervalId = setInterval(() => {
        fetchDashboardStats(true);
      }, 15000);
      return () => clearInterval(intervalId);
    }
  }, [fetchDashboardStats, filterMode]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Max value for visual bar chart calculation
  const maxTrendSales = Math.max(...trend.map((t) => t.sales), 1);

  // Total Payment Amount for percentages
  const totalPaymentSum = payment.cash + payment.debet + payment.transfer + payment.hutang || 1;

  const monthsList = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

  const yearsList = ['2024', '2025', '2026', '2027'];
  const isSuperAdmin = (user?.role || '').toLowerCase() === 'superadmin';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Banner & Branch Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard Ringkasan POS</h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  REAL-TIME LIVE (15s)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Selamat datang kembali, <strong className="text-slate-800">{user?.nm_user || 'Admin'}</strong> | Cabang Aktif:{' '}
                <span className="font-bold text-emerald-600">{selectedCabang === 'ALL' ? (user?.branch || 'Semua Cabang') : selectedCabang}</span>
              </p>
            </div>
          </div>

          {/* Branch Selector & Last Update */}
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            {lastUpdated && (
              <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Terakhir Diperbarui: <span className="font-bold text-emerald-600">{lastUpdated.toLocaleTimeString('id-ID')}</span>
              </div>
            )}
            {isSuperAdmin ? (
              <div className="flex items-center space-x-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <Building className="w-4 h-4 text-emerald-600 ml-2 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 hidden sm:inline">Cabang:</span>
                <select
                  value={selectedCabang}
                  onChange={(e) => setSelectedCabang(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="ALL">🌐 Semua Cabang</option>
                  {cabangList.map((c) => (
                    <option key={c.id_cabang} value={c.nama_cabang}>
                      🏢 {c.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-200/60 text-xs font-bold">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Cabang: {user?.branch || selectedCabang || 'Cabang Toko'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter Mode Buttons */}
            <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl">
              <button
                onClick={() => setFilterMode('today')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterMode === 'today'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setFilterMode('daily')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterMode === 'daily'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pilih 1 Hari
              </button>
              <button
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterMode === 'range'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rentang Tanggal
              </button>
              <button
                onClick={() => setFilterMode('monthly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterMode === 'monthly'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setFilterMode('yearly')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  filterMode === 'yearly'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tahunan
              </button>
            </div>

            {/* Refresh Button & Real-time Indicator */}
            <div className="flex items-center space-x-3">
              {isRefreshing && (
                <span className="text-[10px] font-bold text-emerald-600 flex items-center space-x-1 animate-pulse">
                  <Radio className="w-3 h-3 text-emerald-500 animate-spin" />
                  <span>Sinkronisasi Data Real-Time...</span>
                </span>
              )}
              <button
                onClick={() => fetchDashboardStats(false)}
                disabled={loading}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          {/* Dynamic Inputs Based on Selected Mode */}
          {filterMode !== 'today' && (
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
              {/* Daily mode input */}
              {filterMode === 'daily' && (
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-600">Pilih Tanggal:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              )}

              {/* Range mode inputs */}
              {filterMode === 'range' && (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-600">Dari:</span>
                    <input
                      type="date"
                      value={tglFrom}
                      onChange={(e) => setTglFrom(e.target.value)}
                      className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-600">Sampai:</span>
                    <input
                      type="date"
                      value={tglTo}
                      onChange={(e) => setTglTo(e.target.value)}
                      className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </>
              )}

              {/* Monthly mode inputs */}
              {filterMode === 'monthly' && (
                <>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-600">Bulan:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      {monthsList.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-600">Tahun:</span>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      {yearsList.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Yearly mode inputs */}
              {filterMode === 'yearly' && (
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-600">Pilih Tahun:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    {yearsList.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* === 8 KPI Summary Cards === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* Card 1: Omset Penjualan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Omset Penjualan</span>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(summary.totalOmset)}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-emerald-600 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                Bersih: {formatCurrency(summary.netOmset)}
              </span>
              <span>•</span>
              <span>{summary.totalTransactions} Tx</span>
            </div>
          </div>

          {/* Card 2: Total Faktur Penjualan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Faktur Penjualan</span>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : `${summary.totalTransactions} Invoice`}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-blue-600">{summary.totalQtySold} pcs barang terjual</span>
            </div>
          </div>

          {/* Card 3: Rata-Rata Nilai Transaksi (AOV) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-teal-500 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Rata-Rata Transaksi (AOV)</span>
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl group-hover:scale-110 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(summary.avgOrderValue)}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-teal-600">Rata-rata omset / invoice customer</span>
            </div>
          </div>

          {/* Card 4: Piutang Belum Lunas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Piutang Belum Lunas</span>
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(summary.totalPiutangPending)}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-rose-600">Penjualan Kredit / Tempo outstanding</span>
            </div>
          </div>

          {/* Card 5: Total Diskon & Potongan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Total Diskon & Potongan</span>
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                <Tag className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(summary.totalDiscount)}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-purple-600">Potongan Harga Member & Invoice</span>
            </div>
          </div>

          {/* Card 6: Barang Masuk (Stok In) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Barang Masuk (Stok In)</span>
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                <PackageCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(summary.totalStockInRp)}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-indigo-600">{summary.totalStockInTx} Transaksi</span>
              <span>•</span>
              <span>{summary.totalStockInQty} pcs masuk</span>
            </div>
          </div>

          {/* Card 7: Stok Kritis */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Stok Kritis (&lt;= 10 pcs)</span>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : `${summary.lowStockCount} Item`}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span className="font-semibold text-amber-600">Perlu restock inventaris barang</span>
            </div>
          </div>

          {/* Card 8: Petty Cash & Retur */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-400 rounded-r-2xl" />
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Petty Cash & Retur</span>
              <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl group-hover:scale-110 transition-transform">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '...' : formatCurrency(summary.totalPettyCash + summary.totalReturRp)}
            </p>
            <div className="flex items-center space-x-2 mt-2 text-[11px] text-slate-500">
              <span>Kas Keluar: {formatCurrency(summary.totalPettyCash)}</span>
              <span>•</span>
              <span>Retur: {formatCurrency(summary.totalReturRp)}</span>
            </div>
          </div>
        </div>

        {/* Charts & Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Advanced Interactive Trend Chart Component (2 Cols) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Grafik Tren Omset Penjualan</h3>
                  <p className="text-[11px] text-slate-500">Visualisasi omset berdasarkan periode terpilih</p>
                </div>
              </div>

              {/* Chart Type Toggle & Period Badge */}
              <div className="flex items-center space-x-2 self-end sm:self-center">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    onClick={() => setChartType('area')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      chartType === 'area'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📈 Kurva Area
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      chartType === 'bar'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📊 Grafik Batang
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="py-24 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                <span className="text-xs">Membuat statistik grafik...</span>
              </div>
            ) : trend.length === 0 ? (
              <div className="py-24 text-center text-slate-400">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <span className="text-xs">Tidak ada data transaksi pada periode ini.</span>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {chartType === 'area' ? (
                  /* Modern Crisp Area / Line Chart */
                  <div className="space-y-3">
                    <div className="h-60 flex pt-4 pb-2">
                      {/* Y-Axis Label Column (Left Side) */}
                      <div className="w-24 text-right pr-3 flex flex-col justify-between text-[10px] font-bold text-slate-400 select-none pb-6">
                        <span>{formatCurrency(maxTrendSales)}</span>
                        <span>{formatCurrency(maxTrendSales * 0.75)}</span>
                        <span>{formatCurrency(maxTrendSales * 0.5)}</span>
                        <span>{formatCurrency(maxTrendSales * 0.25)}</span>
                        <span>Rp 0</span>
                      </div>

                      {/* Chart Drawing Area */}
                      <div className="flex-1 relative flex flex-col justify-between border-l border-b border-slate-200">
                        {/* Horizontal Background Grid Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                          <div className="border-b border-dashed border-slate-200 h-0" />
                          <div className="border-b border-dashed border-slate-150 h-0" />
                          <div className="border-b border-dashed border-slate-150 h-0" />
                          <div className="border-b border-dashed border-slate-150 h-0" />
                          <div className="h-0" />
                        </div>

                        {/* SVG Area & Line */}
                        <div className="absolute inset-x-0 top-0 bottom-6 z-10">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Polygon Gradient Fill */}
                            <polygon
                              fill="url(#areaGradient)"
                              points={`
                                0,100
                                ${trend
                                  .map((t, i) => {
                                    const x = trend.length === 1 ? 50 : (i / (trend.length - 1)) * 100;
                                    const y = 100 - (t.sales / maxTrendSales) * 85;
                                    return `${x},${y}`;
                                  })
                                  .join(' ')}
                                100,100
                              `}
                            />

                            {/* Crisp Polyline */}
                            <polyline
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              vectorEffect="non-scaling-stroke"
                              points={trend
                                .map((t, i) => {
                                  const x = trend.length === 1 ? 50 : (i / (trend.length - 1)) * 100;
                                  const y = 100 - (t.sales / maxTrendSales) * 85;
                                  return `${x},${y}`;
                                })
                                .join(' ')}
                            />
                          </svg>

                          {/* HTML Perfect Round Data Dots with Hover Tooltips */}
                          {trend.map((t, i) => {
                            const xPercent = trend.length === 1 ? 50 : (i / (trend.length - 1)) * 100;
                            const yPercent = (t.sales / maxTrendSales) * 85;

                            return (
                              <div
                                key={i}
                                style={{
                                  left: `${xPercent}%`,
                                  bottom: `${yPercent}%`,
                                }}
                                className="absolute -translate-x-1/2 translate-y-1/2 z-20 group cursor-pointer"
                              >
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute bottom-5 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                                  <div className="text-slate-300 font-medium">Tanggal: {t.label}</div>
                                  <div className="text-emerald-400 text-xs font-black">{formatCurrency(t.sales)}</div>
                                  <div className="text-[9px] text-slate-400 mt-0.5">{t.txCount} Transaksi Selesai</div>
                                </div>

                                {/* Round Dot Indicator */}
                                <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-emerald-500 shadow-md group-hover:scale-125 group-hover:bg-emerald-500 group-hover:border-white transition-all" />
                              </div>
                            );
                          })}
                        </div>

                        {/* X-Axis Date Labels */}
                        <div className="absolute inset-x-0 bottom-0 h-6 flex justify-between items-center text-[10px] font-bold text-slate-500 px-1 pt-1">
                          {trend.map((t, i) => {
                            if (trend.length > 15 && i % 2 !== 0 && i !== trend.length - 1) return null;
                            return (
                              <span key={i} className="truncate text-center">
                                {t.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Modern Bar Chart View */
                  <div className="space-y-3">
                    <div className="h-60 flex pt-4 pb-2">
                      {/* Y-Axis Label Column (Left Side) */}
                      <div className="w-24 text-right pr-3 flex flex-col justify-between text-[10px] font-bold text-slate-400 select-none pb-6">
                        <span>{formatCurrency(maxTrendSales)}</span>
                        <span>{formatCurrency(maxTrendSales * 0.75)}</span>
                        <span>{formatCurrency(maxTrendSales * 0.5)}</span>
                        <span>{formatCurrency(maxTrendSales * 0.25)}</span>
                        <span>Rp 0</span>
                      </div>

                      {/* Bar Grid Area */}
                      <div className="flex-1 relative flex flex-col justify-between border-l border-b border-slate-200">
                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                          <div className="border-b border-dashed border-slate-200 h-0" />
                          <div className="border-b border-dashed border-slate-150 h-0" />
                          <div className="border-b border-dashed border-slate-150 h-0" />
                          <div className="border-b border-dashed border-slate-150 h-0" />
                          <div className="h-0" />
                        </div>

                        {/* Bar Pillars Container */}
                        <div className="absolute inset-x-0 top-0 bottom-6 z-10 flex items-end justify-between px-2 gap-1.5">
                          {trend.map((t, idx) => {
                            const heightPercent = Math.max(4, Math.round((t.sales / maxTrendSales) * 100));
                            return (
                              <div
                                key={idx}
                                className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer min-w-[12px] max-w-[48px]"
                              >
                                {/* Tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute -top-12 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                                  <div className="text-slate-300 font-medium">Tanggal: {t.label}</div>
                                  <div className="text-emerald-400 text-xs font-black">{formatCurrency(t.sales)}</div>
                                  <div className="text-[9px] text-slate-400 mt-0.5">{t.txCount} Transaksi</div>
                                </div>

                                {/* Bar Pillar */}
                                <div
                                  style={{ height: `${heightPercent}%` }}
                                  className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg group-hover:from-emerald-500 group-hover:to-teal-300 transition-all duration-300 shadow-xs relative"
                                >
                                  {t.sales > 0 && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {t.sales >= 1000000 ? `${(t.sales / 1000000).toFixed(1)}M` : `${(t.sales / 1000).toFixed(0)}k`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* X-Axis Date Labels */}
                        <div className="absolute inset-x-0 bottom-0 h-6 flex justify-between items-center text-[10px] font-bold text-slate-500 px-2 pt-1">
                          {trend.map((t, i) => {
                            if (trend.length > 15 && i % 2 !== 0 && i !== trend.length - 1) return null;
                            return (
                              <span key={i} className="truncate text-center max-w-[36px]">
                                {t.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Chart Legend */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                      <span className="font-semibold text-slate-700">Omset Penjualan</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 bg-teal-300 rounded-full" />
                      <span className="font-semibold text-slate-500">Puncak Omset: {formatCurrency(maxTrendSales)}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-600">{trend.length} Titik Data</span>
                </div>
              </div>
            )}
          </div>

          {/* Payment Methods Breakdown (1 Col) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">Metode Pembayaran</h3>
              </div>
              <PieChart className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-4">
              {/* CASH */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">💵 CASH / TUNAI</span>
                  <span className="font-bold text-slate-900">{formatCurrency(payment.cash)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((payment.cash / totalPaymentSum) * 100))}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* TRANSFER */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">🏦 BANK TRANSFER</span>
                  <span className="font-bold text-slate-900">{formatCurrency(payment.transfer)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((payment.transfer / totalPaymentSum) * 100))}%` }}
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* DEBET / EDC */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">💳 DEBET / EDC</span>
                  <span className="font-bold text-slate-900">{formatCurrency(payment.debet)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((payment.debet / totalPaymentSum) * 100))}%` }}
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* HUTANG */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">⚠️ HUTANG / TEMPO</span>
                  <span className="font-bold text-slate-900">{formatCurrency(payment.hutang)}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.round((payment.hutang / totalPaymentSum) * 100))}%` }}
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 text-center">
              <span className="text-xs font-semibold text-slate-500">
                Total Penerimaan: <strong className="text-slate-800">{formatCurrency(totalPaymentSum)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Section: 3 Columns - Top Products, Low Stock Warning, Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Top 5 Selling Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">5 Produk Terlaris</h3>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                Top Sales
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Memuat produk terlaris...</div>
            ) : topProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">Belum ada data barang terjual.</div>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{p.model}</h4>
                        <p className="text-[11px] text-slate-500">
                          Ukuran: <span className="font-semibold text-slate-700">{p.ukuran || '-'}</span> | ID: {p.id_bahan}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xs text-emerald-600 block">{p.total_qty} pcs</span>
                      <span className="text-[10px] text-slate-500">{formatCurrency(p.total_rp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Peringatan Stok Kritis */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-800">Peringatan Stok Kritis</h3>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                Stok &lt;= 10 Pcs
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Memuat data stok kritis...</div>
            ) : lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-emerald-600 font-medium text-xs flex flex-col items-center justify-center space-y-1">
                <ShieldAlert className="w-7 h-7 text-emerald-500 mb-1" />
                <span>Semua stok barang dalam kondisi aman (&gt; 10 pcs).</span>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 hover:border-amber-400 transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        !
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{item.model}</h4>
                        <p className="text-[11px] text-slate-500">
                          Ukuran: <span className="font-semibold text-slate-700">{item.ukuran || '-'}</span> | {item.id_bahan}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300 inline-block">
                        Sisa {item.stock} pcs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: 5 Transaksi Terakhir */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">5 Transaksi Terakhir</h3>
              </div>
              <a
                href="/barang-keluar"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center"
              >
                <span>Lihat Semua</span>
                <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </a>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Memuat transaksi terbaru...</div>
            ) : recentTx.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">Belum ada transaksi terbaru.</div>
            ) : (
              <div className="space-y-3">
                {recentTx.map((tx) => (
                  <div
                    key={tx.id_transaksi}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">{tx.id_transaksi}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                          {tx.akun || 'CASH'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Customer: <span className="font-semibold text-slate-700">{tx.nama_customer}</span> • {formatDate(tx.tgl_transaksi)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-extrabold text-slate-900">{formatCurrency(tx.total_belanja)}</span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                          tx.status === 'Lunas'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.status === 'Belum Lunas'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tx.status || 'Success'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Aging Stock & Top Customer Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

          {/* Aging Stock Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col h-[450px]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Aging Stock (50 Terlama)</h3>
                  <p className="text-xs text-slate-500">Stok mengendap dihitung dari transaksi barang masuk terakhir</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
                Limit 50
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs my-auto">Memuat data aging stock...</div>
            ) : agingStockItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs my-auto">Tidak ada data aging stock.</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                {agingStockItems.map((item, idx) => {
                  const days = item.aging_days ?? 0;
                  const isHighAging = days > 90;
                  const isMedAging = days > 30 && days <= 90;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <span className="block text-xs font-bold text-slate-900 truncate">
                          {item.id_bahan}-{item.model}-{item.ukuran}
                        </span>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                          <span>Stok: <strong className="text-slate-800">{item.stock} pcs</strong></span>
                          <span>•</span>
                          <span>Last Restock: {item.last_restock ? formatDate(item.last_restock) : '-'}</span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                            isHighAging
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : isMedAging
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {days} Hari
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Customer Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col h-[450px]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Top 10 Customer</h3>
                  <p className="text-xs text-slate-500">Pelanggan paling sering belanja (tb_barang_keluar)</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                Top 10
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs my-auto">Memuat data top customer...</div>
            ) : topCustomers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs my-auto">Belum ada data customer.</div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                {topCustomers.map((cust, idx) => (
                  <div
                    key={cust.id_customer || idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">
                          {cust.nama_customer || cust.id_customer}
                        </span>
                        <span className="text-[11px] text-slate-500">ID: {cust.id_customer}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block text-xs font-extrabold text-slate-900">
                        {formatCurrency(cust.total_belanja)}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 mt-0.5">
                        {cust.total_transaksi} Transaksi
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
