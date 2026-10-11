import React, { useState } from 'react';
import {
  Pill,
  Boxes,
  BriefcaseMedical,
  AlertTriangle,
  ClockAlert,
  Flame,
  Activity,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ExternalLink,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Stethoscope,
  Users,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { db, formatDateVN, getDaysRemaining, maskStudentName } from '../services/db';
import { NavTab } from './Sidebar';
import { MedicineBatch, Medicine } from '../types';

interface DashboardProps {
  onNavigate: (tab: any, filter?: string) => void;
  onQuickAction?: (action: 'add_medicine' | 'import' | 'export' | 'stock' | 'print') => void;
  onOpenAddMedicine?: () => void;
  onOpenImport?: () => void;
  onOpenExport?: () => void;
  onViewAlertDetails?: (type: 'expired' | 'expiring_soon' | 'low_stock') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onQuickAction,
  onOpenAddMedicine,
  onOpenImport,
  onOpenExport,
  onViewAlertDetails,
}) => {
  const [, setDbTick] = useState(0);
  React.useEffect(() => {
    const unsub = db.subscribe(() => setDbTick((t) => t + 1));
    return () => unsub();
  }, []);

  const canManageClinicVisits = db.hasPermission('canManageClinicVisits');
  const canManageStudents = db.hasPermission('canManageStudents');
  const canManageMedicine = db.hasPermission('canManageMedicine');
  const canManageTransactions = db.hasPermission('canManageTransactions');
  const canManageInventoryCheck = db.hasPermission('canManageInventoryCheck');
  const canViewReports = db.hasPermission('canViewReports');

  const metrics = db.getDashboardMetrics();
  const medicines = db.getMedicines();
  const recentTransactions = db.getTransactions().slice(0, 5);
  const todayVisits = db.getTodayClinicVisits();

  // Detail Modal for Alert Cards
  const [activeAlertModal, setActiveAlertModal] = useState<
    'expired' | 'expiring_soon' | 'low_stock' | null
  >(null);

  // Quick Guide for first-time teachers and medical staff
  const [showQuickGuide, setShowQuickGuide] = useState(() => {
    return localStorage.getItem('hide_school_health_guide') !== 'true';
  });

  // Expired batches with medicine name
  const expiredItems = metrics.expiredBatches.map((batch) => {
    const med = medicines.find((m) => m.id === batch.medicineId);
    return {
      batch,
      medicine: med,
      days: getDaysRemaining(batch.expDate),
    };
  });

  // Expiring soon batches
  const expiringSoonItems = metrics.expiringSoonBatches.map((batch) => {
    const med = medicines.find((m) => m.id === batch.medicineId);
    return {
      batch,
      medicine: med,
      days: getDaysRemaining(batch.expDate),
    };
  });

  // Low stock items
  const lowStockItems = metrics.lowStockMedicines;

  // Chart data
  const monthlyTrendsData = metrics.monthlyTrends || [
    { month: 'T10', imports: 4, exports: 12 },
    { month: 'T11', imports: 6, exports: 18 },
    { month: 'T12', imports: 3, exports: 15 },
    { month: 'T01', imports: 8, exports: 22 },
    { month: 'T02', imports: 5, exports: 19 },
    { month: 'T03', imports: 12, exports: 28 },
  ];

  const expiryPieData = [
    { name: 'An toàn (>30 ngày)', value: metrics.expiryBreakdown?.safe || Math.max(0, metrics.totalBatches - metrics.expiredCount - metrics.expiringSoonCount), color: '#10b981' },
    { name: 'Sắp hết hạn (≤30 ngày)', value: metrics.expiringSoonCount, color: '#f59e0b' },
    { name: 'Đã hết hạn', value: metrics.expiredCount, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome & Quick Actions Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-blue-800 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            <span>PHÒNG Y TẾ • TRƯỜNG THCS ĐÔNG THẠNH</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Quản Lý Thuốc & Y Tế Học Sinh
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Hệ thống quản lý trực quan: Theo dõi kho thuốc theo từng số lô, hạn dùng FEFO và hồ sơ chăm sóc sức khỏe học sinh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageTransactions && (
            <>
              <button
                id="btn-dash-import"
                type="button"
                onClick={() => onNavigate('import_medicine')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold hover:bg-blue-700 shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <ArrowDownLeft className="w-4 h-4 shrink-0" />
                <span>+ NHẬP THUỐC</span>
              </button>
              <button
                id="btn-dash-export"
                type="button"
                onClick={() => onNavigate('export_medicine')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-xs sm:text-sm font-bold hover:bg-orange-600 shadow-xs transition-all cursor-pointer active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4 shrink-0" />
                <span>XUẤT CẤP PHÁT</span>
              </button>
              <button
                id="btn-dash-stock-balance"
                type="button"
                onClick={() => onNavigate('stock_balance')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-50 text-pink-800 text-xs sm:text-sm font-bold hover:bg-pink-100 border border-pink-200 shadow-2xs transition-all cursor-pointer active:scale-95"
              >
                <BookOpen className="w-4 h-4 shrink-0 text-pink-700" />
                <span>SỔ NHẬP - XUẤT - TỒN</span>
              </button>
            </>
          )}
          {canManageInventoryCheck && (
            <button
              id="btn-dash-inventory-check"
              type="button"
              onClick={() => onNavigate('inventory_check')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 text-purple-800 text-xs sm:text-sm font-bold hover:bg-purple-100 border border-purple-200 shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <ClipboardCheck className="w-4 h-4 shrink-0 text-purple-700" />
              <span>KIỂM KÊ KHO</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Question User Guide / Quy trình sử dụng cho người mới */}
      {showQuickGuide ? (
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-5 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-xs font-black">
                ?
              </span>
              <h3 className="font-bold text-slate-900 text-sm">
                Hướng Dẫn Sử Dụng Nhanh • Dành Cho Cán Bộ Y Tế & Thầy/Cô Mới
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowQuickGuide(false);
                localStorage.setItem('hide_school_health_guide', 'true');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1 rounded-lg hover:bg-emerald-100/60 transition-colors cursor-pointer"
            >
              Đã hiểu, thu gọn ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. App dùng để làm gì? */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-1 shadow-2xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-black shrink-0">1</span>
                <span>Ứng dụng dùng để làm gì?</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Quản lý học sinh đến khám/sơ cứu, theo dõi tồn kho thuốc theo số lô và hạn dùng (FEFO), tự động xuất sổ sách, mẫu in A4 chuẩn Bộ GD&ĐT & BYT.
              </p>
            </div>

            {/* 2. Cần nhập gì? */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-1 shadow-2xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-black shrink-0">2</span>
                <span>Cần nhập những gì?</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                • <strong>Hàng ngày:</strong> Nhập ca khám học sinh (triệu chứng, xử trí, cấp thuốc).<br/>
                • <strong>Khi mua/nhận:</strong> Nhập thuốc & vật tư mới vào tủ y tế.
              </p>
            </div>

            {/* 3. Phải bấm ở đâu? */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-1 shadow-2xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-black shrink-0">3</span>
                <span>Thao tác bấm ở đâu?</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                • Bấm <strong>"TIẾP NHẬN Y TẾ"</strong> bên dưới để tạo ca khám (trừ kho FEFO).<br/>
                • Bấm <strong>"+ NHẬP THUỐC"</strong> góc phải để bổ sung cơ số kho.
              </p>
            </div>

            {/* 4. Kết quả xem ở đâu? */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-100 space-y-1 shadow-2xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px] font-black shrink-0">4</span>
                <span>Kết quả & Sổ sách ở đâu?</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Vào <strong>"Sổ phòng y tế"</strong> xem lịch sử ca khám; vào <strong>"Sổ Nhập-Xuất-Tồn"</strong> & <strong>"Mẫu In Sổ A4"</strong> để in hoặc xuất file Word/Excel.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setShowQuickGuide(true);
              localStorage.removeItem('hide_school_health_guide');
            }}
            className="text-xs text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Xem lại hướng dẫn nhanh 4 bước</span>
          </button>
        </div>
      )}

      {/* STUDENT HEALTH CLINIC HUB */}
      {(canManageClinicVisits || canManageStudents || canViewReports) && (
        <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white p-6 sm:p-7 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Nghiệp vụ thường trực
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                  Tiếp Nhận Sơ Cứu & Chăm Sóc Sức Khỏe Học Sinh
                </h3>
              </div>
            </div>

            <p className="text-xs text-emerald-100/90 font-medium">
              Tự động liên kết: Hồ sơ học sinh ⇄ Tiếp nhận khám ⇄ Cấp phát trừ kho FEFO
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {canManageClinicVisits && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('clinic_reception')}
                  className="p-4 bg-white/10 hover:bg-white/15 backdrop-blur-xs rounded-xl text-left border border-white/10 hover:border-emerald-400/40 transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">TIẾP NHẬN Y TẾ</span>
                    <Stethoscope className="w-4 h-4 text-emerald-300 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-sm font-bold text-white mt-2.5">Sơ cứu & Cấp thuốc</p>
                  <span className="text-xs text-emerald-200 mt-1 font-medium">Tạo lượt khám mới →</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('clinic_visits')}
                  className="p-4 bg-white/10 hover:bg-white/15 backdrop-blur-xs rounded-xl text-left border border-white/10 hover:border-purple-400/40 transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300">SỔ PHÒNG Y TẾ</span>
                    <BookOpen className="w-4 h-4 text-purple-300 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-sm font-bold text-white mt-2.5">Sổ theo dõi tiếp nhận</p>
                  <span className="text-xs text-purple-200 mt-1 font-medium">Tra cứu ca sơ cứu →</span>
                </button>
              </>
            )}

            {canManageStudents && (
              <button
                type="button"
                onClick={() => onNavigate('students')}
                className="p-4 bg-white/10 hover:bg-white/15 backdrop-blur-xs rounded-xl text-left border border-white/10 hover:border-blue-400/40 transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300">HỒ SƠ HỌC SINH</span>
                  <Users className="w-4 h-4 text-blue-300 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-sm font-bold text-white mt-2.5">Tiền sử & Dị ứng</p>
                <span className="text-xs text-blue-200 mt-1 font-medium">Cảnh báo dị ứng →</span>
              </button>
            )}

            {canViewReports && (
              <button
                type="button"
                onClick={() => onNavigate('comprehensive_reports')}
                className="p-4 bg-white/10 hover:bg-white/15 backdrop-blur-xs rounded-xl text-left border border-white/10 hover:border-amber-400/40 transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">BÁO CÁO Y TẾ</span>
                  <BarChart3 className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-sm font-bold text-white mt-2.5">Báo cáo & Thống kê</p>
                <span className="text-xs text-amber-200 mt-1 font-medium">Xuất mẫu A4 & Excel →</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3 Prominent High-Priority Alert Banners */}
      {canManageMedicine && (
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <span>Cảnh Báo Dược Phẩm Khẩn Cấp (Nhấn vào thẻ để xử lý ngay)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 🔴 RED: THUỐC ĐÃ HẾT HẠN */}
          <div
            id="alert-box-expired"
            onClick={() => setActiveAlertModal('expired')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              metrics.expiredCount > 0
                ? 'bg-rose-50/80 border-rose-300 hover:border-rose-400 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    metrics.expiredCount > 0
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-rose-900 tracking-wide">
                    THUỐC ĐÃ HẾT HẠN
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">Cách ly & lập biên bản hủy</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  metrics.expiredCount > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {metrics.expiredCount} Lô
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-rose-200/80 flex items-center justify-between text-xs">
              <span className="text-rose-800 font-semibold">
                {metrics.expiredCount > 0
                  ? 'Cần xử lý niêm phong ngay'
                  : 'Kho an toàn, không có thuốc quá hạn'}
              </span>
              <span className="inline-flex items-center gap-1 text-rose-700 font-bold hover:underline">
                <span>Xem chi tiết</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 🟠 ORANGE: THUỐC SẮP HẾT HẠN */}
          <div
            id="alert-box-expiring"
            onClick={() => setActiveAlertModal('expiring_soon')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              metrics.expiringSoonCount > 0
                ? 'bg-orange-50/80 border-orange-300 hover:border-orange-400 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    metrics.expiringSoonCount > 0
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <ClockAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-orange-900 tracking-wide">
                    THUỐC SẮP HẾT HẠN
                  </h4>
                  <p className="text-xs text-orange-700 mt-0.5">Hạn dùng dưới 30 ngày</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  metrics.expiringSoonCount > 0
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {metrics.expiringSoonCount} Lô
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-orange-200/80 flex items-center justify-between text-xs">
              <span className="text-orange-800 font-semibold">
                {metrics.expiringSoonCount > 0
                  ? 'Ưu tiên xuất dùng trước (FEFO)'
                  : 'Hạn sử dụng đều trên 30 ngày'}
              </span>
              <span className="inline-flex items-center gap-1 text-orange-700 font-bold hover:underline">
                <span>Xem chi tiết</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {/* 🟡 YELLOW: THUỐC SẮP HẾT */}
          <div
            id="alert-box-lowstock"
            onClick={() => setActiveAlertModal('low_stock')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer ${
              metrics.lowStockCount > 0
                ? 'bg-amber-50/80 border-amber-300 hover:border-amber-400 shadow-xs'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                    metrics.lowStockCount > 0
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-900 tracking-wide">
                    THUỐC SẮP HẾT
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">Dưới mức tồn an toàn</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  metrics.lowStockCount > 0
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {metrics.lowStockCount} Loại
              </span>
            </div>
            <div className="mt-4 pt-3 border-t border-amber-200/80 flex items-center justify-between text-xs">
              <span className="text-amber-800 font-semibold">
                {metrics.lowStockCount > 0
                  ? 'Cần lập dự trù nhập bổ sung'
                  : 'Tồn kho đảm bảo mức tối thiểu'}
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-bold hover:underline">
                <span>Xem chi tiết</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 8 Statistics Cards (II. Trang Dashboard) */}
      {(canManageMedicine || canViewReports) && (
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {canManageMedicine && (
          <>
        {/* 1. Tổng số loại thuốc */}
        <div
          onClick={() => onNavigate('medicines')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng số loại thuốc</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {metrics.totalMedicineTypes}
            </span>
            <span className="text-xs text-slate-500">mặt hàng</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-1 font-medium">Thuốc y tế thiết yếu</p>
        </div>

        {/* 2. Tổng số lượng thuốc hiện có */}
        <div
          onClick={() => onNavigate('stock')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng lượng thuốc tồn</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {metrics.totalMedicineStock.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">đơn vị tính</span>
          </div>
          <p className="text-[11px] text-blue-700 mt-1 font-medium">Trong các tủ thuốc phòng YT</p>
        </div>
          </>
        )}

        {/* 3. Tổng số vật tư y tế */}
        {canViewReports && (
        <div
          onClick={() => onNavigate('supplies')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Vật tư y tế</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <BriefcaseMedical className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {metrics.totalSuppliesCount}
            </span>
            <span className="text-xs text-slate-500">loại ({metrics.totalMedicalSupplies} cái)</span>
          </div>
          <p className="text-[11px] text-teal-700 mt-1 font-medium">Băng gạc, sát khuẩn, nhiệt kế</p>
        </div>
        )}

        {canManageMedicine && (
          <>
        {/* 4. Tổng số lượng tồn kho */}
        <div
          onClick={() => onNavigate('stock')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tổng số lượng tồn kho</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-900">
              {db.getBatches().reduce((s, b) => s + (b.quantity || 0), 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-700">đơn vị</span>
          </div>
          <p className="text-[11px] text-emerald-700 mt-1 font-medium">Toàn bộ thuốc trong tủ y tế</p>
        </div>

        {/* 5. Thuốc sắp hết */}
        <div
          onClick={() => onNavigate('low_stock')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Thuốc sắp hết</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-amber-700">
              {metrics.lowStockCount}
            </span>
            <span className="text-xs text-slate-500">loại cần bổ sung</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">≤ Mức tồn tối thiểu</p>
        </div>

        {/* 6. Thuốc sắp hết hạn */}
        <div
          onClick={() => onNavigate('expiry_tracking')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-orange-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Thuốc sắp hết hạn</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <ClockAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-orange-700">
              {metrics.expiringSoonCount}
            </span>
            <span className="text-xs text-slate-500">lô (≤ 30 ngày)</span>
          </div>
          <p className="text-[11px] text-orange-700 mt-1 font-medium">Cần ưu tiên cấp phát FEFO</p>
        </div>

        {/* 7. Thuốc đã hết hạn */}
        <div
          onClick={() => onNavigate('expiry_tracking')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Thuốc đã hết hạn</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-rose-700">
              {metrics.expiredCount}
            </span>
            <span className="text-xs text-slate-500">lô quá hạn</span>
          </div>
          <p className="text-[11px] text-rose-700 mt-1 font-medium">Nghiêm cấm cấp phát</p>
        </div>
          </>
        )}

        {/* 8. Lượt cấp phát trong tháng */}
        {canViewReports && (
        <div
          onClick={() => onNavigate('usage_book')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Lượt cấp phát tháng này</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-indigo-900">
              {metrics.monthlyUsageCount}
            </span>
            <span className="text-xs text-slate-500">lượt HS / GV</span>
          </div>
          <p className="text-[11px] text-indigo-700 mt-1 font-medium">Ghi nhận vào sổ sử dụng</p>
        </div>
        )}
      </div>
      )}

      {/* Danh Sách Ca Bệnh Trong Ngày Tại Phòng Y Tế */}
      <div className="bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-5 bg-blue-50/70 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Ca Bệnh Trong Ngày Tại Phòng Y Tế
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500 text-white shadow-2xs">
                  {todayVisits.length} ca thực tế
                </span>
                {todayVisits.length > 0 && (
                  <span className="text-xs font-semibold text-blue-800">
                    • Ngày {formatDateVN(todayVisits[0].visitDate)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Cập nhật và đồng bộ trực tiếp giữa máy ở nhà và máy ở trường theo thời gian thực
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManageClinicVisits && (
              <button
                type="button"
                onClick={() => onNavigate('clinic_reception')}
                className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                + Tiếp nhận ca mới
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('clinic_visits')}
              className="px-3.5 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-pink-600" />
              <span>Mở Sổ phòng y tế</span>
            </button>
          </div>
        </div>

        {todayVisits.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Chưa có ca bệnh nào được ghi nhận trong ngày. Nhấn <strong>&ldquo;+ Tiếp nhận ca mới&rdquo;</strong> để ghi nhận học sinh đến phòng y tế.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Mã ca / Thời gian</th>
                  <th className="py-2.5 px-4">Họ và tên học sinh</th>
                  <th className="py-2.5 px-4">Lớp</th>
                  <th className="py-2.5 px-4">Lý do & Tình trạng</th>
                  <th className="py-2.5 px-4">Xử trí & Thuốc cấp</th>
                  <th className="py-2.5 px-4">Kết quả & Bàn giao</th>
                  <th className="py-2.5 px-4">Cán bộ Y tế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todayVisits.map((v) => {
                  const meds = v.medicinesUsed || v.medicinesDispensed || [];
                  const reasonText =
                    (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason) ||
                    v.reason ||
                    'Khám y tế';
                  return (
                    <tr
                      key={v.id}
                      onClick={() => onNavigate('clinic_visits')}
                      className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-800 block">{v.visitCode}</span>
                        <span className="text-[11px] text-slate-500">
                          {v.timeIn || '08:00'}
                          {v.timeOut ? ` - ${v.timeOut}` : ''} • {formatDateVN(v.visitDate)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className="font-bold text-slate-900 block"
                          title={db.isPrivacyModeEnabled() ? 'Đang bật bảo mật ẩn tên' : v.studentName}
                        >
                          {maskStudentName(v.studentName, db.isPrivacyModeEnabled())}
                        </span>
                        {v.studentCode && (
                          <span className="text-[10px] font-mono text-slate-500">Mã HS: {v.studentCode}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-800 whitespace-nowrap">
                        Lớp {v.className}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-rose-700 block">{reasonText}</span>
                        {v.initialCondition && (
                          <span className="text-[11px] text-slate-600 block">{v.initialCondition}</span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {v.vitals?.temperature ? `Nhiệt độ: ${v.vitals.temperature}°C` : ''}
                          {v.vitals?.weight ? ` • Cân nặng: ${v.vitals.weight}kg` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {v.treatmentDetails || v.treatmentType || v.treatment || 'Nghỉ ngơi, theo dõi'}
                        </span>
                        {meds.length > 0 ? (
                          <span className="text-[11px] font-bold text-emerald-700 block mt-0.5">
                            Thuốc: {meds.map((m) => `${m.medicineName} (${m.quantity} ${m.unit})`).join(', ')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Không cấp thuốc</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900">
                          {v.outcome || 'Đã ổn định'}
                        </span>
                        {v.parentContacted && (
                          <span className="block text-[10px] text-blue-700 font-semibold mt-0.5">
                            ✓ Đã báo phụ huynh
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {v.performer || 'Nhân viên Y tế'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recharts Visual Analytics Section */}
      {(canManageTransactions || canManageMedicine || canManageInventoryCheck) && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Monthly Trend Bar Chart */}
        {canManageTransactions && (
        <div className={`${canManageMedicine || canManageInventoryCheck ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Biến Động Xuất – Nhập Thuốc Qua Các Tháng
                  </h3>
                  <p className="text-xs text-slate-500">
                    Theo dõi số lượt giao dịch phát sinh trong năm học
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('stock_balance')}
                className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Mở Sổ Nhập - Xuất - Tồn</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      `${val} lượt`,
                      name === 'imports' ? 'Lượt nhập kho' : 'Lượt xuất cấp phát',
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    formatter={(val) => (
                      <span className="text-xs text-slate-600 font-medium">
                        {val === 'imports' ? 'Nhập kho (+)' : 'Xuất dùng (-)'}
                      </span>
                    )}
                  />
                  <Bar dataKey="imports" name="imports" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="exports" name="exports" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Dữ liệu thực tế đối chiếu từ Sổ Nhập - Xuất - Tồn</span>
            <span className="text-emerald-700 font-medium">Tự động đồng bộ</span>
          </div>
        </div>
        )}

        {/* Right: Expiry Structure Pie Chart */}
        {(canManageMedicine || canManageInventoryCheck) && (
        <div className={`${canManageTransactions ? 'lg:col-span-4' : 'lg:col-span-12'} bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg">
                <PieChartIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cơ Cấu Tình Trạng Hạn Dùng
                </h3>
                <p className="text-xs text-slate-500">
                  Phân loại an toàn trên {metrics.totalBatches} lô
                </p>
              </div>
            </div>

            <div className="h-56 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expiryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {expiryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val} lô`, 'Số lượng']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-900">{metrics.totalBatches}</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase">Tổng lô</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              {expiryPieData.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></span>
                    <span className="text-slate-600">{entry.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{entry.value} lô</span>
                </div>
              ))}
            </div>
          </div>

          {canManageInventoryCheck && (
            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => onNavigate('inventory_check')}
                className="text-purple-700 font-bold hover:underline flex items-center gap-1"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Biên bản kiểm kê kho →</span>
              </button>
            </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Tables Section: FEFO Priority Queue & Recent Transactions */}
      {(canManageMedicine || canManageTransactions) && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: FEFO Dispensing Priority Queue */}
        {canManageMedicine && (
        <div className={`${canManageTransactions ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white rounded-2xl p-5 border border-slate-200 shadow-xs`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClockAlert className="w-4 h-4 text-emerald-600" />
                <span>Hàng Đợi Xuất Thuốc Theo Nguyên Tắc FEFO</span>
              </h3>
              <p className="text-xs text-slate-500">
                Lô có hạn sử dụng gần nhất được hệ thống đề xuất xuất trước
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('medicines')}
              className="text-xs text-emerald-700 font-bold hover:underline"
            >
              Xem tất cả
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Tên thuốc</th>
                  <th className="py-2.5 px-3">Số lô</th>
                  <th className="py-2.5 px-3">Hạn sử dụng</th>
                  <th className="py-2.5 px-3 text-right">Lượng tồn</th>
                  <th className="py-2.5 px-3 text-center">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db
                  .getBatches()
                  .filter((b) => b.quantity > 0)
                  .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime())
                  .slice(0, 6)
                  .map((b) => {
                    const med = medicines.find((m) => m.id === b.medicineId);
                    const daysLeft = getDaysRemaining(b.expDate);
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {med?.name || '---'}
                          <span className="block text-[10px] font-normal text-slate-500">
                            {med?.dosageForm} ({med?.strength})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                          {b.batchNumber}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-900">
                            {formatDateVN(b.expDate)}
                          </span>
                          <span
                            className={`block text-[10px] font-bold ${
                              daysLeft < 0
                                ? 'text-rose-600'
                                : daysLeft <= 30
                                ? 'text-orange-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {daysLeft < 0
                              ? `Quá hạn ${Math.abs(daysLeft)} ngày`
                              : `Còn ${daysLeft} ngày`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {b.quantity} <span className="text-[10px] font-normal text-slate-500">{med?.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {daysLeft < 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                              Hết hạn
                            </span>
                          ) : daysLeft <= 30 ? (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                              Sắp hết hạn
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              An toàn
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Right: Recent Transactions */}
        {canManageTransactions && (
        <div className={`${canManageMedicine ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>Giao Dịch Nhập - Xuất Gần Đây</span>
                </h3>
                <p className="text-xs text-slate-500">Lịch sử phiếu đã lưu vào cơ sở dữ liệu</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('stock')}
                className="text-xs text-blue-700 font-bold hover:underline"
              >
                Chi tiết tồn
              </button>
            </div>

            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Chưa có giao dịch nào được tạo.
                </div>
              ) : (
                recentTransactions.map((tx) => {
                  const isImport = tx.type === 'import';
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isImport
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isImport ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {tx.transactionCode}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                isImport
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isImport ? 'Nhập kho' : 'Xuất dùng'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {isImport
                              ? `Nguồn: ${tx.source || 'Nhà cung cấp'}`
                              : `Cấp cho: ${tx.recipientName} (${tx.recipientClass || tx.recipientType})`}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Ngày: {formatDateVN(tx.date)} • {tx.items.length} mặt hàng
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900">
                          {tx.items.reduce((s, i) => s + (i.quantity || 0), 0).toLocaleString()} {tx.items[0]?.unit || 'đơn vị'}
                        </span>
                        <span className="block text-[10px] text-emerald-700 font-semibold">
                          Thành công
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Nhiệm vụ phụ trách: Nhân viên Y tế</span>
            {canViewReports && (
              <button
                type="button"
                onClick={() => onNavigate('usage_book')}
                className="text-emerald-700 font-bold hover:underline"
              >
                Mở Sổ theo dõi sử dụng →
              </button>
            )}
          </div>
        </div>
        )}
      </div>
      )}

      {/* Alert Detail Modal */}
      {activeAlertModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                {activeAlertModal === 'expired' && (
                  <>
                    <Flame className="w-5 h-5 text-rose-600" />
                    <h3 className="font-bold text-rose-900 text-sm">
                      DANH SÁCH THUỐC ĐÃ HẾT HẠN (🔴 CẦN TIÊU HỦY)
                    </h3>
                  </>
                )}
                {activeAlertModal === 'expiring_soon' && (
                  <>
                    <ClockAlert className="w-5 h-5 text-orange-600" />
                    <h3 className="font-bold text-orange-900 text-sm">
                      DANH SÁCH THUỐC SẮP HẾT HẠN (🟠 CÒN DƯỚI 30 NGÀY)
                    </h3>
                  </>
                )}
                {activeAlertModal === 'low_stock' && (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-amber-900 text-sm">
                      DANH SÁCH THUỐC SẮP HẾT (🟡 CẦN BỔ SUNG KHO)
                    </h3>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveAlertModal(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1"
              >
                ✕ Đóng
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              {activeAlertModal === 'expired' && (
                <>
                  <div className="p-3 bg-rose-50 text-rose-900 rounded-xl border border-rose-200">
                    <p className="font-bold">Quy định y tế học đường:</p>
                    <p>
                      Tuyệt đối không cấp phát thuốc đã hết hạn sử dụng cho học sinh, giáo viên.
                      Phải di chuyển vào ngăn cách ly và lập biên bản kiểm kê, tiêu hủy theo quy định.
                    </p>
                  </div>
                  {expiredItems.length === 0 ? (
                    <p className="text-center py-6 text-slate-500">
                      Không có thuốc nào bị hết hạn.
                    </p>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2">Tên thuốc</th>
                          <th className="p-2">Số lô</th>
                          <th className="p-2">Hạn sử dụng</th>
                          <th className="p-2 text-right">Số lượng tồn</th>
                          <th className="p-2">Vị trí lưu trữ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {expiredItems.map(({ batch, medicine, days }) => (
                          <tr key={batch.id} className="bg-rose-50/40">
                            <td className="p-2 font-bold text-rose-900">{medicine?.name}</td>
                            <td className="p-2 font-mono">{batch.batchNumber}</td>
                            <td className="p-2 text-rose-700 font-bold">
                              {formatDateVN(batch.expDate)} (Quá {Math.abs(days)} ngày)
                            </td>
                            <td className="p-2 text-right font-black text-rose-700">
                              {batch.quantity} {medicine?.unit}
                            </td>
                            <td className="p-2 text-slate-600">{batch.storageLocation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {activeAlertModal === 'expiring_soon' && (
                <>
                  <div className="p-3 bg-orange-50 text-orange-900 rounded-xl border border-orange-200">
                    <p className="font-bold">Đề xuất xử lý:</p>
                    <p>
                      Ưu tiên xuất dùng các lô thuốc này trước theo nguyên tắc FEFO. Nếu dự kiến
                      không dùng hết trước khi hết hạn, báo cáo y tế huyện để điều phối hoặc dự trù.
                    </p>
                  </div>
                  {expiringSoonItems.length === 0 ? (
                    <p className="text-center py-6 text-slate-500">
                      Tất cả thuốc đều còn hạn an toàn trên 30 ngày.
                    </p>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2">Tên thuốc</th>
                          <th className="p-2">Số lô</th>
                          <th className="p-2">Hạn dùng</th>
                          <th className="p-2">Còn lại</th>
                          <th className="p-2 text-right">Lượng tồn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {expiringSoonItems.map(({ batch, medicine, days }) => (
                          <tr key={batch.id} className="bg-orange-50/40">
                            <td className="p-2 font-bold text-orange-900">{medicine?.name}</td>
                            <td className="p-2 font-mono">{batch.batchNumber}</td>
                            <td className="p-2 font-semibold">{formatDateVN(batch.expDate)}</td>
                            <td className="p-2 text-orange-700 font-black">Còn {days} ngày</td>
                            <td className="p-2 text-right font-black">
                              {batch.quantity} {medicine?.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {activeAlertModal === 'low_stock' && (
                <>
                  <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200">
                    <p className="font-bold">Cảnh báo tồn kho an toàn:</p>
                    <p>
                      Các loại thuốc dưới đây đã chạm hoặc nhỏ hơn mức tồn tối thiểu cần thiết để
                      đáp ứng sơ cứu khẩn cấp cho học sinh trong trường.
                    </p>
                  </div>
                  {lowStockItems.length === 0 ? (
                    <p className="text-center py-6 text-slate-500">
                      Tất cả các thuốc đều đạt định mức tồn tối thiểu.
                    </p>
                  ) : (
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2">Mã thuốc</th>
                          <th className="p-2">Tên thuốc</th>
                          <th className="p-2 text-right">Tồn hiện tại</th>
                          <th className="p-2 text-right">Tồn tối thiểu</th>
                          <th className="p-2 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {lowStockItems.map((med) => (
                          <tr key={med.id} className="bg-amber-50/40">
                            <td className="p-2 font-mono">{med.code}</td>
                            <td className="p-2 font-bold text-amber-900">{med.name}</td>
                            <td className="p-2 text-right font-black text-amber-700">
                              {med.totalStock} {med.unit}
                            </td>
                            <td className="p-2 text-right text-slate-600">
                              {med.minStock} {med.unit}
                            </td>
                            <td className="p-2 text-center">
                              {canManageTransactions && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveAlertModal(null);
                                    onNavigate('import');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700"
                                >
                                  + Nhập bổ sung
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveAlertModal(null)}
                className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-xl text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
