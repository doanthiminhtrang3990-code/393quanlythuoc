import React, { useMemo, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Pill,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  ClockAlert,
  AlertTriangle,
  BriefcaseMedical,
  Truck,
  BarChart3,
  Settings,
  X,
  ShieldCheck,
  ClipboardCheck,
  Stethoscope,
  Users,
  Activity,
  Printer,
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
  HeartPulse,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { db, getRoleLabel } from '../services/db';

export type NavTab =
  | 'dashboard'
  | 'clinic_reception'
  | 'staff_dispense'
  | 'clinic_visits'
  | 'students'
  | 'school_health'
  | 'medicines'
  | 'import'
  | 'import_medicine'
  | 'export'
  | 'export_medicine'
  | 'stock_balance'
  | 'inventory_check'
  | 'usage_book'
  | 'stock'
  | 'stock_report'
  | 'expiry_tracking'
  | 'low_stock'
  | 'supplies'
  | 'suppliers'
  | 'reports'
  | 'comprehensive_reports'
  | 'medication_usage'
  | 'supply_usage'
  | 'print_templates'
  | 'audit_logs'
  | 'settings';

interface SidebarProps {
  currentTab?: string;
  activeTab?: string;
  onSelectTab: (tab: any) => void;
  isOpen?: boolean;
  isOpenMobile?: boolean;
  onClose?: () => void;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  metrics?: {
    expiredCount: number;
    expiringSoonCount: number;
    lowStockCount: number;
    totalMedicineTypes: number;
  };
}

const SidebarComponent: React.FC<SidebarProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  isOpen,
  isOpenMobile,
  onClose,
  onCloseMobile,
  onLogout,
  metrics: propsMetrics,
}) => {
  const current = activeTab || currentTab || 'dashboard';
  const open = isOpenMobile ?? isOpen ?? false;
  const handleClose = onCloseMobile || onClose || (() => {});

  const [dbTick, setDbTick] = useState(0);
  useEffect(() => {
    const unsub = db.subscribe(() => {
      setDbTick((t) => t + 1);
    });
    return () => unsub();
  }, []);

  const metrics = useMemo(() => propsMetrics || db.getDashboardMetrics(), [propsMetrics, dbTick]);
  const pendingChecks = useMemo(() => db.getInventoryChecks().filter((c) => c.status === 'draft').length, [dbTick]);
  const studentsCount = useMemo(() => db.getStudents().length, [dbTick]);
  const visitsToday = useMemo(() => {
    return db.getTodayClinicVisits().length;
  }, [dbTick]);

  const currentUser = useMemo(() => db.getCurrentUser(), [dbTick]);
  const rolePermissions = useMemo(() => db.getCurrentRolePermissions(), [dbTick]);

  // Desktop sidebar collapse state (allows shrinking sidebar so content is never squished or hidden)
  const [isCollapsedDesktop, setIsCollapsedDesktop] = useState(() => {
    try {
      return localStorage.getItem('thcs_sidebar_collapsed_desktop') === 'true';
    } catch {
      return false;
    }
  });

  const toggleDesktopCollapse = () => {
    setIsCollapsedDesktop((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('thcs_sidebar_collapsed_desktop', String(next));
      } catch {}
      return next;
    });
  };

  const rawSections = [
    {
      title: 'KHÁM & SỨC KHỎE HỌC SINH',
      items: [
        {
          id: 'dashboard',
          label: 'Trang chủ tổng quan',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'clinic_reception',
          label: 'Tiếp nhận khám sơ cứu',
          icon: Stethoscope,
          badge: visitsToday > 0 ? `${visitsToday} ca trong ngày` : '0 ca hôm nay',
          badgeColor: visitsToday > 0 ? 'bg-orange-100 text-orange-800 font-bold border border-orange-200' : 'bg-slate-100 text-slate-600',
        },
        {
          id: 'staff_dispense',
          label: 'Cho thuốc Giáo viên & CNV',
          icon: BriefcaseMedical,
          badge: 'GV & NV',
          badgeColor: 'bg-pink-100 text-pink-800 font-bold border border-pink-200',
        },
        {
          id: 'clinic_visits',
          label: 'Sổ theo dõi phòng y tế',
          icon: BookOpen,
          badge: visitsToday > 0 ? `${visitsToday} ca hôm nay` : null,
          badgeColor: 'bg-blue-100 text-blue-800 font-bold border border-blue-200',
        },
        {
          id: 'students',
          label: 'Hồ sơ sức khỏe học sinh',
          icon: Users,
          badge: `${studentsCount} HS`,
          badgeColor: 'bg-blue-100 text-blue-800 border border-blue-200',
        },
        {
          id: 'school_health',
          label: 'Tai nạn & Khám định kỳ',
          icon: Activity,
          badge: null,
        },
      ],
    },
    {
      title: 'QUẢN LÝ THUỐC & KHO DƯỢC',
      items: [
        {
          id: 'medicines',
          label: 'Quản lý thuốc',
          icon: Pill,
          badge: `${metrics.totalMedicineTypes} loại`,
          badgeColor: 'bg-slate-100 text-slate-700',
        },
        {
          id: 'import_medicine',
          label: 'Nhập thuốc vào tủ y tế',
          icon: ArrowDownLeft,
          badge: null,
        },
        {
          id: 'export_medicine',
          label: 'Xuất cấp phát (Hạn gần)',
          icon: ArrowUpRight,
          badge: 'FEFO',
          badgeColor: 'bg-orange-100 text-orange-800 font-bold border border-orange-200',
        },
        {
          id: 'stock_balance',
          label: 'Sổ nhập - xuất - tồn kho',
          icon: BookOpen,
          badge: 'Mẫu A4',
          badgeColor: 'bg-pink-100 text-pink-800 font-bold border border-pink-200',
        },
        {
          id: 'inventory_check',
          label: 'Kiểm kê kho định kỳ',
          icon: ClipboardCheck,
          badge: pendingChecks > 0 ? `${pendingChecks} chờ duyệt` : 'Chuẩn',
          badgeColor: pendingChecks > 0 ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800',
        },
        {
          id: 'stock_report',
          label: 'Tồn kho theo hạn dùng',
          icon: Boxes,
          badge: null,
        },
        {
          id: 'expiry_tracking',
          label: 'Theo dõi thuốc hết hạn',
          icon: ClockAlert,
          badge: metrics.expiredCount > 0 ? `${metrics.expiredCount} hết hạn` : null,
          badgeColor: 'bg-rose-100 text-rose-700',
        },
        {
          id: 'low_stock',
          label: 'Thuốc dưới mức dự trữ',
          icon: AlertTriangle,
          badge: metrics.lowStockCount > 0 ? `${metrics.lowStockCount} loại` : null,
          badgeColor: 'bg-amber-100 text-amber-700',
        },
        {
          id: 'supply_usage',
          label: 'Vật tư tiêu hao sơ cứu',
          icon: BriefcaseMedical,
          badge: null,
        },
      ],
    },
    {
      title: 'BÁO CÁO, MẪU IN & HỆ THỐNG',
      items: [
        {
          id: 'comprehensive_reports',
          label: 'Báo cáo công tác y tế',
          icon: BarChart3,
          badge: null,
        },
        {
          id: 'medication_usage',
          label: 'Truy xuất thuốc - Học sinh',
          icon: FileSpreadsheet,
          badge: 'FEFO',
          badgeColor: 'bg-emerald-100 text-emerald-800',
        },
        {
          id: 'print_templates',
          label: 'Mẫu in sổ A4 chuẩn Bộ',
          icon: Printer,
          badge: 'A4',
          badgeColor: 'bg-slate-100 text-slate-700',
        },
        {
          id: 'audit_logs',
          label: 'Bảo mật & Phân quyền',
          icon: ShieldCheck,
          badge: 'Quản trị',
          badgeColor: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
        },
        {
          id: 'settings',
          label: 'Cài đặt & Sao lưu dữ liệu',
          icon: Settings,
          badge: 'Quản trị',
          badgeColor: 'bg-indigo-100 text-indigo-800',
        },
      ],
    },
  ];

  // Chỉ hiển thị các phần được cấp quyền trên ứng dụng
  const sections = useMemo(() => {
    void rolePermissions;
    return rawSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => db.canAccessTab(item.id)),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [dbTick, rolePermissions, metrics, pendingChecks, studentsCount, visitsToday]);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        id="app-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isCollapsedDesktop ? 'lg:w-20' : 'lg:w-72'
        } ${open ? 'translate-x-0 w-72' : '-translate-x-full w-72'}`}
      >
        {/* School branding header */}
        <div className={`p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 ${isCollapsedDesktop ? 'lg:flex-col lg:gap-2 lg:py-3' : ''}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-sky-600 to-orange-500 text-white flex items-center justify-center font-bold text-sm shadow-xs ring-2 ring-blue-100 shrink-0">
              <HeartPulse className="w-5 h-5" />
            </div>
            {!isCollapsedDesktop && (
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-blue-950 uppercase tracking-wide truncate">
                  Y Tế Học Đường
                </p>
                <p className="text-[11px] text-slate-500 font-medium truncate">THCS Đông Thạnh</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop collapse toggle */}
            <button
              type="button"
              onClick={toggleDesktopCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              title={isCollapsedDesktop ? 'Mở rộng thanh menu' : 'Thu nhỏ thanh menu (tiết kiệm màn hình)'}
            >
              {isCollapsedDesktop ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={handleClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              title="Đóng thanh điều hướng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Health Summary Pill */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('clinic_reception');
            if (open) handleClose();
          }}
          className={`mx-2 my-2 p-2 bg-pink-50/90 hover:bg-pink-100/90 border border-pink-200/80 rounded-xl flex items-center transition-colors cursor-pointer text-left group ${
            isCollapsedDesktop ? 'lg:justify-center lg:mx-2 lg:p-2' : 'justify-between px-3 py-2'
          }`}
          title={`Xem các ca tiếp nhận thực tế hôm nay (${visitsToday} ca)`}
        >
          {isCollapsedDesktop ? (
            <div className="relative">
              <HeartPulse className="w-5 h-5 text-orange-600 group-hover:scale-110 transition-transform" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-white"></span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                <span className="font-semibold text-pink-900 text-[11px] group-hover:text-pink-950">
                  Phòng Y Tế
                </span>
              </div>
              <span className="text-[10px] font-bold text-orange-700 bg-white px-2 py-0.5 rounded-md border border-orange-200 shadow-2xs group-hover:border-orange-300">
                {visitsToday} ca hôm nay
              </span>
            </>
          )}
        </button>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-3">
          {sections.map((sec, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!isCollapsedDesktop && (
                <p className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  {sec.title}
                </p>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  current === item.id ||
                  (item.id === 'import_medicine' && current === 'import') ||
                  (item.id === 'export_medicine' && current === 'export') ||
                  (item.id === 'stock_report' && current === 'stock') ||
                  (item.id === 'comprehensive_reports' && current === 'reports');

                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}`}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      handleClose();
                    }}
                    title={item.label}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isCollapsedDesktop
                        ? 'lg:justify-center lg:p-2.5 px-3 py-2.5 justify-between'
                        : 'justify-between px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-slate-500'
                        }`}
                      />
                      {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsedDesktop && item.badge && (
                      <span
                        className={`ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 whitespace-nowrap ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : item.badgeColor || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User profile & safety advice footer */}
        <div className={`p-2.5 border-t border-slate-200 bg-slate-50 space-y-2 ${isCollapsedDesktop ? 'lg:p-2' : ''}`}>
          <div className={`flex items-center ${isCollapsedDesktop ? 'lg:justify-center' : 'justify-between'}`}>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs border border-emerald-300 shrink-0"
                title={currentUser?.fullName}
              >
                {currentUser?.fullName?.charAt(0) || 'Y'}
              </div>
              {!isCollapsedDesktop && (
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                    {currentUser?.fullName?.split('(')[0]?.trim() || 'Cán bộ Y tế'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {getRoleLabel(currentUser?.role || 'medic')}
                  </p>
                </div>
              )}
            </div>
            {!isCollapsedDesktop && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                Online
              </span>
            )}
          </div>

          {!isCollapsedDesktop && (
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500 truncate">
                KT dị ứng trước khi cấp.
              </span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors shrink-0 cursor-pointer"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export const Sidebar = React.memo(SidebarComponent);
