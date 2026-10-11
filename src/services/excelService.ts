import * as XLSX from 'xlsx';
import {
  Medicine,
  MedicineBatch,
  InventoryTransaction,
  MedicalSupply,
  InventoryCheck,
  StockInOutBalanceRow,
  MedicineDisposal,
  HealthEvent,
  HealthCheckup,
  SchoolClass,
  SchoolStaff,
} from '../types';
import { formatDateVN, formatDateTimeVN, formatDateFormulaVN, getDaysRemaining, formatTime24H } from './db';

// Helper to get formatted date string for file names: YYYY_MM_DD
export function getFilenameDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
}

// Helper to create styled worksheet with title headers, auto width and summary
function createReportSheet(
  reportTitle: string,
  filterInfo: string,
  headers: string[],
  dataRows: (string | number)[][],
  summaryRow?: (string | number)[]
): XLSX.WorkSheet {
  const schoolHeader = ['TRƯỜNG THCS ĐÔNG THẠNH', 'PHÒNG Y TẾ HỌC ĐƯỜNG'];
  const nowStr = `Thời điểm xuất: ${new Date().toLocaleString('vi-VN')}`;
  
  const sheetAoa: (string | number)[][] = [
    [schoolHeader[0]],
    [schoolHeader[1]],
    [''],
    [reportTitle.toUpperCase()],
    [nowStr],
    [filterInfo ? `Bộ lọc: ${filterInfo}` : ''],
    [''],
    headers,
    ...dataRows,
  ];

  if (summaryRow) {
    sheetAoa.push(summaryRow);
  }

  // Footer signatures
  sheetAoa.push(['']);
  sheetAoa.push(['', '', '', '', formatDateFormulaVN(new Date(), true, 'Đông Thạnh')]);
  sheetAoa.push(['', 'NGƯỜI LẬP BÁO CÁO', '', '', 'CÁN BỘ PHỤ TRÁCH Y TẾ']);
  sheetAoa.push(['', '(Ký, ghi rõ họ tên)', '', '', '(Ký, ghi rõ họ tên)']);

  const ws = XLSX.utils.aoa_to_sheet(sheetAoa);

  // Auto calculate column widths
  const colWidths = headers.map((h, colIdx) => {
    let maxLen = h.length;
    for (const row of dataRows) {
      const val = row[colIdx];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if (strVal.length > maxLen) maxLen = strVal.length;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
  });

  ws['!cols'] = colWidths;
  return ws;
}

export function saveWorkbook(wb: XLSX.WorkBook, fileName: string) {
  const actualFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = actualFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Keep URL alive for 60 seconds to ensure download completion across all browsers
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    console.warn('Blob Excel download fallback to XLSX.writeFile:', err);
    try {
      XLSX.writeFile(wb, actualFileName);
    } catch (writeErr) {
      console.error('XLSX.writeFile error:', writeErr);
    }
  }
}

export function downloadWorkbook(ws: XLSX.WorkSheet, sheetName: string, fileName: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  saveWorkbook(wb, fileName);
}

// 1. Export Danh mục thuốc
export function exportMedicinesExcel(medicines: Medicine[], batches: MedicineBatch[]) {
  const headers = [
    'STT',
    'Mã thuốc',
    'Tên biệt dược',
    'Hoạt chất',
    'Hàm lượng',
    'Dạng bào chế',
    'Đơn vị tính',
    'Quy cách',
    'Nhà sản xuất',
    'Mức tồn tối thiểu',
    'Tồn hiện tại',
    'Vị trí tủ',
  ];

  const rows = medicines.map((m, idx) => {
    const medBatches = batches.filter((b) => b.medicineId === m.id);
    const totalQty = medBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    return [
      idx + 1,
      m.code,
      m.name,
      m.activeIngredient,
      m.strength,
      m.dosageForm,
      m.unit,
      m.packing,
      m.manufacturer,
      m.minStock,
      totalQty,
      m.storageLocation,
    ];
  });

  const totalQty = rows.reduce((sum, r) => sum + Number(r[10] || 0), 0);
  const summaryRow = ['TỔNG CỘNG', '', '', '', '', '', '', '', '', '', totalQty, ''];

  const ws = createReportSheet('DANH MỤC THUỐC THIẾT YẾU HỌC ĐƯỜNG', 'Toàn bộ danh mục tủ thuốc', headers, rows, summaryRow);
  downloadWorkbook(ws, 'Danh_Muc_Thuoc', `Danh_Muc_Thuoc_${getFilenameDate()}.xlsx`);
}

// 2. Export Danh mục vật tư y tế
export function exportSuppliesExcel(supplies: MedicalSupply[]) {
  const headers = [
    'STT',
    'Mã vật tư',
    'Tên vật tư y tế',
    'Nhóm phân loại',
    'Đơn vị tính',
    'Số lượng tồn',
    'Mức tồn tối thiểu',
    'Hạn sử dụng',
    'Vị trí bảo quản',
    'Ghi chú',
  ];

  const rows = supplies.map((s, idx) => [
    idx + 1,
    s.code,
    s.name,
    s.category,
    s.unit,
    s.quantity,
    s.minStock,
    s.expDate ? formatDateVN(s.expDate) : 'Không áp dụng',
    s.storageLocation,
    s.notes || '',
  ]);

  const totalQty = rows.reduce((sum, r) => sum + Number(r[5] || 0), 0);
  const summaryRow = ['TỔNG CỘNG', '', '', '', '', totalQty, '', '', '', ''];

  const ws = createReportSheet('DANH MỤC VẬT TƯ Y TẾ HỌC ĐƯỜNG', 'Toàn bộ vật tư tiêu hao và trang thiết bị', headers, rows, summaryRow);
  downloadWorkbook(ws, 'Vat_Tu_Y_Te', `Danh_Muc_Vat_Tu_${getFilenameDate()}.xlsx`);
}

// 3. Export Sổ nhập thuốc
export function exportImportTransactionsExcel(transactions: InventoryTransaction[]) {
  const importTxs = transactions.filter((t) => t.type === 'import' && t.status !== 'cancelled');
  const headers = [
    'STT',
    'Số phiếu',
    'Ngày nhập',
    'Tên thuốc',
    'Số lô',
    'Hạn sử dụng',
    'Đơn vị',
    'Số lượng nhập',
    'Nguồn / Nhà cung cấp',
    'Người giao',
    'Người nhận',
  ];

  let stt = 1;
  const rows: (string | number)[][] = [];
  let totalQty = 0;

  for (const tx of importTxs) {
    for (const item of tx.items) {
      rows.push([
        stt++,
        tx.transactionCode,
        formatDateVN(tx.date),
        item.medicineName,
        item.batchNumber,
        item.expDate ? formatDateVN(item.expDate) : '---',
        item.unit,
        item.quantity,
        tx.source || 'Ngân sách trường',
        tx.deliverer || '',
        tx.receiver || tx.performer,
      ]);
      totalQty += item.quantity;
    }
  }

  const summaryRow = ['TỔNG CỘNG', '', '', '', '', '', '', totalQty, '', '', ''];
  const ws = createReportSheet('SỔ THEO DÕI NHẬP THUỐC VÀO TỦ Y TẾ', `Năm học 2026 - 2027 (${importTxs.length} phiếu)`, headers, rows, summaryRow);
  downloadWorkbook(ws, 'So_Nhap_Thuoc', `So_Nhap_Thuoc_${getFilenameDate()}.xlsx`);
}

