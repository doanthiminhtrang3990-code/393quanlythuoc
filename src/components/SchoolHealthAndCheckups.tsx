import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  AlertOctagon,
  Calendar,
  Plus,
  Search,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  User,
  PieChart as PieChartIcon,
  X,
  Edit,
  Trash2,
  FileSpreadsheet,
  Upload,
  ChevronDown,
  Filter,
  FileText,
  Check,
  Building,
  HeartPulse,
} from 'lucide-react';
import {
  db,
  formatDateVN,
  formatDateTimeVN,
  removeVietnameseTones,
  getCurrentDateISO,
  getCurrentTimeVN,
  maskStudentName,
} from '../services/db';
import { HealthEvent, HealthCheckup, Student } from '../types';
import {
  exportHealthEventsExcel,
  exportHealthCheckupsExcel,
  exportCombinedHealthAndCheckupsExcel,
  exportHealthEventsTemplateExcel,
  exportHealthCheckupsTemplateExcel,
} from '../services/excelService';
import { SchoolHealthImportModal } from './SchoolHealthImportModal';
import { HierarchicalStudentPicker } from './HierarchicalStudentPicker';
import { DateInputVN, DateTimeInputVN } from './DateInputVN';

export const SchoolHealthAndCheckups: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'events' | 'checkups'>('events');
  const [events, setEvents] = useState<HealthEvent[]>(() => db.getHealthEvents());
  const [checkups, setCheckups] = useState<HealthCheckup[]>(() => db.getHealthCheckups());
  const [students, setStudents] = useState<Student[]>(() => db.getStudents());

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedCheckupFilter, setSelectedCheckupFilter] = useState<string>('all');

  // Export dropdown state
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Modals state
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<HealthEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<HealthEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const [isAddCheckupModalOpen, setIsAddCheckupModalOpen] = useState(false);
  const [editingCheckup, setEditingCheckup] = useState<HealthCheckup | null>(null);
  const [viewingCheckup, setViewingCheckup] = useState<HealthCheckup | null>(null);
  const [deletingCheckupId, setDeletingCheckupId] = useState<string | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshData = () => {
    setEvents(db.getHealthEvents());
    setCheckups(db.getHealthCheckups());
    setStudents(db.getStudents());
  };

  useEffect(() => {
    const unsub = db.subscribe(refreshData);
    return () => unsub();
  }, []);

  // New Event Form State
  const [eventForm, setEventForm] = useState({
    dateTime: `${getCurrentDateISO()}T${getCurrentTimeVN()}`,
    location: 'Sân trường',
    eventType: 'Tai nạn' as any,
    studentId: '',
    description: '',
    initialCondition: '',
    treatment: '',
    witness: '',
    performer: 'Đỗ Thị Mai Trang (Y tế học đường)',
    outcome: 'Đã sơ cứu, theo dõi tiếp tục',
    notes: '',
  });

  // New Checkup Form State
  const [checkupForm, setCheckupForm] = useState({
    checkupDate: getCurrentDateISO(),
    schoolYear: '2026-2027',
    studentId: '',
    height: 152,
    weight: 44,
    pulse: 80,
    bloodPressure: '105/70',
    eyesightLeft: '10/10',
    eyesightRight: '10/10',
    hasRefraction: false,
    refractiveError: 'Không',
    dentalCondition: 'Bình thường, không sâu răng',
    entCondition: 'Bình thường',
    scoliosis: false,
    nutritionStatus: 'Bình thường' as any,
    recommendations: 'Duy trì chế độ dinh dưỡng và thể dục thể thao đều đặn',
    doctorOrStaff: 'Bs. Nguyễn Thanh Hà (TTYT Hóc Môn)',
  });

  // Submit new Event
  const handleSubmitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const stu = students.find((s) => s.id === eventForm.studentId);
    db.addHealthEvent({
      ...eventForm,
      studentName: stu?.fullName,
      studentCode: stu?.studentCode,
      className: stu?.className,
    });
    setEventForm({
      dateTime: `${getCurrentDateISO()}T${getCurrentTimeVN()}`,
      location: 'Sân trường',
      eventType: 'Tai nạn' as any,
      studentId: '',
      description: '',
      initialCondition: '',
      treatment: '',
      witness: '',
      performer: 'Đỗ Thị Mai Trang (Y tế học đường)',
      outcome: 'Đã sơ cứu, theo dõi tiếp tục',
      notes: '',
    });
    setIsAddEventModalOpen(false);
    refreshData();
    showToast('Đã ghi nhận sự cố y tế học đường thành công');
  };

  // Submit update Event
  const handleUpdateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    const stu = students.find((s) => s.id === editingEvent.studentId);
    db.updateHealthEvent(editingEvent.id, {
      ...editingEvent,
      studentName: stu ? stu.fullName : editingEvent.studentId ? editingEvent.studentName : undefined,
      studentCode: stu ? stu.studentCode : editingEvent.studentId ? editingEvent.studentCode : undefined,
      className: stu ? stu.className : editingEvent.studentId ? editingEvent.className : undefined,
    });
    setEditingEvent(null);
    refreshData();
    showToast('Đã lưu điều chỉnh sự cố y tế thành công');
  };

  // Delete Event
  const confirmDeleteEvent = () => {
    if (!deletingEventId) return;
    db.deleteHealthEvent(deletingEventId);
    if (editingEvent?.id === deletingEventId) setEditingEvent(null);
    if (viewingEvent?.id === deletingEventId) setViewingEvent(null);
    setDeletingEventId(null);
    refreshData();
    showToast('Đã xóa bản ghi sự cố y tế');
  };

  // Submit new Checkup
  const handleSubmitCheckup = (e: React.FormEvent) => {
    e.preventDefault();
    const stu = students.find((s) => s.id === checkupForm.studentId);
    if (!stu) return;

    const bmi = parseFloat((checkupForm.weight / Math.pow(checkupForm.height / 100, 2)).toFixed(1));

    db.addHealthCheckup({
      ...checkupForm,
      studentCode: stu.studentCode,
      studentName: stu.fullName,
      className: stu.className,
      bmi,
    });
    setCheckupForm((prev) => ({
      ...prev,
      studentId: '',
      checkupDate: getCurrentDateISO(),
    }));
    setIsAddCheckupModalOpen(false);
    refreshData();
    showToast(`Đã thêm kết quả khám cho học sinh ${stu.fullName}`);
  };

  // Submit update Checkup
  const handleUpdateCheckup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCheckup) return;
    const stu = students.find((s) => s.id === editingCheckup.studentId);
    const bmi = parseFloat(
      (editingCheckup.weight / Math.pow(editingCheckup.height / 100, 2)).toFixed(1)
    );

    db.updateHealthCheckup(editingCheckup.id, {
      ...editingCheckup,
      studentName: stu ? stu.fullName : editingCheckup.studentName,
      studentCode: stu ? stu.studentCode : editingCheckup.studentCode,
      className: stu ? stu.className : editingCheckup.className,
      bmi,
    });
    setEditingCheckup(null);
    refreshData();
    showToast(`Đã điều chỉnh kết quả khám sức khỏe thành công`);
  };

  // Delete Checkup
  const confirmDeleteCheckup = () => {
    if (!deletingCheckupId) return;
    db.deleteHealthCheckup(deletingCheckupId);
    if (editingCheckup?.id === deletingCheckupId) setEditingCheckup(null);
    if (viewingCheckup?.id === deletingCheckupId) setViewingCheckup(null);
    setDeletingCheckupId(null);
    refreshData();
    showToast('Đã xóa phiếu khám sức khỏe học sinh');
  };

  // Unique Classes list for filters
  const classList = useMemo(() => {
    const set = new Set<string>();
    checkups.forEach((c) => c.className && set.add(c.className));
    events.forEach((e) => e.className && set.add(e.className));
    return Array.from(set).sort();
  }, [checkups, events]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const q = removeVietnameseTones(searchQuery.toLowerCase().trim());
      const haystack = removeVietnameseTones(
        `${e.eventCode || ''} ${e.studentName || ''} ${e.studentCode || ''} ${e.className || ''} ${e.location || ''} ${e.description || ''} ${e.treatment || ''} ${e.eventType || ''}`.toLowerCase()
      );
      const matchQuery = !q || haystack.includes(q);

      const matchType = selectedEventType === 'all' || e.eventType === selectedEventType;
      const matchClass = selectedClass === 'all' || e.className === selectedClass;

      return matchQuery && matchType && matchClass;
    });
  }, [events, searchQuery, selectedEventType, selectedClass]);

  // Filtered Checkups
  const filteredCheckups = useMemo(() => {
    return checkups.filter((c) => {
      const q = removeVietnameseTones(searchQuery.toLowerCase().trim());
      const haystack = removeVietnameseTones(
        `${c.checkupCode || ''} ${c.studentName || ''} ${c.studentCode || ''} ${c.className || ''} ${c.dentalCondition || ''} ${c.recommendations || ''}`.toLowerCase()
      );
      const matchQuery = !q || haystack.includes(q);

      const matchClass = selectedClass === 'all' || c.className === selectedClass;

      let matchFilter = true;
      if (selectedCheckupFilter === 'myopia') {
        matchFilter = Boolean(c.hasRefraction || (c as any).refractiveError);
      } else if (selectedCheckupFilter === 'dental') {
        matchFilter = Boolean(
          c.dentalCondition &&
            !c.dentalCondition.toLowerCase().includes('bình thường') &&
            !c.dentalCondition.toLowerCase().includes('tốt')
        );
      } else if (selectedCheckupFilter === 'spine') {
        matchFilter = Boolean(c.scoliosis || (c as any).spineStatus?.includes('cong vẹo'));
      } else if (selectedCheckupFilter === 'abnormalWeight') {
        const nut = c.nutritionStatus || (c as any).nutritionClassification;
        matchFilter = nut && nut !== 'Bình thường';
      }

      return matchQuery && matchClass && matchFilter;
    });
  }, [checkups, searchQuery, selectedClass, selectedCheckupFilter]);

  // Stats for Checkups
  const checkupStats = useMemo(() => {
    const total = checkups.length;
    if (total === 0) return { total: 0, myopiaRate: 0, dentalRate: 0, spineRate: 0, myopiaCount: 0, dentalCount: 0, spineCount: 0 };
    const myopia = checkups.filter((c) => c.hasRefraction || ((c as any).refractiveError && (c as any).refractiveError !== 'Không')).length;
    const dental = checkups.filter(
      (c) =>
        c.dentalCondition &&
        !c.dentalCondition.toLowerCase().includes('bình thường') &&
        !c.dentalCondition.toLowerCase().includes('tốt')
    ).length;
    const spine = checkups.filter((c) => c.scoliosis || (c as any).spineStatus?.includes('cong vẹo')).length;

    return {
      total,
      myopiaCount: myopia,
      myopiaRate: Math.round((myopia / total) * 100),
      dentalCount: dental,
      dentalRate: Math.round((dental / total) * 100),
      spineCount: spine,
      spineRate: Math.round((spine / total) * 100),
    };
  }, [checkups]);

  // Export handlers
  const handleExportEvents = () => {
    setIsExportMenuOpen(false);
    const filterInfo =
      selectedEventType !== 'all' || selectedClass !== 'all' || searchQuery
        ? `Đã lọc (${filteredEvents.length} sự cố)`
        : '';
    exportHealthEventsExcel(filteredEvents, filterInfo);
    showToast('Đã xuất file Excel Sổ sự cố tai nạn học đường');
  };

  const handleExportCheckups = () => {
    setIsExportMenuOpen(false);
    const filterInfo =
      selectedClass !== 'all' || selectedCheckupFilter !== 'all' || searchQuery
        ? `Đã lọc (${filteredCheckups.length} học sinh)`
        : '';
    exportHealthCheckupsExcel(filteredCheckups, filterInfo);
    showToast('Đã xuất file Excel Kết quả khám sức khỏe học sinh định kỳ');
  };

  const handleExportCombined = () => {
    setIsExportMenuOpen(false);
    exportCombinedHealthAndCheckupsExcel(events, checkups);
    showToast('Đã xuất file Excel trọn bộ cả 2 sổ (Tai nạn & Khám định kỳ)');
  };

  const handleDownloadTemplate = () => {
    setIsExportMenuOpen(false);
    if (activeTab === 'events') {
      exportHealthEventsTemplateExcel();
      showToast('Đã tải file mẫu Excel nhập/điều chỉnh Tai nạn');
    } else {
      exportHealthCheckupsTemplateExcel();
      showToast('Đã tải file mẫu Excel nhập/điều chỉnh Khám định kỳ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              Y TẾ HỌC ĐƯỜNG
            </span>
            <h1 className="text-xl font-bold text-slate-900">Sự Kiện Tai Nạn & Khám Sức Khỏe Định Kỳ</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Theo dõi tai nạn thương tích, sự cố y tế và kết quả khám sức khỏe hàng năm
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Add Record Button */}
          {activeTab === 'events' ? (
            <button
              onClick={() => setIsAddEventModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi nhận sự cố y tế</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddCheckupModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm kết quả khám</span>
            </button>
          )}

          {/* EXPORT TO EXCEL BUTTON WITH DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Xuất file để điều chỉnh</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
            </button>

            {isExportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-40 p-2 text-xs divide-y divide-slate-100">
                  <div className="p-1 space-y-1">
                    <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Xuất dữ liệu Excel để chỉnh sửa
                    </p>
                    <button
                      onClick={handleExportEvents}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-rose-50 text-slate-700 hover:text-rose-800 font-semibold"
                    >
                      <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <span>Xuất Sổ Sự Cố Tai Nạn (.xlsx)</span>
                        <span className="block text-[10px] font-normal text-slate-400">
                          {filteredEvents.length} sự cố theo bộ lọc
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={handleExportCheckups}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-semibold"
                    >
                      <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span>Xuất Kết Quả Khám Định Kỳ (.xlsx)</span>
                        <span className="block text-[10px] font-normal text-slate-400">
                          {filteredCheckups.length} học sinh theo bộ lọc
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={handleExportCombined}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-800 font-semibold"
                    >
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span>Xuất Trọn Bộ Cả 2 Sổ (2 Sheet)</span>
                        <span className="block text-[10px] font-normal text-slate-400">
                          Đầy đủ Tai nạn & Khám định kỳ
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="p-1 pt-1.5">
                    <button
                      onClick={handleDownloadTemplate}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-xl hover:bg-slate-100 text-slate-600 font-semibold text-[11px]"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Tải file mẫu Excel chuẩn để nhập/sửa</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* IMPORT EXCEL BUTTON */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Nhập file điều chỉnh</span>
          </button>

          {/* PRINT BUTTON */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>In sổ</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => {
            setActiveTab('events');
            setSelectedCheckupFilter('all');
          }}
          className={`flex items-center gap-2 pb-3 font-bold text-xs border-b-2 transition-colors ${
            activeTab === 'events'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Sự kiện tai nạn, chấn thương, dịch bệnh ({events.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('checkups');
            setSelectedEventType('all');
          }}
          className={`flex items-center gap-2 pb-3 font-bold text-xs border-b-2 transition-colors ${
            activeTab === 'checkups'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Khám sức khỏe học sinh định kỳ ({checkups.length})</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'events'
                ? 'Tìm theo mã sự kiện, tên học sinh, lớp, sự cố...'
                : 'Tìm theo mã phiếu, tên học sinh, lớp, bệnh lý...'
            }
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filter by Event Type for Events tab */}
          {activeTab === 'events' && (
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white"
            >
              <option value="all">Tất cả loại sự cố</option>
              <option value="Tai nạn">Tai nạn</option>
              <option value="Chấn thương">Chấn thương</option>
              <option value="Sốt cao">Sốt cao</option>
              <option value="Ngất">Ngất xỉu</option>
              <option value="Dịch bệnh nghi ngờ">Dịch bệnh nghi ngờ</option>
              <option value="Dị ứng">Dị ứng</option>
              <option value="Sự cố khác">Sự cố khác</option>
            </select>
          )}

          {/* Filter by Health Category for Checkups tab */}
          {activeTab === 'checkups' && (
            <select
              value={selectedCheckupFilter}
              onChange={(e) => setSelectedCheckupFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white"
            >
              <option value="all">Tất cả thể trạng</option>
              <option value="myopia">Tật khúc xạ (Cận thị)</option>
              <option value="dental">Bệnh Răng - Hàm - Mặt</option>
              <option value="spine">Cong vẹo cột sống</option>
              <option value="abnormalWeight">Thừa cân / Suy dinh dưỡng</option>
            </select>
          )}

          {/* Filter by Class */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white"
          >
            <option value="all">Tất cả lớp học</option>
            {classList.map((cls) => (
              <option key={cls} value={cls}>
                Lớp {cls}
              </option>
            ))}
          </select>

          {(searchQuery || selectedEventType !== 'all' || selectedClass !== 'all' || selectedCheckupFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedEventType('all');
                setSelectedClass('all');
                setSelectedCheckupFilter('all');
              }}
              className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-medium"
            >
              Đặt lại lọc
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: SỰ KIỆN Y TẾ & TAI NẠN THƯƠNG TÍCH */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div
              onClick={() => setSelectedEventType(selectedEventType === 'Tai nạn' ? 'all' : 'Tai nạn')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedEventType === 'Tai nạn'
                  ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-500/20'
                  : 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/60'
              }`}
            >
              <p className="text-xs font-bold text-rose-800">Tai nạn, chấn thương sân trường</p>
              <p className="text-2xl font-bold text-rose-900 mt-1">
                {events.filter((e) => e.eventType === 'Tai nạn' || e.eventType === 'Chấn thương').length}
              </p>
              <p className="text-[10px] text-rose-600/80 mt-0.5">Xảy ra trong giờ thể dục hoặc ra chơi (Nhấn để lọc)</p>
            </div>

            <div
              onClick={() => setSelectedEventType(selectedEventType === 'Sốt cao' ? 'all' : 'Sốt cao')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedEventType === 'Sốt cao'
                  ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-500/20'
                  : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/60'
              }`}
            >
              <p className="text-xs font-bold text-amber-800">Sốt cao & Ngất tại lớp</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {events.filter((e) => e.eventType === 'Sốt cao' || e.eventType === 'Ngất').length}
              </p>
              <p className="text-[10px] text-amber-600/80 mt-0.5">Được sơ cứu và bàn giao phụ huynh (Nhấn để lọc)</p>
            </div>

            <div
              onClick={() => setSelectedEventType(selectedEventType === 'Dịch bệnh nghi ngờ' ? 'all' : 'Dịch bệnh nghi ngờ')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedEventType === 'Dịch bệnh nghi ngờ'
                  ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-500/20'
                  : 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/60'
              }`}
            >
              <p className="text-xs font-bold text-blue-800">Dịch bệnh nghi ngờ / Dị ứng</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {events.filter((e) => e.eventType === 'Dịch bệnh nghi ngờ' || e.eventType === 'Dị ứng').length}
              </p>
              <p className="text-[10px] text-blue-600/80 mt-0.5">Theo dõi giám sát y tế trường học (Nhấn để lọc)</p>
            </div>
          </div>

          {/* Events Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Danh sách sự cố tai nạn ({filteredEvents.length} bản ghi)
              </span>
              <span className="text-[11px] text-slate-500">
                Nhấn biểu tượng bút chì để điều chỉnh trực tiếp hoặc nút Xuất file để sửa bằng Excel
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5">Mã sự kiện</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3">Địa điểm</th>
                    <th className="py-3 px-3">Phân loại</th>
                    <th className="py-3 px-3">Học sinh liên quan</th>
                    <th className="py-3 px-3">Mô tả sự cố & Sơ cứu</th>
                    <th className="py-3 px-3">Kết quả xử trí</th>
                    <th className="py-3 px-3 text-center">Thao tác điều chỉnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        Không tìm thấy sự cố y tế nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {e.eventCode}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {formatDateTimeVN(e.dateTime)}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">{e.location}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              e.eventType === 'Tai nạn' || e.eventType === 'Chấn thương'
                                ? 'bg-rose-100 text-rose-800'
                                : e.eventType === 'Sốt cao'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {e.eventType}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {e.studentName ? (
                            <div>
                              <span>{maskStudentName(e.studentName, db.isPrivacyModeEnabled())}</span>
                              <span className="text-[10px] text-slate-400 block font-normal">
                                Lớp {e.className} ({e.studentCode || 'HS'})
                              </span>
                            </div>
                          ) : (
                            'Nhiều học sinh / Tập thể'
                          )}
                        </td>
                        <td className="py-3 px-3 max-w-sm">
                          <p className="font-medium text-slate-800">{e.description}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Sơ cứu: {e.treatment}</p>
                        </td>
                        <td className="py-3 px-3 text-emerald-800 font-semibold">{e.outcome}</td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewingEvent(e)}
                              title="Xem chi tiết & In phiếu"
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingEvent({ ...e })}
                              title="Điều chỉnh thông tin"
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingEventId(e.id)}
                              title="Xóa sự kiện"
                              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KHÁM SỨC KHỎE ĐỊNH KỲ */}
      {activeTab === 'checkups' && (
        <div className="space-y-4">
          {/* Health Indicators Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setSelectedCheckupFilter('all')}
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                selectedCheckupFilter === 'all'
                  ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <p className="text-xs font-semibold text-slate-500">Tổng HS đã khám</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{checkupStats.total}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Đợt khám đầu năm học</p>
            </div>

            <div
              onClick={() => setSelectedCheckupFilter(selectedCheckupFilter === 'myopia' ? 'all' : 'myopia')}
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                selectedCheckupFilter === 'myopia'
                  ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-500/20'
                  : 'bg-amber-50 border-amber-200 hover:bg-amber-100/60'
              }`}
            >
              <p className="text-xs font-bold text-amber-800">Tật khúc xạ (Cận thị)</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {checkupStats.myopiaRate}%{' '}
                <span className="text-xs font-normal text-amber-700">({checkupStats.myopiaCount} HS)</span>
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5">Thị lực &lt; 10/10 (Nhấn để lọc)</p>
            </div>

            <div
              onClick={() => setSelectedCheckupFilter(selectedCheckupFilter === 'dental' ? 'all' : 'dental')}
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                selectedCheckupFilter === 'dental'
                  ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-500/20'
                  : 'bg-blue-50 border-blue-200 hover:bg-blue-100/60'
              }`}
            >
              <p className="text-xs font-bold text-blue-800">Bệnh Răng - Miệng</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {checkupStats.dentalRate}%{' '}
                <span className="text-xs font-normal text-blue-700">({checkupStats.dentalCount} HS)</span>
              </p>
              <p className="text-[10px] text-blue-700 mt-0.5">Sâu răng, viêm lợi (Nhấn để lọc)</p>
            </div>

            <div
              onClick={() => setSelectedCheckupFilter(selectedCheckupFilter === 'spine' ? 'all' : 'spine')}
              className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
                selectedCheckupFilter === 'spine'
                  ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-500/20'
                  : 'bg-purple-50 border-purple-200 hover:bg-purple-100/60'
              }`}
            >
              <p className="text-xs font-bold text-purple-800">Cong vẹo cột sống</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {checkupStats.spineRate}%{' '}
                <span className="text-xs font-normal text-purple-700">({checkupStats.spineCount} HS)</span>
              </p>
              <p className="text-[10px] text-purple-700 mt-0.5">Tư thế ngồi học sai (Nhấn để lọc)</p>
            </div>
          </div>

          {/* Checkups Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Kết quả khám sức khỏe học sinh ({filteredCheckups.length} học sinh)
              </span>
              <span className="text-[11px] text-slate-500">
                Nhấn biểu tượng bút chì để điều chỉnh chiều cao, cân nặng, thị lực hoặc xuất Excel
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-3 px-3">Mã phiếu</th>
                    <th className="py-3 px-3">Học sinh</th>
                    <th className="py-3 px-3">Lớp</th>
                    <th className="py-3 px-3">Thể lực (Cao/Nặng)</th>
                    <th className="py-3 px-3">Chỉ số BMI</th>
                    <th className="py-3 px-3">Thị lực (T/P)</th>
                    <th className="py-3 px-3">Tật khúc xạ</th>
                    <th className="py-3 px-3">Răng - Miệng</th>
                    <th className="py-3 px-3">Dinh dưỡng</th>
                    <th className="py-3 px-3">Khuyến nghị phụ huynh</th>
                    <th className="py-3 px-3 text-center">Thao tác điều chỉnh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCheckups.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400">
                        Không tìm thấy học sinh nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredCheckups.map((c) => {
                      const visionL = c.eyesightLeft || (c as any).visionLeft || '10/10';
                      const visionR = c.eyesightRight || (c as any).visionRight || '10/10';
                      const nutrition = c.nutritionStatus || (c as any).nutritionClassification || 'Bình thường';
                      const refractive = c.hasRefraction
                        ? ((c as any).refractiveError || 'Có tật khúc xạ')
                        : ((c as any).refractiveError || 'Không');
                      const dental = c.dentalCondition || (c as any).dentalStatus || 'Bình thường';

                      return (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {c.checkupCode}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {maskStudentName(c.studentName, db.isPrivacyModeEnabled())}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {c.studentCode}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-bold text-emerald-800">{c.className}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {c.height}cm • {c.weight}kg
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">{c.bmi}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {visionL} • {visionR}
                          </td>
                          <td className="py-3 px-3 text-amber-800 font-medium">{refractive}</td>
                          <td className="py-3 px-3 text-slate-700 max-w-[140px] truncate">{dental}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                nutrition === 'Bình thường'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {nutrition}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                            {c.recommendations || '—'}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setViewingCheckup(c)}
                                title="Xem phiếu khám cá nhân"
                                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingCheckup({ ...c })}
                                title="Điều chỉnh chỉ số khám"
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingCheckupId(c.id)}
                                title="Xóa phiếu khám"
                                className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: THÊM SỰ KIỆN Y TẾ */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-slate-900">Ghi Nhận Sự Cố / Tai Nạn Học Đường</h3>
              <button onClick={() => setIsAddEventModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmitEvent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Loại sự kiện</label>
                <select
                  value={eventForm.eventType}
                  onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                >
                  <option value="Tai nạn">Tai nạn</option>
                  <option value="Chấn thương">Chấn thương</option>
                  <option value="Sốt cao">Sốt cao</option>
                  <option value="Dịch bệnh nghi ngờ">Dịch bệnh nghi ngờ</option>
                  <option value="Ngất">Ngất xỉu</option>
                  <option value="Dị ứng">Dị ứng cấp</option>
                  <option value="Sự cố khác">Sự cố khác</option>
                </select>
              </div>

              <div>
                <HierarchicalStudentPicker
                  selectedStudentId={eventForm.studentId}
                  onSelectStudent={(st) => setEventForm({ ...eventForm, studentId: st ? st.id : '' })}
                  label="Học sinh liên quan"
                  allowEmpty={true}
                  emptyLabel="-- Chọn học sinh hoặc để trống nếu sự cố tập thể --"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-7">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Thời gian (Ngày dd/mm/yyyy & Giờ 24h)
                  </label>
                  <DateTimeInputVN
                    value={eventForm.dateTime}
                    onChange={(val) => setEventForm({ ...eventForm, dateTime: val })}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block font-semibold text-slate-700 mb-1">Địa điểm xảy ra</label>
                  <input
                    type="text"
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                    placeholder="Sân trường, Căng tin..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diễn biến sự cố</label>
                <textarea
                  rows={2}
                  required
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Mô tả cụ thể diễn biến sự cố..."
                  className="w-full border border-slate-200 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tình trạng ban đầu</label>
                <input
                  type="text"
                  value={eventForm.initialCondition}
                  onChange={(e) => setEventForm({ ...eventForm, initialCondition: e.target.value })}
                  placeholder="Trầy xước da, sưng nề, chóng mặt..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Biện pháp sơ cứu / xử trí</label>
                <input
                  type="text"
                  required
                  value={eventForm.treatment}
                  onChange={(e) => setEventForm({ ...eventForm, treatment: e.target.value })}
                  placeholder="Rửa vết thương NaCl 0.9%, băng gạc vô trùng, chườm lạnh..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Người chứng kiến</label>
                  <input
                    type="text"
                    value={eventForm.witness}
                    onChange={(e) => setEventForm({ ...eventForm, witness: e.target.value })}
                    placeholder="Thầy cô bộ môn, bạn cùng lớp..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cán bộ y tế thực hiện</label>
                  <input
                    type="text"
                    value={eventForm.performer}
                    onChange={(e) => setEventForm({ ...eventForm, performer: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kết quả xử trí / Diễn biến</label>
                <input
                  type="text"
                  value={eventForm.outcome}
                  onChange={(e) => setEventForm({ ...eventForm, outcome: e.target.value })}
                  placeholder="Đã ổn định về lớp / Bàn giao phụ huynh..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  Lưu sự kiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ĐIỀU CHỈNH SỰ KIỆN Y TẾ (EDIT MODAL) */}
      {editingEvent && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-amber-100 text-amber-800 rounded-lg">
                  <Edit className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  Điều Chỉnh Sự Cố Y Tế ({editingEvent.eventCode})
                </h3>
              </div>
              <button onClick={() => setEditingEvent(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUpdateEvent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã sự kiện</label>
                  <input
                    type="text"
                    disabled
                    value={editingEvent.eventCode}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 font-mono font-bold text-slate-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phân loại</label>
                  <select
                    value={editingEvent.eventType}
                    onChange={(e) => setEditingEvent({ ...editingEvent, eventType: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium"
                  >
                    <option value="Tai nạn">Tai nạn</option>
                    <option value="Chấn thương">Chấn thương</option>
                    <option value="Sốt cao">Sốt cao</option>
                    <option value="Dịch bệnh nghi ngờ">Dịch bệnh nghi ngờ</option>
                    <option value="Ngất">Ngất xỉu</option>
                    <option value="Dị ứng">Dị ứng</option>
                    <option value="Sự cố khác">Sự cố khác</option>
                  </select>
                </div>
              </div>

              <div>
                <HierarchicalStudentPicker
                  selectedStudentId={editingEvent.studentId || ''}
                  onSelectStudent={(st) =>
                    setEditingEvent({
                      ...editingEvent,
                      studentId: st ? st.id : '',
                      studentName: st?.fullName,
                      studentCode: st?.studentCode,
                      className: st?.className,
                    })
                  }
                  label="Học sinh liên quan"
                  allowEmpty={true}
                  emptyLabel="-- Tập thể hoặc chọn học sinh --"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-7">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Thời gian (Ngày dd/mm/yyyy & Giờ 24h)
                  </label>
                  <DateTimeInputVN
                    value={editingEvent.dateTime ? editingEvent.dateTime.substring(0, 16) : ''}
                    onChange={(val) => setEditingEvent({ ...editingEvent, dateTime: val })}
                    className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block font-semibold text-slate-700 mb-1">Địa điểm</label>
                  <input
                    type="text"
                    value={editingEvent.location}
                    onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diễn biến sự cố</label>
                <textarea
                  rows={2}
                  required
                  value={editingEvent.description}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tình trạng ban đầu</label>
                <input
                  type="text"
                  value={editingEvent.initialCondition || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, initialCondition: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sơ cứu & Xử trí</label>
                <input
                  type="text"
                  required
                  value={editingEvent.treatment}
                  onChange={(e) => setEditingEvent({ ...editingEvent, treatment: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Người chứng kiến</label>
                  <input
                    type="text"
                    value={editingEvent.witness || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, witness: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cán bộ y tế</label>
                  <input
                    type="text"
                    value={editingEvent.performer || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, performer: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kết quả / Diễn biến</label>
                <input
                  type="text"
                  value={editingEvent.outcome}
                  onChange={(e) => setEditingEvent({ ...editingEvent, outcome: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú thêm</label>
                <input
                  type="text"
                  value={editingEvent.notes || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: THÊM KẾT QUẢ KHÁM ĐỊNH KỲ */}
      {isAddCheckupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-slate-900">Ghi Nhận Kết Quả Khám Sức Khỏe Định Kỳ</h3>
              <button onClick={() => setIsAddCheckupModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmitCheckup} className="space-y-3 text-xs">
              <div>
                <HierarchicalStudentPicker
                  selectedStudentId={checkupForm.studentId}
                  onSelectStudent={(st) => setCheckupForm({ ...checkupForm, studentId: st ? st.id : '' })}
                  label="Học sinh được khám"
                  required={true}
                  allowEmpty={false}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày khám (dd/mm/yyyy)</label>
                  <DateInputVN
                    value={checkupForm.checkupDate}
                    onChange={(val) => setCheckupForm({ ...checkupForm, checkupDate: val })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năm học</label>
                  <input
                    type="text"
                    value={checkupForm.schoolYear}
                    onChange={(e) => setCheckupForm({ ...checkupForm, schoolYear: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chiều cao (cm)</label>
                  <input
                    type="number"
                    value={checkupForm.height}
                    onChange={(e) => setCheckupForm({ ...checkupForm, height: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cân nặng (kg)</label>
                  <input
                    type="number"
                    value={checkupForm.weight}
                    onChange={(e) => setCheckupForm({ ...checkupForm, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thị lực mắt Trái (/10)</label>
                  <input
                    type="text"
                    value={checkupForm.eyesightLeft}
                    onChange={(e) => setCheckupForm({ ...checkupForm, eyesightLeft: e.target.value })}
                    placeholder="10/10 hoặc 8/10"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thị lực mắt Phải (/10)</label>
                  <input
                    type="text"
                    value={checkupForm.eyesightRight}
                    onChange={(e) => setCheckupForm({ ...checkupForm, eyesightRight: e.target.value })}
                    placeholder="10/10 hoặc 7/10"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tật khúc xạ</label>
                  <input
                    type="text"
                    value={checkupForm.refractiveError}
                    onChange={(e) =>
                      setCheckupForm({
                        ...checkupForm,
                        refractiveError: e.target.value,
                        hasRefraction: Boolean(e.target.value && e.target.value !== 'Không'),
                      })
                    }
                    placeholder="Không / Cận thị 1.5 diop..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đánh giá dinh dưỡng</label>
                  <select
                    value={checkupForm.nutritionStatus}
                    onChange={(e) => setCheckupForm({ ...checkupForm, nutritionStatus: e.target.value as any })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="Bình thường">Bình thường</option>
                    <option value="Thừa cân">Thừa cân</option>
                    <option value="Béo phì">Béo phì</option>
                    <option value="Suy dinh dưỡng">Suy dinh dưỡng</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Răng - Hàm - Mặt</label>
                  <input
                    type="text"
                    value={checkupForm.dentalCondition}
                    onChange={(e) => setCheckupForm({ ...checkupForm, dentalCondition: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tai - Mũi - Họng</label>
                  <input
                    type="text"
                    value={checkupForm.entCondition}
                    onChange={(e) => setCheckupForm({ ...checkupForm, entCondition: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khuyến nghị gửi phụ huynh</label>
                <input
                  type="text"
                  value={checkupForm.recommendations}
                  onChange={(e) => setCheckupForm({ ...checkupForm, recommendations: e.target.value })}
                  placeholder="Khuyên gia đình đưa cháu đi khám chuyên khoa mắt..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddCheckupModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  Lưu kết quả khám
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ĐIỀU CHỈNH KẾT QUẢ KHÁM ĐỊNH KỲ (EDIT MODAL) */}
      {editingCheckup && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Edit className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  Điều Chỉnh Phiếu Khám ({editingCheckup.checkupCode})
                </h3>
              </div>
              <button onClick={() => setEditingCheckup(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUpdateCheckup} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã phiếu khám</label>
                  <input
                    type="text"
                    disabled
                    value={editingCheckup.checkupCode}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 font-mono font-bold text-slate-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày khám (dd/mm/yyyy)</label>
                  <DateInputVN
                    value={editingCheckup.checkupDate || ''}
                    onChange={(val) => setEditingCheckup({ ...editingCheckup, checkupDate: val })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <HierarchicalStudentPicker
                  selectedStudentId={editingCheckup.studentId}
                  onSelectStudent={(st) => {
                    if (st) {
                      setEditingCheckup({
                        ...editingCheckup,
                        studentId: st.id,
                        studentName: st.fullName,
                        studentCode: st.studentCode,
                        className: st.className,
                      });
                    }
                  }}
                  label="Học sinh"
                  required={true}
                  allowEmpty={false}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chiều cao (cm)</label>
                  <input
                    type="number"
                    value={editingCheckup.height}
                    onChange={(e) =>
                      setEditingCheckup({ ...editingCheckup, height: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cân nặng (kg)</label>
                  <input
                    type="number"
                    value={editingCheckup.weight}
                    onChange={(e) =>
                      setEditingCheckup({ ...editingCheckup, weight: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">BMI (tự tính)</label>
                  <input
                    type="text"
                    disabled
                    value={(
                      editingCheckup.weight / Math.pow(editingCheckup.height / 100, 2)
                    ).toFixed(1)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thị lực Mắt Trái</label>
                  <input
                    type="text"
                    value={editingCheckup.eyesightLeft || (editingCheckup as any).visionLeft || '10/10'}
                    onChange={(e) => setEditingCheckup({ ...editingCheckup, eyesightLeft: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thị lực Mắt Phải</label>
                  <input
                    type="text"
                    value={editingCheckup.eyesightRight || (editingCheckup as any).visionRight || '10/10'}
                    onChange={(e) => setEditingCheckup({ ...editingCheckup, eyesightRight: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tật khúc xạ</label>
                  <input
                    type="text"
                    value={
                      (editingCheckup as any).refractiveError ||
                      (editingCheckup.hasRefraction ? 'Có tật khúc xạ' : 'Không')
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingCheckup({
                        ...editingCheckup,
                        hasRefraction: Boolean(val && val.toLowerCase() !== 'không'),
                        ['refractiveError' as any]: val,
                      });
                    }}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phân loại dinh dưỡng</label>
                  <select
                    value={
                      editingCheckup.nutritionStatus ||
                      (editingCheckup as any).nutritionClassification ||
                      'Bình thường'
                    }
                    onChange={(e) =>
                      setEditingCheckup({ ...editingCheckup, nutritionStatus: e.target.value as any })
                    }
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="Bình thường">Bình thường</option>
                    <option value="Thừa cân">Thừa cân</option>
                    <option value="Béo phì">Béo phì</option>
                    <option value="Suy dinh dưỡng">Suy dinh dưỡng</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Răng hàm mặt</label>
                  <input
                    type="text"
                    value={editingCheckup.dentalCondition || (editingCheckup as any).dentalStatus || ''}
                    onChange={(e) => setEditingCheckup({ ...editingCheckup, dentalCondition: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tai mũi họng</label>
                  <input
                    type="text"
                    value={editingCheckup.entCondition || (editingCheckup as any).entStatus || ''}
                    onChange={(e) => setEditingCheckup({ ...editingCheckup, entCondition: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khuyến nghị gửi phụ huynh</label>
                <input
                  type="text"
                  value={editingCheckup.recommendations || ''}
                  onChange={(e) => setEditingCheckup({ ...editingCheckup, recommendations: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCheckup(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: XEM CHI TIẾT SỰ KIỆN TAI NẠN (PRINT PREVIEW) */}
      {viewingEvent && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  TRƯỜNG THCS ĐÔNG THẠNH • PHÒNG Y TẾ
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-0.5">
                  Biên Bản Sự Cố Y Tế {viewingEvent.eventCode}
                </h3>
              </div>
              <button onClick={() => setViewingEvent(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Thời gian xảy ra:</span>
                  <span className="font-bold text-slate-800">{formatDateTimeVN(viewingEvent.dateTime)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Địa điểm:</span>
                  <span className="font-bold text-slate-800">{viewingEvent.location}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Phân loại sự cố:</span>
                  <span className="font-bold text-rose-800">{viewingEvent.eventType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Học sinh liên quan:</span>
                  <span className="font-bold text-slate-800">
                    {viewingEvent.studentName
                      ? `${viewingEvent.studentName} (${viewingEvent.className})`
                      : 'Tập thể học sinh'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-0.5">Diễn biến sự cố:</span>
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 leading-relaxed">
                  {viewingEvent.description}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-0.5">Tình trạng ghi nhận ban đầu:</span>
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800">
                  {viewingEvent.initialCondition || 'Chưa có mô tả thêm'}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-0.5">Biện pháp sơ cứu & Xử trí y tế:</span>
                <p className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-medium">
                  {viewingEvent.treatment}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Cán bộ y tế:</span>
                  <span className="font-semibold text-slate-800">{viewingEvent.performer}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Kết quả xử trí:</span>
                  <span className="font-bold text-emerald-800">{viewingEvent.outcome}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewingEvent(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In biên bản này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: XEM PHIẾU KHÁM CÁ NHÂN */}
      {viewingCheckup && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  TRƯỜNG THCS ĐÔNG THẠNH • SỨC KHỎE HỌC ĐƯỜNG
                </span>
                <h3 className="font-bold text-base text-slate-900 mt-0.5">
                  Phiếu Khám Sức Khỏe {viewingCheckup.checkupCode}
                </h3>
              </div>
              <button onClick={() => setViewingCheckup(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[11px]">Học sinh:</span>
                  <span className="font-bold text-slate-900 text-sm">{viewingCheckup.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Lớp / Mã HS:</span>
                  <span className="font-bold text-slate-800">
                    {viewingCheckup.className} • {viewingCheckup.studentCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Ngày khám:</span>
                  <span className="font-semibold text-slate-700">
                    {viewingCheckup.checkupDate ? formatDateVN(viewingCheckup.checkupDate) : 'Đầu năm học'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Năm học:</span>
                  <span className="font-semibold text-slate-700">{viewingCheckup.schoolYear}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-center">
                  <span className="text-[10px] text-blue-700 block">Chiều cao</span>
                  <span className="text-base font-bold text-blue-950">{viewingCheckup.height} cm</span>
                </div>
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-center">
                  <span className="text-[10px] text-blue-700 block">Cân nặng</span>
                  <span className="text-base font-bold text-blue-950">{viewingCheckup.weight} kg</span>
                </div>
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[10px] text-emerald-700 block">Chỉ số BMI</span>
                  <span className="text-base font-bold text-emerald-950">{viewingCheckup.bmi}</span>
                </div>
              </div>

              <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-slate-500">Thị lực 2 mắt:</span>
                  <span className="font-semibold text-slate-800">
                    Trái: {viewingCheckup.eyesightLeft || (viewingCheckup as any).visionLeft || '10/10'} • Phải:{' '}
                    {viewingCheckup.eyesightRight || (viewingCheckup as any).visionRight || '10/10'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tật khúc xạ:</span>
                  <span className="font-semibold text-amber-800">
                    {viewingCheckup.hasRefraction
                      ? (viewingCheckup as any).refractiveError || 'Có tật khúc xạ'
                      : 'Không'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Răng hàm mặt:</span>
                  <span className="font-semibold text-slate-800">
                    {viewingCheckup.dentalCondition || (viewingCheckup as any).dentalStatus || 'Bình thường'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cột sống / Dáng đi:</span>
                  <span className="font-semibold text-slate-800">
                    {viewingCheckup.scoliosis ? 'Cong vẹo cột sống' : 'Bình thường'}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-0.5">Khuyến nghị gửi phụ huynh:</span>
                <p className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl text-amber-900 font-medium">
                  {viewingCheckup.recommendations || 'Duy trì chế độ dinh dưỡng và học tập hợp lý.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setViewingCheckup(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In phiếu khám này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: XÁC NHẬN XÓA SỰ KIỆN TAI NẠN */}
      {deletingEventId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-3">
            <div className="w-11 h-11 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Xóa Bản Ghi Sự Cố Y Tế?</h3>
            <p className="text-xs text-slate-500">
              Bạn có chắc chắn muốn xóa bản ghi sự cố này không? Dữ liệu sau khi xóa sẽ được đồng bộ và không thể hoàn tác.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingEventId(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={confirmDeleteEvent}
                className="flex-1 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: XÁC NHẬN XÓA PHIẾU KHÁM ĐỊNH KỲ */}
      {deletingCheckupId && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-3">
            <div className="w-11 h-11 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Xóa Phiếu Khám Sức Khỏe?</h3>
            <p className="text-xs text-slate-500">
              Bạn có chắc chắn muốn xóa phiếu khám sức khỏe này của học sinh? Hành động này sẽ được ghi lại trong nhật ký.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDeletingCheckupId(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={confirmDeleteCheckup}
                className="flex-1 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: NHẬP & ĐIỀU CHỈNH DỮ LIỆU TỪ FILE EXCEL */}
      <SchoolHealthImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTab={activeTab}
        onSuccess={() => {
          refreshData();
          showToast('Đã nhập và đồng bộ dữ liệu điều chỉnh từ file Excel thành công!');
        }}
      />
    </div>
  );
};
