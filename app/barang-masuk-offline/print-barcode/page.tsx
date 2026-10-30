'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BarcodeSvg from '@/components/BarcodeSvg';

interface BarcodeItem {
  no_id: number;
  id_bahan: string;
  model: string;
  ukuran: string;
  stock: number;
  barcode: string;
}

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
  const [qtyKetikInput, setQtyKetikInput] = useState<number>(3);
  const [qtyKetik, setQtyKetik] = useState<number>(3);

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
    }
  };

  const handleBack = () => {
    if (page === 'sd' || !id_po) {
      router.push('/stock-detail');
    } else {
      router.push(`/barang-masuk-offline/edit?id_transaksi=${encodeURIComponent(id_po)}&detail=view`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-600">
        Memuat data barcode...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 min-h-screen">
        <p className="mb-4 font-semibold">{error}</p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }

          body {
            margin: 0;
            background: white !important;
          }

          .non-print {
            display: none !important;
          }

          .pageBreak {
            page-break-after: always;
          }

          table {
            display: table !important;
            width: 92mm !important;
            table-layout: fixed !important;
            margin-left: 38mm !important;
          }

          tr {
            display: table-row !important;
          }

          td.col1 {
            display: table-cell !important;
            width: 44mm !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          td.col2 {
            display: table-cell !important;
            width: 48mm !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }

        table {
          width: 92mm;
          table-layout: fixed;
          border-collapse: collapse;
          margin-left: 38mm;
        }

        td.col1 {
          width: 44mm;
          padding: 0;
          vertical-align: top;
        }

        td.col2 {
          width: 48mm;
          padding: 0;
          vertical-align: top;
        }

        .tetx {
          width: 36mm;
          display: block;
          font-size: 15px;
        }

        .tetx svg {
          image-rendering: pixelated !important;
        }
      `}</style>

      <div className="bg-white min-h-screen p-0">
        {/* Header non-print control for setting Qty */}
        <div className="non-print p-3 bg-gray-100 border-b border-gray-200 mb-4">
          <div className="max-w-xs">
            <form onSubmit={handleSaveQty} className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap bg-gray-200 px-2 py-1 rounded">
                Qty :
              </span>
              <input
                type="number"
                min="1"
                className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-xs focus:ring-1 focus:ring-blue-500"
                value={qtyKetikInput}
                onChange={(e) => setQtyKetikInput(Number(e.target.value))}
              />
              <button
                type="submit"
                className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
              >
                Save
              </button>
            </form>
          </div>
        </div>

        {/* Print Barcode Label Rendering */}
        <div>
          {items.map((item, itemIdx) => {
            const qty = item.stock;
            if (qty <= 0) {
              return (
                <div key={itemIdx} className="p-4 text-center text-gray-500 font-semibold">
                  Stock Habis ({item.id_bahan} - {item.model})
                </div>
              );
            }

            const currentQtyKetik = qtyKetik > qty ? qty : qtyKetik;
            const ttjml = Math.ceil(qty / currentQtyKetik);
            const qtyid = currentQtyKetik < 10 ? `0${currentQtyKetik}` : `${currentQtyKetik}`;
            const fullBarcodeText = `${item.barcode || item.id_bahan}${qtyid}`;

            const idBahanDisplay = (item.id_bahan || '').replace(/-/g, '\u2011');
            const modelDisplay = (item.model || '').replace(/-/g, '\u2011');
            const ukuranDisplay = (item.ukuran || '').replace(/-/g, '\u2011');

            // Generate sticker array
            const stickers = Array.from({ length: ttjml });

            // Group into pairs for 2-column layout (col1 and col2)
            const rowsOfStickers: Array<[number, number | null]> = [];
            for (let i = 0; i < stickers.length; i += 2) {
              rowsOfStickers.push([i + 1, i + 2 <= stickers.length ? i + 2 : null]);
            }

            return (
              <React.Fragment key={itemIdx}>
                <table>
                  <tbody>
                    {rowsOfStickers.map((pair, rIdx) => (
                      <React.Fragment key={rIdx}>
                        <tr>
                          {/* Column 1 (Left Sticker) */}
                          <td className="col1">
                            <div
                              className="tetx"
                              style={{
                                marginTop: '18px',
                                marginLeft: '2px',
                                marginRight: 'auto',
                              }}
                            >
                              <div>
                                <div
                                  className="flex justify-between items-start"
                                  style={{
                                    fontSize: '7px',
                                    lineHeight: '1.1',
                                    fontWeight: 'bold',
                                    marginBottom: '0px',
                                  }}
                                >
                                  <div className="text-center flex-1 pr-1">
                                    <span style={{ display: 'block', marginTop: '2px' }}>
                                      {idBahanDisplay}
                                    </span>
                                    <span
                                      style={{
                                        display: 'block',
                                        marginTop: '2px',
                                        marginBottom: '2px',
                                      }}
                                    >
                                      {modelDisplay}
                                    </span>
                                  </div>
                                  <div
                                    className="text-right whitespace-nowrap"
                                    style={{ marginTop: '2px', lineHeight: '1.1' }}
                                  >
                                    <span>x{currentQtyKetik}</span>
                                    <br />
                                    <span style={{ display: 'block', marginTop: '2px' }}>
                                      {ukuranDisplay}
                                    </span>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    backgroundColor: '#ffffff',
                                    paddingBottom: '2px',
                                  }}
                                >
                                  <div className="text-center" style={{ marginTop: '0px' }}>
                                    <BarcodeSvg
                                      text={fullBarcodeText}
                                      height={48}
                                      barWidth={1.2}
                                      style={{ height: '48px', maxWidth: '100%', width: 'auto', display: 'block', margin: '0 auto' }}
                                    />
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: '#000000',
                                        fontFamily: 'monospace',
                                        marginTop: '3px',
                                        lineHeight: 1,
                                        letterSpacing: '0.5px',
                                      }}
                                    >
                                      {fullBarcodeText}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Column 2 (Right Sticker) */}
                          {pair[1] !== null ? (
                            <td className="col2">
                              <div
                                className="tetx"
                                style={{
                                  marginTop: '18px',
                                  marginRight: '2px',
                                  marginLeft: 'auto',
                                }}
                              >
                                <div>
                                  <div
                                    className="flex justify-between items-start"
                                    style={{
                                      fontSize: '7px',
                                      lineHeight: '1.1',
                                      fontWeight: 'bold',
                                      marginBottom: '0px',
                                    }}
                                  >
                                    <div className="text-center flex-1 pr-1">
                                      <span style={{ display: 'block', marginTop: '2px' }}>
                                        {idBahanDisplay}
                                      </span>
                                      <span
                                        style={{
                                          display: 'block',
                                          marginTop: '2px',
                                          marginBottom: '2px',
                                        }}
                                      >
                                        {modelDisplay}
                                      </span>
                                    </div>
                                    <div
                                      className="text-right whitespace-nowrap"
                                      style={{ marginTop: '2px', lineHeight: '1.1' }}
                                    >
                                      <span>x{currentQtyKetik}</span>
                                      <br />
                                      <span style={{ display: 'block', marginTop: '2px' }}>
                                        {ukuranDisplay}
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      backgroundColor: '#ffffff',
                                      paddingBottom: '2px',
                                    }}
                                  >
                                    <div className="text-center" style={{ marginTop: '0px' }}>
                                      <BarcodeSvg
                                        text={fullBarcodeText}
                                        height={48}
                                        barWidth={1.2}
                                        style={{ height: '48px', maxWidth: '100%', width: 'auto', display: 'block', margin: '0 auto' }}
                                      />
                                      <div
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: 'bold',
                                          color: '#000000',
                                          fontFamily: 'monospace',
                                          marginTop: '3px',
                                          lineHeight: 1,
                                          letterSpacing: '0.5px',
                                        }}
                                      >
                                        {fullBarcodeText}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <td className="col2"></td>
                          )}
                        </tr>

                        <tr className="pageBreak"></tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </React.Fragment>
            );
          })}
        </div>

        {/* Bottom non-print action bar */}
        <div className="fixed bottom-3 left-3 right-3 flex gap-3 non-print z-50 max-w-sm">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded shadow transition-colors text-center"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded shadow transition-colors text-center"
          >
            Print
          </button>
        </div>
      </div>
    </>
  );
}

export default function PrintBarcodePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-600">
          Memuat halaman print barcode...
        </div>
      }
    >
      <PrintBarcodeContent />
    </Suspense>
  );
}
