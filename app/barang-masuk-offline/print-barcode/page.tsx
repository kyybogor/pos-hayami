'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BarcodeSvg from '@/components/BarcodeSvg';
import {
  Printer,
  ArrowLeft,
  RotateCcw,
  Sliders,
  HelpCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BarcodeItem {
  no_id: number;
  id_bahan: string;
  model: string;
  ukuran: string;
  stock: number;
  barcode: string;
}

type PresetKey = 'zebra_33x15' | '2col_78x20' | '2col_80x30' | '1col_40x30' | 'custom';

interface PrintSettings {
  version: number;
  preset: PresetKey;
  orientation: string; // 'landscape', 'portrait', or '68mm 15mm'
  rollWidth: number; // in mm (e.g. 68 for 33x15 2-col)
  labelWidth: number; // in mm (33 for 33x15)
  labelHeight: number; // in mm (15 for 33x15)
  gapMiddle: number; // in mm (2)
  marginLeft: number; // in mm (-1.2 for shifting left as requested)
  marginTop: number; // in mm (0)
  paddingTop: number; // in mm (1.8mm so Baris 1 matches Baris 2 and doesn't get pushed up)
  barcodeHeight: number; // in px (10 for safe clearance)
  fontSize: number; // in px (6)
  barcodeTextSize: number; // in px (7.5)
  columns: 1 | 2;
}

// Default calibrated for Zebra 33x15 mm (2 Kolom): Baris 1 matched to Baris 2, shifted left
const DEFAULT_SETTINGS: PrintSettings = {
  version: 6,
  preset: 'zebra_33x15',
  orientation: 'landscape', // Zebra ZDesigner standard accepted orientation
  rollWidth: 68, // 33mm + 2mm gap + 33mm = 68mm
  labelWidth: 33,
  labelHeight: 15,
  gapMiddle: 2,
  marginLeft: -1.2, // Geser ke kiri 1.2mm agar bagian kiri pas di tengah stiker
  marginTop: 0,
  paddingTop: 1.8, // Turunkan 1.8mm agar Baris 1 persis sama seperti Baris 2 dan tidak terdorong ke atas
  barcodeHeight: 10,
  fontSize: 6,
  barcodeTextSize: 7.5,
  columns: 2,
};

function PrintBarcodeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const id_po = searchParams.get('id_po') || searchParams.get('id_transaksi') || '';
  const sku_id = searchParams.get('sku_id') || '';
  const all = searchParams.get('all') || '';
  const tipe = searchParams.get('tipe') || '';
  const model = searchParams.get('model') || '';
  const ukuran = searchParams.get('ukuran') || '';
  const page = searchParams.get('page') || '';

  const [items, setItems] = useState<BarcodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Qty setting (e.g. x3 pcs per bundle/barcode)
  const [qtyKetikInput, setQtyKetikInput] = useState<number>(3);
  const [qtyKetik, setQtyKetik] = useState<number>(3);

  // Settings
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  // Load saved settings from localStorage, ensuring version 6 calibration is applied
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_barcode_print_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.version || parsed.version < 6) {
          setSettings(DEFAULT_SETTINGS);
          localStorage.setItem('pos_barcode_print_settings', JSON.stringify(DEFAULT_SETTINGS));
          return;
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore
    }
  }, []);

  // Save settings helper
  const updateSettings = (newSettings: Partial<PrintSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('pos_barcode_print_settings', JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  // Preset handler
  const handleApplyPreset = (presetKey: PresetKey) => {
    if (presetKey === 'zebra_33x15') {
      updateSettings({
        preset: 'zebra_33x15',
        rollWidth: 68,
        labelWidth: 33,
        labelHeight: 15,
        gapMiddle: 2,
        columns: 2,
        marginLeft: -1.2,
        marginTop: 0,
        paddingTop: 1.8,
        barcodeHeight: 10,
        fontSize: 6,
        barcodeTextSize: 7.5,
        orientation: 'landscape',
      });
    } else if (presetKey === '2col_78x20') {
      updateSettings({
        preset: '2col_78x20',
        rollWidth: 76,
        labelWidth: 37,
        labelHeight: 19.5,
        gapMiddle: 2,
        columns: 2,
        marginLeft: 0,
        marginTop: 0,
        paddingTop: 1.5,
        barcodeHeight: 16,
        fontSize: 7,
        barcodeTextSize: 9,
        orientation: 'landscape',
      });
    } else if (presetKey === '2col_80x30') {
      updateSettings({
        preset: '2col_80x30',
        rollWidth: 80,
        labelWidth: 38,
        labelHeight: 28,
        gapMiddle: 2,
        columns: 2,
        marginLeft: 0,
        marginTop: 0,
        paddingTop: 2,
        barcodeHeight: 22,
        fontSize: 8,
        barcodeTextSize: 10,
        orientation: 'landscape',
      });
    } else if (presetKey === '1col_40x30') {
      updateSettings({
        preset: '1col_40x30',
        rollWidth: 40,
        labelWidth: 38,
        labelHeight: 28,
        gapMiddle: 0,
        columns: 1,
        marginLeft: 0,
        marginTop: 0,
        paddingTop: 2,
        barcodeHeight: 22,
        fontSize: 8,
        barcodeTextSize: 10,
        orientation: 'portrait',
      });
    } else {
      updateSettings({ preset: 'custom' });
    }
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem('pos_barcode_print_settings', JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // Ignore
    }
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2000);
  };

  useEffect(() => {
    if (!id_po && (!tipe || !model || !ukuran)) {
      setError('Data barcode tidak ditemukan (ID Transaksi / Tipe/Model/Ukuran wajib)');
      setLoading(false);
      return;
    }

    const fetchBarcodeData = async () => {
      try {
        setLoading(true);
        let url = `/api/barang-masuk-offline/barcode?`;
        if (tipe && model && ukuran) {
          url += `tipe=${encodeURIComponent(tipe)}&model=${encodeURIComponent(model)}&ukuran=${encodeURIComponent(ukuran)}`;
        } else if (id_po) {
          url += `id_po=${encodeURIComponent(id_po)}`;
          if (all === '1') {
            url += '&all=1';
          } else if (sku_id) {
            url += `&sku_id=${encodeURIComponent(sku_id)}`;
          }
        }

        const res = await fetch(url);
        const json = await res.json();

        if (json.success) {
          setItems(json.data || []);
        } else {
          setError(json.message || 'Gagal mengambil data barcode');
        }
      } catch (err: any) {
        console.error('Error fetching barcode data:', err);
        setError('Terjadi kesalahan jaringan');
      } finally {
        setLoading(false);
      }
    };

    fetchBarcodeData();
  }, [id_po, sku_id, all, tipe, model, ukuran]);

  const handleSaveQty = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(qtyKetikInput);
    if (!isNaN(val) && val > 0) {
      setQtyKetik(val);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2000);
    }
  };

  const handleBack = () => {
    if (window.opener) {
      window.close();
    } else if (page === 'sd' || !id_po) {
      router.push('/stock-detail');
    } else {
      router.push(`/barang-masuk-offline/edit?id_transaksi=${encodeURIComponent(id_po)}&detail=view`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-600 space-y-3">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
        <p className="text-sm font-semibold">Memuat data barcode...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-rose-600 bg-rose-50 min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-200 max-w-md w-full">
          <p className="mb-4 font-semibold text-rose-700">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition cursor-pointer"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: ${settings.orientation};
            margin: 0 !important;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .non-print {
            display: none !important;
          }

          .barcode-row-container {
            display: block !important;
            width: ${settings.rollWidth}mm !important;
            height: ${settings.labelHeight}mm !important;
            max-height: ${settings.labelHeight}mm !important;
            margin-left: ${settings.marginLeft}mm !important;
            margin-top: ${settings.marginTop}mm !important;
            margin-bottom: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }

          table.barcode-table {
            display: table !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
            width: ${settings.rollWidth}mm !important;
            height: ${settings.labelHeight}mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          tr.barcode-row {
            display: table-row !important;
            height: ${settings.labelHeight}mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          td.barcode-cell {
            display: table-cell !important;
            padding: 0 !important;
            vertical-align: top !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .barcode-sticker-content {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
          }
        }

        @media screen {
          .barcode-sticker-content {
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            background: #ffffff;
            transition: all 0.15s ease;
          }

          .barcode-sticker-content:hover {
            border-color: #10b981;
            box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
          }
        }
      `}</style>

      <div className="bg-slate-100 min-h-screen text-slate-800">
        {/* NON-PRINT TOP CONTROL BAR */}
        <header className="non-print bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left Title */}
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  title="Kembali"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <Printer className="w-4 h-4 text-emerald-600" />
                    <span>Cetak Barcode Zebra ({settings.labelWidth}x{settings.labelHeight} mm)</span>
                  </h1>
                  <p className="text-[11px] text-slate-500">
                    Posisi Baris 1 &amp; 2 Disamakan Presisi • Geser Kiri Aktif ({settings.marginLeft} mm)
                  </p>
                </div>
              </div>

              {/* Middle: Quick Alignment Adjusters & Presets */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Geser Kiri / Kanan */}
                <div className="flex items-center space-x-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600">Geser Kiri/Kanan:</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        marginLeft: Number((settings.marginLeft - 0.5).toFixed(1)),
                        preset: 'custom',
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 transition"
                    title="Geser Lebih ke Kiri (-0.5 mm)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-800 px-1">
                    {settings.marginLeft} mm
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        marginLeft: Number((settings.marginLeft + 0.5).toFixed(1)),
                        preset: 'custom',
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 transition"
                    title="Geser ke Kanan (+0.5 mm)"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Jarak Atas Baris 1 */}
                <div className="flex items-center space-x-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-600">Posisi Atas:</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        paddingTop: Number(Math.max(0, settings.paddingTop - 0.3).toFixed(1)),
                        preset: 'custom',
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 transition"
                    title="Naikkan ke Atas (-0.3 mm)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold text-slate-800 px-1">
                    {settings.paddingTop} mm
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({
                        paddingTop: Number((settings.paddingTop + 0.3).toFixed(1)),
                        preset: 'custom',
                      })
                    }
                    className="p-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-slate-700 transition"
                    title="Turunkan ke Bawah (+0.3 mm)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Form Qty Per Stiker */}
                <form
                  onSubmit={handleSaveQty}
                  className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200"
                >
                  <span className="text-[11px] font-bold text-slate-600">
                    Qty:
                  </span>
                  <input
                    type="number"
                    min="1"
                    className="w-12 px-1.5 py-0.5 bg-white border border-slate-300 rounded-lg text-center text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={qtyKetikInput}
                    onChange={(e) => setQtyKetikInput(Number(e.target.value))}
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer shadow-2xs"
                  >
                    OK
                  </button>
                </form>

                {/* Preset Dropdown */}
                <div className="flex items-center space-x-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                  <select
                    value={settings.preset}
                    onChange={(e) => handleApplyPreset(e.target.value as PresetKey)}
                    className="bg-transparent text-xs font-bold text-slate-800 border-none focus:outline-none cursor-pointer"
                  >
                    <option value="zebra_33x15">Zebra 33×15 mm (2 Kolom)</option>
                    <option value="2col_78x20">2 Kolom 78×20 mm</option>
                    <option value="2col_80x30">2 Kolom 80×30 mm</option>
                    <option value="1col_40x30">1 Kolom 40×30 mm</option>
                    <option value="custom">Kustom...</option>
                  </select>
                </div>

                {/* Toggle Advanced Settings */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                    showAdvanced
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Pengaturan Lanjutan"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </div>

              {/* Right: Print Action */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Barcode</span>
                </button>
              </div>
            </div>

            {/* Notification alert on setting save */}
            {saveSuccessNotice && (
              <div className="mt-2 py-1 px-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center space-x-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pengaturan berhasil diperbarui.</span>
              </div>
            )}

            {/* ADVANCED SETTINGS PANEL (EXPANDABLE) */}
            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Lebar Stiker (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.labelWidth}
                    onChange={(e) =>
                      updateSettings({
                        labelWidth: Number(e.target.value),
                        rollWidth: Number(e.target.value) * settings.columns + settings.gapMiddle,
                        preset: 'custom',
                      })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Tinggi Stiker (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.labelHeight}
                    onChange={(e) =>
                      updateSettings({
                        labelHeight: Number(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Margin Kiri (mm)
                  </label>
                  <input
                    type="number"
                    step="0.2"
                    value={settings.marginLeft}
                    onChange={(e) =>
                      updateSettings({
                        marginLeft: Number(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    title="Nilai minus (misal -1.2) menggeser stiker lebih ke sebelah kiri"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Jarak Atas (mm)
                  </label>
                  <input
                    type="number"
                    step="0.2"
                    value={settings.paddingTop}
                    onChange={(e) =>
                      updateSettings({
                        paddingTop: Number(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    title="Menyesuaikan jarak dari tepi atas agar baris 1 tidak terdorong ke atas"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Tinggi Barcode (px)
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="20"
                    value={settings.barcodeHeight}
                    onChange={(e) =>
                      updateSettings({
                        barcodeHeight: Number(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Ukuran Font (px)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="5"
                    max="8"
                    value={settings.fontSize}
                    onChange={(e) =>
                      updateSettings({
                        fontSize: Number(e.target.value),
                        preset: 'custom',
                      })
                    }
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    className="w-full py-1.5 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Zebra</span>
                  </button>
                </div>
              </div>
            )}

            {/* HELPER TIPS */}
            <div className="mt-2.5 p-2 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start space-x-2">
              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Baris 1 &amp; 2 Disamakan Presisi:</span> Posisi atas disetel ke <strong>{settings.paddingTop} mm</strong> (menurunkan baris 1 agar sama persis seperti baris 2 &amp; tidak terdorong ke atas), dan posisi kiri digeser ke kiri <strong>{settings.marginLeft} mm</strong>. Anda bisa langsung menekan tombol panah kiri/kanan/atas/bawah di atas untuk mengatur cepat.
              </div>
            </div>
          </div>
        </header>

        {/* PRINT CANVAS / STICKER PREVIEW */}
        <main className="p-4 sm:p-8 flex justify-center">
          <div>
            {items.map((item, itemIdx) => {
              const qty = item.stock;
              if (qty <= 0) {
                return (
                  <div
                    key={itemIdx}
                    className="p-4 text-center text-slate-400 font-semibold text-xs non-print bg-white rounded-xl mb-4"
                  >
                    Stok Kosong ({item.id_bahan} - {item.model})
                  </div>
                );
              }

              const currentQtyKetik = qtyKetik > qty ? qty : qtyKetik;
              const ttjml = Math.ceil(qty / currentQtyKetik);
              const qtyid =
                currentQtyKetik < 10 ? `0${currentQtyKetik}` : `${currentQtyKetik}`;
              const fullBarcodeText = `${item.barcode || item.id_bahan}${qtyid}`;

              // Array of stickers for this SKU
              const stickers = Array.from({ length: ttjml });

              // Group into rows based on column count (2 columns or 1 column)
              const rowsOfStickers: Array<[number, number | null]> = [];
              if (settings.columns === 2) {
                for (let i = 0; i < stickers.length; i += 2) {
                  rowsOfStickers.push([
                    i + 1,
                    i + 2 <= stickers.length ? i + 2 : null,
                  ]);
                }
              } else {
                for (let i = 0; i < stickers.length; i++) {
                  rowsOfStickers.push([i + 1, null]);
                }
              }

              return (
                <div key={itemIdx} className="mb-4 print:mb-0">
                  {rowsOfStickers.map((pair, rIdx) => (
                    <div
                      key={rIdx}
                      className="barcode-row-container mb-3 print:mb-0"
                      style={{
                        width: `${settings.rollWidth}mm`,
                        height: `${settings.labelHeight}mm`,
                        marginLeft: `${settings.marginLeft}mm`,
                        boxSizing: 'border-box',
                      }}
                    >
                      <table
                        className="barcode-table"
                        style={{
                          width: `${settings.rollWidth}mm`,
                          height: `${settings.labelHeight}mm`,
                          borderCollapse: 'collapse',
                          tableLayout: 'fixed',
                        }}
                      >
                        <tbody>
                          <tr
                            className="barcode-row"
                            style={{
                              height: `${settings.labelHeight}mm`,
                            }}
                          >
                            {/* Column 1 (Left Sticker) */}
                            <td
                              className="barcode-cell"
                              style={{
                                width: `${settings.labelWidth}mm`,
                                height: `${settings.labelHeight}mm`,
                                padding: 0,
                                verticalAlign: 'top',
                                boxSizing: 'border-box',
                              }}
                            >
                              <div
                                className="barcode-sticker-content"
                                style={{
                                  width: `${settings.labelWidth}mm`,
                                  height: `${settings.labelHeight}mm`,
                                  paddingTop: `${settings.paddingTop}mm`,
                                  paddingBottom: '0.4mm',
                                  paddingLeft: '0.8mm',
                                  paddingRight: '0.8mm',
                                  boxSizing: 'border-box',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-start',
                                  alignItems: 'center',
                                  textAlign: 'center',
                                  overflow: 'hidden',
                                  margin: '0 auto',
                                }}
                              >
                                {/* Header Info */}
                                <div
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    fontSize: `${settings.fontSize}px`,
                                    lineHeight: '1.0',
                                    fontWeight: 'bold',
                                    color: '#000000',
                                    marginBottom: '1px',
                                  }}
                                >
                                  <div
                                    style={{
                                      flex: 1,
                                      textAlign: 'left',
                                      paddingRight: '2px',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        letterSpacing: '-0.2px',
                                      }}
                                      title={item.id_bahan}
                                    >
                                      {item.id_bahan}
                                    </div>
                                    <div
                                      style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        letterSpacing: '-0.2px',
                                      }}
                                      title={item.model}
                                    >
                                      {item.model}
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      textAlign: 'right',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                      paddingLeft: '1px',
                                      lineHeight: '1.0',
                                    }}
                                  >
                                    <div>x{currentQtyKetik}</div>
                                    <div style={{ marginTop: '0.5px' }}>{item.ukuran}</div>
                                  </div>
                                </div>

                                {/* Barcode SVG (Compact 10px height) */}
                                <div
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    margin: '0.5px 0',
                                  }}
                                >
                                  <BarcodeSvg
                                    text={fullBarcodeText}
                                    height={settings.barcodeHeight}
                                    barWidth={0.88}
                                    style={{
                                      height: `${settings.barcodeHeight}px`,
                                      maxWidth: '94%',
                                      width: 'auto',
                                      display: 'block',
                                      margin: '0 auto',
                                    }}
                                  />
                                </div>

                                {/* Barcode Text Number */}
                                <div
                                  style={{
                                    fontSize: `${settings.barcodeTextSize}px`,
                                    fontWeight: 'bold',
                                    color: '#000000',
                                    fontFamily: 'monospace, Courier, sans-serif',
                                    lineHeight: 1,
                                    letterSpacing: '0.6px',
                                    textAlign: 'center',
                                    width: '100%',
                                    marginTop: '0.5px',
                                  }}
                                >
                                  {fullBarcodeText}
                                </div>
                              </div>
                            </td>

                            {/* Gap Middle (2mm) */}
                            {settings.columns === 2 && (
                              <td
                                style={{
                                  width: `${settings.gapMiddle}mm`,
                                  padding: 0,
                                }}
                              />
                            )}

                            {/* Column 2 (Right Sticker) */}
                            {settings.columns === 2 && (
                              <td
                                className="barcode-cell"
                                style={{
                                  width: `${settings.labelWidth}mm`,
                                  height: `${settings.labelHeight}mm`,
                                  padding: 0,
                                  verticalAlign: 'top',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {pair[1] !== null ? (
                                  <div
                                    className="barcode-sticker-content"
                                    style={{
                                      width: `${settings.labelWidth}mm`,
                                      height: `${settings.labelHeight}mm`,
                                      paddingTop: `${settings.paddingTop}mm`,
                                      paddingBottom: '0.4mm',
                                      paddingLeft: '0.8mm',
                                      paddingRight: '0.8mm',
                                      boxSizing: 'border-box',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'flex-start',
                                      alignItems: 'center',
                                      textAlign: 'center',
                                      overflow: 'hidden',
                                      margin: '0 auto',
                                    }}
                                  >
                                    {/* Header Info */}
                                    <div
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        fontSize: `${settings.fontSize}px`,
                                        lineHeight: '1.0',
                                        fontWeight: 'bold',
                                        color: '#000000',
                                        marginBottom: '1px',
                                      }}
                                    >
                                      <div
                                        style={{
                                          flex: 1,
                                          textAlign: 'left',
                                          paddingRight: '2px',
                                          overflow: 'hidden',
                                        }}
                                      >
                                        <div
                                          style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            letterSpacing: '-0.2px',
                                          }}
                                          title={item.id_bahan}
                                        >
                                          {item.id_bahan}
                                        </div>
                                        <div
                                          style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            letterSpacing: '-0.2px',
                                          }}
                                          title={item.model}
                                        >
                                          {item.model}
                                        </div>
                                      </div>

                                      <div
                                        style={{
                                          textAlign: 'right',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                          paddingLeft: '1px',
                                          lineHeight: '1.0',
                                        }}
                                      >
                                        <div>x{currentQtyKetik}</div>
                                        <div style={{ marginTop: '0.5px' }}>{item.ukuran}</div>
                                      </div>
                                    </div>

                                    {/* Barcode SVG (Compact 10px height) */}
                                    <div
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        margin: '0.5px 0',
                                      }}
                                    >
                                      <BarcodeSvg
                                        text={fullBarcodeText}
                                        height={settings.barcodeHeight}
                                        barWidth={0.88}
                                        style={{
                                          height: `${settings.barcodeHeight}px`,
                                          maxWidth: '94%',
                                          width: 'auto',
                                          display: 'block',
                                          margin: '0 auto',
                                        }}
                                      />
                                    </div>

                                    {/* Barcode Text Number */}
                                    <div
                                      style={{
                                        fontSize: `${settings.barcodeTextSize}px`,
                                        fontWeight: 'bold',
                                        color: '#000000',
                                        fontFamily: 'monospace, Courier, sans-serif',
                                        lineHeight: 1,
                                        letterSpacing: '0.6px',
                                        textAlign: 'center',
                                        width: '100%',
                                        marginTop: '0.5px',
                                      }}
                                    >
                                      {fullBarcodeText}
                                    </div>
                                  </div>
                                ) : null}
                              </td>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}

export default function PrintBarcodePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-600">
          Memuat halaman print barcode...
        </div>
      }
    >
      <PrintBarcodeContent />
    </Suspense>
  );
}