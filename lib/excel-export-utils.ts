import ExcelJS from 'exceljs';

export interface DailyPenerimaanItem {
  tgl_transaksi: string;
  penjualan_tunai: number;
  penerimaan_ar: number;
  total_penerimaan: number;
  count_penjualan: number;
  count_ar: number;
  breakdown: Record<string, number>;
}

export interface PenerimaanSummaryData {
  total_penjualan_direct: number;
  total_ar_received: number;
  grand_total: number;
  total_hari: number;
}

export interface DetailPenjualanItem {
  id_transaksi: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  akun: string;
  pcs: number;
  lusin: number;
  total_nota: number;
  penerimaan: number;
  status: string;
}

export interface DetailArItem {
  no_id: number;
  id_transaksi: string;
  id_customer: string;
  nama_customer: string;
  tgl_bayar: string;
  metode: string;
  nominal: number;
  keterangan: string;
  dibuat_oleh: string;
}

export interface DateDetailPenerimaanData {
  tgl_transaksi: string;
  summary: {
    total_penjualan_direct: number;
    total_ar_received: number;
    grand_total: number;
  };
  penjualan: DetailPenjualanItem[];
  penerimaan_ar: DetailArItem[];
}

export interface DailyExpenseSummary {
  tgl_transaksi: string;
  total_pengeluaran: number;
  count_transaksi: number;
}

export interface ExpenseSummaryData {
  total_pengeluaran: number;
  total_transaksi: number;
  total_hari: number;
  rata_rata_harian: number;
}

export interface DetailExpenseItem {
  id_petty: string;
  tgl: string;
  keterangan: string;
  out_cash: number;
  bukti_petty: string;
  dibuat_oleh: string;
  dibuat_tgl?: string;
}

export interface DateDetailExpenseData {
  tgl_transaksi: string;
  total_pengeluaran: number;
  count_items: number;
  items: DetailExpenseItem[];
}

const formatDateIndo = (dateStr: string) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatNowIndo = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Download Blob helper
 */
const downloadWorkbook = async (workbook: ExcelJS.Workbook, filename: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
};

// Common Styles
const fontTitle = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF0F172A' } };
const fontSubtitle = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
const fontCell = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
const fontCellBold = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0F172A' } };

const borderThin = {
  top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
};

const borderTotal = {
  top: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
  left: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
  bottom: { style: 'double' as const, color: { argb: 'FF0F172A' } },
  right: { style: 'thin' as const, color: { argb: 'FF94A3B8' } },
};

/**
 * 1. EXPORT REKAP PENERIMAAN HARIAN
 */
