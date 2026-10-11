import React, { useState, useMemo } from 'react';
import {
  Pill,
  Search,
  Download,
  Printer,
  Calendar,
  Filter,
  User,
  Boxes,
  Layers,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { db, formatDateVN, formatDateTimeVN, formatTime24H } from '../services/db';
import { exportMedicationUsageExcel, getFilenameDate } from '../services/excelService';

interface MedicationUsageReportProps {
  onSelectStudent?: (studentId: string) => void;
}

export const MedicationUsageReport: React.FC<MedicationUsageReportProps> = ({ onSelectStudent }) => {
  const visits = db.getClinicVisits();
  const medicines = db.getMedicines();
  const classes = db.getSchoolClasses();

  // Filters
  const [selectedMedId, setSelectedMedId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'quarter'>('all');

  // Flatten usage items
  const usageItems = useMemo(() => {
    const list: Array<{
      visitId: string;
      visitCode: string;
      dateTime: string;
      studentId: string;
      studentCode: string;
      studentName: string;
      className: string;
      medicineId: string;
      medicineCode: string;
      medicineName: string;
      batchNumber?: string;
      expDate?: string;
      quantity: number;
      unit: string;
      dosageInstructions?: string;
      reason: string;
      performer: string;
    }> = [];

    visits.forEach((v) => {
      const meds = v.medicinesUsed || v.medicinesDispensed || [];
      if (meds.length === 0) return;
      const vDate = v.dateTime
        ? formatDateTimeVN(v.dateTime)
        : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—');
      const vReason = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';

      meds.forEach((m) => {
        list.push({
          visitId: v.id,
          visitCode: v.visitCode,
          dateTime: vDate,
          studentId: v.studentId,
          studentCode: v.studentCode,
          studentName: v.studentName,
          className: v.className,
          medicineId: m.medicineId,
          medicineCode: m.medicineCode || '',
          medicineName: m.medicineName,
          batchNumber: m.batchNumber,
          expDate: m.expDate,
          quantity: m.quantity,
          unit: m.unit,
          dosageInstructions: m.dosageInstructions,
          reason: vReason,
          performer: v.performer,
        });
      });
    });

    return list.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [visits]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return usageItems.filter((item) => {
      if (selectedMedId !== 'all' && item.medicineId !== selectedMedId) return false;
      if (selectedClass !== 'all' && item.className !== selectedClass) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.studentName.toLowerCase().includes(q);
        const matchMed = item.medicineName.toLowerCase().includes(q);
        const matchBatch = item.batchNumber?.toLowerCase().includes(q);
        const matchCode = item.studentCode.toLowerCase().includes(q);
        if (!matchName && !matchMed && !matchBatch && !matchCode) return false;
      }
      return true;
    });
  }, [usageItems, selectedMedId, selectedClass, searchQuery]);

  // Summary aggregation by medicine
  const medSummary = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; totalQty: number; times: number }>();
    filteredItems.forEach((item) => {
      const cur = map.get(item.medicineName) || {
        name: item.medicineName,
        unit: item.unit,
        totalQty: 0,
        times: 0,
      };
      cur.totalQty += item.quantity;
      cur.times += 1;
      map.set(item.medicineName, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredItems]);

  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Export Excel (.xlsx) chuẩn dữ liệu dược học đường
  const handleExportExcel = () => {
    try {
      let filterText = `Toàn bộ ${filteredItems.length} lượt cấp phát`;
      if (selectedMedId !== 'all') {
        const med = medicines.find((m) => m.id === selectedMedId);
        filterText = `Thuốc: ${med?.name || selectedMedId}`;
      }
      if (selectedClass !== 'all') {
        filterText += ` • Lớp: ${selectedClass}`;
      }

      exportMedicationUsageExcel(filteredItems, filterText);
      setExportNotification(
        `Đã xuất file Excel: Bao_Cao_Thuoc_Su_Dung_THCS_Dong_Thanh_${getFilenameDate()}.xlsx thành công!`
      );
      setTimeout(() => setExportNotification(null), 5000);
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      setExportNotification('Có lỗi xảy ra khi tạo tệp Excel. Đang thử lại...');
      setTimeout(() => setExportNotification(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              BÁO CÁO DƯỢC
            </span>
            <h1 className="text-xl font-bold text-slate-900">Báo Cáo Thuốc Đã Sử Dụng Theo Học Sinh & Số Lô</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Truy xuất chi tiết từng viên thuốc cấp cho học sinh theo nguyên tắc FEFO
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-print-medication-report"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>In báo cáo</span>
          </button>
          <button
            id="btn-export-medication-excel"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Tải xuống tệp bảng tính Microsoft Excel (.xlsx) chuẩn A4"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {exportNotification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2.5 font-medium shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{exportNotification}</span>
        </div>
      )}

      {/* Summary Cards by Top Medicines */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {medSummary.slice(0, 4).map((med, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 truncate max-w-[130px]">{med.name}</span>
              <Pill className="w-4 h-4 text-emerald-700 shrink-0" />
            </div>
            <p className="text-xl font-bold text-emerald-800 mt-1">
              {med.totalQty}{' '}
              <span className="text-xs font-normal text-slate-500">{med.unit}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Đã cấp qua {med.times} lượt khám</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo học sinh, thuốc, số lô..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <select
              value={selectedMedId}
              onChange={(e) => setSelectedMedId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
            >
              <option value="all">Tất cả loại thuốc</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
            >
              <option value="all">Tất cả các lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  Lớp {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
          <span>
            Tìm thấy <strong>{filteredItems.length}</strong> dòng cấp phát thuốc
          </span>
          {(selectedMedId !== 'all' || selectedClass !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedMedId('all');
                setSelectedClass('all');
                setSearchQuery('');
              }}
              className="text-emerald-700 hover:text-emerald-800 font-medium underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Usage Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Thời gian</th>
                <th className="py-3 px-3">Học sinh</th>
                <th className="py-3 px-3">Lớp</th>
                <th className="py-3 px-3">Tên thuốc</th>
                <th className="py-3 px-3">Số lượng</th>
                <th className="py-3 px-3">Số lô (FEFO)</th>
                <th className="py-3 px-3">Hạn dùng</th>
                <th className="py-3 px-3">Mục đích / Lý do</th>
                <th className="py-3 px-3">Cán bộ y tế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Pill className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-sm text-slate-600">Không có dữ liệu cấp phát thuốc phù hợp</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {formatDateTimeVN(item.dateTime)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <button
                        onClick={() => onSelectStudent?.(item.studentId)}
                        className="hover:text-emerald-700 hover:underline text-left"
                      >
                        {item.studentName}
                        <span className="text-[10px] text-slate-400 block font-mono">{item.studentCode}</span>
                      </button>
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-800">{item.className}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{item.medicineName}</td>
                    <td className="py-3 px-3 font-bold text-emerald-700 whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {item.batchNumber || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.expDate ? formatDateVN(item.expDate) : '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{item.reason}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">{item.performer}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
