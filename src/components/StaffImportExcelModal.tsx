import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck,
  ArrowRight,
  Info,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { downloadStandardStaffTemplateExcel } from '../services/excelService';

interface StaffImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: { inserted: number; updated: number }) => void;
}

export const StaffImportExcelModal: React.FC<StaffImportExcelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [replaceAll, setReplaceAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingStaffCount, setExistingStaffCount] = useState<number>(() => db.getStaffMembers().length);
  const [confirmClearExisting, setConfirmClearExisting] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClearCurrentStaff = () => {
    try {
      const count = db.deleteAllStaffMembers();
      setExistingStaffCount(0);
      setConfirmClearExisting(false);
      setClearSuccessMsg(`Đã xóa sạch toàn bộ ${count} nhân sự trong hệ thống!`);
      setTimeout(() => setClearSuccessMsg(null), 4000);
    } catch (e: any) {
      setError(e.message || 'Lỗi khi xóa nhân sự.');
      setConfirmClearExisting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);
    setPreviewRows([]);
    await parseStaffExcel(selected);
  };

  const parseStaffExcel = async (uploadedFile: File) => {
    setLoading(true);
    setError(null);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawAoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

      if (!rawAoa || rawAoa.length < 2) {
        throw new Error('Tập tin Excel trống hoặc không chứa dữ liệu hợp lệ.');
      }

      // Find the header row (look for 'tên' or 'họ' or 'giáo viên' or 'mã')
      let headerRowIdx = -1;
      for (let r = 0; r < Math.min(rawAoa.length, 12); r++) {
        const rowStr = (rawAoa[r] || []).map((c) => String(c || '').toLowerCase()).join(' ');
        if (
          rowStr.includes('họ và tên') ||
          rowStr.includes('họ tên') ||
          rowStr.includes('tên giáo viên') ||
          rowStr.includes('mã gv') ||
          rowStr.includes('tổ chuyên môn')
        ) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx === -1) {
        // Fallback to row 0 if it has headers
        headerRowIdx = 0;
      }

      const rawHeaders = (rawAoa[headerRowIdx] || []).map((h) => String(h || '').trim());
      const rows: any[] = [];

      for (let r = headerRowIdx + 1; r < rawAoa.length; r++) {
        const rowValues = rawAoa[r] || [];
        if (!rowValues.some((v) => v !== undefined && v !== null && String(v).trim() !== '')) {
          continue; // skip empty row
        }

        const rowObj: Record<string, any> = {};
        rawHeaders.forEach((h, colIdx) => {
          if (!h) return;
          const val = rowValues[colIdx] !== undefined ? String(rowValues[colIdx]).trim() : '';
          rowObj[h] = val;
        });

        // Skip banner or repeated headers
        const checkName = String(
          rowObj['Họ và tên'] || rowObj['Họ tên'] || rowObj['Tên'] || ''
        ).toLowerCase();
        if (checkName === 'họ và tên' || checkName === 'họ tên' || checkName.includes('tổng cộng')) {
          continue;
        }

        if (checkName) {
          rows.push(rowObj);
        }
      }

      if (rows.length === 0) {
        throw new Error('Không tìm thấy dòng giáo viên / nhân viên nào hợp lệ trong file.');
      }

      setPreviewRows(rows);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đọc file Excel.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (previewRows.length === 0) {
      setError('Chưa có dữ liệu để nạp. Vui lòng tải file Excel lên.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = db.importStaffMembersFromExcel(previewRows, { replaceAll });
      await db.syncStaffToCloud().catch(() => {});
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu dữ liệu cán bộ, giáo viên vào hệ thống.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                Nhập Danh Sách Giáo Viên & Công Nhân Viên Từ File Excel
              </h3>
              <p className="text-xs text-slate-500">
                Trường THCS Đông Thạnh • Tự động nhận diện tổ chuyên môn, chức vụ và đồng bộ dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Action cards: Download sample & Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Download Sample */}
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl flex flex-col justify-between gap-3">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-200 text-teal-900 uppercase">
                  Bước 1: Tải mẫu chuẩn
                </span>
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm mt-1">
                  File Excel Mẫu Danh Sách GV & CNV
                </h4>
                <p className="text-[11px] text-slate-600 mt-1">
                  Mẫu có sẵn các cột chuẩn: Mã GV, Họ và tên, Giới tính, Năm sinh, Tổ chuyên môn, Chức vụ, SĐT, Huyết áp nền, Dị ứng, Bệnh nền.
                </p>
              </div>

              <button
                type="button"
                onClick={downloadStandardStaffTemplateExcel}
                className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs self-start"
              >
                <Download className="w-4 h-4" />
                <span>Tải File Excel Mẫu (.xlsx)</span>
              </button>
            </div>

            {/* File Upload Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-4 border-2 border-dashed border-teal-300 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/40 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-xs sm:text-sm">
                  {file ? file.name : 'Chọn hoặc Kéo thả file Excel GV - CNV vào đây'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Hỗ trợ định dạng .xlsx, .xls (Microsoft Excel)
                </p>
              </div>
              {file && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  ✓ Đã chọn file ({previewRows.length} dòng dữ liệu)
                </span>
              )}
            </div>

            {/* Quick Clear Existing Staff Banner */}
            {existingStaffCount > 0 && (
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-rose-900 font-medium">
                  <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    Hệ thống đang có <strong>{existingStaffCount} cán bộ, giáo viên</strong>. Bạn muốn dọn sạch trước khi nạp?
                  </span>
                </div>

                {!confirmClearExisting ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearExisting(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors shadow-2xs self-start sm:self-auto cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Sạch Dữ Liệu Cũ</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] font-bold text-rose-700">Xác nhận xóa hết?</span>
                    <button
                      type="button"
                      onClick={handleClearCurrentStaff}
                      className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Đúng, xóa sạch
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearExisting(false)}
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            )}

            {clearSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 font-bold text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{clearSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 font-bold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="p-6 text-center text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-700" />
              <span>Đang đọc dữ liệu từ file Excel...</span>
            </div>
          )}

          {/* Preview Table */}
          {previewRows.length > 0 && (
            <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900">
                    Xem trước dữ liệu ({previewRows.length} nhân sự nhận diện được)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={replaceAll}
                      onChange={(e) => setReplaceAll(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-[11px] text-rose-700 font-bold">
                      Thay thế toàn bộ danh sách cũ
                    </span>
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2 border-b border-slate-200">STT</th>
                      <th className="p-2 border-b border-slate-200">Mã</th>
                      <th className="p-2 border-b border-slate-200">Họ và tên</th>
                      <th className="p-2 border-b border-slate-200">Giới tính</th>
                      <th className="p-2 border-b border-slate-200">Tổ / Bộ phận</th>
                      <th className="p-2 border-b border-slate-200">Chức vụ</th>
                      <th className="p-2 border-b border-slate-200">SĐT</th>
                      <th className="p-2 border-b border-slate-200">Huyết áp</th>
                      <th className="p-2 border-b border-slate-200">Dị ứng</th>
                      <th className="p-2 border-b border-slate-200">Bệnh nền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {previewRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className="hover:bg-teal-50/50">
                        <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-teal-800">
                          {row['Mã GV/NV'] || row['Mã GV'] || row['Mã NV'] || `GV${String(idx + 1).padStart(2, '0')}`}
                        </td>
                        <td className="p-2 font-bold text-slate-900">
                          {row['Họ và tên'] || row['Họ tên'] || row['Tên']}
                        </td>
                        <td className="p-2 text-slate-600">{row['Giới tính'] || '---'}</td>
                        <td className="p-2 text-slate-800 font-semibold">
                          {row['Tổ chuyên môn / Phòng ban'] || row['Tổ chuyên môn'] || row['Tổ'] || 'Tổ Toán - Tin'}
                        </td>
                        <td className="p-2 text-slate-600">{row['Chức vụ'] || 'Giáo viên'}</td>
                        <td className="p-2 font-mono text-slate-600">{row['Số điện thoại'] || row['SĐT'] || '---'}</td>
                        <td className="p-2 font-mono text-slate-800">{row['Huyết áp nền'] || row['Huyết áp'] || '120/80'}</td>
                        <td className="p-2 text-rose-700">{row['Tiền sử dị ứng'] || row['Dị ứng'] || 'Không'}</td>
                        <td className="p-2 text-amber-800">{row['Bệnh nền / Cần lưu ý'] || row['Bệnh nền'] || 'Không'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewRows.length > 15 && (
                <p className="text-[10px] text-slate-400 italic text-center">
                  Đang hiển thị 15 / {previewRows.length} dòng xem trước...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Info className="w-4 h-4 text-teal-600 shrink-0" />
            <span>
              {replaceAll
                ? 'Lưu ý: Chế độ "Thay thế toàn bộ" sẽ làm sạch danh sách cũ và nạp danh sách mới.'
                : 'Hệ thống tự động cộng dồn và cập nhật thông tin nếu trùng mã nhân sự.'}
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={previewRows.length === 0 || isSubmitting}
              className="px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Nạp {previewRows.length} Cán Bộ Vào Hệ Thống</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