// 4. Export Sổ xuất / cấp phát thuốc
export function exportExportTransactionsExcel(transactions: InventoryTransaction[]) {
  const exportTxs = transactions.filter((t) => t.type === 'export' && t.status !== 'cancelled');
  const headers = [
    'STT',
    'Số phiếu',
    'Ngày xuất',
    'Tên thuốc',
    'Số lô xuất',
    'HSD',
    'Đơn vị',
    'Số lượng',
    'Đối tượng sử dụng',
    'Lớp / Bộ phận',
    'Mục đích / Triệu chứng',
    'Người thực hiện',
    'Ghi chú',
  ];

  let stt = 1;
  const rows: (string | number)[][] = [];
  let totalQty = 0;

  for (const tx of exportTxs) {
    for (const item of tx.items) {
      rows.push([
        stt++,
        tx.transactionCode,
        formatDateVN(tx.date),
        item.medicineName,
        item.batchNumber,
        item.expDate ? formatDateVN(item.expDate) : '---',
        item.unit,
        item.quantity,
        tx.recipientName || 'Học sinh',
        tx.recipientClass || '',
        tx.purpose || '',
        tx.performer,
        tx.notes || '',
      ]);
      totalQty += item.quantity;
    }
  }

  const summaryRow = ['TỔNG CỘNG', '', '', '', '', '', '', totalQty, '', '', '', '', ''];
  const ws = createReportSheet('SỔ THEO DÕI XUẤT CẤP PHÁT THUỐC SƠ CỨU', `Năm học 2026 - 2027 (${exportTxs.length} lượt)`, headers, rows, summaryRow);
  downloadWorkbook(ws, 'So_Xuat_Thuoc', `So_Xuat_Thuoc_${getFilenameDate()}.xlsx`);
}

// 5. Export Báo cáo Tồn kho
export function exportStockReportExcel(medicines: Medicine[], batches: MedicineBatch[]) {
  const headers = [
    'STT',
    'Mã thuốc',
    'Tên thuốc',
    'Đơn vị tính',
    'Số lô hiện có',
    'Hạn dùng gần nhất',
    'Mức tồn tối thiểu',
    'Số lượng tồn',
    'Vị trí lưu trữ',
    'Tình trạng',
  ];

  let totalQty = 0;

  const rows = medicines.map((m, idx) => {
    const medBatches = batches.filter((b) => b.medicineId === m.id);
    const qty = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
    totalQty += qty;

    return [
      idx + 1,
      m.code,
      m.name,
      m.unit,
      medBatches.length,
      m.earliestExpDate ? formatDateVN(m.earliestExpDate) : '---',
      m.minStock,
      qty,
      m.storageLocation,
      qty === 0 ? 'Hết hàng' : qty <= m.minStock ? 'Sắp hết' : 'An toàn',
    ];
  });

  const summaryRow = ['TỔNG CỘNG', '', '', '', '', '', '', totalQty, '', ''];
  const ws = createReportSheet('BÁO CÁO TỒN KHO THUỐC TỦ Y TẾ', 'Tổng hợp số dư tồn kho theo mặt hàng', headers, rows, summaryRow);
  downloadWorkbook(ws, 'Bao_Cao_Ton_Kho', `Bao_Cao_Ton_Kho_${getFilenameDate()}.xlsx`);
}

// 6. Export Sổ Nhập - Xuất - Tồn (Core Section 7, 15, 16)
export function exportInOutBalanceExcel(
  rowsData: StockInOutBalanceRow[],
  filterStr = 'Từ đầu kỳ đến hiện tại',
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const headers = [
    'STT',
    'Ngày / Kỳ',
    'Mã thuốc',
    'Tên thuốc',
    'Số lô',
    'Hạn sử dụng',
    'Đơn vị tính',
    'Tồn đầu kỳ',
    'Nhập trong kỳ',
    'Xuất trong kỳ',
    'Điều chỉnh',
    'Tồn cuối kỳ',
    'Ghi chú',
  ];

  let totalOpening = 0;
  let totalImport = 0;
  let totalExport = 0;
  let totalAdj = 0;
  let totalClosing = 0;

  const rows = rowsData.map((r, idx) => {
    totalOpening += r.openingStock;
    totalImport += r.importQuantity;
    totalExport += r.exportQuantity;
    totalAdj += r.adjustmentQuantity || 0;
    totalClosing += r.closingStock;

    return [
      idx + 1,
      r.date || 'Toàn kỳ',
      r.medicineCode,
      r.medicineName,
      r.batchNumber,
      r.expDate ? formatDateVN(r.expDate) : '---',
      r.unit,
      r.openingStock,
      r.importQuantity,
      r.exportQuantity,
      r.adjustmentQuantity || 0,
      r.closingStock,
      r.notes || '',
    ];
  });

  const summaryRow = [
    'TỔNG CỘNG',
    '',
    '',
    '',
    '',
    '',
    '',
    totalOpening,
    totalImport,
    totalExport,
    totalAdj,
    totalClosing,
    '',
  ];

  const ws = createReportSheet(
    'SỔ THEO DÕI NHẬP – XUẤT – TỒN THUỐC VÀ VẬT TƯ Y TẾ',
    filterStr,
    headers,
    rows,
    summaryRow
  );

  // Exact file name per requirement Section 16: So_Nhap_Xuat_Ton_YYYY_MM_DD.xlsx
  downloadWorkbook(ws, 'Nhap_Xuat_Ton', `So_Nhap_Xuat_Ton_${getFilenameDate()}.xlsx`);
}

// 7. Export Tồn theo từng lô riêng biệt (Section 8)
export function exportBatchStockExcel(medicines: Medicine[], batches: MedicineBatch[]) {
  const headers = [
    'STT',
    'Tên thuốc',
    'Số lô',
    'Ngày sản xuất',
    'Hạn sử dụng',
    'Số ngày còn lại',
    'Tổng nhập',
    'Đã xuất',
    'Tồn hiện tại',
    'Đơn vị',
    'Trạng thái',
  ];

  let totalQty = 0;

  const rows: (string | number)[][] = [];
  batches.forEach((b, idx) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    const days = getDaysRemaining(b.expDate);
    totalQty += b.quantity;

    let statusStr = 'Bình thường';
    if (days < 0) statusStr = 'ĐÃ HẾT HẠN';
    else if (days <= 30) statusStr = 'SẮP HẾT HẠN (≤30 ngày)';
    else if (days <= 60) statusStr = 'CẢNH BÁO (≤60 ngày)';
    else if (b.quantity === 0) statusStr = 'Hết tồn lô';

    rows.push([
      idx + 1,
      med ? med.name : 'Không xác định',
      b.batchNumber,
      b.mfgDate ? formatDateVN(b.mfgDate) : '---',
      formatDateVN(b.expDate),
      days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : `${days} ngày`,
      b.initialQuantity || b.quantity,
      (b.initialQuantity || b.quantity) - b.quantity,
      b.quantity,
      med ? med.unit : 'Viên',
      statusStr,
    ]);
  });

  const summaryRow = ['TỔNG CỘNG', '', '', '', '', '', '', '', totalQty, '', ''];
  const ws = createReportSheet('BÁO CÁO TỒN KHO CHI TIẾT THEO TỪNG LÔ (FEFO)', 'Tách bạch từng số lô riêng biệt', headers, rows, summaryRow);
  downloadWorkbook(ws, 'Ton_Theo_Lo', `Ton_Kho_Theo_Lo_${getFilenameDate()}.xlsx`);
}

// 8. Export Danh sách thuốc sắp hết
export function exportLowStockExcel(lowStockMeds: Medicine[]) {
  const headers = [
    'STT',
    'Mã thuốc',
    'Tên thuốc',
    'Đơn vị tính',
    'Tồn hiện tại',
    'Mức tồn tối thiểu',
    'Số lượng cần bổ sung',
    'Vị trí bảo quản',
    'Ghi chú đề xuất',
  ];

  const rows = lowStockMeds.map((m, idx) => {
    const need = Math.max(0, m.minStock * 2 - (m.totalStock || 0));
    return [
      idx + 1,
      m.code,
      m.name,
      m.unit,
      m.totalStock || 0,
      m.minStock,
      need,
      m.storageLocation,
      'Cần lập dự trù nhập bổ sung cho tủ y tế học đường',
    ];
  });

  const ws = createReportSheet('DANH SÁCH THUỐC SẮP HẾT & CẦN BỔ SUNG', `Có ${lowStockMeds.length} mặt hàng chạm ngưỡng tồn tối thiểu`, headers, rows);
  downloadWorkbook(ws, 'Thuoc_Sap_Het', `Danh_Sach_Thuoc_Sap_Het_${getFilenameDate()}.xlsx`);
}

