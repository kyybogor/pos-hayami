'use client';

import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Calculator,
  Calendar,
  Search,
  RefreshCw,
  Printer,
  ArrowUpRight,
  Wallet,
  CreditCard,
  CheckCircle2,
  Layers,
  Eye,
  X,
  TrendingUp,
  Coins,
  Building2,
  DollarSign,
  Receipt,
  User,
  Clock,
  AlertCircle,
  FileCheck,
  Lock,
  Package,
  FileText,
  Check,
  ChevronDown,
  ShoppingBag,
} from 'lucide-react';

interface BranchItem {
  id_cabang: string | number;
  nama_cabang: string;
}

interface ProductItem {
  id_bahan?: string;
  model?: string;
  ukuran?: string;
  nama_barang: string;
  qty_penjualan: number;
  qty_retur: number;
  total_qty: number;
  harga_satuan?: number;
  total_penjualan: number;
}

interface ClosingRecord {
  id: number;
  no_penutupan: string;
  tgl_closing: string;
  tgl_transaksi: string;
  id_cabang: string;
  kasir: string;
  kas_pembukaan: number;
  total_penjualan: number;
  total_retur: number;
  total_bersih: number;
  total_qty_penjualan: number;
  total_qty_retur: number;
  total_qty_bersih: number;
  total_transaksi: number;
  nominal_cash: number;
  nominal_hutang: number;
  nominal_transfer: number;
  catatan: string;
  products?: ProductItem[];
  pembayaran?: Record<string, number>;
}

interface ClosingSummary {
  total_closing: number;
  grand_total_transaksi: number;
  grand_total_qty: number;
  grand_total_penjualan: number;
  grand_total_retur: number;
  grand_total_bersih: number;
  grand_nominal_cash: number;
  grand_nominal_hutang: number;
  grand_nominal_transfer: number;
}

interface PreviewData {
  tgl_transaksi: string;
  id_cabang: string;
  next_no_penutupan: string;
  total_transaksi: number;
  total_penjualan: number;
  total_diskon: number;
  total_retur: number;
  total_bersih: number;
  total_qty_penjualan: number;
  total_qty_retur: number;
  total_qty_bersih: number;
  nominal_cash: number;
  nominal_hutang: number;
  nominal_transfer: number;
  akun_breakdown: Record<string, number>;
  products: ProductItem[];
}

