'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft, RefreshCw, FileText, Receipt, CheckCircle, Clock } from 'lucide-react';

interface HeaderData {
  id_transaksi: string;
  invret?: string;
  id_invoice?: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  alamat_lengkap?: string;
  kota?: string;
  no_telp?: string;
  keterangan: string;
  sales: string;
  akun: string;
  status_keluar: 'd' | 's' | string;
  dibuat_oleh: string;
  dibuat_tgl?: string;
  id_cabang?: string;
  cabang_nama?: string;
  cabang_alamat?: string;
  cabang_city?: string;
  cabang_telp?: string;
  cabang_npwp?: string;
}

interface ItemData {
  no_id: string;
  invret?: string;
  id_bahan: string;
  nama_bahan?: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  subtotal: number;
}

// Indonesian Terbilang helper
function angkaTerbilang(n: number): string {
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const num = Math.floor(Math.abs(n));
  if (num === 0) return 'Nol';

  function convert(val: number): string {
    if (val === 0) return '';
    if (val < 12) return bilangan[val];
    if (val < 20) return `${bilangan[val - 10]} Belas`.trim();
    if (val < 100) return `${bilangan[Math.floor(val / 10)]} Puluh ${convert(val % 10)}`.trim();
    if (val < 200) return `Seratus ${convert(val - 100)}`.trim();
    if (val < 1000) return `${bilangan[Math.floor(val / 100)]} Ratus ${convert(val % 100)}`.trim();
    if (val < 2000) return `Seribu ${convert(val - 1000)}`.trim();
    if (val < 1000000) return `${convert(Math.floor(val / 1000))} Ribu ${convert(val % 1000)}`.trim();
    if (val < 1000000000) return `${convert(Math.floor(val / 1000000))} Juta ${convert(val % 1000000)}`.trim();
    if (val < 1000000000000) return `${convert(Math.floor(val / 1000000000))} Miliar ${convert(val % 1000000000)}`.trim();
    return `${convert(Math.floor(val / 1000000000000))} Triliun ${convert(val % 1000000000000)}`.trim();
  }

  return convert(num);
}

