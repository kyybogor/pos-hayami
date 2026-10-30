'use client';

import React, { useState, useEffect, useTransition } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Calendar,
  RefreshCw,
  Eye,
  X,
  FileText,
  DollarSign,
  ArrowUpRight,
  Filter,
  CheckCircle,
  Receipt,
  Search,
  Download,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { exportPenerimaanHarianExcel, exportDetailPenerimaanExcel } from '@/lib/excel-export-utils';

interface DailySummaryItem {
  tgl_transaksi: string;
  penjualan_tunai: number;
  penerimaan_ar: number;
  total_penerimaan: number;
  count_penjualan: number;
  count_ar: number;
  breakdown: Record<string, number>;
}

interface SummaryData {
  total_penjualan_direct: number;
  total_ar_received: number;
  grand_total: number;
  total_hari: number;
}

interface DetailPenjualanItem {
  id_transaksi: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  akun: string;
  pcs: number;
  lusin: number;
  total_nota: number;
  penerimaan: number;
  status: string;
}

interface DetailArItem {
  no_id: number;
  id_transaksi: string;
  id_customer: string;
  nama_customer: string;
  tgl_bayar: string;
  metode: string;
  nominal: number;
  keterangan: string;
  dibuat_oleh: string;
}

interface DateDetailData {
  tgl_transaksi: string;
  summary: {
    total_penjualan_direct: number;
    total_ar_received: number;
    grand_total: number;
  };
  penjualan: DetailPenjualanItem[];
  penerimaan_ar: DetailArItem[];
}

