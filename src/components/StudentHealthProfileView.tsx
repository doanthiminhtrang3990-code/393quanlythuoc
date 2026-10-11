import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  User,
  Heart,
  AlertTriangle,
  Calendar,
  Phone,
  ShieldCheck,
  Stethoscope,
  Pill,
  BriefcaseMedical,
  Activity,
  ArrowLeft,
  Printer,
  ChevronRight,
  Plus,
  Search,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { db, formatDateVN, formatDateTimeVN, formatDateFormulaVN, formatTime24H, maskStudentName } from '../services/db';
import { matchesStudentSearch, getStudentSearchScore } from '../utils/helpers';
import { Student, ClinicVisit, HealthCheckup } from '../types';

interface StudentHealthProfileViewProps {
  studentId?: string;
  onBack?: () => void;
  onClose?: () => void;
  onNewVisit?: (stu: any) => void;
  onNavigateToIntake?: (studentId: string) => void;
  onNavigateToStudentList?: () => void;
}

export const StudentHealthProfileView: React.FC<StudentHealthProfileViewProps> = ({
  studentId: initialStudentId,
  onBack,
  onClose,
  onNewVisit,
  onNavigateToIntake,
  onNavigateToStudentList,
}) => {
  const handleClose = onClose || onBack;
  const [allStudents, setAllStudents] = useState<Student[]>(() => db.getStudents());
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.isPrivacyModeEnabled());

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setAllStudents(db.getStudents());
      setPrivacyMode(db.isPrivacyModeEnabled());
    });
    return () => unsub();
  }, []);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    if (initialStudentId) return initialStudentId;
    return allStudents.length > 0 ? allStudents[0].id : '';
  });

  const [activeSubTab, setActiveSubTab] = useState<'visits' | 'medicines' | 'checkups'>('visits');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Selected Student
  const currentStudent = useMemo(() => {
    return allStudents.find((s) => s.id === selectedStudentId) || allStudents[0] || null;
  }, [allStudents, selectedStudentId]);

  // Student history from db
  const studentHistory = useMemo(() => {
    if (!currentStudent) return { student: null, profile: null, visits: [], checkups: [], medicinesTaken: [] };
    return db.getStudentHistory(currentStudent.id);
  }, [currentStudent]);

  const medicinesDispensed = (studentHistory as any)?.medicinesTaken || (studentHistory as any)?.medicinesUsed || [];

  // Filter students for the quick switcher (optimized with pre-calculated scores)
  const filteredStudentsDropdown = useMemo(() => {
    const q = studentSearchQuery.trim();
    if (!q) return allStudents;
    const matches = allStudents.filter((s) => matchesStudentSearch(s, q));
    const scored = matches.map((s) => ({ s, score: getStudentSearchScore(s, q) }));
    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return (a.s.fullName || '').localeCompare(b.s.fullName || '', 'vi');
    });
    return scored.map((item) => item.s);
  }, [allStudents, studentSearchQuery]);

  if (!currentStudent) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-slate-700">Chưa có dữ liệu học sinh</h3>
        <p className="text-xs text-slate-400 mt-1">Vui lòng thêm học sinh mới trước khi xem hồ sơ sức khỏe.</p>
        <button
          onClick={onNavigateToStudentList}
          className="mt-4 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold"
        >
          Quay lại danh sách học sinh
        </button>
      </div>
    );
  }

  const hasAllergies = currentStudent.allergies && currentStudent.allergies !== 'Không';
  const hasChronic = currentStudent.chronicConditions && currentStudent.chronicConditions !== 'Không';

  return (
    <div className="space-y-6">
      {/* Top Header & Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors border border-slate-200"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                HỒ SƠ SỨC KHỎE
              </span>
              <h1 className="text-xl font-bold text-slate-900">Sổ Theo Dõi Sức Khỏe Học Sinh</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Trường THCS Đông Thạnh • Quản lý lịch sử y bạ, sinh hiệu, thuốc điều trị và kết quả khám định kỳ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick student switcher dropdown */}
          <div className="relative">
            <select
              value={currentStudent.id}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-600 max-w-xs"
            >
              {allStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.studentCode} - {maskStudentName(s.fullName, privacyMode)} ({s.className})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onNavigateToIntake?.(currentStudent.id)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Stethoscope className="w-4 h-4" />
            <span>Tiếp nhận y tế</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>In hồ sơ (A4)</span>
          </button>
        </div>
      </div>

      {/* Warning Banner: Allergies & Chronic Conditions */}
      {(hasAllergies || hasChronic) && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-200/80 text-rose-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-700" />
            </div>
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-900 uppercase tracking-wide text-xs">
                  CẢNH BÁO AN TOÀN Y TẾ ĐẶC BIỆT
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 font-bold text-[10px]">
                  Cần lưu ý khi cấp phát thuốc
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-rose-800">
                {hasAllergies && (
                  <p>
                    <strong>Tiền sử dị ứng:</strong> <span className="font-bold underline">{currentStudent.allergies}</span>
                  </p>
                )}
                {hasChronic && (
                  <p>
                    <strong>Bệnh nền mạn tính:</strong> <span className="font-bold">{currentStudent.chronicConditions}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Student Profile Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Demographics & Emergency Contact */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl">
                {privacyMode ? 'HS' : (currentStudent.fullName.charAt(currentStudent.fullName.lastIndexOf(' ') + 1) || 'H')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    className="text-base font-bold text-slate-900"
                    title={privacyMode ? 'Đang bật bảo mật ẩn tên' : currentStudent.fullName}
                  >
                    {maskStudentName(currentStudent.fullName, privacyMode)}
                  </h2>
                  {currentStudent.bloodType && (
                    <span className="text-xs font-black px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                      {currentStudent.bloodType}
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono font-semibold text-emerald-700">{currentStudent.studentCode}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-[11px] text-slate-700">
                    Lớp {currentStudent.className}
                  </span>
                  <span className="text-[11px] text-slate-500">Khối {currentStudent.grade}</span>
                </div>
              </div>
            </div>

            {/* Demographics List */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Giới tính:</span>
                <span className="font-semibold text-slate-800">{currentStudent.gender}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-50">
                <span className="text-slate-500">Ngày sinh (ngày/tháng/năm):</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-800 font-mono text-xs">{formatDateVN(currentStudent.birthDate)}</span>
                  <div className="text-[10px] text-emerald-700 italic">{formatDateFormulaVN(currentStudent.birthDate)}</div>
                </div>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Mã thẻ BHYT:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {currentStudent.healthInsuranceCode || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Số định danh / CCCD:</span>
                <span className="font-mono font-semibold text-slate-800">{currentStudent.citizenId || '—'}</span>
              </div>
              <div className="py-1">
                <span className="text-slate-500 block mb-0.5">Địa chỉ thường trú:</span>
                <span className="font-medium text-slate-800">{currentStudent.address || 'Xã Đông Thạnh, Hóc Môn'}</span>
              </div>
            </div>

            {/* Emergency Contact: Cha & Mẹ */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>Liên hệ phụ huynh (Cha & Mẹ)</span>
              </p>

              {/* Cha */}
              <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase">Thông tin Cha</span>
                  {(currentStudent.fatherPhone || currentStudent.parentPhone) && (
                    <a
                      href={`tel:${(currentStudent.fatherPhone || currentStudent.parentPhone || '').replace(/\s+/g, '')}`}
                      className="text-blue-700 hover:text-blue-900 font-bold text-[11px] flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3 h-3" /> Bấm gọi
                    </a>
                  )}
                </div>
                <p className="font-bold text-slate-900 mt-0.5">{currentStudent.fatherName || currentStudent.parentName || '—'}</p>
                {(currentStudent.fatherPhone || currentStudent.parentPhone) && (
                  <p className="text-blue-700 font-mono font-medium text-[11px] mt-0.5">
                    SĐT: {currentStudent.fatherPhone || currentStudent.parentPhone}
                  </p>
                )}
              </div>

              {/* Mẹ */}
              <div className="p-2.5 bg-pink-50/80 rounded-xl border border-pink-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-pink-800 uppercase">Thông tin Mẹ</span>
                  {currentStudent.motherPhone && (
                    <a
                      href={`tel:${currentStudent.motherPhone.replace(/\s+/g, '')}`}
                      className="text-pink-700 hover:text-pink-900 font-bold text-[11px] flex items-center gap-1 hover:underline"
                    >
                      <Phone className="w-3 h-3" /> Bấm gọi
                    </a>
                  )}
                </div>
                <p className="font-bold text-slate-900 mt-0.5">{currentStudent.motherName || '—'}</p>
                {currentStudent.motherPhone && (
                  <p className="text-pink-700 font-mono font-medium text-[11px] mt-0.5">
                    SĐT: {currentStudent.motherPhone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Box */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-500">Lượt khám y tế</p>
              <p className="text-lg font-bold text-emerald-700">{studentHistory.visits.length}</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-500">Thuốc đã dùng</p>
              <p className="text-lg font-bold text-blue-700">{medicinesDispensed.length}</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-500">Đợt khám định kỳ</p>
              <p className="text-lg font-bold text-purple-700">{studentHistory.checkups.length}</p>
            </div>
          </div>
        </div>

        {/* Right Column: History Tabs (Visits, Medicines, Checkups) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Sub-tab Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2">
              <button
                id="tab-history-visits"
                onClick={() => setActiveSubTab('visits')}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-xs border-b-2 transition-colors ${
                  activeSubTab === 'visits'
                    ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>Lịch sử khám phòng y tế ({studentHistory.visits.length})</span>
              </button>

              <button
                id="tab-history-medicines"
                onClick={() => setActiveSubTab('medicines')}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-xs border-b-2 transition-colors ${
                  activeSubTab === 'medicines'
                    ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Pill className="w-4 h-4" />
                <span>Thuốc đã sử dụng ({medicinesDispensed.length})</span>
              </button>

              <button
                id="tab-history-checkups"
                onClick={() => setActiveSubTab('checkups')}
                className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-xs border-b-2 transition-colors ${
                  activeSubTab === 'checkups'
                    ? 'border-emerald-700 text-emerald-800 bg-white rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Khám sức khỏe định kỳ ({studentHistory.checkups.length})</span>
              </button>
            </div>

            {/* Sub-tab 1: Clinic Visits */}
            {activeSubTab === 'visits' && (
              <div className="p-5 space-y-4">
                {studentHistory.visits.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Stethoscope className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-xs text-slate-600">Học sinh chưa có lượt tiếp nhận y tế nào</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bấm "Tiếp nhận y tế" để tạo phiếu khám và xử trí đầu tiên.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studentHistory.visits.map((visit) => (
                      <div
                        key={visit.id}
                        className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {visit.visitCode}
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                              {visit.dateTime
                                ? formatDateTimeVN(visit.dateTime)
                                : visit.visitDate
                                ? `${visit.timeIn ? formatTime24H(visit.timeIn) + ' ' : ''}${formatDateVN(visit.visitDate)}`
                                : '—'}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              (visit.outcome || '').includes('về lớp')
                                ? 'bg-emerald-100 text-emerald-800'
                                : (visit.outcome || '').includes('Phụ huynh')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {visit.outcome || 'Đang theo dõi'}
                          </span>
                        </div>

                        {/* Symptoms & Vitals */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-slate-500 text-[11px]">Lý do & Tình trạng:</p>
                            <p className="font-semibold text-slate-800">
                              {visit.reason || (visit.reasons && visit.reasons.length > 0 ? visit.reasons.join(', ') : visit.customReason || 'Khám ban đầu')} • {visit.initialCondition || ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px]">Sinh hiệu:</p>
                            <p className="font-medium text-slate-700">
                              {visit.temperature ? `${visit.temperature}°C` : '—'} | Mạch: {visit.pulse || '—'} l/p |
                              HA: {visit.bloodPressure || '—'}
                            </p>
                          </div>
                        </div>

                        {/* Treatment & Performer */}
                        <div className="text-xs bg-white p-3 rounded-lg border border-slate-100 space-y-1">
                          <p>
                            <span className="text-slate-500">Xử trí:</span>{' '}
                            <span className="font-medium text-slate-800">{visit.treatment}</span>
                          </p>
                          {visit.medicinesDispensed && visit.medicinesDispensed.length > 0 && (
                            <div className="pt-1">
                              <span className="text-slate-500">Thuốc đã cấp:</span>{' '}
                              <span className="font-bold text-emerald-800">
                                {visit.medicinesDispensed
                                  .map((m) => `${m.medicineName} (${m.quantity} ${m.unit})`)
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                          {visit.suppliesUsed && visit.suppliesUsed.length > 0 && (
                            <div>
                              <span className="text-slate-500">Vật tư dùng:</span>{' '}
                              <span className="text-slate-700">
                                {visit.suppliesUsed.map((s) => `${s.supplyName} (${s.quantity} ${s.unit})`).join(', ')}
                              </span>
                            </div>
                          )}
                          <p className="text-[11px] text-slate-400 pt-1">
                            Cán bộ y tế: <strong>{visit.performer}</strong>
                            {visit.parentNotified && (
                              <span className="ml-2 text-emerald-600 font-semibold">✓ Đã báo phụ huynh</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: Medicines Dispensed */}
            {activeSubTab === 'medicines' && (
              <div className="p-5">
                {medicinesDispensed.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Pill className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-xs text-slate-600">Chưa có bản ghi cấp phát thuốc nào</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Ngày cấp</th>
                          <th className="py-2.5 px-3">Tên thuốc</th>
                          <th className="py-2.5 px-3">Số lượng</th>
                          <th className="py-2.5 px-3">Số lô</th>
                          <th className="py-2.5 px-3">Hạn dùng</th>
                          <th className="py-2.5 px-3">Mục đích / Lý do</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {medicinesDispensed.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {formatDateTimeVN(item.date)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{item.medicineName}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-700">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{item.batchNumber || '—'}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {item.expDate ? formatDateVN(item.expDate) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 3: Health Checkups */}
            {activeSubTab === 'checkups' && (
              <div className="p-5 space-y-4">
                {studentHistory.checkups.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-xs text-slate-600">Chưa có kết quả khám sức khỏe định kỳ</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dữ liệu sẽ được cập nhật từ đợt kiểm tra sức khỏe đầu năm.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studentHistory.checkups.map((checkup) => (
                      <div
                        key={checkup.id}
                        className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {checkup.checkupCode}
                            </span>
                            <span className="text-xs font-bold text-slate-800 ml-2">
                              Năm học {checkup.schoolYear} (Ngày khám: {formatDateVN(checkup.checkupDate)})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            {checkup.nutritionClassification}
                          </span>
                        </div>

                        {/* Physical metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Chiều cao</span>
                            <span className="font-bold text-slate-800 text-sm">{checkup.height} cm</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Cân nặng</span>
                            <span className="font-bold text-slate-800 text-sm">{checkup.weight} kg</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Chỉ số BMI</span>
                            <span className="font-bold text-slate-800 text-sm">{checkup.bmi}</span>
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Thị lực (Trái/Phải)</span>
                            <span className="font-bold text-slate-800 text-sm">
                              {checkup.visionLeft}/10 • {checkup.visionRight}/10
                            </span>
                          </div>
                        </div>

                        {/* Clinical findings */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-slate-100">
                          <div>
                            <p className="text-slate-500 text-[11px]">Tật khúc xạ:</p>
                            <p className="font-semibold text-slate-800">{checkup.refractiveError || 'Bình thường'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px]">Răng - Hàm - Mặt:</p>
                            <p className="font-semibold text-slate-800">{checkup.dentalStatus || 'Bình thường'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px]">Tai - Mũi - Họng:</p>
                            <p className="font-semibold text-slate-800">{checkup.entStatus || 'Bình thường'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[11px]">Cột sống - Tư thế:</p>
                            <p className="font-semibold text-slate-800">{checkup.spineStatus || 'Bình thường'}</p>
                          </div>
                        </div>

                        {checkup.recommendations && (
                          <div className="text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900">
                            <strong>Khuyến nghị gửi phụ huynh:</strong> {checkup.recommendations}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
