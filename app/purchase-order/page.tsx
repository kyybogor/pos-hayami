'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
import ExcelJS from 'exceljs';
import {
  ClipboardList,
  Search,
  RefreshCw,
  Plus,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  Building2,
  X,
  FileText,
  Clock,
  Layers,
  Upload,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  Camera,
} from 'lucide-react';

interface BarangItem {
  no_id?: string;
  id_product: string; // Tipe
  model: string;
  ukuran: string; // Size
  qty: number;
  uom: string;
  harga?: number;
  subtotal?: number;
  image?: string;
}

interface PurchaseOrderTransaction {
  id_transaksi: string;
  tgl_transaksi: string;
  id_supplier: string;
  nama_supplier: string;
  status: string; // 'd' = Draft, 's' = Close/Diterima
  keterangan: string;
  status_lunas: number;
  jenis: string;
  id_cabang: string;
  total_qty: number;
  total_nilai?: number;
  items: BarangItem[];
}

interface FormOptionData {
  bahans: string[];
  models: string[];
  sizes: string[];
  suppliers: { id: string; nama: string }[];
}

export default function PurchaseOrderPage() {
  const [transactions, setTransactions] = useState<PurchaseOrderTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [invKeyword, setInvKeyword] = useState('');

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Modal State for viewing all items popup
  const [selectedTx, setSelectedTx] = useState<PurchaseOrderTransaction | null>(null);

  // Modal State for Create New PO
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formOptions, setFormOptions] = useState<FormOptionData>({
    bahans: [],
    models: [],
    sizes: [],
    suppliers: [],
  });
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form Fields
  const [formTgl, setFormTgl] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [formSupplier, setFormSupplier] = useState('Hayami');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formItems, setFormItems] = useState<BarangItem[]>([]);

  // Current Item Input Line
  const [inputTipe, setInputTipe] = useState('');
  const [inputModel, setInputModel] = useState('');
  const [inputSize, setInputSize] = useState('');
  const [inputQty, setInputQty] = useState('');
  const [inputHarga, setInputHarga] = useState('');
  const [inputImage, setInputImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Excel and Row Image upload states
  const [importingExcel, setImportingExcel] = useState(false);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const excelFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const rowFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const activeRowImageIndexRef = React.useRef<number | null>(null);

  // Toast alert
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Load session & cabang
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

  // 2. Fetch PO Transactions (jenis = 1)
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

      const res = await fetch(`/api/purchase-order?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTransactions(data.data || []);
      } else {
        showToast('error', data.message || 'Gagal memuat data Purchase Order.');
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

  // 3. Load Form Options for Tipe (id_bahan), Model, Size
  const loadFormOptions = async () => {
    if (formOptions.bahans.length > 0) return;
    setLoadingOptions(true);
    try {
      const res = await fetch('/api/purchase-order?options=true');
      const json = await res.json();
      if (json.success && json.data) {
        setFormOptions(json.data);
      }
    } catch (err) {
      console.error('Error loading PO form options:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleOpenCreateModal = () => {
    setFormTgl(new Date().toISOString().split('T')[0]);
    setFormSupplier('Hayami');
    setFormKeterangan('');
    setFormItems([]);
    setInputTipe('');
    setInputModel('');
    setInputSize('');
    setInputQty('');
    setInputHarga('');
    setShowCreateModal(true);
    loadFormOptions();
  };

  // Download Template Excel for Purchase Order
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'POS Hayami';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Template PO', {
        views: [{ showGridLines: true }],
      });

      // Kolom Header
      ws.columns = [
        { header: 'Tipe (id_product) *', key: 'tipe', width: 28 },
        { header: 'Model', key: 'model', width: 24 },
        { header: 'Size (Ukuran)', key: 'ukuran', width: 18 },
        { header: 'Qty *', key: 'qty', width: 14 },
        { header: 'Harga Satuan (Rp) *', key: 'harga', width: 22 },
      ];

      // Styling Header Row
      const headerRow = ws.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF059669' }, // Emerald-600
        };
        cell.font = {
          name: 'Segoe UI',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF047857' } },
          bottom: { style: 'medium', color: { argb: 'FF047857' } },
          left: { style: 'thin', color: { argb: 'FF047857' } },
          right: { style: 'thin', color: { argb: 'FF047857' } },
        };
      });

      // Set column number formats
      ws.getColumn(4).numFmt = '#,##0';
      ws.getColumn(5).numFmt = '#,##0';

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Template_Purchase_Order.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('success', 'Template Excel Purchase Order berhasil diunduh.');
    } catch (err) {
      console.error('Error downloading template Excel:', err);
      alert('Gagal mengunduh template Excel.');
    }
  };

  // Upload & Parse Excel PO
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingExcel(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        alert('File Excel kosong atau tidak memiliki lembar kerja (worksheet).');
        return;
      }

      let headerRowIdx = -1;
      let colTipe = -1;
      let colModel = -1;
      let colSize = -1;
      let colQty = -1;
      let colHarga = -1;

      // Scan 10 baris pertama untuk mendeteksi header
      worksheet.eachRow((row, rowNumber) => {
        if (headerRowIdx !== -1 || rowNumber > 10) return;

        row.eachCell((cell, colNumber) => {
          const val = String(cell.value || '').toLowerCase().trim();
          if (val.includes('tipe') || val.includes('product') || val.includes('bahan')) {
            colTipe = colNumber;
          } else if (val.includes('model')) {
            colModel = colNumber;
          } else if (val.includes('size') || val.includes('ukuran')) {
            colSize = colNumber;
          } else if (val.includes('qty') || val.includes('jumlah') || val.includes('kuantitas')) {
            colQty = colNumber;
          } else if (val.includes('harga') || val.includes('price')) {
            colHarga = colNumber;
          }
        });

        if (colTipe !== -1 && colQty !== -1) {
          headerRowIdx = rowNumber;
        }
      });

      // Default jika header tidak terdeteksi otomatis
      if (headerRowIdx === -1) {
        headerRowIdx = 1;
        colTipe = 1;
        colModel = 2;
        colSize = 3;
        colQty = 4;
        colHarga = 5;
      }

      const getCellValueString = (cell: ExcelJS.Cell | undefined): string => {
        if (!cell || cell.value === null || cell.value === undefined) return '';
        if (typeof cell.value === 'object') {
          if ('result' in cell.value && cell.value.result !== undefined && cell.value.result !== null) {
            return String(cell.value.result).trim();
          }
          if ('text' in cell.value && cell.value.text) {
            return String(cell.value.text).trim();
          }
          if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
            return (cell.value as any).richText.map((rt: any) => rt.text || '').join('').trim();
          }
        }
        return String(cell.value).trim();
      };

      const getCellValueNumber = (cell: ExcelJS.Cell | undefined): number => {
        if (!cell || cell.value === null || cell.value === undefined) return 0;
        if (typeof cell.value === 'number') return cell.value;
        if (typeof cell.value === 'object' && 'result' in cell.value && typeof cell.value.result === 'number') {
          return cell.value.result;
        }
        const str = getCellValueString(cell);
        if (!str) return 0;
        const clean = str.replace(/[^0-9.,]/g, '');
        if (!clean) return 0;

        let normalized = clean;
        if (normalized.includes('.') && normalized.includes(',')) {
          normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else if (normalized.includes('.')) {
          const parts = normalized.split('.');
          if (parts.length > 1 && parts.every((p, i) => i === 0 || p.length === 3)) {
            normalized = normalized.replace(/\./g, '');
          }
        } else if (normalized.includes(',')) {
          const parts = normalized.split(',');
          if (parts.length > 1 && parts.every((p, i) => i === 0 || p.length === 3)) {
            normalized = normalized.replace(/,/g, '');
          } else {
            normalized = normalized.replace(',', '.');
          }
        }
        const num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
      };

      const newItems: BarangItem[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIdx) return;

        const rawTipe = getCellValueString(row.getCell(colTipe));
        if (
          !rawTipe ||
          rawTipe.startsWith('*') ||
          rawTipe.toLowerCase().includes('catatan') ||
          rawTipe.toLowerCase().includes('keterangan')
        ) {
          return;
        }

        const rawModel = colModel !== -1 ? getCellValueString(row.getCell(colModel)) : '';
        const rawSize = colSize !== -1 ? getCellValueString(row.getCell(colSize)) : '';
        const rawQty = colQty !== -1 ? getCellValueNumber(row.getCell(colQty)) : 0;
        const rawHarga = colHarga !== -1 ? getCellValueNumber(row.getCell(colHarga)) : 0;

        if (rawQty <= 0) return;

        newItems.push({
          id_product: rawTipe,
          model: rawModel,
          ukuran: rawSize,
          qty: Math.round(rawQty),
          uom: 'PCS',
          harga: rawHarga,
          subtotal: Math.round(rawQty) * rawHarga,
          image: '',
        });
      });

      if (newItems.length === 0) {
        alert('Tidak ada data barang yang valid ditemukan di file Excel. Pastikan mengisi Tipe dan Qty lebih dari 0.');
        return;
      }

      setFormItems((prev) => [...prev, ...newItems]);
      setShowCreateModal(true);
      loadFormOptions();
      showToast('success', `Berhasil mengimpor ${newItems.length} item dari file Excel!`);
    } catch (err: any) {
      console.error('Error importing Excel:', err);
      alert('Gagal membaca file Excel. Pastikan file berformat .xlsx atau .xls yang valid.');
    } finally {
      setImportingExcel(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = '';
      }
    }
  };

  // Upload / Change photo for a specific row in the items table
  const handleTriggerRowImageUpload = (index: number) => {
    activeRowImageIndexRef.current = index;
    if (rowFileInputRef.current) {
      rowFileInputRef.current.value = '';
      rowFileInputRef.current.click();
    }
  };

  const handleRowImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetIdx = activeRowImageIndexRef.current;
    if (!file || targetIdx === null || targetIdx === undefined) return;

    setUploadingRowIndex(targetIdx);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFormItems((prev) => {
          const updated = [...prev];
          if (updated[targetIdx]) {
            updated[targetIdx] = { ...updated[targetIdx], image: data.url };
          }
          return updated;
        });
        showToast('success', 'Foto barang berhasil diupload.');
      } else {
        alert(data.message || 'Gagal mengupload foto.');
      }
    } catch (err) {
      console.error('Error uploading row image:', err);
      alert('Terjadi kesalahan koneksi saat mengupload foto.');
    } finally {
      setUploadingRowIndex(null);
      if (rowFileInputRef.current) {
        rowFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveRowImage = (index: number) => {
    setFormItems((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], image: '' };
      }
      return updated;
    });
    showToast('success', 'Foto barang dihapus.');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInputImage(data.url);
        showToast('success', 'Gambar barang berhasil diupload.');
      } else {
        alert(data.message || 'Gagal mengupload gambar.');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Terjadi kesalahan koneksi saat mengupload gambar.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTipe.trim()) {
      alert('Pilih atau ketik Tipe barang terlebih dahulu');
      return;
    }
    const qtyNum = parseInt(inputQty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Masukkan Qty yang valid (lebih dari 0)');
      return;
    }

    const hargaNum = parseFloat(inputHarga.replace(/[^0-9.]/g, '')) || 0;
    const subtotalNum = qtyNum * hargaNum;

    const newItem: BarangItem = {
      id_product: inputTipe.trim(),
      model: inputModel.trim(),
      ukuran: inputSize.trim(),
      qty: qtyNum,
      uom: 'PCS',
      harga: hargaNum,
      subtotal: subtotalNum,
      image: inputImage.trim(),
    };

    setFormItems((prev) => [...prev, newItem]);

    // Reset input fields for next item
    setInputTipe('');
    setInputModel('');
    setInputSize('');
    setInputQty('');
    setInputHarga('');
    setInputImage('');
  };

  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitPO = async () => {
    if (formItems.length === 0) {
      alert('Tambahkan minimal 1 item barang ke daftar Purchase Order');
      return;
    }

    setSubmitting(true);
    try {
      const branchToUse = selectedCabang !== 'ALL' ? selectedCabang : (currentUser?.branch || '');
      const res = await fetch('/api/purchase-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgl_transaksi: formTgl,
          id_supplier: formSupplier,
          keterangan: formKeterangan,
          items: formItems,
          id_cabang: branchToUse,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast('success', 'Purchase Order berhasil dibuat!');
        setShowCreateModal(false);
        fetchTransactions();
      } else {
        alert(json.message || 'Gagal menyimpan Purchase Order');
      }
    } catch (err: any) {
      console.error('Error submit PO:', err);
      alert('Terjadi kesalahan jaringan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePO = async (id_transaksi: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus Purchase Order ${id_transaksi}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/purchase-order?id_transaksi=${encodeURIComponent(id_transaksi)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Purchase Order berhasil dihapus');
        fetchTransactions();
      } else {
        alert(json.message || 'Gagal menghapus Purchase Order');
      }
    } catch {
      alert('Terjadi kesalahan koneksi');
    }
  };

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

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '-';
    const clean = String(dateStr).trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
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

  const formatRupiah = (val?: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Convert options to SelectOption format
  const tipeOptions: SelectOption[] = formOptions.bahans.map((b) => ({ value: b, label: b }));
  const modelOptions: SelectOption[] = formOptions.models.map((m) => ({ value: m, label: m }));
  const sizeOptions: SelectOption[] = formOptions.sizes.map((s) => ({ value: s, label: s }));

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
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Order</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Jenis = 1
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pencatatan Purchase Order (PO) masuk. Penerimaan & otorisasi fisik stok dilakukan di menu Inbound List.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Purchase Order</span>
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
            <Search className="w-4 h-4 text-emerald-600" />
            <span>Filter Purchase Order</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Cabang Filter */}
            {isSuperAdmin && (
              <div className="lg:col-span-3 space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Cabang Toko</label>
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

            {/* Dari Tanggal */}
            <div className={isSuperAdmin ? 'lg:col-span-3 space-y-1' : 'lg:col-span-4 space-y-1'}>
              <label className="block text-xs font-semibold text-slate-700">Dari Tanggal</label>
              <div className="relative">
                <input
                  type="date"
                  value={tglFrom}
                  onChange={(e) => setTglFrom(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Sampai Tanggal */}
            <div className={isSuperAdmin ? 'lg:col-span-3 space-y-1' : 'lg:col-span-4 space-y-1'}>
              <label className="block text-xs font-semibold text-slate-700">Sampai Tanggal</label>
              <div className="relative">
                <input
                  type="date"
                  value={tglTo}
                  onChange={(e) => setTglTo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Keyword Search */}
            <div className={isSuperAdmin ? 'lg:col-span-3 space-y-1' : 'lg:col-span-4 space-y-1'}>
              <label className="block text-xs font-semibold text-slate-700">Cari No. PO / Keterangan</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik No. PO atau Keterangan..."
                  value={invKeyword}
                  onChange={(e) => setInvKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleResetFilter}
              type="button"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={fetchTransactions}
              type="button"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cari Data</span>
            </button>
          </div>
        </div>

        {/* Data Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-800 text-white font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 text-center w-12">No.</th>
                  <th className="py-3 px-4 text-center w-28">Tanggal</th>
                  <th className="py-3 px-4 text-center min-w-[170px]">No. Transaksi (PO)</th>
                  <th className="py-3 px-4 min-w-[150px]">Supplier</th>
                  <th className="py-3 px-4 min-w-[280px]">Rincian Barang</th>
                  <th className="py-3 px-4 text-center w-24">Total Qty</th>
                  <th className="py-3 px-4 text-right min-w-[130px]">Total Nilai</th>
                  <th className="py-3 px-4 min-w-[180px]">Keterangan</th>
                  <th className="py-3 px-4 text-center w-28">Status</th>
                  <th className="py-3 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                        <span className="text-sm font-medium">Memuat data Purchase Order...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Package className="w-10 h-10 text-slate-300" />
                        <span className="text-base font-semibold text-slate-700">
                          Belum ada data Purchase Order
                        </span>
                        <span className="text-xs text-slate-400">
                          Klik tombol &quot;Tambah Purchase Order&quot; di atas untuk membuat PO baru.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => {
                    const isDraft = tx.status === 'd';
                    const visibleItems = tx.items.slice(0, 3);
                    const extraItemsCount = tx.items.length - visibleItems.length;

                    return (
                      <tr
                        key={`${tx.id_transaksi}-${idx}`}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => setSelectedTx(tx)}
                      >
                        <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                          {formatDateStr(tx.tgl_transaksi)}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-700">
                          {tx.id_transaksi}
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {tx.nama_supplier}
                        </td>

                        {/* Rincian Barang Preview */}
                        <td className="py-3.5 px-4">
                          {tx.items.length === 0 ? (
                            <span className="text-slate-400 italic">(Tidak ada barang)</span>
                          ) : (
                            <div className="space-y-1">
                              <ul className="space-y-1 list-disc list-inside text-slate-700 text-xs">
                                {visibleItems.map((it, itemIdx) => (
                                  <li key={itemIdx} className="leading-tight">
                                    <span className="font-semibold text-slate-900">{it.id_product}</span>
                                    {it.model && <span className="text-slate-600"> - {it.model}</span>}
                                    {it.ukuran && <span className="text-slate-600"> ({it.ukuran})</span>}
                                    <span className="font-mono text-emerald-700 font-bold ml-1">
                                      x {it.qty} {it.uom}
                                    </span>
                                    {it.harga ? (
                                      <span className="font-mono text-slate-500 text-[11px] ml-1">
                                        (@ {formatRupiah(it.harga)})
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                              {extraItemsCount > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTx(tx);
                                  }}
                                  className="inline-flex items-center space-x-1 mt-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>+ {extraItemsCount} Barang Lagi</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Total Qty */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-800 text-sm">
                          {tx.total_qty}
                        </td>

                        {/* Total Nilai */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                          {formatRupiah(tx.total_nilai)}
                        </td>

                        {/* Keterangan */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-normal break-words max-w-[200px]">
                          {tx.keterangan || '-'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isDraft ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 mr-1" />
                              Draft PO
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Diterima
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td
                          className="py-3.5 px-4 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTx(tx)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Lihat Detail Barang"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {isDraft && (
                              <button
                                type="button"
                                onClick={() => handleDeletePO(tx.id_transaksi)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Draft PO"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

        {/* MODAL VIEW DETAIL BARANG PO */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Detail Purchase Order</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      No. PO: <span className="font-bold text-slate-800">{selectedTx.id_transaksi}</span> ({selectedTx.items.length} Macam Barang)
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

              {/* Transaction Meta Info */}
              <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Tanggal</span>
                  <span className="font-medium text-slate-800">{formatDateStr(selectedTx.tgl_transaksi)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Supplier</span>
                  <span className="font-medium text-slate-800">{selectedTx.nama_supplier}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cabang</span>
                  <span className="font-medium text-slate-800">{selectedTx.id_cabang}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className={`font-bold ${selectedTx.status === 'd' ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {selectedTx.status === 'd' ? 'Draft PO (Belum Masuk Stok)' : 'Selesai / Diterima'}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="p-6 overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-y border-slate-200 font-bold text-slate-700 uppercase text-[11px]">
                      <th className="py-2.5 px-3 text-center w-12">No.</th>
                      <th className="py-2.5 px-3 text-center w-14">Foto</th>
                      <th className="py-2.5 px-3">Tipe (id_product)</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3 text-center">Ukuran (Size)</th>
                      <th className="py-2.5 px-3 text-center w-20">Qty</th>
                      <th className="py-2.5 px-3 text-center w-16">UOM</th>
                      <th className="py-2.5 px-3 text-right w-28">Harga</th>
                      <th className="py-2.5 px-3 text-right w-32">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedTx.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-center">
                          {it.image ? (
                            <img
                              src={it.image}
                              alt={it.model}
                              onClick={() => setPreviewImage(it.image || null)}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 mx-auto shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                              title="Klik untuk memperbesar gambar"
                            />
                          ) : (
                            <span className="text-[11px] text-slate-300 italic">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{it.id_product}</td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium">{it.model || '-'}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-800 font-semibold">{it.ukuran || '-'}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700 font-mono text-sm">
                          {it.qty}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 font-mono">{it.uom}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatRupiah(it.harga)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatRupiah(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                      <td colSpan={5} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-500">
                        Total:
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-800 text-sm">
                        {selectedTx.total_qty}
                      </td>
                      <td></td>
                      <td></td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm">
                        {formatRupiah(selectedTx.total_nilai || selectedTx.items.reduce((acc, it) => acc + (it.subtotal || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {selectedTx.keterangan && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 block mb-0.5">Catatan / Keterangan:</span>
                    <p className="text-slate-600">{selectedTx.keterangan}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end text-xs">
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

        {/* MODAL TAMBAH PURCHASE ORDER BARU */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Tambah Purchase Order (PO) Baru
                    </h2>
                    <p className="text-xs text-slate-500">
                      Simpan pesanan pembelian ke <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-800 font-mono font-bold">tb_barang_masuk</code> dengan jenis = 1
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Header Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Tanggal Transaksi</label>
                  <input
                    type="date"
                    value={formTgl}
                    onChange={(e) => setFormTgl(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Supplier</label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Contoh: Hayami"
                    className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Keterangan / Catatan PO</label>
                  <input
                    type="text"
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    placeholder="Contoh: PO Bahan Toko Oktober..."
                    className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Excel Import & Template Card */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-slate-50 p-3.5 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <span>Import Daftar Barang via Excel</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                        Cepat & Otomatis
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Kolom Excel: <strong>Tipe, Model, Size, Qty, Harga</strong>. Foto barang dapat di-upload per item langsung di tabel bawah setelah diimpor.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                    title="Unduh format template Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Download Template</span>
                  </button>
                  <button
                    type="button"
                    disabled={importingExcel}
                    onClick={() => excelFileInputRef.current?.click()}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {importingExcel ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{importingExcel ? 'Mengimpor...' : 'Upload Excel'}</span>
                  </button>
                </div>
              </div>

              {/* Input Item Builder Section */}
              <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-emerald-900 tracking-wider flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Input Barang PO (Ketik untuk mencari atau gunakan barang baru)</span>
                  </h3>
                  {loadingOptions && (
                    <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                      <span>Memuat master stok...</span>
                    </span>
                  )}
                </div>

                <form onSubmit={handleAddItem} className="space-y-3">
                  {/* Baris 1: Tipe, Model, Size */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Input Tipe (Select from tb_stock.id_bahan or custom) */}
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Tipe (id_bahan) <span className="text-rose-500">*</span>
                      </label>
                      <SearchableSelect
                        options={tipeOptions}
                        value={inputTipe}
                        onChange={(val) => setInputTipe(val)}
                        placeholder="Pilih atau ketik tipe..."
                        searchPlaceholder="Cari / ketik tipe baru..."
                        allowCustom={true}
                      />
                    </div>

                    {/* Input Model (Select from tb_stock.model or custom) */}
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Model</label>
                      <SearchableSelect
                        options={modelOptions}
                        value={inputModel}
                        onChange={(val) => setInputModel(val)}
                        placeholder="Pilih atau ketik model..."
                        searchPlaceholder="Cari / ketik model baru..."
                        allowCustom={true}
                      />
                    </div>

                    {/* Input Size (Select from m_size.nm_size or custom) */}
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">Size (Ukuran)</label>
                      <SearchableSelect
                        options={sizeOptions}
                        value={inputSize}
                        onChange={(val) => setInputSize(val)}
                        placeholder="Pilih size..."
                        searchPlaceholder="Cari size..."
                        allowCustom={true}
                      />
                    </div>
                  </div>

                  {/* Baris 2: Qty, Harga Satuan, Upload Foto, Tombol Tambah Item */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Input Qty */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Qty <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={inputQty}
                        onChange={(e) => setInputQty(e.target.value)}
                        placeholder="0"
                        className="w-full px-2 py-2 text-xs md:text-sm font-bold font-mono text-center bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>

                    {/* Input Harga Satuan */}
                    <div className="sm:col-span-3 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Harga Satuan (Rp) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-[11px] font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={inputHarga}
                          onChange={(e) => setInputHarga(e.target.value)}
                          placeholder="0"
                          className="w-full pl-8 pr-2 py-2 text-xs md:text-sm font-bold font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Upload Foto Barang Baru */}
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Foto Barang Baru (Opsional)</span>
                        {inputImage && (
                          <span className="text-[10px] text-emerald-600 font-semibold">Tersimpan</span>
                        )}
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {inputImage ? (
                        <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-emerald-300 rounded-xl shadow-2xs">
                          <div className="flex items-center space-x-2 overflow-hidden">
                            <img
                              src={inputImage}
                              alt="Preview"
                              className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                            <span className="text-xs text-slate-700 font-mono truncate max-w-[120px]">
                              {inputImage.split('/').pop()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInputImage('')}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Hapus foto"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={uploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {uploadingImage ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              <span>Mengupload...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 text-slate-500" />
                              <span>Upload Gambar</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Add Button */}
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Item</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Items List Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Daftar Barang yang Dimasukkan ({formItems.length} Item)</span>
                  {formItems.length > 0 && (
                    <div className="flex items-center space-x-3 text-emerald-800 font-mono text-xs">
                      <span>Total Qty: <strong className="text-emerald-700 font-bold">{formItems.reduce((acc, it) => acc + it.qty, 0)} PCS</strong></span>
                      <span>•</span>
                      <span>Total Nilai: <strong className="text-emerald-700 font-bold">{formatRupiah(formItems.reduce((acc, it) => acc + (it.subtotal || 0), 0))}</strong></span>
                    </div>
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 z-10 shadow-2xs">
                      <tr className="border-b border-slate-200 font-bold text-slate-700">
                        <th className="py-2.5 px-3 text-center w-10">No.</th>
                        <th className="py-2.5 px-3 text-center w-28">Foto Barang</th>
                        <th className="py-2.5 px-3">Tipe Barang</th>
                        <th className="py-2.5 px-3">Model</th>
                        <th className="py-2.5 px-3 text-center">Size</th>
                        <th className="py-2.5 px-3 text-center w-20">Qty</th>
                        <th className="py-2.5 px-3 text-right w-28">Harga</th>
                        <th className="py-2.5 px-3 text-right w-32">Subtotal</th>
                        <th className="py-2.5 px-3 text-center w-14">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {formItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                            Belum ada barang yang ditambahkan. Silakan gunakan formulir input di atas atau klik &quot;Upload Excel&quot; untuk mengimpor banyak item sekaligus.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>

                            {/* Foto Barang with Upload / Change per row */}
                            <td className="py-2 px-3 text-center">
                              {item.image ? (
                                <div className="inline-flex flex-col items-center">
                                  <img
                                    src={item.image}
                                    alt={item.model || item.id_product}
                                    onClick={() => setPreviewImage(item.image || null)}
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                                    title="Klik untuk melihat foto lebih besar"
                                  />
                                  <div className="flex items-center space-x-1.5 mt-0.5">
                                    <button
                                      type="button"
                                      disabled={uploadingRowIndex === idx}
                                      onClick={() => handleTriggerRowImageUpload(idx)}
                                      className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold hover:underline cursor-pointer"
                                      title="Ganti foto ini"
                                    >
                                      {uploadingRowIndex === idx ? '...' : 'Ganti'}
                                    </button>
                                    <span className="text-slate-300 text-[10px]">•</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRowImage(idx)}
                                      className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                                      title="Hapus foto ini"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={uploadingRowIndex === idx}
                                  onClick={() => handleTriggerRowImageUpload(idx)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-emerald-50 active:bg-emerald-100 text-slate-600 hover:text-emerald-700 border border-dashed border-slate-300 hover:border-emerald-400 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-2xs group"
                                  title="Upload foto untuk item ini"
                                >
                                  {uploadingRowIndex === idx ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                      <span className="text-[10px] text-emerald-600">Upload...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Camera className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600" />
                                      <span>+ Foto</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </td>

                            <td className="py-2 px-3 font-bold text-slate-900">{item.id_product}</td>
                            <td className="py-2 px-3 text-slate-700">{item.model || '-'}</td>
                            <td className="py-2 px-3 text-center font-mono font-semibold text-slate-800">
                              {item.ukuran || '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-emerald-700 font-mono">
                              {item.qty} {item.uom}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {formatRupiah(item.harga)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              {formatRupiah(item.subtotal)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Hapus item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {formItems.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                          <td colSpan={5} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-500">
                            Total:
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-emerald-800 text-sm">
                            {formItems.reduce((acc, it) => acc + it.qty, 0)} PCS
                          </td>
                          <td></td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm">
                            {formatRupiah(formItems.reduce((acc, it) => acc + (it.subtotal || 0), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={submitting || formItems.length === 0}
                  onClick={handleSubmitPO}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Simpan Purchase Order</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden File Input for Excel Import */}
        <input
          type="file"
          ref={excelFileInputRef}
          accept=".xlsx, .xls"
          onChange={handleExcelFileSelect}
          className="hidden"
        />

        {/* Hidden File Input for Row Image Upload */}
        <input
          type="file"
          ref={rowFileInputRef}
          accept="image/png, image/jpeg, image/jpg, image/webp"
          onChange={handleRowImageChange}
          className="hidden"
        />

        {/* Lightbox / Preview Image Modal */}
        {previewImage && (
          <div
            className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="bg-white p-3 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Preview Foto Barang</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2">
                <img
                  src={previewImage}
                  alt="Preview Barang"
                  className="max-h-[68vh] max-w-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