// 9. Export Danh sách thuốc sắp hết hạn
export function exportExpiringSoonExcel(medicines: Medicine[], expiringBatches: MedicineBatch[], daysThreshold = 30) {
  const headers = [
    'STT',
    'Tên thuốc',
    'Số lô',
    'Hạn sử dụng',
    'Số lượng tồn',
    'Số ngày còn lại',
    'Trạng thái',
    'Vị trí bảo quản',
    'Ghi chú xử lý',
  ];

  let totalQty = 0;
  const rows = expiringBatches.map((b, idx) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    const days = getDaysRemaining(b.expDate);
    totalQty += b.quantity;
    return [
      idx + 1,
      med ? med.name : 'Không xác định',
      b.batchNumber,
      formatDateVN(b.expDate),
      b.quantity,
      `${days} ngày`,
      days <= 30 ? 'Cực kỳ khẩn cấp (≤ 30 ngày)' : 'Sắp đến hạn',
      med?.storageLocation || 'Tủ y tế',
      'Ưu tiên xuất dùng trước theo nguyên tắc FEFO',
    ];
  });

  const summaryRow = ['TỔNG CỘNG', '', '', '', totalQty, '', '', '', ''];
  const ws = createReportSheet('DANH SÁCH THUỐC SẮP HẾT HẠN', `Ngưỡng lọc cảnh báo: Còn ≤ ${daysThreshold} ngày`, headers, rows, summaryRow);
  downloadWorkbook(ws, 'Sap_Het_Han', `Danh_Sach_Thuoc_Sap_Het_Han_${getFilenameDate()}.xlsx`);
}

// 10. Export Danh sách thuốc đã hết hạn
export function exportExpiredExcel(medicines: Medicine[], expiredBatches: MedicineBatch[]) {
  const headers = [
    'STT',
    'Tên thuốc',
    'Số lô',
    'Hạn sử dụng',
    'Số lượng tồn',
    'Vị trí bảo quản',
    'Tình trạng pháp lý',
    'Đề xuất xử lý',
  ];

  let totalQty = 0;
  const rows = expiredBatches.map((b, idx) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    const days = Math.abs(getDaysRemaining(b.expDate));
    totalQty += b.quantity;
    return [
      idx + 1,
      med ? med.name : 'Không xác định',
      b.batchNumber,
      formatDateVN(b.expDate),
      b.quantity,
      med?.storageLocation || 'Tủ A',
      `ĐÃ HẾT HẠN (${days} ngày trước)`,
      'NIÊM PHONG - KHÔNG ĐƯỢC XUẤT - Lập biên bản tiêu hủy',
    ];
  });

  const summaryRow = ['TỔNG CỘNG', '', '', '', totalQty, '', '', ''];
  const ws = createReportSheet('DANH SÁCH THUỐC ĐÃ HẾT HẠN SỬ DỤNG', 'NGHIÊM CẤM XUẤT CẤP PHÁT HỌC SINH', headers, rows, summaryRow);
  downloadWorkbook(ws, 'Da_Het_Han', `Danh_Sach_Thuoc_Da_Het_Han_${getFilenameDate()}.xlsx`);
}

// 11. Export Biên bản kiểm kê
export function exportInventoryCheckExcel(check: InventoryCheck) {
  const headers = [
    'STT',
    'Mã thuốc/vật tư',
    'Tên thuốc / vật tư y tế',
    'Số lô',
    'Hạn sử dụng',
    'Đơn vị tính',
    'Tồn trên phần mềm',
    'Tồn thực tế kiểm đếm',
    'Chênh lệch',
    'Đánh giá',
    'Nguyên nhân chênh lệch',
    'Ghi chú',
  ];

  let sysTotal = 0;
  let actTotal = 0;
  let diffTotal = 0;

  const rows = check.items.map((item, idx) => {
    sysTotal += item.systemQuantity;
    actTotal += item.actualQuantity;
    diffTotal += item.difference;

    let evalStr = 'KHỚP (Đạt)';
    if (item.difference > 0) evalStr = `THỪA (+${item.difference})`;
    if (item.difference < 0) evalStr = `THIẾU (${item.difference})`;

    return [
      idx + 1,
      item.medicineCode || '',
      item.medicineName,
      item.batchNumber,
      item.expDate ? formatDateVN(item.expDate) : '---',
      item.unit,
      item.systemQuantity,
      item.actualQuantity,
      item.difference,
      evalStr,
      item.reason || '',
      item.notes || '',
    ];
  });

  const summaryRow = ['TỔNG CỘNG', '', '', '', '', '', sysTotal, actTotal, diffTotal, '', '', ''];
  const filterStr = `Số phiếu: ${check.checkCode} • Ngày kiểm: ${formatDateVN(check.checkDate)} • Trạng thái: ${check.status === 'adjusted' ? 'Đã điều chỉnh kho' : check.status === 'confirmed' ? 'Đã xác nhận' : 'Dự thảo'}`;
  const ws = createReportSheet('BIÊN BẢN KIỂM KÊ THUỐC VÀ VẬT TƯ Y TẾ', filterStr, headers, rows, summaryRow);
  downloadWorkbook(ws, 'Kiem_Ke', `Bien_Ban_Kiem_Ke_${check.checkCode}_${getFilenameDate()}.xlsx`);
}

// Alias for StockBalanceComponent
export const exportStockInOutBalanceExcel = exportInOutBalanceExcel;

