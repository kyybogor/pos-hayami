'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  UserCheck,
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
  Shield,
  Phone,
  MapPin,
  Lock,
  Building2,
} from 'lucide-react';

interface UserLogin {
  id_karyawan: number;
  user_id: string;
  nama_lengkap: string;
  alamat?: string;
  no_telp?: string;
  grup?: string; // 'super' | 'admin' | 'franchise'
  jenis_pajak?: string; // '1' | '2' | '3'
  tipe?: string;
  cabang?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MasterUserLoginPage() {
  const [items, setItems] = useState<UserLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorTipe, setCreatorTipe] = useState<string>('offline');
  const [creatorBranch, setCreatorBranch] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [branchesList, setBranchesList] = useState<string[]>([]);
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
  const [selectedUser, setSelectedUser] = useState<UserLogin | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState<{
    id_karyawan?: number;
    user_id: string;
    pass: string;
    nama_lengkap: string;
    alamat: string;
    no_telp: string;
    grup: string;
    jenis_pajak: string;
    cabang: string;
  }>({
    user_id: '',
    pass: '',
    nama_lengkap: '',
    alamat: '',
    no_telp: '',
    grup: 'admin',
    jenis_pajak: '1',
    cabang: '',
  });

  useEffect(() => {
    async function loadCabang() {
      try {
        const res = await fetch('/api/cabang');
        const data = await res.json();
        if (data.success && Array.isArray(data.cabang)) {
          const list = data.cabang.map((c: any) => c.nama_cabang).filter(Boolean);
          setBranchesList(list);
        }
      } catch (err) {
        console.error('Error loading branches:', err);
      }
    }
    loadCabang();
  }, []);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/master-user-login?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setItems(data.data || []);
        if (data.creatorTipe) {
          setCreatorTipe(data.creatorTipe);
        }
        if (data.creatorBranch) {
          setCreatorBranch(data.creatorBranch);
        }
        if (data.isSuperAdmin !== undefined) {
          setIsSuperAdmin(Boolean(data.isSuperAdmin));
        }
        if (data.cabangList && Array.isArray(data.cabangList) && data.cabangList.length > 0) {
          setBranchesList(data.cabangList);
        }
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        showToast('error', data.message || 'Gagal memuat data user login.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat memuat data user login.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setSelectedUser(null);
    setFormData({
      user_id: '',
      pass: '',
      nama_lengkap: '',
      alamat: '',
      no_telp: '',
      grup: 'admin',
      jenis_pajak: '1',
      cabang: creatorBranch || (branchesList.length > 0 ? branchesList[0] : ''),
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: UserLogin) => {
    setIsEditing(true);
    setSelectedUser(item);
    setFormData({
      id_karyawan: item.id_karyawan,
      user_id: item.user_id || '',
      pass: '', // Leave blank unless user wants to change password
      nama_lengkap: item.nama_lengkap || '',
      alamat: item.alamat || '',
      no_telp: item.no_telp || '',
      grup: item.grup || 'admin',
      jenis_pajak: item.jenis_pajak || '1',
      cabang: item.cabang || creatorBranch || '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (item: UserLogin) => {
    setSelectedUser(item);
    setIsDeleteModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.user_id.trim()) {
      showToast('error', 'Username / User ID wajib diisi!');
      return;
    }
    if (!formData.nama_lengkap.trim()) {
      showToast('error', 'Nama Lengkap wajib diisi!');
      return;
    }
    if (!isEditing && !formData.pass.trim()) {
      showToast('error', 'Password wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing && selectedUser
        ? `/api/master-user-login/${selectedUser.id_karyawan}`
        : '/api/master-user-login';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data user berhasil disimpan.');
        setIsFormModalOpen(false);
        fetchUsers();
      } else {
        showToast('error', data.message || 'Gagal menyimpan data user.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/master-user-login/${selectedUser.id_karyawan}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data user berhasil dihapus.');
        setIsDeleteModalOpen(false);
        fetchUsers();
      } else {
        showToast('error', data.message || 'Gagal menghapus data user.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menghapus.');
    } finally {
      setDeleting(false);
    }
  };

  const getRoleBadge = (grup?: string) => {
    switch (grup) {
      case 'super':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Superadmin
          </span>
        );
      case 'franchise':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Admin
          </span>
        );
    }
  };

  const getPajakBadge = (jenis?: string) => {
    switch (jenis) {
      case '2':
        return <span className="text-xs font-semibold text-slate-600">Pribadi</span>;
      case '3':
        return <span className="text-xs font-semibold text-purple-700">KRA</span>;
      default:
        return <span className="text-xs font-semibold text-blue-700">RWA</span>;
    }
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
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master User Login</h1>
              <p className="text-xs text-slate-500">Kelola akun pengguna, username login, password, dan peranan (role)</p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User Login</span>
          </button>
        </div>

        {/* Search & Pagination Limit Controls */}
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
                placeholder="Cari Username, Nama, Telepon..."
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
              onClick={fetchUsers}
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
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">User ID (Username)</th>
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">Kontak / Alamat</th>
                  <th className="py-3.5 px-4">Cabang</th>
                  <th className="py-3.5 px-4 text-center">Role User</th>
                  <th className="py-3.5 px-4 text-center">Tipe Akun</th>
                  <th className="py-3.5 px-4 text-center">Admin Pajak</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs">Memuat data user login...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <Shield className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Tidak ada data user login</p>
                        <p className="text-xs text-slate-400">
                          {search ? 'Coba ubah kata kunci pencarian' : 'Klik tombol Tambah User Login untuk menambahkan pengguna baru'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id_karyawan} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-center font-medium text-slate-400 text-xs">
                        {startEntry + idx}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700 whitespace-nowrap font-mono text-xs">
                        {item.user_id}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item.nama_lengkap}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {item.no_telp && (
                          <div className="flex items-center space-x-1 font-medium text-slate-800">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{item.no_telp}</span>
                          </div>
                        )}
                        {item.alamat && (
                          <div className="flex items-center space-x-1 text-slate-500 mt-0.5 truncate max-w-xs">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{item.alamat}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{item.cabang || '-'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getRoleBadge(item.grup)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            (item.tipe || 'offline').toLowerCase() === 'online'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              (item.tipe || 'offline').toLowerCase() === 'online'
                                ? 'bg-sky-500 animate-pulse'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span className="uppercase tracking-wider">{item.tipe || 'offline'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {getPajakBadge(item.jenis_pajak)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Ubah User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(item)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus User"
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
                <strong className="text-slate-900">{pagination.total.toLocaleString()}</strong> total user
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
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">
                    {isEditing ? 'Ubah Data User Login' : 'Tambah User Login Baru'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Info Tipe Akun Otomatis */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-slate-700 font-medium">
                    <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tipe Akun {!isEditing ? '(Disamakan Sesuai Akun Anda)' : ''}:</span>
                  </div>
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                      (isEditing ? (selectedUser?.tipe || creatorTipe) : creatorTipe).toLowerCase() === 'online'
                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        (isEditing ? (selectedUser?.tipe || creatorTipe) : creatorTipe).toLowerCase() === 'online'
                          ? 'bg-sky-500 animate-pulse'
                          : 'bg-amber-500'
                      }`}
                    />
                    <span>{isEditing ? (selectedUser?.tipe || creatorTipe) : creatorTipe}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Username (User ID) *</label>
                    <input
                      type="text"
                      value={formData.user_id}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      placeholder="Contoh: admin1"
                      disabled={isEditing}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono ${
                        isEditing ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-900 focus:ring-2 focus:ring-emerald-500'
                      }`}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Password {isEditing ? '(Opsional)' : '*'}</span>
                      {isEditing && <Lock className="w-3 h-3 text-amber-500" />}
                    </label>
                    <input
                      type="password"
                      value={formData.pass}
                      onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
                      placeholder={isEditing ? 'Isi jika ubah password' : 'Masukkan Password'}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Lengkap *</label>
                  <input
                    type="text"
                    value={formData.nama_lengkap}
                    onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                    placeholder="Masukkan Nama Lengkap Karyawan"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">No. Telepon</label>
                    <input
                      type="text"
                      value={formData.no_telp}
                      onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })}
                      placeholder="0812xxxxxxxx"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Role User</label>
                    <select
                      value={formData.grup}
                      onChange={(e) => setFormData({ ...formData, grup: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="super">Superadmin</option>
                      <option value="admin">Admin</option>
                      <option value="franchise">Manager</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Cabang User *</span>
                    </span>
                    {isSuperAdmin ? (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        Superadmin (Bisa Pilih Cabang)
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500">
                        (Otomatis Sesuai Cabang Anda)
                      </span>
                    )}
                  </label>

                  {isSuperAdmin ? (
                    <select
                      value={formData.cabang}
                      onChange={(e) => setFormData({ ...formData, cabang: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">-- Pilih Cabang (tb_cabang) --</option>
                      {!branchesList.includes(formData.cabang) && formData.cabang && (
                        <option value={formData.cabang}>{formData.cabang}</option>
                      )}
                      {branchesList.map((bName) => (
                        <option key={bName} value={bName}>
                          {bName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.cabang || creatorBranch || 'Cabang Belum Ditentukan'}
                      disabled
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-600 text-sm font-semibold cursor-not-allowed"
                    />
                  )}
                  <p className="text-[11px] text-slate-400">
                    {isSuperAdmin
                      ? 'Daftar nama cabang diambil otomatis dari tabel tb_cabang kolom nama_cabang.'
                      : `Cabang otomatis dikunci sesuai cabang akun Anda: ${creatorBranch || '-'}`}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Admin Pajak</label>
                  <select
                    value={formData.jenis_pajak}
                    onChange={(e) => setFormData({ ...formData, jenis_pajak: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="1">RWA</option>
                    <option value="2">Pribadi</option>
                    <option value="3">KRA</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alamat</label>
                  <textarea
                    rows={2}
                    value={formData.alamat}
                    onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                    placeholder="Alamat lengkap..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                        <span>Simpan User</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {isDeleteModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Hapus User Login</h3>
              </div>

              <p className="text-sm text-slate-600">
                Apakah Anda yakin ingin menghapus user{' '}
                <strong className="text-slate-900">{selectedUser.nama_lengkap}</strong> (
                <span className="font-mono text-emerald-700">{selectedUser.user_id}</span>)?
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
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Ya, Hapus User</span>
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
