'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, ArrowLeft, RefreshCw } from 'lucide-react';

interface HeaderData {
  id_transaksi: string;
  tgl_transaksi: string;
  tgl_jatuh_tempo?: string;
  jatuh_tempo?: number;
  id_customer: string;
  nama_customer: string;
  alamat_lengkap?: string;
  kota?: string;
  keterangan: string;
  sales: string;
  akun: string;
  nama_akun: string;
  disc_invoice: number;
  disc: number;
  diskon_lusin: number;
  cash: number;
  sisa_bayar: number;
  dibuat_oleh: string;
}

interface ItemData {
  no_id: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  subtotal: number;
}

function PrintInvoiceContent() {
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
          }, 350);
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
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
        <span className="text-sm font-semibold">Memuat Faktur Invoice...</span>
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
  const isHutang = (header.akun || '').trim().toUpperCase() === 'HUTANG';

  // Total calculation logic
  const subtotalAll = items.reduce((acc, it) => acc + (Number(it.subtotal) || (it.qty * it.harga)), 0);
  const totalQtyPcs = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const totalLusin = totalQtyPcs / 12;

  const diskonLusinNominal = totalLusin * (Number(header.diskon_lusin) || 0);
  const totalDiskon = (Number(header.disc_invoice) || 0) + (Number(header.disc) || 0) + diskonLusinNominal;
  const grandTotal = Math.max(0, subtotalAll - totalDiskon);

  const cashPaid = header.cash > 0 ? header.cash : grandTotal;
  const changeAmount = Math.max(0, cashPaid - grandTotal);

  const parseSafeDate = (dStr?: string) => {
    if (!dStr) return null;
    const cleaned = dStr.includes('T') ? dStr : dStr.replace(' ', 'T');
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDateStr = (dateStr: string) => {
    try {
      const d = parseSafeDate(dateStr) || new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatLongDateStr = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = parseSafeDate(dateStr) || new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTimeStr = (dateStr: string) => {
    try {
      const d = parseSafeDate(dateStr) || new Date(dateStr);
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getCalculatedJatuhTempo = () => {
    if (header.tgl_jatuh_tempo) {
      return formatLongDateStr(header.tgl_jatuh_tempo);
    }
    if (header.jatuh_tempo && header.tgl_transaksi) {
      const d = parseSafeDate(header.tgl_transaksi);
      if (d) {
        d.setDate(d.getDate() + Number(header.jatuh_tempo));
        return d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    }
    return '-';
  };

  // IF HUTANG: RENDER PROFORMA INVOICE LAYOUT AUTOMATICALLY
  if (isHutang) {
    return (
      <div className="bg-slate-100 min-h-screen font-['Poppins',sans-serif] text-slate-900 selection:bg-slate-200 print:bg-white print:min-h-0">
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style jsx global>{`
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: #ffffff !important;
            }
            .proforma-sheet {
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
          }
        `}</style>

        {/* Top Non-Print Control Header Bar */}
        <div className="print:hidden sticky top-0 z-50 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.close()}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center space-x-1 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tutup</span>
            </button>
            <span className="text-slate-500">|</span>
            <span className="text-xs font-bold text-slate-200">
              Invoice: {header.id_transaksi}
            </span>
          </div>

          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Invoice</span>
          </button>
        </div>

        {/* Printable Proforma Sheet */}
        <div className="py-6 sm:py-10 flex justify-center print:p-0 print:m-0">
          <div className="proforma-sheet w-[210mm] max-w-full bg-white p-[15mm] shadow-2xl rounded-sm text-slate-900 print:shadow-none print:p-0 print:m-0">
            <div className="w-full max-w-full mx-auto bg-white text-slate-900 text-[12.5px] leading-normal font-['Poppins',sans-serif]">
              
              {/* HEADER */}
              <div className="grid grid-cols-[185px_1fr_285px] gap-6 items-start mt-3 mb-6">
                <div className="logo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/hayami.png" alt="Hayami Logo" className="w-[125px] block mt-1" />
                  <small className="block mt-3.5 tracking-[2px] text-[#666] font-bold text-[9px] whitespace-nowrap">
                    WEAR · GROW · PLAY
                  </small>
                </div>

                <div className="address leading-relaxed text-[13px]">
                  <span className="date block font-bold text-[15px] mb-1">
                    Jakarta, {formatLongDateStr(header.tgl_transaksi)}
                  </span>
                  Kepada Yth.<br />
                  <span className="customer font-medium">{header.nama_customer || header.id_customer || 'CASH'}</span><br />
                  <span>{[header.alamat_lengkap, header.kota].filter(Boolean).join(', ') || '-'}</span>
                </div>

                <div className="invoice-info text-right leading-relaxed text-[13px]">
                  <h2 className="text-[19px] font-bold m-0 mb-1.5 text-slate-900">
                    Invoice
                  </h2>
                  Invoice No: {header.id_transaksi}<br />
                  Tanggal Jatuh Tempo: {getCalculatedJatuhTempo()}<br />
                  TOP: {header.jatuh_tempo ? `${header.jatuh_tempo} Hari` : '-'}
                </div>
              </div>

              {/* TABLE */}
              <table className="w-full border-collapse border border-slate-900 text-[13px] my-2">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-900 p-2 text-center w-[8%] font-bold">No</th>
                    <th className="border border-slate-900 p-2 text-left w-[38%] font-bold">Description</th>
                    <th className="border border-slate-900 p-2 text-center w-[12%] font-bold">Qty</th>
                    <th className="border border-slate-900 p-2 text-center w-[12%] font-bold">Qty LS</th>
                    <th className="border border-slate-900 p-2 text-right w-[15%] font-bold">Unit Price</th>
                    <th className="border border-slate-900 p-2 text-right w-[15%] font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const itemTotal = Number(item.subtotal) || (item.qty * item.harga);
                    return (
                      <tr key={idx}>
                        <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-900 p-2">{item.id_bahan} {item.model} ({item.ukuran})</td>
                        <td className="border border-slate-900 p-2 text-center">{item.qty} PCS</td>
                        <td className="border border-slate-900 p-2 text-center">{(item.qty / 12).toFixed(2)}</td>
                        <td className="border border-slate-900 p-2 text-right">{new Intl.NumberFormat('id-ID').format(item.harga)}</td>
                        <td className="border border-slate-900 p-2 text-right">{new Intl.NumberFormat('id-ID').format(itemTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* SUMMARY AREA */}
              <div className="grid grid-cols-[1fr_280px] gap-3 mt-4 items-start text-[14px]">
                <div className="note text-[11.5px] leading-relaxed">
                  <strong className="text-[14px] font-bold block">Total PCS : {totalQtyPcs} PCS</strong>
                  <strong className="text-[14px] font-bold block">Total Lusin : {totalLusin.toFixed(2)}</strong>
                  <span className="text-slate-600 block mt-1">
                    NB: Barang yang sudah dibeli tidak dapat dikembalikan / ditukar.<br />
                    Terima kasih.
                  </span>
                </div>

                <div className="totals text-right space-y-2">
                  {totalDiskon > 0 && (
                    <>
                      <div className="grid grid-cols-[1fr_120px] items-baseline">
                        <div className="text-right pr-2">Subtotal</div>
                        <div className="font-bold text-right">{new Intl.NumberFormat('id-ID').format(subtotalAll)}</div>
                      </div>
                      <div className="grid grid-cols-[1fr_120px] items-baseline">
                        <div className="text-right pr-2">Diskon</div>
                        <div className="font-bold text-right">{new Intl.NumberFormat('id-ID').format(totalDiskon)}</div>
                      </div>
                    </>
                  )}

                  <div className="border-t border-slate-300 my-2 pt-2"></div>

                  <div className="grid grid-cols-[1fr_120px] items-baseline font-bold text-[16px]">
                    <div className="text-right pr-2 text-[14px]">Grand Total</div>
                    <div className="text-right">{new Intl.NumberFormat('id-ID').format(grandTotal)}</div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="mt-12 flex justify-between text-[13px]">
                <div className="w-[47%]">
                  Tanda terima,
                  <div className="border-t border-slate-900 w-[50mm] mt-14 pt-2 font-bold">
                    {header.nama_customer || header.id_customer || 'CASH'}
                  </div>
                </div>

                <div className="w-[47%] text-right">
                  Hormat kami,
                  <div className="border-t border-slate-900 w-[50mm] mt-14 pt-2 font-bold ml-auto">
                    Hayami
                  </div>
                </div>
              </div>

              {/* BOTTOM BRAND */}
              <div className="mt-9 pt-4 border-t border-dashed border-slate-300 text-center text-[14px] tracking-[3px] text-slate-400 font-bold">
                HAYAMI — WEAR · GROW · PLAY
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // IF NOT HUTANG (CASH / TRANSFER): RENDER STANDARD THERMAL RECEIPT
  return (
    <div className="bg-slate-100 min-h-screen font-mono text-xs text-slate-900 selection:bg-slate-200 print:bg-white print:min-h-0">
      <style jsx global>{`
        @page {
          size: auto;
          margin: 0mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          .thermal-sheet {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Top Non-Print Control Header Bar */}
      <div className="print:hidden sticky top-0 z-50 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.close()}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center space-x-1 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Tutup</span>
          </button>
          <span className="text-slate-500">|</span>
          <span className="text-xs font-bold text-slate-200">Struk: {header.id_transaksi}</span>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak Struk</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="py-6 flex justify-center print:p-0 print:m-0">
        <div className="thermal-sheet bg-white p-5 rounded-xl shadow-lg border border-slate-200 w-[340px] print:w-full print:shadow-none print:border-none print:p-0 print:m-0">
          
          {/* Logo Header */}
          <div className="text-center space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hayami.png"
              alt="Hayami Logo"
              className="h-12 mx-auto object-contain mb-1"
            />
            <h1 className="font-extrabold text-sm uppercase tracking-wide text-slate-900">
              Hayami Indonesia
            </h1>
            <p className="text-[11px] leading-tight text-slate-700 font-medium">
              Toko Hayami Jatinegara
              <br />
              Jakarta, Indonesia
            </p>
          </div>

          <div className="my-2 border-b border-dashed border-slate-400" />

          {/* Meta Information */}
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span>Tanggal:</span>
              <span>{formatDateStr(header.tgl_transaksi)} {formatTimeStr(header.tgl_transaksi)}</span>
            </div>
            <div className="flex justify-between">
              <span>Order ID:</span>
              <span className="font-bold">{header.id_transaksi}</span>
            </div>
            <div className="flex justify-between">
              <span>Collected By:</span>
              <span>{header.dibuat_oleh}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span className="font-bold">{header.nama_customer || header.id_customer}</span>
            </div>
            <div className="flex justify-between">
              <span>Metode:</span>
              <span className="font-bold">{header.nama_akun || header.akun || 'CASH'}</span>
            </div>
          </div>

          <div className="my-2 border-b border-dashed border-slate-400" />

          {/* Line Items */}
          <div className="space-y-2 text-[11px]">
            {items.map((item, idx) => {
              const itemTotal = Number(item.subtotal) || (item.qty * item.harga);
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="font-bold text-slate-900">
                    {idx + 1}. {item.id_bahan} - {item.model} ({item.ukuran})
                  </div>
                  <div className="flex justify-between text-slate-700 pl-3">
                    <span>
                      {item.qty} {item.uom} x Rp {item.harga.toLocaleString('id-ID')}
                    </span>
                    <span className="font-semibold">
                      Rp {itemTotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Customer Lusin Discount */}
          {diskonLusinNominal > 0 && (
            <div className="mt-2 pt-2 border-t border-dashed border-slate-300 text-[11px] space-y-0.5">
              <div className="font-semibold text-slate-800">Diskon/Lusin Customer</div>
              <div className="flex justify-between text-slate-700 pl-3">
                <span>{totalLusin.toFixed(2)} Ls x -Rp {header.diskon_lusin.toLocaleString('id-ID')}</span>
                <span className="font-semibold text-rose-600">-Rp {diskonLusinNominal.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}

          {/* Invoice Discount */}
          {header.disc_invoice > 0 && (
            <div className="mt-1 text-[11px] flex justify-between text-slate-800">
              <span className="font-semibold">Diskon Invoice:</span>
              <span className="font-semibold text-rose-600">-Rp {header.disc_invoice.toLocaleString('id-ID')}</span>
            </div>
          )}

          <div className="my-2 border-b border-dashed border-slate-400" />

          {/* Total & Payment Summary */}
          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between font-extrabold text-xs text-slate-900">
              <span>Total:</span>
              <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>{header.nama_akun || header.akun}:</span>
              <span>Rp {cashPaid.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Kembalian:</span>
              <span>Rp {changeAmount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between pt-1 font-semibold text-slate-700">
              <span>Total Lusin:</span>
              <span>{totalLusin.toFixed(2)} Ls</span>
            </div>
          </div>

          <div className="my-2 border-b border-dashed border-slate-400" />

          {/* Footer Note */}
          <div className="text-center text-[10px] text-slate-600 space-y-0.5 pt-1">
            <p className="font-semibold">Barang yang sudah dibeli</p>
            <p className="font-semibold">tidak dapat dikembalikan</p>
            <p className="text-[9px] text-slate-400 pt-1">Terima Kasih Atas Kunjungan Anda</p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function PrintInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600 mr-2" />
          <span className="text-xs font-semibold">Memuat komponen print...</span>
        </div>
      }
    >
      <PrintInvoiceContent />
    </Suspense>
  );
}
