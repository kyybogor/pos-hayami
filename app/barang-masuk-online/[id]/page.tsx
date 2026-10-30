'use client';

import React, { useState, useEffect, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, ArrowDownRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface InvoiceDetail {
  header: {
    id_do1: string;
    no_inv: string;
    id_cust: string;
    tgl: string;
    tgltop: string;
    qty: number;
    ttlhrg: number;
    disc: number;
    tax: number;
    ppn: number;
    grandttl: number;
  };
  customerInfo?: {
    name: string;
    address: string;
    city: string;
    salesman: string;
  };
  items: {
    sku: string;
    tipe: string;
    size: string;
    gambar: string;
    qty: number;
    harga: number;
    subtotal: number;
  }[];
  totalQty: number;
  grandTotal: number;
  isStockedIn: boolean;
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: id_do1 } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();

  const id_cust = searchParams.get('id_cust') || '';
  const no_inv = searchParams.get('no_inv') || '';
  const tgltop = searchParams.get('tgltop') || '';
  const categoryMode = searchParams.get('category') === '1';

  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockingIn, setStockingIn] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    async function loadDetail() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          id_do1,
          id_cust,
          no_inv,
          tgltop,
          category: categoryMode ? 'true' : 'false',
        });

        const res = await fetch(`/api/barang-masuk-online/detail?${queryParams.toString()}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setDetail(data.data);
        } else {
          showToast('error', data.message || 'Gagal memuat detail invoice.');
        }
      } catch {
        showToast('error', 'Gagal terhubung ke database server.');
      } finally {
        setLoading(false);
      }
    }

    loadDetail();
  }, [id_do1, id_cust, no_inv, tgltop, categoryMode]);

  const handleStockIn = async () => {
    if (!detail || detail.isStockedIn) return;

    setStockingIn(true);
    try {
      const res = await fetch('/api/barang-masuk-online/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_do1: detail.header.id_do1,
          no_inv: detail.header.no_inv,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'Stock In berhasil!');
        setDetail({ ...detail, isStockedIn: true });
      } else {
        showToast('error', data.message || 'Gagal memproses Stock In.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan koneksi saat Stock In.');
    } finally {
      setStockingIn(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Memuat Nota Detail Online...</p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md text-center max-w-md space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Invoice Tidak Ditemukan</h2>
          <p className="text-sm text-slate-500">Data invoice tidak tersedia pada server online.</p>
          <button
            onClick={() => router.push('/barang-masuk-online')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    );
  }

  const { header, customerInfo, items } = detail;
  const isSalesmanA = customerInfo?.salesman === 'A';

  return (
    <div className="min-h-screen bg-slate-200 p-4 md:p-8 font-sans pb-24">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center space-x-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
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

      {/* Main Printable Invoice Card */}
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-300 space-y-8 print:shadow-none print:border-none print:p-0">
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-300 pb-6 gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900">Hayami Kreasi Indonesia</h1>
            <p className="text-xs text-slate-600">Ps. Regional Jatinegara, Lt. 1 AKS 144 - 145, Tel: 859 12912, Jakarta Timur</p>
            <p className="text-xs text-slate-600">Ps. Tanah Abang, Blok B, Lt. 1, Los F No. 53 - 55, Tel: 2357 3512, Jakarta Pusat</p>
          </div>

          <div className="sm:text-right space-y-1 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">
              Jakarta, {header.tgl ? new Date(header.tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
            </p>
            {customerInfo && (
              <>
                <p className="font-bold text-slate-900">Kepada Yth. {customerInfo.name}</p>
                <p className="text-slate-600">{customerInfo.address}</p>
                <p className="text-slate-600">{customerInfo.city}</p>
              </>
            )}
            <p className="text-sm font-bold text-emerald-700 pt-1 font-mono">
              Nota No. {header.no_inv}
            </p>
            {header.tgltop && header.tgltop !== '0000-00-00' && (
              <p className="text-slate-600 font-mono">TOP: {new Date(header.tgltop).toLocaleDateString('id-ID')}</p>
            )}
          </div>
        </div>

        {/* Invoice Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-y-2 border-slate-900 text-xs font-bold text-slate-900 uppercase">
                <th className="py-2.5 px-3 text-center">No.</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3">Nama Barang / SKU</th>
                <th className="py-2.5 px-3 text-right">Harga</th>
                <th className="py-2.5 px-3 text-right">Jumlah Harga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-3 px-3 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                  <td className="py-3 px-3 text-center font-bold text-slate-800 font-mono">{Number(item.qty) || 0} PCS</td>
                  <td className="py-3 px-3 font-medium text-slate-900 font-mono">{item.sku}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">{formatCurrency(item.harga)}</td>
                  <td className="py-3 px-3 text-right font-bold font-mono text-slate-900">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Invoice Footer / Totals & Bank Accounts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-300 pt-6">
          <div className="space-y-3 text-xs text-slate-600">
            <p className="font-bold text-slate-900">Total Quantiti: <span className="font-mono text-emerald-700 text-sm">{Number(detail.totalQty) || 0} PCS</span></p>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <p className="font-bold text-slate-800">Pembayaran dapat dilakukan melalui:</p>
              {isSalesmanA ? (
                <>
                  <p><b>Rek BCA</b>: <span className="font-mono font-bold text-slate-900">533-52285-85</span> A/N Hayami Jaya Bahagia</p>
                  <p><b>Rek BRI</b>: <span className="font-mono font-bold text-slate-900">035601-228585-304</span> A/N Hayami Jaya Bahagia</p>
                </>
              ) : (
                <>
                  <p><b>Rek BCA</b>: <span className="font-mono font-bold text-slate-900">533-577-2889</span> A/N Yorwendy Cungipta</p>
                  <p><b>Rek Mandiri</b>: <span className="font-mono font-bold text-slate-900">00600-2601-1993</span> A/N Yorwendy Cungipta</p>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 italic">NB: Barang yang sudah dibeli tidak dapat dikembalikan / ditukar. Terima Kasih.</p>
          </div>

          <div className="space-y-2 text-right text-xs">
            {header.disc > 0 && (
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-600">Diskon:</span>
                <span className="font-mono text-rose-600 font-bold">- {formatCurrency(header.disc)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-t-2 border-slate-900 pt-2">
              <span>Grand Total:</span>
              <span className="text-lg text-emerald-700 font-mono">{formatCurrency(detail.grandTotal - (header.disc || 0))}</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 text-center text-xs text-slate-600 pt-8 border-t border-slate-200">
          <div>
            <p className="mb-12">Tanda Terima</p>
            <p className="font-bold text-slate-900">{customerInfo?.name || '____________________'}</p>
          </div>
          <div>
            <p className="mb-12">Hormat Kami,</p>
            <p className="font-bold text-slate-900">Hayami Kreasi Indonesia</p>
          </div>
        </div>
      </div>

      {/* Floating Bottom Actions Bar (Non-printable) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-300 p-4 z-40 print:hidden shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/barang-masuk-online')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Report</span>
            </button>

            {categoryMode && (
              <button
                onClick={handleStockIn}
                disabled={detail.isStockedIn || stockingIn}
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  detail.isStockedIn
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                }`}
              >
                {stockingIn ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                <span>{detail.isStockedIn ? 'Sudah Stock In' : 'Stock In'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
