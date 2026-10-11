import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Stethoscope,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Check,
  X,
  Info,
  Sliders,
  ArrowRightLeft,
} from 'lucide-react';
import { db, getRoleLabel } from '../services/db';
import { User as UserType, UserRole, UserPermission } from '../types';

export interface PermissionConfigItem {
  key: keyof UserPermission;
  shortLabel: string;
  label: string;
  description: string;
  group: 'Chuyên môn Y tế & Dược học đường' | 'Quản trị, Phê duyệt & Bảo mật hệ thống';
  adminDefault: boolean;
  medicDefault: boolean;
  adminScope: string;
  medicScope: string;
}

const PERMISSION_CONFIG: PermissionConfigItem[] = [
  {
    key: 'canManageClinicVisits',
    shortLabel: 'Tiếp nhận & Cấp thuốc',
    label: '1. Tiếp nhận khám sơ cứu, đo cân nặng & cấp phát thuốc',
    description:
      'Ghi nhận ca khám tại Phòng Y tế, nhập cân nặng học sinh, tự động cân đối liều lượng thuốc theo kg và trừ tồn kho FEFO.',
    group: 'Chuyên môn Y tế & Dược học đường',
    adminDefault: true,
    medicDefault: true,
    adminScope: 'Toàn quyền giám sát, tra cứu & điều chỉnh hồ sơ ca khám',
    medicScope: 'Trực tiếp tiếp nhận học sinh, khám sơ cứu & cấp phát thuốc hàng ngày',
  },
  {
    key: 'canManageStudents',
    shortLabel: 'Hồ sơ sức khỏe HS',
    label: '2. Quản lý Hồ sơ sức khỏe học sinh, Tai nạn & Khám định kỳ',
    description:
      'Quản lý danh sách học sinh toàn trường, tiền sử dị ứng, bệnh nền, chiều cao - cân nặng - BMI và đợt khám sức khỏe định kỳ.',
    group: 'Chuyên môn Y tế & Dược học đường',
    adminDefault: true,
    medicDefault: true,
    adminScope: 'Quản trị, đồng bộ danh sách học sinh & hồ sơ toàn trường',
    medicScope: 'Cập nhật hồ sơ sức khỏe, theo dõi bệnh nền & nhập kết quả khám định kỳ',
  },
  {
    key: 'canManageMedicine',
    shortLabel: 'Danh mục thuốc & Vật tư',
    label: '3. Quản lý Danh mục Thuốc & Vật tư y tế thiết yếu',
    description:
      'Quản lý danh mục 30 thuốc/vật tư chuẩn, quy cách đóng gói, nồng độ/hàm lượng, định mức tồn tối thiểu và vị trí tủ thuốc.',
    group: 'Chuyên môn Y tế & Dược học đường',
    adminDefault: true,
    medicDefault: true,
    adminScope: 'Toàn quyền cấu hình danh mục thuốc & vật tư chuẩn',
    medicScope: 'Cập nhật thông tin thuốc, lô thuốc, hạn dùng & vật tư sơ cứu',
  },
  {
    key: 'canManageTransactions',
    shortLabel: 'Nhập - Xuất kho FEFO',
    label: '4. Lập phiếu Nhập kho - Xuất kho thuốc (Nguyên tắc FEFO)',
    description:
      'Nhập lô thuốc mới vào tủ y tế, xuất cấp phát thuốc theo nguyên tắc Hết hạn trước - Xuất trước (FEFO) và in phiếu nhập/xuất.',
    group: 'Chuyên môn Y tế & Dược học đường',
    adminDefault: true,
    medicDefault: true,
    adminScope: 'Toàn quyền lập phiếu, đối soát & hủy phiếu giao dịch khi cần',
    medicScope: 'Trực tiếp lập phiếu nhập thuốc và xuất cấp phát chuyên môn',
  },
  {
    key: 'canManageInventoryCheck',
    shortLabel: 'Kiểm đếm & Lập biên bản',
    label: '5. Kiểm kê định kỳ tủ thuốc & Lập đề xuất hủy thuốc hết hạn',
    description:
      'Kiểm đếm số lượng thực tế trong tủ y tế, đối chiếu số liệu sổ sách và lập biên bản kiểm kê / đề xuất hủy thuốc hết hạn.',
    group: 'Chuyên môn Y tế & Dược học đường',
    adminDefault: true,
    medicDefault: true,
    adminScope: 'Toàn quyền tổ chức kiểm kê & rà soát chênh lệch tồn kho',
    medicScope: 'Kiểm đếm thực tế tủ thuốc & lập biên bản trình Quản trị phê duyệt',
  },
  {
    key: 'canViewReports',
    shortLabel: 'Báo cáo & In sổ A4',
    label: '6. Báo cáo thống kê y tế & In biểu mẫu sổ chuẩn A4',
    description:
      'Xem sổ nhập - xuất - tồn, truy xuất thuốc theo học sinh, báo cáo công tác y tế tháng/năm và in bộ sổ A4 chuẩn.',
    group: 'Chuyên môn Y tế & Dược học đường',
    adminDefault: true,
    medicDefault: true,
    adminScope: 'Xem, xuất Excel & kiểm duyệt toàn bộ báo cáo thống kê',
    medicScope: 'Lập, kết xuất & in ấn các sổ theo dõi chuyên môn A4',
  },
  {
    key: 'canApproveAudits',
    shortLabel: 'Phê duyệt kiểm kê & Hủy thuốc',
    label: '7. Phê duyệt Biên bản kiểm kê, Chốt điều chỉnh kho & Quyết định hủy thuốc',
    description:
      'Thẩm quyền phê duyệt biên bản kiểm kê, chốt điều chỉnh số liệu chênh lệch tồn kho thực tế và duyệt quyết định tiêu hủy thuốc hết hạn.',
    group: 'Quản trị, Phê duyệt & Bảo mật hệ thống',
    adminDefault: true,
    medicDefault: false,
    adminScope: 'ĐỘC QUYỀN QUẢN TRỊ: Ký duyệt kiểm kê, chốt kho & duyệt hủy thuốc',
    medicScope: 'Không có quyền tự phê duyệt (Chỉ lập biên bản gửi chờ duyệt)',
  },
  {
    key: 'canManageSettings',
    shortLabel: 'Quản trị hệ thống & Sao lưu',
    label: '8. Quản trị hệ thống, Phân quyền, Nhật ký Audit & Sao lưu / Khôi phục dữ liệu',
    description:
      'Cấu hình thông tin trường học, điều chỉnh ma trận phân quyền, kiểm tra nhật ký kiểm toán và sao lưu / khôi phục cơ sở dữ liệu.',
    group: 'Quản trị, Phê duyệt & Bảo mật hệ thống',
    adminDefault: true,
    medicDefault: false,
    adminScope: 'ĐỘC QUYỀN QUẢN TRỊ: Toàn quyền cấu hình hệ thống, phân quyền & sao lưu',
    medicScope: 'Không có quyền can thiệp cài đặt hệ thống & dữ liệu gốc',
  },
];

