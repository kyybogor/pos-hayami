'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import SearchableSelect, { SelectOption } from '@/components/SearchableSelect';
import {
  CreditCard,
  Search,
  Printer,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Layers,
  ArrowUpRight,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wallet,
  X,
  CheckSquare,
  Square,
  DollarSign,
  Eye,
  History,
  Check,
  FileText,
  Building2,
} from 'lucide-react';

interface PiutangItem {
  id_transaksi: string;
  tgl_transaksi: string;
  tgl_jatuh_tempo: string;
  id_customer: string;
  nama_customer: string;
  lusin: number;
  total: number;
  terbayar: number;
  outstanding: number;
  status: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  from_item: number;
  to_item: number;
}

interface SummaryData {
  total_transaksi: number;
  total_lusin: number;
  total_tagihan: number;
  total_terbayar: number;
  total_outstanding: number;
}

interface CustomerOption {
  id: string;
  nama: string;
}

interface AkunOption {
  id: string;
  tipe: string;
  bank: string;
  nama_akun: string;
  no_akun: string;
}

interface ModalPaymentItem {
  id_transaksi: string;
  nama_customer: string;
  tgl_transaksi: string;
  total: number;
  terbayar: number;
  outstanding: number;
  nominalBayar: number;
}

interface PaymentHistoryLog {
  no_id: string;
  id_pembayaran: string;
  tgl_bayar: string;
  metode: string;
  nominal: number;
  keterangan: string;
  dibuat_oleh: string;
  dibuat_tgl: string;
}

interface PaymentHistoryHeader {
  id_transaksi: string;
  id_customer: string;
  nama_customer: string;
  tgl_transaksi: string;
  tgl_jatuh_tempo: string;
  total: number;
  terbayar: number;
  outstanding: number;
  status: string;
}

