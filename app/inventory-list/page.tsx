'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
import {
  Boxes,
  Search,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRightLeft,
  RotateCcw,
  Eye,
  Calendar,
  X,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  Tag,
  CheckCircle2,
  FileSpreadsheet,
  MapPin,
  Building2,
  ExternalLink,
  Info,
} from 'lucide-react';
import { exportInventoryListExcel, exportSingleInventoryDetailExcel } from '@/lib/excel-export-utils';

interface MovementDetail {
  id_transaksi: string;
  tgl_transaksi: string;
  tipe_trx: 'BARANG_MASUK' | 'BARANG_KELUAR' | 'RETUR_BARANG' | 'MOVE_LOCATION' | 'TRANSFER_STOCK';
  qty_masuk: number;
  qty_keluar: number;
  qty_retur: number;
  qty_move: number;
  keterangan: string;
}

interface LocationStockItem {
  id_location: number;
  nama_lokasi: string;
  qty: number;
  updated_at?: string;
}

interface InventoryItem {
  id_bahan: string;
  model: string;
  ukuran: string;
  uom: string;
  nama_stock: string;
  sisa_stock: number;
  id_cabang?: string;
  stok_utama?: number;
  total_di_lokasi_lain?: number;
  locations?: LocationStockItem[];
  total_masuk: number;
  total_keluar: number;
  total_retur: number;
  total_move: number;
  total_pergerakan: number;
  movements: MovementDetail[];
}

interface LocationOption {
  id: number;
  nama_lokasi: string;
}

interface CabangOption {
  id_cabang: number | string;
  nama_cabang: string;
}

