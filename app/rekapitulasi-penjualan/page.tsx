'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  FileText,
  Search,
  Printer,
  Calendar,
  User,
  RefreshCw,
  TrendingUp,
  Receipt,
  Filter,
  CheckCircle2,
  Clock,
  Coins,
  Package,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import { exportRekapitulasiPenjualanExcel } from '@/lib/excel-export-utils';

interface RekapItem {
  tgl_transaksi: string;
  tgl_jatuh_tempo: string;
  id_transaksi: string;
  id_customer: string;
  nama_customer: string;
  lusin: number;
  subtotal: number;
  diskon: number;
  total: number;
  status: string;
  akun: string;
}

interface SummaryData {
  total_transactions: number;
  grand_total: number;
  grand_diskon: number;
  grand_lusin: number;
}

interface OptionItem {
  id: string;
  name: string;
}

export default function RekapitulasiPenjualanPage() {
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [tglFrom, setTglFrom] = useState(getTodayDate());
  const [tglTo, setTglTo] = useState(getTodayDate());
  const [customerInput, setCustomerInput] = useState('');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [customerOptions, setCustomerOptions] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<RekapItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    total_transactions: 0,
    grand_total: 0,
    grand_diskon: 0,
    grand_lusin: 0,
  });

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

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

  // Fetch report data
  const handleFetchReport = async (e?: React.FormEvent, overrideCabang?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tgl_from: tglFrom,
        tgl_to: tglTo,
        supplier: customerInput,
      });

      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        params.append('cabang', branchVal);
      }

      const res = await fetch(`/api/rekapitulasi-penjualan?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setTransactions(json.data.transactions || []);
        setSummary(
          json.data.summary || {
            total_transactions: 0,
            grand_total: 0,
            grand_diskon: 0,
            grand_lusin: 0,
          }
        );
      } else {
        setTransactions([]);
        setSummary({
          total_transactions: 0,
          grand_total: 0,
          grand_diskon: 0,
          grand_lusin: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch customer options and user on load
  useEffect(() => {
    const initData = async () => {
      try {
        const [optRes, cRes, uRes] = await Promise.all([
          fetch('/api/rekapitulasi-penjualan?options=true'),
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        if (optRes.ok) {
          const json = await optRes.json();
          if (json.success && json.options) {
            setCustomerOptions(json.options.suppliers || []);
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
        console.error('Error fetching options/user:', err);
        handleFetchReport();
      }
    };
    initData();
  }, []);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    if (transactions.length === 0) {
      alert('Tidak ada data rekapitulasi penjualan untuk diexport.');
      return;
    }
    setIsExporting(true);
    try {
      await exportRekapitulasiPenjualanExcel({
        transactions,
        summary,
        tglFrom,
        tglTo,
        customer: customerInput,
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
        {/* Printable Header */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">LAPORAN REKAPITULASI PENJUALAN</h2>
          <p className="text-sm text-gray-600">
            Periode: {formatDateString(tglFrom)} S/D {formatDateString(tglTo)}
            {customerInput ? ` | Customer: ${customerInput}` : ''}
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
                Laporan Rekapitulasi Penjualan
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Rekapitulasi total omset penjualan, volume lusin, diskon, dan status tagihan customer.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting || loading || transactions.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download Excel Laporan Rekapitulasi Penjualan"
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
            <span>Filter Data Rekapitulasi</span>
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
            <div className="lg:col-span-4 space-y-1">
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
            <div className="lg:col-span-4 space-y-1">
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

            {/* Customer Filter */}
            <div className="lg:col-span-4 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Customer / Pelanggan
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="customer-list"
                  placeholder="Cari / Pilih Customer..."
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <datalist id="customer-list">
                  {customerOptions.map((c) => (
                    <option key={c.id} value={`${c.id} | ${c.name}`} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-12 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTglFrom(getTodayDate());
                  setTglTo(getTodayDate());
                  setCustomerInput('');
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
                <span>Cari Rekap</span>
              </button>
            </div>
          </form>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          {/* Card 1: Total Transaksi */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Transaksi
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5">
                {summary.total_transactions}{' '}
                <span className="text-xs font-normal text-slate-500">trx</span>
              </h3>
            </div>
          </div>

          {/* Card 2: Total Lusin */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Volume Lusin
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5">
                {summary.grand_lusin.toLocaleString('id-ID', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-normal text-slate-500">Lsn</span>
              </h3>
            </div>
          </div>

          {/* Card 3: Total Diskon */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Diskon Invoice
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5">
                {formatRupiah(summary.grand_diskon)}
              </h3>
            </div>
          </div>

          {/* Card 4: Grand Total Penjualan */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Grand Total Penjualan
              </p>
              <h3 className="text-xl font-bold text-emerald-600 mt-0.5">
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
                Data Rekapitulasi Penjualan
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
                  <th className="py-3 px-3 text-center w-28">Tanggal</th>
                  <th className="py-3 px-3 text-center w-28">Jatuh Tempo</th>
                  <th className="py-3 px-3 text-center min-w-[140px]">No. Transaksi</th>
                  <th className="py-3 px-3 text-left min-w-[180px]">Customer</th>
                  <th className="py-3 px-3 text-center w-24">Lusin</th>
                  <th className="py-3 px-3 text-right min-w-[110px]">Subtotal</th>
                  <th className="py-3 px-3 text-right min-w-[110px]">Diskon</th>
                  <th className="py-3 px-3 text-right min-w-[120px]">Total</th>
                  <th className="py-3 px-3 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="text-xs">Memuat rekapitulasi penjualan...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-medium text-slate-600">
                          Tidak ada data rekapitulasi penjualan
                        </span>
                        <span className="text-xs text-slate-400">
                          Coba ubah filter tanggal atau pencarian customer.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((trx, idx) => (
                    <tr key={trx.id_transaksi || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center font-medium text-slate-600">
                        {formatDateString(trx.tgl_transaksi)}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500">
                        {formatDateString(trx.tgl_jatuh_tempo)}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                        {trx.id_transaksi}
                      </td>
                      <td className="py-3 px-3 text-left font-medium text-slate-800">
                        <div>{trx.nama_customer}</div>
                        {trx.id_customer !== trx.nama_customer && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            [{trx.id_customer}]
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-800">
                        {trx.lusin.toLocaleString('id-ID', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatRupiah(trx.subtotal)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600">
                        {trx.diskon > 0 ? `-${formatRupiah(trx.diskon)}` : 'Rp 0'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatRupiah(trx.total)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {trx.status === 'Lunas' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Lunas</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Belum Lunas</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}

                {/* Grand Total Rows Footer - Flush Right Alignment */}
                {transactions.length > 0 && (
                  <>
                    <tr className="bg-slate-800 text-white font-bold text-xs md:text-sm">
                      <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-slate-300">
                        Grand Total Penjualan
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-right font-mono text-sm md:text-base font-extrabold text-emerald-300">
                        {formatRupiah(summary.grand_total)}
                      </td>
                    </tr>

                    <tr className="bg-slate-700 text-white font-semibold text-xs">
                      <td colSpan={7} className="py-2.5 px-4 text-right uppercase tracking-wider text-slate-300">
                        Grand Diskon
                      </td>
                      <td colSpan={2} className="py-2.5 px-4 text-right font-mono text-purple-300">
                        {formatRupiah(summary.grand_diskon)}
                      </td>
                    </tr>

                    <tr className="bg-emerald-800 text-white font-bold text-xs md:text-sm">
                      <td colSpan={7} className="py-3 px-4 text-right uppercase tracking-wider text-emerald-100">
                        Grand Volume Lusin
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-right font-mono text-white text-sm md:text-base font-extrabold">
                        {summary.grand_lusin.toLocaleString('id-ID', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        Lsn
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
