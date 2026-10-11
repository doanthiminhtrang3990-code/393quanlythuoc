import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileText,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Download,
  Building2,
  ExternalLink,
  FileSpreadsheet,
  Info,
  Settings,
  Edit3,
  RotateCcw,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  FileCode,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db, formatDateVN, formatDateTimeVN, formatTime24H, getCurrentDateISO, maskStudentName } from '../services/db';
import {
  openPrintWindow,
  downloadPrintHtml,
  downloadWordDoc,
} from '../services/printA4Service';
import {
  templateConfigService,
  TemplateConfig,
  DEFAULT_TEMPLATE_CONFIG,
} from '../services/templateConfigService';

type TemplateKey =
  | 'mau1_so_phong_y_te'
  | 'mau2_thuoc_vat_tu'
  | 'mau3_bao_cao_thang'
  | 'mau4_hoc_sinh_dac_biet'
  | 'mau5_nhap_xuat_ton'
  | 'mau6_bien_ban_su_co';

export const PrintA4Templates: React.FC = () => {
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('mau1_so_phong_y_te');
  const [printNotification, setPrintNotification] = useState<string | null>(null);
  const [, setDbTick] = useState(0);

  useEffect(() => {
    const unsub = db.subscribe(() => setDbTick((t) => t + 1));
    return () => unsub();
  }, []);

  // Cấu hình biểu mẫu có thể tùy chỉnh và lưu trữ
  const [config, setConfig] = useState<TemplateConfig>(() => templateConfigService.getConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDirectEdit, setIsDirectEdit] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Lấy dữ liệu thực tế từ database
  const visits = db.getClinicVisits();
  const students = db.getStudents();
  const specialStudents = students.filter(
    (s) => s.specialAttention || (s.allergies && s.allergies !== 'Không') || s.chronicConditions
  );
  const activeMonth = visits.length > 0 && visits[0].visitDate ? visits[0].visitDate.substring(0, 7) : getCurrentDateISO().substring(0, 7);
  const monthlyReport = db.getMonthlyClinicReport(activeMonth);
  const stockRows = db.getStockInOutReport();
  const healthEvents = db.getHealthEvents();

  // Cập nhật cấu hình và lưu vào localStorage
  const handleSaveConfig = (newConfig: TemplateConfig) => {
    setConfig(newConfig);
    templateConfigService.saveConfig(newConfig);
    setPrintNotification('Đã lưu cài đặt biểu mẫu thành công! Tất cả báo cáo và sổ sẽ áp dụng biểu mẫu mới.');
    setIsSettingsOpen(false);
    setTimeout(() => setPrintNotification(null), 4000);
  };

  // Khôi phục cấu hình mặc định
  const handleResetConfig = () => {
    setShowResetModal(true);
  };

  const handleConfirmResetConfig = () => {
    const reset = templateConfigService.resetConfig();
    setConfig(reset);
    setShowResetModal(false);
    setPrintNotification('Đã khôi phục biểu mẫu về mặc định ban đầu!');
    setTimeout(() => setPrintNotification(null), 4000);
  };

  // Lấy tiêu đề và cấu hình của mẫu hiện tại
  const getCurrentTemplateMeta = () => {
    switch (activeTemplate) {
      case 'mau1_so_phong_y_te':
        return {
          title: config.customTitles.mau1 || 'SỔ THEO DÕI HỌC SINH ĐẾN PHÒNG Y TẾ',
          subtitle: `Năm học: ${config.academicYear} • Trường ${config.schoolName}`,
          code: 'Mẫu 01/YTHĐ-BYT-BGDĐT',
          fileName: 'Mau1_So_Theo_Doi_Hoc_Sinh_Phong_Y_Te',
          landscape: config.orientation === 'landscape',
        };
      case 'mau2_thuoc_vat_tu':
        return {
          title: config.customTitles.mau2 || 'SỔ THEO DÕI THUỐC VÀ VẬT TƯ Y TẾ ĐÃ SỬ DỤNG',
          subtitle: `Liên kết cấp phát theo lô và quy tắc FEFO • Năm học ${config.academicYear}`,
          code: 'Mẫu 02/YTHĐ-Dược-THCS',
          fileName: 'Mau2_So_Theo_Doi_Thuoc_Vat_Tu',
          landscape: true, // Sổ theo dõi thuốc có nhiều cột nên mặc định khổ ngang xem rõ nhất
        };
      case 'mau3_bao_cao_thang':
        return {
          title: config.customTitles.mau3 || `BÁO CÁO CÔNG TÁC Y TẾ TRƯỜNG HỌC THÁNG ${monthlyReport.month}`,
          subtitle: `Năm học: ${config.academicYear} • Trường ${config.schoolName}`,
          code: 'Mẫu 03/BC-YTHĐ',
          fileName: `Mau3_Bao_Cao_Y_Te_Thang_${monthlyReport.month}`,
          landscape: false,
        };
      case 'mau4_hoc_sinh_dac_biet':
        return {
          title: config.customTitles.mau4 || 'DANH SÁCH HỌC SINH CẦN THEO DÕI SỨC KHỎE ĐẶC BIỆT',
          subtitle: `Lưu ý dị ứng, bệnh lý mạn tính và thông tin liên lạc phụ huynh • Năm học ${config.academicYear}`,
          code: 'Mẫu 04/SK-ĐặcBiệt',
          fileName: 'Mau4_Danh_Sach_HS_Theo_Doi_Dac_Biet',
          landscape: config.orientation === 'landscape',
        };
      case 'mau5_nhap_xuat_ton':
        return {
          title: config.customTitles.mau5 || 'SỔ THEO DÕI NHẬP - XUẤT - TỒN THUỐC VÀ VẬT TƯ Y TẾ',
          subtitle: `Kỳ báo cáo kiểm kê cân đối định kỳ • ${config.schoolName}`,
          code: 'Mẫu 05/KHO-YTHĐ',
          fileName: 'Mau5_So_Nhap_Xuat_Ton_Kho_Y_Te',
          landscape: true,
        };
      case 'mau6_bien_ban_su_co':
        return {
          title: config.customTitles.mau6 || 'BIÊN BẢN XỬ LÝ SỰ CỐ TAI NẠN THƯƠNG TÍCH HỌC ĐƯỜNG',
          subtitle: `Hồ sơ sơ cứu ban đầu và chuyển tuyến cơ sở y tế • ${config.schoolName}`,
          code: 'Mẫu 06/BB-TaiNanThuongTich',
          fileName: 'Mau6_Bien_Ban_Su_Co_Tai_Nan_Thuong_Tich',
          landscape: false,
        };
    }
  };

  const dateStr = templateConfigService.getDateString(config);

  // Tạo mã HTML đầy đủ cho mẫu biểu (dùng cho in ấn, tải HTML và xuất sang Microsoft Word .doc)
  const getTemplateHtml = (): string => {
    const meta = getCurrentTemplateMeta();

    const headerHtml = `
      <table class="header-table">
        <tr>
          <td class="header-left">
            <div class="unit-name">${config.governingBody}</div>
            <div class="school-name">${config.schoolName}</div>
            <div>${config.department}</div>
            <div class="divider-line"></div>
          </td>
          <td class="header-right">
            <div class="national-title">${config.nationalTitle}</div>
            <div class="national-motto">${config.nationalMotto}</div>
            <div class="divider-line"></div>
            <div style="font-style: italic; font-size: 10pt; margin-top: 4px;">${dateStr}</div>
          </td>
        </tr>
      </table>
      <div class="doc-title">${meta.title}</div>
      <div class="doc-subtitle">${meta.subtitle}</div>
      <div style="text-align: center; font-size: 9.5pt; font-weight: bold; color: #475569; margin-bottom: 10px;">${meta.code}</div>
    `;

    const footerHtml = `
      ${config.legalBasis ? `<div style="font-size: 9pt; font-style: italic; color: #475569; margin-top: 15px; margin-bottom: 8px;">* ${config.legalBasis}</div>` : ''}
      <table class="signatures-table" style="width: 100%; margin-top: 25px; border-collapse: collapse;">
        <tr>
          <td style="text-align: center; vertical-align: top; width: ${config.showSignatory3 ? '33%' : '50%'};">
            <div class="signature-title">${config.signatory1Title}</div>
            <div class="signature-sub">${config.signatory1Sub}</div>
            <div class="signature-space" style="height: 65px;"></div>
            <div class="signature-name">${config.signatory1Name}</div>
          </td>
          ${
            config.showSignatory3
              ? `
          <td style="text-align: center; vertical-align: top; width: 33%;">
            <div class="signature-title">${config.signatory3Title}</div>
            <div class="signature-sub">${config.signatory3Sub}</div>
            <div class="signature-space" style="height: 65px;"></div>
            <div class="signature-name">${config.signatory3Name}</div>
          </td>`
              : ''
          }
          <td style="text-align: center; vertical-align: top; width: ${config.showSignatory3 ? '33%' : '50%'};">
            <div class="signature-title">${config.signatory2Title}</div>
            <div class="signature-sub">${config.signatory2Sub}</div>
            <div class="signature-space" style="height: 65px;"></div>
            <div class="signature-name">${config.signatory2Name}</div>
          </td>
        </tr>
      </table>
    `;

    let bodyHtml = '';

    if (activeTemplate === 'mau1_so_phong_y_te') {
      const rows = visits
        .map((v, idx) => {
          const visitDateTime = v.dateTime
            ? formatDateTimeVN(v.dateTime)
            : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—');
          const visitReason = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';
          const visitTemp = v.vitals?.temperature || v.temperature;
          const visitTreatment = v.treatmentDetails || v.treatmentType || v.treatment || '';
          const meds = v.medicinesUsed || v.medicinesDispensed || [];

          return `
            <tr>
              <td style="text-align: center;">${idx + 1}</td>
              <td style="white-space: nowrap;">${visitDateTime}</td>
              <td><strong>${v.studentName}</strong><br><span style="font-size:9pt; color:#64748b;">${v.studentCode}</span></td>
              <td style="text-align: center; font-weight: bold;">${v.className}</td>
              <td><strong>${visitReason}</strong>${visitTemp ? ` (${visitTemp}°C)` : ''}</td>
              <td>${visitTreatment}${
            meds.length > 0
              ? `<br><span style="font-size:9pt; color:#065f46; font-weight:bold;">Thuốc: ${meds
                  .map((m) => `${m.medicineName} (${m.quantity} ${m.unit || ''})`)
                  .join(', ')}</span>`
              : ''
          }</td>
              <td>${v.outcome || 'Đã ổn định'}</td>
              <td style="text-align: center; font-style: italic;">${(v.performer || 'Y sĩ').split(' ').pop()}</td>
            </tr>
          `;
        })
        .join('');

      bodyHtml = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th style="width: 95px;">Thời gian</th>
              <th>Họ và tên học sinh</th>
              <th style="width: 50px;">Lớp</th>
              <th>Lý do & Sinh hiệu</th>
              <th>Xử trí & Cấp thuốc</th>
              <th style="width: 110px;">Kết quả</th>
              <th style="width: 75px;">Ký nhận</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (activeTemplate === 'mau2_thuoc_vat_tu') {
      const rows = visits
        .flatMap((v) => {
          const dateDisplay = v.dateTime
            ? formatDateTimeVN(v.dateTime)
            : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—');
          const rText = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';
          const meds = v.medicinesUsed || v.medicinesDispensed || [];
          return meds.map((m) => ({
            date: dateDisplay,
            student: `${v.studentName} (${v.className})`,
            item: m.medicineName,
            qty: `${m.quantity} ${m.unit}`,
            batch: m.batchNumber || '—',
            exp: m.expDate ? formatDateVN(m.expDate) : '—',
            reason: rText,
          }));
        })
        .map(
          (row, idx) => `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="white-space: nowrap;">${row.date}</td>
            <td><strong>${row.student}</strong></td>
            <td><strong>${row.item}</strong></td>
            <td style="text-align: center; font-weight: bold;">${row.qty}</td>
            <td style="text-align: center; font-family: monospace;">${row.batch}</td>
            <td style="text-align: center; font-family: monospace;">${row.exp}</td>
            <td>${row.reason}</td>
          </tr>
        `
        )
        .join('');

      bodyHtml = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th style="width: 95px;">Ngày cấp</th>
              <th>Tên học sinh (Lớp)</th>
              <th>Tên thuốc / Vật tư</th>
              <th style="width: 70px;">Số lượng</th>
              <th style="width: 80px;">Số lô</th>
              <th style="width: 80px;">Hạn dùng</th>
              <th>Lý do chỉ định</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (activeTemplate === 'mau3_bao_cao_thang') {
      const medList = monthlyReport.medicinesUsedSummary
        .map(
          (m) => `
        <li><strong>${m.medicineName}</strong> (Lô ${m.batchNumber}): <strong>${m.quantity}</strong> ${m.unit}</li>
      `
        )
        .join('');

      bodyHtml = `
        <div style="font-size: 11pt; line-height: 1.6; margin-top: 15px;">
          <p><strong>I. TÌNH HÌNH CHUNG:</strong></p>
          <ul style="padding-left: 20px;">
            <li>Tổng số học sinh toàn trường: <strong>${students.length}</strong> học sinh (Khối 6, 7, 8, 9).</li>
            <li>Tổng số lượt học sinh đến phòng y tế trong tháng: <strong>${monthlyReport.totalVisits}</strong> lượt.</li>
          </ul>

          <p style="margin-top: 12px;"><strong>II. KẾT QUẢ XỬ TRÍ BAN ĐẦU:</strong></p>
          <ul style="padding-left: 20px;">
            <li>Số ca đã ổn định cho về lớp / phòng y tế: <strong>${Math.max(
              0,
              monthlyReport.totalVisits - monthlyReport.emergencyTransfersCount
            )}</strong> ca.</li>
            <li>Số ca liên hệ phụ huynh bàn giao đón về nghỉ ngơi: <strong>${monthlyReport.parentContactedCount}</strong> ca.</li>
            <li>Số ca sơ cứu chuyển cơ sở y tế tuyến trên: <strong>${monthlyReport.emergencyTransfersCount}</strong> ca.</li>
            <li>Số sự cố tai nạn thương tích tại trường: <strong>${monthlyReport.events.length}</strong> ca.</li>
          </ul>

          <p style="margin-top: 12px;"><strong>III. THUỐC VÀ VẬT TƯ TIÊU THỤ:</strong></p>
          <ul style="padding-left: 20px;">
            ${medList || '<li>Không có thuốc cấp phát trong kỳ.</li>'}
          </ul>
        </div>
      `;
    } else if (activeTemplate === 'mau4_hoc_sinh_dac_biet') {
      const rows = specialStudents
        .map(
          (s, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="text-align: center; font-family: monospace;">${s.studentCode}</td>
          <td><strong>${s.fullName}</strong></td>
          <td style="text-align: center; font-weight: bold;">${s.className}</td>
          <td style="color: #991b1b; font-weight: bold;">${s.allergies || 'Không'}</td>
          <td>${s.chronicConditions || 'Không'}</td>
          <td style="font-family: monospace;">${s.parentPhone || '—'}</td>
        </tr>
      `
        )
        .join('');

      bodyHtml = `
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th style="width: 80px;">Mã HS</th>
              <th>Họ và tên học sinh</th>
              <th style="width: 55px;">Lớp</th>
              <th>Tiền sử dị ứng</th>
              <th>Bệnh nền mạn tính</th>
              <th style="width: 110px;">SĐT Phụ huynh</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (activeTemplate === 'mau5_nhap_xuat_ton') {
      const rows = stockRows
        .map(
          (r, i) => `
        <tr>
          <td style="text-align: center;">${i + 1}</td>
          <td style="text-align: center; font-weight: bold;">${r.medicineCode}</td>
          <td>${r.medicineName}</td>
          <td style="text-align: center; font-family: monospace;">${r.batchNumber}</td>
          <td style="text-align: center;">${formatDateVN(r.expDate)}</td>
          <td style="text-align: center;">${r.unit}</td>
          <td style="text-align: right; font-weight: bold;">${r.openingStock}</td>
          <td style="text-align: right; color: #047857;">${r.importQuantity > 0 ? '+' + r.importQuantity : '0'}</td>
          <td style="text-align: right; color: #b91c1c;">${r.exportQuantity > 0 ? '-' + r.exportQuantity : '0'}</td>
          <td style="text-align: right; font-weight: bold; background: #f8fafc;">${r.closingStock}</td>
          <td style="font-size: 9pt;">${r.notes || 'Tủ thuốc y tế'}</td>
        </tr>
      `
        )
        .join('');

      bodyHtml = `
        <table class="data-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 30px;">STT</th>
              <th rowspan="2" style="width: 75px;">Mã thuốc</th>
              <th rowspan="2">Tên thuốc, nồng độ, hàm lượng</th>
              <th rowspan="2" style="width: 70px;">Số lô</th>
              <th rowspan="2" style="width: 70px;">Hạn dùng</th>
              <th rowspan="2" style="width: 45px;">ĐVT</th>
              <th rowspan="2" style="width: 55px;">Tồn đầu</th>
              <th colspan="2">Phát sinh trong kỳ</th>
              <th rowspan="2" style="width: 55px;">Tồn cuối</th>
              <th rowspan="2" style="width: 80px;">Vị trí lưu trữ</th>
            </tr>
            <tr>
              <th style="width: 55px;">Nhập (+)</th>
              <th style="width: 55px;">Xuất (-)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else if (activeTemplate === 'mau6_bien_ban_su_co') {
      const eventsList = healthEvents
        .map(
          (e, idx) => `
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid;">
          <p><strong>Vụ việc ${idx + 1}: ${e.eventType} - Mã: ${e.eventCode}</strong></p>
          <table style="width: 100%; border: none; font-size: 10pt;">
            <tr><td style="width: 150px;">Thời gian xảy ra:</td><td><strong>${formatDateTimeVN(e.dateTime)}</strong></td></tr>
            <tr><td>Địa điểm:</td><td>${e.location}</td></tr>
            <tr><td>Học sinh liên quan:</td><td><strong>${e.studentName || 'Chưa ghi nhận'}</strong> (${e.className || '—'})</td></tr>
            <tr><td>Tình trạng ban đầu:</td><td><strong>${e.initialCondition || 'Đau, sưng nề'}</strong></td></tr>
            <tr><td>Mô tả sự việc:</td><td>${e.description}</td></tr>
            <tr><td>Xử trí y tế ban đầu:</td><td>${e.treatment || 'Băng bó, cố định vết thương'}</td></tr>
            <tr><td>Kết quả & Đánh giá:</td><td><strong>${e.outcome || 'Đã ổn định và bàn giao'}</strong></td></tr>
          </table>
        </div>
      `
        )
        .join('');

      bodyHtml = `
        <div style="font-size: 11pt; line-height: 1.5; margin-top: 15px;">
          <p>Hôm nay, vào hồi ${new Date().getHours()} giờ ${new Date().getMinutes()} phút, tại Phòng Y tế Trường THCS Đông Thạnh.</p>
          <p>Chúng tôi gồm các thành phần sau lập biên bản ghi nhận các sự cố y tế và tai nạn thương tích học đường:</p>
          <ul style="padding-left: 20px;">
            <li>1. Đại diện Ban Giám Hiệu: <strong>${config.signatory2Name}</strong> - Chức vụ: ${config.signatory2Title}</li>
            <li>2. Cán bộ phụ trách y tế: <strong>${config.signatory1Name}</strong> - Chức vụ: ${config.signatory1Title}</li>
            <li>3. Người chứng kiến / Giáo viên phụ trách: Đại diện Tổ giám sát học sinh</li>
          </ul>
          <p style="margin-top: 10px;"><strong>NỘI DUNG CHI TIẾT CÁC VỤ VIỆC:</strong></p>
          ${eventsList || '<p><em>Không có sự cố tai nạn thương tích nào được ghi nhận trong kỳ báo cáo.</em></p>'}
        </div>
      `;
    }

    return `${headerHtml}${bodyHtml}${footerHtml}`;
  };

  // 1. In trực tiếp (Direct Print)
  const handlePrint = () => {
    const meta = getCurrentTemplateMeta();
    try {
      window.print();
      setPrintNotification('Đang gửi lệnh in tới máy in...');
      setTimeout(() => setPrintNotification(null), 4000);
    } catch (err) {
      console.warn('Direct print failed, opening in new tab fallback:', err);
      openPrintWindow(getTemplateHtml(), meta.landscape, meta.title);
    }
  };

  // 2. Mở Bản In trong Tab Mới (Chuẩn A4 PDF)
  const handleOpenNewTab = () => {
    const meta = getCurrentTemplateMeta();
    openPrintWindow(getTemplateHtml(), meta.landscape, meta.title);
    setPrintNotification('Đã mở bản in trong thẻ mới! Quý Thầy/Cô có thể in hoặc lưu PDF chuẩn A4.');
    setTimeout(() => setPrintNotification(null), 5000);
  };

  // 3. Xuất Microsoft Word (.doc) - Cho phép mở và chỉnh sửa trong Word
  const handleExportWord = () => {
    const meta = getCurrentTemplateMeta();
    try {
      downloadWordDoc(getTemplateHtml(), meta.fileName, meta.landscape, config.fontSize);
      setPrintNotification(`Đã xuất file Word: ${meta.fileName}.doc thành công! Quý Thầy/Cô có thể mở trong Microsoft Word để chỉnh sửa tùy ý.`);
      setTimeout(() => setPrintNotification(null), 5000);
    } catch (err) {
      console.error('Lỗi khi xuất Word:', err);
      setPrintNotification('Có lỗi xảy ra khi tạo tệp Word. Vui lòng thử lại.');
      setTimeout(() => setPrintNotification(null), 5000);
    }
  };

  // 4. Xuất file Microsoft Excel (.xlsx)
  const handleExportExcel = () => {
    const meta = getCurrentTemplateMeta();
    try {
      let dataRows: any[] = [];
      if (activeTemplate === 'mau1_so_phong_y_te') {
        dataRows = visits.map((v, idx) => ({
          STT: idx + 1,
          'Thời gian': v.dateTime
            ? formatDateTimeVN(v.dateTime)
            : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—'),
          'Mã HS': v.studentCode,
          'Họ và tên học sinh': v.studentName,
          Lớp: v.className,
          'Lý do & Sinh hiệu': `${(v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || ''} ${
            v.vitals?.temperature || v.temperature ? `(${v.vitals?.temperature || v.temperature}°C)` : ''
          }`,
          'Xử trí & Cấp thuốc': `${v.treatmentDetails || v.treatmentType || v.treatment || ''} ${(
            v.medicinesUsed ||
            v.medicinesDispensed ||
            []
          )
            .map((m) => `${m.medicineName} (${m.quantity} ${m.unit || ''})`)
            .join(', ')}`,
          'Kết quả': v.outcome,
          'Người thực hiện': v.performer || 'Y sĩ',
        }));
      } else if (activeTemplate === 'mau2_thuoc_vat_tu') {
        dataRows = visits.flatMap((v, vIdx) => {
          const dateDisplay = v.dateTime
            ? formatDateTimeVN(v.dateTime)
            : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—');
          const rText = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';
          const meds = v.medicinesUsed || v.medicinesDispensed || [];
          return meds.map((m, mIdx) => ({
            STT: `${vIdx + 1}.${mIdx + 1}`,
            'Ngày cấp': dateDisplay,
            'Tên học sinh': v.studentName,
            Lớp: v.className,
            'Tên thuốc / Vật tư': m.medicineName,
            'Số lượng': m.quantity,
            'Đơn vị tính': m.unit,
            'Số lô': m.batchNumber || '—',
            'Hạn dùng': m.expDate ? formatDateVN(m.expDate) : '—',
            'Lý do chỉ định': rText,
          }));
        });
      } else if (activeTemplate === 'mau3_bao_cao_thang') {
        dataRows = [
          { 'Chỉ tiêu báo cáo': 'Tổng số học sinh toàn trường', 'Giá trị': students.length, 'Đơn vị': 'học sinh' },
          { 'Chỉ tiêu báo cáo': 'Tổng số lượt khám tại phòng y tế', 'Giá trị': monthlyReport.totalVisits, 'Đơn vị': 'lượt' },
          {
            'Chỉ tiêu báo cáo': 'Số ca ổn định về lớp',
            'Giá trị': Math.max(0, monthlyReport.totalVisits - monthlyReport.emergencyTransfersCount),
            'Đơn vị': 'ca',
          },
          { 'Chỉ tiêu báo cáo': 'Số ca bàn giao phụ huynh', 'Giá trị': monthlyReport.parentContactedCount, 'Đơn vị': 'ca' },
          { 'Chỉ tiêu báo cáo': 'Số ca chuyển viện tuyến trên', 'Giá trị': monthlyReport.emergencyTransfersCount, 'Đơn vị': 'ca' },
          { 'Chỉ tiêu báo cáo': 'Số sự cố tai nạn thương tích', 'Giá trị': monthlyReport.events.length, 'Đơn vị': 'vụ' },
          ...monthlyReport.medicinesUsedSummary.map((m) => ({
            'Chỉ tiêu báo cáo': `Thuốc đã xuất: ${m.medicineName} (Lô ${m.batchNumber})`,
            'Giá trị': m.quantity,
            'Đơn vị': m.unit,
          })),
        ];
      } else if (activeTemplate === 'mau4_hoc_sinh_dac_biet') {
        dataRows = specialStudents.map((s, idx) => ({
          STT: idx + 1,
          'Mã HS': s.studentCode,
          'Họ và tên': s.fullName,
          Lớp: s.className,
          'Tiền sử dị ứng': s.allergies || 'Không',
          'Bệnh nền mạn tính': s.chronicConditions || 'Không',
          'SĐT Phụ huynh': s.parentPhone || '—',
          'Người giám hộ': s.parentName || '—',
        }));
      } else if (activeTemplate === 'mau5_nhap_xuat_ton') {
        dataRows = stockRows.map((r, i) => ({
          STT: i + 1,
          'Mã thuốc': r.medicineCode,
          'Tên thuốc, nồng độ': r.medicineName,
          'Số lô': r.batchNumber,
          'Hạn dùng': formatDateVN(r.expDate),
          'ĐVT': r.unit,
          'Tồn đầu': r.openingStock,
          'Nhập (+)': r.importQuantity,
          'Xuất (-)': r.exportQuantity,
          'Tồn cuối': r.closingStock,
          'Vị trí lưu trữ': r.notes || 'Tủ thuốc',
        }));
      } else if (activeTemplate === 'mau6_bien_ban_su_co') {
        dataRows = healthEvents.map((e, idx) => ({
          STT: idx + 1,
          'Mã sự kiện': e.eventCode,
          'Loại sự cố': e.eventType,
          'Thời gian': formatDateTimeVN(e.dateTime),
          'Địa điểm': e.location,
          'Học sinh liên quan': `${e.studentName || ''} (${e.className || ''})`,
          'Tình trạng ban đầu': e.initialCondition,
          'Mô tả': e.description,
          'Xử trí y tế': e.treatment,
          'Kết quả xử trí': e.outcome,
          'Người xử trí': e.performer,
        }));
      }

      const ws = XLSX.utils.json_to_sheet(dataRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'So_Bao_Cao');
      XLSX.writeFile(wb, `${meta.fileName}_${config.schoolName.replace(/\s+/g, '_')}.xlsx`);
      setPrintNotification(`Đã xuất file Excel: ${meta.fileName}.xlsx thành công!`);
      setTimeout(() => setPrintNotification(null), 5000);
    } catch (err) {
      console.error('Lỗi khi xuất Excel:', err);
      setPrintNotification('Có lỗi xảy ra khi tạo tệp Excel. Vui lòng thử lại.');
      setTimeout(() => setPrintNotification(null), 5000);
    }
  };

  // 5. Tải file HTML
  const handleDownloadHtml = () => {
    const meta = getCurrentTemplateMeta();
    downloadPrintHtml(getTemplateHtml(), meta.fileName, meta.landscape);
    setPrintNotification(`Đã tải xuống tệp ${meta.fileName}.html! Quý Thầy/Cô có thể mở bằng trình duyệt và in.`);
    setTimeout(() => setPrintNotification(null), 5000);
  };

  const meta = getCurrentTemplateMeta();

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              MẪU IN A4 CHUẨN BỘ
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Tùy chỉnh & Xuất Word / Excel
            </span>
            <h1 className="text-xl font-bold text-slate-900">Mẫu Sổ & Báo Cáo Y Tế Học Đường</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {config.schoolName} • Cho phép chỉnh sửa thông tin biểu mẫu, sửa trực tiếp trên trang và xuất nhiều định dạng (Word, Excel, PDF)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút 1: Xuất Microsoft Word (.doc) */}
          <button
            id="btn-export-word"
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Xuất sang tệp Microsoft Word (.doc) - Mở trong Word để chỉnh sửa nội dung, bảng biểu và phông chữ"
          >
            <FileText className="w-4 h-4" />
            <span>Xuất Word (.doc)</span>
          </button>

          {/* Nút 2: Xuất Excel (.xlsx) */}
          <button
            id="btn-export-excel"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Xuất toàn bộ bảng dữ liệu sổ sang tệp Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel (.xlsx)</span>
          </button>

          {/* Nút 3: Mở bản in trong Tab mới (Khuyên dùng trong môi trường iframe) */}
          <button
            id="btn-print-new-tab"
            onClick={handleOpenNewTab}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Mở bản in trong tab riêng biệt để in trực tiếp hoặc lưu file PDF A4 chuẩn 100%"
          >
            <ExternalLink className="w-4 h-4" />
            <span>In / PDF (A4)</span>
          </button>

          {/* Nút 4: Chỉnh sửa cấu hình biểu mẫu */}
          <button
            id="btn-edit-template-settings"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Chỉnh sửa tên trường, cơ quan cấp trên, ngày tháng, chức danh và họ tên người ký"
          >
            <Settings className="w-4 h-4" />
            <span>Chỉnh sửa biểu mẫu</span>
          </button>

          {/* Nút 5: Bật/Tắt chế độ sửa trực tiếp trên mặt giấy */}
          <button
            id="btn-toggle-direct-edit"
            onClick={() => setIsDirectEdit(!isDirectEdit)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isDirectEdit
                ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Nhấp để bật tính năng gõ trực tiếp lên mặt giấy trước khi xuất file"
          >
            <Edit3 className="w-4 h-4" />
            <span>{isDirectEdit ? 'Đang sửa trực tiếp' : 'Sửa trực tiếp'}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {printNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2 font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{printNotification}</span>
        </div>
      )}

      {/* Direct Edit Mode Active Banner */}
      {isDirectEdit && (
        <div className="bg-blue-50 border border-blue-300 rounded-xl p-3.5 text-xs text-blue-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Edit3 className="w-4 h-4 text-blue-700 shrink-0" />
            <span className="font-medium">
              <strong>Chế độ sửa trực tiếp đang BẬT:</strong> Bạn có thể nhấp chuột trực tiếp vào bất kỳ dòng chữ nào trên trang giấy dưới đây (tiêu đề, tên người ký, ngày tháng, nội dung) để gõ sửa nội dung trước khi bấm In hoặc Xuất Word/Excel.
            </span>
          </div>
          <button
            onClick={() => setIsDirectEdit(false)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors"
          >
            Xong & Khóa chỉnh sửa
          </button>
        </div>
      )}

      {/* Template Selector Tabs */}
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl border border-slate-200">
        <button
          id="tab-template-1"
          onClick={() => setActiveTemplate('mau1_so_phong_y_te')}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTemplate === 'mau1_so_phong_y_te'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Mẫu 1: Sổ theo dõi học sinh đến phòng y tế
        </button>

        <button
          id="tab-template-2"
          onClick={() => setActiveTemplate('mau2_thuoc_vat_tu')}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTemplate === 'mau2_thuoc_vat_tu'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Mẫu 2: Sổ theo dõi thuốc & vật tư sử dụng
        </button>

        <button
          id="tab-template-3"
          onClick={() => setActiveTemplate('mau3_bao_cao_thang')}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTemplate === 'mau3_bao_cao_thang'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Mẫu 3: Báo cáo công tác y tế định kỳ
        </button>

        <button
          id="tab-template-4"
          onClick={() => setActiveTemplate('mau4_hoc_sinh_dac_biet')}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTemplate === 'mau4_hoc_sinh_dac_biet'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Mẫu 4: Danh sách HS theo dõi sức khỏe đặc biệt
        </button>

        <button
          id="tab-template-5"
          onClick={() => setActiveTemplate('mau5_nhap_xuat_ton')}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTemplate === 'mau5_nhap_xuat_ton'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Mẫu 5: Sổ Nhập - Xuất - Tồn kho thuốc A4
        </button>

        <button
          id="tab-template-6"
          onClick={() => setActiveTemplate('mau6_bien_ban_su_co')}
          className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTemplate === 'mau6_bien_ban_su_co'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Mẫu 6: Biên bản sự cố tai nạn thương tích
        </button>
      </div>

      {/* Printable Sheet View - Styled like Real A4 Paper */}
      <div
        className={`bg-white p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-md mx-auto text-slate-900 printable-sheet transition-all ${
          meta.landscape ? 'max-w-5xl' : 'max-w-4xl'
        } ${isDirectEdit ? 'ring-2 ring-blue-400' : ''}`}
        style={{ fontSize: config.fontSize }}
      >
        {/* Official Header */}
        <div className="flex justify-between items-start text-xs border-b-2 border-slate-900 pb-4 mb-6">
          <div className="text-center w-[45%]">
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`uppercase font-medium ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.governingBody}
            </p>
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`uppercase font-bold text-sm ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.schoolName}
            </p>
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`text-[11px] text-slate-600 ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.department}
            </p>
          </div>
          <div className="text-center w-[55%]">
            <p className="font-bold uppercase text-xs">{config.nationalTitle}</p>
            <p className="font-medium text-xs">{config.nationalMotto}</p>
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`text-[11px] text-slate-600 italic mt-0.5 ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {dateStr}
            </p>
          </div>
        </div>

        {/* Title Block */}
        <div className="text-center mb-4">
          <h2
            contentEditable={isDirectEdit}
            suppressContentEditableWarning
            className={`text-base font-bold uppercase ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-1 rounded' : ''}`}
          >
            {meta.title}
          </h2>
          <p
            contentEditable={isDirectEdit}
            suppressContentEditableWarning
            className={`text-xs italic text-slate-600 ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
          >
            {meta.subtitle}
          </p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">{meta.code}</p>
        </div>

        {/* TEMPLATE 1: SỔ THEO DÕI HỌC SINH ĐẾN PHÒNG Y TẾ */}
        {activeTemplate === 'mau1_so_phong_y_te' && (
          <table className="w-full text-[11px] border-collapse border border-slate-900 mt-4">
            <thead>
              <tr className="bg-slate-100 text-center font-bold">
                <th className="border border-slate-900 p-1.5 w-8">STT</th>
                <th className="border border-slate-900 p-1.5 w-24">Thời gian</th>
                <th className="border border-slate-900 p-1.5">Họ và tên học sinh</th>
                <th className="border border-slate-900 p-1.5 w-12">Lớp</th>
                <th className="border border-slate-900 p-1.5">Lý do & Sinh hiệu</th>
                <th className="border border-slate-900 p-1.5">Xử trí & Cấp thuốc</th>
                <th className="border border-slate-900 p-1.5 w-28">Kết quả</th>
                <th className="border border-slate-900 p-1.5 w-20">Ký nhận</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v, idx) => {
                const visitDateTime = v.dateTime
                  ? formatDateTimeVN(v.dateTime)
                  : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—');
                const visitReason = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';
                const visitTemp = v.vitals?.temperature || v.temperature;
                const visitTreatment = v.treatmentDetails || v.treatmentType || v.treatment || '';
                const meds = v.medicinesUsed || v.medicinesDispensed || [];

                return (
                  <tr key={v.id}>
                    <td className="border border-slate-900 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-slate-900 p-1.5 whitespace-nowrap">{visitDateTime}</td>
                    <td className="border border-slate-900 p-1.5 font-bold">
                      {maskStudentName(v.studentName, db.isPrivacyModeEnabled())}
                      <span className="block font-mono text-[10px] text-slate-500 font-normal">{v.studentCode}</span>
                    </td>
                    <td className="border border-slate-900 p-1.5 text-center font-semibold">{v.className}</td>
                    <td className="border border-slate-900 p-1.5">
                      <strong>{visitReason}</strong>
                      {visitTemp ? ` (${visitTemp}°C)` : ''}
                    </td>
                    <td className="border border-slate-900 p-1.5">
                      {visitTreatment}
                      {meds.length > 0 && (
                        <div className="font-semibold text-emerald-900 text-[10px] mt-0.5">
                          Thuốc: {meds.map((m) => `${m.medicineName} (${m.quantity} ${m.unit || ''})`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="border border-slate-900 p-1.5">{v.outcome}</td>
                    <td className="border border-slate-900 p-1.5 text-center italic">
                      {(v.performer || 'Y sĩ').split(' ').pop() || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* TEMPLATE 2: SỔ THEO DÕI THUỐC VÀ VẬT TƯ SỬ DỤNG */}
        {activeTemplate === 'mau2_thuoc_vat_tu' && (
          <table className="w-full text-[11px] border-collapse border border-slate-900 mt-4">
            <thead>
              <tr className="bg-slate-100 text-center font-bold">
                <th className="border border-slate-900 p-1.5 w-8">STT</th>
                <th className="border border-slate-900 p-1.5 w-24">Ngày cấp</th>
                <th className="border border-slate-900 p-1.5">Tên học sinh (Lớp)</th>
                <th className="border border-slate-900 p-1.5">Tên thuốc / Vật tư</th>
                <th className="border border-slate-900 p-1.5 w-16">Số lượng</th>
                <th className="border border-slate-900 p-1.5 w-20">Số lô</th>
                <th className="border border-slate-900 p-1.5 w-20">Hạn dùng</th>
                <th className="border border-slate-900 p-1.5">Lý do chỉ định</th>
              </tr>
            </thead>
            <tbody>
              {visits
                .flatMap((v) => {
                  const dateDisplay = v.dateTime
                    ? formatDateTimeVN(v.dateTime)
                    : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—');
                  const rText = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';
                  const meds = v.medicinesUsed || v.medicinesDispensed || [];
                  return meds.map((m) => ({
                    date: dateDisplay,
                    student: `${v.studentName} (${v.className})`,
                    item: m.medicineName,
                    qty: `${m.quantity} ${m.unit}`,
                    batch: m.batchNumber || '—',
                    exp: m.expDate ? formatDateVN(m.expDate) : '—',
                    reason: rText,
                  }));
                })
                .map((row, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-900 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-slate-900 p-1.5 whitespace-nowrap">{row.date}</td>
                    <td className="border border-slate-900 p-1.5 font-bold">{row.student}</td>
                    <td className="border border-slate-900 p-1.5 font-semibold">{row.item}</td>
                    <td className="border border-slate-900 p-1.5 text-center font-bold">{row.qty}</td>
                    <td className="border border-slate-900 p-1.5 text-center font-mono">{row.batch}</td>
                    <td className="border border-slate-900 p-1.5 text-center font-mono">{row.exp}</td>
                    <td className="border border-slate-900 p-1.5">{row.reason}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {/* TEMPLATE 3: BÁO CÁO THÁNG */}
        {activeTemplate === 'mau3_bao_cao_thang' && (
          <div className="space-y-4 text-xs leading-relaxed mt-4">
            <p>
              <strong>I. TÌNH HÌNH CHUNG:</strong>
            </p>
            <p>
              - Tổng số học sinh toàn trường: <strong>{students.length}</strong> học sinh (Khối 6, 7, 8, 9).
            </p>
            <p>
              - Tổng số lượt học sinh đến phòng y tế trong tháng: <strong>{monthlyReport.totalVisits}</strong> lượt.
            </p>

            <p className="pt-2">
              <strong>II. KẾT QUẢ XỬ TRÍ BAN ĐẦU:</strong>
            </p>
            <p>- Số ca đã ổn định cho về lớp / phòng y tế: {Math.max(0, monthlyReport.totalVisits - monthlyReport.emergencyTransfersCount)} ca.</p>
            <p>- Số ca liên hệ phụ huynh bàn giao đón về nghỉ ngơi: {monthlyReport.parentContactedCount} ca.</p>
            <p>- Số ca sơ cứu chuyển cơ sở y tế tuyến trên: {monthlyReport.emergencyTransfersCount} ca.</p>
            <p>- Số sự cố tai nạn thương tích tại trường: {monthlyReport.events.length} ca.</p>

            <p className="pt-2">
              <strong>III. THUỐC VÀ VẬT TƯ TIÊU THỤ:</strong>
            </p>
            <ul className="list-disc pl-5">
              {monthlyReport.medicinesUsedSummary.map((m, i) => (
                <li key={i}>
                  {m.medicineName} (Lô {m.batchNumber}): <strong>{m.quantity}</strong> {m.unit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TEMPLATE 4: HỌC SINH THEO DÕI ĐẶC BIỆT */}
        {activeTemplate === 'mau4_hoc_sinh_dac_biet' && (
          <table className="w-full text-[11px] border-collapse border border-slate-900 mt-4">
            <thead>
              <tr className="bg-slate-100 text-center font-bold">
                <th className="border border-slate-900 p-1.5 w-8">STT</th>
                <th className="border border-slate-900 p-1.5 w-20">Mã HS</th>
                <th className="border border-slate-900 p-1.5">Họ và tên học sinh</th>
                <th className="border border-slate-900 p-1.5 w-12">Lớp</th>
                <th className="border border-slate-900 p-1.5">Tiền sử dị ứng</th>
                <th className="border border-slate-900 p-1.5">Bệnh nền mạn tính</th>
                <th className="border border-slate-900 p-1.5">SĐT Phụ huynh</th>
              </tr>
            </thead>
            <tbody>
              {specialStudents.map((s, idx) => (
                <tr key={s.id}>
                  <td className="border border-slate-900 p-1.5 text-center">{idx + 1}</td>
                  <td className="border border-slate-900 p-1.5 text-center font-mono">{s.studentCode}</td>
                  <td className="border border-slate-900 p-1.5 font-bold">{s.fullName}</td>
                  <td className="border border-slate-900 p-1.5 text-center font-semibold">{s.className}</td>
                  <td className="border border-slate-900 p-1.5 text-rose-800 font-bold">{s.allergies || 'Không'}</td>
                  <td className="border border-slate-900 p-1.5">{s.chronicConditions || 'Không'}</td>
                  <td className="border border-slate-900 p-1.5 font-mono">{s.parentPhone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* TEMPLATE 5: SỔ NHẬP - XUẤT - TỒN KHO THUỐC */}
        {activeTemplate === 'mau5_nhap_xuat_ton' && (
          <table className="w-full text-[11px] border-collapse border border-slate-900 mt-4">
            <thead>
              <tr className="bg-slate-100 text-center font-bold">
                <th rowSpan={2} className="border border-slate-900 p-1 w-8">STT</th>
                <th rowSpan={2} className="border border-slate-900 p-1 w-20">Mã thuốc</th>
                <th rowSpan={2} className="border border-slate-900 p-1">Tên thuốc, nồng độ</th>
                <th rowSpan={2} className="border border-slate-900 p-1 w-16">Số lô</th>
                <th rowSpan={2} className="border border-slate-900 p-1 w-16">Hạn dùng</th>
                <th rowSpan={2} className="border border-slate-900 p-1 w-10">ĐVT</th>
                <th rowSpan={2} className="border border-slate-900 p-1 w-12">Tồn đầu</th>
                <th colSpan={2} className="border border-slate-900 p-1">Trong kỳ</th>
                <th rowSpan={2} className="border border-slate-900 p-1 w-12">Tồn cuối</th>
                <th rowSpan={2} className="border border-slate-900 p-1 w-20">Vị trí</th>
              </tr>
              <tr className="bg-slate-100 text-center font-bold">
                <th className="border border-slate-900 p-1 w-12 text-emerald-800">Nhập (+)</th>
                <th className="border border-slate-900 p-1 w-12 text-rose-800">Xuất (-)</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-slate-900 p-1 text-center">{i + 1}</td>
                  <td className="border border-slate-900 p-1 text-center font-mono font-bold">{r.medicineCode}</td>
                  <td className="border border-slate-900 p-1 font-semibold">{r.medicineName}</td>
                  <td className="border border-slate-900 p-1 text-center font-mono">{r.batchNumber}</td>
                  <td className="border border-slate-900 p-1 text-center">{formatDateVN(r.expDate)}</td>
                  <td className="border border-slate-900 p-1 text-center">{r.unit}</td>
                  <td className="border border-slate-900 p-1 text-right font-bold">{r.openingStock}</td>
                  <td className="border border-slate-900 p-1 text-right text-emerald-700 font-semibold">{r.importQuantity > 0 ? `+${r.importQuantity}` : '0'}</td>
                  <td className="border border-slate-900 p-1 text-right text-rose-700 font-semibold">{r.exportQuantity > 0 ? `-${r.exportQuantity}` : '0'}</td>
                  <td className="border border-slate-900 p-1 text-right font-bold bg-slate-50">{r.closingStock}</td>
                  <td className="border border-slate-900 p-1 text-[10px]">{r.notes || 'Tủ thuốc'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* TEMPLATE 6: BIÊN BẢN SỰ CỐ TAI NẠN THƯƠNG TÍCH */}
        {activeTemplate === 'mau6_bien_ban_su_co' && (
          <div className="space-y-4 text-xs leading-relaxed mt-4">
            <p>Hôm nay, vào hồi {new Date().getHours()} giờ {new Date().getMinutes()} phút, tại Phòng Y tế Trường THCS Đông Thạnh.</p>
            <p>Các thành viên tham gia lập biên bản ghi nhận sự việc y tế học đường gồm:</p>
            <ul className="list-disc pl-5">
              <li>1. Đại diện Ban Giám Hiệu: <strong>{config.signatory2Name}</strong> - Chức vụ: {config.signatory2Title}</li>
              <li>2. Cán bộ phụ trách y tế: <strong>{config.signatory1Name}</strong> - Chức vụ: {config.signatory1Title}</li>
              <li>3. Người chứng kiến / Giáo viên phụ trách: Đại diện Tổ Giám sát học sinh</li>
            </ul>
            <p className="font-bold pt-2">DANH SÁCH CÁC SỰ CỐ / TAI NẠN THƯƠNG TÍCH GHI NHẬN:</p>
            {healthEvents.length > 0 ? (
              healthEvents.map((e, idx) => (
                <div key={idx} className="border border-slate-300 rounded-lg p-3 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900">Vụ việc {idx + 1}: {e.eventType} - Mã: {e.eventCode}</p>
                  <p>- Thời gian: {formatDateTimeVN(e.dateTime)} | Địa điểm: {e.location}</p>
                  <p>- Học sinh: <strong>{e.studentName || 'Chưa rõ'}</strong> ({e.className || '—'})</p>
                  <p>- Tình trạng ban đầu: <strong>{e.initialCondition || 'Đau, sưng nề'}</strong></p>
                  <p>- Mô tả: {e.description}</p>
                  <p>- Xử trí y tế ban đầu: {e.treatment || 'Đã băng bó, bất động và theo dõi'}</p>
                  <p>- Kết quả & Đánh giá: <strong>{e.outcome || 'Đã ổn định và bàn giao'}</strong></p>
                </div>
              ))
            ) : (
              <p className="italic text-slate-500">Chưa ghi nhận sự cố tai nạn thương tích nào trong kỳ báo cáo.</p>
            )}
          </div>
        )}

        {/* Legal basis footer note */}
        {config.legalBasis && (
          <div
            contentEditable={isDirectEdit}
            suppressContentEditableWarning
            className={`text-[10px] text-slate-500 italic mt-6 pt-2 ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
          >
            * {config.legalBasis}
          </div>
        )}

        {/* Signatures Block */}
        <div
          className={`grid ${
            config.showSignatory3 ? 'grid-cols-3' : 'grid-cols-2'
          } text-center text-xs mt-10 pt-6 border-t border-slate-200`}
        >
          <div>
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`font-bold uppercase ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.signatory1Title}
            </p>
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`text-slate-400 italic text-[10px] mt-0.5 ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.signatory1Sub}
            </p>
            <div className="h-16" />
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`font-bold ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.signatory1Name}
            </p>
          </div>

          {config.showSignatory3 && (
            <div>
              <p
                contentEditable={isDirectEdit}
                suppressContentEditableWarning
                className={`font-bold uppercase ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
              >
                {config.signatory3Title}
              </p>
              <p
                contentEditable={isDirectEdit}
                suppressContentEditableWarning
                className={`text-slate-400 italic text-[10px] mt-0.5 ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
              >
                {config.signatory3Sub}
              </p>
              <div className="h-16" />
              <p
                contentEditable={isDirectEdit}
                suppressContentEditableWarning
                className={`font-bold ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
              >
                {config.signatory3Name}
              </p>
            </div>
          )}

          <div>
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`font-bold uppercase ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.signatory2Title}
            </p>
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`text-slate-400 italic text-[10px] mt-0.5 ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.signatory2Sub}
            </p>
            <div className="h-16" />
            <p
              contentEditable={isDirectEdit}
              suppressContentEditableWarning
              className={`font-bold ${isDirectEdit ? 'hover:bg-blue-50 cursor-text p-0.5 rounded' : ''}`}
            >
              {config.signatory2Name}
            </p>
          </div>
        </div>
      </div>

      {/* Modal Cài đặt & Chỉnh sửa Biểu mẫu (Settings Drawer / Modal) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Cài Đặt & Chỉnh Sửa Biểu Mẫu Báo Cáo Sổ Y Tế</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Nhóm 1: Đơn vị và Trường học */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>1. Thông tin đơn vị & Cơ quan hành chính</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Cơ quan cấp trên / Phòng GD&ĐT:</label>
                    <input
                      type="text"
                      value={config.governingBody}
                      onChange={(e) => setConfig({ ...config, governingBody: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="VD: PHÒNG GD&ĐT HUYỆN HÓC MÔN"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tên trường học:</label>
                    <input
                      type="text"
                      value={config.schoolName}
                      onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-bold"
                      placeholder="VD: TRƯỜNG THCS ĐÔNG THẠNH"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bộ phận phụ trách:</label>
                    <input
                      type="text"
                      value={config.department}
                      onChange={(e) => setConfig({ ...config, department: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="VD: Bộ phận: Phòng Y Tế Học Đường"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Năm học:</label>
                    <input
                      type="text"
                      value={config.academicYear}
                      onChange={(e) => setConfig({ ...config, academicYear: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="VD: 2026 - 2027"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Địa danh & Ngày tháng */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>2. Địa danh & Ngày tháng lập biểu</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Địa phương / Địa danh:</label>
                    <input
                      type="text"
                      value={config.location}
                      onChange={(e) => setConfig({ ...config, location: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="VD: Đông Thạnh, Hóc Môn"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Chuỗi ngày tháng tùy chỉnh (Để trống để tự động):</label>
                    <input
                      type="text"
                      value={config.customDateStr}
                      onChange={(e) => setConfig({ ...config, customDateStr: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="VD: Đông Thạnh, ngày 15 tháng 09 năm 2026"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 3: Chữ ký & Phê duyệt */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>3. Chức danh & Họ tên các chữ ký phê duyệt</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800">Chữ ký 1: Người lập biểu / Y tế</p>
                    <input
                      type="text"
                      value={config.signatory1Title}
                      onChange={(e) => setConfig({ ...config, signatory1Title: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      placeholder="Chức danh (CÁN BỘ Y TẾ TRƯỜNG HỌC)"
                    />
                    <input
                      type="text"
                      value={config.signatory1Name}
                      onChange={(e) => setConfig({ ...config, signatory1Name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                      placeholder="Họ và tên (Y sĩ Trần Thị Bích Thảo)"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-slate-800">Chữ ký 2: Lãnh đạo phê duyệt</p>
                    <input
                      type="text"
                      value={config.signatory2Title}
                      onChange={(e) => setConfig({ ...config, signatory2Title: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      placeholder="Chức danh (HIỆU TRƯỞNG PHÊ DUYỆT)"
                    />
                    <input
                      type="text"
                      value={config.signatory2Name}
                      onChange={(e) => setConfig({ ...config, signatory2Name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                      placeholder="Họ và tên (Ban Giám Hiệu)"
                    />
                  </div>
                </div>

                {/* Chữ ký 3 (Tùy chọn) */}
                <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cb-sig3"
                      checked={config.showSignatory3}
                      onChange={(e) => setConfig({ ...config, showSignatory3: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="cb-sig3" className="font-bold text-slate-800 cursor-pointer">
                      Bổ sung thêm Chữ ký thứ 3 (Kế toán / Thủ kho / GVCN)
                    </label>
                  </div>
                  {config.showSignatory3 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      <input
                        type="text"
                        value={config.signatory3Title}
                        onChange={(e) => setConfig({ ...config, signatory3Title: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                        placeholder="Chức danh (KẾ TOÁN / THỦ KHO)"
                      />
                      <input
                        type="text"
                        value={config.signatory3Name}
                        onChange={(e) => setConfig({ ...config, signatory3Name: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                        placeholder="Họ và tên người ký"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Nhóm 4: Căn cứ pháp lý & Khổ giấy in */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>4. Định dạng in ấn & Căn cứ pháp lý</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Khổ giấy in mặc định:</label>
                    <select
                      value={config.orientation}
                      onChange={(e) => setConfig({ ...config, orientation: e.target.value as 'portrait' | 'landscape' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      <option value="portrait">Khổ dọc (Portrait) - Phù hợp mẫu báo cáo, danh sách ít cột</option>
                      <option value="landscape">Khổ ngang (Landscape) - Phù hợp sổ nhiều cột như cấp thuốc, nhập xuất tồn</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Cỡ chữ văn bản:</label>
                    <select
                      value={config.fontSize}
                      onChange={(e) => setConfig({ ...config, fontSize: e.target.value as '10pt' | '11pt' | '12pt' })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      <option value="10pt">10pt (Nhỏ gọn, hiển thị được nhiều hàng cột trên 1 trang)</option>
                      <option value="11pt">11pt (Chuẩn quy chuẩn văn bản hành chính Việt Nam)</option>
                      <option value="12pt">12pt (Lớn, rõ ràng, dễ đọc)</option>
                    </select>
                  </div>
                </div>
                <div className="text-xs">
                  <label className="block font-semibold text-slate-700 mb-1">Căn cứ pháp lý / Ghi chú chân trang:</label>
                  <input
                    type="text"
                    value={config.legalBasis}
                    onChange={(e) => setConfig({ ...config, legalBasis: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    placeholder="VD: Căn cứ Thông tư liên tịch số 13/2016/TTLT-BYT-BGDĐT..."
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={handleResetConfig}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Khôi phục mặc định</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => handleSaveConfig(config)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu biểu mẫu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal: Reset Config */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6 text-slate-700" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Khôi Phục Biểu Mẫu Chuẩn</h3>
                <p className="text-xs text-slate-500">Trường THCS Đông Thạnh</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn khôi phục lại toàn bộ cấu hình biểu mẫu, quốc hiệu, tiêu ngữ và chức danh người ký về mặc định chuẩn của Trường THCS Đông Thạnh không?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmResetConfig}
                className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Xác nhận khôi phục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
