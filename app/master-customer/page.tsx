'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Tag,
} from 'lucide-react';

interface Customer {
  id_customer: string;
  nama_customer: string;
  kota: string;
  alamat_lengkap: string;
  no_telp: string;
  email: string;
  diskon_lusin: string;
  source_customer?: string;
  no_npwp?: string;
  nama_npwp?: string;
  alamat_npwp?: string;
  id_login?: string;
  pass_login?: string;
}

export default function MasterCustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState<Customer>({
    id_customer: '',
    nama_customer: '',
    kota: '',
    alamat_lengkap: '',
    no_telp: '',
    email: '',
    diskon_lusin: '0',
    source_customer: ' ',
    no_npwp: '',
    nama_npwp: '',
    alamat_npwp: '',
    id_login: '',
    pass_login: '',
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const url = search.trim()
        ? `/api/master-customer?search=${encodeURIComponent(search.trim())}`
        : '/api/master-customer';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.data || []);
      } else {
        showToast('error', data.message || 'Gagal memuat data customer.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat memuat data customer.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleOpenAddModal = async () => {
    setIsEditing(false);
    setSelectedCustomer(null);
    setFormData({
      id_customer: '',
      nama_customer: '',
      kota: '',
      alamat_lengkap: '',
      no_telp: '',
      email: '',
      diskon_lusin: '0',
      source_customer: ' ',
      no_npwp: '',
      nama_npwp: '',
      alamat_npwp: '',
      id_login: '',
      pass_login: '',
    });

    // Auto-generate next Customer ID
    try {
      const res = await fetch('/api/master-customer?generate_id=true');
      const data = await res.json();
      if (res.ok && data.success && data.nextId) {
        setFormData((prev) => ({ ...prev, id_customer: data.nextId }));
      }
    } catch (err) {
      console.error('Failed to generate customer ID:', err);
    }

    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setIsEditing(true);
    setSelectedCustomer(cust);
    setFormData({
      id_customer: cust.id_customer || '',
      nama_customer: cust.nama_customer || '',
      kota: cust.kota || '',
      alamat_lengkap: cust.alamat_lengkap || '',
      no_telp: cust.no_telp || '',
      email: cust.email || '',
      diskon_lusin: cust.diskon_lusin || '0',
      source_customer: cust.source_customer || ' ',
      no_npwp: cust.no_npwp || '',
      nama_npwp: cust.nama_npwp || '',
      alamat_npwp: cust.alamat_npwp || '',
      id_login: cust.id_login || '',
      pass_login: '',
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsDeleteModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama_customer.trim()) {
      showToast('error', 'Nama Customer wajib diisi!');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/master-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data customer berhasil disimpan.');
        setIsFormModalOpen(false);
        fetchCustomers();
      } else {
        showToast('error', data.message || 'Gagal menyimpan data customer.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/master-customer/${encodeURIComponent(selectedCustomer.id_customer)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Data customer berhasil dihapus.');
        setIsDeleteModalOpen(false);
        fetchCustomers();
      } else {
        showToast('error', data.message || 'Gagal menghapus data customer.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menghapus.');
    } finally {
      setDeleting(false);
    }
  };

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

        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Customer</h1>
              <p className="text-xs text-slate-500">Kelola daftar data pelanggan & diskon khusus</p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl shadow-sm transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Customer</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode, kota, telp..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <button
            onClick={fetchCustomers}
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-medium"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Kode</th>
                  <th className="py-3.5 px-4">Nama Customer</th>
                  <th className="py-3.5 px-4">Kota / Alamat</th>
                  <th className="py-3.5 px-4">No. Telp</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Diskon / Lusin</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs">Memuat data customer...</span>
                      </div>
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Tidak ada data customer</p>
                        <p className="text-xs text-slate-400">
                          {search ? 'Coba ubah kata kunci pencarian' : 'Klik tombol Tambah Customer untuk menambahkan data baru'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => (
                    <tr key={cust.id_customer} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-emerald-700 whitespace-nowrap">
                        {cust.id_customer}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {cust.nama_customer}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{cust.kota || '-'}</span>
                        </div>
                        {cust.alamat_lengkap && (
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {cust.alamat_lengkap}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {cust.no_telp ? (
                          <div className="flex items-center space-x-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cust.no_telp}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {cust.email ? (
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cust.email}</span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap font-medium">
                        <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
                          <Tag className="w-3 h-3 text-emerald-600" />
                          <span>{cust.diskon_lusin || '0'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(cust)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Ubah Data"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(cust)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Data"
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
        </div>

        {/* FORM MODAL (ADD / EDIT) */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">
                    {isEditing ? 'Ubah Data Customer' : 'Tambah Customer Baru'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCustomer} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">ID Customer</label>
                    <input
                      type="text"
                      value={formData.id_customer}
                      onChange={(e) => setFormData({ ...formData, id_customer: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 text-sm font-mono font-semibold"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Diskon / Lusin</label>
                    <input
                      type="text"
                      value={formData.diskon_lusin}
                      onChange={(e) => setFormData({ ...formData, diskon_lusin: e.target.value })}
                      placeholder="Contoh: 5000"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nama Customer *</label>
                  <input
                    type="text"
                    value={formData.nama_customer}
                    onChange={(e) => setFormData({ ...formData, nama_customer: e.target.value })}
                    placeholder="Masukkan Nama Customer"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Kota</label>
                    <input
                      type="text"
                      value={formData.kota}
                      onChange={(e) => setFormData({ ...formData, kota: e.target.value })}
                      placeholder="Kota"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">No. Telepon</label>
                    <input
                      type="text"
                      value={formData.no_telp}
                      onChange={(e) => setFormData({ ...formData, no_telp: e.target.value })}
                      placeholder="0812xxxxxxx"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alamat Lengkap</label>
                  <textarea
                    rows={2}
                    value={formData.alamat_lengkap}
                    onChange={(e) => setFormData({ ...formData, alamat_lengkap: e.target.value })}
                    placeholder="Masukkan Alamat Lengkap"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
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
                        <span>Simpan</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {isDeleteModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Hapus Customer</h3>
              </div>

              <p className="text-sm text-slate-600">
                Apakah Anda yakin ingin menghapus data customer{' '}
                <strong className="text-slate-900">{selectedCustomer.nama_customer}</strong> (
                <span className="font-mono text-emerald-700">{selectedCustomer.id_customer}</span>)?
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
                  onClick={handleDeleteCustomer}
                  disabled={deleting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Ya, Hapus</span>
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
