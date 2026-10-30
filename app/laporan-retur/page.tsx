'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
import {
  RotateCcw,
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
  Package,
  ArrowDownRight,
  Building2,
  DollarSign,
  FileSpreadsheet,
} from 'lucide-react';
import { exportLaporanReturExcel } from '@/lib/excel-export-utils';

interface ReturItemDetail {
  no_id: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  nama_barang: string;
  qty: number;
  uom: string;
  harga: number;
  total: number;
}

interface ReturTransaction {
  id_transaksi: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  is_retur_gudang: boolean;
  subtotal: number;
  ppn_percent: number;
  ppn_amount: number;
  total: number;
  item_count: number;
  items: ReturItemDetail[];
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
  total_qty: number;
  total_retur_customer: number;
  total_retur_gudang: number;
  grand_total_retur: number;
}

interface CustomerOption {
  id: string;
  nama: string;
}

export default function LaporanReturPage() {
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [customerSelect, setCustomerSelect] = useState('');
  const [bahanSelect, setBahanSelect] = useState('');

  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [bahanOptions, setBahanOptions] = useState<string[]>([]);

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<ReturTransaction[]>([]);
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
    total_qty: 0,
    total_retur_customer: 0,
    total_retur_gudang: 0,
    grand_total_retur: 0,
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

  // Fetch dropdown options and user on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const [optRes, cRes, uRes] = await Promise.all([
          fetch('/api/laporan-retur?options=true'),
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        if (optRes.ok) {
          const json = await optRes.json();
          if (json.success && json.options) {
            setCustomerOptions(json.options.customers || []);
            setBahanOptions(json.options.bahan || []);
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
        fetchReturData(1, undefined, userBranch);
      } catch (err) {
        console.error('Error init options/user:', err);
        fetchReturData(1);
      }
    };
    initData();
  }, []);

  // Fetch Retur Report Data
  const fetchReturData = async (targetPage = 1, e?: React.FormEvent, overrideCabang?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tgl_from: tglFrom,
        tgl_to: tglTo,
        customer: customerSelect,
        bahan: bahanSelect,
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        params.append('cabang', branchVal);
      }

      const res = await fetch(`/api/laporan-retur?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setTransactions(json.data.items || []);
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
            total_qty: 0,
            total_retur_customer: 0,
            total_retur_gudang: 0,
            grand_total_retur: 0,
          }
        );
        setCurrentPage(targetPage);
      } else {
        setTransactions([]);
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
          total_qty: 0,
          total_retur_customer: 0,
          total_retur_gudang: 0,
          grand_total_retur: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching retur data:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturData(1);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReturData(1, e);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages && newPage !== currentPage) {
      fetchReturData(newPage);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (transactions.length === 0) {
      alert('Tidak ada data laporan retur untuk diexport.');
      return;
    }
    setIsExporting(true);
    try {
      let exportTransactions = transactions;
      let exportSummary = summary;

      if (pagination.total_pages > 1) {
        const params = new URLSearchParams({
          tgl_from: tglFrom,
          tgl_to: tglTo,
          customer: customerSelect,
          bahan: bahanSelect,
          page: '1',
          limit: '99999',
        });
        const res = await fetch(`/api/laporan-retur?${params.toString()}`);
        const json = await res.json();
        if (json.success && json.data) {
          exportTransactions = json.data.items || transactions;
          exportSummary = json.data.summary || summary;
        }
      }

      await exportLaporanReturExcel({
        transactions: exportTransactions,
        summary: exportSummary,
        tglFrom,
        tglTo,
        customer: customerSelect,
        bahan: bahanSelect,
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

  const bahanSelectOptions: SelectOption[] = [
    { value: '', label: '-- Semua Bahan / Tipe --' },
    ...bahanOptions.map((b) => ({ value: b, label: b })),
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Printable Header */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">LAPORAN RETUR</h2>
          <p className="text-sm text-gray-600">
            {tglFrom || tglTo
              ? `Periode: ${formatDateString(tglFrom)} S/D ${formatDateString(tglTo)}`
              : 'Semua Periode Retur'}
            {customerSelect ? ` | Customer: ${customerSelect}` : ''}
            {bahanSelect ? ` | Bahan: ${bahanSelect}` : ''}
          </p>
        </div>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Laporan Retur
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Rekapitulasi transaksi retur barang (Retur Customer dan Retur Gudang).
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || loading || transactions.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download Excel Laporan Retur"
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
            <span>Filter Periode & Produk</span>
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
            <div className="lg:col-span-3 space-y-1">
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
            <div className="lg:col-span-3 space-y-1">
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
            <div className="lg:col-span-3">
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

            {/* Bahan / Tipe Filter */}
            <div className="lg:col-span-3">
              <SearchableSelect
                label="Bahan / Tipe"
                options={bahanSelectOptions}
                value={bahanSelect}
                onChange={setBahanSelect}
                placeholder="-- Semua Bahan --"
                searchPlaceholder="Ketik cari bahan..."
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
                  setBahanSelect('');
                  const resetBranch = isSuperAdmin ? 'ALL' : (currentUser?.branch || '');
                  setSelectedCabang(resetBranch);
                  fetchReturData(1, undefined, resetBranch);
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
                <span>Cari Retur</span>
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
              <span>Jumlah Transaksi</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.total_transaksi}{' '}
              <span className="text-xs font-normal text-slate-500">nota</span>
            </div>
          </div>

          {/* Card 2: Total Qty */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>Total Qty Retur</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.total_qty.toLocaleString('id-ID')}{' '}
              <span className="text-xs font-normal text-slate-500">pcs</span>
            </div>
          </div>

          {/* Card 3: Retur Customer */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Retur Customer</span>
            </div>
            <div className="text-xl font-bold text-emerald-700">
              {formatCurrency(summary.total_retur_customer)}
            </div>
          </div>

          {/* Card 4: Retur Gudang */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>Retur Gudang</span>
            </div>
            <div className="text-xl font-bold text-amber-700">
              {formatCurrency(summary.total_retur_gudang)}
            </div>
          </div>

          {/* Card 5: Grand Total Retur */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs bg-slate-50/50">
            <div className="flex items-center space-x-2 text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
              <DollarSign className="w-4 h-4 text-slate-800" />
              <span>Grand Total Retur</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {formatCurrency(summary.grand_total_retur)}
            </div>
          </div>
        </div>

        {/* Transactions Retur List */}
        <div className="space-y-6">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="flex flex-col items-center justify-center space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-sm font-medium">Memuat data laporan retur...</span>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="flex flex-col items-center justify-center space-y-1">
                <RotateCcw className="w-10 h-10 text-slate-300" />
                <span className="text-base font-medium text-slate-700">
                  Tidak ada data laporan retur ditemukan
                </span>
                <span className="text-xs text-slate-400">
                  Coba atur ulang tanggal atau pilih filter customer/bahan lain.
                </span>
              </div>
            </div>
          ) : (
            transactions.map((trx, idx) => (
              <div
                key={`${trx.id_transaksi}-${idx}`}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
              >
                {/* Transaction Card Header */}
                <div className="px-5 py-3.5 bg-slate-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                        {trx.id_transaksi}
                      </span>
                      {trx.is_retur_gudang ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          RETUR GUDANG
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          RETUR CUSTOMER
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 mt-1 text-xs text-slate-300">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateString(trx.tgl_transaksi)}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center space-x-1 font-medium text-white">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{trx.nama_customer}</span>
                      </span>
                    </div>
                  </div>

                  {/* Transaction Total Summary Badge */}
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-slate-300">
                      Item: <strong className="text-white">{trx.item_count}</strong>
                    </span>
                    <span className="px-3 py-1 bg-emerald-600 rounded-lg text-white font-bold shadow-xs">
                      Total Retur: {formatCurrency(trx.total)}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                        <th className="py-2.5 px-4 text-left min-w-[200px]">Nama Barang (Tipe & Model)</th>
                        <th className="py-2.5 px-4 text-center w-28">Ukuran</th>
                        <th className="py-2.5 px-4 text-right w-24">Qty</th>
                        <th className="py-2.5 px-4 text-center w-20">UOM</th>
                        <th className="py-2.5 px-4 text-right w-32">Harga</th>
                        <th className="py-2.5 px-4 text-right min-w-[130px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 text-slate-700">
                      {trx.items.map((item, itemIdx) => (
                        <tr key={`${item.no_id}-${itemIdx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4 text-left font-medium text-slate-800">
                            {item.nama_barang}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.ukuran}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                            {item.qty}
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-500 font-medium">
                            {item.uom}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                            {formatCurrency(item.harga)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700 bg-slate-50/50">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Footer Row for Transaction */}
                    <tfoot>
                      <tr className="bg-slate-100/90 font-bold text-xs text-slate-800 border-t border-slate-200">
                        <td colSpan={4} className="py-2 px-4 text-right uppercase tracking-wider text-slate-500">
                          Total Nota {trx.id_transaksi}
                        </td>
                        <td className="py-2 px-4 text-right text-slate-500 font-normal">
                          {trx.ppn_percent > 0 ? `+PPN (${trx.ppn_percent}%)` : ''}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-slate-900 text-sm">
                          {formatCurrency(trx.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary Footer Card */}
        {!loading && transactions.length > 0 && (
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-3 print:bg-white print:text-black print:border print:border-black">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 pb-2">
              Ringkasan Rekapitulasi Laporan Retur
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-medium">
              <div className="flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                <span className="text-slate-300">Total Retur Customer:</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  {formatCurrency(summary.total_retur_customer)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                <span className="text-slate-300">Total Retur Gudang:</span>
                <span className="font-mono font-bold text-amber-400 text-base">
                  {formatCurrency(summary.total_retur_gudang)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-emerald-950/60 p-3 rounded-xl border border-emerald-600/40">
                <span className="text-emerald-200 font-bold">Grand Total Retur:</span>
                <span className="font-mono font-bold text-white text-lg">
                  {formatCurrency(summary.grand_total_retur)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.total_pages > 1 && (
          <div className="px-5 py-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="text-xs text-slate-600">
              Menampilkan <strong className="text-slate-800">{pagination.from_item}</strong> -{' '}
              <strong className="text-slate-800">{pagination.to_item}</strong> dari{' '}
              <strong className="text-slate-800">{pagination.total_items}</strong> transaksi retur
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
