'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Tag,
  Edit2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Percent,
  Search,
  ChevronRight,
} from 'lucide-react';

interface CustType {
  id_cust_type: number;
  nm_type: string;
  percentage: number;
}

export default function MasterCustomerTypePage() {
  const [data, setData] = useState<CustType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CustType | null>(null);
  const [editNmType, setEditNmType] = useState('');
  const [editPercentage, setEditPercentage] = useState<number | string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cust-type');
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data || []);
      } else {
        showToast('error', json.message || 'Gagal memuat data type customer.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan sistem saat memuat data type customer.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenEdit = (item: CustType) => {
    setSelectedItem(item);
    setEditNmType(item.nm_type || '');
    setEditPercentage(item.percentage ?? 100);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (!editNmType.trim()) {
      setFormError('Nama type tidak boleh kosong.');
      return;
    }

    const pctNum = parseInt(String(editPercentage), 10);
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 100) {
      setFormError('Percentage harus berupa angka antara 0 dan 100.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/cust-type/${selectedItem.id_cust_type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nm_type: editNmType.trim(),
          percentage: pctNum,
        }),
      });

      const resJson = await res.json();

      if (res.ok && resJson.success) {
        setData((prev) =>
          prev.map((item) =>
            item.id_cust_type === selectedItem.id_cust_type
              ? { ...item, nm_type: editNmType.trim(), percentage: pctNum }
              : item
          )
        );
        showToast('success', `Type customer "${editNmType.trim()}" berhasil diperbarui!`);
        setIsEditModalOpen(false);
      } else {
        setFormError(resJson.message || 'Gagal menyimpan perubahan.');
      }
    } catch {
      setFormError('Terjadi kesalahan sistem saat memperbarui data.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered by search keyword
  const filteredData = data.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.nm_type.toLowerCase().includes(q) ||
      String(item.percentage).includes(q) ||
      String(item.id_cust_type).includes(q)
    );
  });

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center space-x-2 animate-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                : 'bg-rose-600 text-white shadow-rose-600/20'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Top Header Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl shadow-xs">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium mb-0.5">
                <span>Master</span>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-emerald-700 font-bold">Type Customer</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Master Type Customer</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola klasifikasi tipe customer & persentase perhitungan harga POS (tb_cust_type)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari type customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Total Type: <strong className="text-slate-800">{filteredData.length}</strong> tipe
          </div>
        </div>

        {/* Main Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-5 text-center w-20">ID</th>
                  <th className="py-3.5 px-5">Nama Type</th>
                  <th className="py-3.5 px-5 text-center w-48">Percentage (%)</th>
                  <th className="py-3.5 px-5 text-right w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto mb-2" />
                      <span className="font-semibold text-xs">Memuat data tipe customer...</span>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-14 text-center text-slate-400">
                      <Tag className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="font-semibold text-xs text-slate-600">Tidak ada data ditemukan</p>
                      {search && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Tidak ada tipe customer yang cocok dengan &quot;{search}&quot;
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr
                      key={item.id_cust_type}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-5 text-center font-bold text-slate-500">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-[11px]">
                          {item.id_cust_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900 text-sm">{item.nm_type}</div>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border ${
                            item.percentage === 100
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.percentage >= 70
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <Percent className="w-3 h-3" />
                          <span>{item.percentage}%</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="px-3.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
            <span>
              💡 <strong>Percentage</strong> menentukan pengali harga dasar produk untuk tipe customer tersebut saat bertransaksi di POS.
            </span>
            <span className="text-[11px] text-slate-400">
              Hanya kolom <strong>nm_type</strong> dan <strong>percentage</strong> yang dapat diubah.
            </span>
          </div>
        </div>

        {/* MODAL EDIT TYPE CUSTOMER */}
        {isEditModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Edit Type Customer</h3>
                    <p className="text-[11px] text-slate-500">ID Tipe: {selectedItem.id_cust_type}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={saving}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveEdit}>
                <div className="p-6 space-y-4">
                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* ID Field (Read-only) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      ID Cust Type
                    </label>
                    <input
                      type="text"
                      disabled
                      value={selectedItem.id_cust_type}
                      className="w-full px-3.5 py-2 text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed"
                    />
                  </div>

                  {/* Nama Type */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Nama Type <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={20}
                      value={editNmType}
                      onChange={(e) => setEditNmType(e.target.value)}
                      placeholder="Contoh: Distributor/Grosir"
                      className="w-full px-3.5 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                    <p className="text-[10px] text-slate-400">Maksimal 20 karakter.</p>
                  </div>

                  {/* Percentage */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Percentage (%) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min={0}
                        max={100}
                        value={editPercentage}
                        onChange={(e) => setEditPercentage(e.target.value)}
                        placeholder="Contoh: 100"
                        className="w-full pl-3.5 pr-8 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-slate-400">Nilai persentase antara 0 s/d 100.</p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={saving}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