export default function ClosingHarianPage() {
  const getTodayString = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const todayStr = getTodayString();
  const [tglFrom, setTglFrom] = useState(todayStr);
  const [tglTo, setTglTo] = useState(todayStr);
  const [activePreset, setActivePreset] = useState<'today' | '7days' | 'thisMonth' | 'all' | 'custom'>('today');
  const [selectedCabang, setSelectedCabang] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [items, setItems] = useState<ClosingRecord[]>([]);
  const [summary, setSummary] = useState<ClosingSummary>({
    total_closing: 0,
    grand_total_transaksi: 0,
    grand_total_qty: 0,
    grand_total_penjualan: 0,
    grand_total_retur: 0,
    grand_total_bersih: 0,
    grand_nominal_cash: 0,
    grand_nominal_hutang: 0,
    grand_nominal_transfer: 0,
  });

  // Current Logged-in User
  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string; grup?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';

  // Modal: Proses Closing Harian
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [processDate, setProcessDate] = useState(todayStr);
  const [processCabang, setProcessCabang] = useState('');
  const [processKasir, setProcessKasir] = useState('');
  const [processOpeningCash, setProcessOpeningCash] = useState('0');
  const [processNoPenutupan, setProcessNoPenutupan] = useState('');
  const [processCatatan, setProcessCatatan] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [submittingClosing, setSubmittingClosing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  // Modal: Struk Bukti Closing (Receipt)
  const [receiptData, setReceiptData] = useState<ClosingRecord | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Modal: Detail Produk Terjual
  const [detailClosing, setDetailClosing] = useState<ClosingRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Formatters
  const formatDateString = (dateStr: string) => {
    if (!dateStr || dateStr === '0000-00-00') return '-';
    try {
      const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTimeString = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number) => {
    return `Rp ${Math.round(val || 0).toLocaleString('id-ID')}`;
  };

  const getPaymentMethodInfo = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.includes('CASH') || upper.includes('KAS') || upper.includes('TUNAI')) {
      return {
        badge: 'Kas Tunai',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        cardBg: 'bg-emerald-50/40 border-emerald-200/90 hover:border-emerald-400',
        textColor: 'text-emerald-700',
        icon: <Wallet className="w-4 h-4 text-emerald-600" />,
      };
    }
    if (upper.includes('DEBET')) {
      return {
        badge: 'Kartu Debet',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        cardBg: 'bg-indigo-50/40 border-indigo-200/90 hover:border-indigo-400',
        textColor: 'text-indigo-700',
        icon: <CreditCard className="w-4 h-4 text-indigo-600" />,
      };
    }
    if (upper.includes('EDC')) {
      return {
        badge: 'Mesin EDC',
        badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
        cardBg: 'bg-purple-50/40 border-purple-200/90 hover:border-purple-400',
        textColor: 'text-purple-700',
        icon: <CreditCard className="w-4 h-4 text-purple-600" />,
      };
    }
    if (upper.includes('BCA')) {
      return {
        badge: 'Bank BCA',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        cardBg: 'bg-blue-50/40 border-blue-200/90 hover:border-blue-400',
        textColor: 'text-blue-700',
        icon: <Building2 className="w-4 h-4 text-blue-600" />,
      };
    }
    if (upper.includes('MANDIRI')) {
      return {
        badge: 'Bank Mandiri',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        cardBg: 'bg-amber-50/40 border-amber-200/90 hover:border-amber-400',
        textColor: 'text-amber-700',
        icon: <Building2 className="w-4 h-4 text-amber-600" />,
      };
    }
    if (upper.includes('BRI')) {
      return {
        badge: 'Bank BRI',
        badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        cardBg: 'bg-cyan-50/40 border-cyan-200/90 hover:border-cyan-400',
        textColor: 'text-cyan-700',
        icon: <Building2 className="w-4 h-4 text-cyan-600" />,
      };
    }
    if (upper.includes('TRANSFER')) {
      return {
        badge: 'Transfer Bank',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        cardBg: 'bg-sky-50/40 border-sky-200/90 hover:border-sky-400',
        textColor: 'text-sky-700',
        icon: <ArrowUpRight className="w-4 h-4 text-sky-600" />,
      };
    }
    if (upper.includes('HUTANG') || upper.includes('PIUTANG')) {
      return {
        badge: 'Piutang / Hutang',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        cardBg: 'bg-rose-50/40 border-rose-200/90 hover:border-rose-400',
        textColor: 'text-rose-700',
        icon: <AlertCircle className="w-4 h-4 text-rose-600" />,
      };
    }
    return {
      badge: 'Non-Tunai',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      cardBg: 'bg-slate-50 border-slate-200 hover:border-slate-300',
      textColor: 'text-slate-800',
      icon: <CreditCard className="w-4 h-4 text-slate-600" />,
    };
  };

  // Helper to resolve clean branch name from id or name
  const resolveBranchName = (rawBranch?: string | number, branchList: BranchItem[] = branches) => {
    if (!rawBranch) return '';
    const str = String(rawBranch).trim();
    const found = branchList.find(
      (b) => String(b.id_cabang) === str || b.nama_cabang.toLowerCase() === str.toLowerCase()
    );
    if (found) return found.nama_cabang;
    return str;
  };

  // Fetch current user session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
            const userBranchRaw = data.user.branch || data.user.grup || '';
            const isSuper = (data.user.role || '').toLowerCase() === 'superadmin';
            const resolved = resolveBranchName(userBranchRaw, branches) || userBranchRaw;

            if (!isSuper && resolved) {
              setSelectedCabang(resolved);
              fetchClosingData(undefined, undefined, resolved, undefined);
            }
            if (resolved) {
              setProcessCabang(resolved);
            }
            setProcessKasir(data.user.nm_user || data.user.id_user || '');
          }
        }
      } catch (err) {
        console.error('Failed to load user info:', err);
      }
    };
    fetchUser();
  }, [branches]);

  // Fetch Closed Records from tb_closing_harian
  const fetchClosingData = async (
    overrideFrom?: string,
    overrideTo?: string,
    overrideCabang?: string,
    overrideSearch?: string
  ) => {
    setLoading(true);

    const fromVal = overrideFrom !== undefined ? overrideFrom : tglFrom;
    const toVal = overrideTo !== undefined ? overrideTo : tglTo;
    const enforcedCabang = !isSuperAdmin && currentUser?.branch ? currentUser.branch : undefined;
    const cabangVal = enforcedCabang !== undefined ? enforcedCabang : (overrideCabang !== undefined ? overrideCabang : selectedCabang);
    const searchVal = overrideSearch !== undefined ? overrideSearch : searchQuery;

    try {
      const params = new URLSearchParams();
      if (fromVal) params.append('tgl_from', fromVal);
      if (toVal) params.append('tgl_to', toVal);
      if (cabangVal) params.append('id_cabang', cabangVal);
      if (searchVal) params.append('search', searchVal);

      const res = await fetch(`/api/closing-harian?${params.toString()}`);
      if (!res.ok) {
        setItems([]);
        return;
      }
      const json = await res.json();

      if (json.success && json.data) {
        setItems(json.data.items || []);
        if (json.data.branches) {
          const bList: BranchItem[] = json.data.branches;
          setBranches(bList);
          // Always ensure processCabang is resolved to a specific branch
          setProcessCabang((prev) => {
            const raw = currentUser?.branch || currentUser?.grup || prev;
            return resolveBranchName(raw, bList) || prev || bList[0]?.nama_cabang || '';
          });
        }
        setSummary(
          json.data.summary || {
            total_closing: 0,
            grand_total_transaksi: 0,
            grand_total_qty: 0,
            grand_total_penjualan: 0,
            grand_total_retur: 0,
            grand_total_bersih: 0,
            grand_nominal_cash: 0,
            grand_nominal_hutang: 0,
            grand_nominal_transfer: 0,
          }
        );
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Error fetching closing harian data:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosingData(todayStr, todayStr);
  }, []);

  // Preset Filters
  const handlePreset = (type: 'today' | '7days' | 'thisMonth' | 'all') => {
    setActivePreset(type);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (type === 'today') {
      setTglFrom(today);
      setTglTo(today);
      fetchClosingData(today, today);
    } else if (type === '7days') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 6);
      const past7Str = `${past7.getFullYear()}-${pad(past7.getMonth() + 1)}-${pad(past7.getDate())}`;
      setTglFrom(past7Str);
      setTglTo(today);
      fetchClosingData(past7Str, today);
    } else if (type === 'thisMonth') {
      const firstDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      setTglFrom(firstDay);
      setTglTo(today);
      fetchClosingData(firstDay, today);
    } else if (type === 'all') {
      setTglFrom('');
      setTglTo('');
      fetchClosingData('', '');
    }
  };

  // Open Process Closing Modal & Fetch Preview
  const handleOpenProcessModal = async () => {
    const defaultDate = todayStr;
    const userBranchRaw = currentUser?.branch || currentUser?.grup || processCabang;
    let targetCabang = resolveBranchName(userBranchRaw, branches);
    if (!targetCabang && branches.length > 0) {
      targetCabang = branches[0].nama_cabang;
    }
    setProcessDate(defaultDate);
    setProcessCabang(targetCabang);
    const dParts = defaultDate.split('-');
    const defaultNotes = dParts.length === 3 ? `penutupan kasir ${dParts[2]}-${dParts[1]}-${dParts[0]}` : `penutupan kasir ${defaultDate}`;
    setProcessCatatan(defaultNotes);
    setProcessOpeningCash('0');
    setProcessError(null);
    setIsProcessModalOpen(true);

    if (targetCabang) {
      await loadPreview(defaultDate, targetCabang);
    } else {
      setProcessError('Cabang kasir tidak ditemukan. Pastikan akun memiliki cabang terdaftar.');
    }
  };

  const loadPreview = async (date: string, cabang: string) => {
    if (!cabang || cabang === 'ALL') {
      setPreviewData(null);
      setProcessError('Cabang harus ditentukan. Setiap cabang harus melakukan closing masing-masing.');
      return;
    }

    setLoadingPreview(true);
    setProcessError(null);
    try {
      const params = new URLSearchParams({
        tgl_transaksi: date,
        id_cabang: cabang,
      });

      const res = await fetch(`/api/closing-harian/preview?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setPreviewData(json.data);
        if (json.data.next_no_penutupan) {
          setProcessNoPenutupan(json.data.next_no_penutupan);
        }
      } else {
        setPreviewData(null);
        setProcessError(json.message || 'Gagal memuat pratinjau closing.');
      }
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewData(null);
      setProcessError('Gagal terhubung ke server.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDateChange = (newDate: string) => {
    setProcessDate(newDate);
    const dParts = newDate.split('-');
    const newNotes = dParts.length === 3 ? `penutupan kasir ${dParts[2]}-${dParts[1]}-${dParts[0]}` : `penutupan kasir ${newDate}`;
    setProcessCatatan(newNotes);
    if (processCabang) {
      loadPreview(newDate, processCabang);
    }
  };

  // Submit Process Closing
  const handleSubmitClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processCabang || processCabang === 'ALL') {
      showToast('error', 'Cabang tidak valid. Setiap cabang harus melakukan closing masing-masing.');
      setProcessError('Cabang tidak valid. Setiap cabang harus melakukan closing masing-masing.');
      return;
    }
    if (!previewData || previewData.total_transaksi === 0) {
      showToast('error', 'Tidak ada transaksi yang dapat di-closing untuk cabang ini.');
      return;
    }

    setSubmittingClosing(true);
    setProcessError(null);

    try {
      const res = await fetch('/api/closing-harian/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tgl_transaksi: processDate,
          id_cabang: processCabang,
          kasir: processKasir || currentUser?.nm_user || 'Kasir',
          kas_pembukaan: Number(processOpeningCash) || 0,
          no_penutupan: processNoPenutupan,
          catatan: processCatatan,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        showToast('success', json.message || 'Closing Harian berhasil disimpan!');
        setIsProcessModalOpen(false);

        // Refresh closed list
        fetchClosingData();

        // Open Receipt Modal automatically
        const createdRecord: ClosingRecord = {
          ...json.data.closing,
          products: json.data.products || [],
          pembayaran: json.data.pembayaran || json.data.closing?.pembayaran || {},
        };
        setReceiptData(createdRecord);
        setIsReceiptModalOpen(true);
      } else {
        setProcessError(json.message || 'Gagal memproses closing harian.');
        showToast('error', json.message || 'Gagal memproses closing harian.');
      }
    } catch (err: any) {
      console.error('Submit closing error:', err);
      setProcessError('Terjadi kesalahan koneksi server.');
      showToast('error', 'Terjadi kesalahan koneksi server.');
    } finally {
      setSubmittingClosing(false);
    }
  };

  // Open Struk Bukti Modal for a specific row
  const handleOpenReceipt = (record: ClosingRecord) => {
    setReceiptData(record);
    setIsReceiptModalOpen(true);
  };

  // Open Detail Products Modal for a specific row
  const handleOpenDetailModal = (record: ClosingRecord) => {
    setDetailClosing(record);
    setIsDetailModalOpen(true);
  };

  // Trigger browser print for thermal slip
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl shadow-xl text-white font-medium transition-all transform animate-bounce ${
              toastMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-200" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-200" />
            )}
            <span className="text-sm">{toastMessage.text}</span>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl text-white shadow-md shadow-emerald-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                <span>Closing Harian</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Penutupan Kasir
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Rekapitulasi transaksi penjualan yang telah di-closing per sesi kasir.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Action Button: Closing Harian */}
            <button
              onClick={handleOpenProcessModal}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md shadow-emerald-600/20 text-sm font-semibold transition-all transform hover:-translate-y-0.5 cursor-pointer"
              title="Lakukan proses penutupan kasir harian"
            >
              <Lock className="w-4 h-4" />
              <span>Closing Harian</span>
            </button>

            <button
              onClick={() => fetchClosingData()}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 print:hidden">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">
              Periode:
            </span>
            <button
              onClick={() => handlePreset('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === 'today'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => handlePreset('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === '7days'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => handlePreset('thisMonth')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === 'thisMonth'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => handlePreset('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Periode
            </button>
          </div>

          {/* Form Filter Inputs */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchClosingData();
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-3 space-y-1">
              <label className="text-xs font-medium text-slate-600 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Dari Tanggal</span>
              </label>
              <input
                type="date"
                value={tglFrom}
                onChange={(e) => {
                  setTglFrom(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-300 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="lg:col-span-3 space-y-1">
              <label className="text-xs font-medium text-slate-600 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Sampai Tanggal</span>
              </label>
              <input
                type="date"
                value={tglTo}
                onChange={(e) => {
                  setTglTo(e.target.value);
                  setActivePreset('custom');
                }}
                className="w-full px-3 py-2 bg-slate-50/50 border border-slate-300 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {isSuperAdmin && (
              <div className="lg:col-span-3 space-y-1">
                <label className="text-xs font-medium text-slate-600 flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Filter Cabang</span>
                </label>
                <select
                  value={selectedCabang}
                  onChange={(e) => setSelectedCabang(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50/50 border border-slate-300 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                >
                  <option value="">-- Semua Cabang --</option>
                  {branches.map((b) => (
                    <option key={b.id_cabang} value={b.nama_cabang}>
                      {b.nama_cabang}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={isSuperAdmin ? "lg:col-span-3 space-y-1" : "lg:col-span-6 space-y-1"}>
              <label className="text-xs font-medium text-slate-600 flex items-center space-x-1">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Cari No. Penutupan / Kasir</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik kata kunci..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50/50 border border-slate-300 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="lg:col-span-12 flex justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Terapkan Filter</span>
              </button>
            </div>
          </form>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          {/* Total Sesi Closing */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Sesi Closing
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5">
                {summary.total_closing} <span className="text-xs font-normal text-slate-500">Sesi</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total {summary.grand_total_transaksi} Transaksi / Nota
              </p>
            </div>
          </div>

          {/* Total Penjualan Bersih */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Penjualan Bersih
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5 font-mono">
                {formatCurrency(summary.grand_total_bersih)}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kotor: {formatCurrency(summary.grand_total_penjualan)}
              </p>
            </div>
          </div>

          {/* Total Qty Produk */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Qty Terjual
              </p>
              <h3 className="text-xl font-bold text-slate-800 mt-0.5">
                {summary.grand_total_qty.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">Pcs</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {(summary.grand_total_qty / 12).toFixed(2)} Lusin
              </p>
            </div>
          </div>

          {/* Breakdown Kas / Non-Kas */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Kas (Cash)
              </p>
              <h3 className="text-lg font-bold text-slate-800 mt-0.5 font-mono">
                {formatCurrency(summary.grand_nominal_cash)}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Transfer: {formatCurrency(summary.grand_nominal_transfer)} | Hutang:{' '}
                {formatCurrency(summary.grand_nominal_hutang)}
              </p>
            </div>
          </div>
        </div>

        {/* Data Table: Only Closed Records */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:hidden">
          <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
                <span>Daftar Sesi Penutupan Kasir (Closing)</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {items.length} Data
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hanya menampilkan transaksi yang telah di-closing melalui sistem.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider whitespace-nowrap">
                  <th className="py-3.5 px-3 text-center w-12">No</th>
                  <th className="py-3.5 px-3 text-center">No. Penutupan</th>
                  <th className="py-3.5 px-3 text-left">Waktu Closing</th>
                  <th className="py-3.5 px-3 text-left">Tgl Transaksi</th>
                  <th className="py-3.5 px-3 text-left">Cabang</th>
                  <th className="py-3.5 px-3 text-left">Kasir</th>
                  <th className="py-3.5 px-3 text-center">Total Nota</th>
                  <th className="py-3.5 px-3 text-center">Total Qty</th>
                  <th className="py-3.5 px-3 text-right">Penjualan Bersih</th>
                  <th className="py-3.5 px-3 text-right">Kas (Cash)</th>
                  <th className="py-3.5 px-3 text-right">Transfer / Hutang</th>
                  <th className="py-3.5 px-3 text-left max-w-[150px]">Catatan</th>
                  <th className="py-3.5 px-3 text-center w-28 sticky right-0 bg-slate-100/80">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      <p className="text-xs font-medium">Memuat data closing harian...</p>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                          <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-slate-700 text-sm">
                          Belum Ada Data Closing
                        </h3>
                        <p className="text-xs text-slate-400">
                          Tidak ditemukan sesi closing pada filter ini. Data di halaman ini hanya
                          muncul jika transaksi penjualan sudah di-closing melalui tombol{' '}
                          <strong>Closing Harian</strong>.
                        </p>
                        <button
                          onClick={handleOpenProcessModal}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lakukan Closing Sekarang</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors group whitespace-nowrap"
                    >
                      <td className="py-3 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          #{row.no_penutupan}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-600">
                        {formatDateTimeString(row.tgl_closing)}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {formatDateString(row.tgl_transaksi)}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{row.id_cabang}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-800">{row.kasir}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {row.total_transaksi}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-800">
                        {row.total_qty_bersih.toLocaleString('id-ID')} pcs
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 bg-emerald-50/20">
                        {formatCurrency(row.total_bersih)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-700 font-medium">
                        {formatCurrency(row.nominal_cash)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600 text-xs">
                        {row.pembayaran && Object.keys(row.pembayaran).some((k) => k.toUpperCase() !== 'CASH') ? (
                          <div className="flex flex-col items-end gap-1">
                            {Object.entries(row.pembayaran).map(([metode, nominal]) => {
                              if (metode.toUpperCase() === 'CASH') return null;
                              return (
                                <span
                                  key={metode}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold"
                                >
                                  {metode}: {formatCurrency(nominal)}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <span className="text-blue-600">T: {formatCurrency(row.nominal_transfer)}</span>
                            {row.nominal_hutang > 0 && (
                              <span className="text-rose-600 ml-1.5">
                                | H: {formatCurrency(row.nominal_hutang)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 truncate max-w-[150px]" title={row.catatan}>
                        {row.catatan || '-'}
                      </td>
                      <td className="py-3 px-3 text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10">
                        <div className="flex items-center justify-center space-x-1.5">
                          {/* Cetak Struk Bukti */}
                          <button
                            onClick={() => handleOpenReceipt(row)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                            title="Cetak Struk Bukti Penutupan Kasir"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Lihat Detail Produk */}
                          <button
                            onClick={() => handleOpenDetailModal(row)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Lihat Detail Produk Terjual"
                          >
                            <Eye className="w-4 h-4" />
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

        {/* ================= MODAL: PROSES CLOSING HARIAN ================= */}
        {isProcessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base md:text-lg">Proses Closing Harian</h3>
                    <p className="text-xs text-emerald-100">
                      Tutup sesi kasir dan kunci transaksi penjualan hari ini.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsProcessModalOpen(false)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {processError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{processError}</span>
                  </div>
                )}

                <form id="closing-process-form" onSubmit={handleSubmitClosing} className="space-y-4">
                  {/* Grid Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Tanggal Transaksi */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Tanggal Transaksi</span>
                      </label>
                      <input
                        type="date"
                        value={processDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Cabang (Terkunci Otomatis per Cabang Kasir) */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span className="flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Cabang</span>
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          Closing per Cabang
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={processCabang || 'Memuat cabang...'}
                          className="w-full pl-3 pr-28 py-2 bg-slate-100/90 border border-slate-300 rounded-xl text-xs md:text-sm font-bold text-slate-800 cursor-not-allowed select-none"
                          title="Closing dilakukan masing-masing per cabang aktif"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-emerald-200 pointer-events-none">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Cabang Kasir</span>
                        </div>
                      </div>
                    </div>

                    {/* Kasir */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Nama Kasir / Petugas Closing</span>
                      </label>
                      <input
                        type="text"
                        value={processKasir}
                        onChange={(e) => setProcessKasir(e.target.value)}
                        placeholder="Nama Kasir"
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* No. Penutupan */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                        <Receipt className="w-3.5 h-3.5 text-slate-400" />
                        <span>No. Penutupan</span>
                      </label>
                      <input
                        type="text"
                        value={processNoPenutupan}
                        onChange={(e) => setProcessNoPenutupan(e.target.value)}
                        placeholder="Contoh: 638"
                        required
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Kas Pembukaan (Modal Awal) */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                        <Wallet className="w-3.5 h-3.5 text-slate-400" />
                        <span>Kas Pembukaan (Modal Awal Kas)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          value={processOpeningCash}
                          onChange={(e) => setProcessOpeningCash(e.target.value)}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Catatan */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Catatan Penutupan</span>
                      </label>
                      <input
                        type="text"
                        value={processCatatan}
                        onChange={(e) => setProcessCatatan(e.target.value)}
                        placeholder="Contoh: penutupan kasir 09-10-2026"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </form>

                {/* Section Preview Unclosed Transactions */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      <span>Ringkasan Transaksi Siap Di-Closing</span>
                    </h4>
                    {loadingPreview && (
                      <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                        <span>Menghitung...</span>
                      </span>
                    )}
                  </div>

                  {loadingPreview ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      Menghitung transaksi belum closing...
                    </div>
                  ) : !previewData || previewData.total_transaksi === 0 ? (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center text-amber-800 text-xs space-y-1">
                      <p className="font-semibold">
                        Tidak ada transaksi penjualan baru yang belum di-closing.
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Seluruh transaksi pada tanggal{' '}
                        <strong>{formatDateString(processDate)}</strong> sudah di-closing atau belum ada
                        penjualan tercatat.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Metric Grid - Top Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center text-xs">
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                          <span className="text-[11px] text-slate-500 block uppercase font-medium">Total Nota</span>
                          <span className="font-bold text-slate-800 text-base mt-0.5 block">
                            {previewData.total_transaksi} Nota
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                          <span className="text-[11px] text-slate-500 block uppercase font-medium">Total Qty (Pcs)</span>
                          <span className="font-bold text-indigo-600 text-base font-mono mt-0.5 block">
                            {previewData.total_qty_bersih} pcs
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
                          <span className="text-[11px] text-emerald-700 font-semibold block uppercase">Total Penjualan</span>
                          <span className="font-bold text-emerald-800 text-base font-mono mt-0.5 block">
                            {formatCurrency(previewData.total_bersih)}
                          </span>
                        </div>
                      </div>

                      {/* Card Pilihan Pembayaran (Uang Masuk ke Bank & Kas) */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                            <CreditCard className="w-4 h-4 text-emerald-600" />
                            <span>Pilihan Pembayaran / Uang Masuk ke Akun Bank & Kas:</span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {Object.keys(previewData.akun_breakdown || {}).length} Metode
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {/* Render Card for every payment account in akun_breakdown */}
                          {Object.entries(previewData.akun_breakdown || {}).map(([akunName, nominal]) => {
                            const info = getPaymentMethodInfo(akunName);
                            return (
                              <div
                                key={akunName}
                                className={`p-3 rounded-xl border ${info.cardBg} transition-all flex flex-col justify-between space-y-2`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <div className="p-1 rounded-md bg-white shadow-2xs">{info.icon}</div>
                                    <span className="font-bold text-slate-800 text-xs truncate" title={akunName}>
                                      {akunName}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${info.badgeColor}`}>
                                    {info.badge}
                                  </span>
                                </div>
                                <div className="pt-1.5 border-t border-slate-200/70 flex items-baseline justify-between">
                                  <span className="text-[11px] text-slate-500">Total Masuk:</span>
                                  <span className={`font-mono font-bold text-sm ${info.textColor}`}>
                                    {formatCurrency(nominal)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* If no CASH was received, show Kas Tunai Rp 0 card so cashier sees physical cash is 0 */}
                          {!previewData.akun_breakdown['CASH'] && !previewData.akun_breakdown['Kas'] && (
                            <div className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-2">
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center space-x-1.5 truncate">
                                  <div className="p-1 rounded-md bg-white shadow-2xs">
                                    <Wallet className="w-4 h-4 text-slate-400" />
                                  </div>
                                  <span className="font-semibold text-slate-500 text-xs">CASH - Kas / Tunai</span>
                                </div>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                  Kas Tunai
                                </span>
                              </div>
                              <div className="pt-1.5 border-t border-slate-200/70 flex items-baseline justify-between">
                                <span className="text-[11px] text-slate-400">Total Masuk:</span>
                                <span className="font-mono font-bold text-slate-500 text-sm">Rp 0</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Products preview list */}
                      <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] sticky top-0">
                            <tr>
                              <th className="py-2 px-2.5">Produk Terjual</th>
                              <th className="py-2 px-2.5 text-center">Qty Penjualan</th>
                              <th className="py-2 px-2.5 text-right">Total Harga</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {previewData.products.map((p, pIdx) => (
                              <tr key={pIdx} className="hover:bg-slate-50">
                                <td className="py-2 px-2.5 font-medium text-slate-800">
                                  {p.nama_barang}
                                </td>
                                <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-800">
                                  {p.qty_penjualan} pcs
                                </td>
                                <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-800">
                                  {formatCurrency(p.total_penjualan)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsProcessModalOpen(false)}
                  disabled={submittingClosing}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="closing-process-form"
                  disabled={
                    submittingClosing ||
                    loadingPreview ||
                    !previewData ||
                    previewData.total_transaksi === 0
                  }
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  {submittingClosing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Konfirmasi & Cetak Struk Closing</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: STRUK BUKTI PENUTUPAN KASIR (RECEIPT) ================= */}
        {isReceiptModalOpen && receiptData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden">
              {/* Receipt Modal Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white print:hidden">
                <div className="flex items-center space-x-2">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm">Struk Bukti Penutupan Kasir</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePrintReceipt}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Struk</span>
                  </button>
                  <button
                    onClick={() => setIsReceiptModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Receipt Paper Container (Thermal Style) */}
              <div className="overflow-y-auto flex-1 bg-slate-100 print:p-0 print:bg-white print:overflow-visible" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', minHeight: '100%' }}>
                <div
                  id="receipt-print-area"
                  className="bg-white p-6 shadow-sm border border-slate-200 max-w-[340px] w-full text-slate-900 text-xs font-mono leading-relaxed print:shadow-none print:border-none print:p-2 print:max-w-none print:w-full"
                  style={{ fontFamily: 'Courier New, monospace, sans-serif', flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  {/* Main content wrapper - grows to fill space */}
                  <div className="flex-1">
                    {/* Shop Header */}
                    <div className="text-center space-y-1 mb-4">
                      <h2 className="text-lg font-bold tracking-wider" style={{ fontFamily: 'sans-serif' }}>
                        Hayami
                      </h2>
                      <p className="text-[11px] text-slate-600">Wear, Play, Grow</p>
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    <div className="text-center font-bold uppercase text-[13px] tracking-wide my-1">
                      Penutupan Kasir
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Metadata (NO lokasi, NO mesin, NO jam buka/tutup as requested!) */}
                    <div className="space-y-1 text-[11px] mb-3">
                      <div className="flex justify-between">
                        <span>No Penutupan:</span>
                        <span className="font-bold">{receiptData.no_penutupan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kasir:</span>
                        <span className="font-bold">{receiptData.kasir}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Waktu Closing:</span>
                        <span>{formatDateTimeString(receiptData.tgl_closing)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tgl Transaksi:</span>
                        <span>{formatDateString(receiptData.tgl_transaksi)}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Pembayaran Section */}
                    <div className="space-y-1 text-[11px] mb-3">
                      <div className="text-center font-bold uppercase text-xs my-1">
                        Pembayaran
                      </div>
                      <div className="font-bold">Kas</div>
                      <div className="flex justify-between pl-2">
                        <span>-Pembukaan</span>
                        <span>{formatCurrency(receiptData.kas_pembukaan)}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>-Penjualan</span>
                        <span>{formatCurrency(receiptData.nominal_cash)}</span>
                      </div>
                      <div className="flex justify-between pl-2">
                        <span>-Retur</span>
                        <span>{formatCurrency(receiptData.total_retur)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-dotted border-slate-300 pt-1">
                        <span>Total Penjualan</span>
                        <span>{formatCurrency(receiptData.total_bersih)}</span>
                      </div>

                      {/* Non-Cash / Bank Breakdown */}
                      {receiptData.pembayaran && Object.keys(receiptData.pembayaran).length > 0 ? (
                        <div className="pt-1 mt-1 border-t border-dotted border-slate-300 space-y-0.5">
                          <div className="font-bold text-[10px] text-slate-700">Bank / Non-Tunai:</div>
                          {Object.entries(receiptData.pembayaran).map(([metode, nominal]) => {
                            if (metode.toUpperCase() === 'CASH') return null;
                            return (
                              <div key={metode} className="flex justify-between pl-2 text-[10px] text-slate-700">
                                <span>-{metode}</span>
                                <span className="font-semibold">{formatCurrency(nominal)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        (receiptData.nominal_transfer > 0 || receiptData.nominal_hutang > 0) && (
                          <div className="pt-1 mt-1 border-t border-dotted border-slate-200">
                            {receiptData.nominal_transfer > 0 && (
                              <div className="flex justify-between text-[10px] text-slate-600">
                                <span>- Transfer / Bank</span>
                                <span>{formatCurrency(receiptData.nominal_transfer)}</span>
                              </div>
                            )}
                            {receiptData.nominal_hutang > 0 && (
                              <div className="flex justify-between text-[10px] text-slate-600">
                                <span>- Piutang / Hutang</span>
                                <span>{formatCurrency(receiptData.nominal_hutang)}</span>
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Produk Section */}
                    <div className="space-y-2 text-[11px] mb-3">
                      <div className="text-center font-bold uppercase text-xs my-1">
                        Produk
                      </div>

                      {receiptData.products && receiptData.products.length > 0 ? (
                        receiptData.products.map((prod, pIdx) => (
                          <div key={pIdx} className="space-y-0.5">
                            <div className="font-bold text-[11px] leading-tight">
                              {prod.nama_barang}
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-700">
                              <span>
                                Qty: {prod.qty_penjualan} pcs
                              </span>
                              <span className="font-semibold">
                                {formatCurrency(prod.total_penjualan)}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-slate-400 text-[10px]">
                          {receiptData.total_qty_bersih} pcs produk terjual
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Grand Totals */}
                    <div className="space-y-1 text-[11px] font-bold">
                      <div className="flex justify-between">
                        <span>Total Qty Terjual:</span>
                        <span>{receiptData.total_qty_bersih} pcs</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Total Nilai Penjualan:</span>
                        <span>{formatCurrency(receiptData.total_bersih)}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Catatan */}
                    <div className="text-[10px] text-slate-600 text-center my-2 italic">
                      Catatan: {receiptData.catatan || `penutupan kasir ${receiptData.tgl_transaksi}`}
                    </div>
                  </div>

                  {/* Footer - selalu di paling bawah */}
                  <div className="mt-4">
                    <div className="border-t border-dashed border-slate-400 mb-3" />
                    <div className="text-center text-[9px] text-slate-400 pb-2">
                      Terima kasih atas kerja keras Anda
                    </div>
                  </div>
                </div>
                </div>
              </div>

              {/* Receipt Modal Footer */}
              <div className="p-3 border-t border-slate-200 bg-white flex justify-end space-x-2 print:hidden">
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Tutup
                </button>
                <button
                  onClick={handlePrintReceipt}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Struk Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: DETAIL PRODUK TERJUAL ================= */}
        {isDetailModalOpen && detailClosing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center space-x-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Detail Produk Terjual - No. Penutupan #{detailClosing.no_penutupan}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kasir: <strong>{detailClosing.kasir}</strong> | Tanggal:{' '}
                    {formatDateString(detailClosing.tgl_transaksi)}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                {detailClosing.products && detailClosing.products.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">Nama Produk / Model</th>
                          <th className="py-2.5 px-3 text-center">Qty Penjualan</th>
                          <th className="py-2.5 px-3 text-right">Total Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailClosing.products.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {p.nama_barang}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                              {p.qty_penjualan} pcs
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                              {formatCurrency(p.total_penjualan)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-900 text-white font-bold text-xs">
                        <tr>
                          <td colSpan={2} className="py-2.5 px-3 text-right">
                            Total Qty Penjualan:
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {detailClosing.total_qty_penjualan || detailClosing.total_qty_bersih} pcs
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-300">
                            {formatCurrency(detailClosing.total_bersih)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Detail produk tersimpan dalam format agregat.
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dedicated Print Media Styles for Thermal Slip Receipt */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-print-area,
          #receipt-print-area * {
            visibility: visible;
          }
          #receipt-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            max-width: 80mm;
            padding: 2mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}
