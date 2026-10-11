export type MedicineStatus =
  | 'active'          // Đang sử dụng
  | 'low_stock'       // Sắp hết
  | 'out_of_stock'    // Hết hàng
  | 'expiring_soon'   // Sắp hết hạn
  | 'expired'         // Hết hạn
  | 'discontinued';   // Ngưng sử dụng

export type ExpiryAlertLevel = 'expired' | 'warning_30' | 'warning_60' | 'safe';

export type RecipientType = 'student' | 'teacher' | 'staff' | 'other';

export type UserRole = 'bgh' | 'admin' | 'medic';

export type SyncState = 'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline';

export interface SyncStatus {
  state: SyncState;
  lastSavedAt: Date | null;
  errorMessage: string | null;
  currentUserId: string | null;
  pendingCount: number;
}

export interface UserPermission {
  canManageMedicine: boolean;     // 1. Quản lý danh mục thuốc & vật tư y tế
  canManageTransactions: boolean; // 2. Lập & quản lý phiếu nhập - xuất kho
  canManageClinicVisits: boolean; // 3. Khám tiếp nhận & cấp phát thuốc học sinh
  canManageStudents: boolean;     // 4. Hồ sơ sức khỏe & khám định kỳ A4
  canManageInventoryCheck: boolean; // 5. Kiểm kê & cân đối kho thuốc
  canViewReports: boolean;        // 6. Báo cáo thống kê y tế & in mẫu chuẩn A4
  canManageSettings: boolean;     // 7. Cài đặt hệ thống, bảo mật & phân quyền
  canApproveAudits?: boolean;     // 8. Phê duyệt kiểm kê & biên bản xuất hủy thuốc (Ban Giám Hiệu)
}