// 12. Báo cáo thuốc đã sử dụng theo học sinh & số lô (FEFO)
export function exportMedicationUsageExcel(
  items: Array<{
    visitCode?: string;
    dateTime: string;
    studentCode: string;
    studentName: string;
    className: string;
    medicineName: string;
    quantity: number;
    unit: string;
    batchNumber?: string;
    expDate?: string;
    dosageInstructions?: string;
    reason: string;
    performer: string;
  }>,
  filterInfo?: string
) {
  const headers = [
    'STT',
    'Thời gian cấp',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Tên thuốc / Biệt dược',
    'Số lượng',
    'Đơn vị tính',
    'Số lô (Batch)',
    'Hạn dùng (Exp)',
    'Liều lượng / Chỉ định',
    'Lý do / Triệu chứng',
    'Cán bộ y tế phụ trách',
    'Mã phiếu khám',
  ];

  let totalQty = 0;
  const uniqueMeds = new Set<string>();
  const uniqueStudents = new Set<string>();

  const rows = items.map((item, idx) => {
    totalQty += item.quantity;
    uniqueMeds.add(item.medicineName);
    uniqueStudents.add(item.studentCode);

    return [
      idx + 1,
      item.dateTime,
      item.studentCode,
      item.studentName,
      item.className,
      item.medicineName,
      item.quantity,
      item.unit,
      item.batchNumber || '---',
      item.expDate ? formatDateVN(item.expDate) : '---',
      item.dosageInstructions || 'Theo hướng dẫn y tế',
      item.reason,
      item.performer || 'Y sĩ trường học',
      item.visitCode || '---',
    ];
  });

  const summaryRow = [
    'TỔNG CỘNG',
    `${items.length} lượt cấp`,
    `${uniqueStudents.size} học sinh`,
    '',
    '',
    `${uniqueMeds.size} loại thuốc`,
    totalQty,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const ws = createReportSheet(
    'BÁO CÁO THUỐC ĐÃ SỬ DỤNG THEO HỌC SINH VÀ SỐ LÔ (FEFO)',
    filterInfo || `Tổng số: ${items.length} lượt cấp thuốc`,
    headers,
    rows,
    summaryRow
  );

  downloadWorkbook(
    ws,
    'Thuoc_Da_Su_Dung',
    `Bao_Cao_Thuoc_Su_Dung_THCS_Dong_Thanh_${getFilenameDate()}.xlsx`
  );
}

// 13. Báo cáo vật tư tiêu hao đã sử dụng
export function exportSupplyUsageExcel(
  items: Array<{
    dateTime: string;
    studentCode: string;
    studentName: string;
    className: string;
    supplyName: string;
    quantity: number;
    unit: string;
    reason: string;
    performer: string;
    visitCode?: string;
  }>,
  filterInfo?: string
) {
  const headers = [
    'STT',
    'Thời gian sử dụng',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Tên vật tư y tế',
    'Số lượng',
    'Đơn vị tính',
    'Mục đích / Lý do sử dụng',
    'Cán bộ y tế',
    'Mã phiếu khám',
  ];

  let totalQty = 0;
  const uniqueSupplies = new Set<string>();

  const rows = items.map((item, idx) => {
    totalQty += item.quantity;
    uniqueSupplies.add(item.supplyName);

    return [
      idx + 1,
      item.dateTime,
      item.studentCode,
      item.studentName,
      item.className,
      item.supplyName,
      item.quantity,
      item.unit,
      item.reason,
      item.performer || 'Y sĩ trường học',
      item.visitCode || '---',
    ];
  });

  const summaryRow = [
    'TỔNG CỘNG',
    `${items.length} lượt`,
    '',
    '',
    '',
    `${uniqueSupplies.size} loại vật tư`,
    totalQty,
    '',
    '',
    '',
    '',
  ];

  const ws = createReportSheet(
    'BÁO CÁO VẬT TƯ TIÊU HAO ĐÃ SỬ DỤNG PHÒNG Y TẾ',
    filterInfo || `Tổng số: ${items.length} lượt sử dụng`,
    headers,
    rows,
    summaryRow
  );

  downloadWorkbook(
    ws,
    'Vat_Tu_Su_Dung',
    `Bao_Cao_Vat_Tu_THCS_Dong_Thanh_${getFilenameDate()}.xlsx`
  );
}

// 14. Xuất Sổ theo dõi học sinh đến phòng y tế
export function exportClinicVisitsExcel(
  visits: Array<{
    visitCode: string;
    dateTime?: string;
    visitDate?: string;
    timeIn?: string;
    studentCode: string;
    studentName: string;
    className: string;
    broughtBy?: string;
    reason?: string;
    reasons?: string[];
    customReason?: string;
    initialCondition?: string;
    temperature?: number | string;
    vitals?: { temperature?: number | string; bloodPressure?: string; pulse?: number | string };
    bloodPressure?: string;
    pulse?: number | string;
    treatment?: string;
    treatmentDetails?: string;
    treatmentType?: string;
    medicinesDispensed?: Array<{ medicineName: string; quantity: number; unit: string }>;
    medicinesUsed?: Array<{ medicineName: string; quantity: number; unit: string }>;
    suppliesUsed?: Array<{ supplyName: string; quantity: number; unit: string }>;
    outcome?: string;
    parentContacted?: boolean;
    parentNotified?: boolean;
    performer?: string;
    notes?: string;
  }>,
  filterInfo?: string
) {
  const headers = [
    'STT',
    'Mã phiếu',
    'Thời gian khám',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Người đưa đến',
    'Lý do đến khám',
    'Tình trạng ban đầu',
    'Nhiệt độ (°C)',
    'Huyết áp',
    'Mạch',
    'Biện pháp xử trí',
    'Thuốc đã cấp',
    'Vật tư đã dùng',
    'Kết quả xử trí',
    'Báo phụ huynh',
    'Cán bộ y tế',
    'Ghi chú',
  ];

  const rows = visits.map((v, idx) => {
    const dateTimeStr = v.dateTime
      ? formatDateTimeVN(v.dateTime)
      : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '');
    const reasonStr = v.reason || (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason || '');
    const tempStr = v.temperature || v.vitals?.temperature || '';
    const bpStr = v.bloodPressure || v.vitals?.bloodPressure || '';
    const pulseStr = v.pulse || v.vitals?.pulse || '';
    const treatmentStr = v.treatmentDetails || v.treatment || v.treatmentType || '';
    const meds = (v.medicinesDispensed || v.medicinesUsed || []).map((m) => `${m.medicineName} (${m.quantity} ${m.unit})`).join('; ');
    const supplies = (v.suppliesUsed || []).map((s) => `${s.supplyName} (${s.quantity} ${s.unit})`).join('; ');
    const parentStr = (v.parentContacted || v.parentNotified) ? 'Đã liên hệ' : 'Không';

    return [
      idx + 1,
      v.visitCode,
      dateTimeStr,
      v.studentCode,
      v.studentName,
      v.className,
      v.broughtBy || '',
      reasonStr,
      v.initialCondition || '',
      tempStr,
      bpStr,
      pulseStr,
      treatmentStr,
      meds,
      supplies,
      v.outcome || '',
      parentStr,
      v.performer || '',
      v.notes || '',
    ];
  });

  const summaryRow = [
    'TỔNG CỘNG',
    `${visits.length} lượt khám`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const ws = createReportSheet(
    'SỔ THEO DÕI HỌC SINH ĐẾN PHÒNG Y TẾ HỌC ĐƯỜNG',
    filterInfo || `Tổng số: ${visits.length} ca tiếp nhận`,
    headers,
    rows,
    summaryRow
  );

  downloadWorkbook(
    ws,
    'So_Theo_Doi_Y_Te',
    `So_Theo_Doi_Hoc_Sinh_Phong_Y_Te_${getFilenameDate()}.xlsx`
  );
}

// 15. Xuất danh sách học sinh & sức khỏe
export function exportStudentDirectoryExcel(
  students: Array<{
    studentCode: string;
    fullName: string;
    className: string;
    grade?: number | string;
    gender: string;
    birthDate?: string;
    healthInsuranceCode?: string;
    parentName?: string;
    parentPhone?: string;
    fatherName?: string;
    fatherPhone?: string;
    motherName?: string;
    motherPhone?: string;
    address?: string;
    bloodType?: string;
    allergies?: string;
    chronicConditions?: string;
    specialAttention?: boolean;
  }>,
  filterInfo?: string
) {
  const headers = [
    'STT',
    'Mã học sinh',
    'Họ và tên',
    'Lớp',
    'Khối',
    'Giới tính',
    'Ngày sinh (ngày/tháng/năm)',
    'Mã BHYT',
    'Họ tên cha',
    'SĐT cha',
    'Họ tên mẹ',
    'SĐT mẹ',
    'Phụ huynh đại diện',
    'Số điện thoại phụ huynh',
    'Địa chỉ',
    'Nhóm máu',
    'Tiền sử dị ứng',
    'Bệnh nền mạn tính',
    'Theo dõi đặc biệt',
  ];

  const rows = students.map((s, idx) => [
    idx + 1,
    s.studentCode,
    s.fullName,
    s.className,
    s.grade || '',
    s.gender,
    s.birthDate ? formatDateVN(s.birthDate) : '',
    s.healthInsuranceCode || '',
    s.fatherName || '',
    s.fatherPhone || '',
    s.motherName || '',
    s.motherPhone || '',
    s.parentName || s.fatherName || s.motherName || '',
    s.parentPhone || s.fatherPhone || s.motherPhone || '',
    s.address || '',
    s.bloodType || '',
    s.allergies || 'Không',
    s.chronicConditions || 'Không',
    s.specialAttention ? 'Có' : 'Không',
  ]);

  const specialCount = students.filter(s => s.specialAttention || s.allergies || s.chronicConditions).length;
  const summaryRow = [
    'TỔNG CỘNG',
    `${students.length} học sinh`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `Theo dõi đặc biệt: ${specialCount} HS`,
    '',
  ];

  const ws = createReportSheet(
    'DANH SÁCH HỒ SƠ SỨC KHỎE HỌC SINH - TRƯỜNG THCS ĐÔNG THẠNH',
    filterInfo || `Năm học 2026 - 2027 (${students.length} học sinh)`,
    headers,
    rows,
    summaryRow
  );

  downloadWorkbook(
    ws,
    'Hoc_Sinh_Suc_Khoe',
    `Danh_Sach_Hoc_Sinh_Suc_Khoe_THCS_Dong_Thanh_${getFilenameDate()}.xlsx`
  );
}

// 16. Báo cáo tổng hợp công tác y tế học đường tháng
export function exportMonthlyComprehensiveReportExcel(
  selectedMonth: string,
  monthlyReport: {
    totalVisits: number;
    outcomes: Record<string, number>;
    healthEventsCount: number;
    byReason: Record<string, number>;
    medicinesUsed: Array<{ medicineName: string; quantity: number; unit: string }>;
  },
  classStats?: Array<{ className: string; visitCount: number }>
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Tổng quan & Cơ cấu
  const s1Headers = ['Chỉ số báo cáo', 'Giá trị', 'Đơn vị tính / Ghi chú'];
  const s1Rows: (string | number)[][] = [
    ['Tổng số lượt học sinh tiếp nhận tại phòng y tế', monthlyReport.totalVisits, 'Lượt khám'],
    ['Số ca sơ cứu / xử trí ổn định cho về lớp học tiếp', monthlyReport.outcomes['Đã ổn định cho về lớp'] || 0, 'Học sinh'],
    ['Số ca xử trí và bàn giao phụ huynh đón về theo dõi', monthlyReport.outcomes['Bàn giao phụ huynh đón về'] || 0, 'Học sinh'],
    ['Số ca chuyển cơ sở y tế tuyến trên (Trạm YT/Bệnh viện)', monthlyReport.outcomes['Chuyển cơ sở y tế tuyến trên'] || 0, 'Học sinh'],
    ['Số sự cố tai nạn thương tích / sự việc y tế đặc biệt', monthlyReport.healthEventsCount, 'Vụ việc'],
    [''],
    ['CƠ CẤU THEO NGUYÊN NHÂN / TRIỆU CHỨNG', '', ''],
  ];

  Object.entries(monthlyReport.byReason).forEach(([reason, count]) => {
    s1Rows.push([reason, count, 'Lượt']);
  });

  const ws1 = createReportSheet(
    `BÁO CÁO CÔNG TÁC PHÒNG Y TẾ HỌC ĐƯỜNG - THÁNG ${selectedMonth}`,
    `Trường THCS Đông Thạnh • Tháng ${selectedMonth}`,
    s1Headers,
    s1Rows
  );
  XLSX.utils.book_append_sheet(wb, ws1, 'Tong_Quan_Y_Te');

  // Sheet 2: Danh mục thuốc & vật tư đã sử dụng
  const s2Headers = ['STT', 'Tên thuốc / Biệt dược', 'Số lượng cấp phát', 'Đơn vị tính'];
  let totalMedQty = 0;
  const s2Rows = (monthlyReport.medicinesUsed || []).map((m, idx) => {
    totalMedQty += m.quantity;
    return [idx + 1, m.medicineName, m.quantity, m.unit];
  });
  const s2Summary = ['TỔNG CỘNG', `${monthlyReport.medicinesUsed?.length || 0} loại thuốc`, totalMedQty, ''];
  const ws2 = createReportSheet(
    `BẢNG TỔNG HỢP THUỐC ĐÃ SỬ DỤNG - THÁNG ${selectedMonth}`,
    `Cấp phát cho học sinh trong tháng ${selectedMonth}`,
    s2Headers,
    s2Rows,
    s2Summary
  );
  XLSX.utils.book_append_sheet(wb, ws2, 'Thuoc_Su_Dung');

  // Sheet 3: Thống kê theo từng lớp học nếu có
  if (classStats && classStats.length > 0) {
    const s3Headers = ['STT', 'Lớp học', 'Số lượt học sinh khám'];
    const s3Rows = classStats.map((c, idx) => [idx + 1, c.className, c.visitCount]);
    const s3Total = classStats.reduce((sum, c) => sum + c.visitCount, 0);
    const ws3 = createReportSheet(
      `THỐNG KÊ LƯỢT KHÁM THEO LỚP HỌC - THÁNG ${selectedMonth}`,
      `Trường THCS Đông Thạnh`,
      s3Headers,
      s3Rows,
      ['TỔNG CỘNG', `${classStats.length} lớp`, s3Total]
    );
    XLSX.utils.book_append_sheet(wb, ws3, 'Theo_Lop');
  }

  saveWorkbook(wb, `Bao_Cao_Y_Te_Thang_${selectedMonth}_THCS_Dong_Thanh_${getFilenameDate()}.xlsx`);
}

// Xuất file Excel Biên bản tiêu hủy thuốc hết hạn
export function exportDisposalExcel(
  disposal: MedicineDisposal,
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'STT',
    'Mã thuốc',
    'Tên thuốc / Hoạt chất',
    'Số lô',
    'Hạn dùng',
    'Đơn vị tính',
    'Số lượng hủy',
    'Lý do tiêu hủy',
  ];

  const dataRows = (disposal.items || []).map((item, idx) => [
    idx + 1,
    item.medicineCode,
    item.medicineName + (item.activeIngredient ? ` (${item.activeIngredient})` : ''),
    item.batchNumber,
    formatDateVN(item.expDate),
    item.unit,
    item.disposalQuantity,
    item.reason || 'Hết hạn sử dụng',
  ]);

  const totalQty = (disposal.items || []).reduce((s, i) => s + (i.disposalQuantity || 0), 0);

  const summaryRow = [
    'TỔNG CỘNG',
    '',
    `${disposal.items?.length || 0} mặt hàng`,
    '',
    '',
    '',
    totalQty,
    '',
  ];

  const filterInfo = `Số biên bản: ${disposal.disposalCode} • QĐ số: ${disposal.decisionNumber || 'Chưa có'} • Ngày: ${formatDateVN(disposal.disposalDate)} • Phương pháp: ${disposal.disposalMethod || 'Theo quy định'}`;

  const ws = createReportSheet(
    `BIÊN BẢN TIÊU HỦY THUỐC VÀ VẬT TƯ Y TẾ HẾT HẠN - ${disposal.disposalCode}`,
    filterInfo,
    headers,
    dataRows,
    summaryRow
  );

  XLSX.utils.book_append_sheet(wb, ws, 'Bien_Ban_Tieu_Huy');
  saveWorkbook(wb, `Bien_Ban_Tieu_Huy_${disposal.disposalCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_${getFilenameDate()}.xlsx`);
}

