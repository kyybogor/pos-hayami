'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect from '@/components/SearchableSelect';
import {
  ArrowRightLeft,
  Search,
  RefreshCw,
  Plus,
  Calendar,
  X,
  Package,
  Building2,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  Tag,
  CheckCircle2,
  AlertCircle,
  Truck,
  User,
  Send,
} from 'lucide-react';

interface TransferItemDetail {
  id?: number;
  id_bahan: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  nama_barang: string;
  stock?: number;
}

interface TransferStockHeader {
  id_transfer: string;
  tgl_transfer: string;
  tujuan: string;
  keterangan: string;
  total_qty: number;
  dibuat_oleh: string;
  items: TransferItemDetail[];
}

interface ProductOption {
  id_bahan: string;
  model: string;
  ukuran: string;
  uom: string;
  stock: number;
  nama_barang: string;
  label: string;
}

export default function TransferStockPage() {
  const [transactions, setTransactions] = useState<TransferStockHeader[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Summary
  const [summary, setSummary] = useState({
    total_transaksi: 0,
    today_transaksi: 0,
    grand_total_qty: 0,
  });

  // Modal Detail state
  const [selectedTx, setSelectedTx] = useState<TransferStockHeader | null>(null);

  // Modal Create state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTgl, setFormTgl] = useState(new Date().toISOString().split('T')[0]);
  const [formKeterangan, setFormKeterangan] = useState('');
  const [cartItems, setCartItems] = useState<TransferItemDetail[]>([]);

  // Item Selector in Form
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProductKey, setSelectedProductKey] = useState('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Available Stock Products for Selection
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/transfer-stock/products');
      const data = await res.json();
      if (res.ok && data.success) {
        setProductOptions(data.products || []);
      }
    } catch (err) {
      console.error('Failed to fetch transfer products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

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

  // Fetch Transactions List
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tglFrom) params.append('tgl_from', tglFrom);
      if (tglTo) params.append('tgl_to', tglTo);
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCabang && selectedCabang !== 'ALL') params.append('cabang', selectedCabang);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const res = await fetch(`/api/transfer-stock?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTransactions(data.data.items || []);
        if (data.data.pagination) {
          setTotalPages(data.data.pagination.total_pages || 1);
          setTotalItems(data.data.pagination.total_items || 0);
        }
        if (data.data.summary) {
          setSummary(data.data.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch transfer stock transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [tglFrom, tglTo, searchQuery, selectedCabang, page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreateModal = () => {
    setShowCreateModal(true);
    setFormTgl(new Date().toISOString().split('T')[0]);
    setFormKeterangan('');
    setCartItems([]);
    setSelectedProductKey('');
    setItemQty(1);
    fetchProducts();
  };

  const handleAddItemToCart = () => {
    if (!selectedProductKey) {
      showToast('error', 'Silakan pilih barang yang akan ditransfer.');
      return;
    }

    const selectedProd = productOptions.find(
      (p) => `${p.id_bahan}|${p.model}|${p.ukuran}` === selectedProductKey
    );

    if (!selectedProd) {
      showToast('error', 'Barang tidak ditemukan.');
      return;
    }

    if (itemQty <= 0) {
      showToast('error', 'Jumlah transfer harus lebih dari 0.');
      return;
    }

    if (itemQty > selectedProd.stock) {
      showToast(
        'error',
        `Stock tidak mencukupi! Sisa stock ${selectedProd.nama_barang} adalah ${selectedProd.stock} pcs.`
      );
      return;
    }

    // Check if item is already in cart
    const existingIndex = cartItems.findIndex(
      (ci) =>
        ci.id_bahan === selectedProd.id_bahan &&
        ci.model === selectedProd.model &&
        ci.ukuran === selectedProd.ukuran
    );

    if (existingIndex >= 0) {
      const currentCartQty = cartItems[existingIndex].qty;
      const newQty = currentCartQty + itemQty;

      if (newQty > selectedProd.stock) {
        showToast(
          'error',
          `Total transfer (${newQty} pcs) melebihi stock yang ada (${selectedProd.stock} pcs)!`
        );
        return;
      }

      const updatedCart = [...cartItems];
      updatedCart[existingIndex].qty = newQty;
      setCartItems(updatedCart);
    } else {
      setCartItems((prev) => [
        ...prev,
        {
          id_bahan: selectedProd.id_bahan,
          model: selectedProd.model,
          ukuran: selectedProd.ukuran,
          qty: itemQty,
          uom: selectedProd.uom || 'PCS',
          nama_barang: selectedProd.nama_barang,
          stock: selectedProd.stock,
        },
      ]);
    }

    setSelectedProductKey('');
    setItemQty(1);
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitTransfer = async () => {
    if (cartItems.length === 0) {
      showToast('error', 'Daftar barang yang ditransfer masih kosong!');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/transfer-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgl_transfer: formTgl,
          keterangan: formKeterangan,
          items: cartItems.map((item) => ({
            id_bahan: item.id_bahan,
            model: item.model,
            ukuran: item.ukuran,
            qty: item.qty,
            uom: item.uom,
          })),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', data.message || 'Transfer stock berhasil!');
        setShowCreateModal(false);
        fetchData();
      } else {
        showToast('error', data.message || 'Gagal membuat transfer stock.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat menghubungi server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFilter = () => {
    setTglFrom('');
    setTglTo('');
    setSearchQuery('');
    if (isSuperAdmin) {
      setSelectedCabang('ALL');
    } else if (currentUser?.branch) {
      setSelectedCabang(currentUser.branch);
    }
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
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
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100/80">
              <ArrowRightLeft className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Transfer Stock</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola transaksi pengiriman transfer barang antar cabang dan pengurangan stock otomatis
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-md font-bold text-xs flex items-center space-x-2 transition-all duration-200 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Transfer Stock</span>
          </button>
        </div>

        {/* Filter Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filter Transaksi Transfer</span>
          </div>

          <div className={`grid grid-cols-1 ${isSuperAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Cari No. Transfer / Tujuan
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="No. Transfer, Tujuan, Keterangan..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs font-medium text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Cabang Toko - Superadmin Only */}
            {isSuperAdmin && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cabang Toko
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <select
                    value={selectedCabang}
                    onChange={(e) => {
                      setSelectedCabang(e.target.value);
                      setPage(1);
                    }}
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

            {/* Dari Tanggal */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Dari Tanggal
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

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleResetFilter}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cari Data</span>
            </button>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Transaksi Transfer
              </p>
              <p className="text-xl font-extrabold text-slate-800 mt-0.5">{totalItems}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Transfer Hari Ini
              </p>
              <p className="text-xl font-extrabold text-teal-700 mt-0.5">
                {summary.today_transaksi} <span className="text-xs font-medium text-slate-400">transaksi</span>
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Qty Ditransfer
              </p>
              <p className="text-xl font-extrabold text-blue-600 mt-0.5">
                {summary.grand_total_qty.toLocaleString('id-ID')} <span className="text-xs font-medium text-slate-400">pcs</span>
              </p>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 text-center">No. Transfer</th>
                  <th className="py-3.5 px-4 text-center">Tgl Transfer</th>
                  <th className="py-3.5 px-4">Keterangan</th>
                  <th className="py-3.5 px-4 text-right">Total Qty</th>
                  <th className="py-3.5 px-4 text-center">Dibuat Oleh</th>
                  <th className="py-3.5 px-4 text-center">Detail Barang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      <span>Memuat data transfer stock...</span>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-slate-600">Belum ada riwayat transfer stock</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tekan tombol "+ Tambah Transfer Stock" untuk membuat transaksi transfer baru
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id_transfer} className="hover:bg-slate-50/80 transition-colors">
                      {/* No Transfer */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {tx.id_transfer}
                      </td>

                      {/* Tgl Transfer */}
                      <td className="py-3 px-4 text-center text-slate-600">
                        {formatDate(tx.tgl_transfer)}
                      </td>

                      {/* Keterangan */}
                      <td className="py-3 px-4 text-slate-500">{tx.keterangan || '-'}</td>

                      {/* Total Qty */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {tx.total_qty.toLocaleString('id-ID')} pcs
                      </td>

                      {/* Dibuat Oleh */}
                      <td className="py-3 px-4 text-center text-slate-600">
                        <span className="inline-flex items-center space-x-1 text-slate-600">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{tx.dibuat_oleh}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-xs font-semibold transition-all border border-emerald-200 cursor-pointer shadow-2xs group"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white" />
                          <span>Detail ({tx.items.length} item)</span>
                        </button>
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
                Menampilkan <strong>{transactions.length}</strong> dari <strong>{totalItems}</strong> transaksi transfer
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

        {/* Modal View Detail Items */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Detail Transfer: <span className="font-mono text-emerald-700">{selectedTx.id_transfer}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tanggal: {formatDate(selectedTx.tgl_transfer)} | Dibuat oleh: <strong className="text-slate-800">{selectedTx.dibuat_oleh}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content Table */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                        <th className="py-3 px-4">No.</th>
                        <th className="py-3 px-4">Nama Barang</th>
                        <th className="py-3 px-4 text-center">Tipe / Bahan</th>
                        <th className="py-3 px-4 text-center">Model</th>
                        <th className="py-3 px-4 text-center">Ukuran</th>
                        <th className="py-3 px-4 text-right">Qty Transfer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {selectedTx.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900 font-mono">
                            {item.nama_barang}
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-600">{item.id_bahan}</td>
                          <td className="py-2.5 px-4 text-center text-slate-600">{item.model}</td>
                          <td className="py-2.5 px-4 text-center text-slate-600">{item.ukuran}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                            {item.qty} {item.uom}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedTx.keterangan && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-xs text-slate-600">
                    <strong className="text-slate-800">Catatan Transfer:</strong> {selectedTx.keterangan}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  Total Qty Transfer: <strong className="text-emerald-700 text-sm">{selectedTx.total_qty} pcs</strong>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Create New Transfer Stock */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Form Tambah Transfer Stock</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih barang dari stock lokal yang tersedia dan masukkan jumlah yang akan ditransfer
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Header Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  {/* Tanggal */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Transfer <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formTgl}
                      onChange={(e) => setFormTgl(e.target.value)}
                      className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  {/* Keterangan */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Keterangan / Catatan
                    </label>
                    <input
                      type="text"
                      placeholder="Catatan tambahan (opsional)..."
                      value={formKeterangan}
                      onChange={(e) => setFormKeterangan(e.target.value)}
                      className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                {/* Item Selector Section */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                  <div className="text-xs font-bold text-emerald-900 flex items-center space-x-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Pilih Barang Dari Stock (Hanya Barang Berstok &gt; 0)</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Searchable Product Select */}
                    <div className="md:col-span-8">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Barang
                      </label>
                      <SearchableSelect
                        options={productOptions.map((p) => ({
                          value: `${p.id_bahan}|${p.model}|${p.ukuran}`,
                          label: p.label,
                        }))}
                        value={selectedProductKey}
                        onChange={(val) => setSelectedProductKey(val)}
                        placeholder={
                          loadingProducts
                            ? 'Memuat barang berstok...'
                            : '-- Pilih Barang yang Akan Ditransfer --'
                        }
                      />
                    </div>

                    {/* Qty Input */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Jumlah (Qty)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={itemQty}
                        onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>

                    {/* Add Button */}
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItemToCart}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cart Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Daftar Barang Transfer ({cartItems.length} item)</span>
                    {cartItems.length > 0 && (
                      <span className="text-emerald-700 font-extrabold">
                        Total Qty:{' '}
                        {cartItems.reduce((acc, curr) => acc + curr.qty, 0).toLocaleString('id-ID')} pcs
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                          <th className="py-3 px-4">Nama Barang</th>
                          <th className="py-3 px-4 text-center">Sisa Stock</th>
                          <th className="py-3 px-4 text-right">Qty Transfer</th>
                          <th className="py-3 px-4 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {cartItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400">
                              Belum ada barang yang ditambahkan ke daftar transfer.
                            </td>
                          </tr>
                        ) : (
                          cartItems.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-slate-900 font-mono">
                                {item.nama_barang}
                              </td>
                              <td className="py-2.5 px-4 text-center font-semibold text-emerald-600">
                                {item.stock} {item.uom}
                              </td>
                              <td className="py-2.5 px-4 text-right font-extrabold text-emerald-700">
                                {item.qty} {item.uom}
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCartItem(index)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleSubmitTransfer}
                  disabled={isSubmitting || cartItems.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-md text-xs font-bold transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Memproses Transfer &amp; Potong Stock...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Simpan &amp; Pengurangan Stock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
