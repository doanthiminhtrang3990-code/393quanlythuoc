import { InventoryCheck, InventoryTransaction, MedicineBatch, StockInOutBalanceRow, MedicineDisposal, ClinicVisit } from '../types';
import { formatDateVN, formatVND, formatTime24H, formatDateTimeVN } from '../utils/helpers';
import { templateConfigService } from './templateConfigService';

interface PrintHeaderConfig {
  schoolName?: string;
  department?: string;
  title: string;
  subtitle?: string;
  code?: string;
}

export function openPrintWindow(htmlContent: string, landscape = false, title = 'In Mẫu Sổ A4 - Trường THCS Đông Thạnh') {
  const orientation = landscape ? 'landscape' : 'portrait';

  const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>In Mẫu Sổ A4 - Trường THCS Đông Thạnh</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 12mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "Times New Roman", Times, serif, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.35;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 10px;
    }
    .print-actions {
      text-align: center;
      margin-bottom: 20px;
      padding: 10px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
    }
    .print-actions button {
      background: #0284c7;
      color: #fff;
      border: none;
      padding: 8px 18px;
      font-size: 14px;
      font-weight: bold;
      border-radius: 4px;
      cursor: pointer;
      margin: 0 6px;
    }
    .print-actions button.close {
      background: #64748b;
    }
    @media print {
      .print-actions {
        display: none !important;
      }
      body {
        padding: 0;
      }
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    .header-table td {
      vertical-align: top;
      border: none;
      padding: 2px 0;
    }
    .header-left {
      text-align: center;
      width: 45%;
    }
    .header-right {
      text-align: center;
      width: 55%;
    }
    .unit-name {
      font-size: 10.5pt;
      text-transform: uppercase;
      font-weight: bold;
    }
    .school-name {
      font-size: 11pt;
      text-transform: uppercase;
      font-weight: bold;
      color: #000;
    }
    .divider-line {
      width: 120px;
      height: 1px;
      background: #000;
      margin: 4px auto 0 auto;
    }
    .national-title {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .national-motto {
      font-size: 11pt;
      font-weight: bold;
      font-style: italic;
    }
    .doc-title {
      text-align: center;
      font-size: 15pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 15px 0 4px 0;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 11pt;
      font-style: italic;
      margin-bottom: 12px;
    }
    .meta-box {
      margin-bottom: 12px;
      font-size: 11pt;
    }
    .meta-box p {
      margin: 4px 0;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 10pt;
    }
    table.data-table th,
    table.data-table td {
      border: 1px solid #000;
      padding: 5px 6px;
      vertical-align: middle;
    }
    table.data-table th {
      background-color: #e2e8f0;
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .signatures-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 25px;
      page-break-inside: avoid;
    }
    .signatures-table td {
      border: none;
      vertical-align: top;
      text-align: center;
      width: 33.33%;
      padding: 4px;
    }
    .signature-title {
      font-weight: bold;
      font-size: 10.5pt;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .signature-sub {
      font-style: italic;
      font-size: 9.5pt;
      color: #333;
    }
    .signature-space {
      height: 70px;
    }
    .signature-name {
      font-weight: bold;
      font-size: 10.5pt;
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button onclick="window.print()">🖨️ In Mẫu Sổ / Xuất PDF (A4)</button>
    <button class="close" onclick="window.close()">Đóng Cửa Sổ</button>
  </div>
  ${htmlContent}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try { window.print(); } catch(e) {}
      }, 500);
    });
  </script>