// 17. Export Sổ theo dõi sự cố y tế & tai nạn thương tích học đường
export function exportHealthEventsExcel(events: HealthEvent[], filterInfo = '') {
  const wb = XLSX.utils.book_new();

  const headers = [
    'STT',
    'Mã sự kiện',
    'Thời gian xảy ra',
    'Địa điểm',
    'Phân loại sự cố',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Diễn biến sự cố',
    'Tình trạng ban đầu',
    'Biện pháp sơ cứu / xử trí',
    'Người chứng kiến',
    'Cán bộ y tế thực hiện',
    'Kết quả xử trí / Bàn giao',
    'Ghi chú',
  ];

  const dataRows = events.map((e, idx) => [
    idx + 1,
    e.eventCode,
    formatDateTimeVN(e.dateTime),
    e.location || '',
    e.eventType,
    e.studentCode || '',
    e.studentName || 'Tập thể học sinh',
    e.className || '',
    e.description || '',
    e.initialCondition || '',
    e.treatment || '',
    e.witness || '',
    e.performer || '',
    e.outcome || '',
    e.notes || '',
  ]);

  const taiNanCount = events.filter((e) => e.eventType === 'Tai nạn' || e.eventType === 'Chấn thương').length;
  const sotCaoCount = events.filter((e) => e.eventType === 'Sốt cao' || e.eventType === 'Ngất').length;
  const otherCount = events.length - taiNanCount - sotCaoCount;

  const summaryRow = [
    'TỔNG CỘNG',
    `${events.length} vụ việc`,
    `Tai nạn/Chấn thương: ${taiNanCount}`,
    `Sốt cao/Ngất: ${sotCaoCount}`,
    `Khác: ${otherCount}`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const info = filterInfo || `Năm học 2026 - 2027 • Tổng số ghi nhận: ${events.length} sự cố`;

  const ws = createReportSheet(
    'SỔ THEO DÕI TAI NẠN THƯƠNG TÍCH & SỰ CỐ Y TẾ HỌC ĐƯỜNG',
    info,
    headers,
    dataRows,
    summaryRow
  );

  XLSX.utils.book_append_sheet(wb, ws, 'So_Theo_Doi_Tai_Nan');
  saveWorkbook(wb, `So_Theo_Doi_Tai_Nan_Thuong_Tich_${getFilenameDate()}.xlsx`);
}

// 18. Export Sổ kết quả khám sức khỏe học sinh định kỳ
export function exportHealthCheckupsExcel(checkups: HealthCheckup[], filterInfo = '') {
  const wb = XLSX.utils.book_new();

  const headers = [
    'STT',
    'Mã phiếu khám',
    'Ngày khám',
    'Năm học',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Chiều cao (cm)',
    'Cân nặng (kg)',
    'Chỉ số BMI',
    'Phân loại dinh dưỡng',
    'Huyết áp',
    'Mạch (l/p)',
    'Thị lực Mắt Trái (/10)',
    'Thị lực Mắt Phải (/10)',
    'Tật khúc xạ',
    'Răng - Hàm - Mặt',
    'Tai - Mũi - Họng',
    'Cột sống / Dáng đi',
    'Khuyến nghị gửi phụ huynh',
    'Bác sĩ / Cán bộ khám',
    'Ghi chú khác',
  ];

  const dataRows = checkups.map((c, idx) => {
    const nutrition = c.nutritionStatus || (c as any).nutritionClassification || 'Bình thường';
    const visionL = c.eyesightLeft || (c as any).visionLeft || '10/10';
    const visionR = c.eyesightRight || (c as any).visionRight || '10/10';
    const refraction = c.hasRefraction
      ? ((c as any).refractiveError || 'Có tật khúc xạ')
      : ((c as any).refractiveError || 'Không');
    const dental = c.dentalCondition || (c as any).dentalStatus || 'Bình thường';
    const ent = c.entCondition || (c as any).entStatus || 'Bình thường';
    const spine = c.scoliosis ? 'Cong vẹo cột sống' : ((c as any).spineStatus || 'Bình thường');

    return [
      idx + 1,
      c.checkupCode,
      c.checkupDate ? formatDateVN(c.checkupDate) : '',
      c.schoolYear || '2026-2027',
      c.studentCode || '',
      c.studentName || '',
      c.className || '',
      c.height || 0,
      c.weight || 0,
      c.bmi || 0,
      nutrition,
      c.bloodPressure || '105/70',
      c.pulse ? `${c.pulse}` : '',
      String(visionL),
      String(visionR),
      refraction,
      dental,
      ent,
      spine,
      c.recommendations || '',
      c.doctorOrStaff || '',
      c.otherFindings || '',
    ];
  });

  const myopiaCount = checkups.filter((c) => c.hasRefraction || ((c as any).refractiveError && (c as any).refractiveError !== 'Không')).length;
  const dentalCount = checkups.filter((c) => {
    const d = (c.dentalCondition || (c as any).dentalStatus || '').toLowerCase();
    return d && !d.includes('bình thường') && !d.includes('tốt');
  }).length;
  const spineCount = checkups.filter((c) => {
    const s = (c.scoliosis ? 'cong vẹo' : (c as any).spineStatus || '').toLowerCase();
    return s && !s.includes('bình thường');
  }).length;

  const summaryRow = [
    'TỔNG CỘNG',
    `${checkups.length} học sinh`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `Cận thị: ${myopiaCount}`,
    `Bệnh răng: ${dentalCount}`,
    `Cong vẹo: ${spineCount}`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const info = filterInfo || `Năm học 2026 - 2027 • Tổng số học sinh khám: ${checkups.length} em`;

  const ws = createReportSheet(
    'BẢNG TỔNG HỢP KẾT QUẢ KHÁM SỨC KHỎE HỌC SINH ĐỊNH KỲ',
    info,
    headers,
    dataRows,
    summaryRow
  );

  XLSX.utils.book_append_sheet(wb, ws, 'Kham_Suc_Khoe_Dinh_Ky');
  saveWorkbook(wb, `Ket_Qua_Kham_Suc_Khoe_Dinh_Ky_${getFilenameDate()}.xlsx`);
}

// 19. Export Sổ kết hợp cả Sự cố Tai nạn & Khám định kỳ trong 1 file Excel (2 Sheet)
export function exportCombinedHealthAndCheckupsExcel(
  events: HealthEvent[],
  checkups: HealthCheckup[]
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Tai nạn
  const eventHeaders = [
    'STT',
    'Mã sự kiện',
    'Thời gian xảy ra',
    'Địa điểm',
    'Phân loại sự cố',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Diễn biến sự cố',
    'Tình trạng ban đầu',
    'Biện pháp sơ cứu / xử trí',
    'Người chứng kiến',
    'Cán bộ y tế thực hiện',
    'Kết quả xử trí / Bàn giao',
    'Ghi chú',
  ];

  const eventRows = events.map((e, idx) => [
    idx + 1,
    e.eventCode,
    formatDateTimeVN(e.dateTime),
    e.location || '',
    e.eventType,
    e.studentCode || '',
    e.studentName || 'Tập thể học sinh',
    e.className || '',
    e.description || '',
    e.initialCondition || '',
    e.treatment || '',
    e.witness || '',
    e.performer || '',
    e.outcome || '',
    e.notes || '',
  ]);

  const wsEvents = createReportSheet(
    'SỔ THEO DÕI TAI NẠN THƯƠNG TÍCH & SỰ CỐ Y TẾ HỌC ĐƯỜNG',
    `Năm học 2026 - 2027 (${events.length} vụ việc)`,
    eventHeaders,
    eventRows
  );
  XLSX.utils.book_append_sheet(wb, wsEvents, 'Su_Co_Tai_Nan');

  // Sheet 2: Khám định kỳ
  const checkupHeaders = [
    'STT',
    'Mã phiếu khám',
    'Ngày khám',
    'Năm học',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Chiều cao (cm)',
    'Cân nặng (kg)',
    'Chỉ số BMI',
    'Phân loại dinh dưỡng',
    'Huyết áp',
    'Mạch (l/p)',
    'Thị lực Mắt Trái (/10)',
    'Thị lực Mắt Phải (/10)',
    'Tật khúc xạ',
    'Răng - Hàm - Mặt',
    'Tai - Mũi - Họng',
    'Cột sống / Dáng đi',
    'Khuyến nghị gửi phụ huynh',
    'Bác sĩ / Cán bộ khám',
    'Ghi chú khác',
  ];

  const checkupRows = checkups.map((c, idx) => {
    const nutrition = c.nutritionStatus || (c as any).nutritionClassification || 'Bình thường';
    const visionL = c.eyesightLeft || (c as any).visionLeft || '10/10';
    const visionR = c.eyesightRight || (c as any).visionRight || '10/10';
    const refraction = c.hasRefraction
      ? ((c as any).refractiveError || 'Có tật khúc xạ')
      : ((c as any).refractiveError || 'Không');
    const dental = c.dentalCondition || (c as any).dentalStatus || 'Bình thường';
    const ent = c.entCondition || (c as any).entStatus || 'Bình thường';
    const spine = c.scoliosis ? 'Cong vẹo cột sống' : ((c as any).spineStatus || 'Bình thường');

    return [
      idx + 1,
      c.checkupCode,
      c.checkupDate ? formatDateVN(c.checkupDate) : '',
      c.schoolYear || '2026-2027',
      c.studentCode || '',
      c.studentName || '',
      c.className || '',
      c.height || 0,
      c.weight || 0,
      c.bmi || 0,
      nutrition,
      c.bloodPressure || '105/70',
      c.pulse ? `${c.pulse}` : '',
      String(visionL),
      String(visionR),
      refraction,
      dental,
      ent,
      spine,
      c.recommendations || '',
      c.doctorOrStaff || '',
      c.otherFindings || '',
    ];
  });

  const wsCheckups = createReportSheet(
    'BẢNG TỔNG HỢP KẾT QUẢ KHÁM SỨC KHỎE HỌC SINH ĐỊNH KỲ',
    `Năm học 2026 - 2027 (${checkups.length} học sinh)`,
    checkupHeaders,
    checkupRows
  );
  XLSX.utils.book_append_sheet(wb, wsCheckups, 'Kham_Suc_Khoe_Dinh_Ky');

  saveWorkbook(wb, `So_Tai_Nan_Va_Kham_Suc_Khoe_Dinh_Ky_${getFilenameDate()}.xlsx`);
}

// 20. Tải mẫu Excel chuẩn nhập sự cố tai nạn học đường
export function exportHealthEventsTemplateExcel() {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Mã sự kiện (nếu sửa)',
    'Thời gian xảy ra (YYYY-MM-DD HH:mm)',
    'Địa điểm',
    'Phân loại sự cố (Tai nạn/Chấn thương/Sốt cao/Ngất/Dị ứng/Dịch bệnh nghi ngờ/Sự cố khác)',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Diễn biến sự cố',
    'Tình trạng ban đầu',
    'Biện pháp sơ cứu / xử trí',
    'Người chứng kiến',
    'Cán bộ y tế thực hiện',
    'Kết quả xử trí',
    'Ghi chú',
  ];

  const sampleRows = [
    [
      'SK-2026-0001',
      '2026-09-09 09:40',
      'Sân bóng rổ trường',
      'Tai nạn',
      'HS0005',
      'Huỳnh Gia Huy',
      '7/1',
      'Trượt chân té ngã khi tranh bóng trong giờ giải lao',
      'Trầy xước chảy máu cẳng tay phải và gối trái',
      'Rửa sát khuẩn NaCl 0.9%, Povidone 10%, băng gạc vô trùng',
      'Thầy Tuấn (GV Thể dục)',
      'Đỗ Thị Mai Trang (Y tế học đường)',
      'Vết thương cầm máu tốt, học sinh tự đi lại được về lớp',
      'Đã nhắc nhở học sinh cẩn thận',
    ],
    [
      '',
      '2026-09-12 10:15',
      'Hành lang tầng 2',
      'Chấn thương',
      'HS0002',
      'Trần Thị Bích Ngọc',
      '6/1',
      'Vấp bậc cầu thang khi di chuyển sang phòng Tin học',
      'Sưng nhẹ mu bàn chân phải, đau khi đi lại',
      'Chườm lạnh túi gel 15 phút, thoa dầu xoa bóp, nghỉ ngơi tại giường y tế',
      'Bạn cùng lớp',
      'Đỗ Thị Mai Trang (Y tế học đường)',
      'Đỡ sưng, đi lại bình thường',
      'Bàn giao GVCN cuối buổi',
    ],
  ];

  const ws = createReportSheet(
    'MẪU NHẬP / ĐIỀU CHỈNH SỰ CỐ TAI NẠN THƯƠNG TÍCH HỌC ĐƯỜNG',
    'Hướng dẫn: Điền Mã sự kiện nếu muốn cập nhật dòng cũ, hoặc để trống để tạo sự cố mới.',
    headers,
    sampleRows
  );

  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Tai_Nan');
  saveWorkbook(wb, `Mau_Nhap_Dieu_Chinh_Tai_Nan_${getFilenameDate()}.xlsx`);
}

// 21. Tải mẫu Excel chuẩn nhập kết quả khám sức khỏe học sinh định kỳ
export function exportHealthCheckupsTemplateExcel() {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Mã phiếu khám (nếu sửa)',
    'Ngày khám (YYYY-MM-DD)',
    'Năm học',
    'Mã học sinh',
    'Họ và tên học sinh',
    'Lớp',
    'Chiều cao (cm)',
    'Cân nặng (kg)',
    'Thị lực Mắt Trái (/10)',
    'Thị lực Mắt Phải (/10)',
    'Tật khúc xạ (Không / Cận thị / Loạn thị...)',
    'Răng hàm mặt (Bình thường / Sâu răng...)',
    'Tai mũi họng (Bình thường / Viêm amiđan...)',
    'Cột sống (Bình thường / Cong vẹo...)',
    'Dinh dưỡng (Bình thường / Thừa cân / Béo phì / Suy dinh dưỡng)',
    'Huyết áp',
    'Khuyến nghị gửi phụ huynh',
    'Bác sĩ / Cán bộ khám',
  ];

  const sampleRows = [
    [
      'KS-2026-0001',
      '2026-09-05',
      '2026-09-05',
      'HS0001',
      'Nguyễn Văn An',
      '6/1',
      150,
      43,
      10,
      10,
      'Không',
      'Bình thường',
      'Bình thường',
      'Bình thường',
      'Bình thường',
      '105/70',
      'Duy trì rèn luyện thể thao hàng ngày',
      'Bs. Nguyễn Thanh Hà (TTYT Hóc Môn)',
    ],
    [
      '',
      '2026-09-05',
      '2026-09-05',
      'HS0002',
      'Trần Thị Bích Ngọc',
      '6/1',
      147,
      39,
      5,
      6,
      'Cận thị 1.5 diop',
      'Sâu răng nhẹ số 6 dưới',
      'Bình thường',
      'Bình thường',
      'Bình thường',
      '100/65',
      'Khuyên gia đình đưa cháu đo kính khúc xạ và khám nha khoa học đường',
      'Bs. Nguyễn Thanh Hà (TTYT Hóc Môn)',
    ],
  ];

  const ws = createReportSheet(
    'MẪU NHẬP / ĐIỀU CHỈNH KẾT QUẢ KHÁM SỨC KHỎE ĐỊNH KỲ',
    'Hướng dẫn: Điền Mã phiếu khám nếu muốn điều chỉnh phiếu cũ, hoặc để trống để tạo phiếu mới.',
    headers,
    sampleRows
  );

  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Kham_Dinh_Ky');
  saveWorkbook(wb, `Mau_Nhap_Dieu_Chinh_Kham_Dinh_Ky_${getFilenameDate()}.xlsx`);
}

