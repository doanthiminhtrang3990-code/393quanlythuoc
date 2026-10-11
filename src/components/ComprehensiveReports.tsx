import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  Layers,
  PieChart as PieChartIcon,
  TrendingUp,
  Stethoscope,
  Pill,
  Users,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { db, formatDateVN, getCurrentDateISO } from '../services/db';
import { exportMonthlyComprehensiveReportExcel } from '../services/excelService';
import { downloadWordDoc } from '../services/printA4Service';
import { templateConfigService } from '../services/templateConfigService';

export const ComprehensiveReports: React.FC = () => {
  const [dbTick, setDbTick] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const visits = db.getClinicVisits();
    if (visits.length > 0 && visits[0].visitDate) {
      return visits[0].visitDate.substring(0, 7);
    }
    return getCurrentDateISO().substring(0, 7);
  });
  const [reportType, setReportType] = useState<'monthly' | 'by_class'>('monthly');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setDbTick((t) => t + 1);
    });
    return () => unsub();
  }, []);

  const monthlyReport = useMemo(() => {
    return db.getMonthlyClinicReport(selectedMonth);
  }, [selectedMonth, dbTick]);

  const classStats = useMemo(() => {
    return db.getSchoolClasses().map((c) => {
      const stats = db.getClassClinicStats(c.name);
      return {
        className: c.name,
        grade: c.grade,
        visitCount: stats.totalVisits,
        topReasons: stats.topReasons.slice(0, 3).map((r) => r.reason),
      };
    });
  }, [selectedMonth, dbTick]);

  // Export Monthly Report to Excel (.xlsx)
  const handleExportMonthlyExcel = () => {
    try {
      exportMonthlyComprehensiveReportExcel(selectedMonth, monthlyReport, classStats);
      setNotification({ type: 'success', message: 'Đã xuất file báo cáo tổng hợp Excel (.xlsx) thành công!' });
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      setNotification({ type: 'error', message: 'Có lỗi xảy ra khi tạo tệp Excel. Vui lòng thử lại.' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Export Monthly Report to Microsoft Word (.doc)
  const handleExportMonthlyWord = () => {
    try {
      const cfg = templateConfigService.getConfig();
      const dateStr = templateConfigService.getDateString(cfg);
      const content = `
        <table class="header-table">
          <tr>
            <td class="header-left">
              <div class="unit-name">${cfg.governingBody}</div>
              <div class="school-name">${cfg.schoolName}</div>
              <div>${cfg.department}</div>
              <div class="divider-line"></div>
            </td>
            <td class="header-right">
              <div class="national-title">${cfg.nationalTitle}</div>
              <div class="national-motto">${cfg.nationalMotto}</div>
              <div class="divider-line"></div>
              <div style="font-style: italic; font-size: 10pt; margin-top: 4px;">${dateStr}</div>
            </td>
          </tr>
        </table>

        <div class="doc-title">BÁO CÁO CÔNG TÁC Y TẾ HỌC ĐƯỜNG THÁNG ${selectedMonth}</div>
        <div class="doc-subtitle">Năm học: ${cfg.academicYear} • Đơn vị: ${cfg.schoolName}</div>

        <div style="font-size: 11pt; line-height: 1.6; margin-top: 15pt;">
          <p><strong>I. TỔNG HỢP LƯỢT KHÁM & SƠ CỨU BAN ĐẦU:</strong></p>
          <ul style="padding-left: 20px;">
            <li>Tổng số lượt học sinh đến phòng y tế: <strong>${monthlyReport.totalVisits}</strong> lượt.</li>
            <li>Số ca đã ổn định cho về lớp học: <strong>${monthlyReport.outcomes['Đã ổn định cho về lớp'] || 0}</strong> ca.</li>
            <li>Số ca bàn giao phụ huynh đón về theo dõi: <strong>${monthlyReport.outcomes['Bàn giao phụ huynh đón về'] || 0}</strong> ca.</li>
            <li>Số ca sơ cứu chuyển cơ sở y tế tuyến trên: <strong>${monthlyReport.outcomes['Chuyển cơ sở y tế tuyến trên'] || 0}</strong> ca.</li>
            <li>Số sự cố y tế / tai nạn thương tích học đường: <strong>${monthlyReport.healthEventsCount}</strong> vụ việc.</li>
          </ul>

          <p style="margin-top: 12pt;"><strong>II. CƠ CẤU LÝ DO ĐẾN PHÒNG Y TẾ:</strong></p>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th>Lý do đến khám / Triệu chứng</th>
                <th style="width: 100px;">Số lượt</th>
                <th style="width: 100px;">Tỷ lệ (%)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(monthlyReport.byReason)
                .map(
                  ([reason, count], idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><strong>${reason}</strong></td>
                  <td class="text-center font-bold">${count}</td>
                  <td class="text-center">${Math.round((Number(count) / (monthlyReport.totalVisits || 1)) * 100)}%</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <p style="margin-top: 12pt;"><strong>III. THUỐC VÀ VẬT TƯ ĐÃ XUẤT SỬ DỤNG:</strong></p>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th>Tên thuốc / Vật tư</th>
                <th style="width: 90px;">Số lô</th>
                <th style="width: 80px;">Số lượng</th>
                <th style="width: 60px;">ĐVT</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyReport.medicinesUsedSummary
                .map(
                  (m, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><strong>${m.medicineName}</strong></td>
                  <td class="text-center font-mono">${m.batchNumber}</td>
                  <td class="text-center font-bold">${m.quantity}</td>
                  <td class="text-center">${m.unit}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <table class="signatures-table" style="width: 100%; margin-top: 30pt; border-collapse: collapse;">
          <tr>
            <td style="text-align: center; vertical-align: top; width: 50%;">
              <div class="signature-title">${cfg.signatory1Title}</div>
              <div class="signature-sub">${cfg.signatory1Sub}</div>
              <div class="signature-space" style="height: 60pt;"></div>
              <div class="signature-name">${cfg.signatory1Name}</div>
            </td>
            <td style="text-align: center; vertical-align: top; width: 50%;">
              <div class="signature-title">${cfg.signatory2Title}</div>
              <div class="signature-sub">${cfg.signatory2Sub}</div>
              <div class="signature-space" style="height: 60pt;"></div>
              <div class="signature-name">${cfg.signatory2Name}</div>
            </td>
          </tr>
        </table>
      `;

      downloadWordDoc(content, `Bao_Cao_Y_Te_Thang_${selectedMonth}_${cfg.schoolName.replace(/\s+/g, '_')}`);
      setNotification({ type: 'success', message: 'Đã xuất file Word (.doc) thành công! Quý Thầy/Cô có thể mở trong Microsoft Word để chỉnh sửa.' });
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Lỗi xuất Word:', err);
      setNotification({ type: 'error', message: 'Có lỗi khi tạo tệp Word. Vui lòng thử lại.' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
              BÁO CÁO TỔNG HỢP
            </span>
            <h1 className="text-xl font-bold text-slate-900">Báo Cáo Công Tác Y Tế Học Đường</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Thống kê định kỳ hàng tháng phục vụ báo cáo Ban Giám Hiệu & Phòng GD&ĐT
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-600">Chọn tháng:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-0 focus:ring-0 p-0"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>In A4</span>
          </button>

          <button
            id="btn-export-monthly-word"
            onClick={handleExportMonthlyWord}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Tải xuống tệp Microsoft Word (.doc) cho phép chỉnh sửa toàn bộ báo cáo"
          >
            <FileText className="w-4 h-4" />
            <span>Xuất Word (.doc)</span>
          </button>

          <button
            id="btn-export-monthly-excel"
            onClick={handleExportMonthlyExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Tải xuống tệp Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setReportType('monthly')}
          className={`flex items-center gap-2 pb-3 font-bold text-xs border-b-2 transition-colors ${
            reportType === 'monthly'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Báo cáo tháng toàn trường</span>
        </button>

        <button
          onClick={() => setReportType('by_class')}
          className={`flex items-center gap-2 pb-3 font-bold text-xs border-b-2 transition-colors ${
            reportType === 'by_class'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Thống kê phân bổ theo lớp học</span>
        </button>
      </div>

      {reportType === 'monthly' ? (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Tổng số lượt khám</p>
              <p className="text-2xl font-bold text-indigo-800 mt-1">{monthlyReport.totalVisits}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Trong tháng {selectedMonth}</p>
            </div>

            <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 shadow-xs">
              <p className="text-xs font-bold text-emerald-800">Đã ổn định về lớp</p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">
                {monthlyReport.outcomes['Đã ổn định cho về lớp'] || 0}
              </p>
              <p className="text-[10px] text-emerald-700 mt-0.5">Xử trí sơ cứu thành công</p>
            </div>

            <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 shadow-xs">
              <p className="text-xs font-bold text-amber-800">Phụ huynh đón về</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {monthlyReport.outcomes['Bàn giao phụ huynh đón về'] || 0}
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5">Cần nghỉ ngơi tại nhà</p>
            </div>

            <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 shadow-xs">
              <p className="text-xs font-bold text-rose-800">Chuyển viện / Tai nạn</p>
              <p className="text-2xl font-bold text-rose-900 mt-1">
                {(monthlyReport.outcomes['Chuyển cơ sở y tế tuyến trên'] || 0) + monthlyReport.healthEventsCount}
              </p>
              <p className="text-[10px] text-rose-700 mt-0.5">Chuyển BV Hóc Môn / Sự cố</p>
            </div>
          </div>

          {/* Breakdown by Reason & Medicines Used */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reasons breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Cơ Cấu Lý Do Đến Phòng Y Tế</h3>
              <div className="space-y-2.5">
                {Object.entries(monthlyReport.byReason).length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Không có ca khám trong tháng này.</p>
                ) : (
                  Object.entries(monthlyReport.byReason).map(([reason, count]) => {
                    const numCount = Number(count);
                    const pct = Math.round((numCount / (monthlyReport.totalVisits || 1)) * 100);
                    return (
                      <div key={reason} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-700">{reason}</span>
                          <span className="text-slate-900">
                            {numCount} lượt ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Medicines Dispensed */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Tổng Hợp Thuốc Đã Cấp Phát</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Tên thuốc</th>
                      <th className="py-2 px-3 text-right">Tổng số lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyReport.medicinesUsed.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-slate-400">
                          Chưa cấp thuốc trong tháng này.
                        </td>
                      </tr>
                    ) : (
                      monthlyReport.medicinesUsed.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{m.medicineName}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {m.quantity} {m.unit}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Breakdown by Class */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-xs uppercase text-slate-700">
              Thống Kê Lượt Khám Phân Bổ Theo Lớp (Tháng {selectedMonth})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Lớp</th>
                  <th className="py-3 px-4">Khối</th>
                  <th className="py-3 px-4 text-center">Số lượt vào phòng y tế</th>
                  <th className="py-3 px-4">Các lý do chính</th>
                  <th className="py-3 px-4">Đánh giá nguy cơ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStats.map((item) => (
                  <tr key={item.className} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{item.className}</td>
                    <td className="py-3 px-4 text-slate-600">Khối {item.grade}</td>
                    <td className="py-3 px-4 text-center font-bold text-indigo-800 text-sm">{item.visitCount}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {item.topReasons.length > 0 ? item.topReasons.join(', ') : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {item.visitCount >= 4 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          ⚠️ Cần lưu ý theo dõi lớp
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          Bình thường
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
