'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react';

interface HeaderData {
  id_transaksi: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  alamat_lengkap: string;
  kota: string;
  keterangan: string;
  sales: string;
  dibuat_oleh: string;
}

interface ItemData {
  no_id: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
}

function PrintSJContent() {
  const searchParams = useSearchParams();
  const id_transaksi = searchParams.get('id_transaksi') || '';

  const [data, setData] = useState<{ header: HeaderData; items: ItemData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id_transaksi) {
      setError('ID Transaksi tidak ditemukan');
      setLoading(false);
      return;
    }

    async function fetchDetail() {
      try {
        const res = await fetch(`/api/barang-keluar/${encodeURIComponent(id_transaksi)}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          // Auto trigger window print once loaded
          setTimeout(() => {
            window.print();
          }, 300);
        } else {
          setError(json.message || 'Gagal memuat transaksi');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching transaction');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id_transaksi]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 space-x-2">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-sm font-semibold">Memuat Surat Jalan...</span>
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
      </div>
    );
  }

  const { header, items } = data;
  const noSj = header.id_transaksi.replace(/^SO/i, 'SJ');

  const totalQtyPcs = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const mainUom = items[0]?.uom || 'PCS';

  const formatDateStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans text-xs text-slate-900 selection:bg-slate-200 print:bg-white print:min-h-0 print:text-black">
      {/* Top Non-Print Control Header Bar */}
      <div className="print:hidden sticky top-0 z-50 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.close()}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center space-x-1 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tutup</span>
          </button>
          <span className="text-slate-500">|</span>
          <span className="text-xs font-bold text-slate-200">Surat Jalan: {noSj}</span>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Surat Jalan</span>
        </button>
      </div>

      {/* Printable Document Sheet */}
      <div className="py-8 flex justify-center print:p-0 print:m-0">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-300 w-[800px] print:w-full print:shadow-none print:border-none print:p-0 print:m-0 space-y-6">
          
          {/* Document Header Section */}
          <div className="grid grid-cols-2 gap-6 border-b border-slate-300 pb-4">
            {/* Left: Company & SJ Metadata */}
            <div className="space-y-1">
              <div className="flex items-center space-x-3 mb-2">
                <img
                  src="/hayami.png"
                  alt="Hayami Logo"
                  className="h-10 object-contain"
                />
                <div>
                  <h1 className="font-extrabold text-sm uppercase tracking-wide text-slate-900">
                    Hayami Indonesia
                  </h1>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Toko Hayami Jatinegara
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <table className="text-xs space-y-1">
                  <tbody>
                    <tr>
                      <td className="font-bold pr-2 text-slate-700">SURAT JALAN NO</td>
                      <td className="pr-2">:</td>
                      <td className="font-extrabold text-slate-900 text-sm">{noSj}</td>
                    </tr>
                    <tr>
                      <td className="text-slate-600 pr-2">Ref Invoice</td>
                      <td className="pr-2">:</td>
                      <td className="font-semibold text-slate-800">{header.id_transaksi}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Date & Customer Details */}
            <div className="space-y-1 pl-4 border-l border-slate-200 print:border-slate-300">
              <table className="w-full text-xs">
                <tbody>
                  <tr>
                    <td className="font-bold text-slate-700 w-24 py-0.5">Tanggal</td>
                    <td className="w-4 text-center">:</td>
                    <td className="font-semibold text-slate-900 uppercase">
                      JATINEGARA, {formatDateStr(header.tgl_transaksi)}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold text-slate-700 py-0.5">Kepada Yth</td>
                    <td className="text-center">:</td>
                    <td className="font-extrabold text-slate-900">
                      {header.nama_customer || header.id_customer}
                    </td>
                  </tr>
                  {header.alamat_lengkap && (
                    <tr>
                      <td className="font-bold text-slate-700 py-0.5 align-top">Alamat</td>
                      <td className="text-center align-top">:</td>
                      <td className="text-slate-800 font-medium uppercase leading-tight">
                        {header.alamat_lengkap} {header.kota ? `, ${header.kota}` : ''}
                      </td>
                    </tr>
                  )}
                  {header.keterangan && (
                    <tr>
                      <td className="font-bold text-slate-700 py-0.5">Keterangan</td>
                      <td className="text-center">:</td>
                      <td className="text-slate-800 italic">{header.keterangan}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 print:bg-slate-200 text-slate-800 font-bold border-b border-slate-300 uppercase text-[11px]">
                  <th className="py-2 px-3 border-r border-slate-300 text-center w-12">No.</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-left w-36">Kode Barang</th>
                  <th className="py-2 px-3 border-r border-slate-300 text-left">Nama / Model Barang</th>
                  <th className="py-2 px-3 text-left w-28">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 border-b border-slate-300 text-slate-800">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 border-r border-slate-300 text-center font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-900">
                      {item.id_bahan}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 font-medium">
                      {item.id_bahan} - {item.model} (Ukuran: {item.ukuran})
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {item.qty} {item.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                  <td colSpan={3} className="py-2 px-3 text-right border-r border-slate-300 uppercase text-[11px]">
                    Total Qty :
                  </td>
                  <td className="py-2 px-3 text-left font-extrabold text-sm text-slate-900">
                    {totalQtyPcs} {mainUom}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Signatures Section */}
          <div className="pt-8">
            <table className="w-full text-center text-xs">
              <thead>
                <tr className="font-bold text-slate-800">
                  <td className="w-1/4 pb-16">Tanda Terima,</td>
                  <td className="w-1/4 pb-16">Pengirim,</td>
                  <td className="w-1/4 pb-16">Mengetahui,</td>
                  <td className="w-1/4 pb-16">Hormat Kami,</td>
                </tr>
              </thead>
              <tbody>
                <tr className="font-semibold text-slate-900">
                  <td>( ............................ )</td>
                  <td>( ............................ )</td>
                  <td>( ............................ )</td>
                  <td>
                    <span className="font-bold underline">Hayami Indonesia</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function PrintSJPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-2" />
          <span className="text-xs font-semibold">Memuat Surat Jalan...</span>
        </div>
      }
    >
      <PrintSJContent />
    </Suspense>
  );
}
