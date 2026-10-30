'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Printer, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SetorData {
  id: string;
  tgl_setor: string;
  grandtotal: number;
  hutang: number;
  id_cabang: string;
  total_masuk: number;
  total_keluar: number;
  saldo_sebelum: number;
  nominal_setor: number;
  saldo_akhir: number;
  keterangan: string;
  dibuat_oleh: string;
  dibuat_tgl: string;
  id_petty: string;
  cabang_alamat?: string;
  cabang_telp?: string;
  cabang_city?: string;
}

function PrintSetorGudangContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id') || '';

  const [data, setData] = useState<SetorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID Setor tidak ditemukan');
      setLoading(false);
      return;
    }

    async function fetchDetail() {
      try {
        const res = await fetch(`/api/setor-gudang?id=${encodeURIComponent(id)}`);
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          setTimeout(() => {
            window.print();
          }, 350);
        } else {
          setError(json.message || 'Gagal memuat data setoran');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan mengambil data');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

  const formatCurrency = (num: number) => {
    return `Rp ${Math.round(num || 0).toLocaleString('id-ID')}`;
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return '-';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 space-x-2">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
        <span className="text-sm font-semibold">Memuat Struk Setor Gudang...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 max-w-md">
          <p className="font-bold text-sm">Error</p>
          <p className="text-xs mt-1">{error || 'Data tidak ditemukan'}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Top Floating Action Bar (Hidden during print) */}
      <div className="max-w-[420px] mx-auto mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali</span>
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-sm"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Cetak Struk</span>
        </button>
      </div>

      {/* Thermal Receipt Paper Card (58mm - 80mm thermal receipt look) */}
      <div className="max-w-[400px] mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-md print:shadow-none print:border-none print:p-2 print:max-w-none print:w-full font-mono text-xs">
        {/* Header */}
        <div className="text-center pb-3 border-b border-dashed border-slate-300">
          <h1 className="text-base font-black tracking-wider uppercase text-slate-900">POS HAYAMI</h1>
          <p className="font-bold text-[11px] text-slate-700 mt-0.5">{data.id_cabang}</p>
          {data.cabang_alamat && (
            <p className="text-[10px] text-slate-500 whitespace-pre-line mt-0.5">{data.cabang_alamat}</p>
          )}
          {data.cabang_telp && (
            <p className="text-[10px] text-slate-500">Telp: {data.cabang_telp}</p>
          )}
          <div className="mt-2 pt-1 border-t border-dotted border-slate-300">
            <h2 className="font-extrabold text-xs uppercase tracking-wide text-slate-800">
              STRUK SETORAN KAS KE GUDANG
            </h2>
          </div>
        </div>

        {/* Metadata Section */}
        <div className="py-2.5 space-y-1 text-[11px] border-b border-dashed border-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-500">No. Bukti</span>
            <span className="font-bold text-slate-900">{data.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tanggal</span>
            <span className="font-medium text-slate-800">{formatDateOnly(data.tgl_setor)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Waktu Dibuat</span>
            <span className="font-medium text-slate-800">{formatDateTime(data.dibuat_tgl)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Kasir / Toko</span>
            <span className="font-medium text-slate-800">{data.dibuat_oleh}</span>
          </div>
          {data.id_petty && (
            <div className="flex justify-between">
              <span className="text-slate-500">Ref Petty</span>
              <span className="font-medium text-slate-700">{data.id_petty}</span>
            </div>
          )}
        </div>

        {/* Financial Details */}
        <div className="py-3 space-y-1.5 text-[11px] border-b border-dashed border-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-600">Total Kas Masuk (In)</span>
            <span className="text-emerald-700 font-semibold">+{formatCurrency(data.total_masuk)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Kas Keluar (Out)</span>
            <span className="text-rose-700 font-semibold">-{formatCurrency(data.total_keluar - (data.nominal_setor || 0))}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-dotted border-slate-200">
            <span className="text-slate-600">Saldo Sebelum Setor</span>
            <span className="font-bold text-slate-800">{formatCurrency(data.saldo_sebelum)}</span>
          </div>

          {/* Grandtotal yang disetor (Main Highlight) */}
          <div className="py-2 my-1 px-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-900 uppercase">TOTAL DISETOR</span>
              <span className="text-sm font-black text-emerald-700">{formatCurrency(data.grandtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
              <span>Hutang Gudang:</span>
              <span className="font-bold text-slate-700">{formatCurrency(data.hutang)}</span>
            </div>
          </div>

          <div className="flex justify-between pt-1 font-bold">
            <span className="text-slate-700">Sisa Saldo Kas Toko</span>
            <span className="text-slate-900">{formatCurrency(data.saldo_akhir)}</span>
          </div>
        </div>

        {/* Notes */}
        {data.keterangan && (
          <div className="py-2 text-[10px] text-slate-500 border-b border-dashed border-slate-300">
            <span className="font-semibold text-slate-600">Keterangan: </span>
            {data.keterangan}
          </div>
        )}

        {/* Signatures */}
        <div className="pt-4 pb-2 grid grid-cols-2 text-center text-[10px]">
          <div>
            <p className="text-slate-500">Yang Menyerahkan,</p>
            <div className="h-12 flex items-end justify-center">
              <span className="border-b border-slate-800 px-4 font-bold text-slate-800">
                ( {data.dibuat_oleh} )
              </span>
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">Kasir Toko</p>
          </div>
          <div>
            <p className="text-slate-500">Yang Menerima,</p>
            <div className="h-12 flex items-end justify-center">
              <span className="border-b border-slate-800 px-4 font-bold text-slate-800">
                (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
              </span>
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">Pihak Gudang</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-3 text-center border-t border-dotted border-slate-300 text-[9px] text-slate-400">
          <p>Terima kasih atas kerja samanya.</p>
          <p className="mt-0.5">Dokumen ini merupakan bukti sah setoran kas ke gudang.</p>
        </div>
      </div>
    </div>
  );
}

export default function PrintSetorGudangPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="text-sm font-semibold">Memuat halaman cetak...</span>
        </div>
      }
    >
      <PrintSetorGudangContent />
    </Suspense>
  );
}