</body>
</html>`;

  // Method 1: Blob URL with anchor click (reliable in iframes)
  try {
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  } catch (err) {
    console.warn('Blob window open failed, fallback:', err);
  }

  // Method 2: Standard window.open
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      return;
    }
  } catch (err) {
    console.warn('window.open failed:', err);
  }

  // Method 3: Hidden iframe print
  try {
    let iframe = document.getElementById('__hidden_print_frame__') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = '__hidden_print_frame__';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print failed:', e);
        }
      }, 500);
    }
  } catch (e) {
    console.warn('Iframe fallback error:', e);
  }
}

export function downloadPrintHtml(htmlContent: string, fileName: string, landscape = false) {
  const orientation = landscape ? 'landscape' : 'portrait';
  const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    @page { size: A4 ${orientation}; margin: 12mm 15mm 15mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: "Times New Roman", Times, serif, Arial, sans-serif; font-size: 11pt; line-height: 1.35; color: #000; background: #fff; margin: 0; padding: 10px; }
    .print-actions { text-align: center; margin-bottom: 20px; padding: 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-family: sans-serif; }
    .print-actions button { background: #047857; color: #fff; border: none; padding: 8px 18px; font-size: 14px; font-weight: bold; border-radius: 4px; cursor: pointer; margin: 0 6px; }
    @media print { .print-actions { display: none !important; } body { padding: 0; } }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .header-table td { vertical-align: top; border: none; padding: 2px 0; }
    .header-left { text-align: center; width: 45%; }
    .header-right { text-align: center; width: 55%; }
    .unit-name { font-size: 10.5pt; text-transform: uppercase; font-weight: bold; }
    .school-name { font-size: 11pt; text-transform: uppercase; font-weight: bold; }
    .national-title { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; }
    .national-motto { font-size: 11pt; font-weight: bold; }
    .divider-line { width: 60px; height: 1px; background: #000; margin: 4px auto; }
    .doc-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 12px 0 4px 0; }
    .doc-subtitle { text-align: center; font-size: 10.5pt; font-style: italic; margin-bottom: 12px; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .data-table th, .data-table td { border: 1px solid #000; padding: 5px 6px; font-size: 10pt; }
    .data-table th { background: #f1f5f9; font-weight: bold; text-align: center; }
    .signature-grid { display: flex; justify-content: space-between; margin-top: 30px; page-break-inside: avoid; }
    .signature-col { text-align: center; width: 45%; }
    .signature-title { font-weight: bold; text-transform: uppercase; font-size: 10.5pt; }
    .signature-sub { font-style: italic; font-size: 9.5pt; color: #333; }
    .signature-space { height: 70px; }
    .signature-name { font-weight: bold; font-size: 10.5pt; }
  </style>
</head>
<body>
  <div class="print-actions">
    <button onclick="window.print()">🖨️ In Mẫu Sổ / Xuất PDF (A4)</button>
  </div>
  ${htmlContent}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Xuất văn bản Microsoft Word (.doc) cho phép mở và chỉnh sửa trực tiếp trong Microsoft Word
export function downloadWordDoc(
  htmlContent: string,
  fileName: string,
  landscape = false,
  fontSize = '11pt'
) {
  const isLandscape = landscape;
  const wordHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${fileName}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: ${isLandscape ? '841.9pt 595.3pt' : '595.3pt 841.9pt'};
      margin: 15mm 15mm 15mm 15mm;
      mso-header-margin: 36.0pt;
      mso-footer-margin: 36.0pt;
      mso-paper-source: 0;
      mso-page-orientation: ${isLandscape ? 'landscape' : 'portrait'};
    }
    div.Section1 { page: Section1; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: ${fontSize};
      line-height: 1.35;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 8pt 0;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    table.header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12pt;
    }
    table.header-table td {
      border: none;
      vertical-align: top;
      padding: 2pt 4pt;
    }
    .header-left { text-align: center; width: 45%; }
    .header-right { text-align: center; width: 55%; }
    .unit-name { font-size: 10.5pt; text-transform: uppercase; font-weight: bold; }
    .school-name { font-size: 11pt; text-transform: uppercase; font-weight: bold; }
    .national-title { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; }
    .national-motto { font-size: 11pt; font-weight: bold; }
    .divider-line { width: 100pt; height: 1pt; background: #000; margin: 4pt auto; }
    .doc-title { text-align: center; font-size: 15pt; font-weight: bold; text-transform: uppercase; margin: 12pt 0 4pt 0; }
    .doc-subtitle { text-align: center; font-size: 11pt; font-style: italic; margin-bottom: 12pt; }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0;
    }
    table.data-table th, table.data-table td {
      border: 1pt solid #000000;
      padding: 5pt 6pt;
      font-size: 10pt;
      vertical-align: middle;
    }
    table.data-table th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: center;
    }
    .signature-grid, table.signatures-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 25pt;
      page-break-inside: avoid;
    }
    .signature-grid td, table.signatures-table td {
      border: none;
      vertical-align: top;
      text-align: center;
      padding: 4pt;
    }
    .signature-title { font-weight: bold; text-transform: uppercase; font-size: 10.5pt; }
    .signature-sub { font-style: italic; font-size: 9.5pt; color: #333333; }
    .signature-space { height: 60pt; }
    .signature-name { font-weight: bold; font-size: 10.5pt; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
  </style>
</head>
<body>
  <div class="Section1">
    ${htmlContent}
  </div>
</body>
</html>`;

  const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.doc') ? fileName : `${fileName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function renderHeader(config: PrintHeaderConfig) {
  const cfg = templateConfigService.getConfig();
  const dateStr = templateConfigService.getDateString(cfg);
  return `
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="unit-name">${cfg.governingBody || 'PHÒNG GD&ĐT HUYỆN HÓC MÔN'}</div>
          <div class="school-name">${config.schoolName || cfg.schoolName || 'TRƯỜNG THCS ĐÔNG THẠNH'}</div>
          <div>${config.department || cfg.department || 'Bộ phận: Y TẾ HỌC ĐƯỜNG'}</div>
          <div class="divider-line"></div>
        </td>
        <td class="header-right">
          <div class="national-title">${cfg.nationalTitle || 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}</div>
          <div class="national-motto">${cfg.nationalMotto || 'Độc lập - Tự do - Hạnh phúc'}</div>
          <div class="divider-line"></div>
          <div style="font-style: italic; font-size: 10pt; margin-top: 6px;">
            ${dateStr}
          </div>
        </td>
      </tr>
    </table>
    <div class="doc-title">${config.title}</div>
    ${config.subtitle ? `<div class="doc-subtitle">${config.subtitle}</div>` : ''}
    ${config.code ? `<div style="text-align: center; font-weight: bold; margin-bottom: 8px;">Mã số: ${config.code}</div>` : ''}
  `;
}

export function renderSignaturesTable(customSigners?: {
  title1?: string;
  sub1?: string;
  name1?: string;
  title2?: string;
  sub2?: string;
  name2?: string;
  showSigner3?: boolean;
  title3?: string;
  sub3?: string;
  name3?: string;
}) {
  const cfg = templateConfigService.getConfig();
  const title1 = customSigners?.title1 || cfg.signatory1Title || 'CÁN BỘ Y TẾ';
  const sub1 = customSigners?.sub1 || cfg.signatory1Sub || '(Ký và ghi rõ họ tên)';
  const name1 = customSigners?.name1 || cfg.signatory1Name || 'Y sĩ Trần Thị Bích Thảo';

  const title2 = customSigners?.title2 || cfg.signatory2Title || 'HIỆU TRƯỞNG';
  const sub2 = customSigners?.sub2 || cfg.signatory2Sub || '(Ký, đóng dấu và ghi rõ họ tên)';
  const name2 = customSigners?.name2 || cfg.signatory2Name || 'Ban Giám Hiệu';

  const show3 = customSigners?.showSigner3 ?? cfg.showSignatory3;
  const title3 = customSigners?.title3 || cfg.signatory3Title || 'KẾ TOÁN / THỦ KHO';
  const sub3 = customSigners?.sub3 || cfg.signatory3Sub || '(Ký và ghi rõ họ tên)';
  const name3 = customSigners?.name3 || cfg.signatory3Name || 'Đại diện kiểm soát';

  if (show3) {
    return `
      <table class="signatures-table">
        <tr>
          <td>
            <div class="signature-title">${title1}</div>
            <div class="signature-sub">${sub1}</div>
            <div class="signature-space"></div>
            <div class="signature-name">${name1}</div>
          </td>
          <td>
            <div class="signature-title">${title3}</div>
            <div class="signature-sub">${sub3}</div>
            <div class="signature-space"></div>
            <div class="signature-name">${name3}</div>
          </td>
          <td>
            <div class="signature-title">${title2}</div>
            <div class="signature-sub">${sub2}</div>
            <div class="signature-space"></div>
            <div class="signature-name">${name2}</div>
          </td>
        </tr>
      </table>
    `;
  }

  return `
    <table class="signatures-table">
      <tr>
        <td>
          <div class="signature-title">${title1}</div>
          <div class="signature-sub">${sub1}</div>
          <div class="signature-space"></div>
          <div class="signature-name">${name1}</div>
        </td>
        <td>
          <div class="signature-title">${title2}</div>
          <div class="signature-sub">${sub2}</div>
          <div class="signature-space"></div>
          <div class="signature-name">${name2}</div>
        </td>
      </tr>
    </table>
  `;
}