function PrintReturContent() {
  const searchParams = useSearchParams();
  const id_transaksi = searchParams.get('id_transaksi') || searchParams.get('id') || '';

  const [data, setData] = useState<{ header: HeaderData; items: ItemData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'standard' | 'thermal'>('standard');

  useEffect(() => {
    if (!id_transaksi) {
      setError('Nomor Transaksi Retur tidak ditemukan.');
      setLoading(false);
      return;
    }

    async function fetchDetail() {
      try {
        const res = await fetch(`/api/retur-barang/${encodeURIComponent(id_transaksi)}`);
        const json = await res.json();
        if (json.success && json.data) {
          const headerData = {
            id_transaksi: json.data.id_transaksi,
            invret: json.data.invret,
            id_invoice: json.data.id_invoice,
            tgl_transaksi: json.data.tgl_transaksi,
            id_customer: json.data.id_customer,
            nama_customer: json.data.nama_customer,
            alamat_lengkap: json.data.alamat_lengkap,
            kota: json.data.kota,
            no_telp: json.data.no_telp,
            keterangan: json.data.keterangan,
            sales: json.data.sales,
            akun: json.data.akun,
            status_keluar: json.data.status_keluar,
            dibuat_oleh: json.data.dibuat_oleh,
            dibuat_tgl: json.data.dibuat_tgl,
            id_cabang: json.data.id_cabang,
            cabang_nama: json.data.cabang_nama,
            cabang_alamat: json.data.cabang_alamat,
            cabang_city: json.data.cabang_city,
            cabang_telp: json.data.cabang_telp,
            cabang_npwp: json.data.cabang_npwp,
          };
          setData({ header: headerData, items: json.data.items || [] });
          // Auto trigger print
          setTimeout(() => {
            window.print();
          }, 350);
        } else {
          setError(json.message || 'Data retur tidak ditemukan.');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan saat mengambil data retur.');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id_transaksi]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 space-x-2">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
        <span className="text-sm font-semibold">Memuat Nota Retur Barang...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-6 rounded-2xl shadow-xl border border-rose-200 max-w-md w-full space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-slate-800 text-base">Gagal Memuat Retur</h2>
          <p className="text-xs text-rose-600">{error || 'Data retur barang tidak ditemukan.'}</p>
          <button
            onClick={() => window.close()}
            className="mt-3 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tutup Jendela</span>
          </button>
        </div>
      </div>
    );
  }

  const { header, items } = data;
  const isAuthorized = header.status_keluar === 's';
  const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const totalLusin = totalQty / 12;
  const grandTotal = items.reduce((acc, it) => acc + (Number(it.subtotal) || (Number(it.qty) * Number(it.harga))), 0);
  const terbilangStr = grandTotal > 0 ? `${angkaTerbilang(grandTotal)} Rupiah` : 'Nol Rupiah';

  const formatDateStr = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string) => {
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

  return (
    <div className="bg-slate-100 min-h-screen font-sans text-xs text-slate-900 selection:bg-slate-200 print:bg-white print:min-h-0 print:text-black">
      <style jsx global>{`
        @page {
          size: auto;
          margin: 8mm 10mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          .print-sheet {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Non-Print Control Header Bar */}
      <div className="print:hidden sticky top-0 z-50 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.close()}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tutup</span>
          </button>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-200">
              Nota Retur: <span className="text-emerald-400 font-mono">{header.id_transaksi}</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isAuthorized
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {isAuthorized ? 'Close' : 'Draft'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Mode Switcher */}
          <div className="bg-slate-800 p-0.5 rounded-lg flex items-center text-xs">
            <button
              onClick={() => setViewMode('standard')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                viewMode === 'standard'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Format A4 / Nota</span>
            </button>
            <button
              onClick={() => setViewMode('thermal')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center space-x-1 transition-all cursor-pointer ${
                viewMode === 'thermal'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Struk Thermal (80mm)</span>
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Sekarang</span>
          </button>
        </div>
      </div>

      {/* RENDER VIEW: STANDARD A4 NOTA DOKUMEN */}
      {viewMode === 'standard' && (
        <div className="py-8 flex justify-center print:p-0 print:m-0">
          <div className="print-sheet bg-white p-8 rounded-xl shadow-lg border border-slate-300 w-[840px] print:w-full print:shadow-none print:border-none print:p-0 print:m-0 space-y-5">
            {/* Top Company Header & Title */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-slate-800">
              {/* Left: Company Branding */}
              <div className="space-y-1">
                <div className="flex items-center space-x-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/hayami.png"
                    alt="Hayami Logo"
                    className="h-11 object-contain"
                  />
                  <div>
                    <h1 className="font-extrabold text-base uppercase tracking-wider text-slate-900 leading-tight">
                      HAYAMI INDONESIA
                    </h1>
                    <p className="text-[11px] font-semibold text-emerald-800">
                      {header.cabang_nama || 'Toko Hayami Jatinegara'}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                  <p className="whitespace-pre-line leading-relaxed">
                    {header.cabang_alamat || 'Pasar Mester Jatinegara Lt.1 Blok AKS No:144-145.'}
                  </p>
                  <p>{header.cabang_city || 'Jakarta Timur, DKI Jakarta, 13310'}</p>
                  {header.cabang_telp && <p>Telp: {header.cabang_telp}</p>}
                </div>
              </div>

              {/* Right: Document Title & Metadata */}
              <div className="text-right flex flex-col justify-between items-end">
                <div>
                  <h2 className="text-lg font-black tracking-wide uppercase text-slate-900">
                    NOTA RETUR BARANG
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium tracking-tight">
                    Pengembalian Barang Per Transaksi Faktur Penjualan
                  </p>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-right space-y-1 w-64">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600">No. Retur:</span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm">
                      {header.id_transaksi}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Tanggal:</span>
                    <span className="font-bold text-slate-800">
                      {formatDateStr(header.tgl_transaksi)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Status Retur:</span>
                    <span
                      className={`font-bold uppercase ${
                        isAuthorized ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {isAuthorized ? 'CLOSE (OTORISASI)' : 'DRAFT'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer & Transaction Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Data Customer / Pembeli
                </p>
                <div className="text-xs">
                  <span className="font-extrabold text-slate-900 text-sm block">
                    {header.nama_customer || header.id_customer}
                  </span>
                  {header.alamat_lengkap && (
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      {header.alamat_lengkap} {header.kota ? `, ${header.kota}` : ''}
                    </p>
                  )}
                  {header.no_telp && (
                    <p className="text-slate-600 text-[11px]">Telp: {header.no_telp}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-xs pl-4 border-l border-slate-200">
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Informasi Retur & Faktur
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">Ref No. Faktur:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {header.invret || header.id_invoice || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">Metode / Akun:</span>
                    <span className="font-bold text-slate-800">{header.akun || 'CASH'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-medium">Sales / Kasir:</span>
                    <span className="font-bold text-slate-800">
                      {header.sales || '-'} ({header.dibuat_oleh || 'admin'})
                    </span>
                  </div>
                  {header.keterangan && (
                    <div className="flex justify-between">
                      <span className="text-slate-600 font-medium">Keterangan:</span>
                      <span className="italic text-slate-800 max-w-[200px] text-right truncate">
                        {header.keterangan}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Retur Items Table */}
            <div>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-200 text-slate-800 font-bold border-b border-slate-300 uppercase text-[10.5px]">
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center w-10">No</th>
                    <th className="py-2 px-3 border-r border-slate-300 text-left w-36">
                      Ref Invoice
                    </th>
                    <th className="py-2 px-3 border-r border-slate-300 text-left">
                      Nama & Model Barang
                    </th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center w-16">
                      Ukuran
                    </th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center w-14">
                      Satuan
                    </th>
                    <th className="py-2 px-3 border-r border-slate-300 text-right w-28">
                      Harga Satuan
                    </th>
                    <th className="py-2 px-2.5 border-r border-slate-300 text-center w-16">
                      Qty
                    </th>
                    <th className="py-2 px-3 text-right w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 border-b border-slate-300 text-slate-800">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 font-mono text-[11px] text-slate-600">
                        {item.invret || header.invret || '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 font-medium">
                        <span className="font-bold text-slate-900 block">{item.id_bahan}</span>
                        <span className="text-slate-600 text-[11px]">{item.model}</span>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center font-semibold text-slate-700">
                        {item.ukuran || '-'}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center font-medium text-slate-600">
                        {item.uom || 'PCS'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right font-medium text-slate-800">
                        Rp {Number(item.harga).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-center font-extrabold text-slate-900">
                        {item.qty}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        Rp {Number(item.subtotal).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                    <td
                      colSpan={6}
                      className="py-2 px-3 text-right border-r border-slate-300 uppercase text-[11px]"
                    >
                      Total Qty Retur:
                    </td>
                    <td className="py-2 px-2.5 text-center font-extrabold text-sm border-r border-slate-300 text-slate-900">
                      {totalQty}
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-sm text-emerald-800">
                      Rp {grandTotal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                  {totalLusin > 0 && (
                    <tr className="bg-white text-slate-700 text-[11px]">
                      <td
                        colSpan={6}
                        className="py-1 px-3 text-right border-r border-slate-300 font-medium"
                      >
                        Konversi Lusin:
                      </td>
                      <td
                        colSpan={2}
                        className="py-1 px-3 text-left font-semibold text-slate-800"
                      >
                        {totalLusin.toFixed(2)} Lusin
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>

            {/* Terbilang Section */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-start space-x-2">
              <span className="font-bold text-emerald-900 text-xs shrink-0">Terbilang:</span>
              <span className="italic text-emerald-950 font-semibold text-xs leading-relaxed">
                # {terbilangStr} #
              </span>
            </div>

            {/* Signatures Section: Hanya Customer dan Kasir */}
            <div className="pt-8">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="font-bold text-slate-800">
                    <td className="w-1/2 pb-16">Customer,</td>
                    <td className="w-1/2 pb-16">Kasir,</td>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-semibold text-slate-900">
                    <td>
                      <span className="border-b border-dotted border-slate-600 px-6 inline-block min-w-[200px]">
                        ( {header.nama_customer || header.id_customer} )
                      </span>
                    </td>
                    <td>
                      <span className="border-b border-dotted border-slate-600 px-6 inline-block min-w-[200px]">
                        ( {header.sales || header.dibuat_oleh || 'Kasir'} )
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Notes */}
            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] text-slate-500">
              <span>Dicetak pada: {new Date().toLocaleString('id-ID')} | Operator: {header.dibuat_oleh || 'admin'}</span>
              <span>Dokumen Bukti Retur Resmi - PT Hayami Indonesia</span>
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW: THERMAL 80MM RECEIPT */}
      {viewMode === 'thermal' && (
        <div className="py-6 flex justify-center print:p-0 print:m-0">
          <div className="bg-white p-5 rounded-xl shadow-lg border border-slate-200 w-[350px] print:w-full print:shadow-none print:border-none print:p-0 print:m-0">
            {/* Logo & Header */}
            <div className="text-center space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hayami.png"
                alt="Hayami Logo"
                className="h-10 mx-auto object-contain mb-1"
              />
              <h1 className="font-extrabold text-sm uppercase tracking-wide text-slate-900">
                HAYAMI INDONESIA
              </h1>
              <p className="text-[11px] leading-tight text-slate-700 font-medium">
                {header.cabang_nama || 'Toko Hayami Jatinegara'}
                <br />
                {header.cabang_city || 'Jakarta, Indonesia'}
              </p>
              <div className="pt-1">
                <span className="inline-block px-2 py-0.5 bg-slate-900 text-white font-extrabold text-[10px] rounded tracking-wider uppercase">
                  NOTA RETUR BARANG
                </span>
              </div>
            </div>

            <div className="my-2 border-b border-dashed border-slate-400" />

            {/* Metadata */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Tanggal:</span>
                <span>{formatShortDate(header.tgl_transaksi)}</span>
              </div>
              <div className="flex justify-between">
                <span>No Retur:</span>
                <span className="font-bold font-mono">{header.id_transaksi}</span>
              </div>
              {header.invret && (
                <div className="flex justify-between">
                  <span>Ref Faktur:</span>
                  <span className="font-mono">{header.invret}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{header.nama_customer || header.id_customer}</span>
              </div>
              <div className="flex justify-between">
                <span>Metode:</span>
                <span className="font-semibold">{header.akun || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span>Operator:</span>
                <span>{header.dibuat_oleh || 'admin'}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold uppercase text-emerald-700">
                  {isAuthorized ? 'Close' : 'Draft'}
                </span>
              </div>
            </div>

            <div className="my-2 border-b border-dashed border-slate-400" />

            {/* Items */}
            <div className="space-y-2 text-[11px]">
              {items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-bold text-slate-900">
                    {idx + 1}. {item.id_bahan}
                  </div>
                  <div className="text-[10px] text-slate-600 pl-3">
                    {item.model} ({item.ukuran})
                  </div>
                  <div className="flex justify-between text-slate-700 pl-3">
                    <span>
                      {item.qty} {item.uom} x Rp {Number(item.harga).toLocaleString('id-ID')}
                    </span>
                    <span className="font-semibold">
                      Rp {Number(item.subtotal).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="my-2 border-b border-dashed border-slate-400" />

            {/* Summary */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Total Item Retur:</span>
                <span className="font-bold">{totalQty} PCS</span>
              </div>
              {totalLusin > 0 && (
                <div className="flex justify-between">
                  <span>Total Lusin:</span>
                  <span>{totalLusin.toFixed(2)} Ls</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-1 border-t border-slate-300">
                <span>Total Retur:</span>
                <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="my-3 border-b border-dashed border-slate-400" />

            {/* Thermal Signatures & Note */}
            <div className="text-center text-[10.5px] space-y-3">
              <p className="italic text-slate-600">
                Terima kasih. Barang retur telah dicatat dan diverifikasi sesuai data di atas.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
                <div>
                  <p className="font-bold">Customer,</p>
                  <p className="mt-8">( .................... )</p>
                </div>
                <div>
                  <p className="font-bold">Kasir,</p>
                  <p className="mt-8">
                    ( {header.sales || header.dibuat_oleh || 'Kasir'} )
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrintReturPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
          <span className="text-xs font-semibold">Memuat Nota Retur...</span>
        </div>
      }
    >
      <PrintReturContent />
    </Suspense>
  );
}

