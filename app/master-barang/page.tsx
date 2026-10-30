'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Package,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Image as ImageIcon,
  Camera,
  Upload,
  Trash2,
  Save,
  Layers,
} from 'lucide-react';

interface BarangStock {
  id_bahan: string;
  ukuran: string;
  image?: string | null;
  uom: string;
  total_variants?: number;
  total_stock?: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MasterBarangPage() {
  const [items, setItems] = useState<BarangStock[]>([]);
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

  // Expanded sizes toggle for rows with many sizes
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Modal Ubah Gambar States
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BarangStock | null>(null);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchBarang = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/master-barang?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setItems(data.data || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        showToast('error', data.message || 'Gagal memuat data barang.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat memuat data barang.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBarang();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchBarang]);

  // Open modal ubah gambar
  const handleOpenChangeImage = (item: BarangStock) => {
    setSelectedItem(item);
    setPreviewImage(item.image || '');
    setIsImageModalOpen(true);
  };

  // Upload file gambar baru
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.url) {
        setPreviewImage(data.url);
        showToast('success', 'Gambar baru berhasil diunggah.');
      } else {
        showToast('error', data.message || 'Gagal mengupload gambar.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan saat mengupload file.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Simpan perubahan gambar ke database
  const handleSaveImage = async () => {
    if (!selectedItem) return;

    setSavingImage(true);
    try {
      const res = await fetch('/api/master-barang', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_bahan: selectedItem.id_bahan,
          image: previewImage,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Gambar produk berhasil diperbarui.');
        setIsImageModalOpen(false);
        // Perbarui item di local state langsung
        setItems((prev) =>
          prev.map((it) =>
            it.id_bahan === selectedItem.id_bahan ? { ...it, image: previewImage } : it
          )
        );
      } else {
        showToast('error', data.message || 'Gagal menyimpan gambar.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat menyimpan gambar.');
    } finally {
      setSavingImage(false);
    }
  };

  // Helper render URL gambar yang aman
  const getImageSrc = (img?: string | null) => {
    if (!img || img.trim() === '') return '';
    const trimmed = img.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return trimmed;
    }
    return `/${trimmed}`;
  };

  // Parse list of unique sizes for an item
  const getParsedSizes = (ukuranStr?: string) => {
    if (!ukuranStr) return [];
    const raw = ukuranStr
      .split(',')
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean);
    return Array.from(new Set(raw));
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

        {/* Page Title Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Master Barang</h1>
              <p className="text-xs text-slate-500">
                Katalog produk dari data stok, daftar varian ukuran (size), dan kelola gambar produk
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>
              Total Produk: <strong className="text-slate-800">{pagination.total.toLocaleString()}</strong> jenis barang
            </span>
          </div>
        </div>

        {/* Search, Filter & Limit Controls */}
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
                placeholder="Cari nama barang, model, ukuran..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
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
              onClick={fetchBarang}
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
                  <th className="py-3.5 px-4 text-center w-12">No</th>
                  <th className="py-3.5 px-4 text-center w-24">Gambar</th>
                  <th className="py-3.5 px-4">Nama Barang</th>
                  <th className="py-3.5 px-4">Daftar Ukuran (Size)</th>
                  <th className="py-3.5 px-4 text-center w-24">Satuan</th>
                  <th className="py-3.5 px-4 text-center w-36">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs font-medium">Memuat data barang dari stok...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-2">
                        <Boxes className="w-9 h-9 text-slate-300" />
                        <p className="text-sm font-medium text-slate-600">Tidak ada data barang ditemukan</p>
                        <p className="text-xs text-slate-400">
                          {search ? 'Coba ubah kata kunci pencarian Anda' : 'Data stok barang belum tersedia'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const rowNumber = startEntry + idx;
                    const parsedSizes = getParsedSizes(item.ukuran);
                    const isExpanded = !!expandedRows[item.id_bahan];
                    const displayedSizes = isExpanded ? parsedSizes : parsedSizes.slice(0, 7);
                    const hasMoreSizes = parsedSizes.length > 7;
                    const imgSrc = getImageSrc(item.image);

                    return (
                      <tr key={item.id_bahan} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Nomor Urut */}
                        <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 whitespace-nowrap">
                          {rowNumber}
                        </td>

                        {/* 2. Gambar */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenChangeImage(item)}
                            className="relative group w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center mx-auto hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer shadow-xs"
                            title="Klik untuk ubah gambar"
                          >
                            {imgSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imgSrc}
                                alt={item.id_bahan}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  // Fallback jika file gambar tidak ditemukan
                                  e.currentTarget.style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  if (parent) {
                                    const fallback = parent.querySelector('.img-fallback');
                                    if (fallback) fallback.classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}

                            <div
                              className={`img-fallback w-full h-full flex items-center justify-center text-slate-300 ${
                                imgSrc ? 'hidden' : ''
                              }`}
                            >
                              <ImageIcon className="w-5 h-5" />
                            </div>

                            {/* Hover Camera Overlay */}
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Camera className="w-4 h-4 drop-shadow-sm" />
                            </div>
                          </button>
                        </td>

                        {/* 3. Nama Barang (id_bahan) */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">{item.id_bahan}</div>
                          {item.total_variants && item.total_variants > 1 ? (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {item.total_variants} varian batch stok
                            </div>
                          ) : null}
                        </td>

                        {/* 4. Daftar Ukuran (Size) - Kumpul & Deduplikasi */}
                        <td className="py-3.5 px-4">
                          {parsedSizes.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">- Tidak ada ukuran -</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
                              {displayedSizes.map((sz) => (
                                <span
                                  key={sz}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                                >
                                  {sz}
                                </span>
                              ))}

                              {hasMoreSizes && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedRows((prev) => ({
                                      ...prev,
                                      [item.id_bahan]: !prev[item.id_bahan],
                                    }))
                                  }
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                  title="Lihat semua ukuran"
                                >
                                  {isExpanded
                                    ? 'Sembunyikan'
                                    : `+${parsedSizes.length - 7} lainnya`}
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Satuan (UOM) */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
                            {item.uom || 'PCS'}
                          </span>
                        </td>

                        {/* 6. Aksi: Hanya Ubah Gambar */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenChangeImage(item)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 rounded-xl border border-emerald-200/70 transition-all cursor-pointer shadow-2xs"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ubah Gambar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer Controls */}
          {pagination.total > 0 && (
            <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <div>
                Menampilkan <strong className="text-slate-900">{startEntry}</strong> &ndash;{' '}
                <strong className="text-slate-900">{endEntry}</strong> dari{' '}
                <strong className="text-slate-900">{pagination.total.toLocaleString()}</strong> total jenis barang
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
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
                  type="button"
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

        {/* MODAL UBAH GAMBAR BARANG */}
        {isImageModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150 my-8">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Ubah Gambar Produk</h3>
                    <p className="text-xs text-slate-500">Perbarui foto katalog barang</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Info Card Barang */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Nama Barang
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{selectedItem.id_bahan}</h4>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {selectedItem.uom || 'PCS'}
                    </span>
                  </div>

                  {selectedItem.ukuran && (
                    <div className="pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-500">
                        Varian Ukuran: <strong className="text-slate-700">{selectedItem.ukuran}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Preview Box */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Pratinjau Gambar
                  </label>

                  <div className="w-full h-56 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 flex flex-col items-center justify-center overflow-hidden relative group">
                    {previewImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getImageSrc(previewImage)}
                          alt="Preview"
                          className="w-full h-full object-contain p-2"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewImage('')}
                          className="absolute top-2.5 right-2.5 p-2 bg-rose-600 text-white rounded-xl shadow-md hover:bg-rose-700 transition-all cursor-pointer flex items-center space-x-1 text-xs font-bold"
                          title="Hapus gambar saat ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-medium text-slate-600">
                          Belum ada gambar untuk barang ini
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Klik tombol upload di bawah untuk memilih file foto
                        </p>
                      </div>
                    )}

                    {uploadingImage && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs flex flex-col items-center justify-center space-y-2 z-10">
                        <div className="w-7 h-7 border-3 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                        <span className="text-xs font-bold text-emerald-800">Mengupload gambar...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* File Upload Button & URL Input */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                      id="upload-modal-image-file"
                    />
                    <label
                      htmlFor="upload-modal-image-file"
                      className={`flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer ${
                        uploadingImage ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      <span>{uploadingImage ? 'Mengupload...' : 'Pilih File Gambar dari Komputer'}</span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-500">
                      Atau Masukkan URL Gambar:
                    </label>
                    <input
                      type="text"
                      value={previewImage}
                      onChange={(e) => setPreviewImage(e.target.value)}
                      placeholder="Contoh: /uploads/products/item.jpg atau https://..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  disabled={savingImage || uploadingImage}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveImage}
                  disabled={savingImage || uploadingImage}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {savingImage ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Perubahan</span>
                    </>
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
