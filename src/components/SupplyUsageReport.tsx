import React, { useState, useMemo, useEffect } from 'react';
import {
  BriefcaseMedical,
  Search,
  Download,
  Printer,
  Calendar,
  Layers,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { db, formatDateTimeVN, formatDateVN, formatTime24H } from '../services/db';
import { exportSupplyUsageExcel, getFilenameDate } from '../services/excelService';

export const SupplyUsageReport: React.FC = () => {
  const [, setDbTick] = useState(0);
  useEffect(() => {
    const unsub = db.subscribe(() => setDbTick((t) => t + 1));
    return () => unsub();
  }, []);

  const visits = db.getClinicVisits();
  const supplies = db.getSupplies();
  const classes = db.getSchoolClasses();

  // Filters
  const [selectedSupplyId, setSelectedSupplyId] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Flatten supply usage items
  const supplyItems = useMemo(() => {
    const list: Array<{
      visitId: string;
      visitCode: string;
      dateTime: string;
      studentName: string;
      studentCode: string;
      className: string;
      supplyId: string;
      supplyName: string;
      quantity: number;
      unit: string;
      reason: string;
      performer: string;
    }> = [];

    visits.forEach((v) => {
      if (!v.suppliesUsed || v.suppliesUsed.length === 0) return;
      const vDate = v.dateTime
        ? formatDateTimeVN(v.dateTime)
        : (v.visitDate ? `${v.timeIn ? formatTime24H(v.timeIn) + ' ' : ''}${formatDateVN(v.visitDate)}` : '—');
      const vReason = (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) || v.reason || '';

      v.suppliesUsed.forEach((s) => {
        list.push({
          visitId: v.id,
          visitCode: v.visitCode,
          dateTime: vDate,
          studentName: v.studentName,
          studentCode: v.studentCode,
          className: v.className,
          supplyId: s.supplyId,
          supplyName: s.supplyName,
          quantity: s.quantity,
          unit: s.unit,
          reason: vReason,
          performer: v.performer,
        });
      });
    });

    return list.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [visits]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return supplyItems.filter((item) => {
      if (selectedSupplyId !== 'all' && item.supplyId !== selectedSupplyId) return false;
      if (selectedClass !== 'all' && item.className !== selectedClass) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.studentName.toLowerCase().includes(q);
        const matchSup = item.supplyName.toLowerCase().includes(q);
        if (!matchName && !matchSup) return false;
      }
      return true;
    });
  }, [supplyItems, selectedSupplyId, selectedClass, searchQuery]);

  // Summary aggregation by supply
  const supplySummary = useMemo(() => {
    const map = new Map<string, { name: string; unit: string; totalQty: number; times: number }>();
    filteredItems.forEach((item) => {
      const cur = map.get(item.supplyName) || {
        name: item.supplyName,
        unit: item.unit,
        totalQty: 0,
        times: 0,
      };
      cur.totalQty += item.quantity;
      cur.times += 1;
      map.set(item.supplyName, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [filteredItems]);

  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Export Excel (.xlsx) chuẩn dữ liệu vật tư tiêu hao
  const handleExportExcel = () => {
    try {
      let filterText = `Toàn bộ ${filteredItems.length} lượt sử dụng vật tư`;
      if (selectedSupplyId !== 'all') {
        const sup = supplies.find((s) => s.id === selectedSupplyId);
        filterText = `Vật tư: ${sup?.name || selectedSupplyId}`;
      }
      if (selectedClass !== 'all') {
        filterText += ` • Lớp: ${selectedClass}`;
      }

      exportSupplyUsageExcel(filteredItems, filterText);
      setExportNotification(
        `Đã xuất file Excel: Bao_Cao_Vat_Tu_THCS_Dong_Thanh_${getFilenameDate()}.xlsx thành công!`
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
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              VẬT TƯ TIÊU HAO
            </span>
            <h1 className="text-xl font-bold text-slate-900">Báo Cáo Vật Tư Y Tế Đã Sử Dụng</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Theo dõi số lượng bông gạc, cồn sát khuẩn, nước muối, băng cá nhân tiêu hao
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-print-supply-report"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>In báo cáo</span>
          </button>
          <button
            id="btn-export-supply-excel"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Tải xuống tệp bảng tính Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {exportNotification && (
        <div className="p-3.5 bg-blue-50 border border-blue-300 text-blue-900 rounded-xl text-xs flex items-center gap-2.5 font-medium shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{exportNotification}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {supplySummary.slice(0, 4).map((sup, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 truncate max-w-[130px]">{sup.name}</span>
              <BriefcaseMedical className="w-4 h-4 text-blue-700 shrink-0" />
            </div>
            <p className="text-xl font-bold text-blue-800 mt-1">
              {sup.totalQty}{' '}
              <span className="text-xs font-normal text-slate-500">{sup.unit}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sử dụng qua {sup.times} lần sơ cứu</p>
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
              placeholder="Tìm theo học sinh, vật tư..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <select
              value={selectedSupplyId}
              onChange={(e) => setSelectedSupplyId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
            >
              <option value="all">Tất cả vật tư tiêu hao</option>
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.unit})
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
            Tổng số: <strong>{filteredItems.length}</strong> lượt sử dụng vật tư
          </span>
          {(selectedSupplyId !== 'all' || selectedClass !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedSupplyId('all');
                setSelectedClass('all');
                setSearchQuery('');
              }}
              className="text-blue-700 hover:text-blue-800 font-medium underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Thời gian</th>
                <th className="py-3 px-3">Học sinh</th>
                <th className="py-3 px-3">Lớp</th>
                <th className="py-3 px-3">Tên vật tư</th>
                <th className="py-3 px-3">Số lượng đã dùng</th>
                <th className="py-3 px-3">Mục đích sơ cứu</th>
                <th className="py-3 px-3">Cán bộ y tế</th>
                <th className="py-3 px-3">Mã ca khám</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <BriefcaseMedical className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-sm text-slate-600">Không có dữ liệu sử dụng vật tư</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {formatDateTimeVN(item.dateTime)}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.studentName}</td>
                    <td className="py-3 px-3 font-bold text-emerald-800">{item.className}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{item.supplyName}</td>
                    <td className="py-3 px-3 font-bold text-blue-700 whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{item.reason}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{item.performer}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{item.visitCode}</td>
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