export default function LaporanPiutangPage() {
  const [tglFrom, setTglFrom] = useState('');
  const [tglTo, setTglTo] = useState('');
  const [customerSelect, setCustomerSelect] = useState('');
  // DEFAULT STATUS FILTER IS "Belum Lunas" AS REQUESTED BY USER!
  const [statusSelect, setStatusSelect] = useState('Belum Lunas');

  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [akunOptions, setAkunOptions] = useState<AkunOption[]>([]);

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PiutangItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: itemsPerPage,
    total_items: 0,
    total_pages: 1,
    from_item: 0,
    to_item: 0,
  });

  const [summary, setSummary] = useState<SummaryData>({
    total_transaksi: 0,
    total_lusin: 0,
    total_tagihan: 0,
    total_terbayar: 0,
    total_outstanding: 0,
  });

  // Multi Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItems, setModalItems] = useState<ModalPaymentItem[]>([]);
  const [tglBayar, setTglBayar] = useState('');
  const [metodeBayar, setMetodeBayar] = useState('CASH');
  const [keteranganBayar, setKeteranganBayar] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Payment History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyHeader, setHistoryHeader] = useState<PaymentHistoryHeader | null>(null);
  const [historyLogs, setHistoryLogs] = useState<PaymentHistoryLog[]>([]);

  // Toast Notification State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const getTodayString = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr || dateStr === '0000-00-00') return '-';
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

  const formatCurrency = (val: number) => {
    return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
  };

  // Fetch dropdown options and user on mount
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      try {
        const [optRes, cRes, uRes] = await Promise.all([
          fetch('/api/laporan-piutang?options=true'),
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        if (optRes.ok) {
          const json = await optRes.json();
          if (json.success && json.options) {
            if (json.options.customers) setCustomerOptions(json.options.customers);
            if (json.options.akuns) setAkunOptions(json.options.akuns);
          }
        }
        if (cRes.ok) {
          const cJson = await cRes.json();
          if (cJson.success) setCabangOptions(cJson.cabang || []);
        }
        let userBranch = '';
        if (uRes.ok) {
          const uJson = await uRes.json();
          if (uJson.authenticated && uJson.user) {
            setCurrentUser(uJson.user);
            const isSuper = (uJson.user.role || '').toLowerCase() === 'superadmin';
            if (!isSuper && uJson.user.branch) {
              userBranch = uJson.user.branch;
              setSelectedCabang(userBranch);
            }
          }
        }
        fetchPiutangData(1, undefined, userBranch);
      } catch (err) {
        console.error('Error fetching options/user:', err);
        fetchPiutangData(1);
      }
    };
    fetchOptionsAndUser();
  }, []);

  // Fetch Piutang Report Data
  const fetchPiutangData = async (targetPage = 1, e?: React.FormEvent, overrideCabang?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tgl_from: tglFrom,
        tgl_to: tglTo,
        customer: customerSelect,
        status: statusSelect,
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        params.append('cabang', branchVal);
      }

      const res = await fetch(`/api/laporan-piutang?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        setItems(json.data.items || []);
        setPagination(
          json.data.pagination || {
            page: targetPage,
            limit: itemsPerPage,
            total_items: 0,
            total_pages: 1,
            from_item: 0,
            to_item: 0,
          }
        );
        setSummary(
          json.data.summary || {
            total_transaksi: 0,
            total_lusin: 0,
            total_tagihan: 0,
            total_terbayar: 0,
            total_outstanding: 0,
          }
        );
        setCurrentPage(targetPage);
      } else {
        setItems([]);
        setPagination({
          page: 1,
          limit: itemsPerPage,
          total_items: 0,
          total_pages: 1,
          from_item: 0,
          to_item: 0,
        });
        setSummary({
          total_transaksi: 0,
          total_lusin: 0,
          total_tagihan: 0,
          total_terbayar: 0,
          total_outstanding: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching piutang data:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPiutangData(1);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedIds([]);
    fetchPiutangData(1, e);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages && newPage !== currentPage) {
      setSelectedIds([]);
      fetchPiutangData(newPage);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Checkbox selection logic
  const selectableItems = items.filter((item) => item.status !== 'Lunas' && item.outstanding > 0);
  const isAllSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedIds.includes(item.id_transaksi));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableItems.map((item) => item.id_transaksi));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open Payment Modal
  const openPaymentModal = (singleItem?: PiutangItem) => {
    let targets: PiutangItem[] = [];
    if (singleItem) {
      targets = [singleItem];
    } else {
      targets = items.filter((i) => selectedIds.includes(i.id_transaksi));
    }

    if (targets.length === 0) {
      showToast('error', 'Pilih minimal 1 transaksi piutang untuk dibayar.');
      return;
    }

    const mapped: ModalPaymentItem[] = targets.map((t) => ({
      id_transaksi: t.id_transaksi,
      nama_customer: t.nama_customer,
      tgl_transaksi: t.tgl_transaksi,
      total: t.total,
      terbayar: t.terbayar,
      outstanding: t.outstanding,
      nominalBayar: t.outstanding, // DEFAULT FOLLOWS OUTSTANDING AS REQUESTED!
    }));

    setModalItems(mapped);
    setTglBayar(getTodayString());
    setMetodeBayar('CASH');
    setKeteranganBayar('');
    setIsModalOpen(true);
  };

  const updateModalNominal = (id_transaksi: string, valStr: string) => {
    const rawVal = parseInt(valStr.replace(/\D/g, ''), 10);
    const nominal = isNaN(rawVal) ? 0 : rawVal;

    setModalItems((prev) =>
      prev.map((item) => (item.id_transaksi === id_transaksi ? { ...item, nominalBayar: nominal } : item))
    );
  };

  const grandTotalModalBayar = modalItems.reduce((acc, i) => acc + (i.nominalBayar || 0), 0);

  // Submit Payment API Handler
  const handleProcessPayment = async () => {
    if (modalItems.length === 0) return;

    // Check if any nominal is <= 0
    const invalidItem = modalItems.find((i) => i.nominalBayar <= 0);
    if (invalidItem) {
      showToast('error', `Nominal bayar untuk ${invalidItem.id_transaksi} harus lebih dari Rp 0.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        payments: modalItems.map((item) => ({
          id_transaksi: item.id_transaksi,
          nominal: item.nominalBayar,
        })),
        tgl_bayar: tglBayar,
        metode: metodeBayar,
        keterangan: keteranganBayar,
      };

      const res = await fetch('/api/laporan-piutang/bayar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        showToast('success', json.message || 'Pembayaran piutang berhasil diproses!');
        setIsModalOpen(false);
        setSelectedIds([]);
        fetchPiutangData(currentPage);
      } else {
        showToast('error', json.message || 'Gagal memproses pembayaran piutang.');
      }
    } catch (err: any) {
      console.error('Error submitting payment:', err);
      showToast('error', 'Terjadi kesalahan jaringan/server saat memproses pembayaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Detail Payment History Modal
  const openPaymentHistoryModal = async (id_transaksi: string) => {
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    setHistoryHeader(null);
    setHistoryLogs([]);

    try {
      const res = await fetch(`/api/laporan-piutang/history?id_transaksi=${encodeURIComponent(id_transaksi)}`);
      const json = await res.json();

      if (json.success && json.data) {
        setHistoryHeader(json.data.header);
        setHistoryLogs(json.data.history || []);
      } else {
        showToast('error', json.message || 'Gagal mengambil riwayat pembayaran.');
        setIsHistoryModalOpen(false);
      }
    } catch (err) {
      console.error('Error fetching payment history detail:', err);
      showToast('error', 'Gagal terhubung ke server untuk mengambil detail riwayat pembayaran.');
      setIsHistoryModalOpen(false);
    } finally {
      setLoadingHistory(false);
    }
  };

  const custSelectOptions: SelectOption[] = [
    { value: '', label: '-- Semua Customer --' },
    ...customerOptions.map((c) => ({
      value: c.id,
      label: `${c.nama} (${c.id})`,
    })),
  ];

  // Dropdown filter: Belum Lunas (default), Bayar Sebagian, Lunas, Semua
  const statusSelectOptions: SelectOption[] = [
    { value: 'Belum Lunas', label: 'Belum Lunas' },
    { value: 'Bayar Sebagian', label: 'Bayar Sebagian' },
    { value: 'Lunas', label: 'Lunas' },
    { value: 'Semua', label: '-- Semua Status --' },
  ];

  // Selected Total Outstanding sum
  const selectedOutstandingSum = items
    .filter((i) => selectedIds.includes(i.id_transaksi))
    .reduce((acc, i) => acc + i.outstanding, 0);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg text-white font-medium transition-all transform animate-bounce ${
              toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span className="text-xs md:text-sm">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Printable Header */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">Account Receivable</h2>
          <p className="text-sm text-gray-600">
            {tglFrom || tglTo
              ? `Periode: ${formatDateString(tglFrom)} S/D ${formatDateString(tglTo)}`
              : 'Semua Periode Transaksi Piutang'}
            {customerSelect ? ` | Customer: ${customerSelect}` : ''}
            {statusSelect !== 'Semua' ? ` | Status: ${statusSelect}` : ''}
          </p>
        </div>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CreditCard className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Account Receivable
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Rekap sisa tagihan piutang transaksi penjualan barang keluar per customer.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {selectedIds.length > 0 && (
              <button
                onClick={() => openPaymentModal()}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-md hover:shadow-lg cursor-pointer animate-pulse"
              >
                <Wallet className="w-4 h-4" />
                <span>Bayar {selectedIds.length} Hutang Terpilih</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              disabled={items.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs md:text-sm font-medium transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-xs space-y-4 print:hidden">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filter Tanggal & Status Customer</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Cabang Toko - Superadmin Only */}
            {isSuperAdmin && (
              <div className="lg:col-span-12 space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Cabang Toko
                </label>
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

            {/* Tanggal From */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Dari Tanggal
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglFrom}
                  onChange={(e) => setTglFrom(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Tanggal To */}
            <div className="lg:col-span-3 space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Sampai Tanggal
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={tglTo}
                  onChange={(e) => setTglTo(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Customer Filter */}
            <div className="lg:col-span-3">
              <SearchableSelect
                label="Pilih Customer"
                options={custSelectOptions}
                value={customerSelect}
                onChange={setCustomerSelect}
                placeholder="-- Semua Customer --"
                searchPlaceholder="Ketik nama / ID customer..."
                searchable={true}
              />
            </div>

            {/* Status Filter Dropdown: Default 'Belum Lunas', incorporates 'Bayar Sebagian' & 'Lunas' */}
            <div className="lg:col-span-3">
              <SearchableSelect
                label="Status Pembayaran"
                options={statusSelectOptions}
                value={statusSelect}
                onChange={setStatusSelect}
                placeholder="Belum Lunas"
                searchable={false}
                
              />
            </div>

            {/* Action Buttons */}
            <div className="lg:col-span-12 flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setTglFrom('');
                  setTglTo('');
                  setCustomerSelect('');
                  setStatusSelect('Belum Lunas');
                  setSelectedIds([]);
                  const resetBranch = isSuperAdmin ? 'ALL' : (currentUser?.branch || '');
                  setSelectedCabang(resetBranch);
                  fetchPiutangData(1, undefined, resetBranch);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium transition-all flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-xs hover:shadow flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Cari Piutang</span>
              </button>
            </div>
          </form>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 print:hidden">
          {/* Card 1: Total Transaksi */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Jumlah Piutang</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.total_transaksi}{' '}
              <span className="text-xs font-normal text-slate-500">nota</span>
            </div>
          </div>

          {/* Card 2: Total Lusin */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Total Lusin</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {summary.total_lusin.toLocaleString('id-ID', { maximumFractionDigits: 2 })}{' '}
              <span className="text-xs font-normal text-slate-500">lsn</span>
            </div>
          </div>

          {/* Card 3: Total Tagihan */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <ArrowUpRight className="w-4 h-4 text-slate-600" />
              <span>Total Tagihan</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {formatCurrency(summary.total_tagihan)}
            </div>
          </div>

          {/* Card 4: Total Terbayar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Total Terbayar</span>
            </div>
            <div className="text-xl font-bold text-emerald-600">
              {formatCurrency(summary.total_terbayar)}
            </div>
          </div>

          {/* Card 5: Total Outstanding */}
          <div className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/20 shadow-xs">
            <div className="flex items-center space-x-2 text-rose-600 text-xs font-semibold uppercase tracking-wider mb-1">
              <AlertCircle className="w-4 h-4" />
              <span>Sisa Piutang (Outstanding)</span>
            </div>
            <div className="text-xl font-bold text-rose-600">
              {formatCurrency(summary.total_outstanding)}
            </div>
          </div>
        </div>

        {/* Selected Batch Action Banner */}
        {selectedIds.length > 0 && (
          <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-emerald-700 animate-fadeIn print:hidden">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-800 rounded-xl">
                <CheckSquare className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-100">
                  {selectedIds.length} Nota Transaksi Terpilih
                </div>
                <div className="text-xs text-emerald-300">
                  Total Piutang Terpilih:{' '}
                  <strong className="text-white font-mono text-sm">
                    {formatCurrency(selectedOutstandingSum)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={() => setSelectedIds([])}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-800 hover:bg-emerald-700 text-emerald-200 rounded-xl text-xs font-medium transition-all cursor-pointer"
              >
                Batal Pilih
              </button>
              <button
                onClick={() => openPaymentModal()}
                className="flex-1 sm:flex-none px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl text-xs md:text-sm transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Wallet className="w-4 h-4 shrink-0" />
                <span>Bayar Hutang ({formatCurrency(selectedOutstandingSum)})</span>
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs md:text-sm min-w-[1280px]">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold uppercase text-[11px] tracking-wider whitespace-nowrap">
                  <th className="py-3.5 px-3.5 text-center w-12 print:hidden">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      disabled={selectableItems.length === 0}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30"
                      title="Pilih Semua Transaksi Belum Lunas"
                    />
                  </th>
                  <th className="py-3.5 px-3.5 text-center w-28">Tanggal</th>
                  <th className="py-3.5 px-3.5 text-center w-28">Jatuh Tempo</th>
                  <th className="py-3.5 px-3.5 text-center min-w-[160px]">No. Transaksi</th>
                  <th className="py-3.5 px-3.5 text-left min-w-[180px]">Customer</th>
                  <th className="py-3.5 px-3.5 text-center w-24">Lusin</th>
                  <th className="py-3.5 px-3.5 text-right min-w-[140px]">Total Tagihan</th>
                  <th className="py-3.5 px-3.5 text-right min-w-[130px]">Terbayar</th>
                  <th className="py-3.5 px-3.5 text-right min-w-[150px]">Outstanding</th>
                  <th className="py-3.5 px-3.5 text-center w-32">Status</th>
                  <th className="py-3.5 px-3.5 text-center w-36 sticky right-0 bg-slate-900 z-10 print:hidden">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                        <span className="text-sm font-medium">Memuat data piutang customer...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <CreditCard className="w-10 h-10 text-slate-300" />
                        <span className="text-base font-medium text-slate-700">
                          Tidak ada data piutang ditemukan
                        </span>
                        <span className="text-xs text-slate-400">
                          Coba atur filter status ({statusSelect}), tanggal, atau customer lain.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => {
                    const isSelected = selectedIds.includes(row.id_transaksi);
                    const canPay = row.status !== 'Lunas' && row.outstanding > 0;
                    const hasPayments = row.terbayar > 0;

                    return (
                      <tr
                        key={`${row.id_transaksi}-${idx}`}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-emerald-50/70 hover:bg-emerald-100/60'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-3.5 text-center print:hidden">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(row.id_transaksi)}
                            disabled={!canPay}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-20"
                          />
                        </td>

                        {/* Tanggal */}
                        <td className="py-3.5 px-3.5 text-center font-mono text-slate-600 whitespace-nowrap">
                          {formatDateString(row.tgl_transaksi)}
                        </td>

                        {/* Jatuh Tempo */}
                        <td className="py-3.5 px-3.5 text-center font-mono text-slate-600 whitespace-nowrap">
                          {formatDateString(row.tgl_jatuh_tempo)}
                        </td>

                        {/* No. Transaksi (Clickable to view detail history) */}
                        <td className="py-3.5 px-3.5 text-center font-bold whitespace-nowrap">
                          <button
                            onClick={() => openPaymentHistoryModal(row.id_transaksi)}
                            className="text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer flex items-center justify-center space-x-1 mx-auto"
                            title="Klik untuk melihat Detail Pembayaran"
                          >
                            <span>{row.id_transaksi}</span>
                            <History className="w-3.5 h-3.5 opacity-60 hover:opacity-100 shrink-0" />
                          </button>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-3.5 text-left font-medium text-slate-800 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{row.nama_customer}</span>
                          </div>
                        </td>

                        {/* Lusin */}
                        <td className="py-3.5 px-3.5 text-center font-mono text-slate-700 whitespace-nowrap">
                          {row.lusin.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        </td>

                        {/* Total Tagihan */}
                        <td className="py-3.5 px-3.5 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {formatCurrency(row.total)}
                        </td>

                        {/* Terbayar (Clickable if has payments) */}
                        <td className="py-3.5 px-3.5 text-right font-mono text-emerald-600 font-medium whitespace-nowrap">
                          {hasPayments ? (
                            <button
                              onClick={() => openPaymentHistoryModal(row.id_transaksi)}
                              className="hover:underline font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                              title="Lihat riwayat rincian pembayaran"
                            >
                              {formatCurrency(row.terbayar)}
                            </button>
                          ) : (
                            formatCurrency(row.terbayar)
                          )}
                        </td>

                        {/* Outstanding */}
                        <td className="py-3.5 px-3.5 text-right font-mono font-bold text-rose-600 bg-rose-50/30 whitespace-nowrap">
                          {formatCurrency(row.outstanding)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                          {row.status === 'Lunas' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Lunas
                            </span>
                          ) : row.status === 'Bayar Sebagian' || row.status === 'Cicil' || row.status === 'Partially Paid' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 mr-1" />
                              Bayar Sebagian
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Belum Lunas
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-3.5 px-3.5 text-center sticky right-0 bg-white group-hover:bg-slate-50 print:hidden z-10">
                          <div className="flex items-center justify-center space-x-1.5">
                            {canPay && (
                              <button
                                onClick={() => openPaymentModal(row)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs transition-all flex items-center space-x-1 cursor-pointer"
                                title="Bayar Hutang Nota Ini"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>Bayar</span>
                              </button>
                            )}

                            <button
                              onClick={() => openPaymentHistoryModal(row.id_transaksi)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-all flex items-center space-x-1 cursor-pointer"
                              title="Lihat Detail Riwayat Pembayaran"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Detail</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Table Grand Totals Footer */}
              {!loading && items.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold text-xs md:text-sm whitespace-nowrap">
                    <td colSpan={5} className="py-3.5 px-4 text-right uppercase tracking-wider text-slate-300">
                      Grand Total ({summary.total_transaksi} Nota)
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-emerald-300">
                      {summary.total_lusin.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-white">
                      {formatCurrency(summary.total_tagihan)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-300">
                      {formatCurrency(summary.total_terbayar)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-rose-300 text-base">
                      {formatCurrency(summary.total_outstanding)}
                    </td>
                    <td colSpan={2} className="py-3.5 px-4 text-center text-slate-400 font-normal">
                      -
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Pagination Bar */}
        {pagination.total_pages > 1 && (
          <div className="px-5 py-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <div className="text-xs text-slate-600">
              Menampilkan <strong className="text-slate-800">{pagination.from_item}</strong> -{' '}
              <strong className="text-slate-800">{pagination.to_item}</strong> dari{' '}
              <strong className="text-slate-800">{pagination.total_items}</strong> transaksi piutang
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-2xs">
                {currentPage} / {pagination.total_pages}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.total_pages || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePageChange(pagination.total_pages)}
                disabled={currentPage === pagination.total_pages || loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-white cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PAYMENT INPUT MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-emerald-200" />
                  <h3 className="font-bold text-lg tracking-tight">
                    Pembayaran Piutang Customer
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-1 rounded-lg hover:bg-emerald-600 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs md:text-sm">
                {/* Info Header */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-600 text-xs flex justify-between items-center">
                  <span>
                    Jumlah Transaksi:{' '}
                    <strong className="text-slate-900 font-bold">{modalItems.length} Nota</strong>
                  </span>
                  <span>
                    Metode Pembayaran:{' '}
                    <strong className="text-emerald-700 font-bold">{metodeBayar}</strong>
                  </span>
                </div>

                {/* Selected Items List with Nominal Editor */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Daftar Transaksi & Nominal Pembayaran
                  </label>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {modalItems.map((item) => {
                      const sisaSetelahBayar = Math.max(0, item.outstanding - (item.nominalBayar || 0));

                      return (
                        <div key={item.id_transaksi} className="p-4 bg-white hover:bg-slate-50/50 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <span className="font-bold text-emerald-700 font-mono text-sm">
                                {item.id_transaksi}
                              </span>
                              <span className="text-slate-500 ml-2">({item.nama_customer})</span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              Total: {formatCurrency(item.total)} | Terbayar: {formatCurrency(item.terbayar)}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                            <div className="sm:col-span-5">
                              <span className="text-xs text-rose-600 font-semibold block">
                                Sisa Piutang (Outstanding):
                              </span>
                              <span className="text-sm font-bold font-mono text-rose-700">
                                {formatCurrency(item.outstanding)}
                              </span>
                            </div>

                            <div className="sm:col-span-7 space-y-1">
                              <label className="block text-xs font-medium text-slate-700">
                                Nominal Pembayaran (Rp):
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">
                                  Rp
                                </span>
                                <input
                                  type="text"
                                  value={item.nominalBayar ? item.nominalBayar.toLocaleString('id-ID') : ''}
                                  onChange={(e) => updateModalNominal(item.id_transaksi, e.target.value)}
                                  placeholder="0"
                                  className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800"
                                />
                              </div>
                              {sisaSetelahBayar > 0 ? (
                                <p className="text-[11px] text-amber-600 font-medium">
                                  Bayar Sebagian: Sisa piutang setelah bayar:{' '}
                                  <strong className="font-mono">{formatCurrency(sisaSetelahBayar)}</strong>
                                </p>
                              ) : (
                                <p className="text-[11px] text-emerald-600 font-medium flex items-center space-x-1">
                                  <Check className="w-3 h-3" />
                                  <span>Lunas (100% Terbayar)</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Form fields: Date, Payment Method & Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tanggal Bayar */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Tanggal Pembayaran
                    </label>
                    <input
                      type="date"
                      value={tglBayar}
                      onChange={(e) => setTglBayar(e.target.value)}
                      className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Metode Pembayaran */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Metode / Akun Pembayaran
                    </label>
                    <select
                      value={metodeBayar}
                      onChange={(e) => setMetodeBayar(e.target.value)}
                      className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="CASH">CASH (Tunai)</option>
                      {akunOptions.map((a) => (
                        <option key={a.id} value={a.tipe}>
                          {a.tipe} {a.bank ? `- ${a.bank}` : ''} {a.nama_akun ? `(${a.nama_akun})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Keterangan */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Keterangan / Catatan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={keteranganBayar}
                      onChange={(e) => setKeteranganBayar(e.target.value)}
                      placeholder="Contoh: Titip lewat sales / Pelunasan via Transfer BCA"
                      className="w-full px-3 py-2 text-xs md:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-slate-700 text-xs">
                  Total Yang Dibayarkan:{' '}
                  <span className="text-base font-bold font-mono text-emerald-700 block sm:inline">
                    {formatCurrency(grandTotalModalBayar)}
                  </span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs md:text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={handleProcessPayment}
                    disabled={isSubmitting || grandTotalModalBayar <= 0}
                    className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-bold transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Konfirmasi Pembayaran</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DETAIL PAYMENT HISTORY MODAL */}
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-lg tracking-tight">
                    Detail Riwayat Pembayaran Piutang
                  </h3>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs md:text-sm">
                {loadingHistory ? (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center space-y-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-sm font-medium">Memuat riwayat pembayaran...</span>
                  </div>
                ) : historyHeader ? (
                  <>
                    {/* Invoice Header Details */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          No. Transaksi:
                        </span>
                        <span className="font-bold font-mono text-emerald-700 text-sm">
                          {historyHeader.id_transaksi}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          Customer:
                        </span>
                        <span className="font-bold text-slate-800">
                          {historyHeader.nama_customer}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          Tanggal Nota:
                        </span>
                        <span className="font-mono text-slate-700">
                          {formatDateString(historyHeader.tgl_transaksi)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          Status Pembayaran:
                        </span>
                        {historyHeader.status === 'Lunas' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mt-0.5">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Lunas
                          </span>
                        ) : historyHeader.status === 'Bayar Sebagian' || historyHeader.status === 'Cicil' || historyHeader.status === 'Partially Paid' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 mt-0.5">
                            <Clock className="w-3 h-3 mr-1" />
                            Bayar Sebagian
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 mt-0.5">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Belum Lunas
                          </span>
                        )}
                      </div>

                      <div className="sm:col-span-2 md:col-span-4 border-t border-slate-200/80 pt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Total Tagihan</span>
                          <span className="font-mono font-bold text-slate-800 text-sm">
                            {formatCurrency(historyHeader.total)}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[11px] text-slate-500 block">Total Terbayar</span>
                          <span className="font-mono font-bold text-emerald-600 text-sm">
                            {formatCurrency(historyHeader.terbayar)}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-rose-200 bg-rose-50/30">
                          <span className="text-[11px] text-rose-600 font-medium block">
                            Sisa Piutang
                          </span>
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {formatCurrency(historyHeader.outstanding)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Payment History Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                          Riwayat Catatan Pembayaran ({historyLogs.length})
                        </h4>
                      </div>

                      {historyLogs.length === 0 ? (
                        <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 border border-slate-200/80">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="font-medium text-slate-600">
                            Belum ada riwayat pembayaran yang dicatat.
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            Nota transaksi ini belum pernah dibayar sebagian / dicicil.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px]">
                                <th className="py-2.5 px-3 text-center w-10">No</th>
                                <th className="py-2.5 px-3 text-center w-28">Tgl Bayar</th>
                                <th className="py-2.5 px-3 text-center w-28">Metode</th>
                                <th className="py-2.5 px-3 text-right w-36">Nominal Bayar</th>
                                <th className="py-2.5 px-3 text-left">Keterangan</th>
                                <th className="py-2.5 px-3 text-center w-28">User</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-700">
                              {historyLogs.map((log, idx) => (
                                <tr key={log.no_id || idx} className="hover:bg-slate-50/70">
                                  <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-medium">
                                    {formatDateString(log.tgl_bayar)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                                    <span className="inline-block px-2 py-0.5 bg-slate-200/80 rounded text-[11px]">
                                      {log.metode}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                                    {formatCurrency(log.nominal)}
                                  </td>
                                  <td className="py-2.5 px-3 text-left text-slate-600">
                                    {log.keterangan || '-'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                                    {log.dibuat_oleh}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs md:text-sm font-semibold transition-all cursor-pointer"
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