// 22. Tải mẫu Excel chuẩn phân công Giáo viên chủ nhiệm (GVCN) theo lớp
export function exportHomeroomTeachersTemplateExcel() {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Tên lớp',
    'Khối',
    'Giáo viên chủ nhiệm (GVCN)',
    'Số điện thoại GVCN',
    'Phòng học',
  ];

  const sampleRows = [
    ['6/1', 6, 'Cô Nguyễn Thị Lan', '0908 112 233', 'Phòng 101 - Dãy A'],
    ['6/2', 6, 'Thầy Trần Minh Tuấn', '0913 223 344', 'Phòng 102 - Dãy A'],
    ['7/1', 7, 'Cô Lê Thị Mai', '0988 334 455', 'Phòng 201 - Dãy B'],
    ['7/2', 7, 'Cô Hoàng Thị Hoa', '0937 445 566', 'Phòng 202 - Dãy B'],
    ['7/3', 7, 'Thầy Phạm Văn Nam', '0918 556 677', 'Phòng 203 - Dãy B'],
    ['8/1', 8, 'Cô Vũ Thu Hương', '0979 667 788', 'Phòng 301 - Dãy C'],
    ['8/2', 8, 'Thầy Đặng Quang Huy', '0903 778 899', 'Phòng 302 - Dãy C'],
    ['9/1', 9, 'Cô Bùi Thanh Thảo', '0912 889 900', 'Phòng 401 - Dãy D'],
    ['9/2', 9, 'Thầy Ngô Quốc Bảo', '0983 990 011', 'Phòng 402 - Dãy D'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  ws['!cols'] = [
    { wch: 15 },
    { wch: 10 },
    { wch: 30 },
    { wch: 20 },
    { wch: 25 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'PhanCongGVCN');
  saveWorkbook(wb, `Mau_Phan_Cong_GVCN_Theo_Lop_${getFilenameDate()}.xlsx`);
}

// 23. Xuất danh sách lớp học và GVCN hiện tại ra Excel
export function exportClassesAndTeachersExcel(classes: SchoolClass[]) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'STT',
    'Tên lớp',
    'Khối',
    'Giáo viên chủ nhiệm (GVCN)',
    'Số điện thoại GVCN',
    'Phòng học',
    'Sĩ số học sinh',
  ];

  const rows = classes.map((c, idx) => [
    idx + 1,
    c.name,
    c.grade,
    c.homeroomTeacher || 'Chưa phân công',
    c.teacherPhone || '',
    c.room || '',
    c.totalStudents || 0,
  ]);

  const ws = createReportSheet(
    'DANH SÁCH LỚP HỌC & GIÁO VIÊN CHỦ NHIỆM - TRƯỜNG THCS ĐÔNG THẠNH',
    `Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')} • Tổng số: ${classes.length} lớp học`,
    headers,
    rows
  );

  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachLopGVCN');
  saveWorkbook(wb, `Danh_Sach_Lop_Va_GVCN_${getFilenameDate()}.xlsx`);
}

