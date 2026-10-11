import React, { useState } from 'react';
import {
  Settings,
  Database,
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertTriangle,
  FileJson,
  ShieldCheck,
  Building,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { db } from '../services/db';
import { ReportSignerConfigModal } from './ReportSignerConfigModal';

export const BackupAndSettings: React.FC = () => {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restoreConfirmData, setRestoreConfirmData] = useState<string | null>(null);
  const [showSignerModal, setShowSignerModal] = useState(false);

  // Settings state
  const [schoolName, setSchoolName] = useState('TRƯỜNG THCS ĐÔNG THẠNH');
  const [schoolYear, setSchoolYear] = useState('2026-2027');
  const [medicName, setMedicName] = useState('Y sĩ Trần Thị Bích Thảo');
  const [expiryWarningDays, setExpiryWarningDays] = useState(90);
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.isPrivacyModeEnabled());

  // Export JSON Backup
  const handleExportBackup = () => {
    const jsonStr = db.exportBackupJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sao_Luu_Y_Te_THCS_Dong_Thanh_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setSuccessMessage('Đã tải xuống tệp sao lưu dữ liệu toàn diện JSON!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Upload JSON for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        JSON.parse(text); // validate JSON syntax
        setRestoreConfirmData(text);
      } catch (err: any) {
        setErrorMessage('Tệp không đúng định dạng JSON hợp lệ.');
      }
    };
    reader.readAsText(file);
  };

  // Confirm Restore
  const handleConfirmRestore = () => {
    if (!restoreConfirmData) return;
    try {
      db.restoreBackupJson(restoreConfirmData);
      setRestoreConfirmData(null);
      setSuccessMessage('Đã khôi phục dữ liệu hệ thống thành công!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Lỗi khi khôi phục: ${err.message}`);
    }
  };

  // Factory Reset
  const [showResetSeedModal, setShowResetSeedModal] = useState(false);
  const handleResetSeedData = () => {
    setShowResetSeedModal(true);
  };

  const handleExecuteResetSeedData = () => {
    try {
      db.seedDemoData();
      setShowResetSeedModal(false);
      setSuccessMessage('Đã nạp lại dữ liệu mẫu ban đầu thành công!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi khôi phục dữ liệu mẫu.');
      setShowResetSeedModal(false);
    }
  };

  // Clean medicines & inventory for production publishing
  const [showCleanInventoryModal, setShowCleanInventoryModal] = useState(false);
  const handleCleanMedicines = () => {
    try {
      const res = db.clearMedicinesAndInventory();
      setShowCleanInventoryModal(false);
      setSuccessMessage(
        `Đã làm sạch kho thuốc thành công! (Xóa ${res.medicinesCount} thuốc, ${res.batchesCount} lô và ${res.transactionsCount} phiếu). Hệ thống đã sẵn sàng cho năm học mới.`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi làm sạch kho thuốc.');
      setShowCleanInventoryModal(false);
    }
  };

  // Clean students, classes & homeroom teachers for production publishing
  const [showCleanStudentsModal, setShowCleanStudentsModal] = useState(false);
  const [cleanStudentOptions, setCleanStudentOptions] = useState({
    clearStudents: true,
    clearClasses: true,
    clearVisitsAndEvents: true,
  });

  const handleCleanStudentsAndClasses = () => {
    try {
      const res = db.clearStudentsAndClasses(cleanStudentOptions);
      setShowCleanStudentsModal(false);
      const parts: string[] = [];
      if (cleanStudentOptions.clearStudents) parts.push(`${res.studentsCount} học sinh`);
      if (cleanStudentOptions.clearClasses) parts.push(`${res.classesCount} lớp & GVCN`);
      if (cleanStudentOptions.clearVisitsAndEvents && (res.visitsCount > 0 || res.eventsCount > 0)) {
        parts.push(`${res.visitsCount} lượt khám`);
      }
      setSuccessMessage(
        `Đã làm sạch dữ liệu thành công! (Đã xóa ${parts.join(', ')}). Hệ thống đã sẵn sàng để nhập danh sách học sinh và lớp thực tế.`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi làm sạch dữ liệu học sinh & lớp học.');
      setShowCleanStudentsModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
            HỆ THỐNG
          </span>
          <h1 className="text-xl font-bold text-slate-900">Cài Đặt Hệ Thống & Sao Lưu / Phục Hồi Dữ Liệu</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Trường THCS Đông Thạnh • Quản lý thông tin trường, ngưỡng cảnh báo an toàn y tế và sao lưu dữ liệu
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Box 1: Cài đặt thông tin trường học & Cán bộ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-700" />
            <span>Thông Tin Đơn Vị & Cấu Hình Y Tế</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tên trường học</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Năm học áp dụng</label>
                <input
                  type="text"
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngưỡng cảnh báo HSD (ngày)</label>
                <input
                  type="number"
                  value={expiryWarningDays}
                  onChange={(e) => setExpiryWarningDays(parseInt(e.target.value, 10) || 90)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 font-bold text-amber-700"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cán bộ y tế phụ trách</label>
              <input
                type="text"
                value={medicName}
                onChange={(e) => setMedicName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>

            {/* Chế độ Bảo Mật & Ẩn Tên Học Sinh */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="font-bold text-amber-950 text-xs">
                    Chế độ bảo mật & Ẩn tên học sinh (Privacy Mode)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = db.togglePrivacyMode();
                    setPrivacyMode(next);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shrink-0 ${
                    privacyMode
                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {privacyMode ? 'ĐANG BẬT (Đã ẩn tên)' : 'ĐANG TẮT (Hiện tên)'}
                </button>
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                Khi bật tính năng này, họ tên học sinh sẽ được tự động ẩn trên màn hình danh sách, tiếp nhận khám, sổ khám và báo cáo (VD: <em>Nguyễn H*** N***</em>) để bảo mật thông tin cá nhân khi trình chiếu lên máy chiếu hoặc chia sẻ màn hình.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessMessage('Đã lưu cấu hình hệ thống!');
                  setTimeout(() => setSuccessMessage(null), 3000);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Lưu cấu hình
              </button>

              <button
                type="button"
                onClick={() => setShowSignerModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                title="Tùy chỉnh chức danh, họ tên người ký báo cáo và cơ quan ban hành"
              >
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Cấu hình người ký báo cáo & Tiêu đề</span>
              </button>
            </div>
          </div>
        </div>

        {/* Box 2: Sao lưu & Khôi phục dữ liệu */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-700" />
            <span>Sao Lưu & Phục Hồi Dữ Liệu (Backup JSON)</span>
          </h2>

          <p className="text-xs text-slate-500 leading-relaxed">
            Hệ thống hỗ trợ xuất và nhập bản sao lưu toàn diện chứa đầy đủ danh mục thuốc, các lô thuốc FEFO, lịch sử giao
            dịch, hồ sơ học sinh, sổ khám bệnh và nhật ký audit log.
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={handleExportBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Tải tệp sao lưu dữ liệu (.json)</span>
            </button>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
              <label className="block text-xs font-semibold text-slate-700 mb-1 cursor-pointer">
                Nạp tệp khôi phục (.json)
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 cursor-pointer"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                  <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Chuẩn Bị Xuất Bản (Làm Sạch Kho Thuốc)</span>
                </h3>
                <p className="text-[11px] text-amber-800 leading-relaxed mb-2.5">
                  Xóa sạch danh mục thuốc, các lô hàng và giao dịch tồn kho mẫu để bạn bắt đầu nhập danh sách thuốc thực tế của trường. (Hồ sơ học sinh và lớp học vẫn được giữ nguyên).
                </p>
                <button
                  type="button"
                  onClick={() => setShowCleanInventoryModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>LÀM SẠCH KHO THUỐC & TỒN KHO</span>
                </button>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                  <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Chuẩn Bị Xuất Bản (Làm Sạch Học Sinh, Lớp & GVCN)</span>
                </h3>
                <p className="text-[11px] text-amber-800 leading-relaxed mb-2.5">
                  Xóa sạch danh sách học sinh mẫu, hồ sơ sức khỏe, danh sách lớp học và thông tin GVCN để bạn bắt đầu nhập danh sách học sinh, lớp và phân công GVCN thực tế của trường. (Kho thuốc và vật tư y tế vẫn được giữ nguyên).
                </p>
                <button
                  type="button"
                  onClick={() => setShowCleanStudentsModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>LÀM SẠCH HỌC SINH, LỚP & GVCN</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetSeedData}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Nạp lại dữ liệu mẫu ban đầu</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Inventory Modal for Production Publishing */}
      {showCleanInventoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Làm Sạch Kho Thuốc & Tồn Kho</h3>
                <p className="text-xs text-slate-500">Chuẩn bị xuất bản ứng dụng đưa vào sử dụng thực tế</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2 my-3">
              <p className="font-bold">
                Bạn có chắc chắn muốn làm sạch toàn bộ kho thuốc không?
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
                <li>Xóa toàn bộ danh mục thuốc và các lô hạn dùng mẫu.</li>
                <li>Xóa toàn bộ các phiếu nhập - xuất kho và biên bản kiểm kê mẫu.</li>
                <li>Hồ sơ học sinh THCS Đông Thạnh và danh sách lớp học vẫn được giữ nguyên.</li>
              </ul>
              <p className="text-[11px] text-slate-600 italic">
                Sau khi làm sạch, bạn có thể tự do thêm thuốc mới hoặc tải file Excel lên.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCleanInventoryModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCleanMedicines}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Xác nhận làm sạch kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Students & Classes Modal for Production Publishing */}
      {showCleanStudentsModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Làm Sạch Học Sinh, Lớp & GVCN</h3>
                <p className="text-xs text-slate-500">Chuẩn bị xuất bản ứng dụng đưa vào sử dụng thực tế</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2.5 my-3">
              <p className="font-bold text-slate-900">
                Chọn các danh mục dữ liệu bạn muốn làm sạch:
              </p>
              <div className="space-y-2 bg-white/80 p-2.5 rounded-lg border border-rose-200">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={cleanStudentOptions.clearStudents}
                    onChange={(e) =>
                      setCleanStudentOptions((prev) => ({ ...prev, clearStudents: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Xóa danh sách học sinh & hồ sơ sức khỏe ({db.getStudents().length} HS)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={cleanStudentOptions.clearClasses}
                    onChange={(e) =>
                      setCleanStudentOptions((prev) => ({ ...prev, clearClasses: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Xóa danh sách lớp học & phân công GVCN ({db.getSchoolClasses().length} lớp)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={cleanStudentOptions.clearVisitsAndEvents}
                    onChange={(e) =>
                      setCleanStudentOptions((prev) => ({ ...prev, clearVisitsAndEvents: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Xóa lịch sử lượt khám & sự kiện y tế mẫu ({db.getClinicVisits().length} lượt)</span>
                </label>
              </div>

              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Kho thuốc, các lô hạn dùng và vật tư y tế vẫn được giữ nguyên an toàn 100%.</span>
              </div>

              <p className="text-[11px] text-slate-600 italic">
                Sau khi làm sạch, bạn có thể tự do thêm lớp mới, tải file Excel danh sách học sinh và phân công GVCN thực tế của trường.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCleanStudentsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={
                  !cleanStudentOptions.clearStudents &&
                  !cleanStudentOptions.clearClasses &&
                  !cleanStudentOptions.clearVisitsAndEvents
                }
                onClick={handleCleanStudentsAndClasses}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                Xác nhận làm sạch dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreConfirmData && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-base text-slate-900">Xác Nhận Khôi Phục Dữ Liệu</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn ghi đè toàn bộ dữ liệu hiện tại bằng tệp sao lưu đã chọn? Dữ liệu hiện tại chưa được
              sao lưu sẽ bị thay thế.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setRestoreConfirmData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRestore}
                className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-xs"
              >
                Đồng ý khôi phục
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignerModal && (
        <ReportSignerConfigModal
          onClose={() => setShowSignerModal(false)}
          onSaved={() => {
            setSuccessMessage('Đã cập nhật thông tin người ký và biểu mẫu báo cáo!');
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />
      )}

      {/* Reset Seed Data In-App Confirmation Modal */}
      {showResetSeedModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <RefreshCw className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Nạp Lại Dữ Liệu Mẫu Ban Đầu</h3>
                <p className="text-xs text-slate-500">Khôi phục bộ dữ liệu thử nghiệm chuẩn THCS Đông Thạnh</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-1.5">
              <p className="font-bold">Lưu ý khi nạp lại dữ liệu mẫu:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                <li>Nạp lại danh mục thuốc, các lô FEFO, và các phiếu xuất nhập mẫu.</li>
                <li>Nạp lại danh sách học sinh mẫu các khối 6, 7, 8, 9 và lịch sử khám.</li>
                <li>Dữ liệu hiện tại sẽ được thay thế bằng bộ dữ liệu mẫu chuẩn của nhà trường.</li>
              </ul>
            </div>

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn tiến hành nạp lại toàn bộ dữ liệu mẫu không?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetSeedModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteResetSeedData}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Xác nhận nạp lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