export const RoleManagement: React.FC = () => {
  const [rolesList, setRolesList] = useState<UserType[]>(() => db.getUsers());
  const [currentUser, setCurrentUser] = useState<UserType>(() => db.getCurrentUser());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setRolesList(db.getUsers());
      setCurrentUser(db.getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const adminRoleProfile =
    rolesList.find((u) => u.role === 'admin') || {
      id: 'role-admin',
      username: 'quantri',
      fullName: 'Quản trị',
      role: 'admin' as UserRole,
      permissions: {
        canManageMedicine: true,
        canManageTransactions: true,
        canManageClinicVisits: true,
        canManageStudents: true,
        canManageInventoryCheck: true,
        canViewReports: true,
        canManageSettings: true,
        canApproveAudits: true,
      },
    };

  const medicRoleProfile =
    rolesList.find((u) => u.role === 'medic') || {
      id: 'role-medic',
      username: 'nhanvien_yte',
      fullName: 'Nhân viên Y tế',
      role: 'medic' as UserRole,
      permissions: {
        canManageMedicine: true,
        canManageTransactions: true,
        canManageClinicVisits: true,
        canManageStudents: true,
        canManageInventoryCheck: true,
        canViewReports: true,
        canManageSettings: false,
        canApproveAudits: false,
      },
    };

  const activeRole: 'admin' | 'medic' =
    currentUser?.role === 'admin' || currentUser?.role === 'bgh' ? 'admin' : 'medic';

  const handleSwitchTaskRole = (targetRole: 'admin' | 'medic') => {
    db.setCurrentUserRole(targetRole);
    setRolesList(db.getUsers());
    setCurrentUser(db.getCurrentUser());
    showSuccess(
      `Đã chuyển sang nhiệm vụ: ${
        targetRole === 'admin' ? 'Quản trị (Toàn quyền hệ thống)' : 'Nhân viên Y tế (Chuyên môn Phòng Y tế)'
      }`
    );
  };

  const handleTogglePermission = (
    role: 'admin' | 'medic',
    permKey: keyof UserPermission,
    currentVal: boolean,
    label: string
  ) => {
    if (role === 'admin' && (permKey === 'canManageSettings' || permKey === 'canApproveAudits') && currentVal) {
      setErrorMsg('Nhiệm vụ Quản trị luôn phải giữ quyền Quản trị hệ thống và Phê duyệt để đảm bảo an toàn.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    const nextVal = !currentVal;
    db.toggleRoleGroupPermission(role, permKey, nextVal);
    setRolesList(db.getUsers());
    setCurrentUser(db.getCurrentUser());
    showSuccess(
      `Đã ${nextVal ? 'CẤP' : 'THU HỒI'} quyền "${label}" đối với nhiệm vụ ${getRoleLabel(role)}.`
    );
  };

  const handleResetStandardPermissions = () => {
    db.clearAllPersonnelKeepTwoRoles();
    setRolesList(db.getUsers());
    setCurrentUser(db.getCurrentUser());
    showSuccess(
      'Đã chuẩn hóa phân quyền: Xóa toàn bộ nhân sự cá nhân, chỉ giữ lại 2 nhiệm vụ (Quản trị & Nhân viên Y tế) với phân quyền chuẩn!'
    );
  };

  const adminPerms = adminRoleProfile.permissions || {
    canManageMedicine: true,
    canManageTransactions: true,
    canManageClinicVisits: true,
    canManageStudents: true,
    canManageInventoryCheck: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveAudits: true,
  };

  const medicPerms = medicRoleProfile.permissions || {
    canManageMedicine: true,
    canManageTransactions: true,
    canManageClinicVisits: true,
    canManageStudents: true,
    canManageInventoryCheck: true,
    canViewReports: true,
    canManageSettings: false,
    canApproveAudits: false,
  };

  const adminGrantedCount = PERMISSION_CONFIG.filter((p) => !!adminPerms[p.key]).length;
  const medicGrantedCount = PERMISSION_CONFIG.filter((p) => !!medicPerms[p.key]).length;

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 rounded text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Active Task Role Switcher (Only 2 Task Roles: Quản trị & Nhân viên Y tế) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                activeRole === 'admin'
                  ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300'
                  : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
              }`}
            >
              {activeRole === 'admin' ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <Stethoscope className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-300 font-medium">Nhiệm vụ đang làm việc:</span>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
                    activeRole === 'admin'
                      ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50'
                      : 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
                  }`}
                >
                  {activeRole === 'admin' ? '1. QUẢN TRỊ' : '2. NHÂN VIÊN Y TẾ'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {activeRole === 'admin'
                  ? 'Toàn quyền quản trị hệ thống, phê duyệt kiểm kê/tiêu hủy thuốc, cấu hình phân quyền & sao lưu dữ liệu (8/8 quyền).'
                  : 'Thực hiện nghiệp vụ chuyên môn Phòng Y tế: Tiếp nhận học sinh, cân đối thuốc theo cân nặng, nhập xuất kho FEFO & báo cáo (6/8 quyền).'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/15">
              <button
                type="button"
                onClick={() => handleSwitchTaskRole('admin')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeRole === 'admin'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>1. Quản trị</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchTaskRole('medic')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeRole === 'medic'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>2. Nhân viên Y tế</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetStandardPermissions}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
              title="Khôi phục phân quyền mặc định chuẩn cho 2 nhiệm vụ Quản trị và Nhân viên Y tế"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Khôi phục chuẩn 2 nhiệm vụ</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2 Clear Task Role Cards (No individual personnel names) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* NHIỆM VỤ 1: QUẢN TRỊ */}
        <div
          className={`p-5 rounded-2xl border-2 bg-white transition-all flex flex-col justify-between ${
            activeRole === 'admin'
              ? 'border-indigo-600 shadow-md ring-2 ring-indigo-100'
              : 'border-indigo-200 hover:border-indigo-300'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 uppercase">
                      NHIỆM VỤ 1: QUẢN TRỊ
                    </h3>
                    {activeRole === 'admin' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Quản trị toàn diện hệ thống, phê duyệt kiểm kê/tiêu hủy & bảo mật dữ liệu
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 shrink-0">
                {adminGrantedCount}/8 quyền
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2 text-xs">
              <p className="font-bold text-indigo-950 uppercase text-[11px] tracking-wider">
                Phạm vi thẩm quyền của Quản trị:
              </p>
              <ul className="space-y-1.5 text-slate-700">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Độc quyền Phê duyệt:</strong> Xác nhận biên bản kiểm kê định kỳ, chốt điều chỉnh số liệu chênh lệch tồn kho và phê duyệt quyết định tiêu hủy thuốc hết hạn.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Độc quyền Quản trị & Sao lưu:</strong> Cấu hình thông số trường học, quản lý phân quyền, xem nhật ký kiểm toán (Audit Log), sao lưu và khôi phục dữ liệu toàn trường.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Giám sát toàn bộ chuyên môn:</strong> Tra cứu, kiểm tra và thực hiện mọi nghiệp vụ hồ sơ học sinh, ca khám phòng y tế, kho thuốc FEFO và báo cáo A4.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-indigo-700">
              Trạng thái: Toàn quyền hệ thống (8/8 chức năng)
            </span>
            {activeRole !== 'admin' ? (
              <button
                type="button"
                onClick={() => handleSwitchTaskRole('admin')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Chuyển sang nhiệm vụ Quản trị</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200">
                <CheckCircle2 className="w-4 h-4" />
                <span>Đang sử dụng nhiệm vụ này</span>
              </span>
            )}
          </div>
        </div>

        {/* NHIỆM VỤ 2: NHÂN VIÊN Y TẾ */}
        <div
          className={`p-5 rounded-2xl border-2 bg-white transition-all flex flex-col justify-between ${
            activeRole === 'medic'
              ? 'border-emerald-600 shadow-md ring-2 ring-emerald-100'
              : 'border-emerald-200 hover:border-emerald-300'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200 shrink-0">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 uppercase">
                      NHIỆM VỤ 2: NHÂN VIÊN Y TẾ
                    </h3>
                    {activeRole === 'medic' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trực tiếp phụ trách chuyên môn Phòng Y tế học đường & quản lý tủ thuốc
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                {medicGrantedCount}/8 quyền
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2 text-xs">
              <p className="font-bold text-emerald-950 uppercase text-[11px] tracking-wider">
                Phạm vi thẩm quyền của Nhân viên Y tế:
              </p>
              <ul className="space-y-1.5 text-slate-700">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Khám & Cấp phát thuốc:</strong> Tiếp nhận học sinh vào Phòng Y tế, đo sinh hiệu & cân nặng, cân đối liều lượng thuốc và cấp phát tự động trừ kho FEFO.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Quản lý Kho dược & Hồ sơ:</strong> Quản lý danh mục thuốc/vật tư, lập phiếu nhập - xuất kho, cập nhật hồ sơ sức khỏe học sinh, khám định kỳ & in sổ A4.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-rose-800">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Giới hạn phân quyền rõ ràng:</strong> Không tự phê duyệt chốt điều chỉnh chênh lệch kiểm kê/hủy thuốc và không truy cập Cài đặt hệ thống / Xóa dữ liệu gốc.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-emerald-700">
              Trạng thái: Chuyên môn Y tế ({medicGrantedCount}/8 chức năng)
            </span>
            {activeRole !== 'medic' ? (
              <button
                type="button"
                onClick={() => handleSwitchTaskRole('medic')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Chuyển sang nhiệm vụ Nhân viên Y tế</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                <span>Đang sử dụng nhiệm vụ này</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Permission Matrix Table for the 2 Roles */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Bảng Phân Quyền Rõ Ràng Giữa 2 Nhiệm Vụ: Quản Trị & Nhân Viên Y Tế</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Đã xóa toàn bộ nhân sự cá nhân • Chỉ phân quyền theo 2 nhiệm vụ chính thức của hệ thống
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Quản trị ({adminGrantedCount}/8)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              Nhân viên Y tế ({medicGrantedCount}/8)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3.5 px-4 w-5/12">Nhiệm vụ chuyên môn / Chức năng hệ thống</th>
                <th className="py-3.5 px-4 text-center w-3/12 border-l border-slate-200 bg-indigo-50/50 text-indigo-950">
                  1. Quản trị (Admin)
                </th>
                <th className="py-3.5 px-4 text-center w-4/12 border-l border-slate-200 bg-emerald-50/50 text-emerald-950">
                  2. Nhân viên Y tế (Medic)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {PERMISSION_CONFIG.map((perm) => {
                const isAdminEnabled = !!adminPerms[perm.key];
                const isMedicEnabled = !!medicPerms[perm.key];
                const isExclusiveAdmin =
                  perm.group === 'Quản trị, Phê duyệt & Bảo mật hệ thống';

                return (
                  <tr
                    key={perm.key}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isExclusiveAdmin ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Col 1: Description */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{perm.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isExclusiveAdmin
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {perm.group}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {perm.description}
                      </p>
                    </td>

                    {/* Col 2: Quản trị */}
                    <td className="py-3.5 px-4 text-center border-l border-slate-200 bg-indigo-50/10">
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePermission('admin', perm.key, isAdminEnabled, perm.shortLabel)
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isAdminEnabled
                              ? 'bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700'
                              : 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {isAdminEnabled ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Được phép</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Đã tắt</span>
                            </>
                          )}
                        </button>
                        <span className="text-[11px] text-indigo-900 font-medium">
                          {perm.adminScope}
                        </span>
                      </div>
                    </td>

                    {/* Col 3: Nhân viên Y tế */}
                    <td className="py-3.5 px-4 text-center border-l border-slate-200 bg-emerald-50/10">
                      <div className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePermission('medic', perm.key, isMedicEnabled, perm.shortLabel)
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isMedicEnabled
                              ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Nhấn để Cấp hoặc Thu hồi quyền này của Nhân viên Y tế"
                        >
                          {isMedicEnabled ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Được phép (Bấm để khóa)</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Giới hạn (Bấm để cấp)</span>
                            </>
                          )}
                        </button>
                        <span
                          className={`text-[11px] font-medium ${
                            isMedicEnabled ? 'text-emerald-900' : 'text-rose-700'
                          }`}
                        >
                          {perm.medicScope}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Nguyên tắc phân quyền:</strong> Hệ thống chỉ duy trì 2 nhiệm vụ{' '}
              <strong className="text-indigo-700">Quản trị</strong> và{' '}
              <strong className="text-emerald-700">Nhân viên Y tế</strong> (không lưu danh sách nhân sự cá nhân).
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetStandardPermissions}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shrink-0 cursor-pointer"
          >
            Đặt lại phân quyền chuẩn (8/8 & 6/8)
          </button>
        </div>
      </div>
    </div>
  );
};
