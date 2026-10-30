'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ClipboardList,
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
  Building2,
} from 'lucide-react';

interface OpnameItem {
  inv_in_id?: string;
  id_product: string; // nama_bahan
  id_bahan?: string;
  model: string;
  ukuran: string;
  uom: string;
  stock_awal: number;
  stock_change: number;
  stock_opname: number;
}

interface OpnameTransaction {
  id_inv_in: string;
  inv_date: string;
  status: string; // 'd' = Draft, 's' = Close
  keterangan: string;
  id_cabang?: string;
  items: OpnameItem[];
}

interface ProductOption {
  id_bahan: string;
  nama_bahan: string;
  label: string;
  ukuran: string;
  uom: string;
}

export default function StockOpnamePage() {
  const [transactions, setTransactions] = useState<OpnameTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [currentId, setCurrentId] = useState<string>('new');
  const [formInvDate, setFormInvDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [formKeterangan, setFormKeterangan] = useState<string>('');
  const [formItems, setFormItems] = useState<OpnameItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form Item Inputs
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchProductQuery, setSearchProductQuery] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableUkurans, setAvailableUkurans] = useState<string[]>([]);
  const [availableUoms, setAvailableUoms] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedUkuran, setSelectedUkuran] = useState<string>('');
  const [selectedUom, setSelectedUom] = useState<string>('');
  const [stockVariants, setStockVariants] = useState<any[]>([]);

  // Delete modal state
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
      if (search.trim()) {
        params.append('search', search.trim());
      }
      if (selectedCabang && selectedCabang !== 'ALL') {
        params.append('cabang', selectedCabang);
      }
      params.append('page', String(page));
      params.append('limit', '15');

      const res = await fetch(`/api/opname?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTransactions(data.data || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
        }
      } else {
        showToast('error', data.message || 'Gagal memuat data stock opname.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke database.');
    } finally {
      setLoading(false);
    }
  }, [tglFrom, tglTo, search, selectedCabang, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Search materials for item picker dropdown
  useEffect(() => {
    const searchProducts = async () => {
      if (!searchProductQuery.trim()) {
        setProductOptions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/opname/products?search=${encodeURIComponent(searchProductQuery)}`
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setProductOptions(data.data || []);
        }
      } catch (err) {
        console.warn('Failed to search products:', err);
      }
    };

    const timer = setTimeout(searchProducts, 250);
    return () => clearTimeout(timer);
  }, [searchProductQuery]);

  // When a product is selected, fetch its stock details & available variants
  const handleSelectProduct = async (prodName: string) => {
    setSelectedProduct(prodName);
    setSelectedModel('');
    setSelectedUkuran('');
    setSelectedUom('');

    if (!prodName) return;

    try {
      const res = await fetch(
        `/api/opname/products?nama_bahan=${encodeURIComponent(prodName)}`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setStockVariants(data.stockVariants || []);
        setAvailableModels(data.models.length > 0 ? data.models : ['Diskon']);
        setAvailableUkurans(data.ukurans.length > 0 ? data.ukurans : ['#']);
        setAvailableUoms(data.uoms.length > 0 ? data.uoms : ['PCS']);

        if (data.models.length > 0) setSelectedModel(data.models[0]);
        if (data.ukurans.length > 0) setSelectedUkuran(data.ukurans[0]);
        if (data.uoms.length > 0) setSelectedUom(data.uoms[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch stock variants:', err);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      showToast('error', 'Pilih nama barang terlebih dahulu!');
      return;
    }

    // Find stock from stockVariants matching model, ukuran, uom
    const foundVar = stockVariants.find(
      (v) =>
        (selectedModel ? v.model === selectedModel : true) &&
        (selectedUkuran ? v.ukuran === selectedUkuran : true) &&
        (selectedUom ? v.uom === selectedUom : true)
    );

    const initialStock = foundVar ? Number(foundVar.stock) || 0 : 0;
    const foundProductOpt = productOptions.find((p) => p.nama_bahan === selectedProduct);
    const idBahanStr = foundProductOpt ? foundProductOpt.id_bahan : foundVar?.id_bahan || '';

    // Check if item already exists in formItems
    const exists = formItems.some(
      (it) =>
        it.id_product === selectedProduct &&
        it.model === (selectedModel || 'Diskon') &&
        it.ukuran === (selectedUkuran || '#') &&
        it.uom === (selectedUom || 'PCS')
    );

    if (exists) {
      showToast('error', 'Barang dengan varian/model/ukuran ini sudah ada dalam daftar opname!');
      return;
    }

    const newItem: OpnameItem = {
      inv_in_id: 'new_' + Date.now(),
      id_product: selectedProduct,
      id_bahan: idBahanStr,
      model: selectedModel || 'Diskon',
      ukuran: selectedUkuran || '#',
      uom: selectedUom || 'PCS',
      stock_awal: initialStock,
      stock_change: initialStock,
      stock_opname: 0,
    };

    setFormItems([...formItems, newItem]);

    // Reset item input
    setSelectedProduct('');
    setSearchProductQuery('');
    setSelectedModel('');
    setSelectedUkuran('');
    setSelectedUom('');
    setStockVariants([]);
  };

  const handleQtyChange = (index: number, newQty: number) => {
    const updated = [...formItems];
    const initial = updated[index].stock_awal;
    updated[index].stock_change = newQty;
    updated[index].stock_opname = newQty - initial;
    setFormItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = formItems.filter((_, i) => i !== index);
    setFormItems(updated);
  };

  const handleOpenCreateModal = () => {
    setCurrentId('new');
    setFormInvDate(new Date().toISOString().split('T')[0]);
    setFormKeterangan('');
    setFormItems([]);
    setIsReadOnly(false);
    setSelectedProduct('');
    setSearchProductQuery('');
    setModalOpen(true);
  };

  const handleOpenEditModal = async (id: string, readOnly: boolean) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/opname/${id}`);
      const data = await res.json();

      if (res.ok && data.success) {
        const tx = data.data;
        setCurrentId(tx.id_inv_in);
        setFormInvDate(tx.inv_date);
        setFormKeterangan(tx.keterangan || '');
        setFormItems(tx.items || []);
        setIsReadOnly(readOnly || tx.status === 's');
        setSelectedProduct('');
        setSearchProductQuery('');
        setModalOpen(true);
      } else {
        showToast('error', data.message || 'Gagal memuat detail opname.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status: 'd' | 's') => {
    if (formItems.length === 0) {
      showToast('error', 'Daftar detail barang opname tidak boleh kosong!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id_inv_in: currentId,
        inv_date: formInvDate,
        keterangan: formKeterangan,
        status, // 'd' = Draft, 's' = Otorisasi
        items: formItems,
      };

      const res = await fetch('/api/opname/save', {
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
        showToast('error', data.message || 'Gagal menyimpan transaksi opname.');
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
      const res = await fetch(`/api/opname/${deleteTargetId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', data.message);
        setDeleteModalOpen(false);
        setDeleteTargetId('');
        fetchTransactions();
      } else {
        showToast('error', data.message || 'Gagal menghapus opname.');
      }
    } catch {
      showToast('error', 'Gagal terhubung ke server.');
    } finally {
      setDeleting(false);
    }
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
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                Stock Opname
              </h1>
              <p className="text-xs text-slate-500">
                Pencatatan dan Otorisasi Penyesuaian Stok Fisik Barang
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Opname Baru</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3.5`}>
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

            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Pencarian
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="No. Opname / Keterangan..."
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

        {/* Table Content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3 text-center w-12">No</th>
                  <th className="px-4 py-3">No. Opname</th>
                  <th className="px-4 py-3 text-center">Tgl Opname</th>
                  <th className="px-4 py-3">Barang & Adjustment</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-center w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-flex items-center space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                        <span>Memuat data stock opname...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada transaksi stock opname ditemukan.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => {
                    const isAuthorized = tx.status === 's';
                    return (
                      <tr
                        key={tx.id_inv_in}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-4 py-3 text-center text-slate-400 font-medium">
                          {(page - 1) * 15 + idx + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {tx.id_inv_in}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-slate-600">
                          {formatDate(tx.inv_date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {tx.items && tx.items.length > 0 ? (
                              tx.items.map((it, i) => (
                                <div
                                  key={i}
                                  className="text-[11px] leading-tight text-slate-600"
                                >
                                  <span className="font-semibold text-slate-800">
                                    {it.id_product}
                                  </span>{' '}
                                  <span className="text-slate-500">({it.model})</span> :{' '}
                                  <span className="text-amber-700 font-medium">
                                    {it.stock_awal}
                                  </span>{' '}
                                  <span className="text-slate-400">=&gt;</span>{' '}
                                  <span className="text-emerald-700 font-bold">
                                    {it.stock_change}
                                  </span>{' '}
                                  <span className="text-slate-500">{it.uom}</span>
                                </div>
                              ))
                            ) : (
                              <span className="text-slate-400 font-italic">
                                Tidak ada item
                              </span>
                            )}
                          </div>
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
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {tx.keterangan || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            {isAuthorized ? (
                              <button
                                onClick={() => handleOpenEditModal(tx.id_inv_in, true)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                                title="Lihat Detail"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenEditModal(tx.id_inv_in, false)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                                title="Ubah Draft"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Ubah</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setDeleteTargetId(tx.id_inv_in);
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
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {isReadOnly
                      ? `Detail Stock Opname: ${currentId}`
                      : currentId === 'new'
                      ? 'Tambah Stock Opname Baru'
                      : `Ubah Stock Opname: ${currentId}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isReadOnly
                      ? 'Mode Lihat (Sudah Otorisasi)'
                      : 'Input penyesuaian stok fisik barang'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Opname
                  </label>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={formInvDate}
                    onChange={(e) => setFormInvDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Keterangan
                  </label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    placeholder="Catatan / keterangan opname stok..."
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Add Item Form (Only when NOT read-only) */}
              {!isReadOnly && (
                <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Tambah Detail Barang Opname</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                    {/* Select Product */}
                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Cari Nama Barang
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Ketik nama / ID barang..."
                          value={searchProductQuery}
                          onChange={(e) => setSearchProductQuery(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        {productOptions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto divide-y divide-slate-100">
                            {productOptions.map((p) => (
                              <div
                                key={p.id_bahan}
                                onClick={() => {
                                  handleSelectProduct(p.nama_bahan);
                                  setSearchProductQuery(p.nama_bahan);
                                  setProductOptions([]);
                                }}
                                className="p-2 hover:bg-emerald-50 cursor-pointer text-slate-700 hover:text-emerald-800 font-medium"
                              >
                                {p.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Select Model */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Model
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        {availableModels.map((m, i) => (
                          <option key={i} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Select Ukuran */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Ukuran
                      </label>
                      <select
                        value={selectedUkuran}
                        onChange={(e) => setSelectedUkuran(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        {availableUkurans.map((u, i) => (
                          <option key={i} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Select UOM & Add Button */}
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          UOM
                        </label>
                        <select
                          value={selectedUom}
                          onChange={(e) => setSelectedUom(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                          {availableUoms.map((um, i) => (
                            <option key={i} value={um}>
                              {um}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-all cursor-pointer flex items-center justify-center"
                        title="Tambah ke daftar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Line Items Table */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-2 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <span>Daftar Detail Barang Opname</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                        <th className="px-3 py-2.5 text-center">ID Barang</th>
                        <th className="px-3 py-2.5">Nama Barang & Model</th>
                        <th className="px-3 py-2.5 text-center">Ukuran</th>
                        <th className="px-3 py-2.5 text-right">Qty Awal</th>
                        <th className="px-3 py-2.5 text-right w-32">Qty Baru</th>
                        <th className="px-3 py-2.5 text-right">Qty Opname (Delta)</th>
                        <th className="px-3 py-2.5 text-center">UOM</th>
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
                            Belum ada barang ditambahkan.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 text-center font-mono text-slate-600">
                              {item.id_bahan || '-'}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-slate-800">
                              {item.id_product}{' '}
                              <span className="text-slate-500 font-normal">
                                - {item.model}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600 font-medium">
                              {item.ukuran}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-amber-700 bg-amber-50/50">
                              {item.stock_awal}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {isReadOnly ? (
                                <span className="font-bold text-slate-800">
                                  {item.stock_change}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  value={item.stock_change}
                                  onChange={(e) =>
                                    handleQtyChange(idx, Number(e.target.value) || 0)
                                  }
                                  className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold">
                              <span
                                className={
                                  item.stock_opname > 0
                                    ? 'text-emerald-700'
                                    : item.stock_opname < 0
                                    ? 'text-rose-600'
                                    : 'text-slate-600'
                                }
                              >
                                {item.stock_opname > 0 ? `+${item.stock_opname}` : item.stock_opname}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-medium text-slate-600">
                              {item.uom}
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

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Hapus Stock Opname</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus invoice opname{' '}
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
