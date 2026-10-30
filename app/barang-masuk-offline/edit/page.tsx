'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Layers,
  Clock,
  Check,
  Package,
  Image as ImageIcon,
} from 'lucide-react';

interface SupplierOption {
  id: string;
  name: string;
  display: string;
}

interface LineItem {
  no_id?: string;
  id_product: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  subtotal: number;
  image?: string;
}

function BarangMasukEditForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const id_transaksi_param = searchParams.get('id_transaksi') || '';
  const isViewOnly = searchParams.get('detail') === 'view';

  // Header State
  const [id_transaksi, setIdTransaksi] = useState(id_transaksi_param);
  const [tglTransaksi, setTglTransaksi] = useState('');
  const [idSupplier, setIdSupplier] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [jenis, setJenis] = useState('0');
  const [status, setStatus] = useState('d'); // 'd' = Draft, 's' = Close

  // Items State
  const [items, setItems] = useState<LineItem[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    async function loadData() {
      if (!id_transaksi_param) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/barang-masuk-offline/detail?id_transaksi=${encodeURIComponent(id_transaksi_param)}`
        );
        const data = await res.json();

        if (res.ok && data.success) {
          const { header, items: loadedItems, options } = data.data;

          setIdTransaksi(header.id_transaksi);
          if (header.tgl_transaksi) setTglTransaksi(header.tgl_transaksi);
          if (header.id_supplier) setIdSupplier(header.id_supplier);
          setSupplierName(header.nama_supplier || header.id_supplier || '');
          setKeterangan(header.keterangan || '');
          setJenis(header.jenis || '0');
          setStatus(header.status || 'd');

          setItems(loadedItems || []);

          if (options) {
            setSupplierOptions(options.suppliers || []);
          }
        } else {
          showToast('error', data.message || 'Gagal memuat detail transaksi.');
        }
      } catch {
        showToast('error', 'Gagal terhubung ke database.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id_transaksi_param]);

  const calculateGrandTotal = () => {
    return items.reduce((acc, it) => acc + (Number(it.subtotal) || (it.qty * it.harga)), 0);
  };

  const handleRemoveItem = async (index: number, noId?: string) => {
    if (noId) {
      try {
        await fetch(`/api/barang-masuk-offline/item?no_id=${encodeURIComponent(noId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('Failed to delete item from DB:', err);
      }
    }
    setItems(items.filter((_, idx) => idx !== index));
    showToast('success', 'Item barang berhasil dihapus.');
  };

  const handleAuthorize = async () => {
    if (status === 's') {
      showToast('error', 'Transaksi ini sudah di-otorisasi.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/barang-masuk-offline/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_transaksi,
          tgl_transaksi: tglTransaksi,
          id_supplier: idSupplier,
          keterangan,
          jenis,
          authorize: true,
          items,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast('success', data.message || 'Simpan & Otorisasi berhasil!');
        setStatus('s');
        setTimeout(() => {
          router.push('/barang-masuk-offline');
        }, 1200);
      } else {
        showToast('error', data.message || 'Gagal menyimpan dan meng-otorisasi.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat memproses otorisasi.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = items.map((it) => String(it.no_id)).filter(Boolean);
      setSelectedSkus(allIds);
    } else {
      setSelectedSkus([]);
    }
  };

  const handleToggleSelectSku = (noId: string) => {
    if (selectedSkus.includes(noId)) {
      setSelectedSkus(selectedSkus.filter((id) => id !== noId));
    } else {
      setSelectedSkus([...selectedSkus, noId]);
    }
  };

  const handlePrintBarcode = () => {
    if (selectedSkus.length === 0) {
      showToast('error', 'Pilih minimal 1 barang untuk cetak barcode.');
      return;
    }
    const url = `/barang-masuk-offline/print-barcode?id_po=${encodeURIComponent(id_transaksi)}&sku_id=${encodeURIComponent(selectedSkus.join(','))}`;
    window.open(url, '_blank');
  };

  const handlePrintAllBarcode = () => {
    const url = `/barang-masuk-offline/print-barcode?id_transaksi=${encodeURIComponent(id_transaksi)}&all=1`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-600">Memuat Detail Barang Masuk...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isClosed = status === 's' || isViewOnly;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-24">
        {/* Toast Notification */}
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

        {/* Page Top Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => router.push('/barang-masuk-offline')}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Kembali ke Daftar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Master Barang Masuk</h1>
                {isClosed ? (
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Close</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold inline-flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Draft</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                No. Transaksi: <span className="font-bold text-slate-800">{id_transaksi}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Header Form Card (Structured 2-Column Layout matching master_barang_masuk_edit.php) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left Column: Tanggal Transaksi & Supplier */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="w-36 font-semibold text-slate-700 shrink-0">Tanggal Transaksi</label>
                <input
                  type="date"
                  disabled={isClosed}
                  value={tglTransaksi}
                  onChange={(e) => setTglTransaksi(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:bg-slate-100 font-mono"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="w-36 font-semibold text-slate-700 shrink-0">Supplier</label>
                {isClosed ? (
                  <input
                    type="text"
                    disabled
                    value={supplierName ? `${idSupplier} | ${supplierName}` : idSupplier}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-slate-900 font-medium"
                  />
                ) : (
                  <select
                    value={idSupplier}
                    onChange={(e) => {
                      setIdSupplier(e.target.value);
                      const sObj = supplierOptions.find((s) => s.id === e.target.value);
                      if (sObj) setSupplierName(sObj.name);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Pilih Supplier --</option>
                    {supplierOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.display}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Right Column: Keterangan & Jenis */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <label className="w-36 font-semibold text-slate-700 shrink-0 pt-2">Keterangan</label>
                <textarea
                  disabled={isClosed}
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:bg-slate-100"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="w-36 font-semibold text-slate-700 shrink-0">Jenis</label>
                <select
                  disabled={isClosed}
                  value={jenis}
                  onChange={(e) => setJenis(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:bg-slate-100"
                >
                  <option value="0">CV</option>
                  <option value="1">Bintang</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Detail Barang ({items.length} Item)
            </h2>
            {isClosed && items.length > 0 && (
              <button
                type="button"
                onClick={handlePrintBarcode}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
              >
                <span>Print Barcode (Pilihan)</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase">
                  <th className="py-3 px-4 text-center w-12">No.</th>
                  <th className="py-3 px-4">Nama Barang</th>
                  <th className="py-3 px-4 text-center">Ukuran</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-center">UOM</th>
                  <th className="py-3 px-4 text-right">Harga</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  {isClosed ? (
                    <th className="py-3 px-4 text-center w-16">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedSkus.length === items.length}
                        onChange={handleToggleSelectAll}
                        title="Pilih Semua Barcode"
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </th>
                  ) : (
                    <th className="py-3 px-4 text-center w-16">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center space-y-1">
                        <Layers className="w-6 h-6 text-slate-300" />
                        <span>Belum ada barang pada transaksi ini.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const noIdStr = String(it.no_id || '');
                    const isChecked = selectedSkus.includes(noIdStr);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                          <div className="flex items-center space-x-2.5">
                            {it.image ? (
                              <img
                                src={it.image}
                                alt={it.model || it.id_product}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <span>{it.id_product}</span>
                              {it.model && <span className="text-slate-600 block text-[11px] font-normal">{it.model}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-700">{it.ukuran || '-'}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700 font-mono text-sm">
                          {it.qty}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">{it.uom}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">{formatCurrency(it.harga)}</td>
                        <td className="py-3 px-4 text-right font-bold font-mono text-slate-900">
                          {formatCurrency(Number(it.subtotal) || (it.qty * it.harga))}
                        </td>
                        {isClosed ? (
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectSku(noIdStr)}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                        ) : (
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx, it.no_id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {items.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-900 font-bold text-slate-900 text-sm">
                    <td colSpan={6} className="py-3.5 px-4 text-right">
                      Grand Total:
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 text-base">
                      {formatCurrency(calculateGrandTotal())}
                    </td>
                    {isClosed ? (
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={handlePrintBarcode}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-xs transition-colors"
                        >
                          Print Barcode
                        </button>
                      </td>
                    ) : (
                      <td />
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-300 p-4 z-40 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push('/barang-masuk-offline')}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            {isClosed ? (
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handlePrintAllBarcode}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <span>Print All Barcode</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                {/* Simpan & Otorisasi */}
                <button
                  type="button"
                  onClick={handleAuthorize}
                  disabled={submitting}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Simpan & Otorisasi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function BarangMasukEditPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="min-h-[400px] flex items-center justify-center p-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-xs font-semibold text-slate-600">Memuat Detail Barang Masuk...</p>
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <BarangMasukEditForm />
    </Suspense>
  );
}
