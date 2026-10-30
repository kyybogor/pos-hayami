'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  RotateCcw,
  Search,
  RefreshCw,
  Plus,
  Edit,
  Eye,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Package,
  Layers,
  Printer,
  DollarSign,
  User,
  CreditCard,
  Building2,
} from 'lucide-react';

interface ReturItem {
  no_id?: string;
  invret?: string;
  id_bahan: string;
  nama_bahan?: string;
  model: string;
  ukuran: string;
  qty: number;
  max_qty?: number;
  uom: string;
  harga: number;
  subtotal: number;
  image?: string;
}

interface ReturTransaction {
  id_transaksi: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  status_keluar: string; // 'd' = Draft, 's' = Close
  keterangan: string;
  sales: string;
  akun: string;
  total_belanja: number;
  items: ReturItem[];
}

interface InvoiceCandidateItem {
  id_transaksi: string;
  id_bahan: string;
  nama_bahan: string;
  model: string;
  ukuran: string;
  original_qty: number;
  max_return_qty: number;
  already_returned: number;
  uom: string;
  harga: number;
  image: string;
}

export default function ReturBarangPage() {
  const [transactions, setTransactions] = useState<ReturTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [search, setSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterAkun, setFilterAkun] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Totals Summary
  const [totalReturCustomer, setTotalReturCustomer] = useState(0);
  const [totalReturGudang, setTotalReturGudang] = useState(0);

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [currentId, setCurrentId] = useState<string>('new');
  const [formTgl, setFormTgl] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formCustomer, setFormCustomer] = useState<string>('CASH | CASH');
  const [formSales, setFormSales] = useState<string>('sales1');
  const [formAkun, setFormAkun] = useState<string>('CASH');
  const [formKeterangan, setFormKeterangan] = useState<string>('');
  const [formItems, setFormItems] = useState<ReturItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Invoice Items Search for Retur Entry
  const [searchInvoice, setSearchInvoice] = useState('');
  const [invoiceCandidates, setInvoiceCandidates] = useState<InvoiceCandidateItem[]>([]);
  const [searchingInvoice, setSearchingInvoice] = useState(false);

  // Selected item modal for specifying Qty
  const [qtyModalOpen, setQtyModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<InvoiceCandidateItem | null>(null);
  const [inputQty, setInputQty] = useState<number>(1);

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  // Toast alert
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
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
      if (search.trim()) params.append('search', search.trim());
      if (filterCustomer.trim()) params.append('customer', filterCustomer.trim());
      if (filterAkun.trim()) params.append('akun', filterAkun.trim());
      if (selectedCabang && selectedCabang !== 'ALL') params.append('cabang', selectedCabang);
      params.append('page', String(page));
      params.append('limit', '15');

      const res = await fetch(`/api/retur-barang?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTransactions(data.data || []);
        if (data.summary) {
          setTotalReturCustomer(data.summary.totalReturCustomer || 0);
          setTotalReturGudang(data.summary.totalReturGudang || 0);
        }
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
        }
      } else {
        showToast('error', data.message || 'Gagal memuat data retur barang.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke database.');
    } finally {
      setLoading(false);
    }
  }, [tglFrom, tglTo, search, filterCustomer, filterAkun, selectedCabang, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Lookup invoice candidate items
  const handleLookupInvoice = async (targetInvoice?: string) => {
    const inv = targetInvoice !== undefined ? targetInvoice : searchInvoice;
    if (!inv.trim()) {
      showToast('error', 'Masukkan No Invoice terlebih dahulu!');
      return;
    }
    setSearchingInvoice(true);
    try {
      const res = await fetch(
        `/api/retur-barang/invoice-items?invoice=${encodeURIComponent(inv.trim())}`
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setInvoiceCandidates(data.items || []);
        if (data.nama_customer) {
          setFormCustomer(data.nama_customer);
        }
        if (data.items.length === 0) {
          showToast('error', 'Semua item dari faktur ini sudah pernah diretur.');
        }
      } else {
        showToast('error', data.message || 'Faktur tidak ditemukan.');
        setInvoiceCandidates([]);
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
    } finally {
      setSearchingInvoice(false);
    }
  };

  // Auto open retur modal when redirected with ?invoice= parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const autoInv = urlParams.get('invoice') || urlParams.get('id_transaksi') || urlParams.get('no_tx');
      if (autoInv) {
        setCurrentId('new');
        setFormTgl(new Date().toISOString().split('T')[0]);
        setFormCustomer('CASH | CASH');
        setFormSales('sales1');
        setFormAkun('CASH');
        setFormKeterangan('');
        setFormItems([]);
        setSearchInvoice(autoInv);
        setIsReadOnly(false);
        setModalOpen(true);
        handleLookupInvoice(autoInv);
      }
    }
  }, []);

  const handleOpenQtyModal = (candidate: InvoiceCandidateItem) => {
    setSelectedCandidate(candidate);
    setInputQty(1);
    setQtyModalOpen(true);
  };

  const handleAddCandidateToRetur = () => {
    if (!selectedCandidate) return;

    if (inputQty <= 0) {
      showToast('error', 'Jumlah Qty retur harus lebih besar dari 0!');
      return;
    }

    if (inputQty > selectedCandidate.max_return_qty) {
      showToast(
        'error',
        `Qty retur tidak boleh melebihi sisa qty faktur (${selectedCandidate.max_return_qty})!`
      );
      return;
    }

    // Check if item already exists in formItems
    const existingIdx = formItems.findIndex(
      (it) =>
        it.id_bahan === selectedCandidate.id_bahan &&
        it.model === selectedCandidate.model &&
        it.ukuran === selectedCandidate.ukuran
    );

    const subtotal = inputQty * selectedCandidate.harga;

    if (existingIdx >= 0) {
      const updated = [...formItems];
      updated[existingIdx].qty = inputQty;
      updated[existingIdx].subtotal = subtotal;
      setFormItems(updated);
    } else {
      const newItem: ReturItem = {
        no_id: 'new_' + Date.now(),
        invret: selectedCandidate.id_transaksi,
        id_bahan: selectedCandidate.id_bahan,
        nama_bahan: selectedCandidate.nama_bahan,
        model: selectedCandidate.model,
        ukuran: selectedCandidate.ukuran,
        qty: inputQty,
        max_qty: selectedCandidate.max_return_qty,
        uom: selectedCandidate.uom,
        harga: selectedCandidate.harga,
        subtotal,
        image: selectedCandidate.image,
      };
      setFormItems([...formItems, newItem]);
    }

    setQtyModalOpen(false);
    setSelectedCandidate(null);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleOpenCreateModal = () => {
    setCurrentId('new');
    setFormTgl(new Date().toISOString().split('T')[0]);
    setFormCustomer('CASH | CASH');
    setFormSales('sales1');
    setFormAkun('CASH');
    setFormKeterangan('');
    setFormItems([]);
    setSearchInvoice('');
    setInvoiceCandidates([]);
    setIsReadOnly(false);
    setModalOpen(true);
  };

  const handleOpenEditModal = async (id: string, readOnly: boolean) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/retur-barang/${encodeURIComponent(id)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        const tx = data.data;
        setCurrentId(tx.id_transaksi);
        setFormTgl(tx.tgl_transaksi);
        setFormCustomer(tx.nama_customer || tx.id_customer || 'CASH');
        setFormSales(tx.sales || 'sales1');
        setFormAkun(tx.akun || 'CASH');
        setFormKeterangan(tx.keterangan || '');
        setFormItems(tx.items || []);
        setSearchInvoice('');
        setInvoiceCandidates([]);
        setIsReadOnly(readOnly || tx.status_keluar === 's');
        setModalOpen(true);
      } else {
        showToast('error', data.message || 'Gagal memuat detail retur.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status: 'd' | 's') => {
    if (formItems.length === 0) {
      showToast('error', 'Daftar item retur barang tidak boleh kosong!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id_transaksi: currentId,
        tgl_transaksi: formTgl,
        id_customer: formCustomer,
        sales: formSales,
        akun: formAkun,
        keterangan: formKeterangan,
        status_keluar: status, // 'd' = Draft, 's' = Otorisasi
        items: formItems,
      };

      const res = await fetch('/api/retur-barang/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', data.message);
        setModalOpen(false);
        fetchTransactions();
      } else {
        showToast('error', data.message || 'Gagal menyimpan transaksi retur.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/retur-barang/${encodeURIComponent(deleteTargetId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', data.message);
        setDeleteModalOpen(false);
        setDeleteTargetId('');
        fetchTransactions();
      } else {
        showToast('error', data.message || 'Gagal menghapus transaksi retur.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <DashboardLayout>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-top-3 ${
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
          <span>{toast.message}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-100/80 rounded-xl text-emerald-700">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                Master Retur Barang
              </h1>
              <p className="text-xs text-slate-500">
                Pencatatan & Pengembalian Barang Per Transaksi Faktur Penjualan
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Retur Baru</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3.5`}>
            {/* Date From */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Dari Tanggal
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglFrom}
                  onChange={(e) => setTglFrom(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Sampai Tanggal
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglTo}
                  onChange={(e) => setTglTo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Customer Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Customer
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="- Customer -"
                  value={filterCustomer}
                  onChange={(e) => setFilterCustomer(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
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
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
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

            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Pencarian
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="No Transaksi / Keterangan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-end space-x-2">
              <button
                onClick={() => {
                  setPage(1);
                  fetchTransactions();
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
              <button
                onClick={() => {
                  setTglFrom('');
                  setTglTo('');
                  setSearch('');
                  setFilterCustomer('');
                  setFilterAkun('');
                  if (isSuperAdmin) {
                    setSelectedCabang('ALL');
                  } else if (currentUser?.branch) {
                    setSelectedCabang(currentUser.branch);
                  }
                  setPage(1);
                }}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                title="Reset Filter"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3 text-center w-12">No</th>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3 text-center">Tgl Faktur</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Total Belanja</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>Memuat data retur barang...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada transaksi retur barang ditemukan.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => {
                    const isAuthorized = tx.status_keluar === 's';
                    return (
                      <tr key={tx.id_transaksi} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-center text-slate-400 font-medium">
                          {(page - 1) * 15 + idx + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {tx.id_transaksi}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-slate-600">
                          {formatDate(tx.tgl_transaksi)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {tx.nama_customer}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {tx.keterangan || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {formatCurrency(tx.total_belanja)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isAuthorized ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Close</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>Draft</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            {isAuthorized ? (
                              <button
                                onClick={() => handleOpenEditModal(tx.id_transaksi, true)}
                                className="inline-flex items-center space-x-1 px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                                title="Lihat Detail"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenEditModal(tx.id_transaksi, false)}
                                className="inline-flex items-center space-x-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                                title="Ubah Draft"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Ubah</span>
                              </button>
                            )}

                            <a
                              href={`/print/print_retur.php?id_transaksi=${encodeURIComponent(tx.id_transaksi)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Print Invoice Retur"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </a>

                            <button
                              onClick={() => {
                                setDeleteTargetId(tx.id_transaksi);
                                setDeleteModalOpen(true);
                              }}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Bottom Summary Cards */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200/70 rounded-xl flex items-center justify-between">
              <span className="text-emerald-800">Total Retur Dari Customer:</span>
              <span className="text-base font-bold text-emerald-900">
                {formatCurrency(totalReturCustomer)}
              </span>
            </div>
            <div className="p-3.5 bg-indigo-50 border border-indigo-200/70 rounded-xl flex items-center justify-between">
              <span className="text-indigo-800">Total Retur Ke Gudang:</span>
              <span className="text-base font-bold text-indigo-900">
                {formatCurrency(totalReturGudang)}
              </span>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>Halaman {page} dari {totalPages}</div>
              <div className="flex space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-medium transition-all cursor-pointer"
                >
                  Sebelumnya
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg font-medium transition-all cursor-pointer"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT / VIEW MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {isReadOnly
                      ? `Detail Retur Barang: ${currentId}`
                      : currentId === 'new'
                      ? 'Tambah Retur Barang Baru'
                      : `Ubah Retur Barang: ${currentId}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isReadOnly
                      ? 'Mode Lihat (Sudah Otorisasi)'
                      : 'Pilih No Invoice Penjualan dan tentukan item barang yang diretur'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Header Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={formTgl}
                    onChange={(e) => setFormTgl(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Customer
                  </label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    placeholder="Nama Customer..."
                    value={formCustomer}
                    onChange={(e) => setFormCustomer(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sales
                  </label>
                  <select
                    disabled={isReadOnly}
                    value={formSales}
                    onChange={(e) => setFormSales(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  >
                    <option value="sales1">Sales 1</option>
                    <option value="sales2">Sales 2</option>
                    <option value="sales3">Sales 3</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Pembayaran / Akun
                  </label>
                  <select
                    disabled={isReadOnly}
                    value={formAkun}
                    onChange={(e) => setFormAkun(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  >
                    <option value="CASH">CASH - Tunai</option>
                    <option value="HUTANG">HUTANG / KREDIT</option>
                    <option value="BANK BCA">BANK BCA</option>
                    <option value="BANK MANDIRI">BANK MANDIRI</option>
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Keterangan
                  </label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    placeholder="Catatan / keterangan retur..."
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Invoice Lookup Panel (Only in edit/new mode) */}
              {!isReadOnly && (
                <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                      <Search className="w-4 h-4 text-emerald-600" />
                      <span>Cari No Invoice Penjualan (Faktur)</span>
                    </h4>

                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Contoh: SO/0926/0001..."
                        value={searchInvoice}
                        onChange={(e) => setSearchInvoice(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        disabled={searchingInvoice}
                        onClick={() => handleLookupInvoice()}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                      >
                        {searchingInvoice ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>Cari Faktur</span>
                      </button>
                    </div>
                  </div>

                  {/* Candidate Items List */}
                  {invoiceCandidates.length > 0 && (
                    <div className="mt-3 border border-emerald-200 bg-white rounded-xl overflow-hidden p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-slate-600">
                        Pilih item barang dari faktur yang ingin diretur:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                        {invoiceCandidates.map((cand, i) => (
                          <div
                            key={i}
                            onClick={() => handleOpenQtyModal(cand)}
                            className="p-2.5 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl cursor-pointer transition-all flex items-center space-x-3 group"
                          >
                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                              {cand.image ? (
                                <img
                                  src={cand.image}
                                  alt={cand.nama_bahan}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-xs truncate">
                                {cand.nama_bahan}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {cand.model} | {cand.ukuran}
                              </p>
                              <p className="text-[11px] font-semibold text-emerald-700">
                                {formatCurrency(cand.harga)}
                              </p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                Max Sisa Retur: {cand.max_return_qty} {cand.uom}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Retur Items Table */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-2 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <span>Daftar Barang Yang Diretur</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                        <th className="px-3 py-2.5">No Invoice Faktur</th>
                        <th className="px-3 py-2.5">Nama Barang & Model</th>
                        <th className="px-3 py-2.5 text-center">Ukuran</th>
                        <th className="px-3 py-2.5 text-center">UOM</th>
                        <th className="px-3 py-2.5 text-right">Harga</th>
                        <th className="px-3 py-2.5 text-center w-28">Qty Retur</th>
                        <th className="px-3 py-2.5 text-right">Subtotal</th>
                        {!isReadOnly && <th className="px-3 py-2.5 text-center w-16">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {formItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isReadOnly ? 7 : 8}
                            className="px-3 py-8 text-center text-slate-400 italic"
                          >
                            Belum ada barang retur ditambahkan. Silakan cari No Invoice Faktur di atas.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-mono text-slate-600">
                              {item.invret || '-'}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">
                              {item.nama_bahan || item.id_bahan}{' '}
                              <span className="text-slate-500 font-normal">
                                - {item.model}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600 font-medium">
                              {item.ukuran}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600 font-medium">
                              {item.uom}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                              {formatCurrency(item.harga)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {isReadOnly ? (
                                <span className="font-bold text-slate-800">
                                  {item.qty}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min={1}
                                  max={item.max_qty || 9999}
                                  value={item.qty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 1;
                                    const updated = [...formItems];
                                    updated[idx].qty = val;
                                    updated[idx].subtotal = val * updated[idx].harga;
                                    setFormItems(updated);
                                  }}
                                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                              {formatCurrency(item.subtotal)}
                            </td>
                            {!isReadOnly && (
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {formItems.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 font-bold border-t border-slate-200">
                          <td colSpan={6} className="px-3 py-2.5 text-right text-slate-700">
                            Total Retur:
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-800 text-sm">
                            {formatCurrency(
                              formItems.reduce((acc, curr) => acc + (curr.subtotal || 0), 0)
                            )}
                          </td>
                          {!isReadOnly && <td />}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition-all cursor-pointer"
              >
                {isReadOnly ? 'Tutup' : 'Kembali'}
              </button>

              {!isReadOnly && (
                <div className="flex space-x-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSave('d')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan (Draft)'}
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSave('s')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan & Otorisasi'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INPUT QTY RETUR MODAL */}
      {qtyModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="font-bold text-slate-800 text-sm">
                Input Qty Retur Barang
              </h4>
              <button
                onClick={() => setQtyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-slate-800 text-sm">
                {selectedCandidate.nama_bahan}
              </p>
              <p className="text-slate-500">
                Model: {selectedCandidate.model} | Ukuran: {selectedCandidate.ukuran}
              </p>
              <p className="text-slate-600">
                Harga: <span className="font-semibold">{formatCurrency(selectedCandidate.harga)}</span>
              </p>
              <p className="text-slate-600">
                Max Sisa Faktur: <span className="font-bold text-emerald-700">{selectedCandidate.max_return_qty} {selectedCandidate.uom}</span>
              </p>

              <div className="pt-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Masukkan Jumlah Retur:
                </label>
                <input
                  type="number"
                  min={1}
                  max={selectedCandidate.max_return_qty}
                  value={inputQty}
                  onChange={(e) => setInputQty(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setQtyModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddCandidateToRetur}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                Tambahkan Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Hapus Retur Barang</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus transaksi retur barang{' '}
              <span className="font-bold text-slate-800">{deleteTargetId}</span>?
              Jika transaksi sudah di-otorisasi, perubahan stok akan otomatis dikembalikan (rollback).
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
