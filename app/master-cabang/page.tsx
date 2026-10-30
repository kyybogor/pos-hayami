'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Store,
  MapPin,
  Phone,
  FileText,
  Lock,
  Layers,
  MapPinOff,
  AlertTriangle,
} from 'lucide-react';

interface CabangItem {
  id_cabang: number;
  nama_cabang: string;
  alamat: string;
  city: string;
  npwp: string;
  nomor_telepon: string;
  jenis_cabang: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MasterCabangPage() {
  const [items, setItems] = useState<CabangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCabang, setSelectedCabang] = useState<CabangItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState({
    nama_cabang: '',
    alamat: '',
    city: '',
    npwp: '',
    nomor_telepon: '',
    jenis_cabang: '',
  });

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchCabang = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/master-cabang?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setItems(data.data || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        showToast('error', data.message || 'Gagal memuat data cabang.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat memuat data cabang.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCabang();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCabang]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalCabang = pagination.total;
    const withNpwp = items.filter((i) => i.npwp && i.npwp.trim() !== '').length;
    const withPhone = items.filter((i) => i.nomor_telepon && i.nomor_telepon.trim() !== '').length;
    const cities = new Set(items.map((i) => i.city).filter((c) => c && c.trim() !== ''));

    return {
      total: totalCabang,
      withNpwp,
      withPhone,
      uniqueCities: cities.size,
    };
  }, [items, pagination.total]);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setSelectedCabang(null);
    setFormData({
      nama_cabang: '',
      alamat: '',
      city: '',
      npwp: '',
      nomor_telepon: '',
      jenis_cabang: '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: CabangItem) => {
    setIsEditing(true);
    setSelectedCabang(item);
    setFormData({
      nama_cabang: item.nama_cabang || '',
      alamat: item.alamat || '',
      city: item.city || '',
      npwp: item.npwp || '',
      nomor_telepon: item.nomor_telepon || '',
      jenis_cabang: item.jenis_cabang || '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (item: CabangItem) => {
    setSelectedCabang(item);
    setIsDeleteModalOpen(true);
  };

  const handleSaveCabang = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEditing && !formData.nama_cabang.trim()) {
      showToast('error', 'Nama Cabang wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing && selectedCabang
        ? `/api/master-cabang/${selectedCabang.id_cabang}`
        : '/api/master-cabang';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data cabang berhasil disimpan.');
        setIsFormModalOpen(false);
        fetchCabang();
      } else {
        showToast('error', data.message || 'Gagal menyimpan data cabang.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCabang = async () => {
    if (!selectedCabang) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/master-cabang/${selectedCabang.id_cabang}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data cabang berhasil dihapus.');
        setIsDeleteModalOpen(false);
        fetchCabang();
      } else {
        showToast('error', data.message || 'Gagal menghapus data cabang.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menghapus.');
    } finally {
      setDeleting(false);
    }
  };

  const startEntry = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        {/* Toast Alert Banner */}
        {toast && (
          <div
            className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center space-x-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
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
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Page Title & Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Cabang</h1>
              <p className="text-xs text-slate-500">
                Kelola data cabang toko, alamat operasional, NPWP, dan kontak
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Cabang Baru</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Total Cabang</div>
              <div className="text-lg font-bold text-slate-900">{stats.total} Cabang</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Kota Tercatat</div>
              <div className="text-lg font-bold text-slate-900">{stats.uniqueCities} Wilayah</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Dengan NPWP</div>
              <div className="text-lg font-bold text-slate-900">{stats.withNpwp} Terdaftar</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Dengan Kontak</div>
              <div className="text-lg font-bold text-slate-900">{stats.withPhone} Cabang</div>
            </div>
          </div>
        </div>

        {/* Search & Pagination Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto flex-1">
            <div className="relative flex-1 sm:w-96">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari ID, Nama Cabang, Kota, NPWP, Telepon..."
                className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <span>Tampilkan:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>data</span>
            </div>

            <button
              onClick={fetchCabang}
              className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-medium"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-16 text-center">id_cabang</th>
                  <th className="py-3.5 px-4">nama_cabang</th>
                  <th className="py-3.5 px-4 min-w-[220px]">alamat</th>
                  <th className="py-3.5 px-4">city</th>
                  <th className="py-3.5 px-4">npwp</th>
                  <th className="py-3.5 px-4">nomor_telepon</th>
                  <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-7 h-7 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs font-medium text-slate-500">Memuat data cabang...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <MapPinOff className="w-10 h-10 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-700">Tidak ada data cabang</p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          {search
                            ? 'Tidak ada cabang yang cocok dengan pencarian Anda. Coba kata kunci lain.'
                            : 'Belum ada data cabang. Silakan klik tombol "Tambah Cabang Baru" untuk menambahkan.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id_cabang} className="hover:bg-slate-50/90 transition-colors">
                      {/* id_cabang */}
                      <td className="py-3.5 px-4 text-center font-semibold text-emerald-700 whitespace-nowrap font-mono text-xs">
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md">
                          {item.id_cabang}
                        </span>
                      </td>

                      {/* nama_cabang */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-slate-900 tracking-tight">
                            {item.nama_cabang}
                          </span>
                          {item.jenis_cabang && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {item.jenis_cabang}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* alamat */}
                      <td className="py-3.5 px-4 text-slate-700 text-xs max-w-xs leading-relaxed whitespace-pre-line">
                        {item.alamat || <span className="text-slate-400 italic">-</span>}
                      </td>

                      {/* city */}
                      <td className="py-3.5 px-4 text-slate-700 text-xs">
                        {item.city ? (
                          <div className="flex items-center space-x-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.city}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* npwp */}
                      <td className="py-3.5 px-4 text-slate-700 text-xs whitespace-nowrap font-mono">
                        {item.npwp ? (
                          <span className="bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-800">
                            {item.npwp}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* nomor_telepon */}
                      <td className="py-3.5 px-4 text-slate-700 text-xs whitespace-nowrap">
                        {item.nomor_telepon ? (
                          <a
                            href={`tel:${item.nomor_telepon}`}
                            className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 hover:underline font-mono"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{item.nomor_telepon}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-emerald-200"
                            title="Edit Cabang (Nama cabang terkunci)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            title="Hapus Cabang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pagination.total > 0 && (
            <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <div>
                Menampilkan <strong className="text-slate-900">{startEntry}</strong> &ndash;{' '}
                <strong className="text-slate-900">{endEntry}</strong> dari{' '}
                <strong className="text-slate-900">{pagination.total.toLocaleString()}</strong> total cabang
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1 || loading}
                  className="p-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3 py-1.5 font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg shadow-xs">
                  Hal {pagination.page} / {pagination.totalPages}
                </div>

                <button
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  disabled={page >= pagination.totalPages || loading}
                  className="p-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
                  title="Halaman Selanjutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FORM MODAL (ADD / EDIT) */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {isEditing ? 'Ubah Data Cabang' : 'Tambah Cabang Baru'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {isEditing
                        ? 'Edit informasi alamat, kota, NPWP, dan nomor telepon'
                        : 'Masukkan rincian cabang baru ke dalam sistem'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCabang} className="p-6 space-y-4">
                {/* Notice saat Edit: nama_cabang TIDAK BOLEH diedit */}
                {isEditing ? (
                  <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Nama Cabang Terkunci</strong>
                      <span>
                        Nama cabang tidak dapat diubah demi menjaga integritas data transaksi penjualan,
                        closing harian, dan mutasi stok.
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Field ID Cabang (hanya muncul saat Edit) */}
                {isEditing && selectedCabang && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ID Cabang</label>
                    <input
                      type="text"
                      value={`#${selectedCabang.id_cabang}`}
                      disabled
                      className="w-full px-3.5 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-500 text-sm font-mono font-semibold cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Field Nama Cabang */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Nama Cabang {!isEditing && <span className="text-rose-500">*</span>}
                    </label>
                    {isEditing && (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-400">
                        <Lock className="w-3 h-3 text-amber-500" />
                        <span>Read Only</span>
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.nama_cabang}
                      onChange={(e) => setFormData({ ...formData, nama_cabang: e.target.value })}
                      placeholder="Contoh: TKA-JATINEGARA-JAKARTA"
                      disabled={isEditing}
                      required={!isEditing}
                      autoFocus={!isEditing}
                      className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-medium transition-all ${
                        isEditing
                          ? 'bg-slate-100 border-slate-300 text-slate-500 font-bold cursor-not-allowed'
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white'
                      }`}
                    />
                    {isEditing && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Field Alamat */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alamat Lengkap</label>
                  <textarea
                    rows={3}
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    placeholder="Masukkan alamat lengkap cabang (gedung, lantai, blok, jalan)..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                  />
                </div>

                {/* Grid 2 Kolom: City & Telepon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Kota / Wilayah</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="Contoh: Jakarta Timur, DKI Jakarta, 13310"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Nomor Telepon</label>
                    <input
                      type="text"
                      value={formData.nomor_telepon}
                      onChange={(e) => setFormData({ ...formData, nomor_telepon: e.target.value })}
                      placeholder="Contoh: 087788155246"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Grid 2 Kolom: NPWP & Jenis Cabang */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">NPWP</label>
                    <input
                      type="text"
                      value={formData.npwp}
                      onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                      placeholder="Contoh: NPWP: 86.783.673.6-033.000"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Jenis Cabang</label>
                    <input
                      type="text"
                      value={formData.jenis_cabang}
                      onChange={(e) => setFormData({ ...formData, jenis_cabang: e.target.value })}
                      placeholder="Contoh: Pusat / Cabang / Online"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{isEditing ? 'Simpan Perubahan' : 'Simpan Cabang'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {isDeleteModalOpen && selectedCabang && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100 shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Hapus Cabang</h3>
                  <p className="text-xs text-slate-500">Konfirmasi penghapusan data master cabang</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="text-slate-500 font-medium">Data Cabang yang akan dihapus:</div>
                <div className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{selectedCabang.nama_cabang}</span>
                  <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                    #{selectedCabang.id_cabang}
                  </span>
                </div>
                {selectedCabang.city && (
                  <div className="text-slate-600 text-xs">{selectedCabang.city}</div>
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Sistem akan memverifikasi apakah cabang ini memiliki riwayat transaksi atau terhubung
                  dengan pengguna sebelum menghapus.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCabang}
                  disabled={deleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold rounded-xl text-sm transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Ya, Hapus Cabang</span>
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
