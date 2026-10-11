import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Pill,
  BriefcaseMedical,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Clock,
  User,
  Trash2,
  Plus,
  FileText,
  FileSpreadsheet,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  db,
  formatDateVN,
  formatDateTimeVN,
  formatTime24H,
  getCurrentDateISO,
  removeVietnameseTones,
  maskStudentName,
} from '../services/db';
import { exportClinicVisitsExcel, getFilenameDate } from '../services/excelService';
import { downloadWordDoc } from '../services/printA4Service';
import { templateConfigService } from '../services/templateConfigService';
import { ClinicVisit } from '../types';

interface ClinicVisitsLogProps {
  onNavigateToIntake?: () => void;
  onSelectStudentProfile?: (studentId: string) => void;
}

export const ClinicVisitsLog: React.FC<ClinicVisitsLogProps> = ({
  onNavigateToIntake,
  onSelectStudentProfile,
}) => {
  const [visits, setVisits] = useState<ClinicVisit[]>(() => db.getClinicVisits());
  const classes = db.getSchoolClasses();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedReason, setSelectedReason] = useState<string>('all');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'student' | 'staff'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_month'>('all');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.isPrivacyModeEnabled());

  const refreshList = () => {
    setVisits(db.getClinicVisits());
    setPrivacyMode(db.isPrivacyModeEnabled());
  };

  useEffect(() => {
    const unsub = db.subscribe(refreshList);
    return () => unsub();
  }, []);

  const todayVisits = useMemo(() => db.getTodayClinicVisits(), [visits]);

  // Filtered visits
  const filteredVisits = useMemo(() => {
    const todayStr = getCurrentDateISO();
    const currentMonthStr = todayStr.substring(0, 7);

    return visits.filter((v) => {
      if (recipientFilter === 'student' && (v.recipientType === 'teacher' || v.recipientType === 'staff' || v.staffId)) return false;
      if (recipientFilter === 'staff' && v.recipientType !== 'teacher' && v.recipientType !== 'staff' && !v.staffId) return false;
      if (selectedClass !== 'all' && v.className !== selectedClass && v.department !== selectedClass) return false;

      const visitReason = v.reason || (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason || '');
      if (selectedReason !== 'all' && !visitReason.toLowerCase().includes(selectedReason.toLowerCase())) return false;

      const visitDate = (v.dateTime ? v.dateTime.split('T')[0] : '') || v.visitDate || '';
      if (dateFilter === 'today' && !db.isVisitToday(v)) return false;
      if (dateFilter === 'this_month' && !visitDate.startsWith(currentMonthStr) && !db.isVisitToday(v)) return false;

      if (searchQuery.trim()) {
        const q = removeVietnameseTones(searchQuery.toLowerCase().trim());
        const haystack = removeVietnameseTones(
          `${v.studentName || ''} ${v.studentCode || ''} ${v.visitCode || ''} ${v.className || ''} ${v.department || ''} ${visitReason}`.toLowerCase()
        );
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [visits, selectedClass, selectedReason, dateFilter, searchQuery, recipientFilter]);

  // Pagination for high performance
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClass, selectedReason, dateFilter, searchQuery, recipientFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedVisits = useMemo(() => {
    if (pageSize >= 9999) return filteredVisits;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredVisits.slice(start, start + pageSize);
  }, [filteredVisits, safeCurrentPage, pageSize]);

  // Delete visit
  const [deleteConfirmVisit, setDeleteConfirmVisit] = useState<{ id: string; visitCode: string; studentName?: string } | null>(null);
  const [showDeleteAllVisitsModal, setShowDeleteAllVisitsModal] = useState(false);

  const confirmDeleteVisit = () => {
    if (!deleteConfirmVisit) return;
    try {
      db.deleteClinicVisit(deleteConfirmVisit.id);
      setExportNotification(`Đã xóa thành công lượt khám ${deleteConfirmVisit.visitCode}!`);
      setDeleteConfirmVisit(null);
      refreshList();
      setTimeout(() => setExportNotification(null), 4000);
    } catch (err: any) {
      setExportNotification(`Lỗi khi xóa lượt khám: ${err.message}`);
      setDeleteConfirmVisit(null);
    }
  };

  const confirmDeleteAllVisits = () => {
    try {
      const targets = [...visits];
      let count = 0;
      for (const v of targets) {
        try {
          db.deleteClinicVisit(v.id);
          count++;
        } catch (e) {
          console.warn('Error deleting visit', v.id, e);
        }
      }
      setShowDeleteAllVisitsModal(false);
      refreshList();
      setExportNotification(`Đã xóa toàn bộ ${count} lượt khám trong sổ thành công!`);
      setTimeout(() => setExportNotification(null), 5000);
    } catch (err: any) {
      setExportNotification(`Lỗi khi xóa toàn bộ sổ khám: ${err.message}`);
      setShowDeleteAllVisitsModal(false);
    }
  };

  const handleDeleteVisit = (id: string, visitCode: string, studentName?: string) => {
    setDeleteConfirmVisit({ id, visitCode, studentName });
  };

  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Export Excel (.xlsx) chuẩn sổ theo dõi phòng y tế
  const handleExportExcel = () => {
    try {
      let filterText = `Tổng số: ${filteredVisits.length} lượt khám`;
      if (selectedClass !== 'all') {
        filterText += ` • Lớp: ${selectedClass}`;
      }
      if (selectedReason !== 'all') {
        filterText += ` • Lý do: ${selectedReason}`;
      }

      exportClinicVisitsExcel(filteredVisits, filterText);
      setExportNotification(
        `Đã xuất file Excel: So_Theo_Doi_Hoc_Sinh_Phong_Y_Te_${getFilenameDate()}.xlsx thành công!`
      );
      setTimeout(() => setExportNotification(null), 5000);
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      setExportNotification('Có lỗi xảy ra khi tạo tệp Excel. Đang thử lại...');
      setTimeout(() => setExportNotification(null), 5000);
    }
  };

  // Export Microsoft Word (.doc) cho phép mở và chỉnh sửa trong Word
  const handleExportWord = () => {
    try {
      const cfg = templateConfigService.getConfig();
      const dateStr = templateConfigService.getDateString(cfg);
      const rows = filteredVisits
        .map((v, idx) => {
          const visitDateTime = v.dateTime
            ? formatDateTimeVN(v.dateTime)
            : v.visitDate
            ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}`
            : '—';
          const visitReason = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';
          const visitTemp = v.vitals?.temperature || v.temperature;
          const visitTreatment = v.treatmentDetails || v.treatmentType || v.treatment || '';
          const meds = v.medicinesUsed || v.medicinesDispensed || [];

          return `
            <tr>
              <td class="text-center">${idx + 1}</td>
              <td style="white-space: nowrap;">${visitDateTime}</td>
              <td><strong>${v.studentName}</strong><br><span style="font-size:9pt; color:#64748b;">${v.studentCode}</span></td>
              <td class="text-center font-bold">${v.className}</td>
              <td><strong>${visitReason}</strong>${visitTemp ? ` (${visitTemp}°C)` : ''}</td>
              <td>${visitTreatment}${
            meds.length > 0
              ? `<br><span style="font-size:9pt; color:#065f46; font-weight:bold;">Thuốc: ${meds
                  .map((m) => `${m.medicineName} (${m.quantity} ${m.unit || ''})`)
                  .join(', ')}</span>`
              : ''
          }</td>
              <td>${v.outcome || 'Đã ổn định'}</td>
              <td class="text-center italic">${(v.performer || 'Y sĩ').split(' ').pop()}</td>
            </tr>
          `;
        })
        .join('');

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
        <div class="doc-title">${cfg.customTitles.mau1 || 'SỔ THEO DÕI HỌC SINH ĐẾN PHÒNG Y TẾ'}</div>
        <div class="doc-subtitle">Năm học: ${cfg.academicYear} • Tổng cộng: ${filteredVisits.length} lượt khám</div>

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

        <table class="signatures-table" style="width: 100%; margin-top: 25pt; border-collapse: collapse;">
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

      downloadWordDoc(content, `So_Theo_Doi_Phong_Y_Te_${getFilenameDate()}`);
      setExportNotification('Đã xuất file Word (.doc) thành công! Có thể mở trong Microsoft Word để chỉnh sửa.');
      setTimeout(() => setExportNotification(null), 5000);
    } catch (err) {
      console.error('Lỗi khi xuất Word:', err);
      setExportNotification('Có lỗi khi tạo tệp Word. Vui lòng thử lại.');
      setTimeout(() => setExportNotification(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
              SỔ PHÒNG Y TẾ
            </span>
            <h1 className="text-xl font-bold text-slate-900">Sổ Theo Dõi Học Sinh Đến Phòng Y Tế</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Sổ điện tử ghi nhận tiếp nhận, sơ cứu, xử trí và cấp phát thuốc học sinh
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToIntake && (
            <button
              id="btn-new-clinic-intake"
              onClick={onNavigateToIntake}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tiếp nhận mới</span>
            </button>
          )}

          <button
            id="btn-print-clinic-log"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>In sổ (A4)</span>
          </button>

          <button
            id="btn-export-clinic-word"
            onClick={handleExportWord}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Tải xuống tệp Microsoft Word (.doc) cho phép mở và chỉnh sửa trong Word"
          >
            <FileText className="w-4 h-4" />
            <span>Xuất Word (.doc)</span>
          </button>

          <button
            id="btn-export-clinic-excel"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Tải xuống tệp Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>

          {visits.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAllVisitsModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Xóa toàn bộ các lượt khám trong sổ để làm mới hoặc chạy lại từ đầu"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Xóa Toàn Bộ Sổ Khám</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {exportNotification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2.5 font-medium shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotification}</span>
        </div>
      )}

      {/* Today's Clinic Visits Quick Summary Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-bold shadow-xs">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-blue-950">
                Ca Bệnh Trong Ngày ({todayVisits.length} ca thực tế)
              </h2>
              {todayVisits.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-500 text-white">
                  Ngày {formatDateVN(todayVisits[0].visitDate)}
                </span>
              )}
            </div>
            {todayVisits.length === 0 ? (
              <p className="text-xs text-slate-600 mt-0.5">
                Chưa có học sinh nào đến khám tại phòng y tế trong ngày hôm nay.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {todayVisits.map((tv) => (
                  <button
                    key={tv.id}
                    type="button"
                    onClick={() => {
                      setExpandedVisitId(tv.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 hover:border-emerald-400 text-xs font-semibold text-slate-800 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span className="font-mono text-[11px] text-emerald-700 font-bold">{tv.timeIn || '08:00'}</span>
                    <span
                      className="font-bold text-slate-900"
                      title={privacyMode ? 'Đang bật bảo mật ẩn tên' : tv.studentName}
                    >
                      {maskStudentName(tv.studentName, privacyMode)}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                      Lớp {tv.className}
                    </span>
                    <span className="text-rose-700 font-medium">
                      • {(tv.reasons && tv.reasons.length > 0 ? tv.reasons.join(', ') : tv.reason) || 'Khám y tế'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDateFilter(dateFilter === 'today' ? 'all' : 'today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              dateFilter === 'today'
                ? 'bg-purple-700 text-white border-purple-700'
                : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            {dateFilter === 'today' ? 'Đang lọc: Hôm nay (Bấm xem tất cả)' : `Lọc trong ngày (${todayVisits.length})`}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên học sinh, mã số (HS0001), mã phiếu (YT-2026-0001), lý do..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Thời gian:</span>
            {(['all', 'today', 'this_month'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  dateFilter === d
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d === 'all' ? `Tất cả (${visits.length})` : d === 'today' ? `Hôm nay (${todayVisits.length})` : 'Tháng này'}
              </button>
            ))}
          </div>

          {/* Privacy Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = db.togglePrivacyMode();
              setPrivacyMode(next);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
              privacyMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200'
                : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
            }`}
            title={privacyMode ? 'Đang bật bảo mật ẩn tên. Bấm để hiển thị tên.' : 'Bấm để ẩn tên học sinh / bệnh nhân trên sổ'}
          >
            {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
            <span>{privacyMode ? 'Đang ẩn tên' : 'Ẩn tên'}</span>
          </button>

          {/* Recipient Filter (Học sinh vs Giáo viên / Nhân viên) */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Đối tượng:</span>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'student', label: 'Học sinh' },
              { id: 'staff', label: 'GV & Nhân viên' },
            ].map((rf) => (
              <button
                key={rf.id}
                type="button"
                onClick={() => setRecipientFilter(rf.id as any)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  recipientFilter === rf.id
                    ? 'bg-teal-700 text-white shadow-xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>

          {/* Class filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Lớp:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
            >
              <option value="all">Tất cả lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  Lớp {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reason filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Lý do:</span>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-medium"
            >
              <option value="all">Tất cả lý do</option>
              <option value="Đau bụng">Đau bụng</option>
              <option value="Đau đầu">Đau đầu</option>
              <option value="Sốt">Sốt</option>
              <option value="Chấn thương">Chấn thương / Ngã</option>
              <option value="Trầy xước">Trầy xước</option>
              <option value="Chảy máu cam">Chảy máu cam</option>
              <option value="Chóng mặt">Chóng mặt / Buồn nôn</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
          <span>
            Tổng số: <strong>{filteredVisits.length}</strong> lượt khám
          </span>
          {(selectedClass !== 'all' || selectedReason !== 'all' || dateFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedClass('all');
                setSelectedReason('all');
                setDateFilter('all');
                setSearchQuery('');
              }}
              className="text-emerald-700 hover:text-emerald-800 font-medium underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Visits Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Mã phiếu</th>
                <th className="py-3 px-3">Thời gian</th>
                <th className="py-3 px-3">Học sinh</th>
                <th className="py-3 px-3">Lớp</th>
                <th className="py-3 px-3">Lý do khám</th>
                <th className="py-3 px-3">Sinh hiệu</th>
                <th className="py-3 px-3">Xử trí & Cấp thuốc</th>
                <th className="py-3 px-3">Kết quả</th>
                <th className="py-3 px-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Stethoscope className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-sm text-slate-600">Chưa có lượt tiếp nhận y tế nào</p>
                    <p className="text-xs text-slate-400 mt-1">Bấm "Tiếp nhận mới" để tạo ca tiếp nhận học sinh.</p>
                  </td>
                </tr>
              ) : (
                paginatedVisits.map((v) => {
                  const isExpanded = expandedVisitId === v.id;
                  const hasMeds = v.medicinesDispensed && v.medicinesDispensed.length > 0;
                  const hasSupplies = v.suppliesUsed && v.suppliesUsed.length > 0;

                  return (
                    <React.Fragment key={v.id}>
                      <tr
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-purple-50/40' : ''
                        }`}
                        onClick={() => setExpandedVisitId(isExpanded ? null : v.id)}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{v.visitCode}</span>
                        </td>

                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-mono text-xs">
                          {v.dateTime
                            ? formatDateTimeVN(v.dateTime)
                            : v.visitDate
                            ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}`
                            : '—'}
                        </td>

                        <td className="py-3 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {v.recipientType === 'teacher' || v.recipientType === 'staff' || v.staffId ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                                {v.recipientType === 'teacher' ? 'GV' : 'NV'}
                              </span>
                            ) : null}
                            <span title={privacyMode ? 'Đang bật bảo mật ẩn tên' : v.studentName}>
                              {maskStudentName(v.studentName, privacyMode)}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">({v.studentCode})</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`font-bold px-2 py-0.5 rounded border text-xs ${
                              v.recipientType === 'teacher' || v.recipientType === 'staff' || v.staffId
                                ? 'bg-teal-50 text-teal-800 border-teal-300'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200/60'
                            }`}
                          >
                            {v.className || v.department || '—'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-800 font-medium">
                          <span>{v.reason || (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason || '—')}</span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          {v.vitals?.weight ? (
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 mr-1">
                              {v.vitals.weight}kg
                            </span>
                          ) : null}
                          {v.temperature || v.vitals?.temperature ? (
                            <span
                              className={`font-bold ${
                                (v.temperature || v.vitals?.temperature || 0) >= 38
                                  ? 'text-rose-600 bg-rose-50 px-1 rounded'
                                  : 'text-slate-800'
                              }`}
                            >
                              {v.temperature || v.vitals?.temperature}°C
                            </span>
                          ) : !v.vitals?.weight ? (
                            '—'
                          ) : null}
                          {v.bloodPressure || v.vitals?.bloodPressure
                            ? ` | ${v.bloodPressure || v.vitals?.bloodPressure}`
                            : ''}
                        </td>

                        <td className="py-3 px-3 max-w-xs">
                          <p className="truncate text-slate-700">{v.treatment || v.treatmentDetails || v.treatmentType || '—'}</p>
                          {hasMeds && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <Pill className="w-3 h-3" />
                              <span>{(v.medicinesDispensed || v.medicinesUsed || []).map((m) => m.medicineName).join(', ')}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.outcome.includes('về lớp')
                                ? 'bg-emerald-100 text-emerald-800'
                                : v.outcome.includes('Phụ huynh')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {v.outcome}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteVisit(v.id, v.visitCode, v.studentName);
                              }}
                              title="Xóa ca khám này"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedVisitId(isExpanded ? null : v.id);
                              }}
                              title="Xem chi tiết ca khám"
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50 border-y border-purple-100">
                          <td colSpan={9} className="p-4">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">Chi tiết ca khám {v.visitCode}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-600">Người đưa đến: {v.broughtBy}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-600">Cán bộ y tế: <strong>{v.performer}</strong></span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {onSelectStudentProfile && (
                                    <button
                                      onClick={() => onSelectStudentProfile(v.studentId)}
                                      className="text-blue-700 hover:underline font-semibold"
                                    >
                                      Xem hồ sơ học sinh
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteVisit(v.id, v.visitCode, v.studentName)}
                                    className="text-rose-600 hover:text-rose-800 font-semibold ml-3"
                                  >
                                    Xóa ca này
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <p className="text-slate-400 text-[11px]">Tình trạng ban đầu:</p>
                                  <p className="font-semibold text-slate-800">{v.initialCondition}</p>
                                </div>

                                <div>
                                  <p className="text-slate-400 text-[11px]">Dấu hiệu sinh tồn & Thể lực:</p>
                                  <p className="text-slate-700">
                                    {v.vitals?.weight ? (
                                      <>
                                        Cân nặng: <strong className="text-indigo-700">{v.vitals.weight} kg</strong>
                                        {v.vitals?.height ? ` (${v.vitals.height} cm)` : ''} |{' '}
                                      </>
                                    ) : null}
                                    Nhiệt độ: <strong>{v.temperature || v.vitals?.temperature ? `${v.temperature || v.vitals?.temperature}°C` : '—'}</strong> | Mạch:{' '}
                                    <strong>{v.pulse || v.vitals?.pulse ? `${v.pulse || v.vitals?.pulse} l/p` : '—'}</strong> | Huyết áp:{' '}
                                    <strong>{v.bloodPressure || v.vitals?.bloodPressure || '—'}</strong> | SpO2:{' '}
                                    <strong>{v.spO2 || v.vitals?.spO2 ? `${v.spO2 || v.vitals?.spO2}%` : '—'}</strong>
                                  </p>
                                </div>

                                <div>
                                  <p className="text-slate-400 text-[11px]">Thông báo phụ huynh:</p>
                                  <p className="text-slate-700">
                                    {(v as any).parentNotified ? (
                                      <span className="text-emerald-700 font-bold">
                                        ✓ Đã liên hệ: {(v as any).parentContactNotes || 'Đồng ý hướng xử trí'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">Chưa cần thông báo phụ huynh</span>
                                    )}
                                  </p>
                                </div>
                              </div>

                              {/* Medicines dispensed breakdown */}
                              {hasMeds && (
                                <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200 space-y-1.5">
                                  <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                                    <Pill className="w-3.5 h-3.5" />
                                    <span>Thuốc đã cấp (Tự động trừ kho theo lô FEFO):</span>
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    {v.medicinesDispensed!.map((m, idx) => (
                                      <div key={idx} className="bg-white p-2 rounded border border-emerald-200">
                                        <div className="flex justify-between">
                                          <span className="font-bold text-slate-900">{m.medicineName}</span>
                                          <span className="font-bold text-emerald-700">
                                            {m.quantity} {m.unit}
                                          </span>
                                        </div>
                                        {m.dosageInstructions && (
                                          <p className="text-slate-500 mt-0.5">Liều dùng: {m.dosageInstructions}</p>
                                        )}
                                        {m.batchNumber && (
                                          <p className="text-slate-400 font-mono text-[10px]">
                                            Lô: {m.batchNumber} (HSD: {m.expDate ? formatDateVN(m.expDate) : '—'})
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Supplies used breakdown */}
                              {hasSupplies && (
                                <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 space-y-1.5">
                                  <p className="font-bold text-blue-900 flex items-center gap-1.5">
                                    <BriefcaseMedical className="w-3.5 h-3.5" />
                                    <span>Vật tư y tế đã sử dụng:</span>
                                  </p>
                                  <div className="flex flex-wrap gap-2 text-[11px]">
                                    {v.suppliesUsed!.map((s, idx) => (
                                      <span
                                        key={idx}
                                        className="bg-white px-2.5 py-1 rounded border border-blue-200 font-medium text-slate-800"
                                      >
                                        {s.supplyName}: <strong>{s.quantity} {s.unit}</strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {filteredVisits.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700"
              >
                <option value={20}>20 lượt / trang</option>
                <option value={30}>30 lượt / trang</option>
                <option value={50}>50 lượt / trang</option>
                <option value={9999}>Tất cả ({filteredVisits.length})</option>
              </select>
              <span>
                (<strong>{(safeCurrentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(safeCurrentPage * pageSize, filteredVisits.length)}</strong> trong số <strong>{filteredVisits.length}</strong> ca khám)
              </span>
            </div>

            {totalPages > 1 && pageSize < 9999 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Trước
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && safeCurrentPage > 3) {
                      pageNum = safeCurrentPage - 2 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer ${
                          safeCurrentPage === pageNum
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmVisit && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Ca Khám</h3>
                <p className="text-xs text-slate-500 font-mono">{deleteConfirmVisit.visitCode}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa lượt khám <strong>{deleteConfirmVisit.visitCode}</strong>
              {deleteConfirmVisit.studentName ? ` của học sinh "${deleteConfirmVisit.studentName}"` : ''}?
            </p>
            <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-3">
              Lưu ý: Nếu lượt khám có liên kết trừ kho thuốc, hệ thống sẽ tự động hủy phiếu giao dịch kho liên quan để đảm bảo số liệu.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmVisit(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteVisit}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Visits Confirmation Modal */}
      {showDeleteAllVisitsModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-300 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Xóa Toàn Bộ Sổ Khám & Cấp Thuốc?</h3>
                <p className="text-xs text-rose-600 font-bold">Làm sạch {visits.length} lượt khám trong hệ thống</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-950 space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa toàn bộ <strong>{visits.length} lượt khám</strong> trong sổ theo dõi phòng y tế?
              </p>
              <p className="text-[11px] text-rose-800">
                • Thuốc và vật tư đã sử dụng trong các ca khám này sẽ được tự động hoàn trả về kho như cũ.
                <br />
                • Thao tác này giúp bạn làm sạch dữ liệu kiểm thử để bắt đầu ghi nhận chính thức.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteAllVisitsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllVisits}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa Toàn Bộ {visits.length} Lượt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
