'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowRightLeft,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Eye,
  Calendar,
  FileText,
  Package,
  Layers,
  Building,
} from 'lucide-react';

interface LocationOption {
  id: number;
  nama_lokasi: string;
}

interface StockOption {
  id_bahan: string;
  model: string;
  ukuran: string;
  nama_stock: string;
  stock: number;
  uom: string;
}

interface MoveDraftItem {
  id_bahan: string;
  model: string;
  ukuran: string;
  nama_stock: string;
  max_stock: number;
  qty: number;
  uom: string;
}

interface MoveTransactionDetail {
  id: number;
  id_move: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  nama_stock: string;
  qty: number;
  uom: string;
  id_location: number;
  nama_lokasi: string;
}

interface MoveTransaction {
  id_move: string;
  tgl_move: string;
  id_location: number;
  nama_lokasi: string;
  keterangan: string;
  total_qty: number;
  dibuat_oleh: string;
  created_at: string;
  items?: MoveTransactionDetail[];
}

interface TrackedStock {
  id: number;
  id_location: number;
  nama_lokasi: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  nama_stock: string;
  qty: number;
  updated_at: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MoveLocationPage() {
  const [activeTab, setActiveTab] = useState<'form' | 'tracked'>('form');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Master options
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [stockOptions, setStockOptions] = useState<StockOption[]>([]);
  const [loadingStockOptions, setLoadingStockOptions] = useState(false);

  // Form Fields State
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [keterangan, setKeterangan] = useState('');
  
  // Stock Selection State
  const [stockSearch, setStockSearch] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(null);
  const [inputQty, setInputQty] = useState<number | ''>('');
  const [draftItems, setDraftItems] = useState<MoveDraftItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // History State
  const [historyList, setHistoryList] = useState<MoveTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [historyPagination, setHistoryPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [selectedHistoryModal, setSelectedHistoryModal] = useState<MoveTransaction | null>(null);

  // Tracked Stock Tab State
  const [trackedList, setTrackedList] = useState<TrackedStock[]>([]);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const [trackedLocationFilter, setTrackedLocationFilter] = useState('');
  const [trackedSearch, setTrackedSearch] = useState('');
  const [trackedPage, setTrackedPage] = useState(1);
  const [trackedLimit, setTrackedLimit] = useState(15);
  const [trackedPagination, setTrackedPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3800);
  }, []);

