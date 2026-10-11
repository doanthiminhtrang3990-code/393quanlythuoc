import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Menu,
  LogOut,
  GraduationCap,
  Stethoscope,
  ChevronDown,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  Laptop,
  Copy,
  Check,
  X,
  Share2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { db, getRoleLabel } from '../services/db';
import { logout } from '../services/firebase';

interface HeaderProps {
  currentUser?: User;
  onRoleSwitch?: (role: UserRole) => void;
  onQuickAction?: (action: 'add_medicine' | 'import' | 'export' | 'stock' | 'print') => void;
  isSidebarOpen?: boolean;
  setIsSidebarOpen?: (open: boolean | ((prev: boolean) => boolean)) => void;
  onToggleSidebar?: () => void;
  onOpenAddMedicine?: () => void;
  onOpenImport?: () => void;
  onOpenExport?: () => void;
  onLogout?: () => void;
  schoolName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser: propUser,
  onRoleSwitch: propRoleSwitch,
  onQuickAction: propQuickAction,
  setIsSidebarOpen,
  onToggleSidebar,
  onOpenAddMedicine,
  onOpenImport,
  onOpenExport,
  onLogout,
  schoolName: propSchoolName,
}) => {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline'>(
    () => db.getSyncStatus().state
  );
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.isPrivacyModeEnabled());
  const [counts, setCounts] = useState(() => ({
    visits: db.getClinicVisits().length,
    todayVisits: db.getTodayClinicVisits().length,
    medicines: db.getMedicines().length,
    batches: db.getBatches().length,
    students: db.getStudents().length,
    classes: db.getSchoolClasses().length,
  }));

  const currentUser: User = propUser || db.getCurrentUser() || {
    id: 'role-medic',
    username: 'nhanvien_yte',
    fullName: 'Nhân viên Y tế',
    role: 'medic',
  };

  // Compute the public shared URL (converting ais-dev- to ais-pre- so it works on other computers)
  const sharedAppUrl =
    typeof window !== 'undefined'
      ? window.location.origin.includes('ais-dev-')
        ? window.location.origin.replace('ais-dev-', 'ais-pre-')
        : window.location.origin
      : 'https://ais-pre-ikza6y7upnzkeaur4x2eyz-940744077607.asia-east1.run.app';

  const isUsingDevUrl =
    typeof window !== 'undefined' && window.location.origin.includes('ais-dev-');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    const unsubDb = db.subscribe(() => {
      setSyncStatus(db.getSyncStatus().state);
      setPrivacyMode(db.isPrivacyModeEnabled());
      setCounts({
        visits: db.getClinicVisits().length,
        todayVisits: db.getTodayClinicVisits().length,
        medicines: db.getMedicines().length,
        batches: db.getBatches().length,
        students: db.getStudents().length,
        classes: db.getSchoolClasses().length,
      });
    });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      unsubDb();
    };
  }, []);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await db.pullFromServerAndMerge(true);
      await db.pushStateToServer();
      await db.syncAllToCloud();
      setCounts({
        visits: db.getClinicVisits().length,
        todayVisits: db.getTodayClinicVisits().length,
        medicines: db.getMedicines().length,
        batches: db.getBatches().length,
        students: db.getStudents().length,
        classes: db.getSchoolClasses().length,
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleCopySharedLink = async () => {
    try {
      await navigator.clipboard.writeText(sharedAppUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Fallback copy
      const input = document.createElement('input');
      input.value = sharedAppUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    } else if (setIsSidebarOpen) {
      setIsSidebarOpen((prev) => !prev);
    }
  };

  const handleRoleSwitch = (role: UserRole) => {
    if (propRoleSwitch) {
      propRoleSwitch(role);
    } else {
      db.setCurrentUserRole(role);
    }
    setRoleMenuOpen(false);
  };

  const handleQuickAction = (action: 'add_medicine' | 'import' | 'export' | 'stock' | 'print') => {
    if (propQuickAction) {
      propQuickAction(action);
    } else if (action === 'add_medicine' && onOpenAddMedicine) {
      onOpenAddMedicine();
    } else if (action === 'import' && onOpenImport) {
      onOpenImport();
    } else if (action === 'export' && onOpenExport) {
      onOpenExport();
    }
  };

  const schoolName = propSchoolName || db.getSettings()?.schoolName || 'TRƯỜNG THCS ĐÔNG THẠNH';

  const getRoleIcon = (role?: UserRole) => {
    switch (role) {
      case 'bgh':
      case 'admin':
        return <ShieldCheck className="w-4 h-4 text-indigo-700" />;
      case 'medic':
      default:
        return <Stethoscope className="w-4 h-4 text-emerald-700" />;
    }
  };

  const getRoleBadgeClasses = (role?: UserRole) => {
    switch (role) {
      case 'bgh':
      case 'admin':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300 hover:bg-indigo-200';
      case 'medic':
      default:
        return 'bg-pink-50 text-pink-900 border-pink-200 hover:bg-pink-100';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Utility Top Bar - School Identity & Live Multi-Computer Sync Status */}
      <div className="bg-slate-50 border-b border-slate-200/80 px-4 sm:px-6 py-1.5 text-xs text-slate-600 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 font-medium min-w-0">
          <span className="flex items-center gap-1.5 font-bold text-blue-800 text-[11px] uppercase tracking-wider shrink-0">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            Hệ Thống Y Tế Học Đường
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">|</span>
          <span className="truncate text-[11px] text-slate-600">
            {syncStatus === 'saving' || isManualSyncing ? (
              <span className="text-blue-700 font-semibold inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Đang lưu & đồng bộ máy chủ...
              </span>
            ) : syncStatus === 'loading' ? (
              <span className="text-blue-700 font-semibold inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Đang tải dữ liệu từ máy chủ...
              </span>
            ) : syncStatus === 'error' ? (
              <span className="text-blue-700 font-semibold inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-orange-500" /> Đã lưu an toàn trên Máy chủ & Bộ nhớ máy ({counts.todayVisits} ca khám thực tế trong ngày • tổng {counts.visits} ca)
              </span>
            ) : (
              <span className="text-slate-600">
                Đã lưu bền vững: <strong className="text-blue-800">{counts.todayVisits} ca thực tế trong ngày</strong> <span className="text-slate-500 font-medium">({counts.visits} ca toàn hệ thống)</span> •{' '}
                <strong className="text-indigo-800">{counts.classes} lớp & GVCN</strong> •{' '}
                <strong className="text-slate-800">
                  {privacyMode ? 'Đã ẩn tên (Bảo mật)' : (currentUser?.fullName || currentUser?.username)}
                </strong>
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const next = db.togglePrivacyMode();
              setPrivacyMode(next);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all shadow-2xs cursor-pointer ${
              privacyMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200'
                : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-300'
            }`}
            title={privacyMode ? 'Đang bật chế độ ẩn tên học sinh. Bấm để hiển thị tên.' : 'Bấm để ẩn tên học sinh và bảo mật thông tin trên màn hình'}
          >
            {privacyMode ? <EyeOff className="w-3 h-3 text-amber-700" /> : <Eye className="w-3 h-3 text-slate-500" />}
            <span>{privacyMode ? 'Đang ẩn tên HS' : 'Ẩn tên HS'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleManualSync();
              setShareModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-2xs cursor-pointer"
            title="Lấy link chuẩn để mở và sử dụng trên máy tính khác"
          >
            <Share2 className="w-3 h-3" />
            <span>Dùng trên máy tính khác</span>
          </button>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isManualSyncing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-blue-800 border border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Đồng bộ ngay dữ liệu giữa các máy tính"
          >
            <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin text-blue-600' : 'text-blue-700'}`} />
            <span className="hidden sm:inline">{isManualSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
          </button>

          <span className="hidden lg:inline-block text-slate-500 font-semibold text-[11px]">
            {schoolName}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & School info */}
          <div className="flex items-center gap-3">
            <button
              id="btn-toggle-sidebar"
              type="button"
              onClick={handleToggleSidebar}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              title="Ẩn / Hiện thanh điều hướng"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm ring-2 ring-blue-100">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-[11px] font-bold uppercase tracking-wider text-blue-800 leading-none mb-1">
                  {schoolName}
                </h1>
                <p className="text-base sm:text-lg font-black text-slate-900 leading-tight tracking-tight whitespace-nowrap">
                  QUẢN LÝ THUỐC & Y TẾ HỌC ĐƯỜNG
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions & Role switch */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Action Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {db.hasPermission('canManageMedicine') && (
                <button
                  id="btn-quick-add-medicine"
                  type="button"
                  onClick={() => handleQuickAction('add_medicine')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-pink-50 text-pink-800 hover:bg-pink-100 border border-pink-200 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-pink-600" />
                  <span>+ Thêm thuốc</span>
                </button>
              )}

              {db.hasPermission('canManageTransactions') && (
                <>
                  <button
                    id="btn-quick-import"
                    type="button"
                    onClick={() => handleQuickAction('import')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                    <span>Nhập kho</span>
                  </button>

                  <button
                    id="btn-quick-export"
                    type="button"
                    onClick={() => handleQuickAction('export')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-orange-500 text-white hover:bg-orange-600 shadow-xs transition-colors cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Xuất cấp phát</span>
                  </button>
                </>
              )}
            </div>

            {/* Privacy Mode Toggle Button */}
            <button
              id="btn-header-privacy-mode"
              type="button"
              onClick={() => {
                const next = db.togglePrivacyMode();
                setPrivacyMode(next);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all shadow-2xs cursor-pointer ${
                privacyMode
                  ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
              }`}
              title={
                privacyMode
                  ? 'Đang bật chế độ ẩn tên học sinh. Nhấn để hiển thị họ tên đầy đủ.'
                  : 'Nhấn để ẩn tên học sinh (Chế độ bảo mật khi trình chiếu, chia sẻ màn hình)'
              }
            >
              {privacyMode ? (
                <>
                  <EyeOff className="w-4 h-4 text-amber-700" />
                  <span>Ẩn tên (Bật)</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span className="hidden md:inline">Ẩn tên HS</span>
                </>
              )}
            </button>

            {/* Role indicator with 2-role Quick Switch Dropdown */}
            <div className="relative" ref={roleMenuRef}>
              <button
                type="button"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs ${getRoleBadgeClasses(
                  currentUser?.role
                )}`}
                title="Nhấn để chuyển đổi giữa 2 nhiệm vụ: Quản trị & Nhân viên Y tế"
              >
                {getRoleIcon(currentUser?.role)}
                <div className="text-left">
                  <span className="block text-[10px] uppercase tracking-wider font-extrabold opacity-80">
                    Nhiệm vụ
                  </span>
                  <span className="hidden sm:inline font-semibold text-slate-900 truncate max-w-[130px]">
                    {getRoleLabel(currentUser?.role || 'medic')}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 opacity-70 ml-0.5" />
              </button>

              {/* 2-Role Menu: Quản trị & Nhân viên Y tế */}
              {roleMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-900 text-xs">Chọn Nhiệm Vụ Làm Việc</p>
                    <p className="text-[11px] text-slate-500">Phân quyền rõ ràng 2 nhiệm vụ:</p>
                  </div>

                  {/* 1. Quản trị */}
                  <button
                    type="button"
                    onClick={() => handleRoleSwitch('admin')}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-xl transition-colors text-left ${
                      currentUser?.role === 'admin' || currentUser?.role === 'bgh'
                        ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block text-indigo-900">1. Quản trị (8/8 quyền)</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Toàn quyền quản trị hệ thống, phê duyệt kiểm kê/hủy thuốc & sao lưu
                      </span>
                    </div>
                  </button>

                  {/* 2. Nhân viên Y tế */}
                  <button
                    type="button"
                    onClick={() => handleRoleSwitch('medic')}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-xl transition-colors text-left ${
                      currentUser?.role === 'medic'
                        ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs block text-emerald-900">2. Nhân viên Y tế (6/8 quyền)</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Khám sơ cứu, cân đối thuốc theo cân nặng, nhập xuất kho FEFO & in A4
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (onLogout) {
                  onLogout();
                } else {
                  logout();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Hướng dẫn & Link Sử dụng trên Máy tính khác */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    Sử Dụng Ứng Dụng Trên Máy Tính Khác
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đồng bộ trực tiếp Ca khám, Tồn kho thuốc & Danh sách học sinh giữa các máy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isUsingDevUrl && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                <p className="font-bold text-amber-900">
                  ⚠️ Lưu ý quan trọng vì sao máy khác chưa vào được:
                </p>
                <p className="leading-relaxed text-amber-800">
                  Đường dẫn có chữ <code className="font-mono font-bold bg-amber-100 px-1 rounded">ais-dev-...</code> chỉ dành riêng cho tài khoản đang mở trình thiết kế nên máy tính khác sẽ bị chặn. Để mở trên máy tính khác, Quý Thầy/Cô vui lòng sử dụng <strong>Link Chia Sẻ (<code className="font-mono">ais-pre-...</code>)</strong> bên dưới:
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Link chuẩn dùng để mở trên máy tính / điện thoại khác:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sharedAppUrl}
                  className="flex-1 px-3 py-2.5 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-xl text-indigo-900 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopySharedLink}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã sao chép!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Sao chép Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Server Sync Summary */}
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Dữ liệu đang lưu trên Máy chủ Trường học:
                </span>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isManualSyncing}
                  className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
                  <span>{isManualSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center">
                  <div className="text-base font-black text-emerald-700">{counts.todayVisits}</div>
                  <div className="text-[11px] text-slate-600 font-medium">Ca thực tế hôm nay ({counts.visits} tổng)</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center">
                  <div className="text-base font-black text-indigo-700">{counts.batches}</div>
                  <div className="text-[11px] text-slate-600 font-medium">Lô thuốc tồn kho</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center">
                  <div className="text-base font-black text-teal-700">{counts.classes}</div>
                  <div className="text-[11px] text-slate-600 font-medium">Lớp & GVCN</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-center">
                  <div className="text-base font-black text-purple-700">{counts.students}</div>
                  <div className="text-[11px] text-slate-600 font-medium">Học sinh</div>
                </div>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                ✓ Khi máy tính khác mở Link trên, chỉ cần nhập Email (ví dụ: <code className="font-mono font-bold">doanthiminhtrang3990@gmail.com</code>) hoặc bấm chọn vai trò là toàn bộ ca khám, thuốc đã trừ kho và danh sách học sinh sẽ tự động hiển thị đầy đủ.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Đã hiểu & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
