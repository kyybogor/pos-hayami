'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
import {
  Package,
  Search,
  Printer,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Barcode,
  Layers,
  Calendar,
  DollarSign,
  Tag,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { exportStockDetailExcel } from '@/lib/excel-export-utils';

interface StockDetailItem {
  id: string;
  id_transaksi_stock: string;
  tgl_masuk: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  stock: number;
  uom: string;
  harga_lusin: number;
  harga_pcs: number;
  subtotal_nilai: number;
  barcode: string;
}

interface StockGroup {
  id_bahan: string;
  nama_tipe: string;
  total_stock_pcs: number;
  total_items: number;
  total_nilai_stok: number;
  items: StockDetailItem[];
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
  total_tipe: number;
  total_items: number;
  total_stock_pcs: number;
  total_nilai_stok: number;
}

interface OptionData {
  tipe: string[];
  model: string[];
  ukuran: string[];
}

export default function StockDetailPage() {
  const [tipeSelect, setTipeSelect] = useState('');
  const [modelSelect, setModelSelect] = useState('');
  const [ukuranSelect, setUkuranSelect] = useState('');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [options, setOptions] = useState<OptionData>({
    tipe: [],
    model: [],
    ukuran: [],
  });

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<StockGroup[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: itemsPerPage,
    total_items: 0,
    total_pages: 1,
    from_item: 0,
    to_item: 0,
  });

  const [summary, setSummary] = useState<SummaryData>({
    total_tipe: 0,
    total_items: 0,
    total_stock_pcs: 0,
    total_nilai_stok: 0,
  });

  const formatDateString = (dateStr: string) => {
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

  const formatCurrency = (val: number) => {
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

  // Fetch stock detail data
  const fetchStockDetail = async (targetPage = 1, e?: React.FormEvent, overrideCabang?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tipe: tipeSelect,
        model: modelSelect,
        ukuran: ukuranSelect,
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        params.append('cabang', branchVal);
      }

      const res = await fetch(`/api/stock-detail?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setGroups(json.data.groups || []);
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
            total_tipe: 0,
            total_items: 0,
            total_stock_pcs: 0,
            total_nilai_stok: 0,
          }
        );
        setCurrentPage(targetPage);
      } else {
        setGroups([]);
        setPagination({
          page: 1,
          limit: itemsPerPage,
          total_items: 0,
          total_pages: 1,
          from_item: 0,
          to_item: 0,
        });
        setSummary({
          total_tipe: 0,
          total_items: 0,
          total_stock_pcs: 0,
          total_nilai_stok: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching stock detail:', err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown options and user on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const [optRes, cRes, uRes] = await Promise.all([
          fetch('/api/stock-detail?options=true'),
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        if (optRes.ok) {
          const json = await optRes.json();
          if (json.success && json.options) {
            setOptions(json.options);
          }
        }
        if (cRes.ok) {
          const cJson = await cRes.json();
          if (cJson.success) setCabangOptions(cJson.cabang || []);
        }
        let userBranch = '';
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
        fetchStockDetail(1, undefined, userBranch);
      } catch (err) {
        console.error('Error init stock detail options/user:', err);
        fetchStockDetail(1);
      }
    };
    initData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStockDetail(1, e);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages && newPage !== currentPage) {
      fetchStockDetail(newPage);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (groups.length === 0) {
      alert('Tidak ada data stock detail untuk diexport.');
      return;
    }
    setIsExporting(true);
    try {
      let exportGroups = groups;
      let exportSummary = summary;

      if (pagination.total_pages > 1) {
        const params = new URLSearchParams({
          tipe: tipeSelect,
          model: modelSelect,
          ukuran: ukuranSelect,
          page: '1',
          limit: '99999',
        });
        if (selectedCabang && selectedCabang !== 'ALL') {
          params.append('cabang', selectedCabang);
        }
        const res = await fetch(`/api/stock-detail?${params.toString()}`);
        const json = await res.json();
        if (json.success && json.data) {
          exportGroups = json.data.groups || groups;
          exportSummary = json.data.summary || summary;
        }
      }

      await exportStockDetailExcel({
        groups: exportGroups,
        summary: exportSummary,
        tipe: tipeSelect,
        model: modelSelect,
        ukuran: ukuranSelect,
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengunduh file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

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
        {/* Printable Header */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">LAPORAN STOCK DETAIL</h2>
          <p className="text-sm text-gray-600">
            {tipeSelect ? `Tipe: ${tipeSelect}` : 'Semua Tipe'}
            {modelSelect ? ` | Model: ${modelSelect}` : ''}
            {ukuranSelect ? ` | Ukuran: ${ukuranSelect}` : ''}
          </p>
        </div>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Package className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Stock Detail
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Rincian stok barang aktif terbagi per kelompok Tipe/Bahan, Model, Ukuran, dan Harga.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || loading || groups.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download Excel Laporan Stock Detail"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting ? 'Mengunduh...' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-xs space-y-4 print:hidden">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filter Tipe, Model & Ukuran</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Cabang Toko - Superadmin Only */}
            {isSuperAdmin && (
              <div className="lg:col-span-12 space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Cabang Toko
                </label>
                <div className="relative">
                  <select
                    value={selectedCabang}
                    onChange={(e) => setSelectedCabang(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="ALL">-- Semua Cabang --</option>
                    {cabangOptions.map((c) => (
                      <option key={c.id_cabang} value={c.nama_cabang}>
                        {c.nama_cabang}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Tipe / id_bahan (Searchable) */}
            <div className="lg:col-span-4">
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
            <div className="lg:col-span-4">
              <SearchableSelect
                label="Model Barang"
                options={modelOptions}
                value={modelSelect}
                onChange={setModelSelect}
                placeholder="-- Semua Model --"
                searchPlaceholder="Ketik cari model..."
                searchable={true}
              />
            </div>

            {/* Ukuran (Styled Dropdown) */}
            <div className="lg:col-span-4">
              <SearchableSelect
                label="Ukuran"
                options={ukuranOptions}
                value={ukuranSelect}
                onChange={setUkuranSelect}
                placeholder="-- Semua Ukuran --"
                searchable={false}
              />
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-12 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTipeSelect('');
                  setModelSelect('');
                  setUkuranSelect('');
                  const resetBranch = isSuperAdmin ? 'ALL' : (currentUser?.branch || '');
                  setSelectedCabang(resetBranch);
                  fetchStockDetail(1, undefined, resetBranch);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium transition-all flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Cari Stock</span>
              </button>
            </div>
          </form>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
          {/* Card 1: Total Tipe */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Tag className="w-4 h-4 text-blue-600" />
              <span>Total Kelompok Tipe</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.total_tipe}{' '}
              <span className="text-xs font-normal text-slate-500">tipe</span>
            </div>
          </div>

          {/* Card 2: Total Items */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Total Baris Stock</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.total_items}{' '}
              <span className="text-xs font-normal text-slate-500">item</span>
            </div>
          </div>

          {/* Card 3: Total Stock (PCS) */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>Total Qty Stock</span>
            </div>
            <div className="text-xl font-bold text-emerald-600">
              {summary.total_stock_pcs.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-emerald-600/70">pcs</span>
            </div>
          </div>

          {/* Card 4: Total Nilai Stok */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <DollarSign className="w-4 h-4 text-amber-600" />
              <span>Estimasi Nilai Stok</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {formatCurrency(summary.total_nilai_stok)}
            </div>
          </div>
        </div>

        {/* Grouped Stock Lists */}
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-sm font-medium">Memuat data stock detail...</span>
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="flex flex-col items-center justify-center space-y-1">
                <Package className="w-10 h-10 text-slate-300" />
                <span className="text-base font-medium text-slate-700">
                  Tidak ada data stock detail ditemukan
                </span>
                <span className="text-xs text-slate-400">
                  Coba atur ulang atau pilih filter tipe, model, atau ukuran lain.
                </span>
              </div>
            </div>
          ) : (
            groups.map((group, idx) => (
              <div
                key={`${group.id_bahan}-${idx}`}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
              >
                {/* Group Header */}
                <div className="px-5 py-3.5 bg-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold rounded-lg border border-emerald-500/30">
                      TIPE / BAHAN
                    </span>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {group.nama_tipe}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-slate-300 font-medium">
                      Baris: <strong className="text-white">{group.total_items}</strong>
                    </span>
                    <span className="px-3 py-1 bg-emerald-600 rounded-lg text-white font-bold shadow-xs">
                      Total Qty: {group.total_stock_pcs.toLocaleString('id-ID')} PCS
                    </span>
                  </div>
                </div>

                {/* Group Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                        <th className="py-2.5 px-4 text-center w-32">Tanggal Masuk</th>
                        <th className="py-2.5 px-4 text-center min-w-[140px]">No. Transaksi</th>
                        <th className="py-2.5 px-4 text-left min-w-[160px]">Model</th>
                        <th className="py-2.5 px-4 text-center w-28">Ukuran</th>
                        <th className="py-2.5 px-4 text-center w-24">Qty Stock</th>
                        <th className="py-2.5 px-4 text-right w-32">Harga / PCS</th>
                        <th className="py-2.5 px-4 text-right min-w-[120px]">Subtotal Nilai</th>
                        <th className="py-2.5 px-4 text-center w-36 print:hidden">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 text-slate-700">
                      {group.items.map((item, itemIdx) => (
                        <tr key={`${item.id}-${itemIdx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 text-center font-mono text-slate-600">
                            <div className="flex items-center justify-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{formatDateString(item.tgl_masuk)}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-semibold text-emerald-700">
                            {item.id_transaksi_stock}
                          </td>
                          <td className="py-2.5 px-4 text-left font-medium text-slate-800">
                            {item.model}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.ukuran}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono font-bold text-emerald-600">
                            {item.stock} <span className="text-[10px] font-normal text-slate-500">PCS</span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                            {formatCurrency(item.harga_pcs)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 bg-slate-50/50">
                            {formatCurrency(item.subtotal_nilai)}
                          </td>
                          <td className="py-2.5 px-4 text-center print:hidden">
                            <button
                              type="button"
                              onClick={() => {
                                window.open(
                                  `/barang-masuk-offline/print-barcode?tipe=${encodeURIComponent(
                                    item.id_bahan
                                  )}&model=${encodeURIComponent(
                                    item.model
                                  )}&ukuran=${encodeURIComponent(item.ukuran)}&page=sd`,
                                  '_blank'
                                );
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200 transition-all cursor-pointer"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                              <span>Print Barcode</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Group Footer */}
                    <tfoot>
                      <tr className="bg-slate-100/80 font-bold text-xs text-slate-700">
                        <td colSpan={4} className="py-2 px-4 text-right uppercase tracking-wider text-slate-500">
                          Total Tipe {group.nama_tipe}
                        </td>
                        <td className="py-2 px-4 text-center font-mono text-emerald-700">
                          {group.total_stock_pcs} PCS
                        </td>
                        <td className="py-2 px-4 text-right font-normal text-slate-400">-</td>
                        <td className="py-2 px-4 text-right font-mono text-slate-900">
                          {formatCurrency(group.total_nilai_stok)}
                        </td>
                        <td className="py-2 px-4 text-center print:hidden">-</td>
                      </tr>
                    </tfoot>
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
              <strong className="text-slate-800">{pagination.total_items}</strong> kelompok tipe
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
      </div>
    </DashboardLayout>
  );
}