  // 1. Fetch Location Options
  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/move-location?action=locations');
      const data = await res.json();
      if (res.ok && data.success) {
        setLocations(data.data || []);
      }
    } catch {
      console.error('Gagal mengambil daftar lokasi.');
    }
  }, []);

  // 2. Search Stock Items (only stock > 0)
  const searchStockItems = useCallback(async (query: string) => {
    setLoadingStockOptions(true);
    try {
      const params = new URLSearchParams({ action: 'stock-options' });
      if (query.trim()) params.append('search', query.trim());

      const res = await fetch(`/api/move-location?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setStockOptions(data.data || []);
      }
    } catch {
      console.error('Gagal mencari barang stok.');
    } finally {
      setLoadingStockOptions(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLocations();
    searchStockItems('');

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
  }, [fetchLocations, searchStockItems]);

  // Debounced search for stock items
  useEffect(() => {
    const timer = setTimeout(() => {
      searchStockItems(stockSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [stockSearch, searchStockItems]);

  // 3. Fetch Move History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({
        page: String(historyPage),
        limit: String(historyLimit),
      });
      if (historySearch.trim()) params.append('search', historySearch.trim());
      if (tglFrom) params.append('from', tglFrom);
      if (tglTo) params.append('to', tglTo);
      if (selectedCabang && selectedCabang !== 'ALL') params.append('cabang', selectedCabang);

      const res = await fetch(`/api/move-location?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setHistoryList(data.data || []);
        if (data.pagination) setHistoryPagination(data.pagination);
      } else {
        showToast('error', data.message || 'Gagal memuat riwayat pemindahan.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat memuat riwayat.');
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPage, historyLimit, historySearch, tglFrom, tglTo, selectedCabang, showToast]);

  // 4. Fetch Tracked Stock
  const fetchTrackedStock = useCallback(async () => {
    setLoadingTracked(true);
    try {
      const params = new URLSearchParams({
        action: 'tracked-stock',
        page: String(trackedPage),
        limit: String(trackedLimit),
      });
      if (trackedLocationFilter) params.append('id_location', trackedLocationFilter);
      if (trackedSearch.trim()) params.append('search', trackedSearch.trim());

      const res = await fetch(`/api/move-location?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTrackedList(data.data || []);
        if (data.pagination) setTrackedPagination(data.pagination);
      } else {
        showToast('error', data.message || 'Gagal memuat data stok lokasi.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat memuat stok per lokasi.');
    } finally {
      setLoadingTracked(false);
    }
  }, [trackedPage, trackedLimit, trackedLocationFilter, trackedSearch, showToast]);

  useEffect(() => {
    if (activeTab === 'form') {
      const timer = setTimeout(() => {
        fetchHistory();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        fetchTrackedStock();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchHistory, fetchTrackedStock]);

  // Add Item to Draft
  const handleAddItemToDraft = () => {
    if (!selectedStock) {
      showToast('error', 'Pilih barang terlebih dahulu!');
      return;
    }

    const qty = Number(inputQty);
    if (!qty || qty <= 0) {
      showToast('error', 'Jumlah pemindahan harus lebih dari 0!');
      return;
    }

    if (qty > selectedStock.stock) {
      showToast('error', `Jumlah melebihi stok yang tersedia (${selectedStock.stock} Pcs)!`);
      return;
    }

    // Check if item already exists in draft
    const existingIndex = draftItems.findIndex((item) => item.nama_stock === selectedStock.nama_stock);
    if (existingIndex >= 0) {
      const updated = [...draftItems];
      const newQty = updated[existingIndex].qty + qty;
      if (newQty > selectedStock.stock) {
        showToast('error', `Total jumlah (${newQty} Pcs) melebihi sisa stok yang tersedia (${selectedStock.stock} Pcs)!`);
        return;
      }
      updated[existingIndex].qty = newQty;
      setDraftItems(updated);
    } else {
      setDraftItems([
        ...draftItems,
        {
          id_bahan: selectedStock.id_bahan,
          model: selectedStock.model,
          ukuran: selectedStock.ukuran,
          nama_stock: selectedStock.nama_stock,
          max_stock: selectedStock.stock,
          qty,
          uom: selectedStock.uom || 'PCS',
        },
      ]);
    }

    // Reset input fields
    setSelectedStock(null);
    setStockSearch('');
    setInputQty('');
    showToast('success', 'Barang berhasil ditambahkan ke daftar pemindahan.');
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems(draftItems.filter((_, i) => i !== index));
  };

  const handleUpdateDraftQty = (index: number, newQtyVal: number) => {
    const item = draftItems[index];
    if (newQtyVal > item.max_stock) {
      showToast('error', `Jumlah melebihi stok yang tersedia (${item.max_stock} Pcs)!`);
      return;
    }
    const updated = [...draftItems];
    updated[index].qty = Math.max(1, newQtyVal);
    setDraftItems(updated);
  };

  // Submit Move Location Transaction
  const handleSubmitMove = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLocationId) {
      showToast('error', 'Pilih lokasi tujuan pemindahan terlebih dahulu!');
      return;
    }

    if (draftItems.length === 0) {
      showToast('error', 'Daftar barang yang akan dipindahkan belum ada!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id_location: parseInt(selectedLocationId, 10),
        keterangan: keterangan.trim(),
        items: draftItems.map((item) => ({
          id_bahan: item.id_bahan,
          model: item.model,
          ukuran: item.ukuran,
          nama_stock: item.nama_stock,
          qty: item.qty,
          uom: item.uom,
        })),
      };

      const res = await fetch('/api/move-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Pemindahan lokasi berhasil disimpan!');
        // Reset form
        setSelectedLocationId('');
        setKeterangan('');
        setDraftItems([]);
        setSelectedStock(null);
        setStockSearch('');
        setInputQty('');
        // Refresh data
        searchStockItems('');
        fetchHistory();
      } else {
        showToast('error', data.message || 'Gagal menyimpan pemindahan lokasi.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat memproses transaksi.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalDraftQty = draftItems.reduce((sum, item) => sum + item.qty, 0);
  const startHistoryEntry = historyPagination.total > 0 ? (historyPagination.page - 1) * historyPagination.limit + 1 : 0;
  const endHistoryEntry = Math.min(historyPagination.page * historyPagination.limit, historyPagination.total);

  const startTrackedEntry = trackedPagination.total > 0 ? (trackedPagination.page - 1) * trackedPagination.limit + 1 : 0;
  const endTrackedEntry = Math.min(trackedPagination.page * trackedPagination.limit, trackedPagination.total);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toast Notification */}
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
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Move Location</h1>
              <p className="text-xs text-slate-500">
                Pindahkan stok barang dari inventaris utama ke lokasi penyimpanan / cabang
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setActiveTab('form')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Input & Riwayat Pemindahan</span>
            </button>
            <button
              onClick={() => setActiveTab('tracked')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'tracked'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Stok Per Lokasi (Tracked)</span>
            </button>
          </div>
        </div>

        {/* TAB 1: FORM & RIWAYAT PEMINDAHAN */}
        {activeTab === 'form' && (
          <div className="space-y-6">
            {/* Form Move Location Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/80 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-slate-900 text-base">Form Pemindahan Stok Ke Lokasi</h2>
              </div>

              <form onSubmit={handleSubmitMove} className="p-6 space-y-6">
                {/* Header Inputs: Location & Keterangan */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>Pilih Lokasi Tujuan *</span>
                    </label>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">-- Pilih Lokasi Tujuan --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.nama_lokasi} (ID: #{loc.id})
                        </option>
                      ))}
                    </select>
                    {locations.length === 0 && (
                      <p className="text-[11px] text-rose-500">
                        Belum ada lokasi tersimpan. Tambahkan lokasi terlebih dahulu di Master Location.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>Keterangan / Catatan Pemindahan</span>
                    </label>
                    <input
                      type="text"
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      placeholder="Contoh: Alokasi stok awal Toko Cabang A..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Section: Select Stock Item */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-2">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>Pilih Barang Dari Inventory List (Stock &gt; 0)</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Autocomplete / Search Stock */}
                    <div className="md:col-span-6 space-y-1 relative">
                      <label className="text-xs font-semibold text-slate-600">
                        Cari Nama Barang
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={stockSearch}
                          onChange={(e) => {
                            setStockSearch(e.target.value);
                            setSelectedStock(null);
                          }}
                          placeholder="Ketik untuk mencari ID Bahan, Model, Ukuran..."
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      </div>

                      {/* Dropdown list results */}
                      {!selectedStock && stockSearch.trim().length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-30 max-h-60 overflow-y-auto">
                          {loadingStockOptions ? (
                            <div className="p-3 text-center text-xs text-slate-400">Mencari stok...</div>
                          ) : stockOptions.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              Tidak ada barang ber-stok ditemukan
                            </div>
                          ) : (
                            stockOptions.map((stk) => (
                              <button
                                key={stk.nama_stock}
                                type="button"
                                onClick={() => {
                                  setSelectedStock(stk);
                                  setStockSearch(stk.nama_stock);
                                  setInputQty('');
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-semibold text-slate-900 text-xs">{stk.nama_stock}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {stk.id_bahan} &bull; {stk.model} &bull; {stk.ukuran}
                                  </div>
                                </div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                                  Stok: {stk.stock} {stk.uom}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quantity Input */}
                    <div className="md:col-span-4 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-slate-600">Jumlah Dipindahkan</label>
                        {selectedStock && (
                          <span className="text-[11px] font-bold text-emerald-700">
                            Max: {selectedStock.stock} {selectedStock.uom}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min={1}
                          max={selectedStock ? selectedStock.stock : 99999}
                          value={inputQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setInputQty(isNaN(val) ? '' : val);
                          }}
                          placeholder="Masukkan Qty"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {selectedStock && (
                          <button
                            type="button"
                            onClick={() => setInputQty(selectedStock.stock)}
                            className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
                          >
                            Maks
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Add Button */}
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItemToDraft}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Draft Items Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Barang Yang Akan Dipindahkan ({draftItems.length} Item)
                  </h3>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4 w-12 text-center">No</th>
                          <th className="py-3 px-4">Nama Barang</th>
                          <th className="py-3 px-4 text-center">Stok Tersedia</th>
                          <th className="py-3 px-4 text-center w-36">Qty Dipindahkan</th>
                          <th className="py-3 px-4 text-center w-20">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {draftItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                              Belum ada barang yang ditambahkan. Silakan pilih barang di atas dan klik Tambah.
                            </td>
                          </tr>
                        ) : (
                          draftItems.map((item, idx) => (
                            <tr key={item.nama_stock} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 text-center font-mono text-xs text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">
                                <div>{item.nama_stock}</div>
                                <div className="text-xs font-normal text-slate-500">
                                  {item.id_bahan} &bull; {item.model} &bull; {item.ukuran}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                  {item.max_stock} {item.uom}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={item.max_stock}
                                  value={item.qty}
                                  onChange={(e) => handleUpdateDraftQty(idx, parseInt(e.target.value, 10) || 1)}
                                  className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-900 text-sm"
                                />
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDraftItem(idx)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus dari daftar"
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

                {/* Submit Action Bar */}
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-600">
                    Total Item: <strong className="text-slate-900">{draftItems.length}</strong> | Total Qty:{' '}
                    <strong className="text-emerald-700 font-bold text-sm">{totalDraftQty} Pcs</strong>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || draftItems.length === 0}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Memproses Pemindahan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Simpan Pemindahan Lokasi</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Riwayat Pemindahan Lokasi Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">Riwayat Transaksi Pemindahan Lokasi</h2>
                  <p className="text-xs text-slate-500">Daftar transaksi pemindahan stok ke lokasi yang telah diproses</p>
                </div>

                <button
                  onClick={fetchHistory}
                  className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-medium self-start sm:self-auto"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                  <span>Refresh Data</span>
                </button>
              </div>

              {/* Filters */}
              <div className={`grid grid-cols-1 ${isSuperAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
                {isSuperAdmin && (
                  <div className="flex items-center space-x-1.5">
                    <Building className="w-4 h-4 text-emerald-600 shrink-0" />
                    <select
                      value={selectedCabang}
                      onChange={(e) => {
                        setSelectedCabang(e.target.value);
                        setHistoryPage(1);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Cari No. Move, Lokasi, Catatan..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="date"
                    value={tglFrom}
                    onChange={(e) => {
                      setTglFrom(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">s/d</span>
                  <input
                    type="date"
                    value={tglTo}
                    onChange={(e) => {
                      setTglTo(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">No. Transaksi</th>
                        <th className="py-3.5 px-4">Tanggal</th>
                        <th className="py-3.5 px-4">Lokasi Tujuan</th>
                        <th className="py-3.5 px-4 text-center">Total Item &amp; Qty</th>
                        <th className="py-3.5 px-4">Dibuat Oleh</th>
                        <th className="py-3.5 px-4">Keterangan</th>
                        <th className="py-3.5 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {loadingHistory ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center space-y-2">
                              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                              <span className="text-xs">Memuat riwayat pemindahan...</span>
                            </div>
                          </td>
                        </tr>
                      ) : historyList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center space-y-2">
                              <Package className="w-8 h-8 text-slate-300" />
                              <p className="text-sm font-medium text-slate-600">Belum ada riwayat pemindahan lokasi</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        historyList.map((item) => (
                          <tr key={item.id_move} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-xs whitespace-nowrap">
                              {item.id_move}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                              {item.tgl_move ? new Date(item.tgl_move).toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{item.nama_lokasi}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span className="font-semibold text-slate-800">{item.items?.length || 0} Item</span> &bull;{' '}
                              <strong className="text-emerald-700">{item.total_qty} Pcs</strong>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 text-xs">{item.dibuat_oleh || '-'}</td>
                            <td className="py-3.5 px-4 text-slate-600 text-xs italic">{item.keterangan || '-'}</td>
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => setSelectedHistoryModal(item)}
                                className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detail</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {historyPagination.total > 0 && (
                  <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
                    <div>
                      Menampilkan <strong className="text-slate-900">{startHistoryEntry}</strong> &ndash;{' '}
                      <strong className="text-slate-900">{endHistoryEntry}</strong> dari{' '}
                      <strong className="text-slate-900">{historyPagination.total}</strong> transaksi
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                        disabled={historyPage === 1 || loadingHistory}
                        className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold">
                        Hal {historyPagination.page} / {historyPagination.totalPages}
                      </span>
                      <button
                        onClick={() => setHistoryPage((prev) => Math.min(historyPagination.totalPages, prev + 1))}
                        disabled={historyPage >= historyPagination.totalPages || loadingHistory}
                        className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STOK PER LOKASI (TRACKED) */}
        {activeTab === 'tracked' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">Tracking Stok Per Lokasi</h2>
                  <p className="text-xs text-slate-500">
                    Daftar akumulasi stok barang yang telah dipindahkan ke masing-masing lokasi
                  </p>
                </div>

                <button
                  onClick={fetchTrackedStock}
                  className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-medium self-start sm:self-auto"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingTracked ? 'animate-spin' : ''}`} />
                  <span>Refresh Data</span>
                </button>
              </div>

              {/* Filters for Tracked Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <select
                    value={trackedLocationFilter}
                    onChange={(e) => {
                      setTrackedLocationFilter(e.target.value);
                      setTrackedPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Semua Lokasi --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.nama_lokasi}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={trackedSearch}
                    onChange={(e) => {
                      setTrackedSearch(e.target.value);
                      setTrackedPage(1);
                    }}
                    placeholder="Cari Nama Stock, Lokasi, Bahan, Model, Ukuran..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Lokasi</th>
                        <th className="py-3.5 px-4">Nama Barang</th>
                        <th className="py-3.5 px-4">Tipe / Bahan</th>
                        <th className="py-3.5 px-4">Model</th>
                        <th className="py-3.5 px-4">Ukuran</th>
                        <th className="py-3.5 px-4 text-center">Stok Lokasi</th>
                        <th className="py-3.5 px-4 text-center">Terakhir Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {loadingTracked ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center space-y-2">
                              <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                              <span className="text-xs">Memuat data stok per lokasi...</span>
                            </div>
                          </td>
                        </tr>
                      ) : trackedList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center space-y-2">
                              <Layers className="w-8 h-8 text-slate-300" />
                              <p className="text-sm font-medium text-slate-600">Belum ada stok barang dipindahkan ke lokasi ini</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        trackedList.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>{item.nama_lokasi}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800">{item.nama_stock}</td>
                            <td className="py-3.5 px-4 text-slate-600 text-xs">{item.id_bahan}</td>
                            <td className="py-3.5 px-4 text-slate-600 text-xs">{item.model}</td>
                            <td className="py-3.5 px-4 text-slate-600 text-xs">{item.ukuran}</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                                {item.qty} Pcs
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center text-xs text-slate-500 whitespace-nowrap">
                              {item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {trackedPagination.total > 0 && (
                  <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
                    <div>
                      Menampilkan <strong className="text-slate-900">{startTrackedEntry}</strong> &ndash;{' '}
                      <strong className="text-slate-900">{endTrackedEntry}</strong> dari{' '}
                      <strong className="text-slate-900">{trackedPagination.total}</strong> data stok
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setTrackedPage((prev) => Math.max(1, prev - 1))}
                        disabled={trackedPage === 1 || loadingTracked}
                        className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-semibold">
                        Hal {trackedPagination.page} / {trackedPagination.totalPages}
                      </span>
                      <button
                        onClick={() => setTrackedPage((prev) => Math.min(trackedPagination.totalPages, prev + 1))}
                        disabled={trackedPage >= trackedPagination.totalPages || loadingTracked}
                        className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DETAIL TRANSACTION MODAL */}
        {selectedHistoryModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                    <span>Detail Pemindahan:</span>
                    <span className="font-mono text-emerald-700">{selectedHistoryModal.id_move}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dipindahkan pada:{' '}
                    {selectedHistoryModal.tgl_move
                      ? new Date(selectedHistoryModal.tgl_move).toLocaleString('id-ID')
                      : '-'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedHistoryModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500">Lokasi Tujuan:</span>
                  <p className="font-bold text-slate-900">{selectedHistoryModal.nama_lokasi}</p>
                </div>
                <div>
                  <span className="text-slate-500">Dibuat Oleh:</span>
                  <p className="font-bold text-slate-900">{selectedHistoryModal.dibuat_oleh || '-'}</p>
                </div>
                {selectedHistoryModal.keterangan && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Catatan:</span>
                    <p className="font-medium text-slate-800">{selectedHistoryModal.keterangan}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase">Daftar Barang Dipindahkan</h4>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Nama Stock</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {selectedHistoryModal.items?.map((dt, i) => (
                        <tr key={dt.id}>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{i + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{dt.nama_stock}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                            {dt.qty} {dt.uom}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedHistoryModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
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
