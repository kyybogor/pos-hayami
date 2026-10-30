'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
import {
  ClipboardList,
  Search,
  Printer,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  RotateCcw,
  ArrowRightLeft,
  Calendar,
  Package,
  Building2,
  Boxes,
  FileText,
  X,
  FileDown,
  Info,
} from 'lucide-react';

interface MutationRow {
  tgl: string;
  id_transaksi: string;
  tipe_trx: string;
  masuk: number;
  keluar: number;
  retur: number;
  move: number;
  saldo: number;
  keterangan: string;
}

interface StockDetailItem {
  id_bahan: string;
  model: string;
  ukuran: string;
  uom: string;
  id_cabang: string;
  id_transaksi_stock: string;
  tgl_masuk: string;
  nama_barang: string;
  stok_awal: number;
  total_masuk: number;
  total_keluar: number;
  total_retur: number;
  total_move: number;
  stok_akhir: number;
  total_mutasi: number;
  mutations: MutationRow[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  from_item: number;
  to_item: number;
}

interface SummaryData {
  total_items: number;
  total_stok_awal: number;
  total_masuk: number;
  total_keluar: number;
  total_retur: number;
  total_move: number;
  total_stok_akhir: number;
}

interface CabangOption {
  id_cabang: number | string;
  nama_cabang: string;
}

interface OptionData {
  tipe: string[];
  model: string[];
  ukuran: string[];
  cabang: CabangOption[];
}

export default function StockCardDetailPage() {
  // Date filters: empty by default to reveal all transaction history
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');

  // Dropdown filter states
  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [selectedCabang, setSelectedCabang] = useState('ALL');
  const [tipeSelect, setTipeSelect] = useState('');
  const [modelSelect, setModelSelect] = useState('');
  const [ukuranSelect, setUkuranSelect] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Options
  const [options, setOptions] = useState<OptionData>({
    tipe: [],
    model: [],
    ukuran: [],
    cabang: [],
  });

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StockDetailItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: itemsPerPage,
    total_items: 0,
    total_pages: 1,
    from_item: 0,
    to_item: 0,
  });
  const [summary, setSummary] = useState<SummaryData>({
    total_items: 0,
    total_stok_awal: 0,
    total_masuk: 0,
    total_keluar: 0,
    total_retur: 0,
    total_move: 0,
    total_stok_akhir: 0,
  });

  // Print Single Card State & Modal
  const [activePrintCard, setActivePrintCard] = useState<StockDetailItem | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const formatDateString = (dateStr: string) => {
    if (!dateStr || dateStr === '0000-00-00' || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Set default branch from user session if available
  useEffect(() => {
    const initUser = async () => {
      let u: any = null;
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          u = JSON.parse(userStr);
        }
      } catch (e) {}

      if (!u || !u.role) {
        try {
          const res = await fetch('/api/auth/me');
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
              u = data.user;
              localStorage.setItem('user', JSON.stringify(data.user));
            }
          }
        } catch (e) {}
      }

      if (u) {
        setCurrentUser(u);
        const isSuper = (u.role || '').toLowerCase() === 'superadmin';
        if (!isSuper && u.branch) {
          setSelectedCabang(u.branch);
        }
      }
    };
    initUser();
  }, []);

  // Fetch filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch('/api/stock-card-detail?options=true');
        const json = await res.json();
        if (json.success && json.options) {
          setOptions({
            tipe: json.options.tipe || [],
            model: json.options.model || [],
            ukuran: json.options.ukuran || [],
            cabang: json.options.cabang || [],
          });
        }
      } catch (err) {
        console.error('Error fetching options:', err);
      }
    };
    fetchOptions();
  }, []);

  // Fetch stock detail data
  const fetchStockData = async (targetPage = 1, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tgl_from: tglFrom,
        tgl_to: tglTo,
        cabang: selectedCabang,
        tipe: tipeSelect,
        model: modelSelect,
        ukuran: ukuranSelect,
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const res = await fetch(`/api/stock-card-detail?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setItems(json.data.items || []);
        setPagination(
          json.data.pagination || {
            page: targetPage,
            limit: itemsPerPage,
            total_items: 0,
            total_pages: 1,
            from_item: 0,
            to_item: 0,
          }
        );
        setSummary(
          json.data.summary || {
            total_items: 0,
            total_stok_awal: 0,
            total_masuk: 0,
            total_keluar: 0,
            total_retur: 0,
            total_move: 0,
            total_stok_akhir: 0,
          }
        );
        setCurrentPage(targetPage);
      } else {
        setItems([]);
        setPagination({
          page: 1,
          limit: itemsPerPage,
          total_items: 0,
          total_pages: 1,
          from_item: 0,
          to_item: 0,
        });
        setSummary({
          total_items: 0,
          total_stok_awal: 0,
          total_masuk: 0,
          total_keluar: 0,
          total_retur: 0,
          total_move: 0,
          total_stok_akhir: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching stock card detail:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchStockData(1);
  }, [selectedCabang]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStockData(1, e);
  };

  const handleResetFilter = () => {
    setTglFrom('');
    setTglTo('');
    setTipeSelect('');
    setModelSelect('');
    setUkuranSelect('');
    if (isSuperAdmin) {
      setSelectedCabang('ALL');
    } else if (currentUser?.branch) {
      setSelectedCabang(currentUser.branch);
    }
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages && newPage !== currentPage) {
      fetchStockData(newPage);
    }
  };

  // Trigger print for all cards on page
  const handlePrintAll = () => {
    setActivePrintCard(null);
    window.print();
  };

  // Open single card print preview & print modal
  const handleOpenPrintCardModal = (card: StockDetailItem) => {
    setActivePrintCard(card);
    setShowPrintModal(true);
  };

  // Execute print for single card
  const handleExecutePrintSingleCard = () => {
    window.print();
  };

  // Options mapped for SearchableSelect
  const cabangOptions: SelectOption[] = [
    { value: 'ALL', label: '🌐 Semua Cabang' },
    ...options.cabang.map((c) => ({
      value: c.nama_cabang,
      label: `🏢 ${c.nama_cabang}`,
    })),
  ];

  const tipeOptions: SelectOption[] = [
    { value: '', label: '-- Semua Tipe --' },
    ...options.tipe.map((t) => ({ value: t, label: t })),
  ];

  const modelOptions: SelectOption[] = [
    { value: '', label: '-- Semua Model --' },
    ...options.model.map((m) => ({ value: m, label: m })),
  ];

  const ukuranOptions: SelectOption[] = [
    { value: '', label: '-- Semua Ukuran --' },
    ...options.ukuran.map((u) => ({ value: u, label: u })),
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Printable Full Page Header (Only active when NOT printing single card) */}
        {!activePrintCard && (
          <div className="hidden print:block mb-6 text-center border-b pb-4">
            <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
            <h2 className="text-lg font-semibold text-gray-700">LAPORAN KARTU STOK DETAIL</h2>
            <p className="text-sm text-gray-600 mt-1">
              Cabang: {selectedCabang === 'ALL' ? 'Semua Cabang' : selectedCabang} | Periode:{' '}
              {tglFrom ? formatDateString(tglFrom) : 'Awal'} s/d {tglTo ? formatDateString(tglTo) : 'Sekarang'}
              {tipeSelect ? ` | Tipe: ${tipeSelect}` : ''}
              {modelSelect ? ` | Model: ${modelSelect}` : ''}
              {ukuranSelect ? ` | Ukuran: ${ukuranSelect}` : ''}
            </p>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Stock Card Detail
                </h1>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                  Rincian kronologis mutasi stok barang (Stok Awal, Masuk, Keluar, Retur, Move Location & Sisa Stok)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handlePrintAll}
              disabled={items.length === 0}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Cetak seluruh halaman mutasi stok"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan Lengkap</span>
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-xs space-y-4 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>Filter Periode, Cabang & Produk Stok</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              💡 Kosongkan tanggal untuk melihat seluruh riwayat kronologis dari awal
            </div>
          </div>

          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 items-end">
              {/* Filter Cabang */}
              {isSuperAdmin && (
                <div>
                  <SearchableSelect
                    label="Cabang Toko"
                    options={cabangOptions}
                    value={selectedCabang}
                    onChange={(val) => {
                      setSelectedCabang(val);
                    }}
                    placeholder="-- Semua Cabang --"
                    searchPlaceholder="Cari nama cabang..."
                    searchable={true}
                  />
                </div>
              )}

              {/* Tanggal From (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Dari Tanggal <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={tglFrom}
                    onChange={(e) => setTglFrom(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50/80 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Tanggal To (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Sampai Tanggal <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={tglTo}
                    onChange={(e) => setTglTo(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50/80 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Tipe / id_bahan (Searchable) */}
              <div>
                <SearchableSelect
                  label="Tipe / Bahan"
                  options={tipeOptions}
                  value={tipeSelect}
                  onChange={setTipeSelect}
                  placeholder="-- Semua Tipe --"
                  searchPlaceholder="Ketik cari tipe..."
                  searchable={true}
                />
              </div>

              {/* Model (Searchable) */}
              <div>
                <SearchableSelect
                  label="Model"
                  options={modelOptions}
                  value={modelSelect}
                  onChange={setModelSelect}
                  placeholder="-- Semua Model --"
                  searchPlaceholder="Ketik cari model..."
                  searchable={true}
                />
              </div>

              {/* Ukuran */}
              <div>
                <SearchableSelect
                  label="Ukuran"
                  options={ukuranOptions}
                  value={ukuranSelect}
                  onChange={setUkuranSelect}
                  placeholder="-- Semua Ukuran --"
                  searchable={false}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-medium flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Cabang Aktif:{' '}
                  <strong className="text-slate-800">
                    {selectedCabang === 'ALL' ? 'Semua Cabang' : selectedCabang}
                  </strong>
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Terapkan Filter</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Metric Summary Cards (Matched with Inventory List) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 print:hidden">
          {/* Card 1: Total Varian */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Package className="w-4 h-4 text-blue-600" />
              <span>Total Jenis Barang</span>
            </div>
            <div className="text-xl font-black text-slate-800">
              {pagination.total_items}{' '}
              <span className="text-xs font-normal text-slate-500">item</span>
            </div>
          </div>

          {/* Card 2: Stok Awal */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Stok Awal</span>
            </div>
            <div className="text-xl font-black text-slate-800">
              {summary.total_stok_awal.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-slate-500">pcs</span>
            </div>
          </div>

          {/* Card 3: Total Masuk */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-teal-600 text-[11px] font-bold uppercase tracking-wider mb-1">
              <ArrowDownRight className="w-4 h-4" />
              <span>Pergerakan Masuk</span>
            </div>
            <div className="text-xl font-black text-teal-700">
              +{summary.total_masuk.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-teal-600/70">pcs</span>
            </div>
          </div>

          {/* Card 4: Total Keluar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-amber-600 text-[11px] font-bold uppercase tracking-wider mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span>Pergerakan Keluar</span>
            </div>
            <div className="text-xl font-black text-amber-600">
              -{summary.total_keluar.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-amber-600/70">pcs</span>
            </div>
          </div>

          {/* Card 5: Total Retur */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-purple-600 text-[11px] font-bold uppercase tracking-wider mb-1">
              <RotateCcw className="w-4 h-4" />
              <span>Total Retur</span>
            </div>
            <div className="text-xl font-black text-purple-700">
              {summary.total_retur.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-purple-600/70">pcs</span>
            </div>
          </div>

          {/* Card 6: Total Move Location */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-blue-600 text-[11px] font-bold uppercase tracking-wider mb-1">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Move Location</span>
            </div>
            <div className="text-xl font-black text-blue-700">
              {summary.total_move.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-blue-600/70">pcs</span>
            </div>
          </div>

          {/* Card 7: Sisa Stok Akhir */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-emerald-600 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Boxes className="w-4 h-4" />
              <span>Sisa Stok Akhir</span>
            </div>
            <div className="text-xl font-black text-emerald-700">
              {summary.total_stok_akhir.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-emerald-600/70">pcs</span>
            </div>
          </div>
        </div>

        {/* Mutation Stock Cards List */}
        <div className={`space-y-6 ${activePrintCard ? 'print:hidden' : ''}`}>
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-sm font-medium">Memuat data kartu stok barang...</span>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="flex flex-col items-center justify-center space-y-2">
                <Package className="w-10 h-10 text-slate-300" />
                <span className="text-base font-semibold text-slate-700">
                  Tidak ada data mutasi stok ditemukan
                </span>
                <span className="text-xs text-slate-400">
                  Coba sesuaikan filter cabang, tipe, model, atau ukuran.
                </span>
              </div>
            </div>
          ) : (
            items.map((stk, idx) => (
              <div
                key={`${stk.id_bahan}-${stk.model}-${stk.ukuran}-${idx}`}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden break-inside-avoid print:border-black print:mb-6"
              >
                {/* Stock Card Header */}
                <div className="px-5 py-4 bg-slate-800 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                      <span className="text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                        [{stk.id_bahan}]
                      </span>
                      {stk.id_cabang && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-700 text-emerald-300 border border-slate-600">
                          <Building2 className="w-3 h-3 text-emerald-400" />
                          <span>{stk.id_cabang}</span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {stk.nama_barang}
                    </h3>
                  </div>

                  {/* Badges Summary per Stock Item & Print Card Button */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 bg-slate-700/80 rounded-lg border border-slate-600 text-slate-200 font-medium">
                      Stok Awal: <strong className="text-white">{stk.stok_awal}</strong> {stk.uom}
                    </span>
                    <span className="px-2.5 py-1 bg-teal-500/20 rounded-lg border border-teal-500/30 text-teal-300 font-medium">
                      Masuk: <strong className="text-teal-200">+{stk.total_masuk}</strong>
                    </span>
                    <span className="px-2.5 py-1 bg-rose-500/20 rounded-lg border border-rose-500/30 text-rose-300 font-medium">
                      Keluar: <strong className="text-rose-200">-{stk.total_keluar}</strong>
                    </span>
                    <span className="px-2.5 py-1 bg-purple-500/20 rounded-lg border border-purple-500/30 text-purple-300 font-medium">
                      Retur: <strong className="text-purple-200">{stk.total_retur}</strong>
                    </span>
                    <span className="px-2.5 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30 text-blue-300 font-medium">
                      Move: <strong className="text-blue-200">{stk.total_move}</strong>
                    </span>
                    <span className="px-3 py-1 bg-emerald-600 rounded-lg text-white font-bold shadow-xs">
                      Sisa Stok: {stk.stok_akhir} {stk.uom}
                    </span>

                    {/* Print & Save as PDF Button per Card */}
                    <button
                      type="button"
                      onClick={() => handleOpenPrintCardModal(stk)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer print:hidden ml-1"
                      title="Cetak kartu ini atau simpan sebagai PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / Simpan PDF</span>
                    </button>
                  </div>
                </div>

                {/* Mutation Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                        <th className="py-2.5 px-3 text-center w-28">Tanggal</th>
                        <th className="py-2.5 px-3 text-center min-w-[140px]">No. Transaksi</th>
                        <th className="py-2.5 px-3 text-center w-32">Jenis Trx</th>
                        <th className="py-2.5 px-3 text-right w-20 text-teal-700">Masuk</th>
                        <th className="py-2.5 px-3 text-right w-20 text-rose-700">Keluar</th>
                        <th className="py-2.5 px-3 text-right w-20 text-purple-700">Retur</th>
                        <th className="py-2.5 px-3 text-right w-20 text-blue-700">Move</th>
                        <th className="py-2.5 px-3 text-right min-w-[110px]">Saldo Stok</th>
                        <th className="py-2.5 px-4 min-w-[200px]">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 text-slate-700">
                      {/* Initial Stock Row (Displayed if date filter is set OR if item started with positive balance) */}
                      {(tglFrom !== '' || stk.stok_awal > 0) && (
                        <tr className="bg-slate-100/70 font-medium italic text-slate-600">
                          <td className="py-2 px-3 text-center font-mono">
                            {tglFrom ? formatDateString(tglFrom) : (stk.tgl_masuk ? formatDateString(stk.tgl_masuk) : '-')}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-slate-600">
                            {stk.id_transaksi_stock && stk.id_transaksi_stock !== '1'
                              ? stk.id_transaksi_stock
                              : 'SALDO AWAL'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                              STOK AWAL
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-teal-700 font-semibold">
                            {stk.stok_awal > 0 ? `+${stk.stok_awal}` : '0'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">0</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">0</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">0</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-100">
                            {stk.stok_awal}
                          </td>
                          <td className="py-2 px-4 text-slate-500 text-xs">
                            {tglFrom
                              ? 'Saldo stok awal sebelum periode filter tanggal'
                              : 'Saldo awal stok masuk barang'}
                          </td>
                        </tr>
                      )}

                      {/* Period Mutations Rows */}
                      {stk.mutations.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-4 text-center text-slate-400 text-xs italic">
                            Tidak ada transaksi mutasi dalam periode tanggal ini.
                          </td>
                        </tr>
                      ) : (
                        stk.mutations.map((m, mIdx) => (
                          <tr key={`${m.id_transaksi}-${mIdx}`} className="hover:bg-slate-50">
                            {/* Tanggal */}
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                              {formatDateString(m.tgl)}
                            </td>

                            {/* No. Transaksi */}
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-800">
                              {m.id_transaksi}
                            </td>

                            {/* Jenis Trx */}
                            <td className="py-2.5 px-3 text-center">
                              {m.tipe_trx === 'BARANG_MASUK' ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                  <ArrowDownRight className="w-3 h-3 text-teal-600" />
                                  <span>BARANG MASUK</span>
                                </span>
                              ) : m.tipe_trx === 'BARANG_KELUAR' ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <ArrowUpRight className="w-3 h-3 text-rose-600" />
                                  <span>BARANG KELUAR</span>
                                </span>
                              ) : m.tipe_trx === 'RETUR_BARANG' ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  <RotateCcw className="w-3 h-3 text-purple-600" />
                                  <span>RETUR BARANG</span>
                                </span>
                              ) : m.tipe_trx === 'MOVE_LOCATION' ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                                  <span>MOVE LOCATION</span>
                                </span>
                              ) : m.tipe_trx === 'TRANSFER_STOCK' ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                                  <span>TRANSFER STOCK</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  STOCK OPNAME
                                </span>
                              )}
                            </td>

                            {/* Masuk */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">
                              {m.masuk > 0 ? `+${m.masuk}` : '0'}
                            </td>

                            {/* Keluar */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                              {m.keluar > 0 ? `-${m.keluar}` : '0'}
                            </td>

                            {/* Retur */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-700">
                              {m.retur > 0 ? `${m.retur}` : '0'}
                            </td>

                            {/* Move */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                              {m.move > 0 ? `${m.move}` : '0'}
                            </td>

                            {/* Saldo Stok */}
                            <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-50/70">
                              {m.saldo}
                            </td>

                            {/* Keterangan */}
                            <td className="py-2.5 px-4 text-slate-600 text-xs">
                              {m.keterangan || '-'}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Stock Item Summary Footer Row */}
                      <tr className="bg-slate-800 text-white font-bold text-xs">
                        <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-300">
                          Total Per Rincian Baris
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-teal-300">
                          +{stk.total_masuk}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-300">
                          -{stk.total_keluar}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-purple-300">
                          {stk.total_retur}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-300">
                          {stk.total_move}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-300 text-sm">
                          {stk.stok_akhir}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 text-xs">
                          Sisa Akhir: {stk.stok_akhir} {stk.uom}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        {pagination.total_pages > 1 && (
          <div className="px-5 py-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="text-xs text-slate-600">
              Menampilkan <strong className="text-slate-800">{pagination.from_item}</strong> -{' '}
              <strong className="text-slate-800">{pagination.to_item}</strong> dari{' '}
              <strong className="text-slate-800">{pagination.total_items}</strong> varian barang
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-2xs">
                {currentPage} / {pagination.total_pages}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.total_pages || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePageChange(pagination.total_pages)}
                disabled={currentPage === pagination.total_pages || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SINGLE CARD PRINT & SAVE AS PDF MODAL & DEDICATED PRINT AREA */}
        {/* ========================================================================= */}
        {showPrintModal && activePrintCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:inset-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
              {/* Modal Top Bar (Hidden in print) */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Cetak / Simpan PDF Kartu Stok
                    </h3>
                    <p className="text-xs text-slate-500">
                      Item: <strong className="text-slate-800">{activePrintCard.nama_barang}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExecutePrintSingleCard}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center space-x-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak / Simpan PDF Sekarang</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintModal(false);
                      setActivePrintCard(null);
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Informative Hint Banner (Hidden in print) */}
              <div className="px-5 py-2.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-xs text-blue-800 print:hidden">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Tips Simpan PDF:</strong> Pada jendela cetak peramban (browser), pilih tujuan (Destination) sebagai <strong>&quot;Save as PDF&quot;</strong> atau <strong>&quot;Simpan sebagai PDF&quot;</strong>.
                  </span>
                </div>
              </div>

              {/* Printable Card Area */}
              <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6 print:p-0 print:overflow-visible">
                {/* Formal Header */}
                <div className="border-b-2 border-slate-800 pb-4 text-center space-y-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-wider uppercase">
                    POS HAYAMI
                  </h1>
                  <h2 className="text-lg font-bold text-slate-700 uppercase tracking-wide">
                    KARTU STOK BARANG (STOCK CARD)
                  </h2>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center justify-center gap-x-4 pt-1">
                    <span>
                      Cabang:{' '}
                      <strong>
                        {activePrintCard.id_cabang ||
                          (selectedCabang === 'ALL' ? 'Semua Cabang' : selectedCabang)}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Periode:{' '}
                      <strong>
                        {tglFrom ? formatDateString(tglFrom) : 'Semua Periode'} s/d{' '}
                        {tglTo ? formatDateString(tglTo) : 'Sekarang'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Dicetak:{' '}
                      <strong>
                        {new Date().toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}{' '}
                        {new Date().toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Product Profile Box */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Tipe / Bahan
                    </span>
                    <strong className="text-slate-800">{activePrintCard.id_bahan}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Model Produk
                    </span>
                    <strong className="text-slate-800">{activePrintCard.model}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Ukuran
                    </span>
                    <strong className="text-slate-800">{activePrintCard.ukuran}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Satuan (UOM)
                    </span>
                    <strong className="text-slate-800">{activePrintCard.uom}</strong>
                  </div>
                </div>

                {/* Summary Metrics Bar */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                      Stok Awal
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {activePrintCard.stok_awal}
                    </span>
                  </div>
                  <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-200">
                    <span className="text-teal-700 block text-[10px] uppercase font-semibold">
                      Masuk
                    </span>
                    <span className="text-sm font-bold text-teal-800">
                      +{activePrintCard.total_masuk}
                    </span>
                  </div>
                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
                    <span className="text-rose-700 block text-[10px] uppercase font-semibold">
                      Keluar
                    </span>
                    <span className="text-sm font-bold text-rose-800">
                      -{activePrintCard.total_keluar}
                    </span>
                  </div>
                  <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="text-purple-700 block text-[10px] uppercase font-semibold">
                      Retur
                    </span>
                    <span className="text-sm font-bold text-purple-800">
                      {activePrintCard.total_retur}
                    </span>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-blue-700 block text-[10px] uppercase font-semibold">
                      Move
                    </span>
                    <span className="text-sm font-bold text-blue-800">
                      {activePrintCard.total_move}
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-100 rounded-lg border border-emerald-300">
                    <span className="text-emerald-800 block text-[10px] uppercase font-bold">
                      Sisa Akhir
                    </span>
                    <span className="text-sm font-black text-emerald-900">
                      {activePrintCard.stok_akhir} {activePrintCard.uom}
                    </span>
                  </div>
                </div>

                {/* Printable Mutations Table */}
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold uppercase text-slate-700">
                        <th className="py-2 px-3 text-center w-24">Tanggal</th>
                        <th className="py-2 px-3 text-center w-36">No. Transaksi</th>
                        <th className="py-2 px-3 text-center w-28">Jenis Trx</th>
                        <th className="py-2 px-3 text-right w-16">Masuk</th>
                        <th className="py-2 px-3 text-right w-16">Keluar</th>
                        <th className="py-2 px-3 text-right w-16">Retur</th>
                        <th className="py-2 px-3 text-right w-16">Move</th>
                        <th className="py-2 px-3 text-right w-20">Saldo</th>
                        <th className="py-2 px-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {/* Initial Stock Row */}
                      {(tglFrom !== '' || activePrintCard.stok_awal > 0) && (
                        <tr className="bg-slate-50 italic">
                          <td className="py-2 px-3 text-center font-mono">
                            {tglFrom ? formatDateString(tglFrom) : (activePrintCard.tgl_masuk ? formatDateString(activePrintCard.tgl_masuk) : '-')}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold">
                            {activePrintCard.id_transaksi_stock && activePrintCard.id_transaksi_stock !== '1'
                              ? activePrintCard.id_transaksi_stock
                              : 'SALDO AWAL'}
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-slate-600">
                            STOK AWAL
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {activePrintCard.stok_awal > 0 ? `+${activePrintCard.stok_awal}` : '0'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">0</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">0</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">0</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {activePrintCard.stok_awal}
                          </td>
                          <td className="py-2 px-3 text-slate-500">Saldo stok awal</td>
                        </tr>
                      )}

                      {/* Mutation rows */}
                      {activePrintCard.mutations.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-4 text-center text-slate-400 italic">
                            Tidak ada pergerakan mutasi stok dalam periode ini.
                          </td>
                        </tr>
                      ) : (
                        activePrintCard.mutations.map((m, mIdx) => (
                          <tr key={mIdx}>
                            <td className="py-2 px-3 text-center font-mono">
                              {formatDateString(m.tgl)}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                              {m.id_transaksi}
                            </td>
                            <td className="py-2 px-3 text-center font-semibold">
                              {m.tipe_trx}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-teal-700">
                              {m.masuk > 0 ? `+${m.masuk}` : '0'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-rose-600">
                              {m.keluar > 0 ? `-${m.keluar}` : '0'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">
                              {m.retur > 0 ? `${m.retur}` : '0'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                              {m.move > 0 ? `${m.move}` : '0'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-black">
                              {m.saldo}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {m.keterangan || '-'}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Footer Totals */}
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                        <td colSpan={3} className="py-2 px-3 text-right uppercase">
                          TOTAL PER BARIS
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-teal-700">
                          +{activePrintCard.total_masuk}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-rose-600">
                          -{activePrintCard.total_keluar}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-purple-700">
                          {activePrintCard.total_retur}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-blue-700">
                          {activePrintCard.total_move}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 text-sm">
                          {activePrintCard.stok_akhir}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          Sisa: {activePrintCard.stok_akhir} {activePrintCard.uom}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signature Block for Formal Report Printout */}
                <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs text-slate-700 break-inside-avoid">
                  <div>
                    <p className="font-semibold text-slate-500 mb-16">Dibuat Oleh,</p>
                    <div className="border-b border-slate-400 w-36 mx-auto"></div>
                    <p className="mt-1 font-medium text-slate-600">Admin / Petugas</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 mb-16">Diperiksa Oleh,</p>
                    <div className="border-b border-slate-400 w-36 mx-auto"></div>
                    <p className="mt-1 font-medium text-slate-600">Kepala Gudang / Toko</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 mb-16">Disetujui Oleh,</p>
                    <div className="border-b border-slate-400 w-36 mx-auto"></div>
                    <p className="mt-1 font-medium text-slate-600">Manager Operasional</p>
                  </div>
                </div>
              </div>

              {/* Modal Bottom Footer (Hidden in print) */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
                <span className="text-xs text-slate-500">
                  Pastikan pengaturan kertas cetak diatur ke <strong>A4</strong> atau <strong>Portrait</strong>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setShowPrintModal(false);
                      setActivePrintCard(null);
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={handleExecutePrintSingleCard}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak / Simpan PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
