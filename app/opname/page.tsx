'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
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
  Barcode,
  Scan,
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

  // Form Item Inputs (Select2 State)
  const [tipeOptions, setTipeOptions] = useState<SelectOption[]>([]);
  const [selectedTipe, setSelectedTipe] = useState<string>('');
  const [modelOptions, setModelOptions] = useState<SelectOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [ukuranOptions, setUkuranOptions] = useState<SelectOption[]>([]);
  const [selectedUkuran, setSelectedUkuran] = useState<string>('');
  const [selectedUom, setSelectedUom] = useState<string>('PCS');
  const [selectedStock, setSelectedStock] = useState<number>(0);
  const [stockVariants, setStockVariants] = useState<any[]>([]);

  // Barcode scanner state
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

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

  // 1. Fetch distinct Tipe options from tb_stock for Select2
  const fetchTipes = useCallback(async () => {
    try {
      const res = await fetch('/api/opname/products');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.tipes)) {
        setTipeOptions(data.tipes.map((t: string) => ({ value: t, label: t })));
      }
    } catch (e) {
      console.error('Failed to fetch tipes for opname:', e);
    }
  }, []);

  useEffect(() => {
    fetchTipes();
  }, [fetchTipes]);

  // 2. When Tipe (id_bahan) changes, fetch filtered models from tb_stock
  const handleSelectTipe = async (tipe: string) => {
    setSelectedTipe(tipe);
    setSelectedModel('');
    setSelectedUkuran('');
    setSelectedUom('PCS');
    setSelectedStock(0);
    setModelOptions([]);
    setUkuranOptions([]);
    setStockVariants([]);

    if (!tipe) return;

    try {
      const res = await fetch(`/api/opname/products?id_bahan=${encodeURIComponent(tipe)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const variants = data.stockVariants || [];
        setStockVariants(variants);

        const mOpts: SelectOption[] = (data.models || []).map((m: string) => ({ value: m, label: m }));
        setModelOptions(mOpts);

        // If only 1 model exists, auto-select it
        if (mOpts.length === 1) {
          handleSelectModel(mOpts[0].value, variants);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models for tipe:', err);
    }
  };

  // 3. When Model changes, filter ukurans for this Tipe + Model
  const handleSelectModel = (modelVal: string, variantsList?: any[]) => {
    setSelectedModel(modelVal);
    setSelectedUkuran('');
    setSelectedUom('PCS');
    setSelectedStock(0);

    if (!modelVal) {
      setUkuranOptions([]);
      return;
    }

    const variants = variantsList || stockVariants;
    const matching = variants.filter((v: any) => v.model === modelVal);
    const ukurans = Array.from(new Set(matching.map((v: any) => v.ukuran))).filter(Boolean);

    const uOpts: SelectOption[] = ukurans.map((u: any) => {
      const v = matching.find((x: any) => x.ukuran === u);
      const st = v ? Number(v.stock) || 0 : 0;
      const uom = v?.uom || 'PCS';
      return {
        value: u,
        label: `${u} (Stok: ${st} ${uom})`,
        subLabel: `Stok Sistem: ${st} ${uom}`,
      };
    });
    setUkuranOptions(uOpts);

    // If only 1 size exists, auto-select it
    if (uOpts.length === 1) {
      handleSelectUkuran(uOpts[0].value, matching);
    }
  };

  // 4. When Ukuran changes, set initial stock & uom
  const handleSelectUkuran = (ukuranVal: string, matchingList?: any[]) => {
    setSelectedUkuran(ukuranVal);
    if (!ukuranVal) {
      setSelectedUom('PCS');
      setSelectedStock(0);
      return;
    }

    const list = matchingList || stockVariants.filter((v: any) => v.model === selectedModel);
    const matched = list.find((v: any) => v.ukuran === ukuranVal);
    if (matched) {
      setSelectedUom(matched.uom || 'PCS');
      setSelectedStock(Number(matched.stock) || 0);
    }
  };

  // 5. Manual Add Item from Select2 Dropdowns
  const handleAddItem = () => {
    if (!selectedTipe) {
      showToast('error', 'Pilih Tipe / Nama Barang terlebih dahulu!');
      return;
    }
    if (!selectedModel) {
      showToast('error', 'Pilih Model terlebih dahulu!');
      return;
    }
    if (!selectedUkuran) {
      showToast('error', 'Pilih Ukuran terlebih dahulu!');
      return;
    }

    // Check if item already exists in formItems
    const existsIndex = formItems.findIndex(
      (it) =>
        it.id_product === selectedTipe &&
        it.model === selectedModel &&
        it.ukuran === selectedUkuran
    );

    if (existsIndex >= 0) {
      showToast(
        'error',
        `Barang "${selectedTipe} - ${selectedModel} (${selectedUkuran})" sudah ada di daftar opname (baris ke-${existsIndex + 1})!`
      );
      return;
    }

    const newItem: OpnameItem = {
      inv_in_id: 'new_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      id_product: selectedTipe,
      id_bahan: selectedTipe,
      model: selectedModel,
      ukuran: selectedUkuran,
      uom: selectedUom || 'PCS',
      stock_awal: selectedStock,
      stock_change: selectedStock, // default to stock_awal so user just edits real stock
      stock_opname: 0,
    };

    setFormItems((prev) => [newItem, ...prev]);
    showToast('success', `Berhasil menambahkan: ${selectedTipe} - ${selectedModel} (${selectedUkuran})`);

    // Reset ukuran & stock preview (keep Tipe & Model for fast sequential size addition)
    setSelectedUkuran('');
    setSelectedStock(0);
  };

  // 6. Barcode Scanner Handler
  const barcodeInputStateRef = useRef('');
  barcodeInputStateRef.current = barcodeInput;

  const handleBarcodeScan = useCallback(
    async (codeToProcess?: string) => {
      const raw = (codeToProcess || barcodeInputRef.current?.value || barcodeInputStateRef.current).trim();
      if (!raw) return;

      // Ensure input displays the scanned code
      setBarcodeInput(raw);
      if (barcodeInputRef.current) barcodeInputRef.current.value = raw;

      setIsScanning(true);
      try {
        const res = await fetch(`/api/opname/products?barcode=${encodeURIComponent(raw)}`);
        const data = await res.json();

        if (res.ok && data.success && data.item) {
          const item = data.item;
          const existsIndex = formItems.findIndex(
            (it) =>
              it.id_product === item.id_bahan &&
              it.model === item.model &&
              it.ukuran === item.ukuran
          );

          if (existsIndex >= 0) {
            showToast(
              'error',
              `Barang "${item.id_bahan} - ${item.model} (${item.ukuran})" sudah ada di daftar opname (baris ke-${existsIndex + 1})!`
            );
          } else {
            const newItem: OpnameItem = {
              inv_in_id: 'new_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              id_product: item.id_bahan,
              id_bahan: item.id_bahan,
              model: item.model || 'Diskon',
              ukuran: item.ukuran || '#',
              uom: item.uom || 'PCS',
              stock_awal: item.stock,
              stock_change: item.stock,
              stock_opname: 0,
            };

            setFormItems((prev) => [newItem, ...prev]);
            showToast(
              'success',
              `Berhasil menambahkan: ${item.id_bahan} - ${item.model} (${item.ukuran}) | Stok Awal: ${item.stock} ${item.uom}`
            );
          }
          setBarcodeInput('');
          if (barcodeInputRef.current) barcodeInputRef.current.value = '';
          setTimeout(() => {
            barcodeInputRef.current?.focus();
          }, 50);
        } else {
          showToast('error', data.message || `Barcode "${raw}" tidak ditemukan di database.`);
          setBarcodeInput('');
          if (barcodeInputRef.current) barcodeInputRef.current.value = '';
          setTimeout(() => {
            barcodeInputRef.current?.focus();
          }, 50);
        }
      } catch {
        showToast('error', 'Gagal memproses scan barcode.');
      } finally {
        setIsScanning(false);
      }
    },
    [formItems]
  );

  // Auto focus barcode input when modal opens
  useEffect(() => {
    if (modalOpen && !isReadOnly) {
      const timers = [
        setTimeout(() => barcodeInputRef.current?.focus(), 50),
        setTimeout(() => barcodeInputRef.current?.focus(), 150),
        setTimeout(() => barcodeInputRef.current?.focus(), 300),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [modalOpen, isReadOnly]);

  // 7. Global Barcode Scanner Listener while modal is open
  useEffect(() => {
    if (!modalOpen || isReadOnly) return;

    let barcodeBuffer = '';
    let lastKeyTime = 0;
    let autoScanTimer: NodeJS.Timeout | null = null;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't intercept if user is typing in a textarea or number input (e.g. Qty Baru or Keterangan)
      if (target && (target.tagName === 'TEXTAREA' || target.getAttribute('type') === 'number')) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const isKeyJ = e.key === 'j' || e.key === 'J' || e.keyCode === 74 || e.which === 74;
      const isLF = e.key === 'LineFeed' || e.key === 'Linefeed' || e.keyCode === 10 || e.which === 10;
      const isEnter = e.key === 'Enter' || e.keyCode === 13 || e.which === 13;
      const isTab = e.key === 'Tab' || e.keyCode === 9;

      // 1. Prevent Chrome downloads on Ctrl+J / Linefeed from scanners
      if ((isCtrlOrMeta && isKeyJ) || isLF) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof (e as any).stopImmediatePropagation === 'function') {
          (e as any).stopImmediatePropagation();
        }

        const domVal = barcodeInputRef.current?.value || '';
        const codeToProcess = (barcodeBuffer.trim() || domVal.trim() || barcodeInputStateRef.current.trim());
        barcodeBuffer = '';
        if (codeToProcess.length >= 3) {
          handleBarcodeScan(codeToProcess);
        }
        return;
      }

      // 2. Handle Enter or Tab (barcode scanner termination)
      if (isEnter || isTab) {
        const domVal = barcodeInputRef.current?.value || '';
        const codeToProcess = (barcodeBuffer.trim() || domVal.trim() || barcodeInputStateRef.current.trim());
        barcodeBuffer = '';
        if (codeToProcess.length >= 3) {
          e.preventDefault();
          e.stopPropagation();
          handleBarcodeScan(codeToProcess);
          return;
        }
        return;
      }

      // 3. Track fast keypress from scanner
      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;
      const isFast = timeDiff < 60;

      if (e.key && e.key.length === 1 && !isCtrlOrMeta && !e.altKey) {
        if (target === barcodeInputRef.current) {
          barcodeBuffer += e.key;
        } else {
          // If focus is NOT on barcode input, focus it and redirect characters into it
          if (timeDiff > 120) {
            barcodeBuffer = e.key;
          } else {
            barcodeBuffer += e.key;
          }
          setBarcodeInput(barcodeBuffer);
          if (barcodeInputRef.current) barcodeInputRef.current.value = barcodeBuffer;
          barcodeInputRef.current?.focus();
        }

        // Auto-scan timer if scanner typed rapidly without sending Enter
        if (autoScanTimer) clearTimeout(autoScanTimer);
        if (isFast || barcodeBuffer.length >= 6) {
          autoScanTimer = setTimeout(() => {
            const domVal = barcodeInputRef.current?.value || '';
            const codeToProcess = (barcodeBuffer.trim() || domVal.trim() || barcodeInputStateRef.current.trim());
            if (codeToProcess.length >= 6) {
              barcodeBuffer = '';
              handleBarcodeScan(codeToProcess);
            }
          }, 150);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      if (autoScanTimer) clearTimeout(autoScanTimer);
    };
  }, [modalOpen, isReadOnly, handleBarcodeScan]);

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
    setSelectedTipe('');
    setSelectedModel('');
    setSelectedUkuran('');
    setSelectedUom('PCS');
    setSelectedStock(0);
    setModelOptions([]);
    setUkuranOptions([]);
    setStockVariants([]);
    setBarcodeInput('');
    setModalOpen(true);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
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
        setSelectedTipe('');
        setSelectedModel('');
        setSelectedUkuran('');
        setSelectedUom('PCS');
        setSelectedStock(0);
        setModelOptions([]);
        setUkuranOptions([]);
        setStockVariants([]);
        setBarcodeInput('');
        setModalOpen(true);
        if (!readOnly && tx.status !== 's') {
          setTimeout(() => {
            barcodeInputRef.current?.focus();
          }, 100);
        }
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
                <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-200/80 space-y-4">
                  {/* 1. BARCODE SCANNER SECTION */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-700 flex items-center space-x-1.5">
                        <Barcode className="w-4 h-4 text-emerald-600" />
                        <span>Scan Barcode Produk</span>
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <Scan className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          autoFocus
                          ref={barcodeInputRef}
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.keyCode === 13) {
                              e.preventDefault();
                              e.stopPropagation();
                              const val = (e.currentTarget.value || barcodeInput).trim();
                              if (val) handleBarcodeScan(val);
                            }
                          }}
                          placeholder="Scan barcode produk di sini..."
                          className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium shadow-2xs"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isScanning || !barcodeInput.trim()}
                        onClick={() => {
                          const val = (barcodeInputRef.current?.value || barcodeInput).trim();
                          if (val) handleBarcodeScan(val);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
                      >
                        <Scan className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                        <span>{isScanning ? 'Mencari...' : 'Scan Barcode'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="h-px bg-emerald-200/70 flex-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/80">
                      atau pilih manual via select 2
                    </span>
                    <div className="h-px bg-emerald-200/70 flex-1" />
                  </div>

                  {/* 2. SELECT2 INPUTS (TIPE, MODEL, UKURAN, UOM) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                    {/* Select 2: Tipe / Nama Barang */}
                    <div className="lg:col-span-4 sm:col-span-6">
                      <SearchableSelect
                        options={tipeOptions}
                        value={selectedTipe}
                        onChange={handleSelectTipe}
                        placeholder="Pilih Tipe / Nama Barang..."
                        searchPlaceholder="Ketik untuk mencari tipe..."
                        label="Tipe / Nama Barang (id_bahan)"
                        icon={<Package className="w-3.5 h-3.5 text-emerald-600" />}
                      />
                    </div>

                    {/* Select 2: Model (Filtered by selected Tipe) */}
                    <div className="lg:col-span-3 sm:col-span-6">
                      <SearchableSelect
                        options={modelOptions}
                        value={selectedModel}
                        onChange={(val) => handleSelectModel(val)}
                        placeholder={selectedTipe ? 'Pilih Model...' : 'Pilih Tipe dahulu'}
                        searchPlaceholder="Ketik untuk mencari model..."
                        disabled={!selectedTipe || modelOptions.length === 0}
                        label="Model"
                        icon={<Layers className="w-3.5 h-3.5 text-emerald-600" />}
                      />
                    </div>

                    {/* Select 2: Ukuran (Filtered by selected Model) */}
                    <div className="lg:col-span-2 sm:col-span-4">
                      <SearchableSelect
                        options={ukuranOptions}
                        value={selectedUkuran}
                        onChange={(val) => handleSelectUkuran(val)}
                        placeholder={selectedModel ? 'Pilih Ukuran...' : 'Pilih Model'}
                        searchPlaceholder="Cari ukuran..."
                        disabled={!selectedModel || ukuranOptions.length === 0}
                        label="Ukuran"
                      />
                    </div>

                    {/* UOM & Stok Sistem Badge */}
                    <div className="lg:col-span-2 sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        UOM / Stok
                      </label>
                      <div className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs min-h-[38px]">
                        <span className="font-semibold text-slate-600">{selectedUom || 'PCS'}</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                          {selectedStock} Pcs
                        </span>
                      </div>
                    </div>

                    {/* Button Tambah */}
                    <div className="lg:col-span-1 sm:col-span-4 flex">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedTipe || !selectedModel || !selectedUkuran}
                        className="w-full h-[38px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center space-x-1 shadow-xs"
                        title="Tambah ke daftar opname"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="lg:hidden text-xs">Tambah</span>
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
