import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Search,
  Filter,
  AlertTriangle,
  ClockAlert,
  Flame,
  CheckCircle2,
  DollarSign,
  Printer,
  FileSpreadsheet,
  MapPin,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { db, formatDateVN, getDaysRemaining, getStatusText } from '../services/db';
import { Medicine, MedicineBatch } from '../types';

interface StockReportProps {
  onOpenImportForMed: (med: Medicine) => void;
  onOpenExportForMed: (med: Medicine) => void;
}

export const StockReport: React.FC<StockReportProps> = ({
  onOpenImportForMed,
  onOpenExportForMed,
}) => {
  const medicines = db.getMedicines();
  const batches = db.getBatches();
  const metrics = db.getDashboardMetrics();

  const [viewMode, setViewMode] = useState<'by_medicine' | 'by_batch'>('by_medicine');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  // Unique locations for filter
  const locations = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => {
      if (m.storageLocation) set.add(m.storageLocation);
    });
    return Array.from(set);
  }, [medicines]);

  // Filtered Medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((med) => {
      if (locationFilter !== 'all' && med.storageLocation !== locationFilter) return false;

      if (statusFilter !== 'all') {
        if (statusFilter === 'normal' && med.computedStatus !== 'active') return false;
        if (statusFilter === 'low_stock' && med.computedStatus !== 'low_stock') return false;
        if (statusFilter === 'expiring_soon' && med.computedStatus !== 'expiring_soon') return false;
        if (statusFilter === 'expired' && med.computedStatus !== 'expired') return false;
        if (statusFilter === 'out_of_stock' && med.computedStatus !== 'out_of_stock') return false;
      }

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const medBatches = batches.filter((b) => b.medicineId === med.id);
      const matchBatch = medBatches.some((b) => b.batchNumber.toLowerCase().includes(q));

      return (
        med.name.toLowerCase().includes(q) ||
        med.code.toLowerCase().includes(q) ||
        med.activeIngredient.toLowerCase().includes(q) ||
        med.storageLocation.toLowerCase().includes(q) ||
        matchBatch
      );
    });
  }, [medicines, batches, locationFilter, statusFilter, searchTerm]);

  // Filtered Batches (Quản lý lô riêng biệt)
  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => {
        const med = medicines.find((m) => m.id === b.medicineId);
        if (!med) return false;

        if (locationFilter !== 'all' && med.storageLocation !== locationFilter) return false;

        const daysLeft = getDaysRemaining(b.expDate);
        if (statusFilter !== 'all') {
          if (statusFilter === 'expired' && daysLeft >= 0) return false;
          if (statusFilter === 'expiring_soon' && (daysLeft < 0 || daysLeft > 30)) return false;
          if (statusFilter === 'out_of_stock' && b.quantity > 0) return false;
          if (statusFilter === 'normal' && (daysLeft <= 30 || b.quantity === 0)) return false;
        }

        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          b.batchNumber.toLowerCase().includes(q) ||
          med.name.toLowerCase().includes(q) ||
          med.code.toLowerCase().includes(q) ||
          med.storageLocation.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());
  }, [batches, medicines, locationFilter, statusFilter, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <Boxes className="w-4 h-4" />
            <span>Kiểm Kê Tủ Thuốc • Trường THCS Đông Thạnh</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            BÁO CÁO TỒN KHO THUỐC & CHI TIẾT TỪNG LÔ
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi chính xác số lượng tồn, giá trị kho, số lô riêng biệt và hạn dùng theo nguyên tắc FEFO
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>In Bảng Tồn Kho</span>
          </button>
        </div>
      </div>

      {/* Top 4 Key Inventory KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block uppercase">Tổng Loại Thuốc</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{metrics.totalMedicineTypes}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {batches.length} Lô thuốc
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 block uppercase">Tổng Số Lượng Tồn Kho</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-black text-emerald-800">
              {batches.reduce((s, b) => s + (b.quantity || 0), 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Đơn vị thuốc
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 block uppercase">Sắp Hết & Cần Bổ Sung</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-600">{metrics.lowStockCount}</span>
            <span className="text-[11px] text-amber-800 font-semibold">≤ Định mức</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-rose-700 block uppercase">Hết Hạn & Sắp Hết Hạn</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-rose-600">
              {metrics.expiredCount + metrics.expiringSoonCount}
            </span>
            <span className="text-[11px] text-rose-800 font-semibold">
              {metrics.expiredCount} đã hết hạn
            </span>
          </div>
        </div>
      </div>

      {/* View Mode Tabs & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Toggle Mode: By Medicine vs By Individual Batches */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('by_medicine')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'by_medicine'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Xem Theo Mặt Hàng Thuốc ({filteredMedicines.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_batch')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'by_batch'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Xem Chi Tiết Từng Lô FEFO ({filteredBatches.length})
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {viewMode === 'by_batch'
              ? '★ Quy định: Các lô thuốc có hạn dùng khác nhau được theo dõi độc lập, không gộp lô'
              : 'Tổng hợp số lượng tồn thực tế của từng danh mục thuốc'}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên thuốc, mã thuốc, hoạt chất, số lô..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 text-xs"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-xs"
            >
              <option value="all">Tất cả tình trạng tồn kho</option>
              <option value="normal">🟢 Bình thường (An toàn)</option>
              <option value="low_stock">🟡 Sắp hết (≤ Mức tối thiểu)</option>
              <option value="expiring_soon">🟠 Sắp hết hạn (≤ 30 ngày)</option>
              <option value="expired">🔴 Đã hết hạn</option>
              <option value="out_of_stock">⚪ Hết hàng (Tồn = 0)</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white text-xs"
            >
              <option value="all">Tất cả vị trí tủ</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* VIEW 1: By Medicine Summary Table */}
      {viewMode === 'by_medicine' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Mã & Tên thuốc</th>
                  <th className="p-3">Dạng & Quy cách</th>
                  <th className="p-3">Vị trí tủ</th>
                  <th className="p-3 text-center">Các Lô & HSD</th>
                  <th className="p-3 text-right">Tồn Kho Hiện Tại</th>
                  <th className="p-3 text-right">Tồn Tối Thiểu</th>
                  <th className="p-3 text-center">Tình trạng</th>
                  <th className="p-3 text-center">Thao tác nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMedicines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Không tìm thấy thuốc nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredMedicines.map((med) => {
                    const status = getStatusText(med.computedStatus);
                    const medBatches = batches.filter((b) => b.medicineId === med.id);

                    return (
                      <tr key={med.id} className="hover:bg-slate-50/80">
                        {/* Name & Code */}
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block text-xs sm:text-sm">
                            {med.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {med.code} • {med.activeIngredient} ({med.strength})
                          </span>
                        </td>

                        {/* Dosage */}
                        <td className="p-3 text-slate-700">
                          {med.dosageForm}
                          <span className="block text-[10px] text-slate-500">
                            ĐVT: {med.unit} ({med.packing})
                          </span>
                        </td>

                        {/* Location */}
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{med.storageLocation}</span>
                          </span>
                        </td>

                        {/* Batches count */}
                        <td className="p-3 text-center">
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {medBatches.length} Lô
                          </span>
                          {med.earliestExpDate && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              HSD gần: {formatDateVN(med.earliestExpDate)}
                            </span>
                          )}
                        </td>

                        {/* Current Stock */}
                        <td className="p-3 text-right">
                          <span
                            className={`text-sm font-black ${
                              med.totalStock === 0
                                ? 'text-slate-400'
                                : med.totalStock <= med.minStock
                                ? 'text-amber-700'
                                : 'text-emerald-800'
                            }`}
                          >
                            {med.totalStock} {med.unit}
                          </span>
                        </td>

                        {/* Min Stock */}
                        <td className="p-3 text-right text-slate-500">
                          {med.minStock} {med.unit}
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${status.bg} ${status.color} ${status.border}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        {/* Fast actions */}
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenImportForMed(med)}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold"
                              title="Nhập thêm thuốc này"
                            >
                              + Nhập
                            </button>
                            <button
                              type="button"
                              disabled={med.totalStock === 0}
                              onClick={() => onOpenExportForMed(med)}
                              className="px-2 py-1 bg-teal-50 text-teal-800 hover:bg-teal-100 disabled:opacity-40 disabled:cursor-not-allowed rounded text-[10px] font-bold"
                              title="Xuất cấp phát thuốc này"
                            >
                              - Cấp phát
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
      )}

      {/* VIEW 2: By Individual Batches Table (Section XIV FEFO Mandate) */}
      {viewMode === 'by_batch' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-emerald-50/70 border-b border-emerald-100 text-xs text-emerald-950 font-semibold flex items-center justify-between">
            <span>
              📋 DANH SÁCH CHI TIẾT TỪNG LÔ RIÊNG BIỆT (XẾP THEO THỨ TỰ HẠN SỬ DỤNG GẦN NHẤT FEFO)
            </span>
            <span className="text-[11px] font-normal text-emerald-800">
              Tổng cộng: <strong>{filteredBatches.length}</strong> lô thuốc
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Số lô</th>
                  <th className="p-3">Tên thuốc & Mã</th>
                  <th className="p-3">Ngày sản xuất</th>
                  <th className="p-3">Hạn sử dụng</th>
                  <th className="p-3">Thời hạn còn lại</th>
                  <th className="p-3 text-right">Lượng tồn lô</th>
                  <th className="p-3">Vị trí tủ</th>
                  <th className="p-3 text-center">Tình trạng lô</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Không có lô thuốc nào phù hợp điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const med = medicines.find((m) => m.id === b.medicineId);
                    const daysLeft = getDaysRemaining(b.expDate);

                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        {/* Batch Number */}
                        <td className="p-3 font-mono font-bold text-slate-900 bg-slate-50/50">
                          {b.batchNumber}
                        </td>

                        {/* Medicine */}
                        <td className="p-3">
                          <span className="font-bold text-slate-900">{med?.name || '---'}</span>
                          <span className="block font-mono text-[10px] text-slate-500">
                            {med?.code}
                          </span>
                        </td>

                        {/* Mfg Date */}
                        <td className="p-3 text-slate-600">{formatDateVN(b.mfgDate)}</td>

                        {/* Exp Date */}
                        <td className="p-3 font-bold text-slate-900">{formatDateVN(b.expDate)}</td>

                        {/* Days remaining */}
                        <td className="p-3">
                          <span
                            className={`font-bold ${
                              daysLeft < 0
                                ? 'text-rose-600'
                                : daysLeft <= 30
                                ? 'text-orange-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {daysLeft < 0
                              ? `Đã hết hạn (${Math.abs(daysLeft)} ngày)`
                              : `Còn ${daysLeft} ngày`}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="p-3 text-right font-black text-slate-900">
                          {b.quantity} {med?.unit}
                        </td>

                        {/* Storage */}
                        <td className="p-3 text-slate-600">{med?.storageLocation}</td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          {daysLeft < 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200">
                              🔴 ĐÃ HẾT HẠN
                            </span>
                          ) : daysLeft <= 30 ? (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-200">
                              🟠 SẮP HẾT HẠN (Ưu tiên FEFO)
                            </span>
                          ) : b.quantity === 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">
                              Đã xuất hết
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                              🟢 Bình thường
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Instructions for School Medical Staff */}
      <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 text-xs text-blue-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Quy định quản lý tủ thuốc trường THCS Đông Thạnh:</p>
          <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
            - Hàng tuần kiểm tra các mặt hàng có cảnh báo <strong>Màu đỏ (Hết hạn)</strong> để lập biên bản tiêu hủy, tuyệt đối không cấp phát cho học sinh.<br />
            - Thuốc có cảnh báo <strong>Màu cam (Sắp hết hạn)</strong> phải được xuất trước theo nguyên tắc FEFO.<br />
            - Thuốc có cảnh báo <strong>Màu vàng (Sắp hết)</strong> cần lập dự trù nhập bổ sung để luôn sẵn sàng cấp cứu sơ sinh hoạt học đường.
          </p>
        </div>
      </div>
    </div>
  );
};
