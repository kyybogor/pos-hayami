'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  FileText,
  Search,
  Printer,
  Calendar,
  User,
  Package,
  Eye,
  X,
  Filter,
  RefreshCw,
  TrendingUp,
  Receipt,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { exportLaporanBarangMasukExcel } from '@/lib/excel-export-utils';

interface ItemDetail {
  no_id: string;
  id_product: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  total: number;
}

interface TransactionData {
  id_transaksi: string;
  tgl_transaksi: string;
  id_supplier: string;
  nama_supplier: string;
  keterangan: string;
  id_cabang: string;
  ppn_percent: number;
  ppn_amount: number;
  subtotal: number;
  total_trx: number;
  total_items: number;
  items: ItemDetail[];
}

interface SummaryData {
  total_transactions: number;
  total_qty: number;
  grand_total: number;
}

interface OptionItem {
  id: string;
  name: string;
}

export default function LaporanBarangMasukPage() {
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [tglFrom, setTglFrom] = useState(getTodayDate());
  const [tglTo, setTglTo] = useState(getTodayDate());
  const [supplierInput, setSupplierInput] = useState('');
  const [bahanSelect, setBahanSelect] = useState('');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [suppliersOptions, setSuppliersOptions] = useState<OptionItem[]>([]);
  const [bahanOptions, setBahanOptions] = useState<OptionItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    total_transactions: 0,
    total_qty: 0,
    grand_total: 0,
  });

  // Selected transaction for Modal detail
  const [selectedTrx, setSelectedTrx] = useState<TransactionData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Format currency helpers
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDateString = (dateStr: string) => {
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

  // Fetch report data
  const handleFetchReport = async (e?: React.FormEvent, overrideCabang?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tgl_from: tglFrom,
        tgl_to: tglTo,
        supplier: supplierInput,
        bahan: bahanSelect,
      });

      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        params.append('cabang', branchVal);
      }

      const res = await fetch(`/api/laporan-barang-masuk?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setTransactions(json.data.transactions || []);
        setSummary(
          json.data.summary || {
            total_transactions: 0,
            total_qty: 0,
            grand_total: 0,
          }
        );
      } else {
        setTransactions([]);
        setSummary({ total_transactions: 0, total_qty: 0, grand_total: 0 });
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch filter options and user on load
  useEffect(() => {
    const initData = async () => {
      try {
        const [optRes, cRes, uRes] = await Promise.all([
          fetch('/api/laporan-barang-masuk?options=true'),
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        if (optRes.ok) {
          const json = await optRes.json();
          if (json.success && json.options) {
            setSuppliersOptions(json.options.suppliers || []);
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
        handleFetchReport(undefined, userBranch);
      } catch (err) {
        console.error('Error init user/options:', err);
        handleFetchReport();
      }
    };
    initData();
  }, []);

  const openDetailModal = (trx: TransactionData) => {
    setSelectedTrx(trx);
    setIsModalOpen(true);
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (transactions.length === 0) {
      alert('Tidak ada data barang masuk untuk diexport.');
      return;
    }
    setIsExporting(true);
    try {
      await exportLaporanBarangMasukExcel({
        transactions,
        summary,
        tglFrom,
        tglTo,
        supplier: supplierInput,
        bahan: bahanSelect,
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Gagal mengunduh file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Printable Header - hidden on screen, visible on print */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">LAPORAN BARANG MASUK</h2>
          <p className="text-sm text-gray-600">
            Periode: {formatDateString(tglFrom)} S/D {formatDateString(tglTo)}
            {supplierInput ? ` | Supplier: ${supplierInput}` : ''}
            {bahanSelect ? ` | Bahan: ${bahanSelect}` : ''}
          </p>
        </div>

        {/* Screen Top Title & Description */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Laporan Barang Masuk
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Rekapitulasi transaksi penerimaan barang masuk ke stok toko & gudang.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || loading || transactions.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download Excel Laporan Barang Masuk"
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
            <span>Filter Data Laporan</span>
          </div>

          <form onSubmit={handleFetchReport} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
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
                Dari Tanggal <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglFrom}
                  onChange={(e) => setTglFrom(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  required
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Tanggal To */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Sampai Tanggal <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglTo}
                  onChange={(e) => setTglTo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  required
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Customer / Supplier */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Supplier / Customer
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="supplier-list"
                  placeholder="Cari / Pilih Supplier..."
                  value={supplierInput}
                  onChange={(e) => setSupplierInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <datalist id="supplier-list">
                  {suppliersOptions.map((s) => (
                    <option key={s.id} value={`${s.id} | ${s.name}`} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Bahan / Product */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Bahan / Produk
              </label>
              <div className="relative">
                <select
                  value={bahanSelect}
                  onChange={(e) => setBahanSelect(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">-- Semua Bahan --</option>
                  {bahanOptions.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <Package className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-12 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTglFrom(getTodayDate());
                  setTglTo(getTodayDate());
                  setSupplierInput('');
                  setBahanSelect('');
                  const resetBranch = isSuperAdmin ? 'ALL' : (currentUser?.branch || '');
                  setSelectedCabang(resetBranch);
                  handleFetchReport(undefined, resetBranch);
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
                <span>Cari Laporan</span>
              </button>
            </div>
          </form>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:hidden">
          {/* Card 1: Total Transaksi */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Transaksi
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mt-0.5">
                {summary.total_transactions}{' '}
                <span className="text-xs font-normal text-slate-500">trx</span>
              </h3>
            </div>
          </div>

          {/* Card 2: Total Item Qty */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Qty Barang
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 mt-0.5">
                {summary.total_qty.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">pcs</span>
              </h3>
            </div>
          </div>

          {/* Card 3: Grand Total Rp */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Grand Total Nilai
              </p>
              <h3 className="text-xl md:text-2xl font-bold text-emerald-600 mt-0.5">
                {formatRupiah(summary.grand_total)}
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
                Data Rincian Barang Masuk
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Menampilkan {transactions.length} transaksi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 text-center w-28">Tanggal</th>
                  <th className="py-3 px-4 text-center min-w-[160px]">No. Transaksi & Supplier</th>
                  <th className="py-3 px-4 text-left min-w-[200px]">Nama Barang / ID</th>
                  <th className="py-3 px-4 text-center w-24">Ukuran</th>
                  <th className="py-3 px-4 text-right w-20">Qty</th>
                  <th className="py-3 px-4 text-center w-20">UOM</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Price</th>
                  <th className="py-3 px-4 text-right min-w-[130px]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="text-xs">Memuat data laporan...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-medium text-slate-600">
                          Tidak ada data barang masuk
                        </span>
                        <span className="text-xs text-slate-400">
                          Coba ubah filter tanggal atau kata kunci pencarian Anda.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((trx) => {
                    const displayedItems = trx.items.slice(0, 5);
                    const remainingCount = trx.items.length - 5;
                    const rowSpanCount = displayedItems.length + (remainingCount > 0 ? 1 : 0);

                    return (
                      <React.Fragment key={trx.id_transaksi}>
                        {/* Render items up to 5 */}
                        {displayedItems.map((item, idx) => (
                          <tr
                            key={item.no_id || `${trx.id_transaksi}-${idx}`}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Render transaction info on the FIRST row only using rowspan */}
                            {idx === 0 && (
                              <>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="py-3.5 px-4 text-center align-top font-medium text-slate-600 bg-slate-50/40 border-r border-slate-200/70"
                                >
                                  {formatDateString(trx.tgl_transaksi)}
                                </td>
                                <td
                                  rowSpan={rowSpanCount}
                                  className="py-3.5 px-4 text-center align-top bg-slate-50/40 border-r border-slate-200/70"
                                >
                                  <div className="font-semibold text-emerald-700">
                                    {trx.id_transaksi}
                                  </div>
                                  <div className="font-medium text-slate-800 mt-0.5">
                                    {trx.nama_supplier}
                                  </div>
                                  {trx.keterangan && (
                                    <div className="text-[11px] text-slate-400 mt-0.5 italic">
                                      {trx.keterangan}
                                    </div>
                                  )}
                                  <div className="mt-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                      {trx.total_items} Barang
                                    </span>
                                  </div>
                                </td>
                              </>
                            )}

                            {/* Item details */}
                            <td className="py-2.5 px-4 font-medium text-slate-800">
                              <span className="font-mono text-slate-600 mr-1.5 text-xs">
                                [{item.id_product}]
                              </span>
                              {item.model ? item.model : item.id_product}
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-600 font-mono">
                              {item.ukuran || '-'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                              {item.qty}
                            </td>
                            <td className="py-2.5 px-4 text-center text-xs text-slate-500 uppercase">
                              {item.uom}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                              {formatRupiah(item.harga)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800">
                              {formatRupiah(item.total)}
                            </td>
                          </tr>
                        ))}

                        {/* If items > 5, display button/badge row for viewing all items */}
                        {remainingCount > 0 && (
                          <tr className="bg-amber-50/50 hover:bg-amber-50 border-t border-amber-200/60">
                            <td colSpan={6} className="py-2 px-4">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-amber-800 font-medium">
                                  Menampilkan 5 dari {trx.items.length} barang (+{remainingCount} barang lagi)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openDetailModal(trx)}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center space-x-1 transition-all cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Lihat Detail Semua ({trx.items.length} Barang)</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Transaction Subtotal & PPN Row */}
                        <tr className="bg-slate-800 text-white font-semibold border-b-2 border-slate-300">
                          <td colSpan={5} className="py-2.5 px-4 text-right text-xs tracking-wide text-slate-300">
                            Subtotal: {formatRupiah(trx.subtotal)}
                            {trx.ppn_percent > 0 && (
                              <span className="ml-3 text-emerald-300">
                                (PPN {trx.ppn_percent}%: +{formatRupiah(trx.ppn_amount)})
                              </span>
                            )}
                          </td>
                          <td colSpan={1} className="py-2.5 px-4 text-right text-xs uppercase tracking-wider text-emerald-400 font-bold whitespace-nowrap">
                            TOTAL TRX
                          </td>
                          <td colSpan={2} className="py-2.5 px-4 text-right font-mono text-emerald-300 text-sm font-bold">
                            {formatRupiah(trx.total_trx)}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}

                {/* Grand Total Footer Row */}
                {transactions.length > 0 && (
                  <tr className="bg-emerald-700 text-white font-bold text-sm md:text-base">
                    <td colSpan={4} className="py-4 px-4 text-left font-extrabold uppercase tracking-wider">
                      GRAND TOTAL LAPORAN
                    </td>
                    <td colSpan={2} className="py-4 px-4 text-right font-mono text-xs md:text-sm font-medium text-emerald-100 whitespace-nowrap">
                      Total {summary.total_transactions} Trx | {summary.total_qty.toLocaleString('id-ID')} Pcs
                    </td>
                    <td colSpan={2} className="py-4 px-4 text-right font-mono text-base md:text-lg font-extrabold text-white tracking-tight">
                      {formatRupiah(summary.grand_total)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Popup for Viewing ALL Items in a Transaction */}
        {isModalOpen && selectedTrx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 print:hidden">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight">
                      Detail Transaksi #{selectedTrx.id_transaksi}
                    </h3>
                    <p className="text-xs text-slate-300">
                      Supplier: <strong className="text-white">{selectedTrx.nama_supplier}</strong> | Tanggal: {formatDateString(selectedTrx.tgl_transaksi)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Items Table */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span>
                    Jumlah Barang: <strong className="text-slate-900 font-bold">{selectedTrx.items.length} items</strong>
                  </span>
                  {selectedTrx.keterangan && (
                    <span>
                      Keterangan: <strong className="text-slate-800">{selectedTrx.keterangan}</strong>
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px]">
                        <th className="py-2.5 px-3 text-center w-10">No</th>
                        <th className="py-2.5 px-3">Kode / ID Barang</th>
                        <th className="py-2.5 px-3">Model</th>
                        <th className="py-2.5 px-3 text-center">Ukuran</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-center">UOM</th>
                        <th className="py-2.5 px-3 text-right">Harga</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedTrx.items.map((item, idx) => (
                        <tr key={item.no_id || idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.id_product}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {item.model || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.ukuran || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            {item.qty}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 uppercase text-xs">
                            {item.uom}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {formatRupiah(item.harga)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatRupiah(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pricing Summary Box */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs md:text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Barang ({selectedTrx.items.length} items):</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatRupiah(selectedTrx.subtotal)}
                    </span>
                  </div>
                  {selectedTrx.ppn_percent > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>PPN ({selectedTrx.ppn_percent}%):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        +{formatRupiah(selectedTrx.ppn_amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
                    <span>Total Transaksi:</span>
                    <span className="font-mono text-emerald-600">
                      {formatRupiah(selectedTrx.total_trx)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer"
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
