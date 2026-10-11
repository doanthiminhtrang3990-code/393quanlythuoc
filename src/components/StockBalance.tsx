import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Package,
  Layers,
  Wrench,
  CheckCircle2,
  RefreshCw,
  Clock,
  MapPin,
  FileText,
  ShieldAlert,
  UserCheck,
  FileSignature,
} from 'lucide-react';
import { db } from '../services/db';
import { StockInOutBalanceRow, Medicine, DataIntegrityIssue } from '../types';
import { formatDateVN } from '../utils/helpers';
import { exportStockInOutBalanceExcel } from '../services/excelService';
import { printStockBalanceA4, exportStockBalanceWordA4 } from '../services/printA4Service';
import { StockDisposalModal } from './StockDisposalModal';
import { ReportSignerConfigModal } from './ReportSignerConfigModal';

export const StockBalanceComponent: React.FC = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [settings, setSettings] = useState(db.getSettings());

  // Modals for Disposal & Signer Config
  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [showSignerModal, setShowSignerModal] = useState(false);

  // Filter criteria
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('all');
  const [batchSearch, setBatchSearch] = useState<string>('');

  // Expired Batches for quick alert
  const expiredBatches = useMemo(() => db.getExpiredBatchesWithDetails(), [medicines]);
  const expiredCount = expiredBatches.length;
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Integrity Check State
  const [integrityIssues, setIntegrityIssues] = useState<DataIntegrityIssue[]>([]);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);

  const loadInitial = () => {
    setMedicines(db.getMedicines());
    setSettings(db.getSettings());
    setIntegrityIssues(db.checkDataIntegrity());
  };

  useEffect(() => {
    loadInitial();
    const unsub = db.subscribe(loadInitial);
    return unsub;
  }, []);

  // Set quick date ranges
  const setQuickRange = (type: 'this_month' | 'this_quarter' | 'school_year' | 'all') => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (type === 'this_month') {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const end = now.toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (type === 'this_quarter') {
      const quarter = Math.floor(month / 3);
      const qStartMonth = quarter * 3 + 1;
      const start = `${year}-${String(qStartMonth).padStart(2, '0')}-01`;
      const end = now.toISOString().split('T')[0];
      setStartDate(start);
      setEndDate(end);
    } else if (type === 'school_year') {
      // Vietnam school year starts September 1
      const startYear = month >= 8 ? year : year - 1;
      setStartDate(`${startYear}-09-01`);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Generate rows
  const reportRows: StockInOutBalanceRow[] = useMemo(() => {
    return db.getStockInOutReport({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      medicineId: selectedMedicineId !== 'all' ? selectedMedicineId : undefined,
      batchNumber: batchSearch.trim() || undefined,
    });
  }, [startDate, endDate, selectedMedicineId, batchSearch, medicines]);

  // Totals summary
  const totals = useMemo(() => {
    const opening = reportRows.reduce((s, r) => s + r.openingStock, 0);
    const imports = reportRows.reduce((s, r) => s + r.importQuantity, 0);
    const exports = reportRows.reduce((s, r) => s + r.exportQuantity, 0);
    const adj = reportRows.reduce((s, r) => s + r.adjustmentQuantity, 0);
    const closing = reportRows.reduce((s, r) => s + r.closingStock, 0);
    return { opening, imports, exports, adj, closing, count: reportRows.length };
  }, [reportRows]);

  const periodLabel = startDate && endDate
    ? `Từ ngày ${formatDateVN(startDate)} đến ngày ${formatDateVN(endDate)}`
    : startDate
    ? `Từ ngày ${formatDateVN(startDate)} đến nay`
    : endDate
    ? `Đến ngày ${formatDateVN(endDate)}`
    : 'Toàn bộ thời gian hoạt động';

  const handleExportExcel = () => {
    exportStockInOutBalanceExcel(reportRows, periodLabel, settings.schoolName);
  };

  const handlePrintA4 = () => {
    printStockBalanceA4(reportRows, periodLabel, settings.schoolName);
  };

  const handleExportWord = () => {
    exportStockBalanceWordA4(reportRows, periodLabel, settings.schoolName);
  };

  const handleCheckIntegrity = () => {
    const issues = db.checkDataIntegrity();
    setIntegrityIssues(issues);
    setFixMessage(null);
    setShowIntegrityModal(true);
  };

  const handleAutoFixIntegrity = () => {
    const res = db.autoFixDataIntegrity();
    setFixMessage(res.message);
    setIntegrityIssues(db.checkDataIntegrity());
  };

  return (
    <div id="stock-balance-module" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Sổ Theo Dõi Nhập – Xuất – Tồn Kho
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Báo cáo lưu trữ hồ sơ y tế học đường, quản lý biến động theo từng số lô và hạn dùng
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Button Kiểm Tra Hết Hạn & Tiêu Hủy */}
          <button
            id="btn-disposal-modal"
            onClick={() => setShowDisposalModal(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              expiredCount > 0
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Kiểm tra các lô thuốc hết hạn, cận hạn và lập biên bản tiêu hủy"
          >
            <ShieldAlert className={`w-4 h-4 ${expiredCount > 0 ? 'text-rose-600' : 'text-slate-500'}`} />
            <span>Kiểm tra hết hạn & Tiêu hủy</span>
            {expiredCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-rose-600 text-white rounded-full font-bold animate-pulse">
                {expiredCount} lô
              </span>
            )}
          </button>

          {/* Button Tùy Chỉnh Người Ký */}
          <button
            id="btn-signer-config"
            onClick={() => setShowSignerModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tùy chỉnh chức danh, họ tên người ký báo cáo và cơ quan ban hành"
          >
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>Người ký & Tiêu đề</span>
          </button>

          <button
            id="btn-check-integrity"
            onClick={handleCheckIntegrity}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              integrityIssues.length > 0
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Kiểm tra toàn vẹn
            {integrityIssues.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-200 text-amber-900 rounded-full font-bold">
                {integrityIssues.length}
              </span>
            )}
          </button>

          <button
            id="btn-print-stock-balance"
            onClick={handlePrintA4}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            In Mẫu Sổ A4
          </button>

          <button
            id="btn-word-stock-balance"
            onClick={handleExportWord}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            title="Xuất sang file Microsoft Word (.doc) để chỉnh sửa và lưu trữ hồ sơ"
          >
            <FileText className="w-4 h-4" />
            Xuất Word (.doc)
          </button>

          <button
            id="btn-excel-stock-balance"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Quick Filters and Period Selection */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick period buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1">Kỳ nhanh:</span>
            <button
              onClick={() => setQuickRange('this_month')}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Tháng này
            </button>
            <button
              onClick={() => setQuickRange('this_quarter')}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Quý này
            </button>
            <button
              onClick={() => setQuickRange('school_year')}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Năm học này
            </button>
            <button
              onClick={() => setQuickRange('all')}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Toàn bộ
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Kỳ báo cáo: <strong className="text-slate-800">{periodLabel}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Từ ngày</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Đến ngày</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mặt hàng thuốc</label>
            <select
              value={selectedMedicineId}
              onChange={(e) => setSelectedMedicineId(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
            >
              <option value="all">Tất cả thuốc ({medicines.length})</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Lọc theo số lô</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Nhập số lô..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Số lô theo dõi</div>
          <div className="text-lg font-bold text-slate-900 mt-1">{totals.count}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Lô thuốc trong kỳ</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Tồn đầu kỳ</div>
          <div className="text-lg font-bold text-slate-800 mt-1">{totals.opening}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Đơn vị cơ bản</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Nhập trong kỳ
          </div>
          <div className="text-lg font-bold text-emerald-700 mt-1">+{totals.imports}</div>
          <div className="text-[11px] text-emerald-600/70 mt-0.5">Số lượng bổ sung</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-red-600 font-medium flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            Xuất trong kỳ
          </div>
          <div className="text-lg font-bold text-red-700 mt-1">-{totals.exports}</div>
          <div className="text-[11px] text-red-600/70 mt-0.5">Cấp phát sử dụng</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-purple-600 font-medium flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />
            Điều chỉnh kiểm kê
          </div>
          <div className="text-lg font-bold text-purple-700 mt-1">
            {totals.adj !== 0 ? (totals.adj > 0 ? '+' + totals.adj : totals.adj) : '0'}
          </div>
          <div className="text-[11px] text-purple-600/70 mt-0.5">Cân bằng thực tế</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs bg-slate-50/50">
          <div className="text-xs text-sky-700 font-medium flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            Tồn cuối kỳ
          </div>
          <div className="text-lg font-bold text-sky-800 mt-1">{totals.closing}</div>
          <div className="text-[11px] text-sky-700/70 mt-0.5">Số lượng thực có</div>
        </div>
      </div>

      {/* Main Stock Balance Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <span>BẢNG CHI TIẾT SỔ NHẬP - XUẤT - TỒN THEO TỪNG LÔ THUỐC</span>
            <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded-full font-medium">
              {reportRows.length} mục
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                <th className="py-2.5 px-3 text-center w-12">STT</th>
                <th className="py-2.5 px-3 w-24">Mã thuốc</th>
                <th className="py-2.5 px-3 min-w-[180px]">Tên thuốc, nồng độ</th>
                <th className="py-2.5 px-3 w-28">Số lô</th>
                <th className="py-2.5 px-3 w-24 text-center">Hạn dùng</th>
                <th className="py-2.5 px-3 text-center w-16">ĐVT</th>
                <th className="py-2.5 px-3 text-right w-20">Tồn đầu</th>
                <th className="py-2.5 px-3 text-right w-20 text-emerald-700">Nhập (+)</th>
                <th className="py-2.5 px-3 text-right w-20 text-red-700">Xuất (-)</th>
                <th className="py-2.5 px-3 text-right w-20 text-purple-700">Điều chỉnh</th>
                <th className="py-2.5 px-3 text-right w-24 bg-slate-100 font-bold text-slate-900">
                  Tồn cuối
                </th>
                <th className="py-2.5 px-3 min-w-[120px]">Vị trí lưu trữ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400">
                    Không tìm thấy dữ liệu phát sinh trong kỳ đã chọn.
                  </td>
                </tr>
              ) : (
                reportRows.map((r, i) => {
                  const isExpSoon =
                    new Date(r.expDate).getTime() - new Date().getTime() <= 30 * 86400000 &&
                    new Date(r.expDate).getTime() >= new Date().getTime();
                  const isExpired = new Date(r.expDate).getTime() < new Date().getTime();

                  return (
                    <tr key={r.id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-sky-700">{r.medicineCode}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{r.medicineName}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{r.batchNumber}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            isExpired
                              ? 'bg-red-100 text-red-800 font-bold'
                              : isExpSoon
                              ? 'bg-amber-100 text-amber-800'
                              : 'text-slate-700'
                          }`}
                        >
                          {formatDateVN(r.expDate)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{r.unit}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                        {r.openingStock}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                        {r.importQuantity > 0 ? '+' + r.importQuantity : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-red-700">
                        {r.exportQuantity > 0 ? '-' + r.exportQuantity : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-purple-700">
                        {r.adjustmentQuantity !== 0
                          ? r.adjustmentQuantity > 0
                            ? '+' + r.adjustmentQuantity
                            : r.adjustmentQuantity
                          : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 bg-slate-50">
                        {r.closingStock}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs">
                        {r.notes || 'Tủ thuốc y tế'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800">
                <td colSpan={6} className="py-2.5 px-3 text-center uppercase tracking-wide">
                  Tổng cộng ({reportRows.length} lô)
                </td>
                <td className="py-2.5 px-3 text-right">{totals.opening}</td>
                <td className="py-2.5 px-3 text-right text-emerald-800">+{totals.imports}</td>
                <td className="py-2.5 px-3 text-right text-red-800">-{totals.exports}</td>
                <td className="py-2.5 px-3 text-right text-purple-800">
                  {totals.adj !== 0 ? (totals.adj > 0 ? '+' + totals.adj : totals.adj) : '0'}
                </td>
                <td className="py-2.5 px-3 text-right text-sky-900 bg-slate-200">
                  {totals.closing}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal: Data Integrity Diagnostic & Auto-Fix */}
      {showIntegrityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Kiểm Tra Tính Toàn Vẹn & Khớp Số Liệu Kho
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phát hiện các bất thường như tồn kho âm, lệch tổng tồn thuốc so với tổng lô
                  </p>
                </div>
              </div>
            </div>

            {fixMessage && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {fixMessage}
              </div>
            )}

            {integrityIssues.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-bold text-emerald-900 text-sm">
                  Dữ Liệu Hoàn Toàn Chính Xác & Toàn Vẹn
                </div>
                <p className="text-xs text-emerald-700">
                  Không phát hiện bất kỳ tồn âm, số lô trống, sai hạn dùng hay sai lệch số đếm nào trong hệ thống.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Phát hiện {integrityIssues.length} vấn đề cần lưu ý:</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {integrityIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border text-xs ${
                        issue.severity === 'error'
                          ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{issue.medicineName || 'Toàn hệ thống'} {issue.batchNumber ? `(Lô ${issue.batchNumber})` : ''}</span>
                        <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-white font-semibold">
                          {issue.type}
                        </span>
                      </div>
                      <p className="mt-1">{issue.description}</p>
                      <p className="text-[11px] mt-0.5 opacity-80">Khuyến nghị: {issue.suggestedAction}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleAutoFixIntegrity}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Wrench className="w-4 h-4" />
                Tự Động Đồng Bộ & Chuẩn Hóa Lại Số Liệu
              </button>
              <button
                type="button"
                onClick={() => setShowIntegrityModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Disposal & Expired Checks Modal */}
      {showDisposalModal && (
        <StockDisposalModal
          onClose={() => setShowDisposalModal(false)}
          onSuccess={() => {
            loadInitial();
          }}
        />
      )}

      {/* Report Signer & Title Customization Modal */}
      {showSignerModal && (
        <ReportSignerConfigModal
          onClose={() => setShowSignerModal(false)}
          onSaved={() => {
            loadInitial();
          }}
        />
      )}
    </div>
  );
};