// 24. Xuất Sổ cấp phát thuốc & Khám tiếp nhận Giáo viên, Công nhân viên trường
export function exportStaffClinicVisitsExcel(visits: any[], filterInfo = '') {
  const wb = XLSX.utils.book_new();

  const headers = [
    'STT',
    'Mã ca khám',
    'Ngày giờ tiếp nhận',
    'Họ và tên CB-GV-NV',
    'Tổ bộ môn / Bộ phận',
    'Chức vụ',
    'Huyết áp (mmHg)',
    'Thân nhiệt (°C)',
    'Lý do / Triệu chứng lâm sàng',
    'Thuốc đã cấp phát & Liều lượng',
    'Vật tư y tế sơ cứu',
    'Biện pháp xử trí & Kết quả',
    'Cán bộ Y tế thực hiện',
    'Ghi chú',
  ];

  const dataRows = visits.map((v, idx) => {
    const medsStr = (v.medicinesUsed || v.medicinesDispensed || [])
      .map((m: any) => `${m.medicineName} (${m.quantity} ${m.unit || 'viên'}) - ${m.dosageInstructions || 'Theo chỉ định'}`)
      .join('; ');
    const supStr = (v.suppliesUsed || [])
      .map((s: any) => `${s.supplyName} (${s.quantity} ${s.unit || 'cái'})`)
      .join('; ');
    const reasonsStr = v.reason || (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason || '---');
    const vitalsStr = v.vitals?.bloodPressure || v.bloodPressure || '---';
    const tempStr = v.vitals?.temperature || v.temperature ? `${v.vitals?.temperature || v.temperature}°C` : '---';

    return [
      idx + 1,
      v.visitCode || '---',
      v.dateTime ? formatDateTimeVN(v.dateTime) : (v.visitDate ? `${v.timeIn ? v.timeIn + ' ' : ''}${formatDateVN(v.visitDate)}` : '---'),
      v.staffName || v.studentName || '---',
      v.department || v.className || '---',
      v.position || (v.recipientType === 'teacher' ? 'Giáo viên' : 'Nhân viên'),
      vitalsStr,
      tempStr,
      reasonsStr,
      medsStr || 'Không cấp thuốc',
      supStr || 'Không dùng',
      `${v.treatment || v.treatmentDetails || ''} • ${v.outcome || ''}`,
      v.performer || 'Nhân viên Y tế',
      v.notes || '',
    ];
  });

  const totalVisits = visits.length;
  const summaryRow = [
    'TỔNG CỘNG',
    `${totalVisits} lượt cấp thuốc`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ];

  const info = filterInfo || `Trường THCS Đông Thạnh • Tổng số lượt cấp phát: ${totalVisits} lượt`;

  const ws = createReportSheet(
    'SỔ THEO DÕI KHÁM & CẤP THUỐC GIÁO VIÊN - CÔNG NHÂN VIÊN TRƯỜNG',
    info,
    headers,
    dataRows,
    summaryRow
  );

  XLSX.utils.book_append_sheet(wb, ws, 'CapThuoc_GV_CNV');
  saveWorkbook(wb, `So_Cap_Thuoc_Giao_Vien_CNV_${getFilenameDate()}.xlsx`);
}