export interface User {
  id: string;
  userId?: string;
  username: string;
  fullName: string;
  name?: string;
  role: UserRole;
  email?: string;
  phone?: string;
  title?: string;        // Chức vụ / Vị trí công tác
  department?: string;   // Đơn vị / Phòng ban
  status?: 'active' | 'inactive';
  permissions?: UserPermission;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  userId?: string;
  code: string;
  name: string;
  phone: string;
  address: string;
  contactPerson: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicineBatch {
  id: string;
  userId?: string;
  medicineId: string;
  batchNumber: string; // Số lô
  mfgDate: string;     // Ngày sản xuất (YYYY-MM-DD)
  expDate: string;     // Hạn sử dụng (YYYY-MM-DD)
  quantity: number;    // Số lượng tồn hiện tại của lô
  initialQuantity: number;
  unitPrice?: number;  // (Tùy chọn/Đã bỏ trường giá)
  supplierId?: string;
  storageLocation?: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Medicine {
  id: string;
  userId?: string;
  code: string;               // Mã thuốc
  name: string;               // Tên thuốc
  activeIngredient: string;   // Hoạt chất
  dosageForm: string;         // Dạng bào chế (Viên nén, Dung dịch,...)
  strength: string;           // Hàm lượng / nồng độ (500mg, 10%,...)
  unit: string;               // Đơn vị tính (Viên, Gói, Chai, Lọ,...)
  packing: string;            // Quy cách đóng gói (Hộp 10 vỉ x 10 viên,...)
  manufacturer: string;       // Nhà sản xuất
  country: string;            // Nước sản xuất
  supplierId: string;         // Nhà cung cấp
  minStock: number;           // Mức tồn tối thiểu
  unitPrice?: number;         // (Tùy chọn/Đã bỏ trường giá)
  storageLocation: string;    // Vị trí bảo quản (Tủ A ngăn 2,...)
  notes?: string;             // Ghi chú
  isDemo?: boolean;           // Dữ liệu mẫu
  createdAt: string;
  updatedAt: string;
  // Computed helpers for quick display
  totalStock?: number;
  stock?: number;
  earliestExpDate?: string;
  computedStatus?: MedicineStatus;
}

export interface TransactionItem {
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  quantity: number;
  unitPrice?: number;
  totalAmount?: number;
  unit: string;
  expDate?: string;
}

export type TransactionType = 'import' | 'export' | 'audit_adjustment';

export interface InventoryTransaction {
  id: string;
  userId?: string;
  transactionCode: string;   // Số phiếu (PN-xxxx, PX-xxxx)
  type: TransactionType;
  date: string;              // Ngày giao dịch (YYYY-MM-DD)
  // Fields for import
  source?: string;           // Nguồn thuốc (Ngân sách trường, Phụ huynh tài trợ, Y tế huyện cấp...)
  supplierId?: string;
  supplierName?: string;     // Tên nơi cung cấp / Đơn vị cấp tự nhập
  deliverer?: string;        // Người giao
  receiver?: string;         // Người nhận
  // Fields for export
  recipientName?: string;    // Người nhận / Người sử dụng thuốc
  recipientType?: RecipientType; // Học sinh | Giáo viên | Nhân viên | Khác
  recipientClass?: string;   // Lớp hoặc Bộ phận
  purpose?: string;          // Mục đích sử dụng (Sốt cao, đau bụng, xây xát nhẹ,...)
  performer: string;         // Người thực hiện (Nhân viên y tế)
  notes?: string;
  items: TransactionItem[];
  totalAmount?: number;
  status: 'completed' | 'cancelled';
  cancellationReason?: string;
  isDemo?: boolean;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  userId?: string;
  transactionId: string;
  date: string;
  recipientName: string;
  recipientType: RecipientType;
  recipientClass: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  purpose: string;
  performer: string;
  notes?: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicalSupply {
  id: string;
  userId?: string;
  code: string;
  name: string;
  category: string; // Bông gạc, Khẩu trang, Sát trùng, Dụng cụ,...
  unit: string;
  quantity: number;
  minStock: number;
  importDate: string;
  expDate?: string;
  supplierId?: string;
  storageLocation: string;
  notes?: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryCheckItem {
  id?: string;
  medicineId: string;
  medicineCode?: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expDate?: string;
  unit: string;
  systemQuantity: number;
  bookQuantity?: number;
  actualQuantity: number;
  difference: number;
  qualityStatus?: string;
  reason?: string;
  notes?: string;
}

export interface InventoryCheck {
  id: string;
  userId?: string;
  checkCode: string;          // KK-2026-0001
  checkDate: string;          // YYYY-MM-DD
  checkTime?: string;         // HH:mm
  performer: string;          // Người kiểm kê
  participants?: string[];    // Thành phần tham gia kiểm kê
  items: InventoryCheckItem[];
  notes?: string;
  status: 'draft' | 'confirmed' | 'adjusted';
  confirmedAt?: string;
  confirmedBy?: string;
  adjustedAt?: string;
  adjustedBy?: string;
  createdAt: string;
}

export type DisposalStatus = 'draft' | 'pending_approval' | 'approved' | 'completed' | 'cancelled';

export interface DisposalCouncilMember {
  roleTitle: string; // 'Chủ tịch hội đồng' | 'Thư ký' | 'Ủy viên' | 'Ủy viên giám sát'
  name: string;
  position: string;  // 'Phó Hiệu trưởng' | 'Cán bộ Y tế' | 'Kế toán trường' | 'Chủ tịch Công đoàn'
}

export interface MedicineDisposalItem {
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  activeIngredient?: string;
  dosageForm?: string;
  strength?: string;
  unit: string;
  batchId: string;
  batchNumber: string;
  expDate: string;
  mfgDate?: string;
  currentStock: number;      // Tồn kho thực tế
  disposalQuantity: number;  // Số lượng tiêu hủy
  unitPrice?: number;
  totalAmount?: number;
  reason: string;            // 'Hết hạn sử dụng' | 'Biến chất / Đổi màu' | 'Hỏng bao bì / Ẩm mốc' | 'Thu hồi theo thông báo Bộ Y tế' | 'Khác'
  storageLocation?: string;
}

export interface MedicineDisposal {
  id: string;
  userId?: string;
  disposalCode: string;      // BB-HUY-2026-0001
  decisionNumber?: string;   // Số quyết định tiêu hủy: VD 18/QĐ-THCSĐT
  decisionDate?: string;     // Ngày ra quyết định
  disposalDate: string;      // Ngày lập biên bản (YYYY-MM-DD)
  schoolYear: string;        // Niên khóa (VD: 2025-2026, 2026-2027)
  councilMembers: DisposalCouncilMember[];
  items: MedicineDisposalItem[];
  totalQuantity: number;
  totalEstimatedAmount?: number;
  disposalMethod: string;    // Phương pháp tiêu hủy
  disposalLocation: string;  // Địa điểm thực hiện tiêu hủy
  witnessNotes?: string;     // Ghi nhận của hội đồng giám sát
  status: DisposalStatus;
  
  createdBy: string;
  createdByName: string;
  createdAt: string;

  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNotes?: string;

  executedBy?: string;
  executedByName?: string;
  executedAt?: string;
  
  inventoryTransactionId?: string; // Phiếu xuất kho tiêu hủy
  notes?: string;
  updatedAt?: string;
}

export interface StockInOutBalanceRow {
  id?: string;
  stt: number;
  date: string;
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  batchNumber: string;
  expDate: string;
  unit: string;
  openingStock: number;       // Tồn đầu kỳ
  importQuantity: number;     // Nhập trong kỳ
  exportQuantity: number;     // Xuất trong kỳ
  adjustmentQuantity: number; // Điều chỉnh trong kỳ (+ / -)
  closingStock: number;       // Tồn cuối kỳ = Tồn đầu + Nhập - Xuất + Điều chỉnh
  notes?: string;
}

export interface DataIntegrityIssue {
  id: string;
  type?: string;
  severity: 'error' | 'warning';
  category?: string;
  title?: string;
  description: string;
  referenceId?: string;
  medicineId?: string;
  medicineName?: string;
  batchNumber?: string;
  solution?: string;
  suggestedAction?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  targetId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  id?: string;
  userId?: string;
  schoolName: string;
  systemName: string;
  warningExpiringDays: number; // Mặc định 30 ngày (cho phép chỉnh 60, 90,...)
  warningNoticeDays: number;   // Mặc định 60 ngày
  clinicLocation: string;
  nurseInCharge: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockBalanceItem {
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  batchNumber: string;
  expDate: string;
  unit: string;
  openingStock: number;       // Tồn đầu
  importQuantity: number;     // Nhập trong kỳ
  exportQuantity: number;     // Xuất trong kỳ
  adjustmentQuantity?: number;// Điều chỉnh
  closingStock: number;       // Tồn cuối
  minStock: number;
  unitPrice?: number;
  totalValuation?: number;
  status: MedicineStatus;
  expiryAlert: ExpiryAlertLevel;
}

// ==========================================
// GIAI ĐOẠN 3: HỆ THỐNG QUẢN LÝ SỨC KHỎE HỌC SINH & PHÒNG Y TẾ
// ==========================================

export interface Student {
  id: string;
  userId?: string;
  studentCode: string;       // Mã học sinh (HS0001)
  fullName: string;          // Họ và tên
  birthDate: string;         // Ngày sinh (lưu trữ YYYY-MM-DD, hiển thị ngày/tháng/năm DD/MM/YYYY)
  gender: 'Nam' | 'Nữ';
  grade: number;             // 6, 7, 8, 9
  className: string;         // 6/1, 7/2,...
  schoolYear: string;        // 2026-2027
  citizenId?: string;        // Mã định danh cá nhân / CCCD
  healthInsuranceCode?: string; // Mã BHYT
  parentName?: string;       // Họ tên phụ huynh đại diện
  parentPhone?: string;      // Số điện thoại phụ huynh đại diện
  fatherName?: string;       // Họ và tên cha
  fatherPhone?: string;      // Số điện thoại cha
  motherName?: string;       // Họ và tên mẹ
  motherPhone?: string;      // Số điện thoại mẹ
  address?: string;          // Địa chỉ
  bloodType?: string;        // Nhóm máu (A, B, AB, O...)
  allergies?: string;        // Dị ứng (thức ăn, thuốc, phấn hoa...)
  chronicConditions?: string;// Bệnh nền (Hen suyễn, tim mạch, dạ dày...)
  specialAttention?: boolean;// Cần theo dõi sức khỏe đặc biệt
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentHealthProfile {
  id: string;
  userId?: string;
  studentId: string;
  studentCode: string;
  fullName: string;
  className: string;
  bloodType?: string;
  allergies?: string;
  chronicConditions?: string;
  visionLeft?: string;
  visionRight?: string;
  dentalCondition?: string;
  height?: number;           // cm
  weight?: number;           // kg
  bmi?: number;
  specialAttention: boolean;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  notes?: string;
  lastUpdated: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClinicVisitMedicineUsage {
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  batchId: string;
  batchNumber: string;
  expDate: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  dosageInstructions?: string;
}

export interface ClinicVisitSupplyUsage {
  supplyId: string;
  supplyCode: string;
  supplyName: string;
  quantity: number;
  unit: string;
}

export interface ClinicVisitVitals {
  temperature?: number;      // Nhiệt độ (°C)
  pulse?: number;            // Mạch (lần/phút)
  bloodPressure?: string;    // Huyết áp (mmHg) ví dụ 110/70
  respiratoryRate?: number;  // Nhịp thở
  spO2?: number;             // SpO2 (%)
  weight?: number;           // Cân nặng (kg)
  height?: number;           // Chiều cao (cm)
}

export interface SchoolStaff {
  id: string;
  userId?: string;
  staffCode: string;          // GV01, NV02,...
  fullName: string;           // Cô Đoàn Thị Minh Trang, Thầy Trần Văn Nam...
  gender: 'Nam' | 'Nữ';
  birthYear?: number;
  birthDate?: string;
  roleCategory: 'teacher' | 'staff'; // 'teacher' (Giáo viên) | 'staff' (Công nhân viên)
  roleType?: 'teacher' | 'staff';     // Alias for roleCategory
  department: string;         // 'Ban Giám Hiệu', 'Tổ Toán - Tin', 'Tổ Ngữ Văn', 'Tổ KHTN', 'Văn phòng', 'Bảo vệ - Phục vụ'...
  position: string;           // 'Hiệu trưởng', 'Phó Hiệu trưởng', 'Giáo viên', 'Tổ trưởng', 'Kế toán', 'Bảo vệ', 'Y tế'...
  phone?: string;
  bloodPressureBaseline?: string; // Huyết áp nền thường ngày (vd: 120/80 mmHg)
  allergies?: string;         // Tiền sử dị ứng thuốc/thực phẩm
  chronicConditions?: string; // Bệnh nền (Tăng huyết áp, Đau dạ dày, Thoái hóa cột sống, Đái tháo đường...)
  bloodType?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClinicVisit {
  id: string;
  userId?: string;
  visitCode: string;         // KB-2026-0001
  recipientType?: RecipientType; // 'student' | 'teacher' | 'staff' | 'other' (mặc định 'student')
  studentId: string;         // For student: studentId; For staff: staffId or `staff-${id}`
  studentCode: string;       // For student: studentCode; For staff: staffCode
  studentName: string;       // For student: studentName; For staff: staffName
  className: string;         // For student: className; For staff: department / tổ chuyên môn
  // Specific staff fields when recipient is teacher/staff
  staffId?: string;
  staffCode?: string;
  staffName?: string;
  department?: string;       // Tổ bộ môn / Bộ phận công tác
  position?: string;         // Chức vụ / Vị trí
  gender?: 'Nam' | 'Nữ';
  age?: number;
  visitDate: string;         // YYYY-MM-DD
  timeIn: string;            // HH:mm
  timeOut?: string;          // HH:mm
  dateTime?: string;         // Alias ISO or combined
  broughtBy?: string;        // Tự đến | Giáo viên | Bạn cùng lớp | Giám thị | Khác
  reasons: string[];         // Danh sách lý do đến phòng y tế
  reason?: string;           // Convenience alias for reasons.join(', ')
  customReason?: string;     // Lý do chi tiết khác
  initialCondition: string;  // Tình trạng ban đầu
  temperature?: number;      // Convenience alias for vitals.temperature
  pulse?: number;            // Convenience alias for vitals.pulse
  bloodPressure?: string;    // Convenience alias for vitals.bloodPressure
  respiratoryRate?: number;  // Convenience alias for vitals.respiratoryRate
  spO2?: number;             // Convenience alias for vitals.spO2
  vitals?: ClinicVisitVitals;
  treatmentType: string;     // Theo dõi, Sơ cứu, Nghỉ ngơi, Bàn giao phụ huynh, Chuyển cơ sở y tế...
  treatment?: string;        // Convenience alias for treatmentType / treatmentDetails
  treatmentDetails: string;  // Nội dung xử trí chi tiết
  medicinesUsed: ClinicVisitMedicineUsage[]; // Thuốc đã sử dụng (đã áp dụng FEFO)
  medicinesDispensed?: ClinicVisitMedicineUsage[]; // Alias for medicinesUsed
  suppliesUsed: ClinicVisitSupplyUsage[];     // Vật tư y tế đã sử dụng
  outcome: string;           // Đã ổn định về lớp | Đã đỡ trở lại làm việc | Nghỉ tại phòng y tế | Phụ huynh đón về | Chuyển viện | Đang theo dõi
  nextAction?: string;       // Hướng xử trí tiếp theo
  parentContacted: boolean;  // Đã liên hệ phụ huynh (hoặc người thân nếu là GV-CNV)
  parentContactNotes?: string;
  isTransferred: boolean;    // Có chuyển tuyến y tế không
  transferHospital?: string; // Cơ sở y tế chuyển đến
  performer: string;         // Cán bộ y tế thực hiện
  notes?: string;
  inventoryTransactionId?: string; // ID phiếu xuất kho tương ứng
  createdAt: string;
  updatedAt?: string;
}

export interface HealthEvent {
  id: string;
  userId?: string;
  eventCode: string;         // SK-2026-0001
  dateTime: string;          // ISO Date
  location: string;          // Sân trường, Lớp học, Nhà đa năng, Căng tin...
  eventType: 'Tai nạn' | 'Chấn thương' | 'Sốt cao' | 'Dịch bệnh nghi ngờ' | 'Ngất' | 'Dị ứng' | 'Sự cố khác';
  studentId?: string;
  studentCode?: string;
  studentName?: string;
  className?: string;
  description: string;
  initialCondition: string;
  treatment: string;
  witness?: string;
  performer: string;
  outcome: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HealthCheckup {
  id: string;
  userId?: string;
  checkupCode: string;       // KS-2026-0001
  checkupDate: string;       // YYYY-MM-DD
  schoolYear: string;        // 2026-2027
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  height: number;            // cm
  weight: number;            // kg
  bmi: number;
  pulse?: number;
  bloodPressure?: string;
  eyesightLeft: string;      // 10/10, 8/10,...
  eyesightRight: string;
  hasRefraction: boolean;    // Cận thị / loạn thị
  dentalCondition: string;   // Bình thường / Sâu răng / Viêm nướu...
  entCondition: string;      // Tai mũi họng: Bình thường / Viêm amiđan...
  scoliosis: boolean;        // Cong vẹo cột sống
  nutritionStatus: 'Bình thường' | 'Thừa cân' | 'Béo phì' | 'Suy dinh dưỡng';
  otherFindings?: string;
  recommendations?: string;  // Khuyến nghị gửi phụ huynh
  doctorOrStaff: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SchoolClass {
  id: string;
  userId?: string;
  name: string;              // 6/1, 6/2, 6A1, 7/1,...
  grade: number;             // 6, 7, 8, 9
  homeroomTeacher?: string;  // GVCN
  teacherPhone?: string;     // Số điện thoại GVCN
  room?: string;             // Phòng học
  totalStudents?: number;
  createdAt?: string;
  updatedAt?: string;
}