export async function exportPenerimaanHarianExcel({
  dailyList,
  summaryData,
  tglFrom,
  tglTo,
}: {
  dailyList: DailyPenerimaanItem[];
  summaryData: PenerimaanSummaryData;
  tglFrom: string;
  tglTo: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Rekap Penerimaan Harian', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws.mergeCells('A1:I1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LAPORAN PENERIMAAN HARIAN';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } }; // Dark Emerald
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:I2');
  const subCell = ws.getCell('A2');
  const periodText =
    tglFrom || tglTo
      ? `Periode: ${tglFrom ? formatDateIndo(tglFrom) : 'Awal'} s/d ${tglTo ? formatDateIndo(tglTo) : 'Sekarang'}`
      : 'Periode: Semua Data';
  subCell.value = `${periodText}  |  Tanggal Export: ${formatNowIndo()}`;
  subCell.font = fontSubtitle;

  ws.addRow([]); // Row 3 empty

  // KPI Summary Card Table (Rows 4-5)
  ws.mergeCells('A4:B4');
  ws.getCell('A4').value = 'Total Penjualan Tunai';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('A5:B5');
  ws.getCell('A5').value = summaryData.total_penjualan_direct;
  ws.getCell('A5').numFmt = 'Rp #,##0';
  ws.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF064E3B' } };

  ws.mergeCells('C4:D4');
  ws.getCell('C4').value = 'Total Penerimaan AR';
  ws.getCell('C4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  ws.mergeCells('C5:D5');
  ws.getCell('C5').value = summaryData.total_ar_received;
  ws.getCell('C5').numFmt = 'Rp #,##0';
  ws.getCell('C5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  ws.mergeCells('E4:F4');
  ws.getCell('E4').value = 'Grand Total Penerimaan';
  ws.getCell('E4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  ws.mergeCells('E5:F5');
  ws.getCell('E5').value = summaryData.grand_total;
  ws.getCell('E5').numFmt = 'Rp #,##0';
  ws.getCell('E5').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF047857' } };

  ws.mergeCells('G4:I4');
  ws.getCell('G4').value = 'Total Hari Aktif';
  ws.getCell('G4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
  ws.mergeCells('G5:I5');
  ws.getCell('G5').value = `${summaryData.total_hari} Hari Transaksi`;
  ws.getCell('G5').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF334155' } };

  // Background styling for KPI Card
  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws.addRow([]); // Row 6 empty

  // Table Headers
  const headerRowIndex = 7;
  const headers = [
    'No',
    'Tanggal',
    'Kode Tanggal',
    'Penjualan Tunai (Rp)',
    'Penerimaan AR (Rp)',
    'Total Penerimaan (Rp)',
    'Sales (Trx)',
    'AR (Trx)',
    'Rincian Pembayaran',
  ];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Deep Emerald Header
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx === 0 || idx === 2 || idx === 6 || idx === 7 ? 'center' : idx >= 3 && idx <= 5 ? 'right' : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Table Data
  let startDataRow = 8;
  dailyList.forEach((item, idx) => {
    const row = ws.getRow(startDataRow + idx);
    row.height = 22;

    const breakdownText = Object.entries(item.breakdown || {})
      .map(([mKey, mVal]) => `${mKey}: Rp ${Math.round(mVal).toLocaleString('id-ID')}`)
      .join(' | ');

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = formatDateIndo(item.tgl_transaksi);
    row.getCell(3).value = item.tgl_transaksi;
    row.getCell(4).value = Number(item.penjualan_tunai || 0);
    row.getCell(5).value = Number(item.penerimaan_ar || 0);
    row.getCell(6).value = Number(item.total_penerimaan || 0);
    row.getCell(7).value = Number(item.count_penjualan || 0);
    row.getCell(8).value = Number(item.count_ar || 0);
    row.getCell(9).value = breakdownText || '-';

    // Formatting & Alignments
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' };

    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).numFmt = '#,##0';
    row.getCell(8).numFmt = '#,##0';

    const isEven = idx % 2 === 0;
    const rowFillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
      cell.border = borderThin;
    }
  });

  // Table Total Footer Row
  const totalRowIndex = startDataRow + dailyList.length;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'TOTAL PERIODE TERPILIH';
  ws.mergeCells(`A${totalRowIndex}:C${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(4).value = summaryData.total_penjualan_direct;
  totalRow.getCell(5).value = summaryData.total_ar_received;
  totalRow.getCell(6).value = summaryData.grand_total;
  totalRow.getCell(7).value = dailyList.reduce((acc, i) => acc + i.count_penjualan, 0);
  totalRow.getCell(8).value = dailyList.reduce((acc, i) => acc + i.count_ar, 0);
  totalRow.getCell(9).value = `Total ${dailyList.length} Hari`;

  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(5).numFmt = '#,##0';
  totalRow.getCell(6).numFmt = '#,##0';
  totalRow.getCell(7).numFmt = '#,##0';
  totalRow.getCell(8).numFmt = '#,##0';

  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 6 ? 'FFF59E0B' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Dark navy background
    cell.border = borderTotal;
    if (c >= 4 && c <= 6) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (c === 7 || c === 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  }

  // Column Widths Auto-fit
  const colWidths = [6, 24, 14, 20, 20, 22, 12, 12, 45];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const periodSlug = tglFrom && tglTo ? `${tglFrom}_sd_${tglTo}` : 'semua_periode';
  await downloadWorkbook(workbook, `Laporan_Penerimaan_Harian_${periodSlug}.xlsx`);
}

/**
 * 2. EXPORT DETAIL PENERIMAAN DATE MODAL
 */
export async function exportDetailPenerimaanExcel(detailData: DateDetailPenerimaanData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  // Sheet 1: Penjualan Direct
  const ws1 = workbook.addWorksheet('Penjualan Direct', { views: [{ showGridLines: true }] });

  ws1.mergeCells('A1:G1');
  const title1 = ws1.getCell('A1');
  title1.value = `RINCIAN PENJUALAN DIRECT - ${formatDateIndo(detailData.tgl_transaksi)}`;
  title1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF065F46' } };
  ws1.getRow(1).height = 28;

  ws1.mergeCells('A2:G2');
  ws1.getCell('A2').value = `Tanggal Transaksi: ${detailData.tgl_transaksi}  | Total Penjualan: Rp ${detailData.summary.total_penjualan_direct.toLocaleString('id-ID')}`;
  ws1.getCell('A2').font = fontSubtitle;

  const h1 = ['No', 'ID Transaksi', 'Nama Customer', 'Akun / Metode', 'Qty (Pcs / Lusin)', 'Total Nota (Rp)', 'Status'];
  const headerRow1 = ws1.getRow(4);
  headerRow1.height = 26;
  h1.forEach((colName, idx) => {
    const cell = headerRow1.getCell(idx + 1);
    cell.value = colName;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 1 || idx === 6 ? 'center' : idx === 4 || idx === 5 ? 'right' : 'left' };
    cell.border = borderThin;
  });

  detailData.penjualan.forEach((item, idx) => {
    const row = ws1.getRow(5 + idx);
    row.height = 20;
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = item.id_transaksi;
    row.getCell(3).value = item.nama_customer;
    row.getCell(4).value = item.akun;
    row.getCell(5).value = `${item.pcs} pcs (${item.lusin.toFixed(2)} lsn)`;
    row.getCell(6).value = item.penerimaan;
    row.getCell(7).value = item.status || 'Draft';

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(6).numFmt = '#,##0';

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.border = borderThin;
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  [6, 20, 30, 16, 20, 20, 14].forEach((w, i) => (ws1.getColumn(i + 1).width = w));

  // Sheet 2: Penerimaan AR / Piutang
  const ws2 = workbook.addWorksheet('Penerimaan AR', { views: [{ showGridLines: true }] });

  ws2.mergeCells('A1:F1');
  const title2 = ws2.getCell('A1');
  title2.value = `RINCIAN PENERIMAAN AR - ${formatDateIndo(detailData.tgl_transaksi)}`;
  title2.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
  ws2.getRow(1).height = 28;

  ws2.mergeCells('A2:F2');
  ws2.getCell('A2').value = `Tanggal Pembayaran: ${detailData.tgl_transaksi}  | Total AR Received: Rp ${detailData.summary.total_ar_received.toLocaleString('id-ID')}`;
  ws2.getCell('A2').font = fontSubtitle;

  const h2 = ['No', 'ID Transaksi / Invoice', 'Nama Customer', 'Metode Pembayaran', 'Nominal Bayar (Rp)', 'Keterangan', 'Inputter'];
  const headerRow2 = ws2.getRow(4);
  headerRow2.height = 26;
  h2.forEach((colName, idx) => {
    const cell = headerRow2.getCell(idx + 1);
    cell.value = colName;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 1 || idx === 3 ? 'center' : idx === 4 ? 'right' : 'left' };
    cell.border = borderThin;
  });

  detailData.penerimaan_ar.forEach((item, idx) => {
    const row = ws2.getRow(5 + idx);
    row.height = 20;
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = item.id_transaksi;
    row.getCell(3).value = item.nama_customer;
    row.getCell(4).value = item.metode;
    row.getCell(5).value = item.nominal;
    row.getCell(6).value = item.keterangan || '-';
    row.getCell(7).value = item.dibuat_oleh || '-';

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };

    row.getCell(5).numFmt = '#,##0';

    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.border = borderThin;
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  [6, 22, 30, 18, 22, 35, 16].forEach((w, i) => (ws2.getColumn(i + 1).width = w));

  await downloadWorkbook(workbook, `Detail_Penerimaan_${detailData.tgl_transaksi}.xlsx`);
}

/**
 * 3. EXPORT REKAP PENGELUARAN HARIAN
 */
export async function exportPengeluaranHarianExcel({
  dailyList,
  summaryData,
  tglFrom,
  tglTo,
}: {
  dailyList: DailyExpenseSummary[];
  summaryData: ExpenseSummaryData;
  tglFrom: string;
  tglTo: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Rekap Pengeluaran Harian', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws.mergeCells('A1:E1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LAPORAN PENGELUARAN HARIAN';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF991B1B' } }; // Dark Rose Red
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:E2');
  const subCell = ws.getCell('A2');
  const periodText =
    tglFrom || tglTo
      ? `Periode: ${tglFrom ? formatDateIndo(tglFrom) : 'Awal'} s/d ${tglTo ? formatDateIndo(tglTo) : 'Sekarang'}`
      : 'Periode: Semua Data';
  subCell.value = `${periodText}  |  Tanggal Export: ${formatNowIndo()}`;
  subCell.font = fontSubtitle;

  ws.addRow([]); // Row 3 empty

  // KPI Summary Card Table (Rows 4-5)
  ws.getCell('A4').value = 'Total Pengeluaran';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFBE123C' } };
  ws.getCell('A5').value = summaryData.total_pengeluaran;
  ws.getCell('A5').numFmt = 'Rp #,##0';
  ws.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF991B1B' } };

  ws.getCell('B4').value = 'Rata-rata Harian';
  ws.getCell('B4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
  ws.getCell('B5').value = summaryData.rata_rata_harian;
  ws.getCell('B5').numFmt = 'Rp #,##0';
  ws.getCell('B5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF78350F' } };

  ws.getCell('C4').value = 'Jumlah Transaksi';
  ws.getCell('C4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF334155' } };
  ws.getCell('C5').value = `${summaryData.total_transaksi} Item`;
  ws.getCell('C5').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };

  ws.mergeCells('D4:E4');
  ws.getCell('D4').value = 'Total Hari Pengeluaran';
  ws.getCell('D4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
  ws.mergeCells('D5:E5');
  ws.getCell('D5').value = `${summaryData.total_hari} Hari`;
  ws.getCell('D5').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF334155' } };

  ['A4', 'B4', 'C4', 'D4', 'E4'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws.addRow([]); // Row 6 empty

  // Table Headers
  const headerRowIndex = 7;
  const headers = ['No', 'Tanggal', 'Kode Tanggal', 'Jumlah Transaksi', 'Total Pengeluaran (Rp)'];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } }; // Rose Red Header
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx === 0 || idx === 2 || idx === 3 ? 'center' : idx === 4 ? 'right' : 'left',
    };
    cell.border = borderThin;
  });

  // Table Data
  let startDataRow = 8;
  dailyList.forEach((item, idx) => {
    const row = ws.getRow(startDataRow + idx);
    row.height = 22;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = formatDateIndo(item.tgl_transaksi);
    row.getCell(3).value = item.tgl_transaksi;
    row.getCell(4).value = Number(item.count_transaksi || 0);
    row.getCell(5).value = Number(item.total_pengeluaran || 0);

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '#,##0';

    const isEven = idx % 2 === 0;
    const rowFillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
      cell.border = borderThin;
    }
  });

  // Table Total Footer Row
  const totalRowIndex = startDataRow + dailyList.length;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'TOTAL PENGELUARAN PERIODE TERPILIH';
  ws.mergeCells(`A${totalRowIndex}:C${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(4).value = summaryData.total_transaksi;
  totalRow.getCell(5).value = summaryData.total_pengeluaran;

  totalRow.getCell(4).numFmt = '#,##0';
  totalRow.getCell(5).numFmt = '#,##0';

  for (let c = 1; c <= 5; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 5 ? 'FFF43F5E' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c === 4) {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (c === 5) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths
  const colWidths = [6, 26, 16, 20, 26];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const periodSlug = tglFrom && tglTo ? `${tglFrom}_sd_${tglTo}` : 'semua_periode';
  await downloadWorkbook(workbook, `Laporan_Pengeluaran_Harian_${periodSlug}.xlsx`);
}

/**
 * 4. EXPORT DETAIL PENGELUARAN DATE MODAL
 */
export async function exportDetailPengeluaranExcel(detailData: DateDetailExpenseData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Detail Pengeluaran', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:F1');
  const title = ws.getCell('A1');
  title.value = `RINCIAN PENGELUARAN - ${formatDateIndo(detailData.tgl_transaksi)}`;
  title.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF991B1B' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:F2');
  ws.getCell('A2').value = `Tanggal: ${detailData.tgl_transaksi}  |  Total Transaksi: ${detailData.count_items} Item  |  Total Out Cash: Rp ${detailData.total_pengeluaran.toLocaleString('id-ID')}`;
  ws.getCell('A2').font = fontSubtitle;

  const headers = ['No', 'Kode Petty', 'Keterangan Pengeluaran', 'Nominal (Rp)', 'Bukti Petty', 'Inputter'];
  const headerRow = ws.getRow(4);
  headerRow.height = 26;

  headers.forEach((colName, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = colName;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 1 ? 'center' : idx === 3 ? 'right' : 'left' };
    cell.border = borderThin;
  });

  detailData.items.forEach((item, idx) => {
    const row = ws.getRow(5 + idx);
    row.height = 20;
    row.getCell(1).value = idx + 1;
    row.getCell(2).value = item.id_petty;
    row.getCell(3).value = item.keterangan;
    row.getCell(4).value = item.out_cash;
    row.getCell(5).value = item.bukti_petty || '-';
    row.getCell(6).value = item.dibuat_oleh || 'admin';

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

    row.getCell(4).numFmt = '#,##0';

    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.border = borderThin;
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  [6, 20, 40, 22, 25, 18].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  await downloadWorkbook(workbook, `Detail_Pengeluaran_${detailData.tgl_transaksi}.xlsx`);
}

/**
 * 5. EXPORT LAPORAN BARANG MASUK
 */
export interface BarangMasukItemDetail {
  no_id: string;
  id_product: string;
  model: string;
  ukuran: string;
  qty: number;
  uom: string;
  harga: number;
  total: number;
}

export interface BarangMasukTransaction {
  id_transaksi: string;
  tgl_transaksi: string;
  id_supplier: string;
  nama_supplier: string;
  keterangan: string;
  id_cabang: string;
  ppn_percent: number;
  ppn_amount: number;
  subtotal: number;
  total_trx: number;
  total_items: number;
  items: BarangMasukItemDetail[];
}

export interface BarangMasukSummary {
  total_transactions: number;
  total_qty: number;
  grand_total: number;
}

export async function exportLaporanBarangMasukExcel({
  transactions,
  summary,
  tglFrom,
  tglTo,
  supplier,
  bahan,
}: {
  transactions: BarangMasukTransaction[];
  summary: BarangMasukSummary;
  tglFrom: string;
  tglTo: string;
  supplier?: string;
  bahan?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Laporan Barang Masuk', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws.mergeCells('A1:O1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LAPORAN BARANG MASUK';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:O2');
  const subCell = ws.getCell('A2');
  const filterParts = [];
  if (tglFrom || tglTo) filterParts.push(`Periode: ${tglFrom ? formatDateIndo(tglFrom) : 'Awal'} s/d ${tglTo ? formatDateIndo(tglTo) : 'Sekarang'}`);
  if (supplier) filterParts.push(`Supplier: ${supplier}`);
  if (bahan) filterParts.push(`Bahan: ${bahan}`);
  filterParts.push(`Tanggal Export: ${formatNowIndo()}`);

  subCell.value = filterParts.join('  |  ');
  subCell.font = fontSubtitle;

  ws.addRow([]); // Row 3 empty

  // KPI Summary Card Table (Rows 4-5)
  ws.mergeCells('A4:C4');
  ws.getCell('A4').value = 'Total Transaksi';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  ws.mergeCells('A5:C5');
  ws.getCell('A5').value = `${summary.total_transactions} Transaksi`;
  ws.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  ws.mergeCells('D4:F4');
  ws.getCell('D4').value = 'Total Qty Barang';
  ws.getCell('D4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
  ws.mergeCells('D5:F5');
  ws.getCell('D5').value = summary.total_qty;
  ws.getCell('D5').numFmt = '#,##0 "Pcs"';
  ws.getCell('D5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF78350F' } };

  ws.mergeCells('G4:I4');
  ws.getCell('G4').value = 'Grand Total Nilai';
  ws.getCell('G4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('G5:I5');
  ws.getCell('G5').value = summary.grand_total;
  ws.getCell('G5').numFmt = 'Rp #,##0';
  ws.getCell('G5').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF064E3B' } };

  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws.addRow([]); // Row 6 empty

  // Table Headers
  const headerRowIndex = 7;
  const headers = [
    'No',
    'Tanggal',
    'ID Transaksi',
    'Supplier',
    'ID Barang',
    'Nama / Model Barang',
    'Ukuran',
    'Qty',
    'UOM',
    'Harga Satuan (Rp)',
    'Total Price (Rp)',
    'Subtotal Trx (Rp)',
    'PPN (Rp)',
    'Grand Total Trx (Rp)',
    'Keterangan',
  ];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Deep Emerald Header
    cell.alignment = {
      vertical: 'middle',
      horizontal:
        idx === 0 || idx === 1 || idx === 2 || idx === 6 || idx === 8
          ? 'center'
          : idx === 7 || (idx >= 9 && idx <= 13)
          ? 'right'
          : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Data Rows
  let startDataRow = 8;
  let itemCounter = 1;

  transactions.forEach((trx, trxIdx) => {
    const trxDateFormatted = formatDateIndo(trx.tgl_transaksi);
    const isEvenTrx = trxIdx % 2 === 0;
    const rowFillColor = isEvenTrx ? 'FFFFFFFF' : 'FFF8FAFC';

    trx.items.forEach((item) => {
      const row = ws.getRow(startDataRow);
      row.height = 20;

      row.getCell(1).value = itemCounter++;
      row.getCell(2).value = trxDateFormatted;
      row.getCell(3).value = trx.id_transaksi;
      row.getCell(4).value = trx.nama_supplier || '-';
      row.getCell(5).value = item.id_product;
      row.getCell(6).value = item.model || item.id_product;
      row.getCell(7).value = item.ukuran || '-';
      row.getCell(8).value = Number(item.qty || 0);
      row.getCell(9).value = String(item.uom || 'PCS').toUpperCase();
      row.getCell(10).value = Number(item.harga || 0);
      row.getCell(11).value = Number(item.total || 0);
      row.getCell(12).value = Number(trx.subtotal || 0);
      row.getCell(13).value = Number(trx.ppn_amount || 0);
      row.getCell(14).value = Number(trx.total_trx || 0);
      row.getCell(15).value = trx.keterangan || '-';

      // Alignments
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(15).alignment = { vertical: 'middle', horizontal: 'left' };

      // Number Formats
      row.getCell(8).numFmt = '#,##0';
      row.getCell(10).numFmt = '#,##0';
      row.getCell(11).numFmt = '#,##0';
      row.getCell(12).numFmt = '#,##0';
      row.getCell(13).numFmt = '#,##0';
      row.getCell(14).numFmt = '#,##0';

      for (let c = 1; c <= 15; c++) {
        const cell = row.getCell(c);
        cell.font = fontCell;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
        cell.border = borderThin;
      }

      startDataRow++;
    });
  });

  // Table Total Footer Row
  const totalRowIndex = startDataRow;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'GRAND TOTAL LAPORAN BARANG MASUK';
  ws.mergeCells(`A${totalRowIndex}:G${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(8).value = summary.total_qty;
  totalRow.getCell(8).numFmt = '#,##0';

  totalRow.getCell(14).value = summary.grand_total;
  totalRow.getCell(14).numFmt = '#,##0';

  totalRow.getCell(15).value = `Total ${summary.total_transactions} Trx`;

  for (let c = 1; c <= 15; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 14 ? 'FFF59E0B' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c === 8 || (c >= 10 && c <= 14)) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths
  const colWidths = [6, 16, 20, 26, 16, 30, 12, 10, 10, 18, 18, 18, 16, 20, 25];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const periodSlug = tglFrom && tglTo ? `${tglFrom}_sd_${tglTo}` : 'semua_periode';
  await downloadWorkbook(workbook, `Laporan_Barang_Masuk_${periodSlug}.xlsx`);
}

/**
 * 6. EXPORT REKAPITULASI PENJUALAN
 */
export interface RekapPenjualanItem {
  tgl_transaksi: string;
  tgl_jatuh_tempo: string;
  id_transaksi: string;
  id_customer: string;
  nama_customer: string;
  lusin: number;
  subtotal: number;
  diskon: number;
  total: number;
  status: string;
  akun: string;
}

export interface RekapPenjualanSummary {
  total_transactions: number;
  grand_total: number;
  grand_diskon: number;
  grand_lusin: number;
}

export async function exportRekapitulasiPenjualanExcel({
  transactions,
  summary,
  tglFrom,
  tglTo,
  customer,
}: {
  transactions: RekapPenjualanItem[];
  summary: RekapPenjualanSummary;
  tglFrom: string;
  tglTo: string;
  customer?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Rekapitulasi Penjualan', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LAPORAN REKAPITULASI PENJUALAN';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:L2');
  const subCell = ws.getCell('A2');
  const filterParts = [];
  if (tglFrom || tglTo) filterParts.push(`Periode: ${tglFrom ? formatDateIndo(tglFrom) : 'Awal'} s/d ${tglTo ? formatDateIndo(tglTo) : 'Sekarang'}`);
  if (customer) filterParts.push(`Customer: ${customer}`);
  filterParts.push(`Tanggal Export: ${formatNowIndo()}`);

  subCell.value = filterParts.join('  |  ');
  subCell.font = fontSubtitle;

  ws.addRow([]); // Row 3 empty

  // KPI Summary Card Table (Rows 4-5)
  ws.mergeCells('A4:C4');
  ws.getCell('A4').value = 'Total Transaksi';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  ws.mergeCells('A5:C5');
  ws.getCell('A5').value = `${summary.total_transactions} Trx`;
  ws.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  ws.mergeCells('D4:F4');
  ws.getCell('D4').value = 'Total Volume Lusin';
  ws.getCell('D4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
  ws.mergeCells('D5:F5');
  ws.getCell('D5').value = summary.grand_lusin;
  ws.getCell('D5').numFmt = '#,##0.00 "Lsn"';
  ws.getCell('D5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF78350F' } };

  ws.mergeCells('G4:I4');
  ws.getCell('G4').value = 'Total Diskon Invoice';
  ws.getCell('G4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF7C3AED' } };
  ws.mergeCells('G5:I5');
  ws.getCell('G5').value = summary.grand_diskon;
  ws.getCell('G5').numFmt = 'Rp #,##0';
  ws.getCell('G5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF5B21B6' } };

  ws.mergeCells('J4:L4');
  ws.getCell('J4').value = 'Grand Total Penjualan';
  ws.getCell('J4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('J5:L5');
  ws.getCell('J5').value = summary.grand_total;
  ws.getCell('J5').numFmt = 'Rp #,##0';
  ws.getCell('J5').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF064E3B' } };

  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4', 'L4'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5', 'J5', 'K5', 'L5'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws.addRow([]); // Row 6 empty

  // Table Headers
  const headerRowIndex = 7;
  const headers = [
    'No',
    'Tanggal',
    'Jatuh Tempo',
    'No. Transaksi',
    'ID Customer',
    'Nama Customer',
    'Akun / Metode',
    'Volume (Lusin)',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Total Penjualan (Rp)',
    'Status Tagihan',
  ];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal:
        idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 4 || idx === 11
          ? 'center'
          : idx >= 7 && idx <= 10
          ? 'right'
          : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Data Rows
  let startDataRow = 8;
  transactions.forEach((item, idx) => {
    const row = ws.getRow(startDataRow + idx);
    row.height = 20;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = formatDateIndo(item.tgl_transaksi);
    row.getCell(3).value = formatDateIndo(item.tgl_jatuh_tempo);
    row.getCell(4).value = item.id_transaksi;
    row.getCell(5).value = item.id_customer || '-';
    row.getCell(6).value = item.nama_customer || '-';
    row.getCell(7).value = item.akun || 'CASH';
    row.getCell(8).value = Number(item.lusin || 0);
    row.getCell(9).value = Number(item.subtotal || 0);
    row.getCell(10).value = Number(item.diskon || 0);
    row.getCell(11).value = Number(item.total || 0);
    row.getCell(12).value = item.status || 'Draft';

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(8).numFmt = '#,##0.00';
    row.getCell(9).numFmt = '#,##0';
    row.getCell(10).numFmt = '#,##0';
    row.getCell(11).numFmt = '#,##0';

    const isEven = idx % 2 === 0;
    const rowFillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
      cell.border = borderThin;
    }
  });

  // Table Total Footer Row
  const totalRowIndex = startDataRow + transactions.length;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'GRAND TOTAL REKAPITULASI PENJUALAN';
  ws.mergeCells(`A${totalRowIndex}:G${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(8).value = summary.grand_lusin;
  totalRow.getCell(8).numFmt = '#,##0.00';

  totalRow.getCell(9).value = transactions.reduce((sum, item) => sum + item.subtotal, 0);
  totalRow.getCell(9).numFmt = '#,##0';

  totalRow.getCell(10).value = summary.grand_diskon;
  totalRow.getCell(10).numFmt = '#,##0';

  totalRow.getCell(11).value = summary.grand_total;
  totalRow.getCell(11).numFmt = '#,##0';

  totalRow.getCell(12).value = `Total ${summary.total_transactions} Trx`;

  for (let c = 1; c <= 12; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 11 ? 'FFF59E0B' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c >= 8 && c <= 11) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths
  const colWidths = [6, 16, 16, 20, 16, 28, 16, 16, 18, 16, 22, 16];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const periodSlug = tglFrom && tglTo ? `${tglFrom}_sd_${tglTo}` : 'semua_periode';
  await downloadWorkbook(workbook, `Laporan_Rekapitulasi_Penjualan_${periodSlug}.xlsx`);
}

/**
 * 7. EXPORT STOCK DETAIL
 */
export interface StockDetailExportItem {
  id: string;
  id_transaksi_stock: string;
  tgl_masuk: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  stock: number;
  uom: string;
  harga_lusin: number;
  harga_pcs: number;
  subtotal_nilai: number;
  barcode: string;
}

export interface StockDetailExportGroup {
  id_bahan: string;
  nama_tipe: string;
  total_stock_pcs: number;
  total_items: number;
  total_nilai_stok: number;
  items: StockDetailExportItem[];
}

export interface StockDetailExportSummary {
  total_tipe: number;
  total_items: number;
  total_stock_pcs: number;
  total_nilai_stok: number;
}

export async function exportStockDetailExcel({
  groups,
  summary,
  tipe,
  model,
  ukuran,
}: {
  groups: StockDetailExportGroup[];
  summary: StockDetailExportSummary;
  tipe?: string;
  model?: string;
  ukuran?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Stock Detail', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws.mergeCells('A1:L1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LAPORAN STOCK DETAIL';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:L2');
  const subCell = ws.getCell('A2');
  const filterParts = [];
  filterParts.push(`Tipe/Bahan: ${tipe || 'Semua Tipe'}`);
  if (model) filterParts.push(`Model: ${model}`);
  if (ukuran) filterParts.push(`Ukuran: ${ukuran}`);
  filterParts.push(`Tanggal Export: ${formatNowIndo()}`);

  subCell.value = filterParts.join('  |  ');
  subCell.font = fontSubtitle;

  ws.addRow([]); // Row 3 empty

  // KPI Summary Card Table (Rows 4-5)
  ws.mergeCells('A4:C4');
  ws.getCell('A4').value = 'Total Tipe / Bahan';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  ws.mergeCells('A5:C5');
  ws.getCell('A5').value = `${summary.total_tipe} Tipe`;
  ws.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  ws.mergeCells('D4:F4');
  ws.getCell('D4').value = 'Total Baris Item';
  ws.getCell('D4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };
  ws.mergeCells('D5:F5');
  ws.getCell('D5').value = summary.total_items;
  ws.getCell('D5').numFmt = '#,##0 "Item"';
  ws.getCell('D5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF334155' } };

  ws.mergeCells('G4:I4');
  ws.getCell('G4').value = 'Total Qty Stock';
  ws.getCell('G4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('G5:I5');
  ws.getCell('G5').value = summary.total_stock_pcs;
  ws.getCell('G5').numFmt = '#,##0 "PCS"';
  ws.getCell('G5').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF064E3B' } };

  ws.mergeCells('J4:L4');
  ws.getCell('J4').value = 'Estimasi Nilai Stok';
  ws.getCell('J4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
  ws.mergeCells('J5:L5');
  ws.getCell('J5').value = summary.total_nilai_stok;
  ws.getCell('J5').numFmt = 'Rp #,##0';
  ws.getCell('J5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF78350F' } };

  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4', 'L4'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5', 'J5', 'K5', 'L5'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws.addRow([]); // Row 6 empty

  // Table Headers
  const headerRowIndex = 7;
  const headers = [
    'No',
    'Tipe / Bahan',
    'Model Barang',
    'Ukuran',
    'Tanggal Masuk',
    'No. Transaksi Stock',
    'Qty Stock (PCS)',
    'UOM',
    'Harga / Lusin (Rp)',
    'Harga / PCS (Rp)',
    'Subtotal Nilai (Rp)',
    'Barcode',
  ];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal:
        idx === 0 || idx === 3 || idx === 4 || idx === 5 || idx === 6 || idx === 7 || idx === 11
          ? 'center'
          : idx >= 8 && idx <= 10
          ? 'right'
          : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Data Rows
  let startDataRow = 8;
  let itemCounter = 1;

  groups.forEach((group, groupIdx) => {
    const isEvenGroup = groupIdx % 2 === 0;
    const rowFillColor = isEvenGroup ? 'FFFFFFFF' : 'FFF8FAFC';

    group.items.forEach((item) => {
      const row = ws.getRow(startDataRow);
      row.height = 20;

      row.getCell(1).value = itemCounter++;
      row.getCell(2).value = group.nama_tipe;
      row.getCell(3).value = item.model || '-';
      row.getCell(4).value = item.ukuran || '-';
      row.getCell(5).value = formatDateIndo(item.tgl_masuk);
      row.getCell(6).value = item.id_transaksi_stock || '-';
      row.getCell(7).value = Number(item.stock || 0);
      row.getCell(8).value = String(item.uom || 'PCS').toUpperCase();
      row.getCell(9).value = Number(item.harga_lusin || 0);
      row.getCell(10).value = Number(item.harga_pcs || 0);
      row.getCell(11).value = Number(item.subtotal_nilai || 0);
      row.getCell(12).value = item.barcode || '-';

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };

      row.getCell(7).numFmt = '#,##0';
      row.getCell(9).numFmt = '#,##0';
      row.getCell(10).numFmt = '#,##0';
      row.getCell(11).numFmt = '#,##0';

      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.font = fontCell;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
        cell.border = borderThin;
      }

      startDataRow++;
    });
  });

  // Table Total Footer Row
  const totalRowIndex = startDataRow;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'GRAND TOTAL STOCK DETAIL';
  ws.mergeCells(`A${totalRowIndex}:F${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(7).value = summary.total_stock_pcs;
  totalRow.getCell(7).numFmt = '#,##0';

  totalRow.getCell(11).value = summary.total_nilai_stok;
  totalRow.getCell(11).numFmt = '#,##0';

  totalRow.getCell(12).value = `Total ${summary.total_tipe} Tipe`;

  for (let c = 1; c <= 12; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 11 ? 'FFF59E0B' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c === 7 || (c >= 9 && c <= 11)) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths
  const colWidths = [6, 26, 26, 12, 16, 22, 16, 10, 18, 18, 22, 18];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const filterSlug = tipe ? `_tipe_${tipe}` : '';
  await downloadWorkbook(workbook, `Stock_Detail${filterSlug}.xlsx`);
}

/**
 * 8. EXPORT LAPORAN RETUR
 */
export interface ReturExportItemDetail {
  no_id: string;
  id_bahan: string;
  model: string;
  ukuran: string;
  nama_barang: string;
  qty: number;
  uom: string;
  harga: number;
  total: number;
}

export interface ReturExportTransaction {
  id_transaksi: string;
  tgl_transaksi: string;
  id_customer: string;
  nama_customer: string;
  is_retur_gudang: boolean;
  subtotal: number;
  ppn_percent: number;
  ppn_amount: number;
  total: number;
  item_count: number;
  items: ReturExportItemDetail[];
}

export interface ReturExportSummary {
  total_transaksi: number;
  total_qty: number;
  total_retur_customer: number;
  total_retur_gudang: number;
  grand_total_retur: number;
}

export async function exportLaporanReturExcel({
  transactions,
  summary,
  tglFrom,
  tglTo,
  customer,
  bahan,
}: {
  transactions: ReturExportTransaction[];
  summary: ReturExportSummary;
  tglFrom?: string;
  tglTo?: string;
  customer?: string;
  bahan?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Laporan Retur', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws.mergeCells('A1:O1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LAPORAN RETUR';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:O2');
  const subCell = ws.getCell('A2');
  const filterParts = [];
  if (tglFrom || tglTo) filterParts.push(`Periode: ${tglFrom ? formatDateIndo(tglFrom) : 'Awal'} s/d ${tglTo ? formatDateIndo(tglTo) : 'Sekarang'}`);
  if (customer) filterParts.push(`Customer: ${customer}`);
  if (bahan) filterParts.push(`Bahan/Tipe: ${bahan}`);
  filterParts.push(`Tanggal Export: ${formatNowIndo()}`);

  subCell.value = filterParts.join('  |  ');
  subCell.font = fontSubtitle;

  ws.addRow([]); // Row 3 empty

  // KPI Summary Card Table (Rows 4-5)
  ws.mergeCells('A4:C4');
  ws.getCell('A4').value = 'Total Transaksi Retur';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  ws.mergeCells('A5:C5');
  ws.getCell('A5').value = `${summary.total_transaksi} Nota`;
  ws.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  ws.mergeCells('D4:F4');
  ws.getCell('D4').value = 'Total Qty Retur';
  ws.getCell('D4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('D5:F5');
  ws.getCell('D5').value = summary.total_qty;
  ws.getCell('D5').numFmt = '#,##0 "PCS"';
  ws.getCell('D5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF064E3B' } };

  ws.mergeCells('G4:I4');
  ws.getCell('G4').value = 'Retur Customer';
  ws.getCell('G4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('G5:I5');
  ws.getCell('G5').value = summary.total_retur_customer;
  ws.getCell('G5').numFmt = 'Rp #,##0';
  ws.getCell('G5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF064E3B' } };

  ws.mergeCells('J4:L4');
  ws.getCell('J4').value = 'Retur Gudang';
  ws.getCell('J4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFB45309' } };
  ws.mergeCells('J5:L5');
  ws.getCell('J5').value = summary.total_retur_gudang;
  ws.getCell('J5').numFmt = 'Rp #,##0';
  ws.getCell('J5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF78350F' } };

  ws.mergeCells('M4:O4');
  ws.getCell('M4').value = 'Grand Total Retur';
  ws.getCell('M4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0F172A' } };
  ws.mergeCells('M5:O5');
  ws.getCell('M5').value = summary.grand_total_retur;
  ws.getCell('M5').numFmt = 'Rp #,##0';
  ws.getCell('M5').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF0F172A' } };

  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4', 'L4', 'M4', 'N4', 'O4'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5', 'J5', 'K5', 'L5', 'M5', 'N5', 'O5'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws.addRow([]); // Row 6 empty

  // Table Headers
  const headerRowIndex = 7;
  const headers = [
    'No',
    'Tanggal Retur',
    'No. Transaksi Retur',
    'Tipe Retur',
    'Customer',
    'Bahan / Tipe',
    'Model Barang',
    'Ukuran',
    'Qty Retur',
    'UOM',
    'Harga Satuan (Rp)',
    'Total Item (Rp)',
    'Subtotal Trx (Rp)',
    'PPN (Rp)',
    'Grand Total Trx (Rp)',
  ];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal:
        idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 7 || idx === 9
          ? 'center'
          : idx === 8 || (idx >= 10 && idx <= 14)
          ? 'right'
          : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Data Rows
  let startDataRow = 8;
  let itemCounter = 1;

  transactions.forEach((trx, trxIdx) => {
    const isEvenTrx = trxIdx % 2 === 0;
    const rowFillColor = isEvenTrx ? 'FFFFFFFF' : 'FFF8FAFC';
    const tipeRetur = trx.is_retur_gudang ? 'RETUR GUDANG' : 'RETUR CUSTOMER';

    trx.items.forEach((item) => {
      const row = ws.getRow(startDataRow);
      row.height = 20;

      row.getCell(1).value = itemCounter++;
      row.getCell(2).value = formatDateIndo(trx.tgl_transaksi);
      row.getCell(3).value = trx.id_transaksi;
      row.getCell(4).value = tipeRetur;
      row.getCell(5).value = trx.nama_customer || trx.id_customer || '-';
      row.getCell(6).value = item.id_bahan || '-';
      row.getCell(7).value = item.model || '-';
      row.getCell(8).value = item.ukuran || '-';
      row.getCell(9).value = Number(item.qty || 0);
      row.getCell(10).value = String(item.uom || 'PCS').toUpperCase();
      row.getCell(11).value = Number(item.harga || 0);
      row.getCell(12).value = Number(item.total || 0);
      row.getCell(13).value = Number(trx.subtotal || 0);
      row.getCell(14).value = Number(trx.ppn_amount || 0);
      row.getCell(15).value = Number(trx.total || 0);

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };

      row.getCell(9).numFmt = '#,##0';
      row.getCell(11).numFmt = '#,##0';
      row.getCell(12).numFmt = '#,##0';
      row.getCell(13).numFmt = '#,##0';
      row.getCell(14).numFmt = '#,##0';
      row.getCell(15).numFmt = '#,##0';

      for (let c = 1; c <= 15; c++) {
        const cell = row.getCell(c);
        cell.font = fontCell;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
        cell.border = borderThin;
      }

      startDataRow++;
    });
  });

  // Table Total Footer Row
  const totalRowIndex = startDataRow;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'GRAND TOTAL LAPORAN RETUR';
  ws.mergeCells(`A${totalRowIndex}:H${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(9).value = summary.total_qty;
  totalRow.getCell(9).numFmt = '#,##0';

  totalRow.getCell(15).value = summary.grand_total_retur;
  totalRow.getCell(15).numFmt = '#,##0';

  for (let c = 1; c <= 15; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 15 ? 'FFF59E0B' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c === 9 || (c >= 11 && c <= 15)) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths
  const colWidths = [6, 16, 20, 18, 26, 20, 26, 12, 12, 10, 18, 18, 18, 16, 22];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const periodSlug = tglFrom && tglTo ? `${tglFrom}_sd_${tglTo}` : 'semua_periode';
  await downloadWorkbook(workbook, `Laporan_Retur_${periodSlug}.xlsx`);
}

/**
 * 9. EXPORT REKAPITULASI RETUR
 */
export interface ReturRekapItemExport {
  id_transaksi: string;
  tgl_transaksi: string;
  tgl_jatuh_tempo: string;
  id_customer: string;
  nama_customer: string;
  lusin: number;
  subtotal: number;
  diskon: number;
  total: number;
  status: string;
}

export interface ReturRekapSummaryExport {
  total_transaksi: number;
  grand_lusin: number;
  grand_subtotal: number;
  grand_diskon: number;
  grand_total: number;
}

export async function exportBarangReturRekapExcel({
  items,
  summary,
  tglFrom,
  tglTo,
  customer,
}: {
  items: ReturRekapItemExport[];
  summary: ReturRekapSummaryExport;
  tglFrom?: string;
  tglTo?: string;
  customer?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Rekapitulasi Retur', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws.mergeCells('A1:K1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'LAPORAN REKAPITULASI RETUR';
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 30;

  ws.mergeCells('A2:K2');
  const subCell = ws.getCell('A2');
  const filterParts = [];
  if (tglFrom || tglTo) filterParts.push(`Periode: ${tglFrom ? formatDateIndo(tglFrom) : 'Awal'} s/d ${tglTo ? formatDateIndo(tglTo) : 'Sekarang'}`);
  if (customer) filterParts.push(`Customer: ${customer}`);
  filterParts.push(`Tanggal Export: ${formatNowIndo()}`);

  subCell.value = filterParts.join('  |  ');
  subCell.font = fontSubtitle;

  ws.addRow([]); // Row 3 empty

  // KPI Summary Card Table (Rows 4-5)
  ws.mergeCells('A4:B4');
  ws.getCell('A4').value = 'Jumlah Nota';
  ws.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  ws.mergeCells('A5:B5');
  ws.getCell('A5').value = `${summary.total_transaksi} Nota`;
  ws.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  ws.mergeCells('C4:D4');
  ws.getCell('C4').value = 'Grand Lusin';
  ws.getCell('C4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('C5:D5');
  ws.getCell('C5').value = summary.grand_lusin;
  ws.getCell('C5').numFmt = '#,##0.00 "Lsn"';
  ws.getCell('C5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF064E3B' } };

  ws.mergeCells('E4:F4');
  ws.getCell('E4').value = 'Grand Subtotal';
  ws.getCell('E4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF334155' } };
  ws.mergeCells('E5:F5');
  ws.getCell('E5').value = summary.grand_subtotal;
  ws.getCell('E5').numFmt = 'Rp #,##0';
  ws.getCell('E5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF0F172A' } };

  ws.mergeCells('G4:H4');
  ws.getCell('G4').value = 'Grand Diskon';
  ws.getCell('G4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFBE123C' } };
  ws.mergeCells('G5:H5');
  ws.getCell('G5').value = summary.grand_diskon;
  ws.getCell('G5').numFmt = 'Rp #,##0';
  ws.getCell('G5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF991B1B' } };

  ws.mergeCells('I4:K4');
  ws.getCell('I4').value = 'Grand Total Retur';
  ws.getCell('I4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws.mergeCells('I5:K5');
  ws.getCell('I5').value = summary.grand_total;
  ws.getCell('I5').numFmt = 'Rp #,##0';
  ws.getCell('I5').font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF064E3B' } };

  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5', 'J5', 'K5'].forEach((cellKey) => {
    ws.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws.addRow([]); // Row 6 empty

  // Table Headers
  const headerRowIndex = 7;
  const headers = [
    'No',
    'Tanggal Retur',
    'Tagihan / Jatuh Tempo',
    'No. Transaksi',
    'ID Customer',
    'Nama Customer',
    'Volume (Lusin)',
    'Subtotal (Rp)',
    'Diskon (Rp)',
    'Total Retur (Rp)',
    'Status Tagihan',
  ];

  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 28;

  headers.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal:
        idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 4 || idx === 10
          ? 'center'
          : idx >= 6 && idx <= 9
          ? 'right'
          : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Data Rows
  let startDataRow = 8;
  items.forEach((item, idx) => {
    const row = ws.getRow(startDataRow + idx);
    row.height = 20;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = formatDateIndo(item.tgl_transaksi);
    row.getCell(3).value = formatDateIndo(item.tgl_jatuh_tempo);
    row.getCell(4).value = item.id_transaksi;
    row.getCell(5).value = item.id_customer || '-';
    row.getCell(6).value = item.nama_customer || '-';
    row.getCell(7).value = Number(item.lusin || 0);
    row.getCell(8).value = Number(item.subtotal || 0);
    row.getCell(9).value = Number(item.diskon || 0);
    row.getCell(10).value = Number(item.total || 0);
    row.getCell(11).value = item.status || 'Draft';

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(7).numFmt = '#,##0.00';
    row.getCell(8).numFmt = '#,##0';
    row.getCell(9).numFmt = '#,##0';
    row.getCell(10).numFmt = '#,##0';

    const isEven = idx % 2 === 0;
    const rowFillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
      cell.border = borderThin;
    }
  });

  // Table Total Footer Row
  const totalRowIndex = startDataRow + items.length;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'GRAND TOTAL REKAPITULASI RETUR';
  ws.mergeCells(`A${totalRowIndex}:F${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(7).value = summary.grand_lusin;
  totalRow.getCell(7).numFmt = '#,##0.00';

  totalRow.getCell(8).value = summary.grand_subtotal;
  totalRow.getCell(8).numFmt = '#,##0';

  totalRow.getCell(9).value = summary.grand_diskon;
  totalRow.getCell(9).numFmt = '#,##0';

  totalRow.getCell(10).value = summary.grand_total;
  totalRow.getCell(10).numFmt = '#,##0';

  totalRow.getCell(11).value = `Total ${summary.total_transaksi} Nota`;

  for (let c = 1; c <= 11; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 10 ? 'FFF59E0B' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c >= 7 && c <= 10) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths
  const colWidths = [6, 16, 16, 20, 16, 28, 16, 18, 16, 22, 16];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const periodSlug = tglFrom && tglTo ? `${tglFrom}_sd_${tglTo}` : 'semua_periode';
  await downloadWorkbook(workbook, `Rekapitulasi_Retur_${periodSlug}.xlsx`);
}

/**
 * 10. EXPORT INVENTORY LIST & DETAIL PERGERAKAN STOCK
 */
export interface InventoryListExportMovement {
  id_transaksi: string;
  tgl_transaksi: string;
  tipe_trx: 'BARANG_MASUK' | 'BARANG_KELUAR' | 'RETUR_BARANG' | 'MOVE_LOCATION' | 'TRANSFER_STOCK' | string;
  qty_masuk: number;
  qty_keluar: number;
  qty_retur: number;
  qty_move: number;
  keterangan: string;
}

export interface InventoryListExportItem {
  id_bahan: string;
  model: string;
  ukuran: string;
  uom: string;
  nama_stock: string;
  sisa_stock: number;
  total_masuk: number;
  total_keluar: number;
  total_retur: number;
  total_move: number;
  stok_utama?: number;
  total_di_lokasi_lain?: number;
  locations?: {
    id_location: number;
    nama_lokasi: string;
    qty: number;
    updated_at?: string;
  }[];
  total_pergerakan: number;
  movements: InventoryListExportMovement[];
}

export interface InventoryListExportSummary {
  total_items: number;
  total_sisa_stock: number;
  total_masuk: number;
  total_keluar: number;
  total_retur: number;
  total_move: number;
}

export async function exportInventoryListExcel({
  items,
  summary,
  tglFrom,
  tglTo,
  tipe,
  model,
  ukuran,
  lokasi,
  cabang,
}: {
  items: InventoryListExportItem[];
  summary: InventoryListExportSummary;
  tglFrom?: string;
  tglTo?: string;
  tipe?: string;
  model?: string;
  ukuran?: string;
  lokasi?: string;
  cabang?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  // ----------------------------------------------------
  // Sheet 1: Rekap Inventory List (Ringkasan Stock)
  // ----------------------------------------------------
  const ws1 = workbook.addWorksheet('Rekap Inventory List', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws1.mergeCells('A1:L1');
  const titleCell1 = ws1.getCell('A1');
  titleCell1.value = 'LAPORAN INVENTORY LIST & REKAP STOCK';
  titleCell1.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell1.alignment = { vertical: 'middle', horizontal: 'left' };
  ws1.getRow(1).height = 30;

  ws1.mergeCells('A2:L2');
  const subCell1 = ws1.getCell('A2');
  const filterParts = [];
  if (cabang && cabang !== 'ALL') filterParts.push(`Cabang: ${cabang}`);
  if (lokasi && lokasi !== 'ALL') filterParts.push(`Lokasi: ${lokasi === 'MAIN_INVENTORY' ? 'Gudang Utama' : lokasi}`);
  if (tglFrom || tglTo) filterParts.push(`Periode Pergerakan: ${tglFrom ? formatDateIndo(tglFrom) : 'Awal'} s/d ${tglTo ? formatDateIndo(tglTo) : 'Sekarang'}`);
  if (tipe) filterParts.push(`Tipe/Bahan: ${tipe}`);
  if (model) filterParts.push(`Model: ${model}`);
  if (ukuran) filterParts.push(`Ukuran: ${ukuran}`);
  filterParts.push(`Tanggal Export: ${formatNowIndo()}`);

  subCell1.value = filterParts.join('  |  ');
  subCell1.font = fontSubtitle;

  ws1.addRow([]); // Row 3 empty

  // KPI Summary Cards (Rows 4-5)
  ws1.mergeCells('A4:B4');
  ws1.getCell('A4').value = 'Total Jenis Barang';
  ws1.getCell('A4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1D4ED8' } };
  ws1.mergeCells('A5:B5');
  ws1.getCell('A5').value = `${summary.total_items} Item`;
  ws1.getCell('A5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  ws1.mergeCells('C4:D4');
  ws1.getCell('C4').value = 'Total Sisa Stock';
  ws1.getCell('C4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF047857' } };
  ws1.mergeCells('C5:D5');
  ws1.getCell('C5').value = summary.total_sisa_stock;
  ws1.getCell('C5').numFmt = '#,##0';
  ws1.getCell('C5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF064E3B' } };

  ws1.mergeCells('E4:F4');
  ws1.getCell('E4').value = 'Pergerakan Masuk';
  ws1.getCell('E4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF0D9488' } };
  ws1.mergeCells('E5:F5');
  ws1.getCell('E5').value = summary.total_masuk;
  ws1.getCell('E5').numFmt = '#,##0';
  ws1.getCell('E5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF115E59' } };

  ws1.mergeCells('G4:H4');
  ws1.getCell('G4').value = 'Pergerakan Keluar';
  ws1.getCell('G4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFD97706' } };
  ws1.mergeCells('G5:H5');
  ws1.getCell('G5').value = summary.total_keluar;
  ws1.getCell('G5').numFmt = '#,##0';
  ws1.getCell('G5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF92400E' } };

  ws1.mergeCells('I4:J4');
  ws1.getCell('I4').value = 'Total Retur Barang';
  ws1.getCell('I4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF7C3AED' } };
  ws1.mergeCells('I5:J5');
  ws1.getCell('I5').value = summary.total_retur;
  ws1.getCell('I5').numFmt = '#,##0';
  ws1.getCell('I5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF5B21B6' } };

  ws1.mergeCells('K4:L4');
  ws1.getCell('K4').value = 'Move Location';
  ws1.getCell('K4').font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF4338CA' } };
  ws1.mergeCells('K5:L5');
  ws1.getCell('K5').value = summary.total_move || 0;
  ws1.getCell('K5').numFmt = '#,##0';
  ws1.getCell('K5').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF3730A3' } };

  ['A4', 'B4', 'C4', 'D4', 'E4', 'F4', 'G4', 'H4', 'I4', 'J4', 'K4', 'L4'].forEach((cellKey) => {
    ws1.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  });
  ['A5', 'B5', 'C5', 'D5', 'E5', 'F5', 'G5', 'H5', 'I5', 'J5', 'K5', 'L5'].forEach((cellKey) => {
    ws1.getCell(cellKey).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  });

  ws1.addRow([]); // Row 6 empty

  // Table 1 Headers
  const headerRowIndex1 = 7;
  const headers1 = [
    'No',
    'Nama Stock',
    'Tipe / Bahan',
    'Model',
    'Ukuran',
    'Satuan (UOM)',
    'Sisa Stock',
    'Qty Masuk',
    'Qty Keluar',
    'Qty Retur',
    'Qty Move',
    'Total Pergerakan',
  ];

  const headerRow1 = ws1.getRow(headerRowIndex1);
  headerRow1.height = 28;

  headers1.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow1.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx === 0 || idx === 2 || idx === 3 || idx === 4 || idx === 5 ? 'center' : idx >= 6 && idx <= 11 ? 'right' : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Table 1 Data Rows
  let startDataRow1 = 8;
  items.forEach((item, idx) => {
    const row = ws1.getRow(startDataRow1 + idx);
    row.height = 20;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = item.nama_stock;
    row.getCell(3).value = item.id_bahan || '-';
    row.getCell(4).value = item.model || '-';
    row.getCell(5).value = item.ukuran || '-';
    row.getCell(6).value = item.uom || 'PCS';
    row.getCell(7).value = Number(item.sisa_stock || 0);
    row.getCell(8).value = Number(item.total_masuk || 0);
    row.getCell(9).value = Number(item.total_keluar || 0);
    row.getCell(10).value = Number(item.total_retur || 0);
    row.getCell(11).value = Number(item.total_move || 0);
    row.getCell(12).value = Number(item.total_pergerakan || 0);

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(7).numFmt = '#,##0';
    row.getCell(8).numFmt = '#,##0';
    row.getCell(9).numFmt = '#,##0';
    row.getCell(10).numFmt = '#,##0';
    row.getCell(11).numFmt = '#,##0';
    row.getCell(12).numFmt = '#,##0';

    const isEven = idx % 2 === 0;
    const rowFillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
      cell.border = borderThin;
    }
  });

  // Table 1 Total Footer Row
  const totalRowIndex1 = startDataRow1 + items.length;
  const totalRow1 = ws1.getRow(totalRowIndex1);
  totalRow1.height = 26;

  totalRow1.getCell(1).value = 'TOTAL RINGKASAN INVENTORY';
  ws1.mergeCells(`A${totalRowIndex1}:F${totalRowIndex1}`);
  totalRow1.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow1.getCell(7).value = summary.total_sisa_stock;
  totalRow1.getCell(7).numFmt = '#,##0';
  totalRow1.getCell(8).value = summary.total_masuk;
  totalRow1.getCell(8).numFmt = '#,##0';
  totalRow1.getCell(9).value = summary.total_keluar;
  totalRow1.getCell(9).numFmt = '#,##0';
  totalRow1.getCell(10).value = summary.total_retur;
  totalRow1.getCell(10).numFmt = '#,##0';
  totalRow1.getCell(11).value = summary.total_move || 0;
  totalRow1.getCell(11).numFmt = '#,##0';
  totalRow1.getCell(12).value = items.reduce((acc, i) => acc + (i.total_pergerakan || 0), 0);
  totalRow1.getCell(12).numFmt = '#,##0';

  for (let c = 1; c <= 12; c++) {
    const cell = totalRow1.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: c === 7 ? 'FFF59E0B' : 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c >= 7 && c <= 12) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths for Sheet 1
  const colWidths1 = [6, 26, 16, 16, 14, 14, 16, 16, 16, 16, 16, 18];
  colWidths1.forEach((w, i) => {
    ws1.getColumn(i + 1).width = w;
  });

  // ----------------------------------------------------
  // Sheet 2: Detail Pergerakan Stock (Masuk, Keluar, Retur, Move Location, Transfer Stock)
  // ----------------------------------------------------
  const ws2 = workbook.addWorksheet('Detail Pergerakan Stock', {
    views: [{ showGridLines: true }],
  });

  // Title Block
  ws2.mergeCells('A1:M1');
  const titleCell2 = ws2.getCell('A1');
  titleCell2.value = 'LAPORAN DETAIL PERGERAKAN STOCK (MASUK, KELUAR, RETUR, MOVE LOKASI & TRANSFER STOCK)';
  titleCell2.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF065F46' } };
  titleCell2.alignment = { vertical: 'middle', horizontal: 'left' };
  ws2.getRow(1).height = 30;

  ws2.mergeCells('A2:M2');
  const subCell2 = ws2.getCell('A2');
  subCell2.value = filterParts.join('  |  ');
  subCell2.font = fontSubtitle;

  ws2.addRow([]); // Row 3 empty

  // Table 2 Headers
  const headerRowIndex2 = 4;
  const headers2 = [
    'No',
    'Nama Stock',
    'Tipe / Bahan',
    'Model',
    'Ukuran',
    'Tipe Transaksi',
    'No. Transaksi',
    'Tanggal Transaksi',
    'Qty Masuk',
    'Qty Keluar',
    'Qty Retur',
    'Qty Move',
    'Keterangan / Detail',
  ];

  const headerRow2 = ws2.getRow(headerRowIndex2);
  headerRow2.height = 28;

  headers2.forEach((h, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow2.getCell(colNumber);
    cell.value = h;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal:
        idx === 0 || idx === 2 || idx === 3 || idx === 4 || idx === 5 || idx === 6 || idx === 7
          ? 'center'
          : idx >= 8 && idx <= 11
          ? 'right'
          : 'left',
      wrapText: true,
    };
    cell.border = borderThin;
  });

  // Table 2 Data Rows
  let startDataRow2 = 5;
  let movementCounter = 0;
  let grandQtyMasuk = 0;
  let grandQtyKeluar = 0;
  let grandQtyRetur = 0;
  let grandQtyMove = 0;

  items.forEach((item) => {
    (item.movements || []).forEach((m) => {
      movementCounter++;
      const row = ws2.getRow(startDataRow2);
      row.height = 20;

      const inVal = Number(m.qty_masuk || 0);
      const outVal = Number(m.qty_keluar || 0);
      const returVal = Number(m.qty_retur || 0);
      const moveVal = Number(m.qty_move || 0);

      grandQtyMasuk += inVal;
      grandQtyKeluar += outVal;
      grandQtyRetur += returVal;
      grandQtyMove += moveVal;

      let tipeLabel = m.tipe_trx;
      if (m.tipe_trx === 'BARANG_MASUK') tipeLabel = 'BARANG MASUK';
      else if (m.tipe_trx === 'BARANG_KELUAR') tipeLabel = 'BARANG KELUAR';
      else if (m.tipe_trx === 'TRANSFER_STOCK') tipeLabel = 'TRANSFER STOCK';
      else if (m.tipe_trx === 'RETUR_BARANG') tipeLabel = 'RETUR BARANG';
      else if (m.tipe_trx === 'MOVE_LOCATION') tipeLabel = 'MOVE LOCATION';

      row.getCell(1).value = movementCounter;
      row.getCell(2).value = item.nama_stock;
      row.getCell(3).value = item.id_bahan || '-';
      row.getCell(4).value = item.model || '-';
      row.getCell(5).value = item.ukuran || '-';
      row.getCell(6).value = tipeLabel;
      row.getCell(7).value = m.id_transaksi || '-';
      row.getCell(8).value = formatDateIndo(m.tgl_transaksi);
      row.getCell(9).value = inVal;
      row.getCell(10).value = outVal;
      row.getCell(11).value = returVal;
      row.getCell(12).value = moveVal;
      row.getCell(13).value = m.keterangan || '-';

      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(13).alignment = { vertical: 'middle', horizontal: 'left' };

      row.getCell(9).numFmt = '#,##0';
      row.getCell(10).numFmt = '#,##0';
      row.getCell(11).numFmt = '#,##0';
      row.getCell(12).numFmt = '#,##0';

      const isEven = movementCounter % 2 === 0;
      const rowFillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.font = fontCell;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFillColor } };
        cell.border = borderThin;
      }

      startDataRow2++;
    });
  });

  // Table 2 Total Footer Row
  const totalRowIndex2 = startDataRow2;
  const totalRow2 = ws2.getRow(totalRowIndex2);
  totalRow2.height = 26;

  totalRow2.getCell(1).value = 'TOTAL PERGERAKAN STOCK';
  ws2.mergeCells(`A${totalRowIndex2}:H${totalRowIndex2}`);
  totalRow2.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow2.getCell(9).value = grandQtyMasuk;
  totalRow2.getCell(9).numFmt = '#,##0';
  totalRow2.getCell(10).value = grandQtyKeluar;
  totalRow2.getCell(10).numFmt = '#,##0';
  totalRow2.getCell(11).value = grandQtyRetur;
  totalRow2.getCell(11).numFmt = '#,##0';
  totalRow2.getCell(12).value = grandQtyMove;
  totalRow2.getCell(12).numFmt = '#,##0';
  totalRow2.getCell(13).value = `Total ${movementCounter} Pergerakan`;

  for (let c = 1; c <= 13; c++) {
    const cell = totalRow2.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c >= 9 && c <= 12) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // Column Widths for Sheet 2
  const colWidths2 = [6, 24, 16, 16, 14, 18, 22, 22, 14, 14, 14, 14, 40];
  colWidths2.forEach((w, i) => {
    ws2.getColumn(i + 1).width = w;
  });

  const periodSlug = tglFrom && tglTo ? `${tglFrom}_sd_${tglTo}` : 'semua_periode';
  await downloadWorkbook(workbook, `Laporan_Inventory_List_${periodSlug}.xlsx`);
}

/**
 * EXPORT DETAIL PERGERAKAN STOCK UNTUK 1 ITEM SPESIFIK
 */
export async function exportSingleInventoryDetailExcel(item: InventoryListExportItem) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'POS System';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Detail Pergerakan', { views: [{ showGridLines: true }] });

  ws.mergeCells('A1:I1');
  const title = ws.getCell('A1');
  title.value = `DETAIL PERGERAKAN STOCK - ${item.nama_stock}`;
  title.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF065F46' } };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:I2');
  ws.getCell('A2').value = `Tipe/Bahan: ${item.id_bahan || '-'}  |  Model: ${item.model || '-'}  |  Ukuran: ${item.ukuran || '-'}  |  Sisa Stock: ${item.sisa_stock} ${item.uom}  |  Tanggal Export: ${formatNowIndo()}`;
  ws.getCell('A2').font = fontSubtitle;

  const headers = ['No', 'Tipe Transaksi', 'No. Transaksi', 'Tanggal Transaksi', 'Qty Masuk', 'Qty Keluar', 'Qty Retur', 'Qty Move', 'Keterangan'];
  const headerRow = ws.getRow(4);
  headerRow.height = 26;

  headers.forEach((colName, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = colName;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 1 || idx === 2 || idx === 3 ? 'center' : idx >= 4 && idx <= 7 ? 'right' : 'left' };
    cell.border = borderThin;
  });

  let sumMasuk = 0;
  let sumKeluar = 0;
  let sumRetur = 0;
  let sumMove = 0;

  (item.movements || []).forEach((m, idx) => {
    const row = ws.getRow(5 + idx);
    row.height = 20;

    const inVal = Number(m.qty_masuk || 0);
    const outVal = Number(m.qty_keluar || 0);
    const returVal = Number(m.qty_retur || 0);
    const moveVal = Number(m.qty_move || 0);

    sumMasuk += inVal;
    sumKeluar += outVal;
    sumRetur += returVal;
    sumMove += moveVal;

    let tipeLabel = m.tipe_trx;
    if (m.tipe_trx === 'BARANG_MASUK') tipeLabel = 'BARANG MASUK';
    else if (m.tipe_trx === 'BARANG_KELUAR') tipeLabel = 'BARANG KELUAR';
    else if (m.tipe_trx === 'TRANSFER_STOCK') tipeLabel = 'TRANSFER STOCK';
    else if (m.tipe_trx === 'RETUR_BARANG') tipeLabel = 'RETUR BARANG';
    else if (m.tipe_trx === 'MOVE_LOCATION') tipeLabel = 'MOVE LOCATION';

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = tipeLabel;
    row.getCell(3).value = m.id_transaksi || '-';
    row.getCell(4).value = formatDateIndo(m.tgl_transaksi);
    row.getCell(5).value = inVal;
    row.getCell(6).value = outVal;
    row.getCell(7).value = returVal;
    row.getCell(8).value = moveVal;
    row.getCell(9).value = m.keterangan || '-';

    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' };

    row.getCell(5).numFmt = '#,##0';
    row.getCell(6).numFmt = '#,##0';
    row.getCell(7).numFmt = '#,##0';
    row.getCell(8).numFmt = '#,##0';

    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.font = fontCell;
      cell.border = borderThin;
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    }
  });

  const totalRowIndex = 5 + item.movements.length;
  const totalRow = ws.getRow(totalRowIndex);
  totalRow.height = 26;

  totalRow.getCell(1).value = 'TOTAL PERGERAKAN ITEM';
  ws.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`);
  totalRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  totalRow.getCell(5).value = sumMasuk;
  totalRow.getCell(5).numFmt = '#,##0';
  totalRow.getCell(6).value = sumKeluar;
  totalRow.getCell(6).numFmt = '#,##0';
  totalRow.getCell(7).value = sumRetur;
  totalRow.getCell(7).numFmt = '#,##0';
  totalRow.getCell(8).value = sumMove;
  totalRow.getCell(8).numFmt = '#,##0';
  totalRow.getCell(9).value = `Total ${item.movements.length} Pergerakan`;

  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.border = borderTotal;
    if (c >= 5 && c <= 8) {
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  [6, 18, 22, 22, 14, 14, 14, 14, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  await downloadWorkbook(workbook, `Detail_Pergerakan_${item.nama_stock}.xlsx`);
}






