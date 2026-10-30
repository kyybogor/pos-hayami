'use client';

import React, { useState, useEffect, useTransition } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowDownRight,
  TrendingDown,
  Calendar,
  RefreshCw,
  Eye,
  X,
  FileText,
  Filter,
  Receipt,
  Search,
  Wallet,
  AlertCircle,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { exportPengeluaranHarianExcel, exportDetailPengeluaranExcel } from '@/lib/excel-export-utils';

interface DailyExpenseSummary {
  tgl_transaksi: string;
  total_pengeluaran: number;
  count_transaksi: number;
}

interface ExpenseSummaryData {
  total_pengeluaran: number;
  total_transaksi: number;
  total_hari: number;
  rata_rata_harian: number;
}

interface DetailExpenseItem {
  id_petty: string;
  tgl: string;
  keterangan: string;
  out_cash: number;
  bukti_petty: string;
  dibuat_oleh: string;
  dibuat_tgl?: string;
}

interface DateDetailExpenseData {
  tgl_transaksi: string;
  total_pengeluaran: number;
  count_items: number;
  items: DetailExpenseItem[];
}

export default function LaporanPengeluaranPage() {
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

  const [summaryData, setSummaryData] = useState<ExpenseSummaryData>({
    total_pengeluaran: 0,
    total_transaksi: 0,
    total_hari: 0,
    rata_rata_harian: 0,
  });
  const [dailyList, setDailyList] = useState<DailyExpenseSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Modal State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DateDetailExpenseData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [detailSearch, setDetailSearch] = useState<string>('');

  // Format Rp
  const formatRp = (num: number) => {
    return 'Rp ' + Math.round(num || 0).toLocaleString('id-ID');
  };

  // Date Formatter
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

  // Preset Handler
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

  // Fetch Data
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

      const res = await fetch(`/api/laporan-pengeluaran?${queryParams.toString()}`);
      const json = await res.json();

      if (json.success) {
        setDailyList(json.data || []);
        setSummaryData(
          json.summary || {
            total_pengeluaran: 0,
            total_transaksi: 0,
            total_hari: 0,
            rata_rata_harian: 0,
          }
        );
      } else {
        setErrorMsg(json.message || 'Gagal mengambil data laporan pengeluaran.');
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setErrorMsg('Terjadi kesalahan saat memuat data pengeluaran.');
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

    try {
      const branchParam = selectedCabang && selectedCabang !== 'ALL' ? `&cabang=${encodeURIComponent(selectedCabang)}` : '';
      const res = await fetch(`/api/laporan-pengeluaran?date_detail=${dateStr}${branchParam}`);
      const json = await res.json();
      if (json.success) {
        setDetailData(json.data);
      } else {
        alert(json.message || 'Gagal memuat detail pengeluaran.');
      }
    } catch (e) {
      console.error('Error fetching detail:', e);
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Filtered detail list
  const filteredItems = detailData?.items.filter(
    (item) =>
      item.id_petty.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.keterangan.toLowerCase().includes(detailSearch.toLowerCase()) ||
      item.dibuat_oleh.toLowerCase().includes(detailSearch.toLowerCase())
  ) || [];

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportExcel = async () => {
    if (dailyList.length === 0) {
      alert('Tidak ada data pengeluaran untuk diexport.');
      return;
    }
    setIsExporting(true);
    try {
      await exportPengeluaranHarianExcel({
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
      await exportDetailPengeluaranExcel(detailData);
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
          <div className="flex items-center space-x-2 text-rose-700 font-semibold text-xs tracking-wider uppercase mb-1">
            <ArrowDownRight className="w-4 h-4 text-rose-600" />
            <span>Finance & Akunting</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Laporan Pengeluaran Harian
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rekapitulasi total biaya & pengeluaran kas operasional (Petty Cash Out) per hari.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            disabled={isExporting || loading || dailyList.length === 0}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Excel Laporan Pengeluaran Harian"
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
        {/* Card 1: Total Pengeluaran */}
        <div className="bg-gradient-to-br from-rose-50 to-red-50/50 p-5 rounded-2xl border border-rose-200/60 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              Total Pengeluaran
            </span>
            <div className="p-2 bg-rose-100/80 rounded-xl text-rose-700">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-950 tracking-tight">
              {formatRp(summaryData.total_pengeluaran)}
            </div>
            <p className="text-[11px] text-rose-600/90 mt-1 font-medium">
              Akumulasi pengeluaran petty cash out
            </p>
          </div>
        </div>

        {/* Card 2: Rata-rata Harian */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 rounded-2xl border border-amber-200/60 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Rata-rata Pengeluaran
            </span>
            <div className="p-2 bg-amber-100/80 rounded-xl text-amber-700">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-amber-950 tracking-tight">
              {formatRp(summaryData.rata_rata_harian)}
            </div>
            <p className="text-[11px] text-amber-600/90 mt-1 font-medium">
              Rata-rata biaya pengeluaran per hari
            </p>
          </div>
        </div>

        {/* Card 3: Total Transaksi Pengeluaran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Jumlah Transaksi
            </span>
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {summaryData.total_transaksi} <span className="text-sm font-normal text-slate-500">Item</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              Catatan pengeluaran yang tercatat
            </p>
          </div>
        </div>

        {/* Card 4: Total Hari */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Hari Pengeluaran
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
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => applyPreset('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === '7days'
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => applyPreset('30days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === '30days'
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              30 Hari Terakhir
            </button>
            <button
              onClick={() => applyPreset('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === 'month'
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => applyPreset('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activePreset === 'custom' && !tglFrom && !tglTo
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
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
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-rose-500"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={tglTo}
              onChange={(e) => {
                setActivePreset('custom');
                setTglTo(e.target.value);
              }}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-rose-500"
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
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:bg-white focus:outline-rose-500 cursor-pointer min-w-[220px]"
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
            <RefreshCw className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-600">Memuat laporan pengeluaran...</p>
          </div>
        ) : errorMsg ? (
          <div className="py-16 text-center text-red-500 text-sm font-medium">
            {errorMsg}
          </div>
        ) : dailyList.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Tidak ada data pengeluaran</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ditemukan transaksi pengeluaran (Petty Cash Out) pada periode tanggal yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 text-xs uppercase font-semibold border-b border-slate-200/80 tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Tanggal</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Transaksi</th>
                  <th className="py-3.5 px-4 text-right">Total Pengeluaran</th>
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
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold text-xs">
                        {item.count_transaksi} Item
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-rose-700 bg-rose-50/20 text-sm">
                      {formatRp(item.total_pengeluaran)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(item.tgl_transaksi);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white transition-all text-xs font-medium cursor-pointer shadow-2xs"
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
                    TOTAL PENGELUARAN PERIODE TERPILIH
                  </td>
                  <td className="py-4 px-4 text-center text-rose-300">
                    {summaryData.total_transaksi} Transaksi
                  </td>
                  <td className="py-4 px-4 text-right text-rose-400 text-sm">
                    {formatRp(summaryData.total_pengeluaran)}
                  </td>
                  <td className="py-4 px-4 text-slate-400 font-normal text-center">
                    {summaryData.total_hari} Hari
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
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-rose-700 uppercase">
                  <Calendar className="w-4 h-4" />
                  <span>Rincian Pengeluaran Tanggal</span>
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
                <RefreshCw className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-600">Memuat rincian pengeluaran...</p>
              </div>
            ) : detailData ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Modal Summary Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase text-rose-700">Total Pengeluaran Harian</span>
                    <div className="text-2xl font-extrabold text-rose-950 mt-0.5">
                      {formatRp(detailData.total_pengeluaran)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-rose-600 font-medium">{detailData.count_items} Transaksi Tercatat</span>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari keterangan / id petty cash..."
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-rose-500"
                  />
                </div>

                {/* Items Table */}
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">
                    Tidak ada item pengeluaran yang cocok dengan pencarian.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Kode Petty</th>
                          <th className="py-2.5 px-3">Keterangan Pengeluaran</th>
                          <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                          <th className="py-2.5 px-3">Bukti</th>
                          <th className="py-2.5 px-3">Inputter</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((item) => (
                          <tr key={item.id_petty} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-medium text-rose-700">
                              {item.id_petty}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {item.keterangan}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-700">
                              {formatRp(item.out_cash)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {item.bukti_petty ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono text-slate-700">
                                  {item.bukti_petty}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
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
            ) : null}

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={handleExportDetailExcel}
                disabled={isExporting || !detailData}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
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
