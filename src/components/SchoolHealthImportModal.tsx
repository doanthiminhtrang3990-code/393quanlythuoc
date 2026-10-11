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
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { HealthEvent, HealthCheckup } from '../types';
import {
  exportHealthEventsTemplateExcel,
  exportHealthCheckupsTemplateExcel,
} from '../services/excelService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'events' | 'checkups';
  onSuccess: () => void;
}

export const SchoolHealthImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  activeTab: initialTab,
  onSuccess,
}) => {
  const [targetType, setTargetType] = useState<'events' | 'checkups'>(initialTab);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    events?: { item: Partial<HealthEvent>; isUpdate: boolean }[];
    checkups?: { item: Partial<HealthCheckup>; isUpdate: boolean }[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);
    setPreviewData(null);
    setImportResult(null);
    await parseUploadedFile(selected);
  };

  const parseUploadedFile = async (uploadedFile: File) => {
    setLoading(true);
    setError(null);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      if (!rawJson || rawJson.length < 2) {
        throw new Error('Tập tin Excel trống hoặc không có dòng dữ liệu hợp lệ.');
      }

      // Find the header row (row containing keywords)
      let headerRowIndex = -1;
      for (let r = 0; r < Math.min(rawJson.length, 10); r++) {
        const rowStr = (rawJson[r] || []).map((c) => String(c || '').toLowerCase()).join(' ');
        if (
          rowStr.includes('mã') ||
          rowStr.includes('học sinh') ||
          rowStr.includes('sự cố') ||
          rowStr.includes('thị lực') ||
          rowStr.includes('chiều cao')
        ) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error(
          'Không nhận diện được dòng tiêu đề cột trong file Excel. Vui lòng sử dụng đúng định dạng mẫu.'
        );
      }

      const headers = (rawJson[headerRowIndex] || []).map((h) =>
        String(h || '').trim().toLowerCase()
      );

      // Auto-detect mode based on column headers if possible
      const isCheckupFile =
        headers.some((h) => h.includes('chiều cao') || h.includes('thị lực') || h.includes('khám') || h.includes('bmi'));
      const isEventFile =
        headers.some((h) => h.includes('sự cố') || h.includes('tai nạn') || h.includes('sơ cứu') || h.includes('chấn thương'));

      const currentMode = isCheckupFile ? 'checkups' : isEventFile ? 'events' : targetType;
      setTargetType(currentMode);

      const existingEvents = db.getHealthEvents();
      const existingCheckups = db.getHealthCheckups();

      if (currentMode === 'events') {
        const codeIdx = headers.findIndex((h) => h.includes('mã sự kiện') || h === 'mã');
        const timeIdx = headers.findIndex((h) => h.includes('thời gian') || h.includes('ngày giờ') || h.includes('ngày'));
        const locIdx = headers.findIndex((h) => h.includes('địa điểm') || h.includes('nơi'));
        const typeIdx = headers.findIndex((h) => h.includes('phân loại') || h.includes('loại sự cố') || h.includes('loại'));
        const stuCodeIdx = headers.findIndex((h) => h.includes('mã học sinh') || h.includes('mã hs'));
        const stuNameIdx = headers.findIndex((h) => h.includes('họ và tên') || h.includes('tên học sinh') || h.includes('học sinh'));
        const classIdx = headers.findIndex((h) => h.includes('lớp'));
        const descIdx = headers.findIndex((h) => h.includes('diễn biến') || h.includes('mô tả') || h.includes('nội dung'));
        const initIdx = headers.findIndex((h) => h.includes('ban đầu') || h.includes('tình trạng'));
        const treatIdx = headers.findIndex((h) => h.includes('sơ cứu') || h.includes('xử trí') || h.includes('biện pháp'));
        const witnessIdx = headers.findIndex((h) => h.includes('chứng kiến') || h.includes('người chứng kiến'));
        const perfIdx = headers.findIndex((h) => h.includes('cán bộ') || h.includes('thực hiện') || h.includes('y sĩ'));
        const outIdx = headers.findIndex((h) => h.includes('kết quả') || h.includes('bàn giao'));
        const noteIdx = headers.findIndex((h) => h.includes('ghi chú'));

        const parsed: { item: Partial<HealthEvent>; isUpdate: boolean }[] = [];

        for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
          const row = rawJson[r];
          if (!row || row.length === 0) continue;

          const eventCode = codeIdx !== -1 && row[codeIdx] ? String(row[codeIdx]).trim() : '';
          const desc = descIdx !== -1 && row[descIdx] ? String(row[descIdx]).trim() : '';
          const stuName = stuNameIdx !== -1 && row[stuNameIdx] ? String(row[stuNameIdx]).trim() : '';
          const loc = locIdx !== -1 && row[locIdx] ? String(row[locIdx]).trim() : 'Sân trường';
          const typeRaw = typeIdx !== -1 && row[typeIdx] ? String(row[typeIdx]).trim() : 'Tai nạn';

          // Skip summary or completely empty rows
          if (!desc && !eventCode && !stuName) continue;
          if (String(row[0] || '').toLowerCase().includes('tổng cộng') || String(row[1] || '').toLowerCase().includes('tổng cộng')) {
            continue;
          }

          let formattedDate = new Date().toISOString();
          if (timeIdx !== -1 && row[timeIdx]) {
            const rawTime = String(row[timeIdx]).trim();
            if (rawTime.includes('-') || rawTime.includes('/')) {
              formattedDate = rawTime;
            }
          }

          const isUpdate = Boolean(
            eventCode && existingEvents.some((e) => e.eventCode.toLowerCase() === eventCode.toLowerCase())
          );

          parsed.push({
            isUpdate,
            item: {
              eventCode: eventCode || undefined,
              dateTime: formattedDate,
              location: loc,
              eventType: (typeRaw as any) || 'Tai nạn',
              studentCode: stuCodeIdx !== -1 && row[stuCodeIdx] ? String(row[stuCodeIdx]).trim() : undefined,
              studentName: stuName || undefined,
              className: classIdx !== -1 && row[classIdx] ? String(row[classIdx]).trim() : undefined,
              description: desc || 'Sự cố y tế học đường',
              initialCondition: initIdx !== -1 && row[initIdx] ? String(row[initIdx]).trim() : '',
              treatment: treatIdx !== -1 && row[treatIdx] ? String(row[treatIdx]).trim() : 'Đã sơ cứu tại phòng y tế',
              witness: witnessIdx !== -1 && row[witnessIdx] ? String(row[witnessIdx]).trim() : '',
              performer: perfIdx !== -1 && row[perfIdx] ? String(row[perfIdx]).trim() : 'Cán bộ y tế',
              outcome: outIdx !== -1 && row[outIdx] ? String(row[outIdx]).trim() : 'Đã xử trí',
              notes: noteIdx !== -1 && row[noteIdx] ? String(row[noteIdx]).trim() : '',
            },
          });
        }

        if (parsed.length === 0) {
          throw new Error('Không tìm thấy dòng dữ liệu sự cố nào trong file.');
        }

        setPreviewData({ events: parsed });
      } else {
        // Khám sức khỏe định kỳ
        const codeIdx = headers.findIndex((h) => h.includes('mã phiếu') || h === 'mã');
        const dateIdx = headers.findIndex((h) => h.includes('ngày khám') || h.includes('ngày'));
        const yearIdx = headers.findIndex((h) => h.includes('năm học'));
        const stuCodeIdx = headers.findIndex((h) => h.includes('mã học sinh') || h.includes('mã hs'));
        const stuNameIdx = headers.findIndex((h) => h.includes('họ và tên') || h.includes('tên học sinh') || h.includes('học sinh'));
        const classIdx = headers.findIndex((h) => h.includes('lớp'));
        const hIdx = headers.findIndex((h) => h.includes('chiều cao') || h.includes('cao'));
        const wIdx = headers.findIndex((h) => h.includes('cân nặng') || h.includes('nặng'));
        const bmiIdx = headers.findIndex((h) => h.includes('bmi'));
        const visLIdx = headers.findIndex((h) => h.includes('trái') || h.includes('mắt trái'));
        const visRIdx = headers.findIndex((h) => h.includes('phải') || h.includes('mắt phải'));
        const refIdx = headers.findIndex((h) => h.includes('khúc xạ') || h.includes('cận thị'));
        const dentalIdx = headers.findIndex((h) => h.includes('răng') || h.includes('nha'));
        const entIdx = headers.findIndex((h) => h.includes('tai') || h.includes('mũi') || h.includes('họng'));
        const spineIdx = headers.findIndex((h) => h.includes('cột sống') || h.includes('vẹo'));
        const nutIdx = headers.findIndex((h) => h.includes('dinh dưỡng') || h.includes('thể lực'));
        const bpIdx = headers.findIndex((h) => h.includes('huyết áp'));
        const pulseIdx = headers.findIndex((h) => h.includes('mạch'));
        const recIdx = headers.findIndex((h) => h.includes('khuyến nghị') || h.includes('lời khuyên'));
        const docIdx = headers.findIndex((h) => h.includes('bác sĩ') || h.includes('khám'));

        const parsed: { item: Partial<HealthCheckup>; isUpdate: boolean }[] = [];

        for (let r = headerRowIndex + 1; r < rawJson.length; r++) {
          const row = rawJson[r];
          if (!row || row.length === 0) continue;

          const checkupCode = codeIdx !== -1 && row[codeIdx] ? String(row[codeIdx]).trim() : '';
          const stuName = stuNameIdx !== -1 && row[stuNameIdx] ? String(row[stuNameIdx]).trim() : '';
          const stuCode = stuCodeIdx !== -1 && row[stuCodeIdx] ? String(row[stuCodeIdx]).trim() : '';

          if (!stuName && !checkupCode && !stuCode) continue;
          if (String(row[0] || '').toLowerCase().includes('tổng cộng') || String(row[1] || '').toLowerCase().includes('tổng cộng')) {
            continue;
          }

          const height = hIdx !== -1 ? parseFloat(String(row[hIdx])) || 150 : 150;
          const weight = wIdx !== -1 ? parseFloat(String(row[wIdx])) || 42 : 42;
          const bmi =
            bmiIdx !== -1 && row[bmiIdx]
              ? parseFloat(String(row[bmiIdx])) || parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1))
              : parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1));

          const refractionRaw = refIdx !== -1 && row[refIdx] ? String(row[refIdx]).trim() : '';
          const hasRefraction =
            Boolean(refractionRaw) &&
            !refractionRaw.toLowerCase().includes('không') &&
            !refractionRaw.toLowerCase().includes('bình thường');

          const spineRaw = spineIdx !== -1 && row[spineIdx] ? String(row[spineIdx]).trim() : '';
          const scoliosis =
            Boolean(spineRaw) &&
            (spineRaw.toLowerCase().includes('cong') || spineRaw.toLowerCase().includes('vẹo'));

          const isUpdate = Boolean(
            checkupCode && existingCheckups.some((c) => c.checkupCode.toLowerCase() === checkupCode.toLowerCase())
          );

          parsed.push({
            isUpdate,
            item: {
              checkupCode: checkupCode || undefined,
              checkupDate: dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]).trim() : new Date().toISOString().split('T')[0],
              schoolYear: yearIdx !== -1 && row[yearIdx] ? String(row[yearIdx]).trim() : '2026-2027',
              studentCode: stuCode || undefined,
              studentName: stuName || 'Học sinh',
              className: classIdx !== -1 && row[classIdx] ? String(row[classIdx]).trim() : 'Khối 6',
              height,
              weight,
              bmi,
              eyesightLeft: visLIdx !== -1 && row[visLIdx] ? String(row[visLIdx]).trim() : '10/10',
              eyesightRight: visRIdx !== -1 && row[visRIdx] ? String(row[visRIdx]).trim() : '10/10',
              hasRefraction,
              dentalCondition: dentalIdx !== -1 && row[dentalIdx] ? String(row[dentalIdx]).trim() : 'Bình thường',
              entCondition: entIdx !== -1 && row[entIdx] ? String(row[entIdx]).trim() : 'Bình thường',
              scoliosis,
              nutritionStatus: nutIdx !== -1 && row[nutIdx] ? (String(row[nutIdx]).trim() as any) : 'Bình thường',
              bloodPressure: bpIdx !== -1 && row[bpIdx] ? String(row[bpIdx]).trim() : '105/70',
              pulse: pulseIdx !== -1 && row[pulseIdx] ? parseInt(String(row[pulseIdx]), 10) || 80 : 80,
              recommendations: recIdx !== -1 && row[recIdx] ? String(row[recIdx]).trim() : '',
              doctorOrStaff: docIdx !== -1 && row[docIdx] ? String(row[docIdx]).trim() : 'Bs. Nguyễn Thanh Hà (TTYT Hóc Môn)',
            },
          });
        }

        if (parsed.length === 0) {
          throw new Error('Không tìm thấy dòng dữ liệu khám sức khỏe nào trong file.');
        }

        setPreviewData({ checkups: parsed });
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đọc file Excel. Vui lòng kiểm tra lại cấu trúc file.');
      setPreviewData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = () => {
    if (!previewData) return;

    try {
      setLoading(true);
      if (targetType === 'events' && previewData.events) {
        const items = previewData.events.map((p) => p.item);
        const res = db.batchUpsertHealthEvents(items);
        setImportResult(res);
      } else if (targetType === 'checkups' && previewData.checkups) {
        const items = previewData.checkups.map((p) => p.item);
        const res = db.batchUpsertHealthCheckups(items);
        setImportResult(res);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhập dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPreviewData(null);
    setImportResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto p-2 sm:p-5 flex items-start sm:items-center justify-center backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-base text-slate-900">
                Nhập & Điều Chỉnh Dữ Liệu Bằng File Excel
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hệ thống tự động nhận diện bản ghi cũ theo Mã để cập nhật điều chỉnh, hoặc tạo mới nếu chưa có mã.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto py-4 space-y-4 flex-1 text-xs">
          {/* Section: Select Category */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-slate-700 block">Chọn sổ dữ liệu điều chỉnh:</span>
              <span className="text-[11px] text-slate-500">
                {targetType === 'events'
                  ? 'Sổ theo dõi Tai nạn & Sự cố y tế học đường'
                  : 'Sổ kết quả Khám sức khỏe học sinh định kỳ'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetType('events');
                  resetAll();
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  targetType === 'events'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Sự cố tai nạn
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetType('checkups');
                  resetAll();
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  targetType === 'checkups'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Khám định kỳ
              </button>
            </div>
          </div>

          {/* Download Template Bar */}
          <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2 text-blue-900 font-medium">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Cần cấu trúc chuẩn để nhập nhanh?</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (targetType === 'events') exportHealthEventsTemplateExcel();
                else exportHealthCheckupsTemplateExcel();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-xs text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file mẫu Excel chuẩn</span>
            </button>
          </div>

          {/* Upload Area */}
          {!importResult && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                id="excel-upload-input"
              />
              <label
                htmlFor="excel-upload-input"
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center block"
              >
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="font-bold text-slate-800 text-sm">
                  {file ? file.name : 'Nhấn để chọn hoặc kéo thả file Excel vào đây'}
                </span>
                <span className="text-slate-400 text-[11px] mt-1">
                  Hỗ trợ định dạng .xlsx, .xls do hệ thống xuất ra hoặc theo mẫu chuẩn
                </span>
              </label>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Không thể đọc file</p>
                <p className="text-[11px] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Preview State */}
          {previewData && !importResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl">
                <span className="font-bold text-slate-800">
                  Dữ liệu phát hiện trong file (
                  {targetType === 'events'
                    ? `${previewData.events?.length || 0} dòng sự cố`
                    : `${previewData.checkups?.length || 0} dòng phiếu khám`}
                  ):
                </span>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                    {targetType === 'events'
                      ? `${previewData.events?.filter((e) => e.isUpdate).length || 0} điều chỉnh cập nhật`
                      : `${previewData.checkups?.filter((c) => c.isUpdate).length || 0} điều chỉnh cập nhật`}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                    {targetType === 'events'
                      ? `${previewData.events?.filter((e) => !e.isUpdate).length || 0} thêm mới`
                      : `${previewData.checkups?.filter((c) => !c.isUpdate).length || 0} thêm mới`}
                  </span>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Hành động</th>
                      <th className="py-2 px-3">Mã</th>
                      <th className="py-2 px-3">Học sinh</th>
                      <th className="py-2 px-3">Lớp</th>
                      <th className="py-2 px-3">
                        {targetType === 'events' ? 'Sự cố / Xử trí' : 'Thể lực & Thị lực'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {targetType === 'events' &&
                      previewData.events?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.isUpdate
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {row.isUpdate ? 'Cập nhật' : 'Tạo mới'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            {row.item.eventCode || '[Tự cấp mã]'}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {row.item.studentName || 'Tập thể'}
                          </td>
                          <td className="py-2 px-3">{row.item.className || '—'}</td>
                          <td className="py-2 px-3 max-w-xs truncate text-slate-600">
                            <span className="font-semibold text-rose-800 mr-1">
                              [{row.item.eventType}]
                            </span>
                            {row.item.description}
                          </td>
                        </tr>
                      ))}

                    {targetType === 'checkups' &&
                      previewData.checkups?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.isUpdate
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {row.isUpdate ? 'Cập nhật' : 'Tạo mới'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            {row.item.checkupCode || '[Tự cấp mã]'}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {row.item.studentName}
                          </td>
                          <td className="py-2 px-3">{row.item.className}</td>
                          <td className="py-2 px-3 text-slate-600">
                            {row.item.height}cm, {row.item.weight}kg (BMI {row.item.bmi}) • Mắt{' '}
                            {row.item.eyesightLeft}/{row.item.eyesightRight}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Summary */}
          {importResult && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div>
                <h4 className="font-bold text-slate-900 text-base">
                  Điều Chỉnh & Nhập Dữ Liệu Thành Công!
                </h4>
                <p className="text-xs text-emerald-800 mt-1">
                  Đã cập nhật điều chỉnh: <strong>{importResult.updated}</strong> bản ghi • Thêm mới:{' '}
                  <strong>{importResult.inserted}</strong> bản ghi.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs"
              >
                Đóng & Xem danh sách
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!importResult && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-semibold"
            >
              Làm lại
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!previewData || loading}
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                <span>Áp dụng điều chỉnh vào hệ thống</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
