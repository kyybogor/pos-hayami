'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowDownRight,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  Calendar,
  Layers,
  Building2,
} from 'lucide-react';

interface InvoiceOnline {
  id_do1: string;
  id_cust: string;
  no_inv: string;
  tgltop: string;
  tgl: string;
  qty: number | string;
  ttlhrg: number | string;
  grandttl: number | string;
  approve?: string;
  status?: string;
  localStatus: string; // 'Approved' | 'Waiting Approval' | 'Unapproved'
  isStockedIn: boolean;
  isApproved: boolean;
}

export default function BarangMasukOnlinePage() {
  const [invoices, setInvoices] = useState<InvoiceOnline[]>([]);
  const [loading, setLoading] = useState(true);
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');
  const [stockingInId, setStockingInId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
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

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tglFrom && tglTo) {
        params.append('tgl_from', tglFrom);
        params.append('tgl_to', tglTo);
      }
      if (selectedCabang && selectedCabang !== 'ALL') {
        params.append('cabang', selectedCabang);
      }

      const res = await fetch(`/api/barang-masuk-online?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setInvoices(data.data || []);
      } else {
        showToast('error', data.message || 'Gagal memuat data barang masuk online.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke database server online.');
    } finally {
      setLoading(false);
    }
  }, [tglFrom, tglTo, selectedCabang]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleResetFilter = () => {
    setTglFrom('');
    setTglTo('');
    if (isSuperAdmin) {
      setSelectedCabang('ALL');
    } else if (currentUser?.branch) {
      setSelectedCabang(currentUser.branch);
    }
  };

  const handleStockIn = async (inv: InvoiceOnline) => {
    if (inv.isStockedIn) {
      showToast('error', 'Transaksi ini sudah di-Stock In sebelumnya.');
      return;
    }

    setStockingInId(inv.id_do1);
    try {
      const res = await fetch('/api/barang-masuk-online/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_do1: inv.id_do1, no_inv: inv.no_inv }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Stock In berhasil!');
        fetchInvoices();
      } else {
        showToast('error', data.message || 'Gagal memproses Stock In.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat memproses Stock In.');
    } finally {
      setStockingInId(null);
    }
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

        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <ArrowDownRight className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Barang Masuk Online</h1>
              <p className="text-xs text-slate-500">
                Penerimaan invoice gudang online ke sistem POS lokal
              </p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchInvoices();
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

              {(tglFrom || tglTo) && (
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
              onClick={fetchInvoices}
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
                  <th className="py-3.5 px-4">Tgl Transaksi</th>
                  <th className="py-3.5 px-4">No. Transaksi (Inv)</th>
                  <th className="py-3.5 px-4 text-center">Qty</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs">Menghubungkan ke Server Online...</span>
                      </div>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <Layers className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Tidak ada transaksi barang masuk online</p>
                        <p className="text-xs text-slate-400">
                          {tglFrom ? 'Coba ubah tanggal pencarian' : 'Tidak ada invoice online yang belum diproses'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const detailBaseUrl = `/barang-masuk-online/detail?id_do1=${encodeURIComponent(inv.id_do1)}&id_cust=${encodeURIComponent(inv.id_cust)}&no_inv=${encodeURIComponent(inv.no_inv)}&tgltop=${encodeURIComponent(inv.tgltop)}`;
                    const formattedQty = Number(inv.qty) || 0;

                    return (
                      <tr key={inv.id_do1} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap text-xs font-mono">
                          {inv.tgl ? new Date(inv.tgl).toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap font-mono text-xs">
                          {inv.no_inv}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap font-semibold text-slate-800">
                          {formattedQty} PCS
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {inv.localStatus === 'Approved' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Approved / Stocked In</span>
                            </span>
                          ) : inv.localStatus === 'Waiting Approval' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Waiting Approval</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Unapproved</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-2">
                            {/* View Detail Link (sku) */}
                            <Link
                              href={`${detailBaseUrl}&sku=1`}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Detail</span>
                            </Link>

                            {/* View Link (category) */}
                            <Link
                              href={`${detailBaseUrl}&category=1`}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </Link>

                            {/* Stock In Action */}
                            <button
                              onClick={() => handleStockIn(inv)}
                              disabled={inv.isStockedIn || stockingInId === inv.id_do1}
                              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                inv.isStockedIn
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              }`}
                            >
                              {stockingInId === inv.id_do1 ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              )}
                              <span>{inv.isStockedIn ? 'Sudah Stock In' : 'Stock In'}</span>
                            </button>
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
      </div>
    </DashboardLayout>
  );
}
