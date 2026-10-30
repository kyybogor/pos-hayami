'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Truck,
  Search,
  RefreshCw,
  Edit,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Calendar,
  X,
  Package,
  Building2,
} from 'lucide-react';

interface BarangItem {
  no_id: string;
  id_product: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  subtotal: number;
  image?: string;
}

interface BarangMasukTransaction {
  id_transaksi: string;
  tgl_transaksi: string;
  id_supplier: string;
  nama_supplier: string;
  status: string; // 'd' = Draft, 's' = Close
  keterangan: string;
  status_lunas: number;
  jenis: string;
  items: BarangItem[];
}

export default function BarangMasukOfflinePage() {
  const [transactions, setTransactions] = useState<BarangMasukTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [invKeyword, setInvKeyword] = useState('');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Modal State for viewing all items popup
  const [selectedTx, setSelectedTx] = useState<BarangMasukTransaction | null>(null);

  // Toast alert
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const formatDateStr = (dateStr?: string) => {
    if (!dateStr) return '-';
    const clean = String(dateStr).trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID');
    } catch {
      return dateStr;
    }
  };

  // Load session & cabang
  useEffect(() => {
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
      if (tglFrom && tglTo) {
        params.append('tgl_from', tglFrom);
        params.append('tgl_to', tglTo);
      }
      if (invKeyword) {
        params.append('inv', invKeyword);
      }
      if (selectedCabang && selectedCabang !== 'ALL') {
        params.append('cabang', selectedCabang);
      }

      const res = await fetch(`/api/barang-masuk-offline?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTransactions(data.data || []);
      } else {
        showToast('error', data.message || 'Gagal memuat data barang masuk.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke database.');
    } finally {
      setLoading(false);
    }
  }, [tglFrom, tglTo, invKeyword, selectedCabang]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleResetFilter = () => {
    setTglFrom('');
    setTglTo('');
    setInvKeyword('');
    if (isSuperAdmin) {
      setSelectedCabang('ALL');
    } else if (currentUser?.branch) {
      setSelectedCabang(currentUser.branch);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toast Notification Alert */}
        {toast && (
          <div
            className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Barang Masuk</h1>
              <p className="text-xs text-slate-500">
                Penerimaan dan otorisasi stok barang fisik / offline ke gudang POS
              </p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchTransactions();
            }}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Tanggal:</span>
              </div>
              <input
                type="date"
                value={tglFrom}
                onChange={(e) => setTglFrom(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-400 font-semibold">s/d</span>
              <input
                type="date"
                value={tglTo}
                onChange={(e) => setTglTo(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <input
                type="text"
                placeholder="No. Invoice / Keterangan..."
                value={invKeyword}
                onChange={(e) => setInvKeyword(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-64"
              />

              {/* Filter Cabang Toko - Superadmin Only */}
              {isSuperAdmin && (
                <div className="flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <select
                    value={selectedCabang}
                    onChange={(e) => setSelectedCabang(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

              <button
                type="submit"
                className="inline-flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>

              {(tglFrom || tglTo || invKeyword) && (
                <button
                  type="button"
                  onClick={handleResetFilter}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={fetchTransactions}
              className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 text-xs font-medium"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
          </form>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">No. Transaksi</th>
                  <th className="py-3.5 px-4">Tgl Transaksi</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 min-w-[280px]">Barang</th>
                  <th className="py-3.5 px-4 max-w-[200px]">Keterangan</th>
                  <th className="py-3.5 px-4 text-center">Status Lunas</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs">Memuat Data Barang Masuk...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <Layers className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Belum ada transaksi barang masuk</p>
                        <p className="text-xs text-slate-400">
                          {invKeyword || tglFrom ? 'Coba ubah kata kunci pencarian' : 'Tidak ada data transaksi barang masuk'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isDraft = tx.status === 'd';
                    const visibleItems = tx.items.slice(0, 5);
                    const extraItemsCount = tx.items.length - 5;

                    return (
                      <tr key={tx.id_transaksi} className="hover:bg-slate-50/80 transition-colors align-top">
                        {/* No. Transaksi */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900 font-mono text-xs whitespace-nowrap">
                          {tx.id_transaksi}
                        </td>

                        {/* Tgl Transaksi */}
                        <td className="py-3.5 px-4 text-slate-700 font-mono text-xs whitespace-nowrap">
                          {formatDateStr(tx.tgl_transaksi)}
                        </td>

                        {/* Supplier */}
                        <td className="py-3.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                          {tx.nama_supplier}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isDraft ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[11px]">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Draft</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-rose-600" />
                              <span>Close</span>
                            </span>
                          )}
                        </td>

                        {/* Barang (First 5 items + Popup Trigger for Extra) */}
                        <td className="py-3.5 px-4">
                          {tx.items.length === 0 ? (
                            <span className="text-slate-400 italic">(Tidak ada barang)</span>
                          ) : (
                            <div className="space-y-1">
                              <ul className="space-y-1 list-disc list-inside text-slate-700">
                                {visibleItems.map((it, idx) => (
                                  <li key={idx} className="leading-tight flex items-center space-x-1.5 py-0.5">
                                    {it.image && (
                                      <img
                                        src={it.image}
                                        alt=""
                                        className="w-5 h-5 rounded object-cover border border-slate-200 shrink-0"
                                      />
                                    )}
                                    <span>
                                      <span className="font-semibold text-slate-900">{it.id_product}</span>
                                      {it.model && <span className="text-slate-600"> - {it.model}</span>}
                                      {it.ukuran && <span className="text-slate-600"> {it.ukuran}</span>}
                                      <span className="font-mono text-emerald-700 font-bold ml-1">
                                        x {it.qty} {it.uom}
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              {extraItemsCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedTx(tx)}
                                  className="inline-flex items-center space-x-1 mt-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>+ {extraItemsCount} Barang Lagi (Lihat Semua)</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Keterangan */}
                        <td className="py-3.5 px-4 text-slate-700 text-xs whitespace-normal break-words max-w-[240px] leading-relaxed font-mono">
                          {tx.keterangan || '-'}
                        </td>

                        {/* Status Lunas */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {tx.status_lunas === 1 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                              Lunas
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-[10px]">
                              Belum Lunas
                            </span>
                          )}
                        </td>

                        {/* Aksi (Only Ubah or Lihat, NO Hapus button) */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {isDraft ? (
                              <Link
                                href={`/barang-masuk-offline/edit?id_transaksi=${encodeURIComponent(tx.id_transaksi)}`}
                                className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Ubah</span>
                              </Link>
                            ) : (
                              <Link
                                href={`/barang-masuk-offline/edit?id_transaksi=${encodeURIComponent(tx.id_transaksi)}&detail=view`}
                                className="inline-flex items-center space-x-1 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Popup: View All Barang Items */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Daftar Barang Masuk</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      No. Transaksi: <span className="font-bold text-slate-800">{selectedTx.id_transaksi}</span> ({selectedTx.items.length} Barang)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Items Table */}
              <div className="p-6 overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-200 font-bold text-slate-700">
                      <th className="py-2.5 px-3 text-center w-12">No.</th>
                      <th className="py-2.5 px-3">Nama Barang</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3 text-center">Ukuran</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Harga</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedTx.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div className="flex items-center space-x-2">
                            {it.image && (
                              <img
                                src={it.image}
                                alt=""
                                className="w-6 h-6 rounded object-cover border border-slate-200 shrink-0"
                              />
                            )}
                            <span>{it.id_product}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{it.model || '-'}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">{it.ukuran || '-'}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono">
                          {it.qty} {it.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatCurrency(it.harga)}</td>
                        <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">{formatCurrency(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Supplier: <b className="text-slate-800">{selectedTx.nama_supplier}</b>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
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