export default function InventoryListPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Dropdown Options
  const [tipeOptions, setTipeOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [ukuranOptions, setUkuranOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [cabangOptions, setCabangOptions] = useState<CabangOption[]>([]);

  // Selected Filters
  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [selectedCabang, setSelectedCabang] = useState('ALL');
  const [selectedLokasi, setSelectedLokasi] = useState('');
  const [selectedTipe, setSelectedTipe] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedUkuran, setSelectedUkuran] = useState('');
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Summary Stats
  const [summary, setSummary] = useState({
    total_items: 0,
    total_sisa_stock: 0,
    total_masuk: 0,
    total_keluar: 0,
    total_retur: 0,
    total_move: 0,
  });

  // Modal / Detail view states
  const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
  const [selectedLocationItem, setSelectedLocationItem] = useState<InventoryItem | null>(null);

  // Export State
  const [exporting, setExporting] = useState(false);

  // Set default branch from user session
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

  // Export Excel for all filtered items + all movement details
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedCabang && selectedCabang !== 'ALL') params.append('cabang', selectedCabang);
      if (selectedLokasi) params.append('lokasi', selectedLokasi);
      if (selectedTipe) params.append('tipe', selectedTipe);
      if (selectedModel) params.append('model', selectedModel);
      if (selectedUkuran) params.append('ukuran', selectedUkuran);
      if (tglFrom) params.append('tgl_from', tglFrom);
      if (tglTo) params.append('tgl_to', tglTo);
      params.append('export', 'true');

      const res = await fetch(`/api/inventory-list?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        await exportInventoryListExcel({
          items: data.data.items || [],
          summary: data.data.summary || summary,
          tglFrom,
          tglTo,
          tipe: selectedTipe,
          model: selectedModel,
          ukuran: selectedUkuran,
          lokasi: selectedLokasi,
          cabang: selectedCabang,
        });
      } else {
        alert(data.message || 'Gagal mengambil data untuk export excel');
      }
    } catch (err: any) {
      console.error('Export Excel Error:', err);
      alert('Terjadi kesalahan saat meng-export data ke Excel');
    } finally {
      setExporting(false);
    }
  };

  // Export Excel for a single item detail from modal
  const handleExportSingleDetail = async (item: InventoryItem) => {
    try {
      await exportSingleInventoryDetailExcel(item);
    } catch (err: any) {
      console.error('Export Single Detail Error:', err);
      alert('Gagal meng-export detail pergerakan item');
    }
  };

  // Fetch Dropdown Options on Mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const res = await fetch('/api/inventory-list?options=true');
        const data = await res.json();
        if (res.ok && data.success && data.options) {
          setTipeOptions(data.options.tipe || []);
          setModelOptions(data.options.model || []);
          setUkuranOptions(data.options.ukuran || []);
          setLocationOptions(data.options.locations || []);
          setCabangOptions(data.options.cabang || []);
        }
      } catch (err) {
        console.error('Failed to fetch filter options:', err);
      }
    }
    fetchOptions();
  }, []);

  // Fetch Main Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCabang && selectedCabang !== 'ALL') params.append('cabang', selectedCabang);
      if (selectedLokasi) params.append('lokasi', selectedLokasi);
      if (selectedTipe) params.append('tipe', selectedTipe);
      if (selectedModel) params.append('model', selectedModel);
      if (selectedUkuran) params.append('ukuran', selectedUkuran);
      if (tglFrom) params.append('tgl_from', tglFrom);
      if (tglTo) params.append('tgl_to', tglTo);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await fetch(`/api/inventory-list?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setItems(data.data.items || []);
        if (data.data.pagination) {
          setTotalPages(data.data.pagination.total_pages || 1);
          setTotalItems(data.data.pagination.total_items || 0);
        }
        if (data.data.summary) {
          setSummary(data.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch inventory list:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCabang, selectedLokasi, selectedTipe, selectedModel, selectedUkuran, tglFrom, tglTo, page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilter = () => {
    if (isSuperAdmin) {
      setSelectedCabang('ALL');
    } else if (currentUser?.branch) {
      setSelectedCabang(currentUser.branch);
    }
    setSelectedLokasi('');
    setSelectedTipe('');
    setSelectedModel('');
    setSelectedUkuran('');
    setTglFrom('');
    setTglTo('');
    setPage(1);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === '0000-00-00') return '-';
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

  const formattedCabangOptions: SelectOption[] = [
    { value: 'ALL', label: '🌐 Semua Cabang' },
    ...cabangOptions.map((c) => ({
      value: c.nama_cabang,
      label: `🏢 ${c.nama_cabang}`,
    })),
  ];

  const formattedLocationOptions: SelectOption[] = [
    { value: '', label: '-- Semua Lokasi --' },
    { value: 'MAIN_INVENTORY', label: '📦 Gudang Utama (Stok Tersedia)' },
    ...locationOptions.map((loc) => ({
      value: loc.nama_lokasi,
      label: `📍 ${loc.nama_lokasi}`,
    })),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100/80">
              <Boxes className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Inventory List</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar gabungan stok barang, sebaran lokasi penyimpanan, pergerakan barang masuk, keluar & retur
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0 self-start md:self-auto">
            <button
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <FileSpreadsheet className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
              <span>{exporting ? 'Meng-export...' : 'Export Excel'}</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200/80 text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Segarkan Data</span>
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-emerald-600" />
              <span>Filter Pencarian Cabang, Lokasi & Produk Stok</span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
              💡 Klik pada nama barang untuk melihat rincian lokasi stok berada di mana
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3.5">
            {/* Filter Cabang Toko */}
            {isSuperAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cabang Toko
                </label>
                <SearchableSelect
                  options={formattedCabangOptions}
                  value={selectedCabang}
                  onChange={(val) => {
                    setSelectedCabang(val);
                    setPage(1);
                  }}
                  placeholder="-- Semua Cabang --"
                />
              </div>
            )}

            {/* Filter Lokasi (Dari Tabel location) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Lokasi Penyimpanan
              </label>
              <SearchableSelect
                options={formattedLocationOptions}
                value={selectedLokasi}
                onChange={(val) => {
                  setSelectedLokasi(val);
                  setPage(1);
                }}
                placeholder="-- Semua Lokasi --"
              />
            </div>

            {/* Tipe / Bahan */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Tipe / Bahan
              </label>
              <SearchableSelect
                options={tipeOptions.map((t) => ({ value: t, label: t }))}
                value={selectedTipe}
                onChange={(val) => {
                  setSelectedTipe(val);
                  setPage(1);
                }}
                placeholder="-- Semua Tipe --"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Model</label>
              <SearchableSelect
                options={modelOptions.map((m) => ({ value: m, label: m }))}
                value={selectedModel}
                onChange={(val) => {
                  setSelectedModel(val);
                  setPage(1);
                }}
                placeholder="-- Semua Model --"
              />
            </div>

            {/* Ukuran */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ukuran</label>
              <SearchableSelect
                options={ukuranOptions.map((u) => ({ value: u, label: u }))}
                value={selectedUkuran}
                onChange={(val) => {
                  setSelectedUkuran(val);
                  setPage(1);
                }}
                placeholder="-- Semua Ukuran --"
              />
            </div>

            {/* Dari Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Pergerakan Dari
              </label>
              <input
                type="date"
                value={tglFrom}
                onChange={(e) => {
                  setTglFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Sampai Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={tglTo}
                onChange={(e) => {
                  setTglTo(e.target.value);
                  setPage(1);
                }}
                className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium flex-wrap gap-y-1">
              <span className="flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Cabang:{' '}
                  <strong className="text-slate-800">
                    {selectedCabang === 'ALL' ? 'Semua Cabang' : selectedCabang}
                  </strong>
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Lokasi:{' '}
                  <strong className="text-slate-800">
                    {selectedLokasi
                      ? selectedLokasi === 'MAIN_INVENTORY'
                        ? 'Gudang Utama'
                        : selectedLokasi
                      : 'Semua Lokasi'}
                  </strong>
                </span>
              </span>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                onClick={handleResetFilter}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting || loading}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${exporting ? 'animate-spin' : ''}`} />
                <span>Export Excel</span>
              </button>
              <button
                onClick={fetchData}
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Terapkan Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Jenis Barang
              </p>
              <p className="text-xl font-extrabold text-slate-800 mt-0.5">{totalItems}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Sisa Stock
              </p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">
                {summary.total_sisa_stock.toLocaleString('id-ID')} <span className="text-xs font-medium text-slate-400">pcs</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Pergerakan Masuk
              </p>
              <p className="text-xl font-extrabold text-teal-700 mt-0.5">
                {summary.total_masuk.toLocaleString('id-ID')} <span className="text-xs font-medium text-slate-400">pcs</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Pergerakan Keluar
              </p>
              <p className="text-xl font-extrabold text-amber-600 mt-0.5">
                {summary.total_keluar.toLocaleString('id-ID')} <span className="text-xs font-medium text-slate-400">pcs</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Retur Barang
              </p>
              <p className="text-xl font-extrabold text-purple-600 mt-0.5">
                {summary.total_retur.toLocaleString('id-ID')} <span className="text-xs font-medium text-slate-400">pcs</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Move Location
              </p>
              <p className="text-xl font-extrabold text-indigo-600 mt-0.5">
                {(summary.total_move || 0).toLocaleString('id-ID')} <span className="text-xs font-medium text-slate-400">pcs</span>
              </p>
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 min-w-[200px]">Nama Barang</th>
                  <th className="py-3.5 px-4 text-center">Tipe / Bahan</th>
                  <th className="py-3.5 px-4 text-center">Model</th>
                  <th className="py-3.5 px-4 text-center">Ukuran</th>
                  <th className="py-3.5 px-4 text-right">Sisa Stock</th>
                  <th className="py-3.5 px-4 text-right">Qty Masuk</th>
                  <th className="py-3.5 px-4 text-right">Qty Keluar</th>
                  <th className="py-3.5 px-4 text-right">Qty Retur</th>
                  <th className="py-3.5 px-4 text-right">Qty Move</th>
                  <th className="py-3.5 px-4 text-center min-w-[160px]">Detail & Lokasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <span>Memuat data inventory list...</span>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-slate-600">Tidak ada data stock ditemukan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Coba sesuaikan filter pencarian Cabang, Lokasi, Tipe, Model, atau Ukuran
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/80 transition-colors group cursor-default"
                    >
                      {/* Nama Stock (Clean appearance on front table; Clicking opens location breakdown modal) */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedLocationItem(item)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 hover:text-emerald-800 rounded-lg font-mono text-xs font-bold border border-slate-200 transition-all cursor-pointer text-left shadow-2xs group"
                          title="Klik untuk melihat rincian lokasi stok barang ini berada"
                        >
                          <Tag className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
                          <span>{item.nama_stock}</span>
                        </button>
                      </td>

                      {/* Tipe / Bahan */}
                      <td className="py-3 px-4 text-center text-slate-600">{item.id_bahan || '-'}</td>

                      {/* Model */}
                      <td className="py-3 px-4 text-center text-slate-600 font-semibold">
                        {item.model || '-'}
                      </td>

                      {/* Ukuran */}
                      <td className="py-3 px-4 text-center text-slate-600 font-semibold">
                        {item.ukuran || '-'}
                      </td>

                      {/* Sisa Stock (Clean badge; Clicking opens location breakdown modal) */}
                      <td className="py-3 px-4 text-right font-bold">
                        <button
                          type="button"
                          onClick={() => setSelectedLocationItem(item)}
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 cursor-pointer ${item.sisa_stock > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                          title="Klik untuk melihat sebaran lokasi stok"
                        >
                          {item.sisa_stock.toLocaleString('id-ID')} {item.uom}
                        </button>
                      </td>

                      {/* Qty Masuk */}
                      <td className="py-3 px-4 text-right font-semibold text-teal-700">
                        {item.total_masuk > 0 ? (
                          <span>+{item.total_masuk.toLocaleString('id-ID')}</span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Qty Keluar */}
                      <td className="py-3 px-4 text-right font-semibold text-amber-600">
                        {item.total_keluar > 0 ? (
                          <span>-{item.total_keluar.toLocaleString('id-ID')}</span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Qty Retur */}
                      <td className="py-3 px-4 text-right font-semibold text-purple-700">
                        {item.total_retur > 0 ? (
                          <span className="inline-flex items-center space-x-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-200">
                            <RotateCcw className="w-3 h-3 text-purple-600" />
                            <span>{item.total_retur.toLocaleString('id-ID')}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Qty Move */}
                      <td className="py-3 px-4 text-right font-semibold text-blue-700">
                        {item.total_move > 0 ? (
                          <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200">
                            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                            <span>{item.total_move.toLocaleString('id-ID')}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Actions: Location Detail & Movement Buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Location Detail Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedLocationItem(item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white rounded-lg text-xs font-semibold transition-all border border-amber-200/80 cursor-pointer shadow-2xs"
                            title="Lihat sebaran lokasi stok barang ini"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Lokasi</span>
                          </button>

                          {/* Movements Detail Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-xs font-semibold transition-all border border-emerald-200/80 cursor-pointer shadow-2xs"
                            title="Lihat riwayat pergerakan mutasi stok"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Mutasi</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Menampilkan <strong>{items.length}</strong> dari <strong>{totalItems}</strong> jenis stok
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-semibold text-slate-700 px-2">
                  Halaman {page} dari {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* MODAL: DETAIL SEBARAN LOKASI BARANG (MUNCUL KETIKA BARANG DIKLIK) */}
        {/* ========================================================================= */}
        {selectedLocationItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-amber-600">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Rincian Lokasi Stok Barang
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {selectedLocationItem.nama_stock}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLocationItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto flex-1 space-y-5">
                {/* Product Summary Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Tipe / Bahan
                    </span>
                    <strong className="text-slate-800">{selectedLocationItem.id_bahan || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Model Produk
                    </span>
                    <strong className="text-slate-800">{selectedLocationItem.model || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Ukuran
                    </span>
                    <strong className="text-slate-800">{selectedLocationItem.ukuran || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Satuan (UOM)
                    </span>
                    <strong className="text-slate-800">{selectedLocationItem.uom}</strong>
                  </div>
                </div>

                {/* 3 Metric Balance Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card 1: Gudang Utama */}
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center space-x-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                        Gudang Utama
                      </p>
                      <p className="text-lg font-black text-emerald-900 mt-0.5">
                        {selectedLocationItem.stok_utama}{' '}
                        <span className="text-xs font-normal text-emerald-700">{selectedLocationItem.uom}</span>
                      </p>
                      <p className="text-[10px] text-emerald-600">Stok siap jual di POS</p>
                    </div>
                  </div>

                  {/* Card 2: Lokasi Lain */}
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center space-x-3">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                        Lokasi Lain
                      </p>
                      <p className="text-lg font-black text-amber-900 mt-0.5">
                        {selectedLocationItem.total_di_lokasi_lain || 0}{' '}
                        <span className="text-xs font-normal text-amber-700">{selectedLocationItem.uom}</span>
                      </p>
                      <p className="text-[10px] text-amber-600">
                        {selectedLocationItem.locations?.length || 0} titik penyimpanan
                      </p>
                    </div>
                  </div>

                  {/* Card 3: Total Sisa Stok */}
                  <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center space-x-3">
                    <div className="p-2 bg-slate-200 rounded-lg text-slate-700">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                        Total Sisa Stok
                      </p>
                      <p className="text-lg font-black text-slate-900 mt-0.5">
                        {selectedLocationItem.sisa_stock}{' '}
                        <span className="text-xs font-normal text-slate-500">{selectedLocationItem.uom}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">Total fisik keseluruhan</p>
                    </div>
                  </div>
                </div>

                {/* Table Breakdown per Lokasi */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Rincian Stok Tiap Titik Lokasi</span>
                    </h4>
                  </div>

                  <div className="rounded-xl border border-slate-200/90 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                          <th className="py-2.5 px-3.5">Nama Lokasi</th>
                          <th className="py-2.5 px-3 text-center">Tipe Lokasi</th>
                          <th className="py-2.5 px-3 text-right">Stok (Qty)</th>
                          <th className="py-2.5 px-3 text-right">Porsi</th>
                          <th className="py-2.5 px-3.5">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {/* Row 1: Gudang / Inventaris Utama */}
                        <tr className="bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900 flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Gudang / Inventaris Utama</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              UTAMA
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                            {selectedLocationItem.stok_utama} {selectedLocationItem.uom}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                            {selectedLocationItem.sisa_stock > 0
                              ? `${Math.round(((selectedLocationItem.stok_utama || 0) / selectedLocationItem.sisa_stock) * 100)}%`
                              : '0%'}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-500 text-xs">
                            Stok aktif tersedia di toko / kasir POS
                          </td>
                        </tr>

                        {/* Rows: Each location in tb_location_stock */}
                        {selectedLocationItem.locations && selectedLocationItem.locations.length > 0 ? (
                          selectedLocationItem.locations.map((loc, locIdx) => (
                            <tr key={locIdx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3.5 font-bold text-slate-800 flex items-center space-x-1.5">
                                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{loc.nama_lokasi}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  PENYIMPANAN
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-amber-800">
                                {loc.qty} {selectedLocationItem.uom}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                                {selectedLocationItem.sisa_stock > 0
                                  ? `${Math.round((loc.qty / selectedLocationItem.sisa_stock) * 100)}%`
                                  : '0%'}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-500 text-xs">
                                Dipindahkan via Move Location{' '}
                                {loc.updated_at ? `(${formatDate(loc.updated_at)})` : ''}
                              </td>
                            </tr>
                          ))
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  {(!selectedLocationItem.locations || selectedLocationItem.locations.length === 0) && (
                    <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center space-x-2 text-xs text-blue-800">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Seluruh stok barang ini (100%) berada di <strong>Gudang / Inventaris Utama</strong>. Belum ada pemindahan barang ke lokasi penyimpanan lain seperti LOST atau display.
                      </span>
                    </div>
                  )}
                </div>

                {/* Move Location History for this Item */}
                {selectedLocationItem.movements.filter((m) => m.tipe_trx === 'MOVE_LOCATION').length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                      <span>Riwayat Mutasi Pindah Lokasi</span>
                    </h4>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                            <th className="py-2 px-3">Tanggal</th>
                            <th className="py-2 px-3">No. Transaksi</th>
                            <th className="py-2 px-3 text-right">Jumlah (Qty)</th>
                            <th className="py-2 px-3">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedLocationItem.movements
                            .filter((m) => m.tipe_trx === 'MOVE_LOCATION')
                            .map((mv, mvIdx) => (
                              <tr key={mvIdx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-slate-600 font-mono">
                                  {formatDate(mv.tgl_transaksi)}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-800">
                                  {mv.id_transaksi}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-blue-700 font-mono">
                                  {mv.qty_move} pcs
                                </td>
                                <td className="py-2 px-3 text-slate-500">{mv.keterangan || '-'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <Link
                  href="/move-location"
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Buka Form Pindah Lokasi</span>
                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                </Link>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const item = selectedLocationItem;
                      setSelectedLocationItem(null);
                      setSelectedDetailItem(item);
                    }}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center space-x-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Semua Mutasi</span>
                  </button>
                  <button
                    onClick={() => setSelectedLocationItem(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: DETAIL PERGERAKAN STOCK LENGKAP (MASUK, KELUAR, RETUR, MOVE) */}
        {/* ========================================================================= */}
        {selectedDetailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Detail Pergerakan Stock: <span className="text-emerald-700 font-mono">{selectedDetailItem.nama_stock}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sisa Stock Saat Ini:{' '}
                      <strong className="text-emerald-700">{selectedDetailItem.sisa_stock} {selectedDetailItem.uom}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const item = selectedDetailItem;
                      setSelectedDetailItem(null);
                      setSelectedLocationItem(item);
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 cursor-pointer"
                    title="Lihat sebaran lokasi barang"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Sebaran Lokasi</span>
                  </button>

                  <button
                    onClick={() => setSelectedDetailItem(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Table Pergerakan */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {selectedDetailItem.movements.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-600">Tidak ada riwayat pergerakan stock</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Belum ada transaksi barang masuk, keluar, retur, move location, atau transfer stock untuk item ini
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                          <th className="py-3 px-4">Tipe Transaksi</th>
                          <th className="py-3 px-4">No. Transaksi</th>
                          <th className="py-3 px-4 text-center">Tanggal</th>
                          <th className="py-3 px-4 text-right">Masuk</th>
                          <th className="py-3 px-4 text-right">Keluar</th>
                          <th className="py-3 px-4 text-right">Retur</th>
                          <th className="py-3 px-4 text-right">Move</th>
                          <th className="py-3 px-4">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {selectedDetailItem.movements.map((m, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            {/* Tipe Transaksi */}
                            <td className="py-2.5 px-4 font-semibold">
                              {m.tipe_trx === 'BARANG_MASUK' ? (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                                  <ArrowDownRight className="w-3 h-3 text-teal-600" />
                                  <span>BARANG MASUK</span>
                                </span>
                              ) : m.tipe_trx === 'BARANG_KELUAR' ? (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <ArrowUpRight className="w-3 h-3 text-amber-600" />
                                  <span>BARANG KELUAR</span>
                                </span>
                              ) : m.tipe_trx === 'TRANSFER_STOCK' ? (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <ArrowRightLeft className="w-3 h-3 text-indigo-600" />
                                  <span>TRANSFER STOCK</span>
                                </span>
                              ) : m.tipe_trx === 'MOVE_LOCATION' ? (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <ArrowRightLeft className="w-3 h-3 text-blue-600" />
                                  <span>MOVE LOCATION</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  <RotateCcw className="w-3 h-3 text-purple-600" />
                                  <span>RETUR BARANG</span>
                                </span>
                              )}
                            </td>

                            {/* No Transaksi */}
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                              {m.id_transaksi}
                            </td>

                            {/* Tanggal */}
                            <td className="py-2.5 px-4 text-center text-slate-600">
                              {formatDate(m.tgl_transaksi)}
                            </td>

                            {/* Masuk */}
                            <td className="py-2.5 px-4 text-right font-bold text-teal-700">
                              {m.qty_masuk > 0 ? `+${m.qty_masuk}` : '-'}
                            </td>

                            {/* Keluar */}
                            <td className="py-2.5 px-4 text-right font-bold text-amber-600">
                              {m.qty_keluar > 0 ? `-${m.qty_keluar}` : '-'}
                            </td>

                            {/* Retur */}
                            <td className="py-2.5 px-4 text-right font-bold text-purple-700">
                              {m.qty_retur > 0 ? `${m.qty_retur}` : '-'}
                            </td>

                            {/* Move */}
                            <td className="py-2.5 px-4 text-right font-bold text-blue-700">
                              {m.qty_move > 0 ? `${m.qty_move}` : '-'}
                            </td>

                            {/* Keterangan */}
                            <td className="py-2.5 px-4 text-slate-500 text-xs">
                              {m.keterangan || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  onClick={() => handleExportSingleDetail(selectedDetailItem)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs inline-flex items-center space-x-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Excel Item Ini</span>
                </button>
                <button
                  onClick={() => setSelectedDetailItem(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
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

