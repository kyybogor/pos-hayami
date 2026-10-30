'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Wallet,
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
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  Trash2,
  X,
  Save,
  DollarSign,
  Building2,
  Banknote,
  CheckCircle2,
  ExternalLink,
  FileText,
} from 'lucide-react';

interface PettyCashItem {
  id_petty: string;
  tgl: string;
  keterangan: string;
  in_cash: number;
  out_cash: number;
  saldo: number;
  bukti_petty: string;
  dibuat_oleh: string;
  dibuat_tgl: string;
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
  saldo_awal: number;
  total_in: number;
  total_out: number;
  saldo_akhir: number;
}

export default function PettyCashPage() {
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getMonthStartDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  const [tglFrom, setTglFrom] = useState(getMonthStartDate());
  const [tglTo, setTglTo] = useState(getTodayDate());

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PettyCashItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: itemsPerPage,
    total_items: 0,
    total_pages: 1,
    from_item: 0,
    to_item: 0,
  });

  const [summary, setSummary] = useState<SummaryData>({
    saldo_awal: 0,
    total_in: 0,
    total_out: 0,
    saldo_akhir: 0,
  });

  const [currentUser, setCurrentUser] = useState<{ nm_user?: string; id_user?: string; branch?: string; role?: string } | null>(null);
  const isSuperAdmin = (currentUser?.role || '').toLowerCase() === 'superadmin';
  const [cabangOptions, setCabangOptions] = useState<{ id_cabang: number | string; nama_cabang: string }[]>([]);
  const [selectedCabang, setSelectedCabang] = useState('ALL');

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formIdPetty, setFormIdPetty] = useState('');
  const [formType, setFormType] = useState<'in' | 'out'>('in');
  const [formTgl, setFormTgl] = useState(getTodayDate());
  const [formKeterangan, setFormKeterangan] = useState('');
  const [formJumlah, setFormJumlah] = useState('');

  // Modal State for Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Setor Gudang State
  const [showSetorModal, setShowSetorModal] = useState(false);
  const [loadingSetorPreview, setLoadingSetorPreview] = useState(false);
  const [setorPreview, setSetorPreview] = useState<{
    next_id: string;
    total_in: number;
    total_out: number;
    saldo_aktif: number;
    id_cabang: string;
    cabang_info?: any;
  } | null>(null);
  const [setorNominal, setSetorNominal] = useState('');
  const [setorTgl, setSetorTgl] = useState(getTodayDate());
  const [setorKeterangan, setSetorKeterangan] = useState('Setoran Kas Kecil Toko ke Gudang');
  const [submittingSetor, setSubmittingSetor] = useState(false);

  // Struk Modal State
  const [showStrukModal, setShowStrukModal] = useState(false);
  const [strukData, setStrukData] = useState<any | null>(null);

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

  // Fetch Petty Cash Data
  const fetchPettyData = async (targetPage = 1, e?: React.FormEvent, overrideCabang?: string) => {
    if (e) e.preventDefault();
    setLoading(true);

    try {
      const params = new URLSearchParams({
        tgl_from: tglFrom,
        tgl_to: tglTo,
        page: targetPage.toString(),
        limit: itemsPerPage.toString(),
      });

      const branchVal = overrideCabang !== undefined ? overrideCabang : selectedCabang;
      if (branchVal && branchVal !== 'ALL') {
        params.append('cabang', branchVal);
      }

      const res = await fetch(`/api/petty-cash?${params.toString()}`);
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
            saldo_awal: 0,
            total_in: 0,
            total_out: 0,
            saldo_akhir: 0,
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
          saldo_awal: 0,
          total_in: 0,
          total_out: 0,
          saldo_akhir: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching petty cash data:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const [cRes, uRes] = await Promise.all([
          fetch('/api/cabang'),
          fetch('/api/auth/me'),
        ]);
        let userBranch = '';
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
              userBranch = uJson.user.branch;
              setSelectedCabang(userBranch);
            }
          }
        }
        fetchPettyData(1, undefined, userBranch);
      } catch (e) {
        console.error('Error init user/cabang:', e);
        fetchPettyData(1);
      }
    };
    initData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPettyData(1, e);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages && newPage !== currentPage) {
      fetchPettyData(newPage);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const openAddModal = () => {
    setFormIdPetty('');
    setFormType('in');
    setFormTgl(getTodayDate());
    setFormKeterangan('');
    setFormJumlah('');
    setShowModal(true);
  };

  const openEditModal = (item: PettyCashItem) => {
    setFormIdPetty(item.id_petty);
    if (item.in_cash > 0) {
      setFormType('in');
      setFormJumlah(item.in_cash.toString());
    } else {
      setFormType('out');
      setFormJumlah(item.out_cash.toString());
    }
    const tglFormatted = item.tgl ? new Date(item.tgl).toISOString().split('T')[0] : getTodayDate();
    setFormTgl(tglFormatted);
    setFormKeterangan(item.keterangan || '');
    setShowModal(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_petty: formIdPetty,
          petty_tipe: formType,
          tgl_petty: formTgl,
          keterangan: formKeterangan,
          jumlah: formJumlah,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowModal(false);
        fetchPettyData(currentPage);
      } else {
        alert(json.message || 'Gagal menyimpan data petty cash');
      }
    } catch (err) {
      console.error('Error saving petty cash:', err);
      alert('Terjadi kesalahan koneksi');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (id_petty: string) => {
    setDeleteTargetId(id_petty);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/petty-cash?id_petty=${encodeURIComponent(deleteTargetId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (json.success) {
        setShowDeleteModal(false);
        fetchPettyData(currentPage);
      } else {
        alert(json.message || 'Gagal menghapus data');
      }
    } catch (err) {
      console.error('Error deleting petty cash:', err);
      alert('Terjadi kesalahan jaringan');
    } finally {
      setDeleting(false);
    }
  };

  const fetchSetorPreview = async (dateStr: string) => {
    const branchToUse = selectedCabang !== 'ALL' ? selectedCabang : (currentUser?.branch || '');
    if (!branchToUse) return;

    setLoadingSetorPreview(true);
    try {
      const res = await fetch(`/api/setor-gudang?preview=1&cabang=${encodeURIComponent(branchToUse)}&tgl=${encodeURIComponent(dateStr)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setSetorPreview(json.data);
        const defNominal = Math.max(0, json.data.saldo_aktif);
        setSetorNominal(defNominal.toString());
      } else {
        alert(json.message || 'Gagal memuat info saldo cabang');
      }
    } catch (err) {
      console.error('Error loading setor preview:', err);
      alert('Terjadi kesalahan koneksi saat memuat preview setor');
    } finally {
      setLoadingSetorPreview(false);
    }
  };

  const openSetorModal = async () => {
    const branchToUse = selectedCabang !== 'ALL' ? selectedCabang : (currentUser?.branch || '');
    if (!branchToUse) {
      alert('Silakan pilih cabang toko terlebih dahulu sebelum melakukan setor.');
      return;
    }

    const today = getTodayDate();
    setShowSetorModal(true);
    setSetorTgl(today);
    setSetorKeterangan('Setoran Kas Kecil Toko ke Gudang');
    await fetchSetorPreview(today);
  };

  const handleSetorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const branchToUse = selectedCabang !== 'ALL' ? selectedCabang : (currentUser?.branch || '');
    const nominalNum = Number(setorNominal);

    if (isNaN(nominalNum) || nominalNum <= 0) {
      alert('Nominal setor harus berupa angka lebih dari 0');
      return;
    }

    setSubmittingSetor(true);
    try {
      const res = await fetch('/api/setor-gudang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cabang: branchToUse,
          nominal_setor: nominalNum,
          tgl_setor: setorTgl,
          keterangan: setorKeterangan,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setShowSetorModal(false);
        setStrukData(json.data);
        setShowStrukModal(true);
        fetchPettyData(currentPage);
      } else {
        alert(json.message || 'Gagal melakukan setoran');
      }
    } catch (err) {
      console.error('Error submitting setor:', err);
      alert('Terjadi kesalahan sistem saat melakukan setoran');
    } finally {
      setSubmittingSetor(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto print:p-0 print:m-0 print:max-w-none">
        {/* Printable Header */}
        <div className="hidden print:block mb-6 text-center border-b pb-4">
          <h1 className="text-2xl font-bold text-black uppercase tracking-wider">POS HAYAMI</h1>
          <h2 className="text-lg font-semibold text-gray-700">LAPORAN PETTY CASH</h2>
          <p className="text-sm text-gray-600">
            Periode: {formatDateString(tglFrom)} S/D {formatDateString(tglTo)}
          </p>
        </div>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Wallet className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Petty Cash
              </h1>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Kelola dan catat transaksi kas kecil (In Cash / Out Cash) serta pantau sisa saldo secara real-time.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={openAddModal}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Baru</span>
            </button>

            <button
              onClick={openSetorModal}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer"
            >
              <Banknote className="w-4 h-4" />
              <span>Setor ke Gudang</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={items.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs md:text-sm font-medium transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50"
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
            <span>Filter Periode Kas Kecil</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
            {/* Cabang Toko - Superadmin Only */}
            {isSuperAdmin && (
              <div className="lg:col-span-4 space-y-1">
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
            <div className={isSuperAdmin ? "lg:col-span-3 space-y-1" : "lg:col-span-5 space-y-1"}>
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
            <div className={isSuperAdmin ? "lg:col-span-3 space-y-1" : "lg:col-span-5 space-y-1"}>
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

            {/* Action Buttons */}
            <div className="lg:col-span-2 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setTglFrom(getMonthStartDate());
                  setTglTo(getTodayDate());
                  const resetBranch = isSuperAdmin ? 'ALL' : (currentUser?.branch || '');
                  setSelectedCabang(resetBranch);
                  fetchPettyData(1, undefined, resetBranch);
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium transition-all flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-sm hover:shadow flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Cari</span>
              </button>
            </div>
          </form>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
          {/* Card 1: Saldo Awal */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4 text-slate-600" />
              <span>Saldo Awal Periode</span>
            </div>
            <div className="text-xl font-bold text-slate-800">
              {formatCurrency(summary.saldo_awal)}
            </div>
          </div>

          {/* Card 2: Total In Cash */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-1">
              <ArrowDownRight className="w-4 h-4" />
              <span>Total In Cash</span>
            </div>
            <div className="text-xl font-bold text-emerald-600">
              +{formatCurrency(summary.total_in)}
            </div>
          </div>

          {/* Card 3: Total Out Cash */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-2 text-rose-600 text-xs font-semibold uppercase tracking-wider mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span>Total Out Cash</span>
            </div>
            <div className="text-xl font-bold text-rose-600">
              -{formatCurrency(summary.total_out)}
            </div>
          </div>

          {/* Card 4: Sisa Saldo Akhir */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <div className="flex items-center space-x-2 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-1">
              <Wallet className="w-4 h-4" />
              <span>Sisa Saldo Akhir</span>
            </div>
            <div className="text-xl font-bold text-emerald-700">
              {formatCurrency(summary.saldo_akhir)}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-800 text-white font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4 text-center w-14">No.</th>
                  <th className="py-3 px-4 text-center w-28">Tanggal</th>
                  <th className="py-3 px-4 text-center min-w-[140px]">No. Petty</th>
                  <th className="py-3 px-4 text-left min-w-[250px]">Keterangan</th>
                  <th className="py-3 px-4 text-right w-36">In Cash</th>
                  <th className="py-3 px-4 text-right w-36">Out Cash</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Saldo</th>
                  <th className="py-3 px-4 text-center w-24 print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-slate-700">
                {/* Initial Balance Row */}
                <tr className="bg-slate-100/80 font-semibold text-slate-600">
                  <td className="py-2.5 px-4 text-center font-mono">-</td>
                  <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                    {formatDateString(tglFrom)}
                  </td>
                  <td className="py-2.5 px-4 text-center font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-4 text-left italic">
                    SALDO AWAL KAS KECIL
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-400">0</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-400">0</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(summary.saldo_awal)}
                  </td>
                  <td className="py-2.5 px-4 text-center print:hidden">-</td>
                </tr>

                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                        <span className="text-sm font-medium">Memuat data petty cash...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Wallet className="w-10 h-10 text-slate-300" />
                        <span className="text-base font-medium text-slate-700">
                          Tidak ada transaksi petty cash pada periode ini
                        </span>
                        <span className="text-xs text-slate-400">
                          Klik tombol "Tambah Baru" untuk mencatat transaksi kas kecil.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => (
                    <tr key={`${row.id_petty}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {pagination.from_item + idx}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {formatDateString(row.tgl)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-700">
                        {row.id_petty}
                      </td>
                      <td className="py-3 px-4 text-left font-medium text-slate-800 whitespace-pre-line">
                        {row.keterangan}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {row.in_cash > 0 ? formatCurrency(row.in_cash) : '0'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                        {row.out_cash > 0 ? `(${formatCurrency(row.out_cash)})` : '0'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                        {formatCurrency(row.saldo)}
                      </td>
                      <td className="py-3 px-4 text-center print:hidden">
                        <div className="flex items-center justify-center space-x-1">
                          {(row.bukti_petty?.startsWith('INV-TOKO') || row.keterangan?.includes('INV-TOKO')) && (
                            <button
                              type="button"
                              onClick={() => {
                                const idToPrint = row.bukti_petty?.startsWith('INV-TOKO') 
                                  ? row.bukti_petty 
                                  : (row.keterangan.match(/INV-TOKO\/[0-9]+\/[0-9]+/)?.[0] || '');
                                if (idToPrint) {
                                  window.open(`/print/setor-gudang?id=${encodeURIComponent(idToPrint)}`, '_blank');
                                }
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Cetak Ulang Struk Setor Gudang"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Ubah Petty Cash"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(row.id_petty)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Petty Cash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Grand Totals Footer */}
              {!loading && items.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold text-xs md:text-sm">
                    <td colSpan={4} className="py-3.5 px-4 text-right uppercase tracking-wider text-slate-300">
                      Total Periode
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-300">
                      +{formatCurrency(summary.total_in)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-rose-300">
                      -({formatCurrency(summary.total_out)})
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-white text-base">
                      {formatCurrency(summary.saldo_akhir)}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-normal print:hidden">
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
              <strong className="text-slate-800">{pagination.total_items}</strong> transaksi
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

        {/* MODAL CREATE / EDIT PETTY CASH */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-5 py-4 bg-slate-800 text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold">
                    {formIdPetty ? 'Ubah Petty Cash' : 'Tambah Petty Cash Baru'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSubmit} className="p-5 space-y-4">
                {/* Tipe In/Out */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipe Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'in' | 'out')}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    required
                  >
                    <option value="in">In Cash (Uang Masuk)</option>
                    <option value="out">Out Cash (Uang Keluar)</option>
                  </select>
                </div>

                {/* Tanggal */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tanggal Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formTgl}
                    onChange={(e) => setFormTgl(e.target.value)}
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>

                {/* Keterangan */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Keterangan / Keperluan
                  </label>
                  <textarea
                    rows={3}
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    placeholder="Tuliskan keterangan detail transaksi kas kecil..."
                    className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  ></textarea>
                </div>

                {/* Jumlah Nominal */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Jumlah Nominal (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formJumlah}
                      onChange={(e) => setFormJumlah(e.target.value)}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 text-xs md:text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm hover:shadow flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Simpan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DELETE CONFIRMATION */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center space-x-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-800">
                  Hapus Petty Cash
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                Apakah Anda yakin ingin menghapus data petty cash{' '}
                <strong className="text-slate-800">{deleteTargetId}</strong>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SETOR KAS KE GUDANG */}
        {showSetorModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 md:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      Setor Kas ke Gudang
                    </h2>
                    <p className="text-xs text-slate-500">
                      Setorkan saldo kas kecil toko ke pusat / gudang
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSetorModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingSetorPreview ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-500">
                  <RefreshCw className="w-7 h-7 animate-spin text-amber-600" />
                  <span className="text-xs font-medium">Memuat rincian saldo cabang...</span>
                </div>
              ) : (
                <form onSubmit={handleSetorSubmit} className="space-y-4">
                  {/* Generated ID Badge & Cabang */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                        No. Bukti Setor (Otomatis)
                      </span>
                      <span className="text-sm font-mono font-bold text-amber-950">
                        {setorPreview?.next_id || 'INV-TOKO/1026/0001'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-amber-700 font-medium block">Cabang Toko</span>
                      <span className="text-xs font-bold text-slate-800">
                        {setorPreview?.id_cabang || selectedCabang}
                      </span>
                    </div>
                  </div>

                  {/* Saldo Information Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total In Cash</span>
                      <span className="text-xs font-bold font-mono text-emerald-600">
                        +{formatCurrency(setorPreview?.total_in || 0)}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                      <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Out Cash</span>
                      <span className="text-xs font-bold font-mono text-rose-600">
                        -{formatCurrency(setorPreview?.total_out || 0)}
                      </span>
                    </div>
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5">
                      <span className="text-[10px] text-emerald-700 font-bold block uppercase">Saldo Kas Aktif</span>
                      <span className="text-xs font-bold font-mono text-emerald-800">
                        {formatCurrency(setorPreview?.saldo_aktif || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Input Tanggal Setor */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tanggal Setor <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={setorTgl}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setSetorTgl(newDate);
                        if (newDate) {
                          fetchSetorPreview(newDate);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-mono"
                      required
                    />
                  </div>

                  {/* Input Nominal Setor */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nominal Yang Disetor (Rp) <span className="text-rose-500">*</span>
                      </label>
                      {setorPreview && setorPreview.saldo_aktif > 0 && (
                        <button
                          type="button"
                          onClick={() => setSetorNominal(setorPreview.saldo_aktif.toString())}
                          className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 underline cursor-pointer"
                        >
                          Setor Seluruh Saldo ({formatCurrency(setorPreview.saldo_aktif)})
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        value={setorNominal}
                        onChange={(e) => setSetorNominal(e.target.value)}
                        placeholder="0"
                        className="w-full pl-9 pr-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      * Kolom <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">grandtotal</code> dan <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">hutang</code> pada tabel setor_gudang akan diisi sama dengan nominal ini.
                    </p>
                  </div>

                  {/* Input Keterangan */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Keterangan / Catatan
                    </label>
                    <input
                      type="text"
                      value={setorKeterangan}
                      onChange={(e) => setSetorKeterangan(e.target.value)}
                      placeholder="Contoh: Setoran Kas Kecil Toko ke Gudang..."
                      className="w-full px-3 py-2 text-xs md:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    />
                  </div>

                  {/* Notice callout */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-700">Catatan Sistem:</p>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-500">
                      <li>Tersimpan ke tabel <strong>setor_gudang</strong> untuk sinkronisasi ke online.</li>
                      <li>Otomatis mencatat kas keluar (Out Cash) di kas kecil sehingga saldo langsung berkurang menjadi <strong>Rp 0</strong>.</li>
                      <li>Struk rincian setoran akan langsung dicetak setelah konfirmasi.</li>
                    </ul>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowSetorModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submittingSetor}
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm hover:shadow flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {submittingSetor ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Banknote className="w-4 h-4" />
                      )}
                      <span>Konfirmasi & Setor Kas</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* MODAL STRUK SETOR GUDANG (THERMAL RECEIPT PREVIEW) */}
        {showStrukModal && strukData && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              {/* Header Status */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-1.5 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-bold text-slate-800">Setoran Berhasil!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStrukModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thermal Paper Receipt Body */}
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 font-mono text-xs space-y-2.5">
                <div className="text-center pb-2 border-b border-dashed border-slate-300">
                  <h3 className="font-black text-sm uppercase text-slate-900">POS HAYAMI</h3>
                  <p className="font-bold text-[11px] text-slate-700">{strukData.id_cabang}</p>
                  <p className="text-[10px] text-slate-500 uppercase mt-0.5 font-bold">
                    STRUK SETORAN KAS KE GUDANG
                  </p>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. Bukti</span>
                    <span className="font-bold text-slate-900">{strukData.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tanggal</span>
                    <span className="font-medium text-slate-800">{strukData.tgl_setor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kasir</span>
                    <span className="font-medium text-slate-800">{strukData.dibuat_oleh}</span>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Masuk (In)</span>
                    <span className="text-emerald-700 font-semibold">+{formatCurrency(strukData.total_masuk)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Keluar (Out)</span>
                    <span className="text-rose-700 font-semibold">-{formatCurrency(strukData.total_keluar - (strukData.nominal_setor || 0))}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-dotted border-slate-200">
                    <span className="text-slate-600">Saldo Sebelum Setor</span>
                    <span className="font-bold text-slate-800">{formatCurrency(strukData.saldo_sebelum)}</span>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-slate-200 my-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black text-slate-900">TOTAL DISETOR</span>
                      <span className="font-black text-emerald-700">{formatCurrency(strukData.grandtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>Hutang Gudang:</span>
                      <span className="font-bold text-slate-700">{formatCurrency(strukData.hutang)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between font-bold pt-1">
                    <span className="text-slate-700">Sisa Saldo Kas Toko</span>
                    <span className="text-slate-900">{formatCurrency(strukData.saldo_akhir)}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-center pt-1">
                  Status: Tersimpan di setor_gudang & siap sinkron online
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    window.open(`/print/setor-gudang?id=${encodeURIComponent(strukData.id)}`, '_blank');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Struk Thermal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStrukModal(false)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Selesai & Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