export default function LaporanPenerimaanHarianPage() {
  const [isPending, startTransition] = useTransition();

  // Date filters - Default to "Hari Ini"
  const getTodayStr = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  };

  const [activePreset, setActivePreset] = useState<'today' | '7days' | '30days' | 'month' | 'custom'>('today');
  const [tglFrom, setTglFrom] = useState<string>(getTodayStr());
  const [tglTo, setTglTo] = useState<string>(getTodayStr());

  // Data states
  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [summaryData, setSummaryData] = useState<SummaryData>({
    total_penjualan_direct: 0,
    total_ar_received: 0,
    grand_total: 0,
    total_hari: 0,
  });
  const [dailyList, setDailyList] = useState<DailySummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Modal State for Date Details
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DateDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'penjualan' | 'ar'>('penjualan');
  const [detailSearch, setDetailSearch] = useState<string>('');

  // Currency Formatter
  const formatRp = (num: number) => {
    return 'Rp ' + Math.round(num || 0).toLocaleString('id-ID');
  };

  // Date Formatter (e.g. "Jumat, 02 Okt 2026")
  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Preset Handlers
  const applyPreset = (preset: 'today' | '7days' | '30days' | 'month' | 'all') => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    if (preset === 'today') {
      setActivePreset('today');
      setTglFrom(todayStr);
      setTglTo(todayStr);
    } else if (preset === '7days') {
      setActivePreset('7days');
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setTglFrom(`${d7.getFullYear()}-${pad(d7.getMonth() + 1)}-${pad(d7.getDate())}`);
      setTglTo(todayStr);
    } else if (preset === '30days') {
      setActivePreset('30days');
      const d30 = new Date();
      d30.setDate(d30.getDate() - 29);
      setTglFrom(`${d30.getFullYear()}-${pad(d30.getMonth() + 1)}-${pad(d30.getDate())}`);
      setTglTo(todayStr);
    } else if (preset === 'month') {
      setActivePreset('month');
      const firstDay = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
      setTglFrom(firstDay);
      setTglTo(todayStr);
    } else if (preset === 'all') {
      setActivePreset('custom');
      setTglFrom('');
      setTglTo('');
    }
  };

  // Fetch Summary Data
  const fetchData = async (overrideCabang?: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const queryParams = new URLSearchParams();
      if (tglFrom) queryParams.append('tgl_from', tglFrom);
      if (tglTo) queryParams.append('tgl_to', tglTo);
      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        queryParams.append('cabang', branchVal);
      }

      const res = await fetch(`/api/penerimaan-harian?${queryParams.toString()}`);
      const json = await res.json();

      if (json.success) {
        setDailyList(json.data || []);
        setSummaryData(
          json.summary || {
            total_penjualan_direct: 0,
            total_ar_received: 0,
            grand_total: 0,
            total_hari: 0,
          }
        );
      } else {
        setErrorMsg(json.message || 'Gagal mengambil data penerimaan harian.');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setErrorMsg('Terjadi kesalahan saat memuat data penerimaan.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const initData = async () => {
      try {
        const [cRes, uRes] = await Promise.all([
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        let userBranch = '';
        if (cRes.ok) {
          const cJson = await cRes.json();
          if (cJson.success) setCabangOptions(cJson.cabang || []);
        }
        if (uRes.ok) {
          const uJson = await uRes.json();
          if (uJson.authenticated && uJson.user) {
            setCurrentUser(uJson.user);
            const isSuper = (uJson.user.role || '').toLowerCase() === 'superadmin';
            if (!isSuper && uJson.user.branch) {
              userBranch = uJson.user.branch;
              setSelectedCabang(userBranch);
            }
          }
        }
        fetchData(userBranch);
      } catch (e) {
        console.error('Error init user/cabang:', e);
        fetchData();
      }
    };
    initData();
  }, []);

  const isFirstMount = React.useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    startTransition(() => {
      fetchData();
    });
  }, [tglFrom, tglTo, selectedCabang]);

  // Fetch Detail Date Modal Data
  const handleOpenDetail = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoadingDetail(true);
    setDetailData(null);
    setDetailSearch('');
    setActiveTab('penjualan');

    try {
      const branchParam = selectedCabang && selectedCabang !== 'ALL' ? `&cabang=${encodeURIComponent(selectedCabang)}` : '';
      const res = await fetch(`/api/penerimaan-harian?date_detail=${dateStr}${branchParam}`);
      const json = await res.json();
      if (json.success) {
        setDetailData(json.data);
      } else {
        alert(json.message || 'Gagal memuat detail tanggal.');
      }
    } catch (e) {
      console.error('Error fetching detail:', e);
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Filtered detail list by search
  const filteredPenjualan = detailData?.penjualan.filter(
    (item) =>
      item.id_transaksi.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.nama_customer.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.akun.toLowerCase().includes(detailSearch.toLowerCase())
  ) || [];

  const filteredAr = detailData?.penerimaan_ar.filter(
    (item) =>
      item.id_transaksi.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.nama_customer.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.metode.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.keterangan.toLowerCase().includes(detailSearch.toLowerCase())
  ) || [];

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportExcel = async () => {
    if (dailyList.length === 0) {
      alert('Tidak ada data penerimaan untuk diexport.');
      return;
    }
    setIsExporting(true);
    try {
      await exportPenerimaanHarianExcel({
        dailyList,
        summaryData,
        tglFrom,
        tglTo,
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengunduh file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDetailExcel = async () => {
    if (!detailData) return;
    setIsExporting(true);
    try {
      await exportDetailPenerimaanExcel(detailData);
    } catch (err) {
      console.error('Export detail error:', err);
      alert('Gagal mengunduh detail Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
        <div>
          <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-xs tracking-wider uppercase mb-1">
            <Wallet className="w-4 h-4" />
            <span>Finance & Akunting</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Laporan Penerimaan Harian
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rekapitulasi total uang masuk (penerimaan tunai/penjualan & pelunasan AR/piutang) per hari.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            disabled={isExporting || loading || dailyList.length === 0}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Excel Laporan Penerimaan Harian"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExporting ? 'Mengunduh...' : 'Export Excel'}</span>
          </button>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Penjualan Tunai */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 rounded-2xl border border-emerald-200/60 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Penjualan Tunai
            </span>
            <div className="p-2 bg-emerald-100/80 rounded-xl text-emerald-700">
              <ShoppingBagIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-950 tracking-tight">
              {formatRp(summaryData.total_penjualan_direct)}
            </div>
            <p className="text-[11px] text-emerald-600/90 mt-1 font-medium">
              Penerimaan langsung dari transaksi penjualan
            </p>
          </div>
        </div>

        {/* Card 2: Penerimaan AR / Piutang */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 p-5 rounded-2xl border border-blue-200/60 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Penerimaan AR / Piutang
            </span>
            <div className="p-2 bg-blue-100/80 rounded-xl text-blue-700">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-blue-950 tracking-tight">
              {formatRp(summaryData.total_ar_received)}
            </div>
            <p className="text-[11px] text-blue-600/90 mt-1 font-medium">
              Pembayaran piutang customer yang diterima
            </p>
          </div>
        </div>

        {/* Card 3: Grand Total Penerimaan */}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 p-5 rounded-2xl border border-slate-800 shadow-md text-white relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
              Total Penerimaan Harian
            </span>
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white tracking-tight">
              {formatRp(summaryData.grand_total)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Akumulasi penerimaan kas & bank
            </p>
          </div>
        </div>

        {/* Card 4: Total Hari */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Hari Aktif
            </span>
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {summaryData.total_hari} <span className="text-sm font-normal text-slate-500">Hari</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Periode: {tglFrom ? formatDateIndo(tglFrom) : 'Awal'} - {tglTo ? formatDateIndo(tglTo) : 'Sekarang'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-2 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1 text-slate-400" />
              Filter Tanggal:
            </span>
            <button
              onClick={() => applyPreset('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => applyPreset('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === '7days'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => applyPreset('30days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === '30days'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              30 Hari Terakhir
            </button>
            <button
              onClick={() => applyPreset('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === 'month'
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => applyPreset('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === 'custom' && !tglFrom && !tglTo
                  ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Data
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={tglFrom}
              onChange={(e) => {
                setActivePreset('custom');
                setTglFrom(e.target.value);
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-emerald-500"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={tglTo}
              onChange={(e) => {
                setActivePreset('custom');
                setTglTo(e.target.value);
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-emerald-500"
            />
          </div>
        </div>

        {/* Superadmin Cabang Filter */}
        {isSuperAdmin && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2.5 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600 flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Cabang Toko:
            </span>
            <select
              value={selectedCabang}
              onChange={(e) => setSelectedCabang(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-emerald-500 cursor-pointer min-w-[220px]"
            >
              <option value="ALL">-- Semua Cabang --</option>
              {cabangOptions.map((c) => (
                <option key={c.id_cabang} value={c.nama_cabang}>
                  {c.nama_cabang}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-600">Memuat laporan penerimaan harian...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-16 text-center text-red-500 text-sm font-medium">
            {errorMsg}
          </div>
        ) : dailyList.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Tidak ada data penerimaan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ditemukan data penerimaan tunai atau AR pada periode tanggal yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200/80 tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Tanggal</th>
                  <th className="py-3.5 px-4 text-right">Penjualan Tunai</th>
                  <th className="py-3.5 px-4 text-right">Penerimaan AR</th>
                  <th className="py-3.5 px-4 text-right">Total Penerimaan</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Transaksi</th>
                  <th className="py-3.5 px-4">Metode Pembayaran</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {dailyList.map((item, idx) => (
                  <tr
                    key={item.tgl_transaksi}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => handleOpenDetail(item.tgl_transaksi)}
                  >
                    <td className="py-3.5 px-4 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {formatDateIndo(item.tgl_transaksi)}
                      <div className="text-[10px] text-slate-400 font-normal">
                        {item.tgl_transaksi}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-emerald-700">
                      {formatRp(item.penjualan_tunai)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-blue-700">
                      {formatRp(item.penerimaan_ar)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 bg-emerald-50/30">
                      {formatRp(item.total_penerimaan)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center space-x-1">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-medium" title="Penjualan Direct">
                          {item.count_penjualan} Sales
                        </span>
                        {item.count_ar > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-medium" title="Pelunasan AR">
                            {item.count_ar} AR
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(item.breakdown).map(([mKey, mVal]) => (
                          <span
                            key={mKey}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                              mKey.startsWith('AR')
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {mKey}: {formatRp(mVal)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(item.tgl_transaksi);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white transition-all text-xs font-medium cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs">
                  <td colSpan={2} className="py-4 px-4">
                    TOTAL PERIODE TERPILIH
                  </td>
                  <td className="py-4 px-4 text-right text-emerald-400">
                    {formatRp(summaryData.total_penjualan_direct)}
                  </td>
                  <td className="py-4 px-4 text-right text-blue-300">
                    {formatRp(summaryData.total_ar_received)}
                  </td>
                  <td className="py-4 px-4 text-right text-amber-300 text-sm">
                    {formatRp(summaryData.grand_total)}
                  </td>
                  <td colSpan={3} className="py-4 px-4 text-slate-400 font-normal text-right">
                    Total {dailyList.length} hari penerimaan
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 uppercase">
                  <Calendar className="w-4 h-4" />
                  <span>Detail Penerimaan Tanggal</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mt-0.5">
                  {formatDateIndo(selectedDate)}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {loadingDetail ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600">Memuat rincian transaksi...</p>
              </div>
            ) : detailData ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Modal Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                    <span className="text-[11px] font-semibold uppercase text-emerald-700">Penjualan Tunai</span>
                    <div className="text-lg font-bold mt-0.5">
                      {formatRp(detailData.summary.total_penjualan_direct)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950">
                    <span className="text-[11px] font-semibold uppercase text-blue-700">Penerimaan AR / Piutang</span>
                    <div className="text-lg font-bold mt-0.5">
                      {formatRp(detailData.summary.total_ar_received)}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800">
                    <span className="text-[11px] font-semibold uppercase text-emerald-400">Total Hari Ini</span>
                    <div className="text-lg font-bold mt-0.5 text-emerald-300">
                      {formatRp(detailData.summary.grand_total)}
                    </div>
                  </div>
                </div>

                {/* Tabs & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActiveTab('penjualan')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'penjualan'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Penjualan Direct ({detailData.penjualan.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('ar')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'ar'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Penerimaan AR / Piutang ({detailData.penerimaan_ar.length})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari transaksi / customer..."
                      value={detailSearch}
                      onChange={(e) => setDetailSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-emerald-500"
                    />
                  </div>
                </div>

                {/* Tab 1: Penjualan Direct */}
                {activeTab === 'penjualan' && (
                  <div>
                    {filteredPenjualan.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400 font-medium">
                        Tidak ada transaksi penjualan pada tanggal ini.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">ID Transaksi</th>
                              <th className="py-2.5 px-3">Customer</th>
                              <th className="py-2.5 px-3">Akun / Metode</th>
                              <th className="py-2.5 px-3 text-right">Qty</th>
                              <th className="py-2.5 px-3 text-right">Total Nota</th>
                              <th className="py-2.5 px-3 text-right">Penerimaan</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredPenjualan.map((item) => (
                              <tr key={item.id_transaksi} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-mono font-medium text-emerald-700">
                                  {item.id_transaksi}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">
                                  {item.nama_customer}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                                    {item.akun}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-600">
                                  {item.pcs} pcs / {item.lusin.toFixed(2)} lsn
                                </td>
                                <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                                  {formatRp(item.total_nota)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                                  {formatRp(item.penerimaan)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      item.status === 'Lunas'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {item.status || 'Draft'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Penerimaan AR */}
                {activeTab === 'ar' && (
                  <div>
                    {filteredAr.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400 font-medium">
                        Tidak ada pembayaran AR / Piutang pada tanggal ini.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">ID Transaksi / Invoice</th>
                              <th className="py-2.5 px-3">Customer</th>
                              <th className="py-2.5 px-3">Metode Bayar</th>
                              <th className="py-2.5 px-3 text-right">Nominal Bayar</th>
                              <th className="py-2.5 px-3">Keterangan</th>
                              <th className="py-2.5 px-3">Inputter</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredAr.map((item) => (
                              <tr key={item.no_id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-mono font-medium text-blue-700">
                                  {item.id_transaksi}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">
                                  {item.nama_customer}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                                    {item.metode}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                                  {formatRp(item.nominal)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                                  {item.keterangan || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  {item.dibuat_oleh}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={handleExportDetailExcel}
                disabled={isExporting || !detailData}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Detail Excel</span>
              </button>

              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </DashboardLayout>
);
}

function ShoppingBagIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
