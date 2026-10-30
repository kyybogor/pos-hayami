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
  Layers,
  Boxes,
} from 'lucide-react';

interface StockItem {
  row_num: number;
  id_bahan: string;
  model: string;
  ukuran: string;
  nama_barang: string;
  stock: number;
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
  total_stock: number;
}

interface OptionData {
  tipe: string[];
  model: string[];
  ukuran: string[];
  cabang?: { id_cabang: number | string; nama_cabang: string }[];
}

export default function StockCardGeneralPage() {
  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [tipeSelect, setTipeSelect] = useState('');
  const [modelSelect, setModelSelect] = useState('');
  const [ukuranSelect, setUkuranSelect] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [options, setOptions] = useState<OptionData>({
    tipe: [],
    model: [],
    ukuran: [],
    cabang: [],
  });

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
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
    total_stock: 0,
  });

  // Fetch filter options and user session on load
  useEffect(() => {
    const initData = async () => {
      try {
        const [optRes, uRes] = await Promise.all([
          fetch('/api/stock-card-general?options=true'),
          fetch('/api/auth/me'),
        ]);
        if (optRes.ok) {
          const json = await optRes.json();
          if (json.success && json.options) {
            setOptions(json.options);
          }
        }
        if (uRes.ok) {
          const uJson = await uRes.json();
          if (uJson.authenticated && uJson.user) {
            setCurrentUser(uJson.user);
            const isSuper = (uJson.user.role || '').toLowerCase() === 'superadmin';
            if (!isSuper && uJson.user.branch) {
              setSelectedCabang(uJson.user.branch);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching options / user:', err);
      }
    };
    initData();
  }, []);

  // Fetch paginated stock data
  const fetchStockData = async (targetPage = 1, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tipe: tipeSelect,
        model: modelSelect,
        ukuran: ukuranSelect,
        search: searchInput,
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
      });
      if (selectedCabang && selectedCabang !== 'ALL') {
        params.append('cabang', selectedCabang);
      }

      const res = await fetch(`/api/stock-card-general?${params.toString()}`);
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
            total_stock: 0,
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
        setSummary({ total_items: 0, total_stock: 0 });
      }
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData(1);
  }, [selectedCabang]);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStockData(1, e);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages && newPage !== currentPage) {
      fetchStockData(newPage);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const cabangSelectOptions: SelectOption[] = [
    { value: 'ALL', label: '🌐 Semua Cabang' },
    ...(options.cabang || []).map((c) => ({
      value: c.nama_cabang,
      label: `🏢 ${c.nama_cabang}`,
    })),
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Printable Header */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">STOCK CARD GENERAL</h2>
          <p className="text-sm text-gray-600">
            {selectedCabang !== 'ALL' ? `Cabang: ${selectedCabang} | ` : ''}
            {tipeSelect ? `Tipe: ${tipeSelect}` : 'Semua Tipe'} |{' '}
            {modelSelect ? `Model: ${modelSelect}` : 'Semua Model'} |{' '}
            {ukuranSelect ? `Ukuran: ${ukuranSelect}` : 'Semua Ukuran'}
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
                Stock Card General
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Rekapitulasi sisa stok barang berdasarkan Tipe, Model, dan Ukuran (50 list per halaman).
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              disabled={items.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs md:text-sm font-medium transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-xs space-y-4 print:hidden">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filter Data Stok</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Cabang Toko - Superadmin Only */}
            {isSuperAdmin && (
              <div className="lg:col-span-3">
                <SearchableSelect
                  label="Cabang Toko"
                  options={cabangSelectOptions}
                  value={selectedCabang}
                  onChange={setSelectedCabang}
                  placeholder="-- Semua Cabang --"
                  searchPlaceholder="Ketik cari cabang..."
                  searchable={true}
                />
              </div>
            )}

            {/* Tipe / id_bahan (Searchable) */}
            <div className={isSuperAdmin ? "lg:col-span-3" : "lg:col-span-3"}>
              <SearchableSelect
                label="Tipe / Bahan"
                options={tipeOptions}
                value={tipeSelect}
                onChange={setTipeSelect}
                placeholder="-- Semua Tipe --"
                searchPlaceholder="Ketik cari tipe/bahan..."
                searchable={true}
              />
            </div>

            {/* Model (Searchable) */}
            <div className="lg:col-span-3">
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

            {/* Ukuran (Styled dropdown, non-searchable) */}
            <div className="lg:col-span-3">
              <SearchableSelect
                label="Ukuran"
                options={ukuranOptions}
                value={ukuranSelect}
                onChange={setUkuranSelect}
                placeholder="-- Semua Ukuran --"
                searchable={false}
              />
            </div>

            {/* Search Input */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Pencarian Kata Kunci
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari tipe, model, ukuran..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-12 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTipeSelect('');
                  setModelSelect('');
                  setUkuranSelect('');
                  setSearchInput('');
                  if (isSuperAdmin) {
                    setSelectedCabang('ALL');
                  } else if (currentUser?.branch) {
                    setSelectedCabang(currentUser.branch);
                  }
                  fetchStockData(1);
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
                <span>Cari Stok</span>
              </button>
            </div>
          </form>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
          {/* Card 1: Total Jenis Barang */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Jenis Barang
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mt-0.5">
                {summary.total_items.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">varian</span>
              </h3>
            </div>
          </div>

          {/* Card 2: Total Pcs Stok */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Pcs Stok Fisik
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-emerald-600 mt-0.5">
                {summary.total_stock.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">pcs</span>
              </h3>
            </div>
          </div>

          {/* Card 3: Status Pagination */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
              <Filter className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Halaman Terbuka
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mt-0.5">
                {pagination.page}{' '}
                <span className="text-xs font-normal text-slate-500">
                  dari {pagination.total_pages} hal (50 list/hal)
                </span>
              </h3>
            </div>
          </div>
        </div>

        {/* Main Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between print:hidden">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-slate-800">
                Daftar Stock Card General
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {pagination.total_items > 0
                ? `Menampilkan ${pagination.from_item} - ${pagination.to_item} dari ${pagination.total_items} data`
                : '0 data'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-emerald-600 text-white font-semibold border-b border-emerald-700 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 text-center w-16">No.</th>
                  <th className="py-3 px-4 text-center">Nama Barang (Tipe - Model - Ukuran)</th>
                  <th className="py-3 px-4 text-center w-40">Total QTY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="text-xs">Memuat data stok barang...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Package className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-medium text-slate-600">
                          Tidak ada data stok ditemukan
                        </span>
                        <span className="text-xs text-slate-400">
                          Coba sesuaikan filter tipe, model, atau ukuran.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={`${item.id_bahan}-${item.model}-${item.ukuran}-${item.row_num}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {item.row_num}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-800">
                        {item.nama_barang}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700 text-base">
                        {item.stock.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}

                {/* Grand Total Row Footer */}
                {items.length > 0 && (
                  <tr className="bg-emerald-700 text-white font-bold text-sm">
                    <td colSpan={2} className="py-3.5 px-4 text-right uppercase tracking-wider">
                      TOTAL QTY KESELURUHAN (ALL ITEMS)
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-lg font-extrabold text-white">
                      {summary.total_stock.toLocaleString('id-ID')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar (50 Items per page) */}
          {pagination.total_pages > 1 && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
              <div className="text-xs text-slate-600">
                Menampilkan <strong className="text-slate-800">{pagination.from_item}</strong> -{' '}
                <strong className="text-slate-800">{pagination.to_item}</strong> dari{' '}
                <strong className="text-slate-800">{pagination.total_items}</strong> total data stok
              </div>

              <div className="flex items-center space-x-1.5">
                {/* First Page */}
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                  title="Halaman Pertama"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Prev Page */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page Number Indicator */}
                <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-2xs">
                  {currentPage} / {pagination.total_pages}
                </span>

                {/* Next Page */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === pagination.total_pages || loading}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page */}
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
      </div>
    </DashboardLayout>
  );
}