// 1. In Sổ Nhập - Xuất - Tồn A4 Landscape
export function printStockBalanceA4(
  rows: StockInOutBalanceRow[],
  periodLabel: string,
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const content = `
    ${renderHeader({
      schoolName,
      title: 'SỔ THEO DÕI NHẬP - XUẤT - TỒN THUỐC VÀ VẬT TƯ Y TẾ',
      subtitle: `Kỳ báo cáo: ${periodLabel}`,
    })}

    <table class="data-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 35px;">STT</th>
          <th rowspan="2" style="width: 80px;">Mã thuốc</th>
          <th rowspan="2">Tên thuốc, nồng độ, hàm lượng</th>
          <th rowspan="2" style="width: 75px;">Số lô</th>
          <th rowspan="2" style="width: 75px;">Hạn dùng</th>
          <th rowspan="2" style="width: 50px;">ĐVT</th>
          <th rowspan="2" style="width: 60px;">Tồn đầu kỳ</th>
          <th colspan="2">Phát sinh trong kỳ</th>
          <th rowspan="2" style="width: 60px;">Điều chỉnh</th>
          <th rowspan="2" style="width: 60px;">Tồn cuối kỳ</th>
          <th rowspan="2" style="width: 90px;">Vị trí lưu trữ</th>
        </tr>
        <tr>
          <th style="width: 60px;">Nhập (+)</th>
          <th style="width: 60px;">Xuất (-)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td class="text-center font-bold">${r.medicineCode}</td>
            <td>${r.medicineName}</td>
            <td class="text-center font-bold">${r.batchNumber}</td>
            <td class="text-center">${formatDateVN(r.expDate)}</td>
            <td class="text-center">${r.unit}</td>
            <td class="text-right font-bold">${r.openingStock}</td>
            <td class="text-right" style="color: #047857;">${r.importQuantity > 0 ? '+' + r.importQuantity : '0'}</td>
            <td class="text-right" style="color: #b91c1c;">${r.exportQuantity > 0 ? '-' + r.exportQuantity : '0'}</td>
            <td class="text-right">${r.adjustmentQuantity !== 0 ? (r.adjustmentQuantity > 0 ? '+' + r.adjustmentQuantity : r.adjustmentQuantity) : '0'}</td>
            <td class="text-right font-bold" style="background: #f8fafc;">${r.closingStock}</td>
            <td class="text-left" style="font-size: 9pt;">${r.notes || 'Tủ thuốc y tế'}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold; background: #f1f5f9;">
          <td colspan="6" class="text-center">TỔNG CỘNG (${rows.length} mục)</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.openingStock, 0)}</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.importQuantity, 0)}</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.exportQuantity, 0)}</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.adjustmentQuantity, 0)}</td>
          <td class="text-right font-bold">${rows.reduce((s, r) => s + r.closingStock, 0)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    ${renderSignaturesTable()}
  `;

  openPrintWindow(content, true); // Landscape for wide tables
}