/**
 * Tải file mẫu chuẩn Excel Danh sách Giáo viên & Công nhân viên trường
 */
export function downloadStandardStaffTemplateExcel() {
  const headers = [
    'Mã GV/NV',
    'Họ và tên',
    'Giới tính',
    'Năm sinh',
    'Tổ chuyên môn / Phòng ban',
    'Chức vụ',
    'Số điện thoại',
    'Huyết áp nền',
    'Tiền sử dị ứng',
    'Bệnh nền / Cần lưu ý',
    'Ghi chú',
  ];

  const sampleRows = [
    [
      'GV01',
      'Đoàn Thị Minh Trang',
      'Nữ',
      1985,
      'Ban Giám Hiệu',
      'Hiệu trưởng',
      '0908 123 456',
      '115/75',
      'Không',
      'Đau nửa đầu khi căng thẳng',
      'Cần hạn chế uống thuốc gây buồn ngủ',
    ],
    [
      'GV02',
      'Trần Văn Nam',
      'Nam',
      1982,
      'Ban Giám Hiệu',
      'Phó Hiệu trưởng',
      '0912 345 678',
      '125/80',
      'Không',
      'Thoái hóa đốt sống cổ',
      '',
    ],
    [
      'GV03',
      'Nguyễn Thị Thu Hà',
      'Nữ',
      1988,
      'Tổ Toán - Tin',
      'Tổ trưởng',
      '0987 654 321',
      '110/70',
      'Dị ứng Penicillin',
      'Đau dạ dày nhẹ',
      'Không dùng thuốc giảm đau kích ứng dạ dày',
    ],
    [
      'GV04',
      'Lê Quang Huy',
      'Nam',
      1990,
      'Tổ Toán - Tin',
      'Giáo viên Tin học',
      '0978 112 233',
      '120/80',
      'Không',
      'Mỏi mắt do máy tính',
      '',
    ],
    [
      'GV05',
      'Phạm Thị Mai',
      'Nữ',
      1986,
      'Tổ Ngữ Văn',
      'Giáo viên Ngữ văn',
      '0933 445 566',
      '120/80',
      'Không',
      'Khản tiếng, viêm họng hạt',
      'Thường dùng kẹo ngậm thảo dược',
    ],
    [
      'NV01',
      'Trần Thị Cẩm Nhung',
      'Nữ',
      1991,
      'Văn phòng',
      'Kế toán',
      '0945 667 788',
      '110/70',
      'Không',
      'Đau mỏi vai gáy',
      '',
    ],
    [
      'NV02',
      'Võ Văn Hùng',
      'Nam',
      1978,
      'Bảo vệ - Phục vụ',
      'Nhân viên Bảo vệ',
      '0903 778 899',
      '135/85',
      'Không',
      'Tăng huyết áp nhẹ',
      'Cần đo huyết áp định kỳ',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSach_GV_CNV');

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Mã GV/NV
    { wch: 28 }, // Họ và tên
    { wch: 12 }, // Giới tính
    { wch: 12 }, // Năm sinh
    { wch: 28 }, // Tổ chuyên môn
    { wch: 20 }, // Chức vụ
    { wch: 16 }, // SĐT
    { wch: 15 }, // Huyết áp nền
    { wch: 22 }, // Dị ứng
    { wch: 30 }, // Bệnh nền
    { wch: 35 }, // Ghi chú
  ];

  saveWorkbook(wb, 'File_Mau_Import_Giao_Vien_Cong_Nhan_Vien_THCS.xlsx');
}

/**
 * Xuất danh bạ Giáo viên & CNV ra tệp Excel (.xlsx)
 */
export function exportStaffMembersExcel(staffList: SchoolStaff[]) {
  const wb = XLSX.utils.book_new();
  const headers = [
    'STT',
    'Mã nhân sự',
    'Họ và tên',
    'Giới tính',
    'Năm sinh / Ngày sinh',
    'Tổ chuyên môn / Phòng ban',
    'Chức vụ',
    'Số điện thoại',
    'Huyết áp nền',
    'Tiền sử dị ứng',
    'Bệnh nền / Lưu ý sức khỏe',
    'Ghi chú',
  ];

  const dataRows = staffList.map((s, idx) => [
    idx + 1,
    s.staffCode || `GV${idx + 1}`,
    s.fullName,
    s.gender || '---',
    s.birthYear || s.birthDate || '---',
    s.department,
    s.position || '---',
    s.phone || '---',
    s.bloodPressureBaseline || '---',
    s.allergies || 'Không',
    s.chronicConditions || 'Không',
    s.notes || '',
  ]);

  const ws = createReportSheet(
    'DANH BẠ CÁN BỘ - GIÁO VIÊN - CÔNG NHÂN VIÊN VÀ HỒ SƠ SỨC KHỎE',
    `Trường THCS Đông Thạnh • Tổng số: ${staffList.length} nhân sự`,
    headers,
    dataRows,
    ['TỔNG CỘNG', `${staffList.length} cán bộ, giáo viên, nhân viên`]
  );

  XLSX.utils.book_append_sheet(wb, ws, 'DanhBa_GV_CNV');
  saveWorkbook(wb, `Danh_Ba_Giao_Vien_CNV_${getFilenameDate()}.xlsx`);
}


