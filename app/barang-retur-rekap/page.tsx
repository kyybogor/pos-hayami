'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
import {
  Receipt,
  Search,
  Printer,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Layers,
  User,
  CheckCircle2,
  AlertCircle,
  Tag,
  DollarSign,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { exportBarangReturRekapExcel } from '@/lib/excel-export-utils';

interface ReturRekapItem {
  id_transaksi: string;
  tgl_transaksi: string;
  tgl_jatuh_tempo: string;
  id_customer: string;
  nama_customer: string;
  lusin: number;
  subtotal: number;
  diskon: number;
  total: number;
  status: string;
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
  total_transaksi: number;
  grand_lusin: number;
  grand_subtotal: number;
  grand_diskon: number;
  grand_total: number;
}

interface CustomerOption {
  id: string;
  nama: string;
}

export default function BarangReturRekapPage() {
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [customerSelect, setCustomerSelect] = useState('');

  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReturRekapItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: itemsPerPage,
    total_items: 0,
    total_pages: 1,
    from_item: 0,
    to_item: 0,
  });

  const [summary, setSummary] = useState<SummaryData>({
    total_transaksi: 0,
    grand_lusin: 0,
    grand_subtotal: 0,
    grand_diskon: 0,
    grand_total: 0,
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

  // Fetch Retur Rekap Data
  const fetchRekapData = async (targetPage = 1, e?: React.FormEvent, overrideCabang?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tgl_from: tglFrom,
        tgl_to: tglTo,
        customer: customerSelect,
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        params.append('cabang', branchVal);
      }

      const res = await fetch(`/api/barang-retur-rekap?${params.toString()}`);
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
            total_transaksi: 0,
            grand_lusin: 0,
            grand_subtotal: 0,
            grand_diskon: 0,
            grand_total: 0,
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
          total_transaksi: 0,
          grand_lusin: 0,
          grand_subtotal: 0,
          grand_diskon: 0,
          grand_total: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching retur rekap data:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch customer options and user on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const [optRes, cRes, uRes] = await Promise.all([
          fetch('/api/barang-retur-rekap?options=true'),
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        if (optRes.ok) {
          const json = await optRes.json();
          if (json.success && json.options?.customers) {
            setCustomerOptions(json.options.customers);
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
        fetchRekapData(1, undefined, userBranch);
      } catch (err) {
        console.error('Error init options/user:', err);
        fetchRekapData(1);
      }
    };
    initData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRekapData(1, e);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages && newPage !== currentPage) {
      fetchRekapData(newPage);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (items.length === 0) {
      alert('Tidak ada data rekapitulasi retur untuk diexport.');
      return;
    }
    setIsExporting(true);
    try {
      let exportItems = items;
      let exportSummary = summary;

      if (pagination.total_pages > 1) {
        const params = new URLSearchParams({
          tgl_from: tglFrom,
          tgl_to: tglTo,
          customer: customerSelect,
          page: '1',
          limit: '99999',
        });
        const res = await fetch(`/api/barang-retur-rekap?${params.toString()}`);
        const json = await res.json();
        if (json.success && json.data) {
          exportItems = json.data.items || items;
          exportSummary = json.data.summary || summary;
        }
      }

      await exportBarangReturRekapExcel({
        items: exportItems,
        summary: exportSummary,
        tglFrom,
        tglTo,
        customer: customerSelect,
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengunduh file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const custSelectOptions: SelectOption[] = [
    { value: '', label: '-- Semua Customer --' },
    ...customerOptions.map((c) => ({
      value: c.id,
      label: `${c.nama} (${c.id})`,
    })),
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Printable Header */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">LAPORAN REKAPITULASI RETUR</h2>
          <p className="text-sm text-gray-600">
            {tglFrom || tglTo
              ? `Periode: ${formatDateString(tglFrom)} S/D ${formatDateString(tglTo)}`
              : 'Semua Periode Retur'}
            {customerSelect ? ` | Customer: ${customerSelect}` : ''}
          </p>
        </div>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Receipt className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Laporan Rekapitulasi Retur
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Rekapitulasi total lusin, subtotal, diskon, dan grand total nota transaksi retur barang.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || loading || items.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download Excel Laporan Rekapitulasi Retur"
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
            <span>Filter Tanggal & Customer</span>
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

            {/* Tanggal From */}
            <div className="lg:col-span-4 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Dari Tanggal
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglFrom}
                  onChange={(e) => setTglFrom(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Tanggal To */}
            <div className="lg:col-span-4 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Sampai Tanggal
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglTo}
                  onChange={(e) => setTglTo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Customer Filter */}
            <div className="lg:col-span-4">
              <SearchableSelect
                label="Pilih Customer"
                options={custSelectOptions}
                value={customerSelect}
                onChange={setCustomerSelect}
                placeholder="-- Semua Customer --"
                searchPlaceholder="Ketik nama / ID customer..."
                searchable={true}
              />
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-12 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTglFrom('');
                  setTglTo('');
                  setCustomerSelect('');
                  const resetBranch = isSuperAdmin ? 'ALL' : (currentUser?.branch || '');
                  setSelectedCabang(resetBranch);
                  fetchRekapData(1, undefined, resetBranch);
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
                <span>Cari Rekap</span>
              </button>
            </div>
          </form>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 print:hidden">
          {/* Card 1: Total Transaksi */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Jumlah Nota</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.total_transaksi}{' '}
              <span className="text-xs font-normal text-slate-500">nota</span>
            </div>
          </div>

          {/* Card 2: Grand Lusin */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Grand Lusin</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.grand_lusin.toLocaleString('id-ID', { maximumFractionDigits: 2 })}{' '}
              <span className="text-xs font-normal text-slate-500">lsn</span>
            </div>
          </div>

          {/* Card 3: Grand Subtotal */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <DollarSign className="w-4 h-4 text-slate-600" />
              <span>Grand Subtotal</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {formatCurrency(summary.grand_subtotal)}
            </div>
          </div>

          {/* Card 4: Grand Diskon */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-rose-600 text-xs font-semibold uppercase tracking-wider mb-1">
              <Tag className="w-4 h-4" />
              <span>Grand Diskon</span>
            </div>
            <div className="text-xl font-bold text-rose-600">
              {formatCurrency(summary.grand_diskon)}
            </div>
          </div>

          {/* Card 5: Grand Total Retur */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <div className="flex items-center space-x-2 text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-1">
              <Receipt className="w-4 h-4" />
              <span>Grand Total Retur</span>
            </div>
            <div className="text-xl font-bold text-emerald-700">
              {formatCurrency(summary.grand_total)}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-800 text-white font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 text-center w-28">Tanggal</th>
                  <th className="py-3 px-4 text-center w-28">Tagihan</th>
                  <th className="py-3 px-4 text-center min-w-[150px]">No. Transaksi</th>
                  <th className="py-3 px-4 text-left min-w-[180px]">Customer</th>
                  <th className="py-3 px-4 text-center w-24">Lusin</th>
                  <th className="py-3 px-4 text-right min-w-[130px]">Subtotal</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Diskon</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Total</th>
                  <th className="py-3 px-4 text-center w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                        <span className="text-sm font-medium">Memuat data rekapitulasi retur...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Receipt className="w-10 h-10 text-slate-300" />
                        <span className="text-base font-medium text-slate-700">
                          Tidak ada data rekapitulasi retur ditemukan
                        </span>
                        <span className="text-xs text-slate-400">
                          Coba atur filter tanggal atau pilih customer lain.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => (
                    <tr key={`${row.id_transaksi}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {formatDateString(row.tgl_transaksi)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {formatDateString(row.tgl_jatuh_tempo)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">
                        {row.id_transaksi}
                      </td>
                      <td className="py-3 px-4 text-left font-medium text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{row.nama_customer}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {row.lusin.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {formatCurrency(row.subtotal)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600">
                        {row.diskon > 0 ? formatCurrency(row.diskon) : '0'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-slate-50/50">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.status === 'Lunas' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Lunas
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Belum Lunas
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Grand Totals Footer */}
              {!loading && items.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold text-xs md:text-sm">
                    <td colSpan={4} className="py-3.5 px-4 text-right uppercase tracking-wider text-slate-300">
                      Grand Total ({summary.total_transaksi} Nota)
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-emerald-300">
                      {summary.grand_lusin.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Lsn
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-200">
                      {formatCurrency(summary.grand_subtotal)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-rose-300">
                      {formatCurrency(summary.grand_diskon)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-white text-base">
                      {formatCurrency(summary.grand_total)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-normal">
                      -
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Pagination Bar */}
        {pagination.total_pages > 1 && (
          <div className="px-5 py-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="text-xs text-slate-600">
              Menampilkan <strong className="text-slate-800">{pagination.from_item}</strong> -{' '}
              <strong className="text-slate-800">{pagination.to_item}</strong> dari{' '}
              <strong className="text-slate-800">{pagination.total_items}</strong> nota retur
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