// Xuất file Microsoft Word (.doc) cho Sổ theo dõi Nhập - Xuất - Tồn
export function exportStockBalanceWordA4(
  rows: StockInOutBalanceRow[],
  periodLabel: string,
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const content = `
    ${renderHeader({
      schoolName,
      title: 'SỔ THEO DÕI NHẬP - XUẤT - TỒN THUỐC VÀ VẬT TƯ Y TẾ',
      subtitle: `Kỳ báo cáo: ${periodLabel}`,
    })}

    <table class="data-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 35px;">STT</th>
          <th rowspan="2" style="width: 80px;">Mã thuốc</th>
          <th rowspan="2">Tên thuốc, nồng độ, hàm lượng</th>
          <th rowspan="2" style="width: 75px;">Số lô</th>
          <th rowspan="2" style="width: 75px;">Hạn dùng</th>
          <th rowspan="2" style="width: 50px;">ĐVT</th>
          <th rowspan="2" style="width: 60px;">Tồn đầu kỳ</th>
          <th colspan="2">Phát sinh trong kỳ</th>
          <th rowspan="2" style="width: 60px;">Điều chỉnh</th>
          <th rowspan="2" style="width: 60px;">Tồn cuối kỳ</th>
          <th rowspan="2" style="width: 90px;">Vị trí lưu trữ</th>
        </tr>
        <tr>
          <th style="width: 60px;">Nhập (+)</th>
          <th style="width: 60px;">Xuất (-)</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, idx) => `
          <tr>
            <td class="text-center">${idx + 1}</td>
            <td class="text-center font-bold">${r.medicineCode}</td>
            <td>${r.medicineName}</td>
            <td class="text-center font-mono">${r.batchNumber}</td>
            <td class="text-center">${formatDateVN(r.expDate)}</td>
            <td class="text-center">${r.unit}</td>
            <td class="text-right">${r.openingStock}</td>
            <td class="text-right text-emerald-600">${r.importQuantity > 0 ? '+' + r.importQuantity : '0'}</td>
            <td class="text-right text-rose-600">${r.exportQuantity > 0 ? '-' + r.exportQuantity : '0'}</td>
            <td class="text-right text-amber-600">${r.adjustmentQuantity !== 0 ? (r.adjustmentQuantity > 0 ? '+' : '') + r.adjustmentQuantity : '0'}</td>
            <td class="text-right font-bold">${r.closingStock}</td>
            <td class="text-center">${r.notes || 'Tủ thuốc y tế'}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold; background: #f1f5f9;">
          <td colspan="6" class="text-center">TỔNG CỘNG (${rows.length} mục)</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.openingStock, 0)}</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.importQuantity, 0)}</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.exportQuantity, 0)}</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.adjustmentQuantity, 0)}</td>
          <td class="text-right font-bold">${rows.reduce((s, r) => s + r.closingStock, 0)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    ${renderSignaturesTable()}
  `;

  downloadWordDoc(content, `So_Nhap_Xuat_Ton_Kho_Y_Te_${periodLabel.replace(/\s+/g, '_')}`, true);
}

// 2. In Biên Bản Kiểm Kê A4 Portrait
export function printInventoryCheckA4(check: InventoryCheck, schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH') {
  const content = `
    ${renderHeader({
      schoolName,
      title: 'BIÊN BẢN KIỂM KÊ THUỐC VÀ VẬT TƯ Y TẾ',
      subtitle: `Thời điểm kiểm kê: ${check.checkTime || '---'}, ngày ${formatDateVN(check.checkDate)}`,
      code: check.checkCode,
    })}

    <div class="meta-box">
      <p><strong>1. Hội đồng kiểm kê gồm có:</strong></p>
      <ul style="margin: 4px 0 10px 20px; padding: 0;">
        ${(check.participants || ['Cán bộ Y tế học đường', 'Ban Giám Hiệu', 'Đại diện kế toán'])
          .map((p) => `<li>${p}</li>`)
          .join('')}
      </ul>
      <p><strong>2. Người lập biên bản:</strong> ${check.performer}</p>
      <p><strong>3. Trạng thái biên bản:</strong> ${
        check.status === 'adjusted'
          ? 'ĐÃ ĐIỀU CHỈNH TỒN KHO THỰC TẾ'
          : check.status === 'confirmed'
          ? 'ĐÃ XÁC NHẬN BỞI BAN KIỂM KÊ'
          : 'DỰ THẢO / ĐANG XỬ LÝ'
      } ${check.confirmedBy ? `(Người duyệt: ${check.confirmedBy})` : ''}</p>
      ${check.notes ? `<p><strong>4. Nhận xét / Đề xuất:</strong> ${check.notes}</p>` : ''}
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th style="width: 75px;">Mã thuốc</th>
          <th>Tên thuốc / Nồng độ</th>
          <th style="width: 75px;">Số lô</th>
          <th style="width: 75px;">Hạn dùng</th>
          <th style="width: 50px;">ĐVT</th>
          <th style="width: 60px;">Tồn sổ sách</th>
          <th style="width: 60px;">Thực kiểm</th>
          <th style="width: 60px;">Chênh lệch</th>
          <th style="width: 80px;">Chất lượng</th>
          <th>Lý do chênh lệch & Xử lý</th>
        </tr>
      </thead>
      <tbody>
        ${check.items
          .map(
            (it, i) => `
          <tr ${it.difference !== 0 ? 'style="background: #fffbeb;"' : ''}>
            <td class="text-center">${i + 1}</td>
            <td class="text-center font-bold">${it.medicineCode}</td>
            <td>${it.medicineName}</td>
            <td class="text-center font-bold">${it.batchNumber}</td>
            <td class="text-center">${formatDateVN(it.expDate)}</td>
            <td class="text-center">${it.unit}</td>
            <td class="text-right">${it.bookQuantity}</td>
            <td class="text-right font-bold">${it.actualQuantity}</td>
            <td class="text-right font-bold" style="color: ${it.difference < 0 ? '#dc2626' : it.difference > 0 ? '#16a34a' : '#000'};">
              ${it.difference > 0 ? '+' + it.difference : it.difference}
            </td>
            <td class="text-center">${it.qualityStatus === 'damaged' ? 'Hỏng/kém phẩm chất' : it.qualityStatus === 'expired' ? 'Hết hạn' : 'Tốt'}</td>
            <td style="font-size: 9pt;">${it.reason || (it.difference === 0 ? 'Khớp số liệu' : 'Cần rà soát')}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold; background: #f1f5f9;">
          <td colspan="6" class="text-center">TỔNG CỘNG</td>
          <td class="text-right">${check.items.reduce((s, it) => s + it.bookQuantity, 0)}</td>
          <td class="text-right">${check.items.reduce((s, it) => s + it.actualQuantity, 0)}</td>
          <td class="text-right">${check.items.reduce((s, it) => s + it.difference, 0)}</td>
          <td colspan="2" class="text-center">Số mục lệch: ${check.items.filter((it) => it.difference !== 0).length}</td>
        </tr>
      </tfoot>
    </table>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="signature-title">CÁN BỘ Y TẾ</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${check.performer}</div>
        </td>
        <td>
          <div class="signature-title">ĐẠI DIỆN HỘI ĐỒNG KIỂM KÊ</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">Thành viên Ban kiểm kê</div>
        </td>
        <td>
          <div class="signature-title">HIỆU TRƯỞNG</div>
          <div class="signature-sub">(Ký, đóng dấu và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${check.confirmedBy || 'Ban Giám Hiệu'}</div>
        </td>
      </tr>
    </table>
  `;

  openPrintWindow(content, false); // Portrait
}

// 3. In Phiếu Nhập / Phiếu Xuất A4 Portrait
export function printTransactionA4(tx: InventoryTransaction, schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH') {
  const isImport = tx.type === 'import';
  const title = isImport ? 'PHIẾU NHẬP KHO THUỐC VÀ VẬT TƯ Y TẾ' : 'PHIẾU XUẤT / CẤP PHÁT THUỐC HỌC ĐƯỜNG';

  const content = `
    ${renderHeader({
      schoolName,
      title,
      subtitle: `Ngày thực hiện: ${formatDateVN(tx.date)}`,
      code: tx.transactionCode,
    })}

    <div class="meta-box">
      ${
        isImport
          ? `
        <p><strong>Nguồn cấp / Đơn vị cung cấp:</strong> ${tx.source || 'Nhà thuốc / Trung tâm y tế'}</p>
        <p><strong>Người giao hàng:</strong> ${tx.deliverer || 'Đại diện nhà cung ứng'} | <strong>Người nhận:</strong> ${tx.receiver || tx.performer}</p>
        <p><strong>Cán bộ y tế lập phiếu:</strong> ${tx.performer}</p>
      `
          : `
        <p><strong>Họ và tên người nhận / sử dụng:</strong> ${tx.recipientName || '---'} ${tx.recipientClass ? `(Lớp: ${tx.recipientClass})` : ''}</p>
        <p><strong>Đối tượng:</strong> ${tx.recipientType === 'student' ? 'Học sinh' : tx.recipientType === 'teacher' ? 'Giáo viên' : 'Cán bộ / Khác'}</p>
        <p><strong>Lý do / Mục đích cấp phát:</strong> ${tx.purpose || 'Xử lý sơ cấp cứu học sinh'}</p>
        <p><strong>Cán bộ y tế thực hiện:</strong> ${tx.performer}</p>
      `
      }
      ${tx.notes ? `<p><strong>Ghi chú:</strong> ${tx.notes}</p>` : ''}
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th style="width: 80px;">Mã thuốc</th>
          <th>Tên thuốc, nồng độ, quy cách</th>
          <th style="width: 80px;">Số lô</th>
          <th style="width: 80px;">Hạn sử dụng</th>
          <th style="width: 50px;">ĐVT</th>
          <th style="width: 65px;">Số lượng</th>
        </tr>
      </thead>
      <tbody>
        ${tx.items
          .map(
            (it, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td class="text-center font-bold">${it.medicineCode}</td>
            <td>${it.medicineName}</td>
            <td class="text-center font-bold">${it.batchNumber}</td>
            <td class="text-center">${formatDateVN(it.expDate || '')}</td>
            <td class="text-center">${it.unit}</td>
            <td class="text-right font-bold">${it.quantity}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold; background: #f1f5f9;">
          <td colspan="6" class="text-center">TỔNG CỘNG</td>
          <td class="text-right font-bold">${tx.items.reduce((s, it) => s + it.quantity, 0)}</td>
        </tr>
      </tfoot>
    </table>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="signature-title">${isImport ? 'NGƯỜI GIAO HÀNG' : 'NGƯỜI NHẬN THUỐC'}</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${isImport ? tx.deliverer || 'Đại diện nhà xe/NCC' : tx.recipientName || 'Người nhận'}</div>
        </td>
        <td>
          <div class="signature-title">CÁN BỘ Y TẾ</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${tx.performer}</div>
        </td>
        <td>
          <div class="signature-title">BAN GIÁM HIỆU</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">Hiệu Trưởng duyệt</div>
        </td>
      </tr>
    </table>
  `;

  openPrintWindow(content, false);
}

// 4. In Báo Cáo Hạn Sử Dụng / Đề Nghị Tiêu Hủy A4 Portrait
export function printExpiryReportA4(
  batches: (MedicineBatch & { medicineName?: string; unit?: string; medicineCode?: string })[],
  reportType: 'expired' | 'expiring_soon',
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const isExpired = reportType === 'expired';
  const title = isExpired
    ? 'DANH SÁCH THUỐC HẾT HẠN SỬ DỤNG - ĐỀ NGHỊ TIÊU HỦY'
    : 'DANH SÁCH THUỐC CẢNH BÁO SẮP HẾT HẠN DÙNG (CẦN ƯU TIÊN SỬ DỤNG)';

  const content = `
    ${renderHeader({
      schoolName,
      title,
      subtitle: `Thời điểm xuất báo cáo: ${formatDateVN(new Date().toISOString().split('T')[0])}`,
    })}

    <div class="meta-box">
      <p>Căn cứ quy chế quản lý thuốc và trang thiết bị y tế học đường hiện hành;</p>
      <p>Bộ phận Y tế học đường kính trình Ban Giám Hiệu danh sách các mặt hàng thuốc ${
        isExpired ? 'đã hết hạn sử dụng cần thực hiện niêm phong và tiêu hủy' : 'sắp hết hạn dùng cần ưu tiên cấp phát theo nguyên tắc FEFO'
      }:</p>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th style="width: 75px;">Mã thuốc</th>
          <th>Tên thuốc / Hoạt chất</th>
          <th style="width: 80px;">Số lô</th>
          <th style="width: 80px;">Hạn dùng</th>
          <th style="width: 50px;">ĐVT</th>
          <th style="width: 65px;">Số lượng</th>
          <th>Đề xuất xử lý</th>
        </tr>
      </thead>
      <tbody>
        ${batches
          .map(
            (b, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td class="text-center font-bold">${b.medicineCode || '---'}</td>
            <td>${b.medicineName || 'Thuốc'}</td>
            <td class="text-center font-bold">${b.batchNumber}</td>
            <td class="text-center font-bold" style="color: #dc2626;">${formatDateVN(b.expDate)}</td>
            <td class="text-center">${b.unit || 'Đơn vị'}</td>
            <td class="text-right font-bold">${b.quantity}</td>
            <td style="font-size: 9pt;">${isExpired ? 'Niêm phong chờ tiêu hủy' : 'Ưu tiên xuất theo FEFO'}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold; background: #f1f5f9;">
          <td colspan="6" class="text-center">TỔNG CỘNG (${batches.length} lô)</td>
          <td class="text-right font-bold">${batches.reduce((s, b) => s + b.quantity, 0)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <table class="signatures-table">
      <tr>
        <td>
          <div class="signature-title">CÁN BỘ Y TẾ</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">Người lập danh sách</div>
        </td>
        <td>
          <div class="signature-title">ĐẠI DIỆN CÔNG ĐOÀN / THANH TRA</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">Thành viên giám sát</div>
        </td>
        <td>
          <div class="signature-title">HIỆU TRƯỞNG</div>
          <div class="signature-sub">(Ký, đóng dấu duyệt phương án)</div>
          <div class="signature-space"></div>
          <div class="signature-name">Ban Giám Hiệu Nhà Trường</div>
        </td>
      </tr>
    </table>
  `;

  openPrintWindow(content, false);
}

// 7. In Biên Bản Tiêu Hủy Thuốc A4 Chuẩn Bộ Y Tế & GDĐT
export function printDisposalReportA4(
  disposal: MedicineDisposal,
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const totalQty = (disposal.items || []).reduce((s, i) => s + (i.disposalQuantity || 0), 0);

  const content = `
    ${renderHeader({
      schoolName,
      title: 'BIÊN BẢN TIÊU HỦY THUỐC VÀ VẬT TƯ Y TẾ HẾT HẠN',
      subtitle: `Số biên bản: ${disposal.disposalCode} • Ngày lập: ${formatDateVN(disposal.disposalDate)}`,
      code: disposal.disposalCode,
    })}

    <div class="meta-box">
      <p>Căn cứ Thông tư liên tịch số 13/2016/TTLT-BYT-BGDĐT ngày 12/5/2016 của Bộ Y tế và Bộ Giáo dục & Đào tạo quy định về công tác y tế trường học;</p>
      <p>Căn cứ Quyết định số <strong>${disposal.decisionNumber || '18/QĐ-THCSĐT'}</strong> ${
        disposal.decisionDate ? `ngày ${formatDateVN(disposal.decisionDate)}` : ''
      } của Hiệu trưởng Trường THCS Đông Thạnh về việc thành lập Hội đồng tiêu hủy thuốc và vật tư y tế hết hạn sử dụng;</p>
      <p style="margin-top: 6px;">Hôm nay, ngày ${formatDateVN(disposal.disposalDate)}, tại ${
        disposal.disposalLocation || 'Phòng Y tế Trường THCS Đông Thạnh'
      }, Hội đồng tiến hành lập biên bản tiêu hủy gồm có:</p>
      
      <table style="width: 100%; margin: 8px 0 10px 0; border: none; font-size: 10pt;">
        ${(disposal.councilMembers || [])
          .map(
            (m, i) => `
          <tr>
            <td style="padding: 2px 0; width: 30px;">${i + 1}.</td>
            <td style="padding: 2px 0; width: 230px;">Ông/Bà: <strong>${m.name}</strong></td>
            <td style="padding: 2px 0; width: 220px;">Chức vụ: ${m.position}</td>
            <td style="padding: 2px 0;">Vai trò: <strong>${m.roleTitle}</strong></td>
          </tr>
        `
          )
          .join('')}
      </table>

      <p><strong>Phương pháp tiêu hủy:</strong> ${disposal.disposalMethod || 'Ngâm hóa chất vô hiệu hóa và chôn lấp hợp vệ sinh theo quy định môi trường y tế.'}</p>
      ${disposal.witnessNotes ? `<p><strong>Ghi nhận giám sát:</strong> ${disposal.witnessNotes}</p>` : ''}
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th style="width: 75px;">Mã thuốc</th>
          <th>Tên thuốc, nồng độ, hoạt chất</th>
          <th style="width: 75px;">Số lô</th>
          <th style="width: 75px;">Hạn dùng</th>
          <th style="width: 50px;">ĐVT</th>
          <th style="width: 65px;">Số lượng</th>
          <th style="width: 140px;">Lý do tiêu hủy</th>
        </tr>
      </thead>
      <tbody>
        ${(disposal.items || [])
          .map(
            (item, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td class="text-center font-bold">${item.medicineCode}</td>
            <td>
              <strong>${item.medicineName}</strong>
              ${item.activeIngredient ? `<div style="font-size: 9pt; color: #475569;">${item.activeIngredient}</div>` : ''}
            </td>
            <td class="text-center font-mono font-bold">${item.batchNumber}</td>
            <td class="text-center" style="color: #dc2626; font-weight: bold;">${formatDateVN(item.expDate)}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right font-bold">${item.disposalQuantity}</td>
            <td style="font-size: 9pt;">${item.reason || 'Hết hạn sử dụng'}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold; background: #f1f5f9;">
          <td colspan="6" class="text-center">TỔNG CỘNG (${disposal.items?.length || 0} khoản mục)</td>
          <td class="text-right font-bold">${totalQty}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <div style="margin: 10px 0; font-size: 10.5pt; font-style: italic;">
      * Tổng số lượng tiêu hủy: <strong>${totalQty}</strong> đơn vị thuốc.
    </div>

    <div style="margin: 10px 0; font-size: 10pt;">
      Hội đồng đã tiến hành tiêu hủy đúng quy trình kỹ thuật, đảm bảo an toàn tuyệt đối và vệ sinh môi trường. Biên bản được lập thành 03 bản có giá trị pháp lý như nhau (01 bản lưu hồ sơ y tế, 01 bản nộp Ban Giám Hiệu, 01 bản nộp bộ phận Kế toán kiểm kê).
    </div>

    <table class="signatures-table" style="margin-top: 25px;">
      <tr>
        <td style="width: 25%;">
          <div class="signature-title">THƯ KÝ HỘI ĐỒNG</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('thư ký'))?.name || 'Cán bộ Y tế'}</div>
        </td>
        <td style="width: 25%;">
          <div class="signature-title">KẾ TOÁN TRƯỜNG</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('kế toán') || m.position.toLowerCase().includes('kế toán'))?.name || 'Kế toán trường'}</div>
        </td>
        <td style="width: 25%;">
          <div class="signature-title">ĐẠI DIỆN GIÁM SÁT</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('giám sát') || m.roleTitle.toLowerCase().includes('ủy viên'))?.name || 'Đại diện giám sát'}</div>
        </td>
        <td style="width: 25%;">
          <div class="signature-title">CHỦ TỊCH HỘI ĐỒNG</div>
          <div class="signature-sub">(Ký, đóng dấu duyệt)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('chủ tịch'))?.name || 'Hiệu Trưởng / Phó Hiệu Trưởng'}</div>
        </td>
      </tr>
    </table>
  `;

  openPrintWindow(content, false, `In Biên Bản Tiêu Hủy Thuốc - ${disposal.disposalCode}`);
}

// 8. Xuất Biên Bản Tiêu Hủy Thuốc sang Word (.doc)
export function exportDisposalWordA4(
  disposal: MedicineDisposal,
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const totalQty = (disposal.items || []).reduce((s, i) => s + (i.disposalQuantity || 0), 0);

  const content = `
    ${renderHeader({
      schoolName,
      title: 'BIÊN BẢN TIÊU HỦY THUỐC VÀ VẬT TƯ Y TẾ HẾT HẠN',
      subtitle: `Số biên bản: ${disposal.disposalCode} • Ngày lập: ${formatDateVN(disposal.disposalDate)}`,
      code: disposal.disposalCode,
    })}

    <div class="meta-box">
      <p>Căn cứ Thông tư liên tịch số 13/2016/TTLT-BYT-BGDĐT ngày 12/5/2016 của Bộ Y tế và Bộ Giáo dục & Đào tạo quy định về công tác y tế trường học;</p>
      <p>Căn cứ Quyết định số <strong>${disposal.decisionNumber || '18/QĐ-THCSĐT'}</strong> ${
        disposal.decisionDate ? `ngày ${formatDateVN(disposal.decisionDate)}` : ''
      } của Hiệu trưởng Trường THCS Đông Thạnh về việc thành lập Hội đồng tiêu hủy thuốc và vật tư y tế;</p>
      <p style="margin-top: 6px;">Hôm nay, ngày ${formatDateVN(disposal.disposalDate)}, tại ${
        disposal.disposalLocation || 'Phòng Y tế Trường THCS Đông Thạnh'
      }, Hội đồng tiến hành tiêu hủy gồm có:</p>
      
      <table style="width: 100%; margin: 8px 0 10px 0; border: none; font-size: 10pt;">
        ${(disposal.councilMembers || [])
          .map(
            (m, i) => `
          <tr>
            <td style="padding: 2px 0; width: 30px;">${i + 1}.</td>
            <td style="padding: 2px 0; width: 230px;">Ông/Bà: <strong>${m.name}</strong></td>
            <td style="padding: 2px 0; width: 220px;">Chức vụ: ${m.position}</td>
            <td style="padding: 2px 0;">Vai trò: <strong>${m.roleTitle}</strong></td>
          </tr>
        `
          )
          .join('')}
      </table>

      <p><strong>Phương pháp tiêu hủy:</strong> ${disposal.disposalMethod || 'Ngâm hóa chất vô hiệu hóa và chôn lấp hợp vệ sinh theo quy định y tế.'}</p>
      ${disposal.witnessNotes ? `<p><strong>Ghi nhận giám sát:</strong> ${disposal.witnessNotes}</p>` : ''}
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th style="width: 75px;">Mã thuốc</th>
          <th>Tên thuốc, nồng độ, hoạt chất</th>
          <th style="width: 75px;">Số lô</th>
          <th style="width: 75px;">Hạn dùng</th>
          <th style="width: 50px;">ĐVT</th>
          <th style="width: 65px;">Số lượng</th>
          <th style="width: 140px;">Lý do tiêu hủy</th>
        </tr>
      </thead>
      <tbody>
        ${(disposal.items || [])
          .map(
            (item, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td class="text-center font-bold">${item.medicineCode}</td>
            <td>
              <strong>${item.medicineName}</strong>
              ${item.activeIngredient ? `<div style="font-size: 9pt; color: #475569;">${item.activeIngredient}</div>` : ''}
            </td>
            <td class="text-center font-mono font-bold">${item.batchNumber}</td>
            <td class="text-center" style="color: #dc2626; font-weight: bold;">${formatDateVN(item.expDate)}</td>
            <td class="text-center">${item.unit}</td>
            <td class="text-right font-bold">${item.disposalQuantity}</td>
            <td style="font-size: 9pt;">${item.reason || 'Hết hạn sử dụng'}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr style="font-weight: bold; background: #f1f5f9;">
          <td colspan="6" class="text-center">TỔNG CỘNG (${disposal.items?.length || 0} khoản mục)</td>
          <td class="text-right font-bold">${totalQty}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <div style="margin: 10px 0; font-size: 10.5pt; font-style: italic;">
      * Tổng số lượng tiêu hủy: <strong>${totalQty}</strong> đơn vị thuốc.
    </div>

    <table class="signatures-table" style="margin-top: 25px;">
      <tr>
        <td style="width: 25%;">
          <div class="signature-title">THƯ KÝ HỘI ĐỒNG</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('thư ký'))?.name || 'Cán bộ Y tế'}</div>
        </td>
        <td style="width: 25%;">
          <div class="signature-title">KẾ TOÁN TRƯỜNG</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('kế toán') || m.position.toLowerCase().includes('kế toán'))?.name || 'Kế toán trường'}</div>
        </td>
        <td style="width: 25%;">
          <div class="signature-title">ĐẠI DIỆN GIÁM SÁT</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('giám sát') || m.roleTitle.toLowerCase().includes('ủy viên'))?.name || 'Đại diện giám sát'}</div>
        </td>
        <td style="width: 25%;">
          <div class="signature-title">CHỦ TỊCH HỘI ĐỒNG</div>
          <div class="signature-sub">(Ký, đóng dấu duyệt)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${disposal.councilMembers?.find(m => m.roleTitle.toLowerCase().includes('chủ tịch'))?.name || 'Hiệu Trưởng / Phó Hiệu Trưởng'}</div>
        </td>
      </tr>
    </table>
  `;

  downloadWordDoc(content, `Bien_Ban_Tieu_Huy_Thuoc_${disposal.disposalCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`, false);
}

/**
 * In Phiếu Chăm Sóc & Tiếp Nhận Phòng Y Tế A4 Portrait
 */
export function printClinicVisitReceiptA4(
  visit: ClinicVisit,
  schoolName = 'TRƯỜNG THCS ĐÔNG THẠNH'
) {
  const config = templateConfigService.getConfig();
  const actualSchoolName = config.schoolName || schoolName;

  const headerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
      <div style="text-align: center; width: 45%;">
        <div style="font-size: 10pt; font-weight: bold; text-transform: uppercase;">UBND HUYỆN HÓC MÔN</div>
        <div style="font-size: 10.5pt; font-weight: bold; text-transform: uppercase; color: #0f766e;">${actualSchoolName}</div>
        <div style="font-size: 9pt; font-style: italic;">Phòng Y Tế Học Đường</div>
      </div>
      <div style="text-align: center; width: 50%;">
        <div style="font-size: 10pt; font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div style="font-size: 9.5pt; font-weight: bold;">Độc lập - Tự do - Hạnh phúc</div>
        <div style="font-size: 9pt; margin-top: 2px;">***</div>
      </div>
    </div>
  `;

  const vitalsText = [
    visit.vitals?.weight ? `Cân nặng: <b>${visit.vitals.weight} kg</b>` : '',
    visit.vitals?.height ? `Chiều cao: <b>${visit.vitals.height} cm</b>` : '',
    visit.vitals?.temperature ? `Nhiệt độ: <b>${visit.vitals.temperature}°C</b>` : '',
    visit.vitals?.pulse ? `Mạch: <b>${visit.vitals.pulse} lần/phút</b>` : '',
    visit.vitals?.bloodPressure ? `Huyết áp: <b>${visit.vitals.bloodPressure} mmHg</b>` : '',
    visit.vitals?.respiratoryRate ? `Nhịp thở: <b>${visit.vitals.respiratoryRate} l/p</b>` : '',
    visit.vitals?.spO2 ? `SpO2: <b>${visit.vitals.spO2}%</b>` : '',
  ]
    .filter(Boolean)
    .join(' &nbsp; | &nbsp; ');

  const medsList = visit.medicinesUsed && visit.medicinesUsed.length > 0 ? visit.medicinesUsed : (visit.medicinesDispensed || []);

  const medsRows = medsList.length > 0
    ? medsList.map((m, idx) => `
        <tr>
          <td style="text-align: center; padding: 5px;">${idx + 1}</td>
          <td style="padding: 5px; font-weight: bold;">${m.medicineName}</td>
          <td style="text-align: center; padding: 5px; font-family: monospace;">${m.batchNumber || '-'}</td>
          <td style="text-align: center; padding: 5px;">${m.expDate ? formatDateVN(m.expDate) : '-'}</td>
          <td style="text-align: right; padding: 5px; font-weight: bold;">${m.quantity} ${m.unit}</td>
          <td style="padding: 5px;">${m.dosageInstructions || 'Uống theo chỉ định cán bộ y tế'}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="6" style="text-align: center; padding: 10px; font-style: italic; color: #64748b;">Không chỉ định dùng thuốc</td></tr>`;

  const content = `
    ${headerHtml}

    <div style="text-align: center; margin: 10px 0 16px;">
      <h2 style="margin: 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; color: #1e293b;">
        PHIẾU CHĂM SÓC & TIẾP NHẬN PHÒNG Y TẾ
      </h2>
      <div style="font-size: 9.5pt; font-style: italic; color: #475569; margin-top: 3px;">
        Mã lượt khám: <strong>${visit.visitCode}</strong> &nbsp;•&nbsp; Ngày: <strong>${formatDateVN(visit.visitDate)}</strong> &nbsp;•&nbsp; Giờ vào: <strong>${formatTime24H(visit.timeIn)}</strong>${visit.timeOut ? ` &nbsp;•&nbsp; Giờ ra: <strong>${formatTime24H(visit.timeOut)}</strong>` : ''}
      </div>
    </div>

    <table style="width: 100%; font-size: 10pt; line-height: 1.6; margin-bottom: 12px; border-collapse: collapse;">
      <tr>
        <td style="width: 50%;">Họ và tên học sinh: <strong>${visit.studentName}</strong></td>
        <td style="width: 25%;">Lớp: <strong>${visit.className}</strong></td>
        <td style="width: 25%;">Mã HS: <strong>${visit.studentCode}</strong></td>
      </tr>
      <tr>
        <td>Người đưa đến: <strong>${visit.broughtBy || 'Tự đến'}</strong></td>
        <td colspan="2">Cán bộ y tế phụ trách: <strong>${visit.performer}</strong></td>
      </tr>
      <tr>
        <td colspan="3">Lý do vào phòng y tế: <strong>${visit.reason || (visit.reasons?.join(', ') || 'Kiểm tra sức khỏe')}</strong></td>
      </tr>
      <tr>
        <td colspan="3">Tình trạng ban đầu: <em>${visit.initialCondition || 'Học sinh mệt mỏi, cần theo dõi'}</em></td>
      </tr>
      ${vitalsText ? `<tr><td colspan="3" style="background: #f8fafc; padding: 4px 6px; border: 1px dashed #cbd5e1;">Dấu hiệu sinh tồn: ${vitalsText}</td></tr>` : ''}
      <tr>
        <td colspan="3">Biện pháp xử trí y tế: <strong>${visit.treatment || visit.treatmentDetails}</strong></td>
      </tr>
      <tr>
        <td colspan="3">Kết quả / Hướng giải quyết: <strong style="color: #047857;">${visit.outcome}</strong> ${visit.isTransferred ? `(Chuyển đến: ${visit.transferHospital || 'Bệnh viện Đa khoa'})` : ''}</td>
      </tr>
      ${visit.parentContacted ? `<tr><td colspan="3">Thông báo phụ huynh: <strong>Đã liên hệ</strong> ${visit.parentContactNotes ? `(${visit.parentContactNotes})` : ''}</td></tr>` : ''}
    </table>

    <div style="font-size: 10.5pt; font-weight: bold; margin: 12px 0 6px; color: #0f766e;">
      DANH MỤC THUỐC ĐÃ CẤP PHÁT (TRỪ KHO THEO LÔ FEFO):
    </div>
    <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 15px;">
      <thead>
        <tr style="background-color: #f1f5f9;">
          <th style="width: 35px; text-align: center; padding: 6px; border: 1px solid #94a3b8;">STT</th>
          <th style="text-align: left; padding: 6px; border: 1px solid #94a3b8;">Tên thuốc, nồng độ/hàm lượng</th>
          <th style="width: 80px; text-align: center; padding: 6px; border: 1px solid #94a3b8;">Số lô</th>
          <th style="width: 85px; text-align: center; padding: 6px; border: 1px solid #94a3b8;">Hạn dùng</th>
          <th style="width: 70px; text-align: right; padding: 6px; border: 1px solid #94a3b8;">Số lượng</th>
          <th style="padding: 6px; border: 1px solid #94a3b8;">Cách dùng & Liều lượng</th>
        </tr>
      </thead>
      <tbody>
        ${medsRows}
      </tbody>
    </table>

    <table class="signatures-table" style="margin-top: 25px;">
      <tr>
        <td style="width: 33%;">
          <div class="signature-title">HỌC SINH / PHỤ HUYNH</div>
          <div class="signature-sub">(Ký, ghi rõ họ tên nếu có)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${visit.studentName}</div>
        </td>
        <td style="width: 33%;">
          <div class="signature-title">CÁN BỘ Y TẾ HỌC ĐƯỜNG</div>
          <div class="signature-sub">(Ký và ghi rõ họ tên)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${visit.performer}</div>
        </td>
        <td style="width: 34%;">
          <div class="signature-title">HIỆU TRƯỞNG / BGH DUYỆT</div>
          <div class="signature-sub">(Ký, đóng dấu xác nhận)</div>
          <div class="signature-space"></div>
          <div class="signature-name">${config.signatory2Name || 'Hiệu Trưởng / Ban Giám Hiệu'}</div>
        </td>
      </tr>
    </table>
  `;

  openPrintWindow(content, false, `Phieu_Cham_Soc_Y_Te_${visit.visitCode}`);
}
