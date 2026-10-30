'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  CreditCard,
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
  Landmark,
  Wallet,
} from 'lucide-react';

interface Account {
  id_akun: string;
  tipe: string;
  bank: string;
  nama_akun: string;
  no_akun: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MasterAccountPage() {
  const [items, setItems] = useState<Account[]>([]);
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
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState<Account>({
    id_akun: '',
    tipe: '',
    bank: '',
    nama_akun: '',
    no_akun: '',
  });

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/master-account?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setItems(data.data || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        showToast('error', data.message || 'Gagal memuat data account.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat memuat data account.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAccounts();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchAccounts]);

  const handleOpenAddModal = async () => {
    setIsEditing(false);
    setSelectedAccount(null);
    setFormData({
      id_akun: '',
      tipe: 'CASH',
      bank: 'CASH',
      nama_akun: '',
      no_akun: '-',
    });

    // Auto-generate next ID Akun
    try {
      const res = await fetch('/api/master-account?generate_id=true');
      const data = await res.json();
      if (res.ok && data.success && data.nextId) {
        setFormData((prev) => ({ ...prev, id_akun: data.nextId }));
      }
    } catch (err) {
      console.error('Failed to generate account ID:', err);
    }

    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: Account) => {
    setIsEditing(true);
    setSelectedAccount(item);
    setFormData({
      id_akun: item.id_akun || '',
      tipe: item.tipe || '',
      bank: item.bank || '',
      nama_akun: item.nama_akun || '',
      no_akun: item.no_akun || '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (item: Account) => {
    setSelectedAccount(item);
    setIsDeleteModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tipe.trim()) {
      showToast('error', 'Tipe Akun wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing && selectedAccount
        ? `/api/master-account/${encodeURIComponent(selectedAccount.id_akun)}`
        : '/api/master-account';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data account berhasil disimpan.');
        setIsFormModalOpen(false);
        fetchAccounts();
      } else {
        showToast('error', data.message || 'Gagal menyimpan data account.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/master-account/${encodeURIComponent(selectedAccount.id_akun)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data account berhasil dihapus.');
        setIsDeleteModalOpen(false);
        fetchAccounts();
      } else {
        showToast('error', data.message || 'Gagal menghapus data account.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menghapus.');
    } finally {
      setDeleting(false);
    }
  };

  const getTipeBadge = (tipe?: string) => {
    const t = (tipe || '').toUpperCase();
    if (t === 'CASH') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          CASH
        </span>
      );
    }
    if (t === 'TRANSFER') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          TRANSFER
        </span>
      );
    }
    if (t === 'EDC') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          EDC
        </span>
      );
    }
    if (t === 'HUTANG') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          HUTANG
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
        {t || '-'}
      </span>
    );
  };

  const startEntry = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Toast Alert Banner */}
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

        {/* Page Title & Main Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Account</h1>
              <p className="text-xs text-slate-500">Kelola akun pembayaran, tipe kas, bank, dan nomor rekening</p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Account Baru</span>
          </button>
        </div>

        {/* Search, Filter & Limit Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto flex-1">
            <div className="relative flex-1 sm:w-80">
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
                placeholder="Cari ID, Tipe, Bank, Nama Akun..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
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
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>data</span>
            </div>

            <button
              onClick={fetchAccounts}
              className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-medium"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">ID Akun</th>
                  <th className="py-3.5 px-4 text-center">Tipe Akun</th>
                  <th className="py-3.5 px-4">Bank</th>
                  <th className="py-3.5 px-4">Nama Akun</th>
                  <th className="py-3.5 px-4">No Akun</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs">Memuat data account...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <Wallet className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Tidak ada data account</p>
                        <p className="text-xs text-slate-400">
                          {search ? 'Coba ubah kata kunci pencarian' : 'Klik tombol Tambah Account Baru untuk menambahkan akun'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id_akun} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-emerald-700 whitespace-nowrap font-mono text-xs">
                        {item.id_akun}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getTipeBadge(item.tipe)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Landmark className="w-4 h-4 text-slate-400" />
                          <span>{item.bank || '-'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {item.nama_akun || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 text-xs">
                        {item.no_akun || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Ubah Account"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Account"
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
            <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <div>
                Menampilkan <strong className="text-slate-900">{startEntry}</strong> &ndash;{' '}
                <strong className="text-slate-900">{endEntry}</strong> dari{' '}
                <strong className="text-slate-900">{pagination.total.toLocaleString()}</strong> total account
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1 || loading}
                  className="p-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="px-3 py-1.5 font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg">
                  Hal {pagination.page} / {pagination.totalPages}
                </div>

                <button
                  onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                  disabled={page >= pagination.totalPages || loading}
                  className="p-2 border border-slate-300 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">
                    {isEditing ? 'Ubah Data Account' : 'Tambah Account Baru'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveAccount} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ID Akun</label>
                    <input
                      type="text"
                      value={formData.id_akun}
                      onChange={(e) => setFormData({ ...formData, id_akun: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 text-sm font-mono font-semibold"
                      required
                      readOnly={isEditing}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Tipe Akun *</label>
                    <input
                      type="text"
                      value={formData.tipe}
                      onChange={(e) => setFormData({ ...formData, tipe: e.target.value })}
                      placeholder="Contoh: CASH, TRANSFER, EDC"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold uppercase"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Bank / Nama Metode *</label>
                  <input
                    type="text"
                    value={formData.bank}
                    onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                    placeholder="Contoh: BCA, MANDIRI, CASH"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Akun (Atas Nama) *</label>
                  <input
                    type="text"
                    value={formData.nama_akun}
                    onChange={(e) => setFormData({ ...formData, nama_akun: e.target.value })}
                    placeholder="Contoh: Toko Hayami"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">No. Akun / No. Rekening</label>
                  <input
                    type="text"
                    value={formData.no_akun}
                    onChange={(e) => setFormData({ ...formData, no_akun: e.target.value })}
                    placeholder="Contoh: 1234567890 atau -"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

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
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Simpan Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {isDeleteModalOpen && selectedAccount && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Hapus Account</h3>
              </div>

              <p className="text-sm text-slate-600">
                Apakah Anda yakin ingin menghapus account{' '}
                <strong className="text-slate-900">{selectedAccount.bank} - {selectedAccount.nama_akun}</strong> (
                <span className="font-mono text-emerald-700">{selectedAccount.id_akun}</span>)?
              </p>

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
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Ya, Hapus Account</span>
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
