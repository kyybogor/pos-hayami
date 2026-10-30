'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Receipt,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Printer,
  Calendar,
  X,
  CreditCard,
  DollarSign,
  Briefcase,
  AlertCircle,
  FileText,
  RotateCcw,
  CloudUpload,
  CheckCircle2,
  WifiOff,
  AlertTriangle,
  Lock,
  Building2,
} from 'lucide-react';

interface BarangKeluarTx {
  id_transaksi: string;
  tgl_transaksi: string;
  tgl_jatuh_tempo: string;
  id_customer: string;
  nama_customer: string;
  keterangan: string;
  status_keluar: string;
  sisa_bayar: number;
  status: string;
  is_retur?: boolean;
  sales: string;
  akun: string;
  nama_akun: string;
  total_belanja: number;
}

interface TxDetailHeader {
  id_transaksi: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  keterangan: string;
  sales: string;
  akun: string;
  nama_akun: string;
  disc_invoice: number;
  diskon_lusin: number;
  status_keluar: string;
  status: string;
  cash: number;
  sisa_bayar: number;
}

interface TxDetailItem {
  no_id: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  subtotal: number;
}

export default function BarangKeluarPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<BarangKeluarTx[]>([]);
  const [summary, setSummary] = useState({
    totalCash: 0,
    totalDebet: 0,
    totalTransfer: 0,
    totalHutang: 0,
  });
  const [loading, setLoading] = useState(true);

  const getTodayString = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Filters (Default to Today's date)
  const [tglFrom, setTglFrom] = useState(getTodayString());
  const [tglTo, setTglTo] = useState(getTodayString());
  const [customerSearch, setCustomerSearch] = useState('');
  const [akunSearch, setAkunSearch] = useState('');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string; tipe?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const isOnlineUser = (currentUser?.tipe || '').toLowerCase() === 'online';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detail Modal
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [detailHeader, setDetailHeader] = useState<TxDetailHeader | null>(null);
  const [detailItems, setDetailItems] = useState<TxDetailItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Void/Delete confirmation modal
  const [voidTxId, setVoidTxId] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  // Closing Sync States
  const [showClosingConfirm, setShowClosingConfirm] = useState(false);
  const [isClosingLoading, setIsClosingLoading] = useState(false);
  const [closingModal, setClosingModal] = useState<{
    type: 'offline' | 'success' | 'error';
    title: string;
    message: string;
    details?: any[];
  } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOpenClosingModal = () => {
    if (isOnlineUser) return;
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setClosingModal({
        type: 'offline',
        title: 'Komputer Offline / Tidak Ada Internet',
        message: 'Silahkan hubungkan ke internet terlebih dahulu untuk melakukan closing!',
      });
      return;
    }
    setShowClosingConfirm(true);
  };

  const executeClosingSync = async () => {
    if (isOnlineUser) return;
    setShowClosingConfirm(false);
    setIsClosingLoading(true);

    try {
      if (typeof window !== 'undefined' && !navigator.onLine) {
        setIsClosingLoading(false);
        setClosingModal({
          type: 'offline',
          title: 'Koneksi Terputus',
          message: 'Silahkan hubungkan ke internet terlebih dahulu untuk melakukan closing!',
        });
        return;
      }

      const res = await fetch('/api/closing-sync', {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_auto_closing_timestamp', String(Date.now()));
        }
        setClosingModal({
          type: 'success',
          title: 'Closing Berhasil!',
          message: 'Proses closing harian & sinkronisasi data ke server online berhasil dilakukan.',
        });
        fetchTransactions();
      } else {
        setClosingModal({
          type: 'error',
          title: 'Closing Gagal (Koneksi Terputus / Error)',
          message:
            data.message ||
            'Gagal melakukan closing karena jaringan terputus atau koneksi buruk. Pengiriman dibatalkan sepenuhnya (0 data masuk). Silakan coba lagi.',
        });
      }
    } catch (err: any) {
      setClosingModal({
        type: 'error',
        title: 'Closing Gagal (Jaringan Terputus)',
        message:
          'Gagal melakukan closing karena jaringan terputus atau koneksi buruk. Pengiriman dibatalkan sepenuhnya (0 data masuk). Silakan coba lagi setelah jaringan stabil.',
      });
    } finally {
      setIsClosingLoading(false);
    }
  };

  // Load session & cabang
  useEffect(() => {
    try {
      const cached = localStorage.getItem('user');
      if (cached) {
        const u = JSON.parse(cached);
        setCurrentUser(u);
        const isSuper = (u.role || '').toLowerCase() === 'superadmin';
        if (!isSuper && u.branch) {
          setSelectedCabang(u.branch);
        }
      }
    } catch {}

    const initData = async () => {
      try {
        const [cRes, uRes] = await Promise.all([
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
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
              setSelectedCabang(uJson.user.branch);
            }
          }
        }
      } catch (e) {
        console.error('Error init user/cabang:', e);
      }
    };
    initData();
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tglFrom) params.append('tgl_from', tglFrom);
      if (tglTo) params.append('tgl_to', tglTo);
      if (customerSearch) params.append('customer', customerSearch);
      if (akunSearch) params.append('akun', akunSearch);
      if (selectedCabang && selectedCabang !== 'ALL') params.append('cabang', selectedCabang);

      const res = await fetch(`/api/barang-keluar?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTransactions(data.data || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        showToast('error', data.message || 'Gagal memuat data barang keluar.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, [tglFrom, tglTo, customerSearch, akunSearch, selectedCabang]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleResetFilter = () => {
    setTglFrom('');
    setTglTo('');
    setCustomerSearch('');
    setAkunSearch('');
    if (isSuperAdmin) {
      setSelectedCabang('ALL');
    } else if (currentUser?.branch) {
      setSelectedCabang(currentUser.branch);
    }
  };

  // Fetch transaction details
  const handleOpenDetail = async (id_transaksi: string) => {
    setSelectedTxId(id_transaksi);
    setLoadingDetail(true);
    setDetailHeader(null);
    setDetailItems([]);

    try {
      const res = await fetch(`/api/barang-keluar/${encodeURIComponent(id_transaksi)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setDetailHeader(data.data.header);
        setDetailItems(data.data.items || []);
      } else {
        showToast('error', data.message || 'Gagal mengambil detail transaksi.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat memuat detail.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Void / Delete transaction
  const handleConfirmVoid = async () => {
    if (!voidTxId) return;
    setIsVoiding(true);

    try {
      const res = await fetch('/api/barang-keluar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_transaksi: voidTxId }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', 'Invoice berhasil dihapus/void!');
        setVoidTxId(null);
        fetchTransactions();
      } else {
        showToast('error', data.message || 'Gagal menghapus invoice.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat void invoice.');
    } finally {
      setIsVoiding(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-3 text-sm font-medium transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <Receipt className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Page Header (Dengan Tombol Closing di Sebelah Kanan) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100/80">
              <Receipt className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Master Barang Keluar</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar riwayat transaksi barang keluar dan invoice penjualan
              </p>
            </div>
          </div>

          {/* Tombol Closing Hari Ini di Sebelah Kanan (Hanya untuk User Offline) */}
          {!isOnlineUser && (
            <button
              onClick={handleOpenClosingModal}
              disabled={isClosingLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white rounded-xl shadow-md hover:shadow-lg font-bold text-xs flex items-center space-x-2 transition-all duration-200 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isClosingLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <CloudUpload className="w-4 h-4 text-white" />
              )}
              <span>{isClosingLoading ? 'Memproses Closing...' : 'Proses Closing Hari Ini'}</span>
            </button>
          )}
        </div>


        {/* Filter Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Tgl From */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Dari Tanggal</label>
              <div className="relative">
                <input
                  type="date"
                  value={tglFrom}
                  onChange={(e) => setTglFrom(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Tgl To */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Sampai Tanggal</label>
              <div className="relative">
                <input
                  type="date"
                  value={tglTo}
                  onChange={(e) => setTglTo(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Customer Search */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Customer</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari Customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Akun Search */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Metode / Akun</label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari Akun (CASH, HUTANG, dll)..."
                  value={akunSearch}
                  onChange={(e) => setAkunSearch(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Filter Cabang Toko - Superadmin Only */}
            {isSuperAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cabang Toko</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <select
                    value={selectedCabang}
                    onChange={(e) => setSelectedCabang(e.target.value)}
                    className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="ALL">-- Semua Cabang --</option>
                    {cabangOptions.map((c) => (
                      <option key={c.id_cabang} value={c.nama_cabang}>
                        {c.nama_cabang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleResetFilter}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
            <button
              onClick={fetchTransactions}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cari Data</span>
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 text-center">No. Transaksi</th>
                  <th className="py-3.5 px-4 text-center">Tgl Faktur</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Keterangan</th>
                  <th className="py-3.5 px-4 text-center">Akun</th>
                  <th className="py-3.5 px-4 text-right">Total Belanja</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <span>Memuat data transaksi...</span>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <span>Tidak ada transaksi barang keluar ditemukan.</span>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id_transaksi} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {tx.id_transaksi}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600">
                        {formatDate(tx.tgl_transaksi)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {tx.nama_customer}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {tx.keterangan || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {tx.nama_akun || tx.akun}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(tx.total_belanja)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {tx.status === 'Retur' || tx.is_retur ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-bold">
                            <RotateCcw className="w-3 h-3" />
                            <span>Retur</span>
                          </span>
                        ) : tx.status === 'Belum Lunas' ? (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                            Belum Lunas
                          </span>
                        ) : tx.status === 'Lunas' ? (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            Lunas
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                            {tx.status_keluar === 's' ? 'Close' : 'Draft'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenDetail(tx.id_transaksi)}
                            title="Lihat Detail"
                            className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setVoidTxId(tx.id_transaksi)}
                            title="Hapus Invoice"
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Totals Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500">Total Cash</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrency(summary.totalCash)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500">Total Debet</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrency(summary.totalDebet)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500">Total Transfer</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrency(summary.totalTransfer)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-xs font-semibold text-slate-500">Total Hutang</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrency(summary.totalHutang)}
              </span>
            </div>
          </div>
        </div>

        {/* DETAIL MODAL */}
        {selectedTxId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Detail Invoice: {selectedTxId}
                  </h3>
                  {detailHeader && (
                    <p className="text-xs text-slate-500">
                      Customer: <span className="font-semibold text-slate-700">{detailHeader.nama_customer}</span> | Tgl: {formatDate(detailHeader.tgl_transaksi)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTxId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {loadingDetail ? (
                  <div className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                    <span>Memuat detail barang...</span>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <span className="block text-slate-400">Keterangan</span>
                        <span className="font-semibold text-slate-800">{detailHeader?.keterangan || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Pembayaran / Akun</span>
                        <span className="font-semibold text-slate-800">{detailHeader?.nama_akun || detailHeader?.akun}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Status</span>
                        <span className="font-semibold text-slate-800">{detailHeader?.status || (detailHeader?.status_keluar === 's' ? 'Close' : 'Draft')}</span>
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-3">Barang / Model</th>
                            <th className="py-2.5 px-3 text-center">Ukuran</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-center">UOM</th>
                            <th className="py-2.5 px-3 text-right">Harga</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {detailItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {item.id_bahan} - {item.model}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                                {item.ukuran}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                                {item.qty}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-500">
                                {item.uom}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {formatCurrency(item.harga)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                {formatCurrency(item.subtotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.open(`/print/invoice?id_transaksi=${encodeURIComponent(selectedTxId || '')}`, '_blank')}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Invoice</span>
                  </button>
                  <button
                    onClick={() => window.open(`/print/sj?id_transaksi=${encodeURIComponent(selectedTxId || '')}`, '_blank')}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Print SJ</span>
                  </button>
                  <button
                    onClick={() => router.push(`/retur-barang?invoice=${encodeURIComponent(selectedTxId || '')}`)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Retur Barang</span>
                  </button>
                </div>

                <button
                  onClick={() => setSelectedTxId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-all"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE / VOID MODAL */}
        {voidTxId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Hapus / Void Invoice?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Anda yakin ingin menghapus invoice <span className="font-bold text-slate-700">{voidTxId}</span>? Stok barang akan dikembalikan ke database.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={() => setVoidTxId(null)}
                  disabled={isVoiding}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmVoid}
                  disabled={isVoiding}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all flex items-center space-x-1.5"
                >
                  {isVoiding && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isVoiding ? 'Menghapus...' : 'Ya, Hapus'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CLOSING CONFIRMATION MODAL */}
        {showClosingConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CloudUpload className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Konfirmasi Closing Harian</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin melakukan <strong>Closing & Sinkronisasi</strong>
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setShowClosingConfirm(false)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={executeClosingSync}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>Ya, Closing Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CLOSING LOADING SPINNER MODAL */}
        {isClosingLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Sedang Memproses Closing...</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Mengunggah seluruh data tabel ke server online. Mohon jangan tutup halaman ini.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CLOSING STATUS / OFFLINE / RESULT POPUP MODAL */}
        {closingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4 relative">
              <button
                onClick={() => setClosingModal(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {closingModal.type === 'success' && (
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              )}

              {closingModal.type === 'offline' && (
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                  <WifiOff className="w-7 h-7" />
                </div>
              )}

              {closingModal.type === 'error' && (
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                  <AlertTriangle className="w-7 h-7" />
                </div>
              )}

              <div>
                <h3
                  className={`text-lg font-bold ${
                    closingModal.type === 'success'
                      ? 'text-emerald-800'
                      : closingModal.type === 'offline'
                      ? 'text-amber-800'
                      : 'text-rose-800'
                  }`}
                >
                  {closingModal.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {closingModal.message}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setClosingModal(null)}
                  className={`w-full py-2.5 px-4 text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer ${
                    closingModal.type === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : closingModal.type === 'offline'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Mengerti / OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>

  );
}
