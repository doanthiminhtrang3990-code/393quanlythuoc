import {
  Medicine,
  MedicineBatch,
  InventoryTransaction,
  Supplier,
  MedicalSupply,
  UsageRecord,
  InventoryCheck,
  AuditLog,
  AppSettings,
  MedicineStatus,
  ExpiryAlertLevel,
  StockBalanceItem,
  StockInOutBalanceRow,
  DataIntegrityIssue,
  User,
  UserRole,
  UserPermission,
  Student,
  StudentHealthProfile,
  ClinicVisit,
  ClinicVisitMedicineUsage,
  ClinicVisitSupplyUsage,
  HealthEvent,
  HealthCheckup,
  SchoolClass,
  SchoolStaff,
  SyncState,
  SyncStatus,
  MedicineDisposal,
  MedicineDisposalItem,
  DisposalCouncilMember,
  DisposalStatus,
} from '../types';
import {
  DEFAULT_CLASSES,
  INITIAL_STUDENTS,
  INITIAL_HEALTH_PROFILES,
  INITIAL_CLINIC_VISITS,
  INITIAL_HEALTH_EVENTS,
  INITIAL_HEALTH_CHECKUPS,
  CLINIC_REASONS,
  CLINIC_TREATMENTS,
} from './studentData';
import {
  INITIAL_STAFF_MEMBERS,
  STAFF_DEPARTMENTS,
  STAFF_CLINIC_REASONS,
  STAFF_CLINIC_OUTCOMES,
} from './staffData';
import {
  dbFirestore,
  auth,
  sanitizeForFirestore,
  handleFirestoreError,
  OperationType,
  testConnection,
  isFirestoreQuotaExhausted,
  resetFirestoreQuotaCircuitBreaker,
} from './firebase';
import {
  persistUserDoc,
  persistUserBatch,
  seedInitialUserData,
  checkUserDataExists,
  subscribeToUserSubcollections,
  isCloudSyncAllowed,
  syncStudentCollectionsToCloud,
  pushSharedSchoolClassesToCloud,
  pushSharedOperationalToCloud,
  pushSharedStudentsToCloud,
  loadSharedStudentsChunksFromCloud,
  subscribeToSharedSchoolSync,
  BatchWriteOp,
} from './firestoreRepo';
import {
  idbSaveStudentBundle,
  idbLoadStudentBundle,
  idbSaveOperationalBundle,
  idbLoadOperationalBundle,
} from './idbStorage';

export interface StorageDiagnostics {
  memoryStudentsCount: number;
  memoryClassesCount: number;
  memoryProfilesCount: number;
  idbDatabaseName: string;
  idbStudentsCount: number;
  idbClassesCount: number;
  idbUpdatedAt: string | null;
  localStorageStudentsCount: number;
  localStorageSizeKB: number;
  cloudSyncStatus: 'synced' | 'syncing' | 'quota_protected' | 'local';
  cloudSyncAllowed: boolean;
  quotaExhausted: boolean;
  firestorePath: string;
}
import firebaseConfig from '../../firebase-applet-config.json';
import {
  formatDateVN,
  formatDateFormulaVN,
  normalizeDateToISO,
  formatDateTimeVN,
  formatTime24H,
  normalizeManualTime24H,
  normalizeStudentClassName,
  extractGradeFromClassOrGrade,
  getCurrentDateISO,
  getCurrentTimeVN,
  matchesStudentSearch,
  getStudentSearchScore,
  cleanSearchQuery,
  removeVietnameseTones,
  maskStudentName,
} from '../utils/helpers';

const STORAGE_KEYS = {
  MEDICINES: 'thcs_dongthanh_medicines_v1',
  BATCHES: 'thcs_dongthanh_batches_v1',
  TRANSACTIONS: 'thcs_dongthanh_transactions_v1',
  SUPPLIERS: 'thcs_dongthanh_suppliers_v1',
  SUPPLIES: 'thcs_dongthanh_supplies_v1',
  USAGE_RECORDS: 'thcs_dongthanh_usage_v1',
  INVENTORY_CHECKS: 'thcs_dongthanh_checks_v1',
  AUDIT_LOGS: 'thcs_dongthanh_audit_v1',
  SETTINGS: 'thcs_dongthanh_settings_v1',
  USERS: 'thcs_dongthanh_users_v1',
  CURRENT_USER: 'thcs_dongthanh_current_user_v1',
  STUDENTS: 'thcs_dongthanh_students_v1',
  STUDENT_HEALTH_PROFILES: 'thcs_dongthanh_student_profiles_v1',
  CLINIC_VISITS: 'thcs_dongthanh_clinic_visits_v1',
  HEALTH_EVENTS: 'thcs_dongthanh_health_events_v1',
  HEALTH_CHECKUPS: 'thcs_dongthanh_health_checkups_v1',
  SCHOOL_CLASSES: 'thcs_dongthanh_school_classes_v1',
  DISPOSALS: 'thcs_dongthanh_disposals_v1',
  STAFF_MEMBERS: 'thcs_dongthanh_staff_members_v1',
  INITIALIZED_FLAG: 'thcs_dongthanh_app_initialized_v2',
};

export const FIXED_MEDICINES_CATALOG_VERSION = 'v7_official_30_meds_52_batches_exact_image_sync';

export const DEFAULT_SETTINGS: AppSettings = {
  schoolName: 'TRƯỜNG THCS ĐÔNG THẠNH',
  systemName: 'SỔ QUẢN LÝ THUỐC VÀ VẬT TƯ Y TẾ',
  warningExpiringDays: 30,
  warningNoticeDays: 60,
  clinicLocation: 'Phòng Y tế Học đường - Khu Hiệu Bộ',
  nurseInCharge: 'Nhân viên Y tế học đường',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, UserPermission> = {
  bgh: {
    canManageMedicine: true,
    canManageTransactions: true,
    canManageClinicVisits: true,
    canManageStudents: true,
    canManageInventoryCheck: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveAudits: true,
  },
  admin: {
    canManageMedicine: true,
    canManageTransactions: true,
    canManageClinicVisits: true,
    canManageStudents: true,
    canManageInventoryCheck: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveAudits: true,
  },
  medic: {
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

export const DEFAULT_USERS: User[] = [
  {
    id: 'role-admin',
    username: 'quantri',
    fullName: 'Quản trị',
    role: 'admin',
    email: '',
    phone: '',
    title: 'Nhiệm vụ Quản trị hệ thống',
    department: 'Quản trị & Phê duyệt hệ thống',
    status: 'active',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.admin },
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'role-medic',
    username: 'nhanvien_yte',
    fullName: 'Nhân viên Y tế',
    role: 'medic',
    email: '',
    phone: '',
    title: 'Nhiệm vụ Nhân viên Y tế',
    department: 'Phòng Y tế Học đường',
    status: 'active',
    permissions: { ...DEFAULT_ROLE_PERMISSIONS.medic },
    createdAt: '2026-01-01T08:00:00.000Z',
  },
];

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'bgh':
    case 'admin':
      return 'Quản trị';
    case 'medic':
    default:
      return 'Nhân viên Y tế';
  }
}

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-01',
    code: 'NCC-DHG',
    name: 'Công ty Cổ phần Dược phẩm Hậu Giang (DHG Pharma)',
    phone: '0292 3891 433',
    address: '288 Bis Nguyễn Văn Cừ, P. An Hòa, TP. Cần Thơ',
    contactPerson: 'Trần Văn Cường (Trình dược viên)',
    notes: 'Nhà cung cấp thuốc thiết yếu chính ngạch',
  },
  {
    id: 'sup-02',
    code: 'NCC-TTYT',
    name: 'Trung tâm Y tế Huyện Hóc Môn (Cấp theo chương trình YTHĐ)',
    phone: '028 3891 0244',
    address: 'Bà Triệu, Thị trấn Hóc Môn, Hóc Môn, TP. Hồ Chí Minh',
    contactPerson: 'Bs. Nguyễn Thanh Hà (Phụ trách Y tế học đường)',
    notes: 'Nguồn cấp ngân sách Nhà nước và thuốc sơ cứu học đường',
  },
  {
    id: 'sup-03',
    code: 'NCC-MED',
    name: 'Công ty TNHH Thiết Bị & Vật Tư Y Tế Sài Gòn',
    phone: '028 3927 8899',
    address: 'Quận 10, TP. Hồ Chí Minh',
    contactPerson: 'Lê Hoàng Oanh',
    notes: 'Cung cấp găng tay, nhiệt kế, bông băng, gạc tiệt trùng',
  },
];

// Fixed 30 medicines and medical supplies for school healthcare
// Danh mục 30 thuốc và vật tư y tế cố định của trường THCS Đông Thạnh theo sổ quản lý thực tế
export const INITIAL_MEDICINES: Medicine[] = [
  {
    id: 'med-01',
    code: 'TH-01-EUGICA-NGAM',
    name: 'Eugica ngậm',
    activeIngredient: '',
    dosageForm: 'Viên ngậm',
    strength: '2.5g',
    unit: 'Viên',
    packing: '100 viên/1 hộp',
    manufacturer: 'Mega Lifesciences',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 50,
    unitPrice: 1200,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Làm dịu cơn ho, giảm đau rát họng, khản tiếng',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-02',
    code: 'TH-02-EUGICA-XANH',
    name: 'Eugica xanh',
    activeIngredient: '',
    dosageForm: 'Viên nang mềm',
    strength: '100mg',
    unit: 'Viên',
    packing: '100 viên/1 hộp',
    manufacturer: 'Mega Lifesciences',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 50,
    unitPrice: 1500,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Trị ho, đau họng, sổ mũi, cảm cúm',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-03',
    code: 'TH-03-ALAXAN',
    name: 'Alaxan',
    activeIngredient: '',
    dosageForm: 'Viên nén',
    strength: '325 mg',
    unit: 'Viên',
    packing: '100 viên/1 hộp',
    manufacturer: 'United Pharma',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 50,
    unitPrice: 1800,
    storageLocation: 'Tủ A - Ngăn 2',
    notes: 'Giảm đau các cơn đau cơ khớp, bong gân thể dục, đau đầu',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-04',
    code: 'TH-04-HAP-CAM325',
    name: 'Hapacol Cam 325',
    activeIngredient: 'Paracetamol',
    dosageForm: 'Viên nén',
    strength: '325 mg',
    unit: 'Viên',
    packing: '100 viên/1 hộp',
    manufacturer: 'DHG Pharma',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 100,
    unitPrice: 1000,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Hạ sốt, giảm đau đầu nhẹ, đau cơ cho học sinh THCS',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-05',
    code: 'TH-05-HAP-CAM250',
    name: 'Hapacol Cam 250',
    activeIngredient: 'Paracetamol',
    dosageForm: 'Gói bột sủi',
    strength: '250 mg',
    unit: 'Gói',
    packing: '25 gói/1 hộp',
    manufacturer: 'DHG Pharma',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 50,
    unitPrice: 2200,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Hạ sốt nhanh cho học sinh khó uống thuốc viên, vị cam dễ uống',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-06',
    code: 'TH-06-HAP-BLUE',
    name: 'Hapacol Blue',
    activeIngredient: 'Paracetamol',
    dosageForm: 'Viên nén',
    strength: '500 mg',
    unit: 'Viên',
    packing: '100 viên/1 hộp',
    manufacturer: 'DHG Pharma',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 100,
    unitPrice: 1200,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Hạ sốt, giảm đau đầu, đau răng, đau nhức cơ cho học sinh lớn và giáo viên',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-07',
    code: 'TH-07-EFF-SUI',
    name: 'Efferalgan sủi',
    activeIngredient: 'Paracetamol',
    dosageForm: 'Viên sủi',
    strength: '500 mg',
    unit: 'Viên',
    packing: '16 viên/1 hộp',
    manufacturer: 'UPSA SAS',
    country: 'Pháp',
    supplierId: 'sup-01',
    minStock: 20,
    unitPrice: 4000,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Viên sủi hạ sốt nhanh, giảm đau cấp tốc cho phòng y tế',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-08',
    code: 'TH-08-DECOLGEN-ND',
    name: 'Decolgen ND',
    activeIngredient: '',
    dosageForm: 'Viên nén',
    strength: '500 mg',
    unit: 'Viên',
    packing: '120 viên/1 hộp',
    manufacturer: 'United Pharma',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 50,
    unitPrice: 1400,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Trị cảm sốt, nghẹt mũi, sổ mũi không gây buồn ngủ trong giờ học',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-09',
    code: 'TH-09-CATAFLAM',
    name: 'Cataflam',
    activeIngredient: 'Diclofenac kali',
    dosageForm: 'Viên bao đường',
    strength: '25 mg',
    unit: 'Viên',
    packing: '10 viên/1 hộp',
    manufacturer: 'Novartis',
    country: 'Thổ Nhĩ Kỳ / Thụy Sĩ',
    supplierId: 'sup-01',
    minStock: 20,
    unitPrice: 4500,
    storageLocation: 'Tủ A - Ngăn 2',
    notes: 'Giảm đau sau chấn thương, viêm đau răng cấp, đau bụng kinh nữ sinh',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-10',
    code: 'TH-10-ALUMINA',
    name: 'Alumina',
    activeIngredient: '',
    dosageForm: 'Viên nhai',
    strength: '',
    unit: 'Viên',
    packing: '60 viên/1 hộp',
    manufacturer: 'Việt Nam',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 20,
    unitPrice: 1200,
    storageLocation: 'Tủ A - Ngăn 2',
    notes: 'Giảm cơn đau dạ dày cấp, trung hòa axit, ợ nóng khi học sinh bỏ bữa',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-11',
    code: 'TH-11-BERBERAL10',
    name: 'Berberal 10',
    activeIngredient: '',
    dosageForm: 'Viên bao đường',
    strength: '10 mg',
    unit: 'Viên',
    packing: '100 viên/1 hộp',
    manufacturer: 'OPC Pharma',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 30,
    unitPrice: 500,
    storageLocation: 'Tủ A - Ngăn 2',
    notes: 'Trị rối loạn tiêu hóa, tiêu chảy nhẹ do thức ăn canteen',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-12',
    code: 'TH-12-BERBERAL100',
    name: 'Berberal 100',
    activeIngredient: '',
    dosageForm: 'Viên bao phim',
    strength: '100 mg',
    unit: 'Viên',
    packing: '100 viên/1 hộp',
    manufacturer: 'OPC Pharma',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 30,
    unitPrice: 1000,
    storageLocation: 'Tủ A - Ngăn 2',
    notes: 'Trị tiêu chảy nhiễm trùng, viêm ruột cấp cho học sinh lớn',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-13',
    code: 'TH-13-CLOPHEN4',
    name: 'Clopheniramin 4',
    activeIngredient: 'Clopheniramin maleate',
    dosageForm: 'Viên nén',
    strength: '4 mg',
    unit: 'Viên',
    packing: '200 viên/1 hộp',
    manufacturer: 'Mekophar',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 50,
    unitPrice: 300,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Chống dị ứng, mề đay, ngứa do côn trùng cắn, viêm mũi dị ứng',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-14',
    code: 'TH-14-CALCIUM',
    name: 'Calcium hasan',
    activeIngredient: '',
    dosageForm: 'Viên sủi',
    strength: '500 mg',
    unit: 'Viên',
    packing: '20 viên/1 hộp',
    manufacturer: 'Hasan-Dermapharm',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 20,
    unitPrice: 2000,
    storageLocation: 'Tủ A - Ngăn 3',
    notes: 'Hỗ trợ hạ canxi huyết, co giật tetani, ngất xỉu khi tập thể dục',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-15',
    code: 'TH-15-UPSAC',
    name: 'Upsa C',
    activeIngredient: 'Vitamin C',
    dosageForm: 'Viên sủi',
    strength: '1 g',
    unit: 'Viên',
    packing: '10 viên/1 hộp',
    manufacturer: 'UPSA SAS',
    country: 'Pháp',
    supplierId: 'sup-01',
    minStock: 20,
    unitPrice: 3500,
    storageLocation: 'Tủ A - Ngăn 1',
    notes: 'Bồi bổ, giải nhiệt, nâng cao sức đề kháng khi mệt mỏi, say nắng',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-16',
    code: 'TH-16-NACL-MAT',
    name: 'Nước muối nhỏ mắt',
    activeIngredient: 'Natri clorid 0,9%',
    dosageForm: 'Dung dịch nhỏ mắt / mũi',
    strength: '10ml',
    unit: 'Lọ',
    packing: '10 lọ/1 lốc',
    manufacturer: 'Pharmedic',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 20,
    unitPrice: 4000,
    storageLocation: 'Tủ B - Ngăn 1',
    notes: 'Rửa mắt khi có dị vật, bụi bẩn trong giờ thể dục, vệ sinh mũi',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-17',
    code: 'TH-17-NACL-SINHLY',
    name: 'Nước muối sinh lý',
    activeIngredient: 'Natri clorid 0,9%',
    dosageForm: 'Dung dịch rửa',
    strength: '500 ML',
    unit: 'Chai',
    packing: 'Chai 500ml',
    manufacturer: 'Pharmedic',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 10,
    unitPrice: 8000,
    storageLocation: 'Tủ B - Ngăn 2',
    notes: 'Dung dịch rửa sạch vết thương trầy xước té ngã, súc họng sạch khuẩn',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-18',
    code: 'TH-18-DAU-PHATLINH',
    name: 'Dầu phật linh nhỏ',
    activeIngredient: '',
    dosageForm: 'Dầu xoa bóp',
    strength: '1,5ml',
    unit: 'Chai',
    packing: '10 chai/1 hộp',
    manufacturer: 'Trường Sơn',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 10,
    unitPrice: 7000,
    storageLocation: 'Tủ B - Ngăn 1',
    notes: 'Xoa bóp giảm đau bụng lạnh, trúng gió, nhức đầu, côn trùng cắn',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-19',
    code: 'TH-19-DAUXANH-TS',
    name: 'Dầu Xanh Trường sơn lớn',
    activeIngredient: '',
    dosageForm: 'Dầu xoa bóp',
    strength: '12 ml',
    unit: 'Chai',
    packing: '12 chai/1 hộp',
    manufacturer: 'Trường Sơn',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 10,
    unitPrice: 28000,
    storageLocation: 'Tủ B - Ngăn 1',
    notes: 'Xoa bóp nhức mỏi, cảm cúm, đau bụng, nghẹt mũi cho giáo viên và HS',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-20',
    code: 'TH-20-DAU-MUU',
    name: 'Dầu mù u',
    activeIngredient: '',
    dosageForm: 'Dầu bôi ngoài da',
    strength: '12 ml',
    unit: 'Lọ',
    packing: 'Lọ 12ml',
    manufacturer: 'Dược liệu TW5',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 5,
    unitPrice: 15000,
    storageLocation: 'Tủ B - Ngăn 1',
    notes: 'Làm dịu vết bỏng nước sôi canteen, trầy xước da, thúc đẩy lành sẹo',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-21',
    code: 'TH-21-OXY-GIA',
    name: 'Oxy già',
    activeIngredient: '',
    dosageForm: 'Dung dịch sát khuẩn',
    strength: '60 ml',
    unit: 'Chai',
    packing: '10 chai/1 lốc',
    manufacturer: 'Pharmedic',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 10,
    unitPrice: 5000,
    storageLocation: 'Tủ B - Ngăn 2',
    notes: 'Rửa vết thương nhiễm trùng, vết té dính đất cát làm sạch dị vật',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-22',
    code: 'TH-22-ALCOL-90',
    name: 'Alcol 90',
    activeIngredient: '',
    dosageForm: 'Cồn y tế',
    strength: '60 ml',
    unit: 'Chai',
    packing: '10 chai/1 lốc',
    manufacturer: 'Pharmedic',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 10,
    unitPrice: 6000,
    storageLocation: 'Tủ B - Ngăn 2',
    notes: 'Sát trùng kéo, kẹp panh, khay hạt đậu, dụng cụ sơ cứu y tế',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-23',
    code: 'TH-23-ALCOL-70',
    name: 'Alcol 70',
    activeIngredient: '',
    dosageForm: 'Cồn y tế sát trùng da',
    strength: '60 ml',
    unit: 'Chai',
    packing: '10 chai/1 lốc',
    manufacturer: 'Pharmedic',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 15,
    unitPrice: 5500,
    storageLocation: 'Tủ B - Ngăn 2',
    notes: 'Sát khuẩn tay, sát trùng da trước khi xử lý sơ cứu',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-24',
    code: 'TH-24-POVIDIN',
    name: 'Povidin',
    activeIngredient: '',
    dosageForm: 'Dung dịch sát khuẩn',
    strength: '60 ml',
    unit: 'Chai',
    packing: '10 chai/1 lốc',
    manufacturer: 'Pharmedic',
    country: 'Việt Nam',
    supplierId: 'sup-01',
    minStock: 10,
    unitPrice: 12000,
    storageLocation: 'Tủ B - Ngăn 2',
    notes: 'Sát trùng da, vết thương, vết trầy rách ngoài da không gây xót rát',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-25',
    code: 'VT-25-BANGKEO-CANHAN',
    name: 'Băng keo cá nhân',
    activeIngredient: '',
    dosageForm: 'Miếng dán vô trùng',
    strength: '9x72 mm',
    unit: 'Hộp',
    packing: '102 miếng/1 H',
    manufacturer: 'Urgo / Young Chemical',
    country: 'Việt Nam',
    supplierId: 'sup-02',
    minStock: 200,
    unitPrice: 35000,
    storageLocation: 'Tủ C - Ngăn 1',
    notes: 'Bảo vệ các vết đứt tay, trầy xước da nhỏ sau khi sát trùng',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-26',
    code: 'VT-26-BANGKEO-LUA',
    name: 'Băng keo lụa',
    activeIngredient: '',
    dosageForm: 'Cuộn băng keo',
    strength: '2,5cmx5m',
    unit: 'Cuộn',
    packing: 'Cuộn 2,5cmx5m',
    manufacturer: 'Urgo',
    country: 'Việt Nam',
    supplierId: 'sup-02',
    minStock: 10,
    unitPrice: 16000,
    storageLocation: 'Tủ C - Ngăn 1',
    notes: 'Dính chắc, thoáng khí cố định miếng gạc băng vết thương lớn',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-27',
    code: 'VT-27-GON-BT-VIEN',
    name: 'Gòn bạch tuyết viên',
    activeIngredient: '',
    dosageForm: 'Bông viên',
    strength: '',
    unit: 'Bịch',
    packing: 'Bịch gòn viên',
    manufacturer: 'Bạch Tuyết',
    country: 'Việt Nam',
    supplierId: 'sup-02',
    minStock: 10,
    unitPrice: 22000,
    storageLocation: 'Tủ C - Ngăn 2',
    notes: 'Viên bông gòn tiệt trùng sẵn sàng thấm cồn lau rửa vết thương',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-28',
    code: 'VT-28-GON-BACHTUYET',
    name: 'Gòn Bạch tuyết',
    activeIngredient: '',
    dosageForm: 'Bông cuộn',
    strength: '',
    unit: 'Bịch',
    packing: 'Bịch bông cuộn',
    manufacturer: 'Bạch Tuyết',
    country: 'Việt Nam',
    supplierId: 'sup-02',
    minStock: 5,
    unitPrice: 38000,
    storageLocation: 'Tủ C - Ngăn 2',
    notes: 'Bông cuộn mềm 100% tự nhiên dùng thấm hút dịch và máu',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-29',
    code: 'VT-29-GAC-TIETTRUNG',
    name: 'Gạc tiệt trùng nhỏ',
    activeIngredient: '',
    dosageForm: 'Gạc miếng vô trùng',
    strength: '',
    unit: 'Bịch',
    packing: 'Bịch gạc tiệt trùng',
    manufacturer: 'Bảo Thạch',
    country: 'Việt Nam',
    supplierId: 'sup-02',
    minStock: 30,
    unitPrice: 8000,
    storageLocation: 'Tủ C - Ngăn 2',
    notes: 'Đắp vết thương, băng ép cầm máu, thấm dịch chống nhiễm trùng',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'med-30',
    code: 'VT-30-BANGTHUN',
    name: 'Băng thun 1 móc, 2 móc, 3 móc',
    activeIngredient: '',
    dosageForm: 'Cuộn băng chun co giãn',
    strength: '',
    unit: 'Cuộn',
    packing: 'Cuộn có móc cài',
    manufacturer: 'Bảo Thạch',
    country: 'Việt Nam',
    supplierId: 'sup-02',
    minStock: 15,
    unitPrice: 12000,
    storageLocation: 'Tủ C - Ngăn 1',
    notes: 'Băng ép cố định khớp khi học sinh bị lật cổ chân, bong gân thể thao',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
];

// Danh sách 52 lô thuốc và hạn sử dụng thực tế tương ứng với 30 mặt hàng theo sổ y tế học đường
export const INITIAL_BATCHES: MedicineBatch[] = [
  {
    id: 'batch-01-1',
    medicineId: 'med-01',
    batchNumber: '050525',
    mfgDate: '2025-05-10',
    expDate: '2027-05-10',
    quantity: 300,
    initialQuantity: 300,
    unitPrice: 1200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-01-2',
    medicineId: 'med-01',
    batchNumber: '030625',
    mfgDate: '2025-06-17',
    expDate: '2027-06-17',
    quantity: 100,
    initialQuantity: 100,
    unitPrice: 1200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-02-1',
    medicineId: 'med-02',
    batchNumber: '050525',
    mfgDate: '2025-05-09',
    expDate: '2027-05-09',
    quantity: 470,
    initialQuantity: 470,
    unitPrice: 1500,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-03-1',
    medicineId: 'med-03',
    batchNumber: '220951',
    mfgDate: '2022-10-07',
    expDate: '2026-10-06',
    quantity: 100,
    initialQuantity: 100,
    unitPrice: 1800,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-03-2',
    medicineId: 'med-03',
    batchNumber: '613291',
    mfgDate: '2026-07-07',
    expDate: '2030-07-06',
    quantity: 100,
    initialQuantity: 100,
    unitPrice: 1800,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-04-1',
    medicineId: 'med-04',
    batchNumber: '040724',
    mfgDate: '2024-07-29',
    expDate: '2027-07-29',
    quantity: 360,
    initialQuantity: 360,
    unitPrice: 1000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-04-2',
    medicineId: 'med-04',
    batchNumber: '020525',
    mfgDate: '2025-05-21',
    expDate: '2028-05-21',
    quantity: 1000,
    initialQuantity: 1000,
    unitPrice: 1000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-05-1',
    medicineId: 'med-05',
    batchNumber: '121223',
    mfgDate: '2023-12-09',
    expDate: '2026-12-09',
    quantity: 37,
    initialQuantity: 37,
    unitPrice: 2200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-05-2',
    medicineId: 'med-05',
    batchNumber: '090524',
    mfgDate: '2024-05-05',
    expDate: '2027-05-05',
    quantity: 24,
    initialQuantity: 24,
    unitPrice: 2200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-05-3',
    medicineId: 'med-05',
    batchNumber: '070724',
    mfgDate: '2024-07-14',
    expDate: '2027-07-14',
    quantity: 38,
    initialQuantity: 38,
    unitPrice: 2200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-05-4',
    medicineId: 'med-05',
    batchNumber: '080525',
    mfgDate: '2025-05-22',
    expDate: '2028-05-22',
    quantity: 240,
    initialQuantity: 240,
    unitPrice: 2200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-06-1',
    medicineId: 'med-06',
    batchNumber: '040824A',
    mfgDate: '2024-08-23',
    expDate: '2027-08-23',
    quantity: 98,
    initialQuantity: 98,
    unitPrice: 1200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-06-2',
    medicineId: 'med-06',
    batchNumber: '050625C',
    mfgDate: '2025-06-06',
    expDate: '2028-06-06',
    quantity: 1000,
    initialQuantity: 1000,
    unitPrice: 1200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-07-1',
    medicineId: 'med-07',
    batchNumber: 'B4262',
    mfgDate: '2024-03-18',
    expDate: '2027-03-18',
    quantity: 26,
    initialQuantity: 26,
    unitPrice: 4000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-07-2',
    medicineId: 'med-07',
    batchNumber: 'B7911',
    mfgDate: '2025-02-10',
    expDate: '2028-02-10',
    quantity: 80,
    initialQuantity: 80,
    unitPrice: 4000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-07-3',
    medicineId: 'med-07',
    batchNumber: 'B9463',
    mfgDate: '2025-06-30',
    expDate: '2028-06-30',
    quantity: 80,
    initialQuantity: 80,
    unitPrice: 4000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-08-1',
    medicineId: 'med-08',
    batchNumber: '503491',
    mfgDate: '2025-03-10',
    expDate: '2028-03-09',
    quantity: 240,
    initialQuantity: 240,
    unitPrice: 1400,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-09-1',
    medicineId: 'med-09',
    batchNumber: 'A01TRE',
    mfgDate: '2025-02-01',
    expDate: '2027-01-31',
    quantity: 69,
    initialQuantity: 69,
    unitPrice: 4500,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-10-1',
    medicineId: 'med-10',
    batchNumber: '24005A',
    mfgDate: '2024-03-07',
    expDate: '2027-03-07',
    quantity: 92,
    initialQuantity: 92,
    unitPrice: 1200,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-11-1',
    medicineId: 'med-11',
    batchNumber: '14230525',
    mfgDate: '2025-05-23',
    expDate: '2028-05-23',
    quantity: 100,
    initialQuantity: 100,
    unitPrice: 500,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-12-1',
    medicineId: 'med-12',
    batchNumber: '25015CN',
    mfgDate: '2025-07-23',
    expDate: '2029-07-23',
    quantity: 100,
    initialQuantity: 100,
    unitPrice: 1000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-13-1',
    medicineId: 'med-13',
    batchNumber: '010425',
    mfgDate: '2025-04-11',
    expDate: '2028-04-11',
    quantity: 200,
    initialQuantity: 200,
    unitPrice: 300,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-15-1',
    medicineId: 'med-15',
    batchNumber: 'B9760',
    mfgDate: '2025-06-10',
    expDate: '2027-06-10',
    quantity: 20,
    initialQuantity: 20,
    unitPrice: 3500,
    supplierId: 'sup-01',
    storageLocation: 'Tủ A - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-16-1',
    medicineId: 'med-16',
    batchNumber: '6330824',
    mfgDate: '2024-08-20',
    expDate: '2027-02-20',
    quantity: 25,
    initialQuantity: 25,
    unitPrice: 4000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-16-2',
    medicineId: 'med-16',
    batchNumber: '6230425',
    mfgDate: '2025-04-23',
    expDate: '2027-10-23',
    quantity: 30,
    initialQuantity: 30,
    unitPrice: 4000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-16-3',
    medicineId: 'med-16',
    batchNumber: '12811025',
    mfgDate: '2025-10-15',
    expDate: '2028-04-15',
    quantity: 20,
    initialQuantity: 20,
    unitPrice: 4000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-17-1',
    medicineId: 'med-17',
    batchNumber: '050725',
    mfgDate: '2025-07-05',
    expDate: '2028-07-05',
    quantity: 5,
    initialQuantity: 5,
    unitPrice: 8000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-18-1',
    medicineId: 'med-18',
    batchNumber: '061225',
    mfgDate: '2025-12-25',
    expDate: '2028-12-25',
    quantity: 19,
    initialQuantity: 19,
    unitPrice: 7000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-18-2',
    medicineId: 'med-18',
    batchNumber: '70426',
    mfgDate: '2026-04-23',
    expDate: '2029-04-23',
    quantity: 10,
    initialQuantity: 10,
    unitPrice: 7000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-19-1',
    medicineId: 'med-19',
    batchNumber: '050725',
    mfgDate: '2025-07-29',
    expDate: '2028-07-29',
    quantity: 2,
    initialQuantity: 2,
    unitPrice: 28000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-19-2',
    medicineId: 'med-19',
    batchNumber: '020126',
    mfgDate: '2026-01-08',
    expDate: '2029-01-08',
    quantity: 12,
    initialQuantity: 12,
    unitPrice: 28000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-19-3',
    medicineId: 'med-19',
    batchNumber: '020626',
    mfgDate: '2026-06-05',
    expDate: '2029-06-05',
    quantity: 12,
    initialQuantity: 12,
    unitPrice: 28000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-20-1',
    medicineId: 'med-20',
    batchNumber: 'C0146',
    mfgDate: '2026-06-22',
    expDate: '2029-06-21',
    quantity: 3,
    initialQuantity: 3,
    unitPrice: 15000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-20-2',
    medicineId: 'med-20',
    batchNumber: '0120425',
    mfgDate: '2025-04-02',
    expDate: '2030-04-02',
    quantity: 2,
    initialQuantity: 2,
    unitPrice: 15000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-21-1',
    medicineId: 'med-21',
    batchNumber: '24010',
    mfgDate: '2024-02-26',
    expDate: '2027-02-26',
    quantity: 6,
    initialQuantity: 6,
    unitPrice: 5000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-21-2',
    medicineId: 'med-21',
    batchNumber: '020425',
    mfgDate: '2025-04-24',
    expDate: '2028-04-24',
    quantity: 10,
    initialQuantity: 10,
    unitPrice: 5000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-21-3',
    medicineId: 'med-21',
    batchNumber: '04082025',
    mfgDate: '2025-08-04',
    expDate: '2028-08-04',
    quantity: 10,
    initialQuantity: 10,
    unitPrice: 5000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-22-1',
    medicineId: 'med-22',
    batchNumber: '25018',
    mfgDate: '2025-07-28',
    expDate: '2028-07-28',
    quantity: 6,
    initialQuantity: 6,
    unitPrice: 6000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-23-1',
    medicineId: 'med-23',
    batchNumber: '21032025',
    mfgDate: '2025-03-21',
    expDate: '2028-03-21',
    quantity: 19,
    initialQuantity: 19,
    unitPrice: 5500,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-23-2',
    medicineId: 'med-23',
    batchNumber: '08012026',
    mfgDate: '2026-01-08',
    expDate: '2029-01-07',
    quantity: 10,
    initialQuantity: 10,
    unitPrice: 5500,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-24-1',
    medicineId: 'med-24',
    batchNumber: '0011024',
    mfgDate: '2024-10-17',
    expDate: '2026-10-17',
    quantity: 19,
    initialQuantity: 19,
    unitPrice: 12000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-24-2',
    medicineId: 'med-24',
    batchNumber: '0330825',
    mfgDate: '2025-08-25',
    expDate: '2027-08-25',
    quantity: 10,
    initialQuantity: 10,
    unitPrice: 12000,
    supplierId: 'sup-01',
    storageLocation: 'Tủ B - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-25-1',
    medicineId: 'med-25',
    batchNumber: '010625',
    mfgDate: '2025-06-01',
    expDate: '2028-06-01',
    quantity: 102,
    initialQuantity: 102,
    unitPrice: 35000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-25-2',
    medicineId: 'med-25',
    batchNumber: '010925',
    mfgDate: '2025-09-15',
    expDate: '2028-09-15',
    quantity: 204,
    initialQuantity: 204,
    unitPrice: 35000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-25-3',
    medicineId: 'med-25',
    batchNumber: '011025',
    mfgDate: '2025-10-15',
    expDate: '2028-10-15',
    quantity: 102,
    initialQuantity: 102,
    unitPrice: 35000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-25-4',
    medicineId: 'med-25',
    batchNumber: '011125',
    mfgDate: '2025-11-22',
    expDate: '2028-11-22',
    quantity: 612,
    initialQuantity: 612,
    unitPrice: 35000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-25-5',
    medicineId: 'med-25',
    batchNumber: '31157',
    mfgDate: '2026-06-20',
    expDate: '2030-05-31',
    quantity: 510,
    initialQuantity: 510,
    unitPrice: 35000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-26-1',
    medicineId: 'med-26',
    batchNumber: '01.2025',
    mfgDate: '2025-01-01',
    expDate: '2029-01-01',
    quantity: 12,
    initialQuantity: 12,
    unitPrice: 16000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-27-1',
    medicineId: 'med-27',
    batchNumber: 'LO-GONVIEN',
    mfgDate: '2025-01-01',
    expDate: '2029-01-01',
    quantity: 27,
    initialQuantity: 27,
    unitPrice: 22000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-28-1',
    medicineId: 'med-28',
    batchNumber: 'LO-GONBT',
    mfgDate: '2025-01-01',
    expDate: '2029-01-01',
    quantity: 10,
    initialQuantity: 10,
    unitPrice: 38000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-29-1',
    medicineId: 'med-29',
    batchNumber: 'LO-GACTT',
    mfgDate: '2025-01-01',
    expDate: '2029-01-01',
    quantity: 70,
    initialQuantity: 70,
    unitPrice: 8000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 2',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'batch-30-1',
    medicineId: 'med-30',
    batchNumber: 'LO-BANGTHUN',
    mfgDate: '2025-01-01',
    expDate: '2029-01-01',
    quantity: 24,
    initialQuantity: 24,
    unitPrice: 12000,
    supplierId: 'sup-02',
    storageLocation: 'Tủ C - Ngăn 1',
    isDemo: false,
    createdAt: '2026-08-15T08:00:00.000Z',
    updatedAt: '2026-08-15T08:00:00.000Z',
  },
];
export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: 'tx-01',
    transactionCode: 'PN-2026-001',
    type: 'import',
    date: '2026-08-20',
    source: 'Ngân sách y tế trường học năm học 2026-2027',
    supplierId: 'sup-01',
    deliverer: 'Trần Văn Cường (DHG Pharma)',
    receiver: 'Đỗ Thị Mai Trang (Cán bộ YTHĐ)',
    performer: 'Đỗ Thị Mai Trang',
    notes: 'Nhập kiện thuốc dự trù đầu năm học cho phòng y tế học đường',
    status: 'completed',
    items: [
      {
        medicineId: 'med-06',
        medicineCode: 'TH-HAP-BLUE500',
        medicineName: 'Hapacol Blue (500mg/ 100 viên)',
        batchId: 'batch-06',
        batchNumber: 'HB-2506',
        quantity: 100,
        unitPrice: 1200,
        totalAmount: 120000,
        unit: 'Viên',
        expDate: '2028-06-15',
      },
      {
        medicineId: 'med-05',
        medicineCode: 'TH-HAP-CAM250',
        medicineName: 'Hapacol Cam (250mg / 25 gói)',
        batchId: 'batch-05',
        batchNumber: 'HG-2505',
        quantity: 25,
        unitPrice: 2200,
        totalAmount: 55000,
        unit: 'Gói',
        expDate: '2027-11-30',
      },
    ],
    totalAmount: 175000,
    isDemo: false,
    createdAt: '2026-08-20T09:30:00.000Z',
  },
  {
    id: 'tx-02',
    transactionCode: 'PX-2026-001',
    type: 'export',
    date: '2026-09-08',
    recipientName: 'Lê Văn Minh',
    recipientType: 'student',
    recipientClass: '8A2',
    purpose: 'Sốt nhẹ 38.6 độ trong giờ học thể dục, sau đó cho nằm nghỉ phòng y tế',
    performer: 'Đỗ Thị Mai Trang (Cán bộ YTHĐ)',
    notes: 'Cấp 1 viên Hapacol Blue 500mg uống sau ăn nhẹ, đã thông báo cho GVCN',
    status: 'completed',
    items: [
      {
        medicineId: 'med-06',
        medicineCode: 'TH-HAP-BLUE500',
        medicineName: 'Hapacol Blue (500mg/ 100 viên)',
        batchId: 'batch-06',
        batchNumber: 'HB-2506',
        quantity: 1,
        unitPrice: 1200,
        totalAmount: 1200,
        unit: 'Viên',
        expDate: '2028-06-15',
      },
    ],
    totalAmount: 1200,
    isDemo: false,
    createdAt: '2026-09-08T08:45:00.000Z',
  },
  {
    id: 'tx-03',
    transactionCode: 'PX-2026-002',
    type: 'export',
    date: '2026-09-10',
    recipientName: 'Cô Nguyễn Thị Hoa',
    recipientType: 'teacher',
    recipientClass: 'Tổ Văn - Sử',
    purpose: 'Đau đầu, mệt mỏi sau 4 tiết dạy',
    performer: 'Đỗ Thị Mai Trang (Cán bộ YTHĐ)',
    notes: 'Cấp 1 viên Hapacol Blue 500mg',
    status: 'completed',
    items: [
      {
        medicineId: 'med-06',
        medicineCode: 'TH-HAP-BLUE500',
        medicineName: 'Hapacol Blue (500mg/ 100 viên)',
        batchId: 'batch-06',
        batchNumber: 'HB-2506',
        quantity: 1,
        unitPrice: 1200,
        totalAmount: 1200,
        unit: 'Viên',
        expDate: '2028-06-15',
      },
    ],
    totalAmount: 1200,
    isDemo: false,
    createdAt: '2026-09-10T11:15:00.000Z',
  },
  {
    id: 'tx-04',
    transactionCode: 'PX-2026-003',
    type: 'export',
    date: '2026-09-12',
    recipientName: 'Trần Bảo Nam',
    recipientType: 'student',
    recipientClass: '6A4',
    purpose: 'Sốt cao, đau mỏi khi học thể dục ngoài trời',
    performer: 'Đỗ Thị Mai Trang (Cán bộ YTHĐ)',
    notes: 'Hòa 1 gói Hapacol Cam 250mg cho học sinh uống',
    status: 'completed',
    items: [
      {
        medicineId: 'med-05',
        medicineCode: 'TH-HAP-CAM250',
        medicineName: 'Hapacol Cam (250mg / 25 gói)',
        batchId: 'batch-05',
        batchNumber: 'HG-2505',
        quantity: 1,
        unitPrice: 2200,
        totalAmount: 2200,
        unit: 'Gói',
        expDate: '2027-11-30',
      },
    ],
    totalAmount: 2200,
    isDemo: false,
    createdAt: '2026-09-12T14:20:00.000Z',
  },
];

export const INITIAL_USAGE_RECORDS: UsageRecord[] = [
  {
    id: 'rec-01',
    transactionId: 'tx-02',
    date: '2026-09-08',
    recipientName: 'Lê Văn Minh',
    recipientType: 'student',
    recipientClass: '8A2',
    medicineId: 'med-06',
    medicineName: 'Hapacol Blue (500mg/ 100 viên)',
    batchNumber: 'HB-2506',
    quantity: 1,
    unit: 'Viên',
    purpose: 'Sốt nhẹ 38.6 độ, nằm nghỉ phòng y tế',
    performer: 'Đỗ Thị Mai Trang',
    notes: 'Đã báo GVCN và phụ huynh',
    isDemo: false,
  },
  {
    id: 'rec-02',
    transactionId: 'tx-03',
    date: '2026-09-10',
    recipientName: 'Cô Nguyễn Thị Hoa',
    recipientType: 'teacher',
    recipientClass: 'Tổ Văn - Sử',
    medicineId: 'med-06',
    medicineName: 'Hapacol Blue (500mg/ 100 viên)',
    batchNumber: 'HB-2506',
    quantity: 1,
    unit: 'Viên',
    purpose: 'Đau đầu, căng thẳng',
    performer: 'Đỗ Thị Mai Trang',
    notes: 'Nghỉ 20 phút rồi về lớp',
    isDemo: false,
  },
  {
    id: 'rec-03',
    transactionId: 'tx-04',
    date: '2026-09-12',
    recipientName: 'Trần Bảo Nam',
    recipientType: 'student',
    recipientClass: '6A4',
    medicineId: 'med-05',
    medicineName: 'Hapacol Cam (250mg / 25 gói)',
    batchNumber: 'HG-2505',
    quantity: 1,
    unit: 'Gói',
    purpose: 'Hạ sốt nhanh cho học sinh',
    performer: 'Đỗ Thị Mai Trang',
    notes: 'Học sinh hồi phục tốt',
    isDemo: false,
  },
];

export const INITIAL_SUPPLIES: MedicalSupply[] = [
  {
    id: 'sup-item-01',
    code: 'VT-BANGCA',
    name: 'Băng dán vết thương cá nhân Urgo',
    category: 'Băng gạc sơ cứu',
    unit: 'Miếng',
    quantity: 180,
    minStock: 50,
    importDate: '2026-08-20',
    expDate: '2028-06-30',
    supplierId: 'sup-03',
    storageLocation: 'Tủ C - Ngăn băng gạc',
    notes: 'Dán vết xước tay chân nhẹ khi vui chơi thể thao',
    isDemo: true,
  },
  {
    id: 'sup-item-02',
    code: 'VT-GACYTE',
    name: 'Gạc y tế tiệt trùng 8x10cm (Gói 10 miếng)',
    category: 'Băng gạc sơ cứu',
    unit: 'Gói',
    quantity: 25,
    minStock: 10,
    importDate: '2026-08-20',
    expDate: '2027-12-31',
    supplierId: 'sup-03',
    storageLocation: 'Tủ C - Ngăn băng gạc',
    notes: 'Đắp che vết thương hở sau khi rửa sạch sát khuẩn',
    isDemo: true,
  },
  {
    id: 'sup-item-03',
    code: 'VT-BANGCHUN',
    name: 'Băng cuộn chun y tế 8cm x 2m',
    category: 'Băng gạc sơ cứu',
    unit: 'Cuộn',
    quantity: 8,
    minStock: 10, // Sắp hết
    importDate: '2026-08-20',
    expDate: '2029-01-01',
    supplierId: 'sup-03',
    storageLocation: 'Tủ C - Ngăn băng gạc',
    notes: 'Cố định nẹp hoặc băng ép cầm máu',
    isDemo: true,
  },
  {
    id: 'sup-item-04',
    code: 'VT-NHIETKE',
    name: 'Nhiệt kế điện tử đo trán Omron MC-720',
    category: 'Dụng cụ khám sơ cứu',
    unit: 'Cái',
    quantity: 3,
    minStock: 2,
    importDate: '2026-08-10',
    supplierId: 'sup-03',
    storageLocation: 'Bàn trực khám y tế',
    notes: 'Đo thân nhiệt nhanh không tiếp xúc cho học sinh',
    isDemo: true,
  },
  {
    id: 'sup-item-05',
    code: 'VT-GANGTAY',
    name: 'Găng tay y tế cao su có bột (Hộp 50 đôi)',
    category: 'Vật tư bảo hộ',
    unit: 'Hộp',
    quantity: 4,
    minStock: 3,
    importDate: '2026-08-20',
    expDate: '2028-05-30',
    supplierId: 'sup-03',
    storageLocation: 'Tủ C - Ngăn bảo hộ',
    notes: 'Đeo khi xử lý vết thương dính máu, dịch tiết',
    isDemo: true,
  },
  {
    id: 'sup-item-06',
    code: 'VT-KHAUTRANG',
    name: 'Khẩu trang y tế kháng khuẩn 4 lớp (Hộp 50 cái)',
    category: 'Vật tư bảo hộ',
    unit: 'Hộp',
    quantity: 12,
    minStock: 5,
    importDate: '2026-08-20',
    expDate: '2029-08-01',
    supplierId: 'sup-03',
    storageLocation: 'Tủ C - Ngăn bảo hộ',
    notes: 'Phát cho học sinh bị ho, cảm cúm, sốt',
    isDemo: true,
  },
  {
    id: 'sup-item-07',
    code: 'VT-TUICHUOM',
    name: 'Túi chườm lạnh hạ sốt y tế',
    category: 'Dụng cụ khám sơ cứu',
    unit: 'Cái',
    quantity: 4,
    minStock: 2,
    importDate: '2026-08-15',
    supplierId: 'sup-03',
    storageLocation: 'Tủ lạnh bảo quản y tế',
    notes: 'Chườm trán khi sốt cao hoặc chấn thương bầm tím',
    isDemo: true,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-01',
    timestamp: '2026-08-15T08:00:00.000Z',
    userName: 'Đỗ Thị Mai Trang',
    userRole: 'medic',
    action: 'Khởi tạo hệ thống',
    details: 'Khởi tạo dữ liệu danh mục thuốc và vật tư y tế năm học 2026-2027 (Dữ liệu Demo)',
  },
  {
    id: 'log-02',
    timestamp: '2026-08-20T09:30:00.000Z',
    userName: 'Đỗ Thị Mai Trang',
    userRole: 'medic',
    action: 'Nhập kho',
    details: 'Lập phiếu nhập PN-2026-001 từ NCC DHG Pharma',
    targetId: 'tx-01',
  },
  {
    id: 'log-03',
    timestamp: '2026-09-08T08:45:00.000Z',
    userName: 'Đỗ Thị Mai Trang',
    userRole: 'medic',
    action: 'Xuất cấp phát',
    details: 'Xuất 1 viên Paracetamol cho HS Lê Văn Minh - Lớp 8A2 (Phiếu PX-2026-001)',
    targetId: 'tx-02',
  },
];

export const INITIAL_INVENTORY_CHECKS: InventoryCheck[] = [
  {
    id: 'chk-01',
    checkCode: 'KK-2026-0001',
    checkDate: '2026-09-05',
    checkTime: '15:30',
    performer: 'Đỗ Thị Mai Trang (Cán bộ Y tế học đường)',
    participants: [
      'Đỗ Thị Mai Trang - Cán bộ Y tế học đường',
      'Thầy Nguyễn Văn Hưng - Phó Hiệu Trưởng',
      'Cô Lê Thị Kim Cúc - Kế toán kiêm Thủ kho trường',
    ],
    notes: 'Biên bản kiểm kê định kỳ đầu năm học mới 2026 - 2027',
    status: 'adjusted',
    confirmedAt: '2026-09-05T16:00:00.000Z',
    confirmedBy: 'Nguyễn Văn Hưng (Phó Hiệu Trưởng)',
    adjustedAt: '2026-09-05T16:15:00.000Z',
    adjustedBy: 'Đỗ Thị Mai Trang',
    createdAt: '2026-09-05T15:30:00.000Z',
    items: [
      {
        medicineId: 'med-06',
        medicineCode: 'TH-HAP-BLUE500',
        medicineName: 'Hapacol Blue (500mg/ 100 viên)',
        batchId: 'batch-06',
        batchNumber: 'HB-2506',
        expDate: '2028-06-15',
        unit: 'Viên',
        systemQuantity: 100,
        actualQuantity: 100,
        difference: 0,
        reason: 'Khớp chính xác với số liệu nhập kho',
      },
      {
        medicineId: 'med-05',
        medicineCode: 'TH-HAP-CAM250',
        medicineName: 'Hapacol Cam (250mg / 25 gói)',
        batchId: 'batch-05',
        batchNumber: 'HG-2505',
        expDate: '2027-11-30',
        unit: 'Gói',
        systemQuantity: 25,
        actualQuantity: 25,
        difference: 0,
        reason: 'Khớp thực tế kiểm đếm',
      },
      {
        medicineId: 'med-30',
        medicineCode: 'TH-POVIDIN',
        medicineName: 'Povidin',
        batchId: 'batch-30',
        batchNumber: 'PV-2530',
        expDate: '2028-07-25',
        unit: 'Chai',
        systemQuantity: 12,
        actualQuantity: 12,
        difference: 0,
        reason: 'Khớp thực tế',
      },
      {
        medicineId: 'med-12',
        medicineCode: 'TH-BERBERAL100',
        medicineName: 'Berberal (100mg/ 100viên)',
        batchId: 'batch-12',
        batchNumber: 'BB-2512',
        expDate: '2028-07-15',
        unit: 'Viên',
        systemQuantity: 100,
        actualQuantity: 100,
        difference: 0,
        reason: 'Khớp thực tế',
      },
    ],
  },
];

export const INITIAL_DISPOSALS: MedicineDisposal[] = [
  {
    id: 'disp-01',
    disposalCode: 'BB-HUY-2026-0001',
    decisionNumber: '18/QĐ-THCSĐT',
    decisionDate: '2026-05-20',
    disposalDate: '2026-05-25',
    schoolYear: '2025-2026',
    councilMembers: [
      {
        roleTitle: 'Chủ tịch hội đồng',
        name: 'Nguyễn Văn Hưng',
        position: 'Phó Hiệu Trưởng',
      },
      {
        roleTitle: 'Thư ký hội đồng',
        name: 'Đỗ Thị Mai Trang',
        position: 'Cán bộ Y tế học đường',
      },
      {
        roleTitle: 'Ủy viên',
        name: 'Lê Thị Kim Cúc',
        position: 'Kế toán trường',
      },
      {
        roleTitle: 'Ủy viên giám sát',
        name: 'Trần Minh Tuấn',
        position: 'Chủ tịch Công đoàn / Trưởng ban TTND',
      },
    ],
    items: [
      {
        medicineId: 'med-05',
        medicineCode: 'TH-BERB50',
        medicineName: 'Berberin Clorid 50mg',
        activeIngredient: 'Berberin clorid',
        dosageForm: 'Viên nén',
        strength: '50mg',
        unit: 'Viên',
        batchId: 'batch-bb00',
        batchNumber: 'BB-2301',
        expDate: '2026-04-15',
        mfgDate: '2023-04-01',
        currentStock: 50,
        disposalQuantity: 50,
        unitPrice: 400,
        totalAmount: 20000,
        reason: 'Hết hạn sử dụng',
        storageLocation: 'Tủ A - Ngăn cách ly',
      },
      {
        medicineId: 'med-03',
        medicineCode: 'TH-POVI10',
        medicineName: 'Povidone Iodine 10% 20ml',
        activeIngredient: 'Povidon iod',
        dosageForm: 'Dung dịch dùng ngoài',
        strength: '10%',
        unit: 'Chai',
        batchId: 'batch-pov00',
        batchNumber: 'PI-2304',
        expDate: '2026-04-30',
        mfgDate: '2023-04-15',
        currentStock: 5,
        disposalQuantity: 5,
        unitPrice: 12000,
        totalAmount: 60000,
        reason: 'Hết hạn sử dụng & đổi màu biến chất',
        storageLocation: 'Tủ A - Ngăn cách ly',
      },
    ],
    totalQuantity: 55,
    totalEstimatedAmount: 80000,
    disposalMethod: 'Hòa tan, trung hòa bất hoạt và chuyển bao gói rác thải y tế chuyên trách tiêu hủy',
    disposalLocation: 'Phòng Y tế & Khu vực xử lý chất thải Trường THCS Đông Thạnh',
    witnessNotes: 'Hội đồng đã kiểm tra toàn bộ số lượng thực tế, nhãn mác, hạn sử dụng và cùng chứng kiến quá trình tiêu hủy an toàn, đúng quy trình.',
    status: 'completed',
    createdBy: 'user-02',
    createdByName: 'Đỗ Thị Mai Trang',
    createdAt: '2026-05-20T08:30:00.000Z',
    approvedBy: 'user-01',
    approvedByName: 'Nguyễn Văn Hưng (Phó Hiệu Trưởng)',
    approvedAt: '2026-05-22T09:15:00.000Z',
    approvalNotes: 'Đồng ý tiêu hủy theo đề xuất của Hội đồng y tế học đường.',
    executedBy: 'user-02',
    executedByName: 'Đỗ Thị Mai Trang',
    executedAt: '2026-05-25T15:00:00.000Z',
    inventoryTransactionId: 'tx-disp-01',
    notes: 'Đã hoàn tất thủ tục tiêu hủy định kỳ kết thúc năm học 2025-2026.',
  },
];

// Calculation and Helper Functions
export function normalizeClassName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/^lớp\s*/i, '')
    .replace(/^lop\s*/i, '')
    .replace(/\s+/g, '')
    .replace(/[-.]/g, '/');
}

/**
 * Checks if two class names represent the same class, e.g.:
 * "6/1" <=> "6A1" <=> "6.1" <=> "6-1" <=> "61" <=> "Lớp 6/1" <=> "Lớp 6A1"
 */
export function areClassesEquivalent(n1: string, n2: string): boolean {
  if (!n1 || !n2) return false;
  const c1 = n1.trim().toLowerCase();
  const c2 = n2.trim().toLowerCase();
  if (c1 === c2) return true;

  const extractSig = (name: string): { grade: number; section: string } | null => {
    if (!name) return null;
    const clean = name.trim().replace(/^(lớp|lop)\s*/i, '').replace(/\s+/g, '');
    const m = clean.match(/^([1-9]|1[0-2])[\/A-Za-z\.\-_]*(\d+)$/);
    if (m) {
      return { grade: parseInt(m[1], 10), section: m[2] };
    }
    const m2 = clean.match(/^([1-9]|1[0-2])[\/]?([A-Za-z]+)$/);
    if (m2) {
      return { grade: parseInt(m2[1], 10), section: m2[2].toUpperCase() };
    }
    return null;
  };

  const s1 = extractSig(n1);
  const s2 = extractSig(n2);
  if (s1 && s2 && s1.grade === s2.grade && s1.section === s2.section) {
    return true;
  }
  return false;
}

/**
 * Detects invalid or redundant banner class names (e.g., "Khối 6", "Toàn trường", "STT")
 */
export function isInvalidOrRedundantClassName(name: string): boolean {
  if (!name || !name.trim()) return true;
  const clean = name.trim();
  if (/^(khối\s*[0-9]+|khối|khoi\s*[0-9]+|khoi|lớp\s*[0-9]+$|toàn\s*trường|danh\s*sách|stt|tổng\s*cộng|lớp\s*học)$/i.test(clean)) {
    return true;
  }
  return false;
}

export function getDaysRemaining(expDateStr: string, referenceDateStr?: string): number {
  const ref = referenceDateStr ? new Date(referenceDateStr) : new Date();
  ref.setHours(0, 0, 0, 0);
  const exp = new Date(expDateStr);
  exp.setHours(0, 0, 0, 0);
  const diffTime = exp.getTime() - ref.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getExpiryAlertLevel(
  expDateStr: string,
  warning30 = 30,
  warning60 = 60,
  referenceDateStr?: string
): ExpiryAlertLevel {
  const days = getDaysRemaining(expDateStr, referenceDateStr);
  if (days < 0) return 'expired';
  if (days <= warning30) return 'warning_30';
  if (days <= warning60) return 'warning_60';
  return 'safe';
}

export function computeMedicineStatus(
  medicine: Medicine,
  batches: MedicineBatch[],
  warningDays = 30
): MedicineStatus {
  const medBatches = batches.filter((b) => b.medicineId === medicine.id);
  const totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);

  if (totalStock === 0) {
    return 'out_of_stock';
  }

  // Check if any batch with quantity > 0 is expired
  const hasExpiredBatch = medBatches.some(
    (b) => b.quantity > 0 && getDaysRemaining(b.expDate) < 0
  );
  if (hasExpiredBatch) {
    return 'expired';
  }

  // Check if any batch with quantity > 0 is expiring soon
  const hasExpiringSoonBatch = medBatches.some(
    (b) => b.quantity > 0 && getDaysRemaining(b.expDate) >= 0 && getDaysRemaining(b.expDate) <= warningDays
  );
  if (hasExpiringSoonBatch) {
    return 'expiring_soon';
  }

  // Check if total stock is below minStock
  if (totalStock <= medicine.minStock) {
    return 'low_stock';
  }

  return 'active';
}

export function getStatusText(status: MedicineStatus): { label: string; color: string; bg: string; border: string } {
  switch (status) {
    case 'active':
      return { label: 'Đang sử dụng', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    case 'low_stock':
      return { label: 'Sắp hết', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    case 'out_of_stock':
      return { label: 'Hết hàng', color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-300' };
    case 'expiring_soon':
      return { label: 'Sắp hết hạn', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
    case 'expired':
      return { label: 'Đã hết hạn', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
    case 'discontinued':
      return { label: 'Ngưng sử dụng', color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' };
    default:
      return { label: 'Bình thường', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export {
  formatDateVN,
  formatDateFormulaVN,
  normalizeDateToISO,
  formatDateTimeVN,
  formatTime24H,
  normalizeManualTime24H,
  normalizeStudentClassName,
  extractGradeFromClassOrGrade,
  getCurrentDateISO,
  getCurrentTimeVN,
  removeVietnameseTones,
  matchesStudentSearch,
  cleanSearchQuery,
  getStudentSearchScore,
  maskStudentName,
} from '../utils/helpers';

// In-Memory / LocalStorage Database Engine
class AppDatabase {
  private medicines: Medicine[] = [];
  private batches: MedicineBatch[] = [];
  private transactions: InventoryTransaction[] = [];
  private suppliers: Supplier[] = [];
  private supplies: MedicalSupply[] = [];
  private usageRecords: UsageRecord[] = [];
  private inventoryChecks: InventoryCheck[] = [];
  private auditLogs: AuditLog[] = [];
  private settings: AppSettings = DEFAULT_SETTINGS;
  private currentUser: User = DEFAULT_USERS[1]; // Default to school medical officer
  private users: User[] = [];
  private students: Student[] = [];
  private healthProfiles: StudentHealthProfile[] = [];
  private clinicVisits: ClinicVisit[] = [];
  private healthEvents: HealthEvent[] = [];
  private healthCheckups: HealthCheckup[] = [];
  private classes: SchoolClass[] = [];
  private disposals: MedicineDisposal[] = [];
  private staffMembers: SchoolStaff[] = [];
  private listeners: (() => void)[] = [];

  // Performance optimizations: memoized computed states
  private cachedComputedMedicines: (Medicine & { totalStock: number; earliestExpDate?: string; computedStatus: MedicineStatus })[] | null = null;
  private cachedDashboardMetrics: any | null = null;
  private cachedNormalizedVisits: ClinicVisit[] | null = null;
  private pendingLocalSaveKeys = new Set<string>();
  private localSaveTimer: any = null;

  // Cloud Firestore Sync Properties
  private currentUserId: string | null = null;
  private syncStatus: SyncStatus = {
    state: 'idle',
    lastSavedAt: null,
    errorMessage: null,
    currentUserId: null,
    pendingCount: 0,
  };
  private syncListeners: ((status: SyncStatus) => void)[] = [];
  private unsubscribeFirestore: (() => void) | null = null;
  private isSeeding = false;
  private activeCloudWriteCount = 0;
  private lastLocalStudentMutationAt = 0;
  private lastInventoryMutationAt = 0;
  private lastStaffMutationAt = 0;
  private lastStaffReplaceAll = false;
  private idbSynced = false;
  private serverSyncTimer: any = null;
  private lastServerRevision = 0;
  private isPullingFromServer = false;

  constructor() {
    this.init();
    if (typeof window !== 'undefined') {
      this.initServerSync();
      window.addEventListener('online', () => {
        this.setSyncStatus('saving');
        this.pushStateToServer();
        if (this.currentUserId) {
          this.syncAllToCloud();
        }
      });
      window.addEventListener('offline', () => {
        this.setSyncStatus('offline');
      });
    }
  }

  // --- Chế độ Bảo Mật & Ẩn Tên Học Sinh (Privacy Mode) ---
  private privacyMode: boolean = typeof window !== 'undefined'
    ? localStorage.getItem('thcs_dongthanh_privacy_mode') === 'true'
    : false;

  public isPrivacyModeEnabled(): boolean {
    return this.privacyMode;
  }

  public setPrivacyModeEnabled(enabled: boolean): void {
    this.privacyMode = Boolean(enabled);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('thcs_dongthanh_privacy_mode', String(this.privacyMode));
      }
    } catch {
      // ignore
    }
    this.notify();
  }

  public togglePrivacyMode(): boolean {
    const next = !this.privacyMode;
    this.setPrivacyModeEnabled(next);
    return next;
  }

  // --- In-Memory Caches for fast queries without repetitive localStorage parsing ---
  private cachedDeletedVisitIds: string[] | null = null;
  private cachedDeletedStudentIds: string[] | null = null;
  private cachedDeletedStaffIds: string[] | null = null;
  private cachedDeletedEventIds: string[] | null = null;
  private cachedDeletedCheckupIds: string[] | null = null;
  private cachedDeletedTxIds: string[] | null = null;
  private cachedDeletedClassIds: string[] | null = null;
  private cachedDeletedUserIds: string[] | null = null;

  private getDeletedVisitIds(): string[] {
    if (this.cachedDeletedVisitIds) return this.cachedDeletedVisitIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_visits_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      const res = Array.isArray(parsed)
        ? parsed.filter((x: string) => x && typeof x === 'string' && !x.startsWith('KB-'))
        : [];
      this.cachedDeletedVisitIds = res;
      return res;
    } catch {
      return [];
    }
  }

  private addDeletedVisitId(id: string) {
    if (!id || id.startsWith('KB-')) return;
    try {
      const current = new Set(this.getDeletedVisitIds());
      current.add(id);
      const arr = Array.from(current);
      this.cachedDeletedVisitIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_visits_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private getDeletedStudentIds(): string[] {
    if (this.cachedDeletedStudentIds) return this.cachedDeletedStudentIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_students_v1');
      const res = raw ? JSON.parse(raw) : [];
      this.cachedDeletedStudentIds = Array.isArray(res) ? res : [];
      return this.cachedDeletedStudentIds;
    } catch {
      return [];
    }
  }

  private addDeletedStudentIds(ids: string[]) {
    try {
      const current = new Set(this.getDeletedStudentIds());
      for (const id of ids) {
        if (id) current.add(id);
      }
      const arr = Array.from(current);
      this.cachedDeletedStudentIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_students_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private removeDeletedStudentIds(ids: string[]) {
    try {
      const removeSet = new Set(ids.filter(Boolean));
      if (removeSet.size === 0) return;
      const next = this.getDeletedStudentIds().filter((x) => !removeSet.has(x));
      this.cachedDeletedStudentIds = next;
      localStorage.setItem('thcs_dongthanh_deleted_students_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  private getDeletedStaffIds(): string[] {
    if (this.cachedDeletedStaffIds) return this.cachedDeletedStaffIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_staff_v1');
      const res = raw ? JSON.parse(raw) : [];
      this.cachedDeletedStaffIds = Array.isArray(res) ? res : [];
      return this.cachedDeletedStaffIds;
    } catch {
      return [];
    }
  }

  private addDeletedStaffIds(ids: string[]) {
    try {
      const current = new Set(this.getDeletedStaffIds());
      for (const id of ids) {
        if (id) current.add(id);
      }
      const arr = Array.from(current);
      this.cachedDeletedStaffIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_staff_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private removeDeletedStaffIds(ids: string[]) {
    try {
      const removeSet = new Set(ids.filter(Boolean));
      if (removeSet.size === 0) return;
      const next = this.getDeletedStaffIds().filter((x) => !removeSet.has(x));
      this.cachedDeletedStaffIds = next;
      localStorage.setItem('thcs_dongthanh_deleted_staff_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  private getDeletedEventIds(): string[] {
    if (this.cachedDeletedEventIds) return this.cachedDeletedEventIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_events_v1');
      const res = raw ? JSON.parse(raw) : [];
      this.cachedDeletedEventIds = Array.isArray(res) ? res : [];
      return this.cachedDeletedEventIds;
    } catch {
      return [];
    }
  }

  private addDeletedEventId(id: string) {
    if (!id) return;
    try {
      const current = new Set(this.getDeletedEventIds());
      current.add(id);
      const arr = Array.from(current);
      this.cachedDeletedEventIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_events_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private getDeletedCheckupIds(): string[] {
    if (this.cachedDeletedCheckupIds) return this.cachedDeletedCheckupIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_checkups_v1');
      const res = raw ? JSON.parse(raw) : [];
      this.cachedDeletedCheckupIds = Array.isArray(res) ? res : [];
      return this.cachedDeletedCheckupIds;
    } catch {
      return [];
    }
  }

  private addDeletedCheckupId(id: string) {
    if (!id) return;
    try {
      const current = new Set(this.getDeletedCheckupIds());
      current.add(id);
      const arr = Array.from(current);
      this.cachedDeletedCheckupIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_checkups_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private getDeletedTxIds(): string[] {
    if (this.cachedDeletedTxIds) return this.cachedDeletedTxIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_txs_v1');
      const res = raw ? JSON.parse(raw) : [];
      this.cachedDeletedTxIds = Array.isArray(res) ? res : [];
      return this.cachedDeletedTxIds;
    } catch {
      return [];
    }
  }

  private addDeletedTxId(id: string) {
    if (!id) return;
    try {
      const current = new Set(this.getDeletedTxIds());
      current.add(id);
      const arr = Array.from(current);
      this.cachedDeletedTxIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_txs_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private getDeletedClassIds(): string[] {
    if (this.cachedDeletedClassIds) return this.cachedDeletedClassIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_classes_v1');
      const res = raw ? JSON.parse(raw) : [];
      this.cachedDeletedClassIds = Array.isArray(res) ? res : [];
      return this.cachedDeletedClassIds;
    } catch {
      return [];
    }
  }

  private addDeletedClassIds(idsOrNames: string[]) {
    try {
      const current = new Set(this.getDeletedClassIds());
      for (const item of idsOrNames) {
        if (item) current.add(item);
      }
      const arr = Array.from(current);
      this.cachedDeletedClassIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_classes_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private removeDeletedClassIds(idsOrNames: string[]) {
    try {
      const removeSet = new Set(idsOrNames.filter(Boolean));
      const next = this.getDeletedClassIds().filter((x) => !removeSet.has(x));
      this.cachedDeletedClassIds = next;
      localStorage.setItem('thcs_dongthanh_deleted_classes_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  public isDemoSchoolClass(c: SchoolClass | null | undefined): boolean {
    if (!c || typeof c !== 'object') return true;
    if (c.updatedAt) return false;
    const norm = normalizeClassName(c.name);
    const demoMatch = DEFAULT_CLASSES.find((dc) => normalizeClassName(dc.name) === norm);
    if (!demoMatch) return false;
    return (c.homeroomTeacher || '').trim() === (demoMatch.homeroomTeacher || '').trim();
  }

  public isOnlyDemoSchoolClasses(arr: SchoolClass[] | null | undefined): boolean {
    if (!Array.isArray(arr) || arr.length === 0) return true;
    if (arr.length > DEFAULT_CLASSES.length) return false;
    return arr.every((c) => this.isDemoSchoolClass(c));
  }

  private mergeSchoolClasses(
    listA: SchoolClass[],
    listB: SchoolClass[],
    deletedClassSet?: Set<string>
  ): SchoolClass[] {
    const arrA = Array.isArray(listA) ? listA : [];
    const arrB = Array.isArray(listB) ? listB : [];

    const aOnlyDemo = this.isOnlyDemoSchoolClasses(arrA);
    const bOnlyDemo = this.isOnlyDemoSchoolClasses(arrB);

    const effectiveA = !bOnlyDemo && aOnlyDemo ? [] : arrA;
    const effectiveB = !aOnlyDemo && bOnlyDemo ? [] : arrB;

    const byKey = new Map<string, SchoolClass>();

    const upsert = (cls: SchoolClass, isIncoming: boolean) => {
      if (!cls || !cls.name) return;
      const normKey = normalizeClassName(cls.name);
      if (!normKey) return;
      if (deletedClassSet && (deletedClassSet.has(cls.id) || deletedClassSet.has(normKey))) {
        return;
      }

      const prev = byKey.get(normKey);
      if (!prev) {
        byKey.set(normKey, { ...cls });
        return;
      }

      const prevIsDemo = this.isDemoSchoolClass(prev);
      const nextIsDemo = this.isDemoSchoolClass(cls);

      if (prevIsDemo && !nextIsDemo) {
        byKey.set(normKey, { ...prev, ...cls });
        return;
      }
      if (!prevIsDemo && nextIsDemo) {
        return;
      }

      const rawPrevUpdated = prev.updatedAt === '2026-09-15T08:00:00.000Z' ? '' : prev.updatedAt || '';
      const rawNextUpdated = cls.updatedAt === '2026-09-15T08:00:00.000Z' ? '' : cls.updatedAt || '';
      const prevTime = rawPrevUpdated ? new Date(rawPrevUpdated).getTime() || 0 : 0;
      const nextTime = rawNextUpdated ? new Date(rawNextUpdated).getTime() || 0 : 0;

      const prevTeacher = (prev.homeroomTeacher || '').trim();
      const nextTeacher = (cls.homeroomTeacher || '').trim();
      const prevPhone = (prev.teacherPhone || '').trim();
      const nextPhone = (cls.teacherPhone || '').trim();
      const prevRoom = (prev.room || '').trim();
      const nextRoom = (cls.room || '').trim();

      if (nextTime > prevTime || (nextTime === prevTime && isIncoming)) {
        byKey.set(normKey, {
          ...prev,
          ...cls,
          homeroomTeacher: nextTeacher || prevTeacher,
          teacherPhone: nextPhone || prevPhone,
          room: nextRoom || prevRoom,
          updatedAt: rawNextUpdated || rawPrevUpdated || undefined,
        });
      } else {
        byKey.set(normKey, {
          ...cls,
          ...prev,
          homeroomTeacher: prevTeacher || nextTeacher,
          teacherPhone: prevPhone || nextPhone,
          room: prevRoom || nextRoom,
          updatedAt: rawPrevUpdated || rawNextUpdated || undefined,
        });
      }
    };

    for (const c of effectiveA) upsert(c, false);
    for (const c of effectiveB) upsert(c, true);

    const merged = Array.from(byKey.values());
    if (merged.length === 0 && arrA.length > 0 && (!deletedClassSet || deletedClassSet.size === 0)) {
      return arrA;
    }

    return merged.sort((a, b) => {
      const gA = Number(a.grade) || 6;
      const gB = Number(b.grade) || 6;
      if (gA !== gB) return gA - gB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'vi', { numeric: true });
    });
  }

  private mergeItemsById<T extends { id: string; updatedAt?: string; lastUpdated?: string; createdAt?: string }>(
    listA: T[],
    listB: T[],
    deletedIds?: Set<string>
  ): T[] {
    const map = new Map<string, T>();
    for (const item of listA || []) {
      if (item && item.id && (!deletedIds || !deletedIds.has(item.id))) {
        map.set(item.id, item);
      }
    }
    for (const item of listB || []) {
      if (item && item.id && (!deletedIds || !deletedIds.has(item.id))) {
        const existing = map.get(item.id);
        if (!existing) {
          map.set(item.id, item);
        } else {
          const tA = new Date(existing.updatedAt || existing.lastUpdated || existing.createdAt || 0).getTime() || 0;
          const tB = new Date(item.updatedAt || item.lastUpdated || item.createdAt || 0).getTime() || 0;
          if (tB >= tA) {
            map.set(item.id, { ...existing, ...item });
          }
        }
      }
    }
    return Array.from(map.values());
  }

  private initServerSync() {
    // Immediately pull/merge with shared backend server on startup
    this.pullFromServerAndMerge(true);

    // Subscribe to real-time Cloud Firestore schoolSync chunks (works across ais-dev, ais-pre, home & school computers)
    subscribeToSharedSchoolSync({
      onClassesChunk: (payload, exists) => {
        const localHasRealClasses = !this.isOnlyDemoSchoolClasses(this.classes);
        if (!exists || !payload) {
          if (localHasRealClasses) {
            pushSharedSchoolClassesToCloud(
              this.classes,
              this.getDeletedClassIds(),
              this.lastLocalStudentMutationAt || Date.now(),
              this.lastServerRevision || 1
            );
          }
          return;
        }

        const incomingClasses = Array.isArray(payload.classes) ? payload.classes : [];
        const incomingOnlyDemo = this.isOnlyDemoSchoolClasses(incomingClasses);
        const deletedClassSet = new Set<string>([
          ...this.getDeletedClassIds(),
          ...(Array.isArray(payload.deletedClassIds) ? payload.deletedClassIds : []),
        ]);
        try {
          localStorage.setItem(
            'thcs_dongthanh_deleted_classes_v1',
            JSON.stringify(Array.from(deletedClassSet))
          );
        } catch {
          // ignore
        }

        const countRealTeachers = (arr: SchoolClass[]) =>
          (arr || []).filter((c) => !this.isDemoSchoolClass(c) && Boolean(c.homeroomTeacher?.trim())).length;

        const beforeJson = JSON.stringify(this.classes);
        this.classes = this.mergeSchoolClasses(this.classes, incomingClasses, deletedClassSet);
        for (const c of this.classes) {
          c.totalStudents =
            this.students.filter(
              (s) =>
                s.className === c.name ||
                normalizeClassName(s.className) === normalizeClassName(c.name)
            ).length ||
            c.totalStudents ||
            0;
        }
        const afterJson = JSON.stringify(this.classes);

        if (beforeJson !== afterJson) {
          this.saveStudentBundleLocally();
          this.setSyncStatus('saved');
          this.notify();
        }

        // If local had real classes/GVCN that weren't in Cloud Firestore yet, push merged result back to Cloud Firestore
        if (
          (localHasRealClasses && incomingOnlyDemo) ||
          this.classes.length > incomingClasses.length ||
          countRealTeachers(this.classes) > countRealTeachers(incomingClasses)
        ) {
          pushSharedSchoolClassesToCloud(
            this.classes,
            Array.from(deletedClassSet),
            Date.now(),
            this.lastServerRevision || 1
          );
        }
      },
      onOperationalChunk: (payload, exists) => {
        if (!exists || !payload) {
          this.scheduleServerPush();
          return;
        }
        const deletedVisitSet = new Set<string>([
          ...this.getDeletedVisitIds(),
          ...(Array.isArray(payload.deletedVisitIds) ? payload.deletedVisitIds : []),
        ]);
        const deletedEventSet = new Set<string>([
          ...this.getDeletedEventIds(),
          ...(Array.isArray(payload.deletedEventIds) ? payload.deletedEventIds : []),
        ]);
        const deletedCheckupSet = new Set<string>([
          ...this.getDeletedCheckupIds(),
          ...(Array.isArray(payload.deletedCheckupIds) ? payload.deletedCheckupIds : []),
        ]);
        const deletedTxSet = new Set<string>([
          ...this.getDeletedTxIds(),
          ...(Array.isArray(payload.deletedTxIds) ? payload.deletedTxIds : []),
        ]);
        const deletedStudentSet = new Set<string>([
          ...this.getDeletedStudentIds(),
          ...(Array.isArray(payload.deletedStudentIds) ? payload.deletedStudentIds : []),
        ]);
        try {
          localStorage.setItem(
            'thcs_dongthanh_deleted_visits_v1',
            JSON.stringify(Array.from(deletedVisitSet))
          );
          localStorage.setItem(
            'thcs_dongthanh_deleted_events_v1',
            JSON.stringify(Array.from(deletedEventSet))
          );
          localStorage.setItem(
            'thcs_dongthanh_deleted_checkups_v1',
            JSON.stringify(Array.from(deletedCheckupSet))
          );
          localStorage.setItem(
            'thcs_dongthanh_deleted_txs_v1',
            JSON.stringify(Array.from(deletedTxSet))
          );
          localStorage.setItem(
            'thcs_dongthanh_deleted_students_v1',
            JSON.stringify(Array.from(deletedStudentSet))
          );
          if (payload.studentsCleaned) {
            localStorage.setItem('thcs_dongthanh_students_clean_v1', 'true');
          }
        } catch {
          // ignore
        }

        const incomingVisits: ClinicVisit[] = Array.isArray(payload.clinicVisits)
          ? payload.clinicVisits
          : [];
        const incomingVisitIds = new Set(incomingVisits.map((v) => v?.id).filter(Boolean));

        let changed = false;
        const beforeVisitsJson = JSON.stringify(this.clinicVisits);
        this.clinicVisits = this.mergeItemsById(
          this.clinicVisits,
          incomingVisits,
          deletedVisitSet
        )
          .filter((v) => !deletedVisitSet.has(v.id))
          .sort(
            (a, b) =>
              (new Date(b.createdAt || `${b.visitDate}T${b.timeIn || '00:00'}`).getTime() || 0) -
              (new Date(a.createdAt || `${a.visitDate}T${a.timeIn || '00:00'}`).getTime() || 0)
          );
        if (JSON.stringify(this.clinicVisits) !== beforeVisitsJson) {
          this.cachedNormalizedVisits = null;
          changed = true;
        }

        const incomingTxs: InventoryTransaction[] = Array.isArray(payload.transactions)
          ? payload.transactions
          : [];
        const incomingTxIds = new Set(incomingTxs.map((t) => t?.id).filter(Boolean));
        if (incomingTxs.length > 0 || deletedTxSet.size > 0) {
          const beforeTxJson = JSON.stringify(this.transactions);
          this.transactions = this.mergeItemsById(this.transactions, incomingTxs, deletedTxSet).sort(
            (a, b) =>
              (new Date(b.date || b.createdAt).getTime() || 0) -
              (new Date(a.date || a.createdAt).getTime() || 0)
          );
          if (JSON.stringify(this.transactions) !== beforeTxJson) changed = true;
        }
        if (Array.isArray(payload.healthEvents) || deletedEventSet.size > 0) {
          const beforeEvtJson = JSON.stringify(this.healthEvents);
          this.healthEvents = this.mergeItemsById(
            this.healthEvents,
            Array.isArray(payload.healthEvents) ? payload.healthEvents : [],
            deletedEventSet
          );
          if (JSON.stringify(this.healthEvents) !== beforeEvtJson) changed = true;
        }
        if (Array.isArray(payload.healthCheckups) || deletedCheckupSet.size > 0) {
          const beforeChkJson = JSON.stringify(this.healthCheckups);
          this.healthCheckups = this.mergeItemsById(
            this.healthCheckups,
            Array.isArray(payload.healthCheckups) ? payload.healthCheckups : [],
            deletedCheckupSet
          );
          if (JSON.stringify(this.healthCheckups) !== beforeChkJson) changed = true;
        }
        if (deletedStudentSet.size > 0 && this.students.some((s) => deletedStudentSet.has(s.id))) {
          this.students = this.students.filter((s) => !deletedStudentSet.has(s.id));
          this.healthProfiles = this.healthProfiles.filter((hp) => !deletedStudentSet.has(hp.studentId));
          changed = true;
        }
        if (Array.isArray(payload.usageRecords) && payload.usageRecords.length > 0) {
          const beforeUsageJson = JSON.stringify(this.usageRecords);
          this.usageRecords = this.mergeItemsById(this.usageRecords, payload.usageRecords);
          if (JSON.stringify(this.usageRecords) !== beforeUsageJson) changed = true;
        }
        const incomingStaff = Array.isArray(payload.staffMembers) ? payload.staffMembers : null;
        const deletedStaffSet = new Set(this.getDeletedStaffIds());
        if (Array.isArray(payload.deletedStaffIds)) {
          for (const dId of payload.deletedStaffIds) {
            deletedStaffSet.add(dId);
            this.addDeletedStaffIds([dId]);
          }
        }
        if (deletedStaffSet.size > 0 && this.staffMembers.some((s) => deletedStaffSet.has(s.id))) {
          this.staffMembers = this.staffMembers.filter((s) => !deletedStaffSet.has(s.id));
          changed = true;
        }
        if (incomingStaff !== null) {
          const cloudStaffTime = Number(payload.staffUpdatedAt || 0);
          const localStaffTime =
            this.lastStaffMutationAt ||
            Number(localStorage.getItem('thcs_dt_staff_updated_at') || 0);
          if (payload.staffCleaned && cloudStaffTime >= localStaffTime) {
            if (this.staffMembers.length > 0) {
              this.staffMembers = [];
              localStorage.setItem('thcs_dongthanh_staff_cleaned_v1', 'true');
              changed = true;
            }
          } else if (incomingStaff.length > 0) {
            if (
              this.isHoldingOnlyDemoStaff() ||
              incomingStaff.length > this.staffMembers.length ||
              cloudStaffTime >= localStaffTime
            ) {
              const beforeStaffJson = JSON.stringify(this.staffMembers);
              this.staffMembers = incomingStaff.filter((s: SchoolStaff) => s && !deletedStaffSet.has(s.id));
              localStorage.removeItem('thcs_dongthanh_staff_cleaned_v1');
              if (JSON.stringify(this.staffMembers) !== beforeStaffJson) changed = true;
            } else {
              const beforeStaffJson = JSON.stringify(this.staffMembers);
              this.staffMembers = this.mergeItemsById(this.staffMembers, incomingStaff, deletedStaffSet);
              if (JSON.stringify(this.staffMembers) !== beforeStaffJson) changed = true;
            }
          }
        }
        const cloudInvTime = Number(payload.inventoryUpdatedAt || 0);
        const localInvTime =
          this.lastInventoryMutationAt ||
          Number(localStorage.getItem('thcs_dt_last_inventory_mutation_at') || 0);
        if (Array.isArray(payload.batches) && payload.batches.length > 0 && cloudInvTime >= localInvTime) {
          this.batches = payload.batches;
          if (Array.isArray(payload.medicines) && payload.medicines.length > 0) {
            this.medicines = payload.medicines;
          }
          for (const med of this.medicines) {
            const medBatches = this.batches.filter((b) => b.medicineId === med.id);
            med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
          }
          changed = true;
        }
        if (Array.isArray(payload.users) && payload.users.length > 0) {
          this.users = this.mergeItemsById(this.users, payload.users);
          this.normalizeUsersToTwoRoles();
          changed = true;
        }
        if (changed) {
          this.saveAll(false);
          this.setSyncStatus('saved');
          this.notify();
        }

        // If this browser has clinicVisits, transactions, or staff that are not yet in Cloud Firestore, push merged operational state back
        const incomingStaffIds = new Set((incomingStaff || []).map((s: any) => s?.id));
        const localHasUnsyncedStaff =
          incomingStaff !== null && this.staffMembers.some((s) => s?.id && !incomingStaffIds.has(s.id));
        const localHasUnsyncedVisits = this.clinicVisits.some((v) => v?.id && !incomingVisitIds.has(v.id));
        const localHasUnsyncedTxs = this.transactions.some((t) => t?.id && !incomingTxIds.has(t.id));
        if (localHasUnsyncedVisits || localHasUnsyncedTxs || localHasUnsyncedStaff) {
          pushSharedOperationalToCloud(
            {
              medicines: this.medicines,
              batches: this.batches,
              transactions: this.transactions,
              suppliers: this.suppliers,
              supplies: this.supplies,
              usageRecords: this.usageRecords,
              inventoryChecks: this.inventoryChecks,
              disposals: this.disposals,
              settings: this.settings,
              users: this.users,
              staffMembers: this.staffMembers,
              clinicVisits: this.clinicVisits,
              healthEvents: this.healthEvents,
              healthCheckups: this.healthCheckups,
              deletedVisitIds: Array.from(deletedVisitSet),
              deletedEventIds: Array.from(deletedEventSet),
              deletedCheckupIds: Array.from(deletedCheckupSet),
              deletedTxIds: Array.from(deletedTxSet),
              deletedStudentIds: Array.from(deletedStudentSet),
              deletedStaffIds: Array.from(deletedStaffSet),
              staffUpdatedAt: this.lastStaffMutationAt || Number(localStorage.getItem('thcs_dt_staff_updated_at') || Date.now()),
              staffCleaned: localStorage.getItem('thcs_dongthanh_staff_cleaned_v1') === 'true',
              deletedUserIds: this.getDeletedUserIds(),
              deletedClassIds: this.getDeletedClassIds(),
              inventoryUpdatedAt: localInvTime || cloudInvTime,
              classesUpdatedAt: Number(localStorage.getItem('thcs_dt_classes_updated_at') || 0),
              studentsUpdatedAt: Number(localStorage.getItem('thcs_dt_students_updated_at') || 0),
              realStudentsImported: localStorage.getItem('thcs_dongthanh_real_students_imported') === 'true',
              studentsCleaned: localStorage.getItem('thcs_dongthanh_students_clean_v1') === 'true',
            },
            (this.lastServerRevision || 1) + 1
          ).catch(() => {});
        }
      },
      onStudentsMetaChunk: (meta, exists) => {
        if (!exists || !meta) {
          if (this.students.length > 0 && !this.isHoldingOnlyDemoStudents()) {
            pushSharedStudentsToCloud(
              this.students,
              this.healthProfiles,
              this.lastLocalStudentMutationAt || Date.now(),
              true,
              false,
              this.lastServerRevision || 1
            );
          }
          return;
        }
        const cloudTotal = Number(meta.totalStudents || 0);
        const cloudChunks = Number(meta.chunkCount || 0);
        const cloudStuTime = Number(meta.studentsUpdatedAt || 0);
        const localStuTime =
          this.lastLocalStudentMutationAt ||
          Number(localStorage.getItem('thcs_dt_students_updated_at') || 0);
        const deletedStudentSet = new Set(this.getDeletedStudentIds());

        if (
          cloudChunks > 0 &&
          cloudStuTime >= localStuTime &&
          (cloudTotal > this.students.length + deletedStudentSet.size ||
            (cloudTotal > 0 && this.isHoldingOnlyDemoStudents() && meta.realStudentsImported))
        ) {
          loadSharedStudentsChunksFromCloud(cloudChunks).then((loadedStudents) => {
            if (loadedStudents && loadedStudents.length > 0) {
              const filteredLoaded = loadedStudents.filter((s) => s && !deletedStudentSet.has(s.id));
              this.students = this.mergeItemsById(this.students, filteredLoaded, deletedStudentSet);
              if (Array.isArray(meta.healthProfiles)) {
                this.healthProfiles = this.mergeItemsById(
                  this.healthProfiles,
                  meta.healthProfiles
                ).filter((hp) => !deletedStudentSet.has(hp.studentId));
              }
              if (meta.realStudentsImported) {
                localStorage.setItem('thcs_dongthanh_real_students_imported', 'true');
              }
              for (const c of this.classes) {
                c.totalStudents =
                  this.students.filter(
                    (s) =>
                      s.className === c.name ||
                      normalizeClassName(s.className) === normalizeClassName(c.name)
                  ).length ||
                  c.totalStudents ||
                  0;
              }
              this.saveStudentBundleLocally();
              this.setSyncStatus('saved');
              this.notify();
            }
          });
        } else if (
          this.students.length > cloudTotal &&
          !this.isHoldingOnlyDemoStudents()
        ) {
          pushSharedStudentsToCloud(
            this.students,
            this.healthProfiles,
            this.lastLocalStudentMutationAt || Date.now(),
            true,
            false,
            this.lastServerRevision || 1
          );
        }
      },
    });

    // Poll lightweight /api/health every 6s so multiple computers stay in real-time sync
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.checkServerRevision();
      }
    }, 6000);

    window.addEventListener('focus', () => {
      this.checkServerRevision();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkServerRevision();
      }
    });
  }

  private async checkServerRevision() {
    if (this.isPullingFromServer) return;
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) return;
      const info = await res.json();
      if (info && info.ok) {
        if (!info.hasData && (this.clinicVisits.length > 0 || this.students.length > 0)) {
          await this.pushStateToServer();
        } else if (info.revision > this.lastServerRevision) {
          await this.pullFromServerAndMerge(false);
        }
      }
    } catch {
      // ignore network hiccup
    }
  }

  public async pullFromServerAndMerge(pushBackIfLocalNewer = false): Promise<boolean> {
    if (typeof window === 'undefined' || this.isPullingFromServer) return false;
    this.isPullingFromServer = true;
    try {
      const res = await fetch('/api/school-state', { cache: 'no-store' });
      if (!res.ok) return false;
      const payload = await res.json();
      if (!payload || !payload.ok) return false;

      if (!payload.hasData || !payload.state) {
        // Server has no state yet; seed it with our current client data
        await this.pushStateToServer();
        return true;
      }

      const srv = payload.state;
      this.lastServerRevision = Number(srv.revision) || 0;

      const deletedVisitSet = new Set<string>([
        ...this.getDeletedVisitIds(),
        ...(Array.isArray(srv.deletedVisitIds) ? srv.deletedVisitIds : []),
      ]);
      const deletedUserSet = new Set<string>([
        ...this.getDeletedUserIds(),
        ...(Array.isArray(srv.deletedUserIds) ? srv.deletedUserIds : []),
      ]);
      const deletedClassSet = new Set<string>([
        ...this.getDeletedClassIds(),
        ...(Array.isArray(srv.deletedClassIds) ? srv.deletedClassIds : []),
      ]);
      const deletedEventSet = new Set<string>([
        ...this.getDeletedEventIds(),
        ...(Array.isArray(srv.deletedEventIds) ? srv.deletedEventIds : []),
      ]);
      const deletedCheckupSet = new Set<string>([
        ...this.getDeletedCheckupIds(),
        ...(Array.isArray(srv.deletedCheckupIds) ? srv.deletedCheckupIds : []),
      ]);
      const deletedTxSet = new Set<string>([
        ...this.getDeletedTxIds(),
        ...(Array.isArray(srv.deletedTxIds) ? srv.deletedTxIds : []),
      ]);
      const deletedStudentSet = new Set<string>([
        ...this.getDeletedStudentIds(),
        ...(Array.isArray(srv.deletedStudentIds) ? srv.deletedStudentIds : []),
      ]);
      const deletedStaffSet = new Set<string>([
        ...this.getDeletedStaffIds(),
        ...(Array.isArray(srv.deletedStaffIds) ? srv.deletedStaffIds : []),
      ]);

      this.cachedDeletedVisitIds = Array.from(deletedVisitSet);
      this.cachedDeletedUserIds = Array.from(deletedUserSet);
      this.cachedDeletedClassIds = Array.from(deletedClassSet);
      this.cachedDeletedEventIds = Array.from(deletedEventSet);
      this.cachedDeletedCheckupIds = Array.from(deletedCheckupSet);
      this.cachedDeletedTxIds = Array.from(deletedTxSet);
      this.cachedDeletedStudentIds = Array.from(deletedStudentSet);
      this.cachedDeletedStaffIds = Array.from(deletedStaffSet);

      try {
        localStorage.setItem('thcs_dongthanh_deleted_visits_v1', JSON.stringify(this.cachedDeletedVisitIds));
        localStorage.setItem('thcs_dongthanh_deleted_users_v1', JSON.stringify(this.cachedDeletedUserIds));
        localStorage.setItem('thcs_dongthanh_deleted_classes_v1', JSON.stringify(this.cachedDeletedClassIds));
        localStorage.setItem('thcs_dongthanh_deleted_events_v1', JSON.stringify(this.cachedDeletedEventIds));
        localStorage.setItem('thcs_dongthanh_deleted_checkups_v1', JSON.stringify(this.cachedDeletedCheckupIds));
        localStorage.setItem('thcs_dongthanh_deleted_txs_v1', JSON.stringify(this.cachedDeletedTxIds));
        localStorage.setItem('thcs_dongthanh_deleted_students_v1', JSON.stringify(this.cachedDeletedStudentIds));
        localStorage.setItem('thcs_dongthanh_deleted_staff_v1', JSON.stringify(this.cachedDeletedStaffIds));
      } catch {
        // ignore
      }

      const localVisitCountBefore = this.clinicVisits.length;
      const srvVisitCount = Array.isArray(srv.clinicVisits) ? srv.clinicVisits.length : 0;

      // 1. Merge clinicVisits by ID
      if (Array.isArray(srv.clinicVisits)) {
        this.clinicVisits = this.mergeItemsById(this.clinicVisits, srv.clinicVisits, deletedVisitSet)
          .filter((v) => !deletedVisitSet.has(v.id))
          .sort(
            (a, b) =>
              (new Date(b.createdAt || `${b.visitDate}T${b.timeIn || '00:00'}`).getTime() || 0) -
              (new Date(a.createdAt || `${a.visitDate}T${a.timeIn || '00:00'}`).getTime() || 0)
          );
        this.cachedNormalizedVisits = null;
      }

      // 2. Merge transactions by ID
      const localTxCountBefore = this.transactions.length;
      const srvTxCount = Array.isArray(srv.transactions) ? srv.transactions.length : 0;
      if (Array.isArray(srv.transactions)) {
        this.transactions = this.mergeItemsById(this.transactions, srv.transactions, deletedTxSet).sort(
          (a, b) => (new Date(b.date || b.createdAt).getTime() || 0) - (new Date(a.date || a.createdAt).getTime() || 0)
        );
      }

      // 3. Inventory Batches, Medicines & Supplies
      const srvInvTime = Number(srv.inventoryUpdatedAt || 0);
      const localInvTime =
        this.lastInventoryMutationAt ||
        Number(localStorage.getItem('thcs_dt_last_inventory_mutation_at') || 0);

      if (
        Array.isArray(srv.batches) &&
        srv.batches.length > 0 &&
        (srvInvTime >= localInvTime || srvTxCount > localTxCountBefore)
      ) {
        this.batches = srv.batches;
        if (Array.isArray(srv.medicines) && srv.medicines.length > 0) {
          this.medicines = srv.medicines;
        }
        for (const med of this.medicines) {
          const medBatches = this.batches.filter((b) => b.medicineId === med.id);
          med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
        }
      }

      if (Array.isArray(srv.supplies) && srv.supplies.length > 0 && srvInvTime >= localInvTime) {
        this.supplies = srv.supplies;
      }
      if (Array.isArray(srv.suppliers) && srv.suppliers.length > 0) {
        this.suppliers = srv.suppliers;
      }
      if (Array.isArray(srv.inventoryChecks)) {
        this.inventoryChecks = this.mergeItemsById(this.inventoryChecks, srv.inventoryChecks);
      }
      if (Array.isArray(srv.disposals)) {
        this.disposals = this.mergeItemsById(this.disposals, srv.disposals);
      }
      if (Array.isArray(srv.healthEvents)) {
        this.healthEvents = this.mergeItemsById(this.healthEvents, srv.healthEvents, deletedEventSet);
      }
      if (Array.isArray(srv.healthCheckups)) {
        this.healthCheckups = this.mergeItemsById(this.healthCheckups, srv.healthCheckups, deletedCheckupSet);
      }
      if (Array.isArray(srv.users) && srv.users.length > 0) {
        this.users = this.mergeItemsById(this.users, srv.users, deletedUserSet);
        this.normalizeUsersToTwoRoles();
      }
      if (srv.settings && typeof srv.settings === 'object') {
        this.settings = { ...this.settings, ...srv.settings };
      }

      // 3.1 Staff Members & Teachers (Cán bộ - Giáo viên)
      const localStaffCountBefore = this.staffMembers.length;
      const srvStaffCount = Array.isArray(srv.staffMembers) ? srv.staffMembers.length : 0;
      const srvStaffTime = Number(srv.staffUpdatedAt || 0);
      const localStaffTime =
        this.lastStaffMutationAt ||
        Number(localStorage.getItem('thcs_dt_staff_updated_at') || 0);

      if (srv.staffCleaned && srvStaffTime >= localStaffTime) {
        if (this.staffMembers.length > 0) {
          this.staffMembers = [];
          localStorage.setItem('thcs_dongthanh_staff_cleaned_v1', 'true');
        }
      } else if (Array.isArray(srv.staffMembers) && srvStaffCount > 0) {
        if (
          this.isHoldingOnlyDemoStaff() ||
          srvStaffCount > localStaffCountBefore ||
          srvStaffTime >= localStaffTime
        ) {
          this.staffMembers = srv.staffMembers.filter(
            (s: SchoolStaff) => s && !deletedStaffSet.has(s.id)
          );
          localStorage.removeItem('thcs_dongthanh_staff_cleaned_v1');
        } else {
          this.staffMembers = this.mergeItemsById(this.staffMembers, srv.staffMembers, deletedStaffSet);
        }
      } else if (deletedStaffSet.size > 0) {
        this.staffMembers = this.staffMembers.filter((s) => !deletedStaffSet.has(s.id));
      }

      // 4. Students, Health Profiles & Classes (GVCN)
      const localStuCountBefore = this.students.length;
      const incomingSrvStudents = Array.isArray(srv.students)
        ? srv.students.filter((s: Student) => s && !deletedStudentSet.has(s.id))
        : [];
      const srvStuCount = incomingSrvStudents.length;
      const srvStuTime = Number(srv.studentsUpdatedAt || 0);
      const localStuTime =
        this.lastLocalStudentMutationAt ||
        Number(localStorage.getItem('thcs_dt_students_updated_at') || 0);
      const srvClasses: SchoolClass[] = Array.isArray(srv.classes) ? srv.classes : [];
      const srvHadOnlyDemoClasses = this.isOnlyDemoSchoolClasses(srvClasses);
      const localHadRealClasses = !this.isOnlyDemoSchoolClasses(this.classes);

      if (
        Array.isArray(srv.students) &&
        ((srvStuCount > localStuCountBefore && srvStuTime >= localStuTime) ||
          (srvStuCount > 0 && this.isHoldingOnlyDemoStudents() && srv.realStudentsImported))
      ) {
        this.students = this.mergeItemsById(this.students, incomingSrvStudents, deletedStudentSet);
        if (Array.isArray(srv.healthProfiles)) {
          this.healthProfiles = this.mergeItemsById(this.healthProfiles, srv.healthProfiles).filter(
            (hp) => !deletedStudentSet.has(hp.studentId)
          );
        }
        if (srv.realStudentsImported) {
          localStorage.setItem('thcs_dongthanh_real_students_imported', 'true');
        }
      } else {
        this.students = this.students.filter((s) => !deletedStudentSet.has(s.id));
        if (Array.isArray(srv.healthProfiles) && srv.healthProfiles.length > 0) {
          this.healthProfiles = this.mergeItemsById(this.healthProfiles, srv.healthProfiles).filter(
            (hp) => !deletedStudentSet.has(hp.studentId)
          );
        }
      }

      // Always merge classes & Homeroom Teachers (GVCN) regardless of whether student count changed
      if (srvClasses.length > 0 || this.classes.length > 0) {
        this.classes = this.mergeSchoolClasses(this.classes, srvClasses, deletedClassSet);
        for (const c of this.classes) {
          c.totalStudents =
            this.students.filter(
              (s) =>
                s.className === c.name ||
                normalizeClassName(s.className) === normalizeClassName(c.name)
            ).length ||
            c.totalStudents ||
            0;
        }
      }

      const countNonDemoTeachers = (arr: SchoolClass[]) =>
        (arr || []).filter((c) => !this.isDemoSchoolClass(c) && Boolean(c.homeroomTeacher?.trim())).length;
      const localHasNewerOrRicherClasses =
        (localHadRealClasses && srvHadOnlyDemoClasses) ||
        this.classes.length > srvClasses.length ||
        countNonDemoTeachers(this.classes) > countNonDemoTeachers(srvClasses);

      const localHasNewerOrRicherStaff =
        this.staffMembers.length > srvStaffCount ||
        (localStaffTime > srvStaffTime && this.staffMembers.length > 0);

      this.saveAll(false);
      this.setSyncStatus('saved');
      this.notify();

      // If local had records, Homeroom Teachers (GVCN), or Staff that weren't on the server yet, push merged state back to server
      if (
        pushBackIfLocalNewer &&
        (this.clinicVisits.length > srvVisitCount ||
          this.transactions.length > srvTxCount ||
          this.students.length > srvStuCount ||
          localHasNewerOrRicherClasses ||
          localHasNewerOrRicherStaff)
      ) {
        await this.pushStateToServer();
      }
      return true;
    } catch {
      return false;
    } finally {
      this.isPullingFromServer = false;
    }
  }

  private isPushingStateToServer = false;
  private scheduleServerPush(immediate = false) {
    if (typeof window === 'undefined') return;
    if (this.serverSyncTimer) clearTimeout(this.serverSyncTimer);
    const delay = immediate ? 50 : 1200;
    this.serverSyncTimer = setTimeout(() => {
      this.pushStateToServer();
    }, delay);
  }

  public async pushStateToServer(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (this.isPushingStateToServer) return false;
    this.isPushingStateToServer = true;
    try {
      const nonEmptyProfiles = this.healthProfiles.filter(
        (hp) =>
          hp.allergies ||
          hp.chronicConditions ||
          hp.specialAttention ||
          hp.notes ||
          hp.height ||
          hp.weight ||
          hp.bloodType ||
          hp.visionLeft ||
          hp.visionRight
      );
      const payload = {
        medicines: this.medicines,
        batches: this.batches,
        transactions: this.transactions,
        suppliers: this.suppliers,
        supplies: this.supplies,
        usageRecords: this.usageRecords,
        inventoryChecks: this.inventoryChecks,
        disposals: this.disposals,
        settings: this.settings,
        users: this.users,
        staffMembers: this.staffMembers,
        students: this.students,
        healthProfiles: nonEmptyProfiles,
        clinicVisits: this.clinicVisits,
        healthEvents: this.healthEvents,
        healthCheckups: this.healthCheckups,
        classes: this.classes,
        deletedVisitIds: this.getDeletedVisitIds(),
        deletedEventIds: this.getDeletedEventIds(),
        deletedCheckupIds: this.getDeletedCheckupIds(),
        deletedTxIds: this.getDeletedTxIds(),
        deletedStudentIds: this.getDeletedStudentIds(),
        deletedUserIds: this.getDeletedUserIds(),
        deletedClassIds: this.getDeletedClassIds(),
        deletedStaffIds: this.getDeletedStaffIds(),
        staffUpdatedAt:
          this.lastStaffMutationAt ||
          Number(localStorage.getItem('thcs_dt_staff_updated_at') || Date.now()),
        staffCleaned: localStorage.getItem('thcs_dongthanh_staff_cleaned_v1') === 'true',
        replaceAllStaff: this.lastStaffReplaceAll,
        realStudentsImported: localStorage.getItem('thcs_dongthanh_real_students_imported') === 'true',
        studentsCleaned: localStorage.getItem('thcs_dongthanh_students_clean_v1') === 'true',
        inventoryUpdatedAt:
          this.lastInventoryMutationAt ||
          Number(localStorage.getItem('thcs_dt_last_inventory_mutation_at') || 0),
        studentsUpdatedAt:
          this.lastLocalStudentMutationAt ||
          Number(localStorage.getItem('thcs_dt_students_updated_at') || 0),
        classesUpdatedAt:
          this.lastLocalStudentMutationAt ||
          Number(localStorage.getItem('thcs_dt_classes_updated_at') || 0),
      };
      this.lastStaffReplaceAll = false;
      // Always push directly to Cloud Firestore schoolSync chunks in parallel so ais-dev, ais-pre, home & school computers sync immediately
      const nextRev = (this.lastServerRevision || 1) + 1;
      pushSharedSchoolClassesToCloud(
        this.classes,
        payload.deletedClassIds,
        payload.classesUpdatedAt || Date.now(),
        nextRev
      ).catch(() => {});
      pushSharedOperationalToCloud(
        {
          medicines: this.medicines,
          batches: this.batches,
          transactions: this.transactions,
          suppliers: this.suppliers,
          supplies: this.supplies,
          usageRecords: this.usageRecords,
          inventoryChecks: this.inventoryChecks,
          disposals: this.disposals,
          settings: this.settings,
          users: this.users,
          staffMembers: this.staffMembers,
          clinicVisits: this.clinicVisits,
          healthEvents: this.healthEvents,
          healthCheckups: this.healthCheckups,
          deletedVisitIds: payload.deletedVisitIds,
          deletedEventIds: payload.deletedEventIds,
          deletedCheckupIds: payload.deletedCheckupIds,
          deletedTxIds: payload.deletedTxIds,
          deletedStudentIds: payload.deletedStudentIds,
          deletedUserIds: payload.deletedUserIds,
          deletedClassIds: payload.deletedClassIds,
          deletedStaffIds: payload.deletedStaffIds,
          staffUpdatedAt: payload.staffUpdatedAt,
          staffCleaned: payload.staffCleaned,
          inventoryUpdatedAt: payload.inventoryUpdatedAt,
          classesUpdatedAt: payload.classesUpdatedAt,
          studentsUpdatedAt: payload.studentsUpdatedAt,
          realStudentsImported: payload.realStudentsImported,
          studentsCleaned: payload.studentsCleaned,
        },
        nextRev
      ).catch(() => {});
      if (this.students.length > 0 && !this.isHoldingOnlyDemoStudents()) {
        pushSharedStudentsToCloud(
          this.students,
          nonEmptyProfiles,
          payload.studentsUpdatedAt || Date.now(),
          payload.realStudentsImported,
          payload.studentsCleaned,
          nextRev,
          payload.deletedStudentIds
        ).catch(() => {});
      }

      const res = await fetch('/api/school-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.revision) {
          this.lastServerRevision = data.revision;
        }
        this.setSyncStatus('saved');
        return true;
      }
      this.setSyncStatus('offline');
      return false;
    } catch {
      this.setSyncStatus('offline');
      return false;
    } finally {
      this.isPushingStateToServer = false;
    }
  }

  private async pushClinicVisitToServer(
    action: 'upsert' | 'delete',
    visit?: ClinicVisit,
    visitId?: string,
    healthProfile?: StudentHealthProfile
  ): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const nextRev = (this.lastServerRevision || 1) + 1;
      // Push directly to Cloud Firestore schoolSync/thcs_dt_operational so all computers update in real time
      pushSharedOperationalToCloud(
        {
          medicines: this.medicines,
          batches: this.batches,
          transactions: this.transactions,
          suppliers: this.suppliers,
          supplies: this.supplies,
          usageRecords: this.usageRecords,
          inventoryChecks: this.inventoryChecks,
          disposals: this.disposals,
          settings: this.settings,
          users: this.users,
          staffMembers: this.staffMembers,
          clinicVisits: this.clinicVisits,
          healthEvents: this.healthEvents,
          healthCheckups: this.healthCheckups,
          deletedVisitIds: this.getDeletedVisitIds(),
          deletedEventIds: this.getDeletedEventIds(),
          deletedCheckupIds: this.getDeletedCheckupIds(),
          deletedTxIds: this.getDeletedTxIds(),
          deletedStudentIds: this.getDeletedStudentIds(),
          deletedUserIds: this.getDeletedUserIds(),
          deletedClassIds: this.getDeletedClassIds(),
          deletedStaffIds: this.getDeletedStaffIds(),
          staffUpdatedAt:
            this.lastStaffMutationAt ||
            Number(localStorage.getItem('thcs_dt_staff_updated_at') || Date.now()),
          staffCleaned: localStorage.getItem('thcs_dongthanh_staff_cleaned_v1') === 'true',
          inventoryUpdatedAt:
            this.lastInventoryMutationAt ||
            Number(localStorage.getItem('thcs_dt_last_inventory_mutation_at') || 0),
          classesUpdatedAt: Number(localStorage.getItem('thcs_dt_classes_updated_at') || 0),
          studentsUpdatedAt: Number(localStorage.getItem('thcs_dt_students_updated_at') || 0),
          realStudentsImported: localStorage.getItem('thcs_dongthanh_real_students_imported') === 'true',
          studentsCleaned: localStorage.getItem('thcs_dongthanh_students_clean_v1') === 'true',
        },
        nextRev
      ).catch(() => {});

      const res = await fetch('/api/clinic-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          visit,
          visitId,
          batches: this.batches,
          medicines: this.medicines,
          transactions: this.transactions,
          supplies: this.supplies,
          healthProfile,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.revision) {
          this.lastServerRevision = data.revision;
        }
        this.setSyncStatus('saved');
      } else {
        this.setSyncStatus('offline');
      }
    } catch {
      this.setSyncStatus('offline');
    }
  }

  public getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  public subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    listener(this.getSyncStatus());
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  public setSyncStatus(state: SyncState, errorMessage: string | null = null) {
    this.syncStatus = {
      ...this.syncStatus,
      state,
      lastSavedAt: state === 'saved' ? new Date() : this.syncStatus.lastSavedAt,
      errorMessage,
      currentUserId: this.currentUserId,
    };
    for (const listener of this.syncListeners) {
      try {
        listener(this.getSyncStatus());
      } catch (e) {
        console.error('Error in sync listener', e);
      }
    }
  }

  public async bindUser(userId: string, userProfile?: User): Promise<void> {
    if (!userId) return;

    if (this.currentUserId === userId && this.unsubscribeFirestore) {
      if (userProfile) {
        this.currentUser = { ...this.currentUser, ...userProfile };
        this.notify();
      }
      return;
    }

    this.unbindUser(false);
    this.currentUserId = userId;

    if (userProfile) {
      this.currentUser = { ...userProfile };
    }

    // Load local storage cache for this user immediately for fast UI response
    this.loadUserLocalData(userId);
    this.notify();

    // Verify connection and attach real-time Firestore listeners only if cloud sync is allowed
    if (isCloudSyncAllowed(userId)) {
      this.setSyncStatus('loading');
      testConnection().then((connected) => {
        if (!connected) {
          this.setSyncStatus('offline');
        }
      });
      this.setupFirestoreSync(userId);
      this.checkAndSeedNewUser(userId);
    } else {
      this.setSyncStatus('idle');
    }
  }

  public unbindUser(notify = true): void {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    this.currentUserId = null;
    this.setSyncStatus('idle');
    if (notify) {
      this.notify();
    }
  }

  private setupFirestoreSync(userId: string): void {
    this.unsubscribeFirestore = subscribeToUserSubcollections(
      userId,
      {
        medicines: (data: Medicine[]) => {
          const userCatalogSynced =
            typeof window !== 'undefined' &&
            localStorage.getItem(`thcs_dt_med_v7_${userId}`) === FIXED_MEDICINES_CATALOG_VERSION;

          if (data && data.length > 0 && userCatalogSynced) {
            const missing = INITIAL_MEDICINES.filter(
              (im) => !data.some((m) => m.id === im.id || m.code === im.code || m.name.toLowerCase().trim() === im.name.toLowerCase().trim())
            );
            if (missing.length > 0) {
              const toAdd = missing.map((m) => ({ ...m, userId }));
              this.medicines = [...data, ...toAdd];
            } else {
              const orderMap = new Map(INITIAL_MEDICINES.map((m, idx) => [m.id, idx]));
              this.medicines = [...data].sort((a, b) => {
                const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
                const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
                return ia - ib;
              });
            }
            this.saveUserLocalData(userId);
            this.setSyncStatus('saved');
            this.notify();
          } else {
            if (this.medicines.length === 0) {
              this.medicines = INITIAL_MEDICINES.map((m) => ({ ...m, userId }));
            }
            if (this.batches.length === 0) {
              this.batches = INITIAL_BATCHES.map((b) => ({ ...b, userId }));
            }
            for (const med of this.medicines) {
              const medBatches = this.batches.filter((b) => b.medicineId === med.id);
              med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
            }
            if (typeof window !== 'undefined') {
              localStorage.setItem(`thcs_dt_med_v7_${userId}`, FIXED_MEDICINES_CATALOG_VERSION);
              localStorage.setItem('thcs_dt_fixed_catalog_version', FIXED_MEDICINES_CATALOG_VERSION);
            }
            this.saveAll(false);
            this.setSyncStatus('saved');
            this.notify();
          }
        },
        batches: (data: MedicineBatch[]) => {
          const localInvTime =
            this.lastInventoryMutationAt ||
            Number(localStorage.getItem('thcs_dt_last_inventory_mutation_at') || 0);
          if (Date.now() - localInvTime < 15000 || isFirestoreQuotaExhausted()) {
            return;
          }
          if (data && data.length > 0) {
            this.batches = data;
            for (const med of this.medicines) {
              const medBatches = this.batches.filter((b) => b.medicineId === med.id);
              med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
            }
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        transactions: (data: InventoryTransaction[]) => {
          if (data && data.length > 0) {
            this.transactions = this.mergeItemsById(this.transactions, data).sort(
              (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
            );
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        suppliers: (data: Supplier[]) => {
          if (data) {
            this.suppliers = data.length > 0 ? data : DEFAULT_SUPPLIERS;
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        supplies: (data: MedicalSupply[]) => {
          if (data) {
            this.supplies = data.length > 0 ? data : INITIAL_SUPPLIES;
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        usageRecords: (data: UsageRecord[]) => {
          if (data) {
            this.usageRecords = data;
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        inventoryChecks: (data: InventoryCheck[]) => {
          if (data) {
            this.inventoryChecks = data;
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        auditLogs: (data: AuditLog[]) => {
          if (data && data.length > 0) {
            this.auditLogs = data.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        settings: (data: AppSettings) => {
          if (data) {
            this.settings = { ...this.settings, ...data };
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        students: (data: Student[]) => {
          // Guard against partial chunk snapshots while bulk uploading or mutating locally
          if (this.activeCloudWriteCount > 0 || Date.now() - this.lastLocalStudentMutationAt < 4500) {
            return;
          }
          const isCleanFlag =
            typeof window !== 'undefined' &&
            localStorage.getItem('thcs_dongthanh_students_clean_v1') === 'true';
          const hasRealImported =
            typeof window !== 'undefined' &&
            localStorage.getItem('thcs_dongthanh_real_students_imported') === 'true';

          if (data && data.length > 0) {
            const isIncomingOnlyDemo =
              data.length <= INITIAL_STUDENTS.length &&
              data.every((d) => INITIAL_STUDENTS.some((init) => init.id === d.id || init.studentCode === d.studentCode));

            // If local already has real imported students (or was explicitly cleaned) and cloud still has old demo data
            // or fewer records from an interrupted sync, preserve local authoritative data without triggering a write storm!
            if (
              (hasRealImported && (isIncomingOnlyDemo || (this.students.length > data.length && !this.isHoldingOnlyDemoStudents()))) ||
              (isCleanFlag && this.students.length === 0 && isIncomingOnlyDemo)
            ) {
              return;
            }

            const deletedStudentSet = new Set(this.getDeletedStudentIds());
            this.students = this.mergeItemsById(this.students, data, deletedStudentSet);
            this.saveStudentBundleLocally();
            this.setSyncStatus('saved');
            this.notify();
          } else if (data && data.length === 0 && isCleanFlag && !hasRealImported) {
            this.students = [];
            this.saveStudentBundleLocally();
            this.setSyncStatus('saved');
            this.notify();
          }
        },
        healthProfiles: (data: StudentHealthProfile[]) => {
          if (this.activeCloudWriteCount > 0 || Date.now() - this.lastLocalStudentMutationAt < 4500) {
            return;
          }
          if (data && data.length > 0) {
            const hasRealImported =
              typeof window !== 'undefined' &&
              localStorage.getItem('thcs_dongthanh_real_students_imported') === 'true';
            if (hasRealImported && this.healthProfiles.length > data.length) {
              return;
            }
            this.healthProfiles = data;
            this.saveStudentBundleLocally();
            this.notify();
          }
        },
        clinicVisits: (data: ClinicVisit[]) => {
          if (data && data.length > 0) {
            const deletedSet = new Set(this.getDeletedVisitIds());
            this.clinicVisits = this.mergeItemsById(this.clinicVisits, data, deletedSet)
              .filter((v) => !deletedSet.has(v.id))
              .sort(
                (a, b) =>
                  (new Date(b.createdAt || `${b.visitDate}T${b.timeIn || '00:00'}`).getTime() || 0) -
                  (new Date(a.createdAt || `${a.visitDate}T${a.timeIn || '00:00'}`).getTime() || 0)
              );
            this.cachedNormalizedVisits = null;
            this.saveAll(true);
            this.notify();
          }
        },
        healthEvents: (data: HealthEvent[]) => {
          if (data && data.length > 0) {
            const deletedSet = new Set(this.getDeletedEventIds());
            this.healthEvents = this.mergeItemsById(this.healthEvents, data, deletedSet);
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        healthCheckups: (data: HealthCheckup[]) => {
          if (data && data.length > 0) {
            const deletedSet = new Set(this.getDeletedCheckupIds());
            this.healthCheckups = this.mergeItemsById(this.healthCheckups, data, deletedSet);
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
        schoolClasses: (data: SchoolClass[]) => {
          if (this.activeCloudWriteCount > 0 || Date.now() - this.lastLocalStudentMutationAt < 4500) {
            return;
          }
          if (data && data.length > 0) {
            const deletedClassSet = new Set(this.getDeletedClassIds());
            this.classes = this.mergeSchoolClasses(this.classes, data, deletedClassSet);
            this.saveStudentBundleLocally();
            this.scheduleServerPush();
            this.notify();
          }
        },
        disposals: (data: MedicineDisposal[]) => {
          if (data) {
            this.disposals = data.sort(
              (a, b) => new Date(b.disposalDate || b.createdAt).getTime() - new Date(a.disposalDate || a.createdAt).getTime()
            );
            this.saveUserLocalData(userId);
            this.notify();
          }
        },
      },
      (subcollection, error) => {
        console.warn(`Firestore sync note for ${subcollection}:`, error);
        if (error?.message?.includes('offline') || !navigator.onLine) {
          this.setSyncStatus('offline');
        } else {
          this.setSyncStatus('error', error?.message || 'Lỗi đồng bộ');
        }
      }
    );
  }

  public isHoldingOnlyDemoStudents(): boolean {
    if (this.students.length === 0) return false;
    if (this.students.length > INITIAL_STUDENTS.length) return false;
    const demoCodes = new Set(INITIAL_STUDENTS.map((s) => s.studentCode.toUpperCase()));
    return this.students.every((s) => demoCodes.has(s.studentCode.toUpperCase()));
  }

  public isHoldingOnlyDemoStaff(): boolean {
    if (this.staffMembers.length === 0) return false;
    if (this.staffMembers.length > INITIAL_STAFF_MEMBERS.length) return false;
    const demoIds = new Set(INITIAL_STAFF_MEMBERS.map((s) => s.id));
    return this.staffMembers.every((s) => demoIds.has(s.id));
  }

  private saveStudentBundleLocally() {
    try {
      this.safeSetLocalStorage(STORAGE_KEYS.STUDENTS, JSON.stringify(this.students));
      // Only store health profiles with actual medical notes/vitals in LocalStorage to save ~2.5MB and prevent 5MB QuotaExceededError
      const compactProfiles = this.healthProfiles.filter(
        (hp) =>
          hp.allergies ||
          hp.chronicConditions ||
          hp.specialAttention ||
          hp.notes ||
          hp.height ||
          hp.weight ||
          hp.bloodType ||
          hp.visionLeft ||
          hp.visionRight
      );
      this.safeSetLocalStorage(STORAGE_KEYS.STUDENT_HEALTH_PROFILES, JSON.stringify(compactProfiles));
      this.safeSetLocalStorage(STORAGE_KEYS.SCHOOL_CLASSES, JSON.stringify(this.classes));
      if (this.currentUserId) {
        // Remove legacy duplicate per-user student keys to avoid 5MB LocalStorage overflow
        try {
          localStorage.removeItem(`thcs_dt_${this.currentUserId}_students`);
          localStorage.removeItem(`thcs_dt_${this.currentUserId}_profiles`);
          localStorage.removeItem(`thcs_dt_${this.currentUserId}_classes`);
        } catch {
          // ignore
        }
      }
      idbSaveStudentBundle({
        students: this.students,
        healthProfiles: this.healthProfiles,
        classes: this.classes,
        updatedAt: new Date().toISOString(),
      }).then((ok) => {
        if (ok) this.idbSynced = true;
      });
    } catch (e) {
      console.warn('saveStudentBundleLocally warning:', e);
    }
  }

  private saveOperationalBundleLocally() {
    try {
      idbSaveOperationalBundle({
        clinicVisits: this.clinicVisits,
        medicines: this.medicines,
        batches: this.batches,
        transactions: this.transactions,
        supplies: this.supplies,
        suppliers: this.suppliers,
        usageRecords: this.usageRecords,
        inventoryChecks: this.inventoryChecks,
        disposals: this.disposals,
        healthEvents: this.healthEvents,
        healthCheckups: this.healthCheckups,
        users: this.users,
        staffMembers: this.staffMembers,
        settings: this.settings,
        deletedVisitIds: this.getDeletedVisitIds(),
        deletedUserIds: this.getDeletedUserIds(),
        inventoryUpdatedAt: this.lastInventoryMutationAt || Date.now(),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // ignore
    }
  }

  public async syncStudentsToCloud(): Promise<{
    syncedStudents: number;
    syncedClasses: number;
    deletedObsolete: number;
    cloudActive: boolean;
  }> {
    this.saveStudentBundleLocally();
    if (!this.currentUserId || !isCloudSyncAllowed(this.currentUserId)) {
      return {
        syncedStudents: this.students.length,
        syncedClasses: this.classes.length,
        deletedObsolete: 0,
        cloudActive: false,
      };
    }

    this.activeCloudWriteCount++;
    this.lastLocalStudentMutationAt = Date.now();
    this.setSyncStatus('saving');
    try {
      const res = await syncStudentCollectionsToCloud(this.currentUserId, {
        students: this.students,
        healthProfiles: this.healthProfiles,
        classes: this.classes,
        pruneObsolete: true,
      });
      this.lastLocalStudentMutationAt = Date.now();
      this.setSyncStatus('saved');
      return { ...res, cloudActive: true };
    } catch (err: any) {
      this.setSyncStatus('error', err?.message || 'Lỗi đồng bộ danh sách học sinh lên Cloud');
      throw err;
    } finally {
      this.activeCloudWriteCount = Math.max(0, this.activeCloudWriteCount - 1);
    }
  }

  public async getStorageDiagnostics(): Promise<StorageDiagnostics> {
    const activeUserId = this.currentUserId || this.currentUser?.id || 'usr-medic';
    const quotaExhausted = isFirestoreQuotaExhausted();
    const cloudAllowed = isCloudSyncAllowed(activeUserId);

    let localStudentsCount = this.students.length;
    let localBytes = 0;
    try {
      const sStr = localStorage.getItem(STORAGE_KEYS.STUDENTS) || '';
      const pStr = localStorage.getItem(STORAGE_KEYS.STUDENT_HEALTH_PROFILES) || '';
      const cStr = localStorage.getItem(STORAGE_KEYS.SCHOOL_CLASSES) || '';
      localBytes = (sStr.length + pStr.length + cStr.length) * 2;
      if (sStr) {
        const parsed = JSON.parse(sStr);
        if (Array.isArray(parsed)) localStudentsCount = parsed.length;
      }
    } catch {
      localBytes = 0;
    }

    let idbStudentsCount = this.students.length;
    let idbClassesCount = this.classes.length;
    let idbUpdatedAt: string | null = null;
    try {
      const bundle = await idbLoadStudentBundle();
      if (bundle && Array.isArray(bundle.students)) {
        idbStudentsCount = bundle.students.length;
        idbClassesCount = Array.isArray(bundle.classes) ? bundle.classes.length : this.classes.length;
        idbUpdatedAt = bundle.updatedAt || null;
      }
    } catch {
      // ignore
    }

    let cloudSyncStatus: 'synced' | 'syncing' | 'quota_protected' | 'local' = 'local';
    if (quotaExhausted) {
      cloudSyncStatus = 'quota_protected';
    } else if (this.syncStatus.state === 'saving' || this.syncStatus.state === 'loading') {
      cloudSyncStatus = 'syncing';
    } else if (cloudAllowed) {
      cloudSyncStatus = 'synced';
    }

    return {
      memoryStudentsCount: this.students.length,
      memoryClassesCount: this.classes.length,
      memoryProfilesCount: this.healthProfiles.length,
      idbDatabaseName: 'thcs_dongthanh_idb_v1',
      idbStudentsCount,
      idbClassesCount,
      idbUpdatedAt,
      localStorageStudentsCount: localStudentsCount,
      localStorageSizeKB: Math.round(localBytes / 1024),
      cloudSyncStatus,
      cloudSyncAllowed: cloudAllowed,
      quotaExhausted,
      firestorePath: `/users/${activeUserId}/students`,
    };
  }

  public async forceSyncAllStorage(tryResetQuota = false): Promise<StorageDiagnostics> {
    if (tryResetQuota) {
      await resetFirestoreQuotaCircuitBreaker();
    }
    this.saveAll();
    await idbSaveStudentBundle({
      students: this.students,
      healthProfiles: this.healthProfiles,
      classes: this.classes,
      updatedAt: new Date().toISOString(),
    });
    this.idbSynced = true;
    if (this.currentUserId && isCloudSyncAllowed(this.currentUserId)) {
      try {
        await this.syncStudentsToCloud();
      } catch {
        // Handled by quota circuit breaker
      }
    }
    return await this.getStorageDiagnostics();
  }

  private async checkAndSeedNewUser(userId: string): Promise<void> {
    if (this.isSeeding) return;
    this.isSeeding = true;
    try {
      const exists = await checkUserDataExists(userId);
      const isStudentsClean =
        typeof window !== 'undefined' &&
        (localStorage.getItem('thcs_dongthanh_students_clean_v1') === 'true' ||
          localStorage.getItem('thcs_dongthanh_real_students_imported') === 'true');

      if (!exists) {
        this.activeCloudWriteCount++;
        this.setSyncStatus('saving');
        await seedInitialUserData(userId, {
          medicines: (this.medicines.length > 0 ? this.medicines : INITIAL_MEDICINES).map((m) => ({ ...m, userId })),
          batches: (this.batches.length > 0 ? this.batches : INITIAL_BATCHES).map((b) => ({ ...b, userId })),
          transactions: (this.transactions.length > 0 ? this.transactions : INITIAL_TRANSACTIONS).map((t) => ({ ...t, userId })),
          suppliers: (this.suppliers.length > 0 ? this.suppliers : DEFAULT_SUPPLIERS).map((s) => ({ ...s, userId })),
          supplies: (this.supplies.length > 0 ? this.supplies : INITIAL_SUPPLIES).map((s) => ({ ...s, userId })),
          usageRecords: (this.usageRecords.length > 0 ? this.usageRecords : INITIAL_USAGE_RECORDS).map((u) => ({ ...u, userId })),
          inventoryChecks: (this.inventoryChecks.length > 0 ? this.inventoryChecks : INITIAL_INVENTORY_CHECKS).map((c) => ({ ...c, userId })),
          auditLogs: (this.auditLogs.length > 0 ? this.auditLogs : INITIAL_AUDIT_LOGS).map((l) => ({ ...l, userId })),
          settings: { ...(this.settings || DEFAULT_SETTINGS), userId },
          students: (this.students.length > 0 ? this.students : isStudentsClean ? [] : INITIAL_STUDENTS).map((st) => ({ ...st, userId })),
          healthProfiles: (this.healthProfiles.length > 0 ? this.healthProfiles : isStudentsClean ? [] : INITIAL_HEALTH_PROFILES).map((hp) => ({ ...hp, userId })),
          clinicVisits: (this.clinicVisits.length > 0 ? this.clinicVisits : isStudentsClean ? [] : INITIAL_CLINIC_VISITS).map((cv) => ({ ...cv, userId })),
          healthEvents: (this.healthEvents.length > 0 ? this.healthEvents : isStudentsClean ? [] : INITIAL_HEALTH_EVENTS).map((he) => ({ ...he, userId })),
          healthCheckups: (this.healthCheckups.length > 0 ? this.healthCheckups : isStudentsClean ? [] : INITIAL_HEALTH_CHECKUPS).map((hc) => ({ ...hc, userId })),
          classes: (this.classes.length > 0 ? this.classes : isStudentsClean ? [] : DEFAULT_CLASSES).map((c) => ({ ...c, userId })),
          disposals: (this.disposals.length > 0 ? this.disposals : INITIAL_DISPOSALS).map((d) => ({ ...d, userId })),
        });
        this.setSyncStatus('saved');
      }
    } catch (e) {
      console.error('Error seeding initial user data to Firestore:', e);
    } finally {
      this.activeCloudWriteCount = Math.max(0, this.activeCloudWriteCount - 1);
      this.isSeeding = false;
    }
  }

  public async syncAllToCloud(): Promise<void> {
    this.saveStudentBundleLocally();
    if (!this.currentUserId || !isCloudSyncAllowed(this.currentUserId)) return;
    this.activeCloudWriteCount++;
    this.lastLocalStudentMutationAt = Date.now();
    this.setSyncStatus('saving');
    try {
      await syncStudentCollectionsToCloud(this.currentUserId, {
        students: this.students,
        healthProfiles: this.healthProfiles,
        classes: this.classes,
        pruneObsolete: true,
      });
      await seedInitialUserData(this.currentUserId, {
        medicines: this.medicines.map((m) => ({ ...m, userId: this.currentUserId! })),
        batches: this.batches.map((b) => ({ ...b, userId: this.currentUserId! })),
        transactions: this.transactions.map((t) => ({ ...t, userId: this.currentUserId! })),
        suppliers: this.suppliers.map((s) => ({ ...s, userId: this.currentUserId! })),
        supplies: this.supplies.map((s) => ({ ...s, userId: this.currentUserId! })),
        usageRecords: this.usageRecords.map((u) => ({ ...u, userId: this.currentUserId! })),
        inventoryChecks: this.inventoryChecks.map((c) => ({ ...c, userId: this.currentUserId! })),
        auditLogs: this.auditLogs.map((l) => ({ ...l, userId: this.currentUserId! })),
        settings: { ...this.settings, userId: this.currentUserId! },
        students: [],
        healthProfiles: [],
        clinicVisits: this.clinicVisits.map((cv) => ({ ...cv, userId: this.currentUserId! })),
        healthEvents: this.healthEvents.map((he) => ({ ...he, userId: this.currentUserId! })),
        healthCheckups: this.healthCheckups.map((hc) => ({ ...hc, userId: this.currentUserId! })),
        classes: [],
        disposals: this.disposals.map((d) => ({ ...d, userId: this.currentUserId! })),
      });
      this.lastLocalStudentMutationAt = Date.now();
      this.setSyncStatus('saved');
    } catch (err: any) {
      this.setSyncStatus('error', err?.message || 'Lỗi đồng bộ');
    } finally {
      this.activeCloudWriteCount = Math.max(0, this.activeCloudWriteCount - 1);
    }
  }

  public async persistItem(
    subcollection: string,
    docId: string,
    data: any,
    op: 'set' | 'delete' = 'set'
  ): Promise<void> {
    if (!this.currentUserId || !isCloudSyncAllowed(this.currentUserId)) return;
    this.activeCloudWriteCount++;
    if (subcollection === 'students' || subcollection === 'healthProfiles' || subcollection === 'schoolClasses') {
      this.lastLocalStudentMutationAt = Date.now();
    }
    this.setSyncStatus('saving');
    try {
      await persistUserDoc(this.currentUserId, subcollection, docId, data, op);
      this.setSyncStatus('saved');
    } catch (error: any) {
      this.setSyncStatus('error', error?.message || 'Lỗi lưu Firestore');
    } finally {
      this.activeCloudWriteCount = Math.max(0, this.activeCloudWriteCount - 1);
    }
  }

  public async persistBatch(writes: BatchWriteOp[]): Promise<void> {
    if (!this.currentUserId || writes.length === 0 || !isCloudSyncAllowed(this.currentUserId)) return;
    this.activeCloudWriteCount++;
    if (writes.some((w) => w.subcollection === 'students' || w.subcollection === 'healthProfiles' || w.subcollection === 'schoolClasses')) {
      this.lastLocalStudentMutationAt = Date.now();
    }
    this.setSyncStatus('saving');
    try {
      await persistUserBatch(this.currentUserId, writes);
      this.setSyncStatus('saved');
    } catch (error: any) {
      this.setSyncStatus('error', error?.message || 'Lỗi lưu batch Firestore');
    } finally {
      this.activeCloudWriteCount = Math.max(0, this.activeCloudWriteCount - 1);
    }
  }

  private loadUserLocalData(userId: string) {
    try {
      const p = (k: string) => `thcs_dt_${userId}_${k}`;
      const st = localStorage.getItem(p('students'));
      const cv = localStorage.getItem(p('visits'));
      const hp = localStorage.getItem(p('profiles'));
      const cl = localStorage.getItem(p('classes'));
      const t = localStorage.getItem(p('txs'));

      const globalStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      const globalProfiles = localStorage.getItem(STORAGE_KEYS.STUDENT_HEALTH_PROFILES);
      const globalClasses = localStorage.getItem(STORAGE_KEYS.SCHOOL_CLASSES);
      const globalVisits = localStorage.getItem(STORAGE_KEYS.CLINIC_VISITS);
      const globalTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const globalBatches = localStorage.getItem(STORAGE_KEYS.BATCHES);
      const globalMedicines = localStorage.getItem(STORAGE_KEYS.MEDICINES);

      // Canonical school-wide medicines & batches (preserve deducted quantities!)
      if (globalBatches) {
        const parsedBatches: MedicineBatch[] = JSON.parse(globalBatches);
        if (Array.isArray(parsedBatches) && parsedBatches.length > 0) {
          this.batches = parsedBatches;
        }
      }
      if (globalMedicines) {
        const parsedMeds: Medicine[] = JSON.parse(globalMedicines);
        if (Array.isArray(parsedMeds) && parsedMeds.length > 0) {
          this.medicines = parsedMeds;
        }
      }
      for (const med of this.medicines) {
        const medBatches = this.batches.filter((bt) => bt.medicineId === med.id);
        med.totalStock = medBatches.reduce((acc, bt) => acc + (bt.quantity || 0), 0);
      }

      // Merge transactions from global and legacy per-user key
      const parsedUserTxs: InventoryTransaction[] = t ? JSON.parse(t) : [];
      const parsedGlobalTxs: InventoryTransaction[] = globalTxs ? JSON.parse(globalTxs) : [];
      this.transactions = this.mergeItemsById(
        this.transactions,
        this.mergeItemsById(parsedGlobalTxs, parsedUserTxs)
      ).sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      // Prefer the canonical school-wide student store; if a per-user key has more real students, migrate it
      const parsedUserStudents: Student[] | null = st ? JSON.parse(st) : null;
      const parsedGlobalStudents: Student[] | null = globalStudents ? JSON.parse(globalStudents) : null;

      if (
        parsedUserStudents &&
        parsedUserStudents.length > 0 &&
        (!parsedGlobalStudents || parsedUserStudents.length > parsedGlobalStudents.length)
      ) {
        this.students = parsedUserStudents;
        if (hp) this.healthProfiles = JSON.parse(hp);
        if (cl) {
          this.classes = this.mergeSchoolClasses(this.classes, JSON.parse(cl), new Set(this.getDeletedClassIds()));
        }
        this.saveStudentBundleLocally();
      } else if (parsedGlobalStudents && parsedGlobalStudents.length > this.students.length) {
        this.students = parsedGlobalStudents;
        if (globalProfiles) {
          this.healthProfiles = this.mergeItemsById(this.healthProfiles, JSON.parse(globalProfiles));
        }
        if (globalClasses) {
          this.classes = this.mergeSchoolClasses(this.classes, JSON.parse(globalClasses), new Set(this.getDeletedClassIds()));
        }
      } else {
        if (globalClasses) {
          this.classes = this.mergeSchoolClasses(this.classes, JSON.parse(globalClasses), new Set(this.getDeletedClassIds()));
        }
        if (cl) {
          this.classes = this.mergeSchoolClasses(this.classes, JSON.parse(cl), new Set(this.getDeletedClassIds()));
        }
      }

      // Merge clinic visits from in-memory, canonical STORAGE_KEYS.CLINIC_VISITS, and any legacy per-user key
      // NEVER let a stale per-user `cv` overwrite newly added visits in `STORAGE_KEYS.CLINIC_VISITS`!
      const deletedVisitSet = new Set(this.getDeletedVisitIds());
      const parsedUserVisits: ClinicVisit[] = cv ? JSON.parse(cv) : [];
      const parsedGlobalVisits: ClinicVisit[] = globalVisits ? JSON.parse(globalVisits) : [];
      const mergedVisits = this.mergeItemsById(
        this.clinicVisits,
        this.mergeItemsById(parsedGlobalVisits, parsedUserVisits, deletedVisitSet),
        deletedVisitSet
      );
      this.clinicVisits = mergedVisits.sort(
        (a, b) =>
          (new Date(b.createdAt || `${b.visitDate}T${b.timeIn || '00:00'}`).getTime() || 0) -
          (new Date(a.createdAt || `${a.visitDate}T${a.timeIn || '00:00'}`).getTime() || 0)
      );
      this.cachedNormalizedVisits = null;

      // Clean up legacy per-user duplicate keys so they never go stale or waste 5MB localStorage quota
      try {
        localStorage.removeItem(p('visits'));
        localStorage.removeItem(p('txs'));
        localStorage.removeItem(p('medicines'));
        localStorage.removeItem(p('batches'));
      } catch {
        // ignore
      }
      this.safeSetLocalStorage(STORAGE_KEYS.CLINIC_VISITS, JSON.stringify(this.clinicVisits));
    } catch (e) {
      console.warn('Error loading user local cache', e);
    }
  }

  private saveUserLocalData(userId: string | null, specificKey?: string) {
    if (!userId) return;
    if (specificKey) {
      this.pendingLocalSaveKeys.add(specificKey);
    } else {
      [
        'medicines', 'batches', 'txs', 'students', 'visits',
        'profiles', 'settings', 'classes', 'supplies', 'suppliers', 'disposals'
      ].forEach((k) => this.pendingLocalSaveKeys.add(k));
    }

    if (this.localSaveTimer) clearTimeout(this.localSaveTimer);
    this.localSaveTimer = setTimeout(() => {
      this.flushUserLocalData(userId);
    }, 250);
  }

  private safeSetLocalStorage(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e: any) {
      const isQuota =
        e?.name === 'QuotaExceededError' ||
        e?.code === 22 ||
        e?.code === 1014 ||
        (typeof e?.message === 'string' && e.message.toLowerCase().includes('quota'));

      if (isQuota) {
        this.pruneLocalStorageForQuota();
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          // If still exceeded, omit non-essential stringification gracefully; in-memory state and cloud sync are fully preserved
          console.warn(`LocalStorage quota reached for key "${key}". In-memory and Firestore data remain completely safe.`);
          return false;
        }
      } else {
        console.warn(`LocalStorage write skipped for "${key}":`, e?.message || e);
        return false;
      }
    }
  }

  private pruneLocalStorageForQuota() {
    try {
      // Remove all duplicate per-user keys and bulky profile caches so canonical school keys always have space
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('thcs_dt_') &&
            (k.endsWith('_students') ||
              k.endsWith('_profiles') ||
              k.endsWith('_classes') ||
              k.endsWith('_visits') ||
              k.endsWith('_txs') ||
              k.endsWith('_medicines') ||
              k.endsWith('_batches') ||
              k.endsWith('_supplies') ||
              k.endsWith('_suppliers') ||
              k.endsWith('_disposals')))
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem('thcs_dongthanh_audit_v1');
      // Never remove STORAGE_KEYS.INITIALIZED_FLAG so init() never mistakes a pruned localStorage for an uninitialized app
      localStorage.setItem(STORAGE_KEYS.INITIALIZED_FLAG, 'true');
      // Compact health profiles in localStorage (full copy is in IndexedDB)
      const compactProfiles = this.healthProfiles.filter(
        (hp) =>
          hp.allergies ||
          hp.chronicConditions ||
          hp.specialAttention ||
          hp.notes ||
          hp.height ||
          hp.weight
      );
      localStorage.setItem(STORAGE_KEYS.STUDENT_HEALTH_PROFILES, JSON.stringify(compactProfiles));
    } catch {
      // Ignore
    }
  }

  private flushUserLocalData(_userId: string) {
    try {
      if (this.pendingLocalSaveKeys.has('visits')) {
        this.safeSetLocalStorage(STORAGE_KEYS.CLINIC_VISITS, JSON.stringify(this.clinicVisits));
      }
      if (this.pendingLocalSaveKeys.has('batches')) {
        this.safeSetLocalStorage(STORAGE_KEYS.BATCHES, JSON.stringify(this.batches));
      }
      if (this.pendingLocalSaveKeys.has('medicines')) {
        this.safeSetLocalStorage(STORAGE_KEYS.MEDICINES, JSON.stringify(this.medicines));
      }
      if (this.pendingLocalSaveKeys.has('txs')) {
        this.safeSetLocalStorage(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
      }
      if (
        this.pendingLocalSaveKeys.has('students') ||
        this.pendingLocalSaveKeys.has('profiles') ||
        this.pendingLocalSaveKeys.has('classes')
      ) {
        this.saveStudentBundleLocally();
      }
      this.saveOperationalBundleLocally();
      this.pendingLocalSaveKeys.clear();
    } catch (e) {
      console.warn('Error saving user local cache', e);
    }
  }

  private init() {
    try {
      const storedMeds = localStorage.getItem(STORAGE_KEYS.MEDICINES);
      const storedBatches = localStorage.getItem(STORAGE_KEYS.BATCHES);
      const storedTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const storedSups = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      const storedSupplies = localStorage.getItem(STORAGE_KEYS.SUPPLIES);
      const storedUsage = localStorage.getItem(STORAGE_KEYS.USAGE_RECORDS);
      const storedChecks = localStorage.getItem(STORAGE_KEYS.INVENTORY_CHECKS);
      const storedLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const storedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      const storedUsersList = localStorage.getItem(STORAGE_KEYS.USERS);
      const storedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS);
      const storedProfiles = localStorage.getItem(STORAGE_KEYS.STUDENT_HEALTH_PROFILES);
      const storedVisits = localStorage.getItem(STORAGE_KEYS.CLINIC_VISITS);
      const storedEvents = localStorage.getItem(STORAGE_KEYS.HEALTH_EVENTS);
      const storedCheckups = localStorage.getItem(STORAGE_KEYS.HEALTH_CHECKUPS);
      const storedClasses = localStorage.getItem(STORAGE_KEYS.SCHOOL_CLASSES);
      const storedDisposals = localStorage.getItem(STORAGE_KEYS.DISPOSALS);
      const storedStaff = localStorage.getItem(STORAGE_KEYS.STAFF_MEMBERS);

      const isInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED_FLAG);
      const storedCatalogVer = localStorage.getItem('thcs_dt_fixed_catalog_version');
      const safeParse = <T>(raw: string | null, fallback: T): T => {
        if (!raw) return fallback;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return fallback;
        }
      };

      if (
        storedMeds !== null ||
        storedVisits !== null ||
        storedStudents !== null ||
        storedClasses !== null ||
        storedTxs !== null ||
        isInitialized
      ) {
        this.medicines = safeParse(storedMeds, []);
        this.batches = safeParse(storedBatches, []);
        this.transactions = safeParse(storedTxs, []);
        this.suppliers = safeParse(storedSups, DEFAULT_SUPPLIERS);
        this.supplies = safeParse(storedSupplies, INITIAL_SUPPLIES);
        this.usageRecords = safeParse(storedUsage, []);
        this.inventoryChecks = safeParse(storedChecks, []);
        this.disposals = safeParse(storedDisposals, []);
        this.auditLogs = safeParse(storedLogs, INITIAL_AUDIT_LOGS);
        this.settings = safeParse(storedSettings, DEFAULT_SETTINGS);
        this.users = safeParse(storedUsersList, [...DEFAULT_USERS]);
        const isStudentsCleaned = localStorage.getItem('thcs_dongthanh_students_clean_v1') === 'true';
        this.currentUser = safeParse(storedUser, DEFAULT_USERS[1]);
        this.normalizeUsersToTwoRoles();
        this.students = safeParse(storedStudents, isStudentsCleaned ? [] : [...INITIAL_STUDENTS]);
        this.healthProfiles = safeParse(storedProfiles, isStudentsCleaned ? [] : [...INITIAL_HEALTH_PROFILES]);
        this.clinicVisits = safeParse(storedVisits, isStudentsCleaned ? [] : [...INITIAL_CLINIC_VISITS]);
        this.healthEvents = safeParse(storedEvents, isStudentsCleaned ? [] : [...INITIAL_HEALTH_EVENTS]);
        this.healthCheckups = safeParse(storedCheckups, isStudentsCleaned ? [] : [...INITIAL_HEALTH_CHECKUPS]);
        this.classes = safeParse(storedClasses, isStudentsCleaned ? [] : [...DEFAULT_CLASSES]);
        const isStaffCleaned = localStorage.getItem('thcs_dongthanh_staff_cleaned_v1') === 'true';
        this.staffMembers = safeParse(storedStaff, isStaffCleaned ? [] : [...INITIAL_STAFF_MEMBERS]);
        if (!this.isOnlyDemoSchoolClasses(this.classes)) {
          this.classes = this.classes.map((c) => {
            const cleanUpdatedAt = c.updatedAt === '2026-09-15T08:00:00.000Z' ? undefined : c.updatedAt;
            const hasRealTeacher = !this.isDemoSchoolClass(c) && Boolean((c.homeroomTeacher || '').trim());
            return {
              ...c,
              updatedAt: cleanUpdatedAt || (hasRealTeacher ? new Date().toISOString() : undefined),
            };
          });
        }

        // Recover student list, class/GVCN list, clinic visits & transactions if previously saved under a per-user localStorage key
        try {
          const deletedClassSet = new Set(this.getDeletedClassIds());
          const deletedVisitSet = new Set(this.getDeletedVisitIds());
          const deletedTxSet = new Set(this.getDeletedTxIds());
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('thcs_dt_')) continue;
            if (key.endsWith('_students')) {
              const parsed = safeParse<Student[]>(localStorage.getItem(key), []);
              if (Array.isArray(parsed) && parsed.length > this.students.length) {
                this.students = parsed;
                const userPrefix = key.slice(0, -'_students'.length);
                const rawProf = localStorage.getItem(`${userPrefix}_profiles`);
                const rawCls = localStorage.getItem(`${userPrefix}_classes`);
                if (rawProf) this.healthProfiles = safeParse(rawProf, this.healthProfiles);
                if (rawCls) {
                  this.classes = this.mergeSchoolClasses(this.classes, safeParse(rawCls, []), deletedClassSet);
                }
                this.saveStudentBundleLocally();
              }
            } else if (key.endsWith('_classes')) {
              const parsedCls = safeParse<SchoolClass[]>(localStorage.getItem(key), []);
              if (Array.isArray(parsedCls) && parsedCls.length > 0) {
                this.classes = this.mergeSchoolClasses(this.classes, parsedCls, deletedClassSet);
              }
            } else if (key.endsWith('_visits')) {
              const parsedVisits = safeParse<ClinicVisit[]>(localStorage.getItem(key), []);
              if (Array.isArray(parsedVisits) && parsedVisits.length > 0) {
                this.clinicVisits = this.mergeItemsById(this.clinicVisits, parsedVisits, deletedVisitSet);
              }
            } else if (key.endsWith('_txs')) {
              const parsedTxs = safeParse<InventoryTransaction[]>(localStorage.getItem(key), []);
              if (Array.isArray(parsedTxs) && parsedTxs.length > 0) {
                this.transactions = this.mergeItemsById(this.transactions, parsedTxs, deletedTxSet);
              }
            }
          }
        } catch {
          // ignore
        }

        // Hydrate from high-capacity IndexedDB if it holds a fuller or newer student or class/GVCN dataset
        idbLoadStudentBundle().then((bundle) => {
          if (bundle) {
            this.idbSynced = true;
            let changed = false;
            const deletedClassSet = new Set(this.getDeletedClassIds());
            if (
              Array.isArray(bundle.students) &&
              (bundle.students.length > this.students.length ||
                (this.isHoldingOnlyDemoStudents() && bundle.students.length > 0 && localStorage.getItem('thcs_dongthanh_real_students_imported') === 'true'))
            ) {
              this.students = bundle.students;
              if (Array.isArray(bundle.healthProfiles)) this.healthProfiles = bundle.healthProfiles;
              changed = true;
            }
            if (Array.isArray(bundle.classes) && bundle.classes.length > 0) {
              const mergedClasses = this.mergeSchoolClasses(this.classes, bundle.classes, deletedClassSet);
              if (JSON.stringify(mergedClasses) !== JSON.stringify(this.classes)) {
                this.classes = mergedClasses;
                changed = true;
              }
            }
            if (changed) {
              this.saveStudentBundleLocally();
              this.scheduleServerPush();
              this.notify();
            } else if (!this.isOnlyDemoSchoolClasses(this.classes)) {
              this.scheduleServerPush();
            }
          } else {
            idbSaveStudentBundle({
              students: this.students,
              healthProfiles: this.healthProfiles,
              classes: this.classes,
              updatedAt: new Date().toISOString(),
            }).then((ok) => {
              if (ok) this.idbSynced = true;
            });
          }
        });

        // Always hydrate operational records (clinicVisits, batches, medicines, transactions, users) from IndexedDB
        idbLoadOperationalBundle().then((opBundle) => {
          if (opBundle) {
            const deletedVisitSet = new Set(
              [
                ...this.getDeletedVisitIds(),
                ...(opBundle.deletedVisitIds || []),
              ].filter((x) => x && !String(x).startsWith('KB-'))
            );
            let changed = false;
            if (Array.isArray(opBundle.clinicVisits) && opBundle.clinicVisits.length > 0) {
              const beforeJson = JSON.stringify(this.clinicVisits);
              const merged = this.mergeItemsById(
                this.clinicVisits,
                opBundle.clinicVisits,
                deletedVisitSet
              ).sort(
                (a, b) =>
                  (new Date(b.createdAt || `${b.visitDate}T${b.timeIn || '00:00'}`).getTime() || 0) -
                  (new Date(a.createdAt || `${a.visitDate}T${a.timeIn || '00:00'}`).getTime() || 0)
              );
              if (JSON.stringify(merged) !== beforeJson) {
                this.clinicVisits = merged;
                this.safeSetLocalStorage(STORAGE_KEYS.CLINIC_VISITS, JSON.stringify(this.clinicVisits));
                changed = true;
              }
            }
            if (Array.isArray(opBundle.transactions) && opBundle.transactions.length >= this.transactions.length) {
              this.transactions = this.mergeItemsById(this.transactions, opBundle.transactions).sort(
                (a, b) => (new Date(b.date || b.createdAt).getTime() || 0) - (new Date(a.date || a.createdAt).getTime() || 0)
              );
              if (Array.isArray(opBundle.batches) && opBundle.batches.length > 0) {
                this.batches = opBundle.batches;
              }
              if (Array.isArray(opBundle.medicines) && opBundle.medicines.length > 0) {
                this.medicines = opBundle.medicines;
              }
              for (const med of this.medicines) {
                const medBatches = this.batches.filter((b) => b.medicineId === med.id);
                med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
              }
              this.safeSetLocalStorage(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
              this.safeSetLocalStorage(STORAGE_KEYS.BATCHES, JSON.stringify(this.batches));
              this.safeSetLocalStorage(STORAGE_KEYS.MEDICINES, JSON.stringify(this.medicines));
              changed = true;
            }
            if (Array.isArray(opBundle.staffMembers) && opBundle.staffMembers.length > 0) {
              const deletedStaffSet = new Set(this.getDeletedStaffIds());
              const beforeStaffJson = JSON.stringify(this.staffMembers);
              const mergedStaff = this.mergeItemsById(this.staffMembers, opBundle.staffMembers, deletedStaffSet);
              if (JSON.stringify(mergedStaff) !== beforeStaffJson) {
                this.staffMembers = mergedStaff;
                this.safeSetLocalStorage(STORAGE_KEYS.STAFF_MEMBERS, JSON.stringify(this.staffMembers));
                changed = true;
              }
            }
            if (changed) {
              this.scheduleServerPush();
              this.notify();
            }
          } else {
            this.saveOperationalBundleLocally();
          }
        });

        // Hydrate father/mother information if only generic parentName was previously stored
        if (this.students && this.students.length > 0) {
          let hydrated = false;
          this.students = this.students.map((s) => {
            const initialMatch = INITIAL_STUDENTS.find((init) => init.studentCode === s.studentCode);
            if (initialMatch && (!s.fatherName || !s.motherName)) {
              hydrated = true;
              return {
                ...s,
                fatherName: s.fatherName || initialMatch.fatherName || '',
                fatherPhone: s.fatherPhone || initialMatch.fatherPhone || '',
                motherName: s.motherName || initialMatch.motherName || '',
                motherPhone: s.motherPhone || initialMatch.motherPhone || '',
                parentName: s.parentName || initialMatch.parentName || '',
                parentPhone: s.parentPhone || initialMatch.parentPhone || '',
              };
            }
            if (!s.fatherName && !s.motherName && s.parentName) {
              hydrated = true;
              const isFemale = /Thị|Hoa|Lan|Mai|Hương|Thảo|Yến|Thoa|Dung|Trang|Hằng|Kim|Tuyết|Thu|Hạnh|Hồng|Diệu/i.test(s.parentName);
              if (isFemale) {
                return {
                  ...s,
                  motherName: s.parentName,
                  motherPhone: s.parentPhone || '',
                  fatherName: s.fatherName || '',
                  fatherPhone: s.fatherPhone || '',
                };
              } else {
                return {
                  ...s,
                  fatherName: s.parentName,
                  fatherPhone: s.parentPhone || '',
                  motherName: s.motherName || '',
                  motherPhone: s.motherPhone || '',
                };
              }
            }
            return s;
          });
          if (hydrated) {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(this.students));
          }
        }

        // Ensure 30 fixed medicines catalog & 52 batches are loaded and populated
        if (
          storedCatalogVer !== FIXED_MEDICINES_CATALOG_VERSION ||
          this.medicines.length === 0 ||
          this.batches.length < INITIAL_BATCHES.length
        ) {
          this.medicines = INITIAL_MEDICINES.map((m) => ({ ...m }));
          this.batches = INITIAL_BATCHES.map((b) => ({ ...b }));

          // Re-sync all medicine totalStock
          for (const med of this.medicines) {
            const medBatches = this.batches.filter((b) => b.medicineId === med.id);
            med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
          }

          localStorage.setItem('thcs_dt_fixed_catalog_version', FIXED_MEDICINES_CATALOG_VERSION);
          localStorage.setItem(STORAGE_KEYS.MEDICINES, JSON.stringify(this.medicines));
          localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(this.batches));
          localStorage.setItem(STORAGE_KEYS.INITIALIZED_FLAG, 'true');
          this.saveAll();
        }
      } else {
        this.seedDemoData();
      }
    } catch {
      this.seedDemoData();
    }
  }

  public restoreFixedMedicineCatalog(): { addedCount: number; totalCount: number; batchCount: number } {
    const oldMedIds = this.medicines.map((m) => m.id);
    const oldBatchIds = this.batches.map((b) => b.id);
    const officialMedIds = new Set(INITIAL_MEDICINES.map((m) => m.id));
    const officialBatchIds = new Set(INITIAL_BATCHES.map((b) => b.id));

    const userId = this.currentUserId || undefined;
    this.medicines = INITIAL_MEDICINES.map((m) => ({ ...m, userId }));
    this.batches = INITIAL_BATCHES.map((b) => ({ ...b, userId }));

    for (const med of this.medicines) {
      const medBatches = this.batches.filter((b) => b.medicineId === med.id);
      med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
    }

    localStorage.setItem('thcs_dt_fixed_catalog_version', FIXED_MEDICINES_CATALOG_VERSION);
    if (userId) {
      localStorage.setItem(`thcs_dt_med_v7_${userId}`, FIXED_MEDICINES_CATALOG_VERSION);
      localStorage.setItem(`thcs_dt_batch_v7_${userId}`, FIXED_MEDICINES_CATALOG_VERSION);
    }
    this.saveAll();
    this.logAudit(
      'Nạp danh mục thuốc & lô theo bảng chuẩn',
      `Đã nạp đầy đủ ${this.medicines.length} mặt hàng thuốc/vật tư và ${this.batches.length} lô tồn kho theo bảng kiểm kê thực tế`
    );
    this.notify();

    if (this.currentUserId) {
      const obsoleteMedIds = oldMedIds.filter((id) => !officialMedIds.has(id));
      const obsoleteBatchIds = oldBatchIds.filter((id) => !officialBatchIds.has(id));
      const writes: BatchWriteOp[] = [
        ...obsoleteMedIds.map((id) => ({ subcollection: 'medicines', docId: id, data: null, op: 'delete' as const })),
        ...obsoleteBatchIds.map((id) => ({ subcollection: 'batches', docId: id, data: null, op: 'delete' as const })),
        ...this.medicines.map((m) => ({ subcollection: 'medicines', docId: m.id, data: m, op: 'set' as const })),
        ...this.batches.map((b) => ({ subcollection: 'batches', docId: b.id, data: b, op: 'set' as const })),
      ];
      this.persistBatch(writes);
    }

    return { addedCount: this.medicines.length, totalCount: this.medicines.length, batchCount: this.batches.length };
  }

  public seedDemoData() {
    this.medicines = [...INITIAL_MEDICINES];
    this.batches = [...INITIAL_BATCHES];
    this.transactions = [...INITIAL_TRANSACTIONS];
    this.suppliers = [...DEFAULT_SUPPLIERS];
    this.supplies = [...INITIAL_SUPPLIES];
    this.usageRecords = [...INITIAL_USAGE_RECORDS];
    this.inventoryChecks = [...INITIAL_INVENTORY_CHECKS];
    this.disposals = [...INITIAL_DISPOSALS];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.settings = { ...DEFAULT_SETTINGS };
    this.users = [...DEFAULT_USERS];
    this.currentUser = DEFAULT_USERS[1];
    this.students = [...INITIAL_STUDENTS];
    this.healthProfiles = [...INITIAL_HEALTH_PROFILES];
    this.clinicVisits = [...INITIAL_CLINIC_VISITS];
    this.healthEvents = [...INITIAL_HEALTH_EVENTS];
    this.healthCheckups = [...INITIAL_HEALTH_CHECKUPS];
    this.classes = [...DEFAULT_CLASSES];
    this.staffMembers = [...INITIAL_STAFF_MEMBERS];
    this.saveAll();
    this.notify();
  }

  public resetAllData() {
    this.seedDemoData();
  }

  private saveAll(pushToServer = true) {
    try {
      // 1. Save critical operational records FIRST so Clinic Visits, Batches & Transactions NEVER get dropped by 5MB LocalStorage quota
      this.safeSetLocalStorage(STORAGE_KEYS.CLINIC_VISITS, JSON.stringify(this.clinicVisits));
      this.safeSetLocalStorage(STORAGE_KEYS.BATCHES, JSON.stringify(this.batches));
      this.safeSetLocalStorage(STORAGE_KEYS.MEDICINES, JSON.stringify(this.medicines));
      this.safeSetLocalStorage(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.transactions));
      this.safeSetLocalStorage(STORAGE_KEYS.STAFF_MEMBERS, JSON.stringify(this.staffMembers));
      this.safeSetLocalStorage(STORAGE_KEYS.USERS, JSON.stringify(this.users));
      this.safeSetLocalStorage(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
      this.safeSetLocalStorage(STORAGE_KEYS.SUPPLIES, JSON.stringify(this.supplies));
      this.safeSetLocalStorage(STORAGE_KEYS.SUPPLIERS, JSON.stringify(this.suppliers));
      this.safeSetLocalStorage(STORAGE_KEYS.USAGE_RECORDS, JSON.stringify(this.usageRecords));
      this.safeSetLocalStorage(STORAGE_KEYS.INVENTORY_CHECKS, JSON.stringify(this.inventoryChecks));
      this.safeSetLocalStorage(STORAGE_KEYS.DISPOSALS, JSON.stringify(this.disposals));
      this.safeSetLocalStorage(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      this.safeSetLocalStorage(STORAGE_KEYS.SCHOOL_CLASSES, JSON.stringify(this.classes));
      this.safeSetLocalStorage(STORAGE_KEYS.HEALTH_EVENTS, JSON.stringify(this.healthEvents));
      this.safeSetLocalStorage(STORAGE_KEYS.HEALTH_CHECKUPS, JSON.stringify(this.healthCheckups));

      // 2. Mirror full operational & student bundles to high-capacity IndexedDB
      this.saveOperationalBundleLocally();
      this.saveStudentBundleLocally();
      this.saveUserLocalData(this.currentUserId);

      // 3. Push to shared school server so other computers opening the link receive real-time updates
      if (pushToServer) {
        this.scheduleServerPush();
      }
    } catch (e: any) {
      console.warn('LocalStorage saveAll notice:', e?.message || e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyScheduled = false;
  private notify() {
    this.cachedComputedMedicines = null;
    this.cachedDashboardMetrics = null;
    this.cachedNormalizedVisits = null;
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    Promise.resolve().then(() => {
      this.notifyScheduled = false;
      for (const listener of this.listeners) {
        try {
          listener();
        } catch (err) {
          console.error('Listener callback error', err);
        }
      }
    });
  }

  // --- Users & Roles ---
  private getDeletedUserIds(): string[] {
    if (this.cachedDeletedUserIds) return this.cachedDeletedUserIds;
    try {
      const raw = localStorage.getItem('thcs_dongthanh_deleted_users_v1');
      const res = raw ? JSON.parse(raw) : [];
      this.cachedDeletedUserIds = Array.isArray(res) ? res : [];
      return this.cachedDeletedUserIds;
    } catch {
      return [];
    }
  }

  private addDeletedUserId(id: string) {
    try {
      const current = new Set(this.getDeletedUserIds());
      current.add(id);
      const arr = Array.from(current);
      this.cachedDeletedUserIds = arr;
      localStorage.setItem('thcs_dongthanh_deleted_users_v1', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  private removeDeletedUserId(id: string) {
    try {
      const current = this.getDeletedUserIds().filter((uid) => uid !== id);
      this.cachedDeletedUserIds = current;
      localStorage.setItem('thcs_dongthanh_deleted_users_v1', JSON.stringify(current));
    } catch {
      // ignore
    }
  }

  // --- Users & Roles (Strictly 2 Task Roles: Quản trị & Nhân viên Y tế, NO individual personnel) ---
  public normalizeUsersToTwoRoles(): void {
    const existingAdmin = this.users?.find((u) => u && (u.id === 'role-admin' || u.role === 'admin'));
    const existingMedic = this.users?.find((u) => u && (u.id === 'role-medic' || u.role === 'medic'));

    const adminPerms: UserPermission = existingAdmin?.permissions
      ? {
          ...DEFAULT_ROLE_PERMISSIONS.admin,
          ...existingAdmin.permissions,
          canManageSettings: true,
          canApproveAudits: true,
        }
      : { ...DEFAULT_ROLE_PERMISSIONS.admin };

    const medicPerms: UserPermission = existingMedic?.permissions
      ? {
          ...DEFAULT_ROLE_PERMISSIONS.medic,
          ...existingMedic.permissions,
        }
      : { ...DEFAULT_ROLE_PERMISSIONS.medic };

    const adminRoleUser: User = {
      id: 'role-admin',
      username: 'quantri',
      fullName: 'Quản trị',
      role: 'admin',
      email: '',
      phone: '',
      title: 'Nhiệm vụ Quản trị hệ thống',
      department: 'Quản trị & Phê duyệt hệ thống',
      status: 'active',
      permissions: adminPerms,
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: existingAdmin?.updatedAt || new Date().toISOString(),
    };

    const medicRoleUser: User = {
      id: 'role-medic',
      username: 'nhanvien_yte',
      fullName: 'Nhân viên Y tế',
      role: 'medic',
      email: '',
      phone: '',
      title: 'Nhiệm vụ Nhân viên Y tế',
      department: 'Phòng Y tế Học đường',
      status: 'active',
      permissions: medicPerms,
      createdAt: '2026-01-01T08:00:00.000Z',
      updatedAt: existingMedic?.updatedAt || new Date().toISOString(),
    };

    this.users = [adminRoleUser, medicRoleUser];

    const currentRole: UserRole =
      this.currentUser?.role === 'admin' || this.currentUser?.role === 'bgh' ? 'admin' : 'medic';
    this.currentUser = currentRole === 'admin' ? { ...adminRoleUser } : { ...medicRoleUser };
  }

  public clearAllPersonnelKeepTwoRoles(): User[] {
    this.users = DEFAULT_USERS.map((u) => ({
      ...u,
      permissions: { ...DEFAULT_ROLE_PERMISSIONS[u.role] },
      updatedAt: new Date().toISOString(),
    }));
    const currentRole: UserRole =
      this.currentUser?.role === 'admin' || this.currentUser?.role === 'bgh' ? 'admin' : 'medic';
    this.currentUser =
      currentRole === 'admin' ? { ...this.users[0] } : { ...this.users[1] };
    this.safeSetLocalStorage(STORAGE_KEYS.USERS, JSON.stringify(this.users));
    this.safeSetLocalStorage(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
    this.logAudit(
      'Chuẩn hóa phân quyền 2 nhiệm vụ',
      'Đã xóa toàn bộ nhân sự cá nhân, chỉ giữ lại 2 nhiệm vụ chuẩn: Quản trị & Nhân viên Y tế'
    );
    this.saveAll();
    this.notify();
    return [...this.users];
  }

  public getCurrentUser(): User {
    if (!this.currentUser || (this.currentUser.id !== 'role-admin' && this.currentUser.id !== 'role-medic')) {
      this.normalizeUsersToTwoRoles();
    }
    const role: UserRole =
      this.currentUser?.role === 'admin' || this.currentUser?.role === 'bgh' ? 'admin' : 'medic';
    const matched = this.users?.find((u) => u.role === role);
    if (matched) {
      this.currentUser = matched;
    }
    return this.currentUser;
  }

  public getCurrentRolePermissions(): UserPermission {
    const user = this.getCurrentUser();
    const role: UserRole = user?.role === 'admin' || user?.role === 'bgh' ? 'admin' : 'medic';
    const roleProfile = this.users?.find((u) => u.role === role);
    const basePerms = DEFAULT_ROLE_PERMISSIONS[role];
    return {
      ...basePerms,
      ...(roleProfile?.permissions || user?.permissions || {}),
    };
  }

  public hasPermission(
    permKey:
      | keyof UserPermission
      | 'canApproveInventoryAdjustment'
      | 'canManageUsersAndRoles'
  ): boolean {
    const user = this.getCurrentUser();
    const isAdmin = user?.role === 'admin' || user?.role === 'bgh';

    // Bảo mật & Phân quyền (canManageUsersAndRoles) chỉ dành riêng cho Quản trị (admin), Nhân viên Y tế không được phép xem
    if (permKey === 'canManageUsersAndRoles') {
      return isAdmin;
    }

    const perms = this.getCurrentRolePermissions();

    if (permKey === 'canApproveInventoryAdjustment' || permKey === 'canApproveAudits') {
      return Boolean(perms.canApproveAudits);
    }

    return Boolean(perms[permKey as keyof UserPermission]);
  }

  public canAccessTab(tab: string): boolean {
    const user = this.getCurrentUser();
    const isAdmin = user?.role === 'admin' || user?.role === 'bgh';

    switch (tab) {
      case 'dashboard':
        return true;

      // 1. Tiếp nhận khám sơ cứu & Sổ theo dõi phòng y tế
      case 'clinic_reception':
      case 'staff_dispense':
      case 'clinic_visits':
        return this.hasPermission('canManageClinicVisits');

      // 2. Hồ sơ sức khỏe học sinh & Tai nạn / Khám định kỳ
      case 'students':
      case 'school_health':
        return this.hasPermission('canManageStudents');

      // 3. Danh mục thuốc, Tồn kho theo lô, Hết hạn, Dưới định mức & Vật tư tiêu hao
      case 'medicines':
      case 'stock_report':
      case 'stock':
      case 'expiry_tracking':
      case 'low_stock':
      case 'supply_usage':
      case 'supplies':
      case 'suppliers':
        return this.hasPermission('canManageMedicine');

      // 4. Nhập kho, Xuất cấp phát FEFO & Sổ nhập - xuất - tồn
      case 'import_medicine':
      case 'import':
      case 'export_medicine':
      case 'export':
      case 'stock_balance':
        return this.hasPermission('canManageTransactions');

      // 5. Kiểm kê kho định kỳ & Tiêu hủy thuốc
      case 'inventory_check':
        return this.hasPermission('canManageInventoryCheck');

      // 6. Báo cáo thống kê, Truy xuất thuốc & Mẫu in sổ A4
      case 'comprehensive_reports':
      case 'reports':
      case 'medication_usage':
      case 'usage_book':
      case 'print_templates':
        return this.hasPermission('canViewReports');

      // 7. Bảo mật & Phân quyền: Độc quyền Quản trị (Nhân viên Y tế tuyệt đối không thấy mục này)
      case 'audit_logs':
        return isAdmin;

      // 8. Cài đặt & Sao lưu dữ liệu
      case 'settings':
        return this.hasPermission('canManageSettings');

      default:
        return true;
    }
  }

  public getFirstAccessibleTab(): string {
    const candidateTabs = [
      'dashboard',
      'clinic_reception',
      'clinic_visits',
      'students',
      'medicines',
      'import_medicine',
      'export_medicine',
      'stock_balance',
      'inventory_check',
      'comprehensive_reports',
    ];
    for (const t of candidateTabs) {
      if (this.canAccessTab(t)) return t;
    }
    return 'dashboard';
  }

  public setCurrentUser(user: User) {
    const targetRole: UserRole =
      user?.role === 'admin' || user?.role === 'bgh' ? 'admin' : 'medic';
    this.setCurrentUserRole(targetRole);
  }

  public setCurrentUserRole(role: UserRole) {
    const normalizedRole: UserRole = role === 'admin' || role === 'bgh' ? 'admin' : 'medic';
    this.normalizeUsersToTwoRoles();

    const matchedRoleProfile =
      this.users.find((u) => u.role === normalizedRole) ||
      (normalizedRole === 'admin' ? DEFAULT_USERS[0] : DEFAULT_USERS[1]);

    this.currentUser = {
      ...matchedRoleProfile,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
    this.logAudit(
      'Chuyển nhiệm vụ làm việc',
      `Chuyển sang nhiệm vụ: ${getRoleLabel(normalizedRole)}`
    );
    this.saveAll();
    this.notify();
  }

  public switchCurrentUserRole(role: UserRole) {
    this.setCurrentUserRole(role);
  }

  public selfGrantAdminPermissions(): User {
    this.setCurrentUserRole('admin');
    return this.currentUser;
  }

  public getUsers(): User[] {
    if (
      !this.users ||
      this.users.length !== 2 ||
      this.users[0]?.id !== 'role-admin' ||
      this.users[1]?.id !== 'role-medic'
    ) {
      this.normalizeUsersToTwoRoles();
    }
    return [...this.users];
  }

  public getUserById(id: string): User | undefined {
    this.normalizeUsersToTwoRoles();
    return this.users.find((u) => u.id === id);
  }

  public addUser(userData: Omit<User, 'id'> & { id?: string }): User {
    const targetRole: UserRole =
      userData.role === 'admin' || userData.role === 'bgh' ? 'admin' : 'medic';
    this.normalizeUsersToTwoRoles();
    return this.users.find((u) => u.role === targetRole) || this.users[1];
  }

  public updateUser(id: string, updates: Partial<User>): User {
    this.normalizeUsersToTwoRoles();
    let index = this.users.findIndex((u) => u.id === id || u.role === updates.role);
    if (index === -1) {
      index = 0;
    }
    const current = this.users[index];
    const newRole: UserRole = current.role === 'admin' ? 'admin' : 'medic';
    const updatedPermissions = updates.permissions || current.permissions || {
      ...DEFAULT_ROLE_PERMISSIONS[newRole],
    };

    const updatedUser: User = {
      ...current,
      role: newRole,
      fullName: newRole === 'admin' ? 'Quản trị' : 'Nhân viên Y tế',
      username: newRole === 'admin' ? 'quantri' : 'nhanvien_yte',
      title: newRole === 'admin' ? 'Nhiệm vụ Quản trị hệ thống' : 'Nhiệm vụ Nhân viên Y tế',
      department: newRole === 'admin' ? 'Quản trị & Phê duyệt hệ thống' : 'Phòng Y tế Học đường',
      status: 'active',
      permissions: updatedPermissions,
      updatedAt: new Date().toISOString(),
    };

    this.users[index] = updatedUser;

    if (this.currentUser.role === newRole) {
      this.currentUser = { ...updatedUser };
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
    }

    this.logAudit(
      'Cập nhật phân quyền nhiệm vụ',
      `Cập nhật quyền cho nhiệm vụ: ${getRoleLabel(newRole)}`,
      updatedUser.id
    );
    this.saveAll();
    this.notify();
    return updatedUser;
  }

  public toggleUserPermission(userId: string, permKey: keyof UserPermission): User {
    this.normalizeUsersToTwoRoles();
    const target = this.users.find((u) => u.id === userId) || this.currentUser;
    const basePerms: UserPermission = target.permissions || {
      ...DEFAULT_ROLE_PERMISSIONS[target.role],
    };
    const nextVal = !basePerms[permKey];
    const updatedPerms: UserPermission = {
      ...basePerms,
      [permKey]: nextVal,
    };
    return this.updateUser(target.id, { permissions: updatedPerms });
  }

  public grantAllUserPermissions(userId: string, targetRole?: UserRole): User {
    const fullPerms: UserPermission = {
      canManageMedicine: true,
      canManageTransactions: true,
      canManageClinicVisits: true,
      canManageStudents: true,
      canManageInventoryCheck: true,
      canViewReports: true,
      canManageSettings: true,
      canApproveAudits: true,
    };
    return this.updateUser(userId, { permissions: fullPerms, role: targetRole });
  }

  public revokeAllUserPermissions(userId: string): User {
    const emptyPerms: UserPermission = {
      canManageMedicine: false,
      canManageTransactions: false,
      canManageClinicVisits: false,
      canManageStudents: false,
      canManageInventoryCheck: false,
      canViewReports: false,
      canManageSettings: false,
      canApproveAudits: false,
    };
    return this.updateUser(userId, { permissions: emptyPerms });
  }

  public resetUserRolePermissions(userId: string): User {
    this.normalizeUsersToTwoRoles();
    const target = this.users.find((u) => u.id === userId);
    if (!target) throw new Error('Không tìm thấy nhiệm vụ');
    const defaultPerms: UserPermission = {
      ...DEFAULT_ROLE_PERMISSIONS[target.role],
    };
    return this.updateUser(userId, { permissions: defaultPerms });
  }

  public toggleRoleGroupPermission(role: UserRole, permKey: keyof UserPermission, value: boolean): number {
    this.normalizeUsersToTwoRoles();
    const targetRole: UserRole = role === 'admin' || role === 'bgh' ? 'admin' : 'medic';
    let count = 0;
    this.users = this.users.map((u) => {
      if (u.role !== targetRole) return u;
      count++;
      const currentPerms = u.permissions || { ...DEFAULT_ROLE_PERMISSIONS[targetRole] };
      const updatedUser: User = {
        ...u,
        permissions: {
          ...currentPerms,
          [permKey]: value,
        },
        updatedAt: new Date().toISOString(),
      };
      if (this.currentUser.role === targetRole) {
        this.currentUser = { ...updatedUser };
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(this.currentUser));
      }
      return updatedUser;
    });

    this.logAudit(
      'Cập nhật phân quyền nhiệm vụ',
      `${value ? 'Cấp' : 'Thu hồi'} quyền "${permKey}" cho nhiệm vụ ${getRoleLabel(targetRole)}`
    );
    this.saveAll();
    this.notify();
    return count;
  }

  public toggleUserStatus(id: string): User {
    this.normalizeUsersToTwoRoles();
    return this.users.find((u) => u.id === id) || this.users[0];
  }

  public deleteUser(_id: string): boolean {
    this.clearAllPersonnelKeepTwoRoles();
    return true;
  }

  public syncUsers(_externalUsers: User[]) {
    this.normalizeUsersToTwoRoles();
    this.saveAll();
    this.notify();
  }

  // --- Audit Logging ---
  public logAudit(action: string, details: string, targetId?: string) {
    const newLog: AuditLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userName: this.currentUser.fullName,
      userRole: this.currentUser.role,
      action,
      details,
      targetId,
    };
    this.auditLogs.unshift(newLog);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.saveAll();
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.logAudit('Cập nhật cài đặt', 'Thay đổi cấu hình cảnh báo và thông tin trường');
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('settings', 'current', this.settings, 'set');
    }
  }

  // --- Suppliers ---
  public getSuppliers(): Supplier[] {
    return [...this.suppliers];
  }

  public addSupplier(supplierData: Omit<Supplier, 'id'>): Supplier {
    const newSupplier: Supplier = {
      id: 'sup-' + Date.now(),
      ...supplierData,
    };
    this.suppliers.push(newSupplier);
    this.logAudit('Thêm nhà cung cấp', `Thêm NCC: ${newSupplier.name} (${newSupplier.code})`);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('suppliers', newSupplier.id, newSupplier, 'set');
    }

    return newSupplier;
  }

  // --- Medicines ---
  public getMedicines(): (Medicine & { totalStock: number; earliestExpDate?: string; computedStatus: MedicineStatus })[] {
    if (this.cachedComputedMedicines) {
      return this.cachedComputedMedicines;
    }
    this.cachedComputedMedicines = this.medicines.map((m) => {
      const medBatches = this.batches.filter((b) => b.medicineId === m.id);
      const totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
      
      // Calculate earliest active expiry
      const activeBatches = medBatches
        .filter((b) => b.quantity > 0)
        .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());
      const earliestExpDate = activeBatches[0]?.expDate;
      const computedStatus = computeMedicineStatus(m, this.batches, this.settings.warningExpiringDays);

      return {
        ...m,
        totalStock,
        earliestExpDate,
        computedStatus,
      };
    });
    return this.cachedComputedMedicines;
  }

  public getMedicineById(id: string): Medicine | undefined {
    return this.medicines.find((m) => m.id === id);
  }

  public seedStandardMedicalCatalog() {
    const defaultCatalog = [
      { code: 'YT-PARA500', name: 'Paracetamol', activeIngredient: 'Paracetamol', dosageForm: 'Viên nén', strength: '500mg', unit: 'Viên', packing: 'Hộp 10 vỉ x 10 viên', manufacturer: 'Dược Hậu Giang', country: 'Việt Nam', minStock: 100, unitPrice: 500, storageLocation: 'Tủ A - Ngăn 1' },
      { code: 'YT-ORESOL', name: 'Oresol', activeIngredient: 'Muối bù nước điện giải', dosageForm: 'Bột pha uống', strength: '', unit: 'Gói', packing: 'Hộp 40 gói', manufacturer: 'Dược phẩm TW', country: 'Việt Nam', minStock: 50, unitPrice: 1500, storageLocation: 'Tủ A - Ngăn 2' },
      { code: 'YT-NMSL', name: 'Nước muối sinh lý 0.9%', activeIngredient: 'Natri Clorid 0.9%', dosageForm: 'Dung dịch', strength: '0.9%', unit: 'Chai', packing: 'Thùng 50 chai', manufacturer: 'Vĩnh Phúc', country: 'Việt Nam', minStock: 10, unitPrice: 5000, storageLocation: 'Tủ B - Ngăn 1' },
      { code: 'YT-POV10', name: 'Povidine 10%', activeIngredient: 'Povidon Iod 10%', dosageForm: 'Dung dịch sát khuẩn', strength: '10%', unit: 'Lọ', packing: 'Hộp 1 lọ 20ml', manufacturer: 'Pharmedic', country: 'Việt Nam', minStock: 5, unitPrice: 12000, storageLocation: 'Tủ B - Ngăn 2' },
      { code: 'VT-URGO', name: 'Băng cá nhân Urgo', activeIngredient: '', dosageForm: 'Vật tư y tế', strength: '', unit: 'Miếng', packing: 'Hộp 100 miếng', manufacturer: 'Urgo', country: 'Thái Lan', minStock: 200, unitPrice: 500, storageLocation: 'Tủ C - Ngăn 1' },
      { code: 'VT-BONG', name: 'Bông y tế thấm nước', activeIngredient: '', dosageForm: 'Vật tư y tế', strength: '', unit: 'Cuộn', packing: 'Bao 1 cuộn 50g', manufacturer: 'Bảo Thạch', country: 'Việt Nam', minStock: 10, unitPrice: 7000, storageLocation: 'Tủ C - Ngăn 2' },
      { code: 'VT-GAC', name: 'Gạc vô trùng', activeIngredient: '', dosageForm: 'Vật tư y tế', strength: '', unit: 'Miếng', packing: 'Hộp 10 miếng', manufacturer: 'Bảo Thạch', country: 'Việt Nam', minStock: 50, unitPrice: 2000, storageLocation: 'Tủ C - Ngăn 2' },
      { code: 'YT-DAUGIO', name: 'Dầu gió xanh Thiên Ân', activeIngredient: 'Tinh dầu bạc hà', dosageForm: 'Dung dịch xoa ngoài', strength: '', unit: 'Chai', packing: 'Hộp 1 chai 5ml', manufacturer: 'Thiên Ân', country: 'Việt Nam', minStock: 5, unitPrice: 25000, storageLocation: 'Tủ A - Ngăn 3' },
      { code: 'YT-OSLA', name: 'Thuốc nhỏ mắt Osla', activeIngredient: 'Natri clorid', dosageForm: 'Dung dịch nhỏ mắt', strength: '0.9%', unit: 'Lọ', packing: 'Hộp 1 lọ 15ml', manufacturer: 'Merap', country: 'Việt Nam', minStock: 10, unitPrice: 15000, storageLocation: 'Tủ B - Ngăn 1' },
      { code: 'YT-SMECTA', name: 'Smecta (Đau bụng)', activeIngredient: 'Diosmectit', dosageForm: 'Bột pha uống', strength: '3g', unit: 'Gói', packing: 'Hộp 30 gói', manufacturer: 'Beaufour Ipsen', country: 'Pháp', minStock: 20, unitPrice: 4000, storageLocation: 'Tủ A - Ngăn 2' },
    ];

    let added = 0;
    for (const item of defaultCatalog) {
      const existingMed = this.medicines.find((m) => m.code.toUpperCase() === item.code.toUpperCase());
      
      let medId = '';
      if (!existingMed) {
        medId = 'med-' + Date.now() + '-' + added;
        this.medicines.unshift({
          ...item,
          id: medId,
          supplierId: this.suppliers.length > 0 ? this.suppliers[0].id : '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        added++;
      } else {
        medId = existingMed.id;
      }
      
      // Check if this medicine has any batches, if not, create one
      const hasBatches = this.batches.some(b => b.medicineId === medId);
      if (!hasBatches) {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 2);
        this.batches.unshift({
          id: 'batch-' + Date.now() + '-' + added + Math.random(),
          medicineId: medId,
          batchNumber: 'LO-' + new Date().getFullYear() + '-' + (added + 1),
          mfgDate: new Date().toISOString().split('T')[0],
          expDate: nextYear.toISOString().split('T')[0],
          quantity: item.minStock * 5, 
          initialQuantity: item.minStock * 5,
          unitPrice: item.unitPrice,
          storageLocation: item.storageLocation,
        });
        if (existingMed) added++; // Count as an update if we added a missing batch
      }
    }

    if (added > 0) {
      this.saveAll();
      this.logAudit('Thêm danh mục mẫu', `Đã tự động thêm ${added} loại thuốc/vật tư thiết yếu`);
      this.notify();
    }
    return added;
  }

  public addMedicine(medicineData: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>, initialBatch?: {
    batchNumber: string;
    mfgDate: string;
    expDate: string;
    quantity: number;
    unitPrice?: number;
  }): Medicine {
    // Check duplicate code
    if (this.medicines.some((m) => m.code.trim().toUpperCase() === medicineData.code.trim().toUpperCase())) {
      throw new Error(`Mã thuốc "${medicineData.code}" đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.`);
    }

    const now = new Date().toISOString();
    const newMed: Medicine = {
      id: 'med-' + Date.now(),
      ...medicineData,
      createdAt: now,
      updatedAt: now,
    };

    this.medicines.unshift(newMed);

    if (initialBatch && initialBatch.quantity > 0) {
      const newBatch: MedicineBatch = {
        id: 'batch-' + Date.now(),
        medicineId: newMed.id,
        batchNumber: initialBatch.batchNumber || 'LO-BAN-DAU',
        mfgDate: initialBatch.mfgDate,
        expDate: initialBatch.expDate,
        quantity: Number(initialBatch.quantity),
        initialQuantity: Number(initialBatch.quantity),
        unitPrice: Number(initialBatch.unitPrice) || Number(medicineData.unitPrice) || 0,
        supplierId: medicineData.supplierId,
        storageLocation: medicineData.storageLocation,
        isDemo: false,
      };
      this.batches.push(newBatch);
    }

    this.logAudit('Thêm thuốc', `Thêm mới thuốc: ${newMed.name} (${newMed.code})`, newMed.id);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'medicines', docId: newMed.id, data: newMed, op: 'set' },
      ];
      if (initialBatch && initialBatch.quantity > 0) {
        const createdBatch = this.batches.find((b) => b.medicineId === newMed.id);
        if (createdBatch) {
          writes.push({ subcollection: 'batches', docId: createdBatch.id, data: createdBatch, op: 'set' });
        }
      }
      this.persistBatch(writes);
    }

    return newMed;
  }

  public updateMedicine(id: string, updates: Partial<Medicine>): Medicine {
    const index = this.medicines.findIndex((m) => m.id === id);
    if (index === -1) throw new Error('Không tìm thấy thông tin thuốc cần sửa.');

    // If changing code, verify uniqueness
    if (updates.code) {
      const duplicate = this.medicines.find(
        (m) => m.id !== id && m.code.trim().toUpperCase() === updates.code?.trim().toUpperCase()
      );
      if (duplicate) {
        throw new Error(`Mã thuốc "${updates.code}" đã được sử dụng cho thuốc khác.`);
      }
    }

    this.medicines[index] = {
      ...this.medicines[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.logAudit('Sửa thuốc', `Cập nhật thông tin thuốc: ${this.medicines[index].name} (${this.medicines[index].code})`, id);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('medicines', id, this.medicines[index], 'set');
    }

    return this.medicines[index];
  }

  public deleteMedicine(id: string, force = true): void {
    const med = this.medicines.find((m) => m.id === id);
    if (!med) throw new Error('Thuốc không tồn tại.');

    const medBatches = this.batches.filter((b) => b.medicineId === id);
    const totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
    if (totalStock > 0 && !force) {
      throw new Error(`Không thể xóa thuốc "${med.name}" vì vẫn còn tồn kho (${totalStock} ${med.unit}).`);
    }

    const batchesToDelete = this.batches.filter((b) => b.medicineId === id);
    this.medicines = this.medicines.filter((m) => m.id !== id);
    this.batches = this.batches.filter((b) => b.medicineId !== id);
    this.logAudit('Xóa thuốc', `Xóa danh mục thuốc: ${med.name} (${med.code}), kèm ${batchesToDelete.length} lô`, id);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'medicines', docId: id, op: 'delete' },
        ...batchesToDelete.map((b) => ({
          subcollection: 'batches',
          docId: b.id,
          op: 'delete' as const,
        })),
      ];
      this.persistBatch(writes);
    }
  }

  public clearMedicinesAndInventory(): {
    medicinesCount: number;
    batchesCount: number;
    transactionsCount: number;
    checksCount: number;
    disposalsCount: number;
    usageCount: number;
  } {
    const deletedMedIds = this.medicines.map((m) => m.id);
    const deletedBatchIds = this.batches.map((b) => b.id);
    const deletedTxIds = this.transactions.map((t) => t.id);
    const deletedCheckIds = this.inventoryChecks.map((c) => c.id);
    const deletedDispIds = this.disposals.map((d) => d.id);
    const deletedUsageIds = this.usageRecords.map((u) => u.id);

    const counts = {
      medicinesCount: deletedMedIds.length,
      batchesCount: deletedBatchIds.length,
      transactionsCount: deletedTxIds.length,
      checksCount: deletedCheckIds.length,
      disposalsCount: deletedDispIds.length,
      usageCount: deletedUsageIds.length,
    };

    this.medicines = [];
    this.batches = [];
    this.transactions = [];
    this.inventoryChecks = [];
    this.disposals = [];
    this.usageRecords = [];

    // Clear medicine usages in clinic visits so no dangling medicine references remain
    this.clinicVisits = this.clinicVisits.map((v) => ({
      ...v,
      medicineUsage: [],
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem('thcs_dongthanh_production_clean_v2', 'true');
      localStorage.setItem(STORAGE_KEYS.INITIALIZED_FLAG, 'true');
      localStorage.setItem(STORAGE_KEYS.MEDICINES, '[]');
      localStorage.setItem(STORAGE_KEYS.BATCHES, '[]');
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, '[]');
      localStorage.setItem(STORAGE_KEYS.INVENTORY_CHECKS, '[]');
      localStorage.setItem(STORAGE_KEYS.DISPOSALS, '[]');
      localStorage.setItem(STORAGE_KEYS.USAGE_RECORDS, '[]');
    }

    this.saveAll();
    this.logAudit(
      'LÀM SẠCH KHO THUỐC & TỒN KHO',
      `Đã xóa sạch toàn bộ danh mục thuốc (${counts.medicinesCount} thuốc), tồn kho (${counts.batchesCount} lô), giao dịch kho (${counts.transactionsCount} phiếu), kiểm kê (${counts.checksCount} biên bản) để sẵn sàng xuất bản và nhập dữ liệu thực tế.`
    );
    this.notify();

    if (this.currentUserId && isCloudSyncAllowed(this.currentUserId)) {
      const writes: BatchWriteOp[] = [
        ...deletedMedIds.map((id) => ({
          subcollection: 'medicines' as const,
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedBatchIds.map((id) => ({
          subcollection: 'batches' as const,
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedTxIds.map((id) => ({
          subcollection: 'transactions' as const,
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedCheckIds.map((id) => ({
          subcollection: 'inventoryChecks' as const,
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedDispIds.map((id) => ({
          subcollection: 'disposals' as const,
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedUsageIds.map((id) => ({
          subcollection: 'usageRecords' as const,
          docId: id,
          op: 'delete' as const,
        })),
      ];
      if (writes.length > 0) {
        this.persistBatch(writes);
      }
    }

    return counts;
  }

  public clearStudentsAndClasses(options: {
    clearStudents?: boolean;
    clearClasses?: boolean;
    clearVisitsAndEvents?: boolean;
  } = { clearStudents: true, clearClasses: true, clearVisitsAndEvents: true }): {
    studentsCount: number;
    classesCount: number;
    profilesCount: number;
    visitsCount: number;
    eventsCount: number;
    checkupsCount: number;
  } {
    const clearStudents = options.clearStudents !== false;
    const clearClasses = options.clearClasses !== false;
    const clearVisitsAndEvents = options.clearVisitsAndEvents !== false;

    const deletedStudentIds = clearStudents ? this.students.map((s) => s.id) : [];
    const deletedProfileIds = clearStudents ? this.healthProfiles.map((p) => p.id) : [];
    const deletedClassIds = clearClasses ? this.classes.map((c) => c.id) : [];
    const deletedVisitIds = clearVisitsAndEvents ? this.clinicVisits.map((v) => v.id) : [];
    const deletedEventIds = clearVisitsAndEvents ? this.healthEvents.map((e) => e.id) : [];
    const deletedCheckupIds = clearVisitsAndEvents ? this.healthCheckups.map((c) => c.id) : [];

    const counts = {
      studentsCount: deletedStudentIds.length,
      classesCount: deletedClassIds.length,
      profilesCount: deletedProfileIds.length,
      visitsCount: deletedVisitIds.length,
      eventsCount: deletedEventIds.length,
      checkupsCount: deletedCheckupIds.length,
    };

    if (clearStudents) {
      this.students = [];
      this.healthProfiles = [];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, '[]');
        localStorage.setItem(STORAGE_KEYS.STUDENT_HEALTH_PROFILES, '[]');
      }
    }

    if (clearClasses) {
      this.classes = [];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SCHOOL_CLASSES, '[]');
      }
    }

    if (clearVisitsAndEvents) {
      this.clinicVisits = [];
      this.healthEvents = [];
      this.healthCheckups = [];
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CLINIC_VISITS, '[]');
        localStorage.setItem(STORAGE_KEYS.HEALTH_EVENTS, '[]');
        localStorage.setItem(STORAGE_KEYS.HEALTH_CHECKUPS, '[]');
      }
    } else if (clearStudents) {
      // If visits are kept, clear student references so no dangling IDs remain
      this.clinicVisits = this.clinicVisits.map((v) => ({
        ...v,
        studentId: '',
      }));
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('thcs_dongthanh_students_clean_v1', 'true');
      if (clearStudents) {
        localStorage.removeItem('thcs_dongthanh_real_students_imported');
      }
    }

    this.lastLocalStudentMutationAt = Date.now();
    this.saveAll();

    const summaryParts: string[] = [];
    if (clearStudents) summaryParts.push(`${counts.studentsCount} học sinh & ${counts.profilesCount} hồ sơ sức khỏe`);
    if (clearClasses) summaryParts.push(`${counts.classesCount} lớp học & GVCN`);
    if (clearVisitsAndEvents && (counts.visitsCount > 0 || counts.eventsCount > 0)) {
      summaryParts.push(`${counts.visitsCount} lượt khám & ${counts.eventsCount} sự kiện y tế`);
    }

    this.logAudit(
      'LÀM SẠCH HỌC SINH, LỚP HỌC & GVCN',
      `Đã xóa sạch: ${summaryParts.join(', ')} để sẵn sàng xuất bản và nạp dữ liệu học sinh, lớp học thực tế của trường.`
    );
    this.notify();

    if (this.currentUserId && isCloudSyncAllowed(this.currentUserId)) {
      const writes: BatchWriteOp[] = [
        ...deletedStudentIds.map((id) => ({
          subcollection: 'students',
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedProfileIds.map((id) => ({
          subcollection: 'healthProfiles',
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedClassIds.map((id) => ({
          subcollection: 'schoolClasses',
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedVisitIds.map((id) => ({
          subcollection: 'clinicVisits',
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedEventIds.map((id) => ({
          subcollection: 'healthEvents',
          docId: id,
          op: 'delete' as const,
        })),
        ...deletedCheckupIds.map((id) => ({
          subcollection: 'healthCheckups',
          docId: id,
          op: 'delete' as const,
        })),
      ];
      if (writes.length > 0) {
        this.persistBatch(writes);
      }
    }

    return counts;
  }

  public clearAllMedicines(): void {
    this.clearMedicinesAndInventory();
  }

  public deleteBatch(id: string): void {
    const batch = this.batches.find((b) => b.id === id);
    if (!batch) throw new Error('Lô thuốc không tồn tại.');
    const med = this.medicines.find((m) => m.id === batch.medicineId);

    this.batches = this.batches.filter((b) => b.id !== id);
    if (med) {
      this.syncMedicine(med.id);
    }
    this.logAudit('Xóa lô thuốc', `Xóa số lô: ${batch.batchNumber} của thuốc ${med ? med.name : batch.medicineId}`, id);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('batches', id, null, 'delete');
    }
  }

  // Synchronize a specific medicine's stock and expiry from its current batches
  public syncMedicine(medicineId: string): void {
    const med = this.medicines.find((m) => m.id === medicineId);
    if (!med) return;
    const medBatches = this.batches.filter((b) => b.medicineId === medicineId);
    med.totalStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
    const activeBatches = medBatches
      .filter((b) => b.quantity > 0)
      .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());
    med.earliestExpDate = activeBatches[0]?.expDate;
    med.computedStatus = computeMedicineStatus(med, this.batches, this.settings.warningExpiringDays);
  }

  public deleteTransaction(id: string, revertStock = true): void {
    const txIndex = this.transactions.findIndex((t) => t.id === id);
    if (txIndex === -1) throw new Error('Không tìm thấy phiếu giao dịch.');
    const tx = this.transactions[txIndex];

    const writes: BatchWriteOp[] = [
      { subcollection: 'transactions', docId: id, op: 'delete' },
    ];

    if (revertStock && tx.items && tx.items.length > 0) {
      for (const item of tx.items) {
        if (item.batchId) {
          const batch = this.batches.find((b) => b.id === item.batchId);
          if (batch) {
            if (tx.type === 'import') {
              batch.quantity = Math.max(0, batch.quantity - (item.quantity || 0));
            } else if (tx.type === 'export') {
              batch.quantity += (item.quantity || 0);
            }
            writes.push({ subcollection: 'batches', docId: batch.id, data: batch, op: 'set' });
          }
        }
      }
    }

    this.transactions.splice(txIndex, 1);
    this.logAudit('Xóa phiếu giao dịch', `Xóa ${tx.type === 'import' ? 'phiếu nhập' : 'phiếu xuất'}: ${tx.transactionCode}`, id);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistBatch(writes);
    }
  }

  public deleteInventoryCheck(id: string): void {
    const idx = this.inventoryChecks.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Không tìm thấy đợt kiểm kê cần xóa.');
    const check = this.inventoryChecks[idx];
    this.inventoryChecks.splice(idx, 1);
    this.logAudit('Xóa đợt kiểm kê', `Xóa phiếu kiểm kê ${check.checkCode}`, id);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('inventoryChecks', id, null, 'delete');
    }
  }

  // --- Sequential Auto Transaction Codes ---
  public getNextImportCode(): string {
    const year = new Date().getFullYear();
    const prefix = `PN-${year}-`;
    let maxSeq = 0;
    for (const tx of this.transactions) {
      if (tx.transactionCode && tx.transactionCode.startsWith(prefix)) {
        const numPart = parseInt(tx.transactionCode.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  public getNextExportCode(): string {
    const year = new Date().getFullYear();
    const prefix = `PX-${year}-`;
    let maxSeq = 0;
    for (const tx of this.transactions) {
      if (tx.transactionCode && tx.transactionCode.startsWith(prefix)) {
        const numPart = parseInt(tx.transactionCode.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  public getNextCheckCode(): string {
    const year = new Date().getFullYear();
    const prefix = `KK-${year}-`;
    let maxSeq = 0;
    for (const chk of this.inventoryChecks) {
      if (chk.checkCode && chk.checkCode.startsWith(prefix)) {
        const numPart = parseInt(chk.checkCode.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  // --- Batches (Quản lý Lô) ---
  public getBatches(medicineId?: string): MedicineBatch[] {
    if (medicineId) {
      return this.batches.filter((b) => b.medicineId === medicineId);
    }
    return [...this.batches];
  }

  public getBatchById(id: string): MedicineBatch | undefined {
    return this.batches.find((b) => b.id === id);
  }

  public addBatch(payload: {
    medicineId: string;
    batchNumber: string;
    mfgDate: string;
    expDate: string;
    quantity: number;
    unitPrice?: number;
    supplierId?: string;
    storageLocation?: string;
    createTransaction?: boolean;
    notes?: string;
  }): MedicineBatch {
    const med = this.medicines.find((m) => m.id === payload.medicineId);
    if (!med) throw new Error(`Không tìm thấy thuốc với ID: ${payload.medicineId}`);

    const cleanBatchNumber = (payload.batchNumber || '').trim().toUpperCase();
    if (!cleanBatchNumber) throw new Error('Số hiệu lô không được để trống.');

    if (payload.quantity <= 0) {
      throw new Error('Số lượng của lô phải lớn hơn 0.');
    }

    if (payload.mfgDate && payload.expDate && new Date(payload.expDate) <= new Date(payload.mfgDate)) {
      throw new Error(`Hạn sử dụng (${payload.expDate}) phải sau ngày sản xuất (${payload.mfgDate}).`);
    }

    const now = new Date().toISOString();
    const batchId = 'batch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const newBatch: MedicineBatch = {
      id: batchId,
      medicineId: med.id,
      batchNumber: cleanBatchNumber,
      mfgDate: payload.mfgDate || new Date().toISOString().split('T')[0],
      expDate: payload.expDate,
      quantity: Number(payload.quantity),
      initialQuantity: Number(payload.quantity),
      unitPrice: payload.unitPrice ?? med.unitPrice ?? 0,
      supplierId: payload.supplierId || med.supplierId,
      storageLocation: payload.storageLocation || med.storageLocation,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };

    this.batches.unshift(newBatch);

    const writes: BatchWriteOp[] = [
      { subcollection: 'batches', docId: newBatch.id, data: newBatch, op: 'set' },
    ];

    // Optionally create an import transaction so Sổ theo dõi Nhập - Xuất - Tồn is updated
    if (payload.createTransaction !== false) {
      const txCode = this.getNextImportCode();
      const sup = this.suppliers.find((s) => s.id === (payload.supplierId || med.supplierId));
      const newTx: InventoryTransaction = {
        id: 'tx-' + Date.now(),
        transactionCode: txCode,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        source: payload.notes || 'Nhập thêm lô mới cho tủ thuốc y tế trường học',
        supplierId: sup?.id || '',
        supplierName: sup?.name || 'Nhập bổ sung tủ thuốc',
        deliverer: 'Cán bộ cung ứng / Phòng y tế',
        receiver: this.currentUser?.fullName || 'Cán bộ y tế',
        performer: this.currentUser?.fullName || 'Cán bộ y tế',
        items: [
          {
            medicineId: med.id,
            medicineCode: med.code,
            medicineName: med.name,
            batchId: newBatch.id,
            batchNumber: newBatch.batchNumber,
            quantity: newBatch.quantity,
            unitPrice: newBatch.unitPrice || 0,
            totalAmount: (newBatch.quantity || 0) * (newBatch.unitPrice || 0),
            unit: med.unit,
            expDate: newBatch.expDate,
          },
        ],
        totalAmount: (newBatch.quantity || 0) * (newBatch.unitPrice || 0),
        notes: payload.notes || `Nhập thêm lô ${newBatch.batchNumber} - HSD ${newBatch.expDate}`,
        status: 'completed',
        createdAt: now,
      };
      this.transactions.unshift(newTx);
      writes.push({ subcollection: 'transactions', docId: newTx.id, data: newTx, op: 'set' });
    }

    this.logAudit(
      'Nhập thêm lô thuốc',
      `Thêm lô mới "${newBatch.batchNumber}" (SL: ${newBatch.quantity} ${med.unit}, HSD: ${newBatch.expDate}) cho thuốc: ${med.name} (${med.code})`,
      newBatch.id
    );

    this.syncMedicine(med.id);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistBatch(writes);
    }

    return newBatch;
  }

  public updateBatch(id: string, updates: Partial<MedicineBatch>): MedicineBatch {
    const idx = this.batches.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Không tìm thấy thông tin lô thuốc.');

    const current = this.batches[idx];
    const med = this.medicines.find((m) => m.id === current.medicineId);

    if (updates.quantity !== undefined && updates.quantity < 0) {
      throw new Error('Số lượng tồn của lô không thể âm.');
    }

    const mfg = updates.mfgDate || current.mfgDate;
    const exp = updates.expDate || current.expDate;
    if (mfg && exp && new Date(exp) <= new Date(mfg)) {
      throw new Error(`Hạn sử dụng (${exp}) phải sau ngày sản xuất (${mfg}).`);
    }

    const updated: MedicineBatch = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.batchNumber) {
      updated.batchNumber = updates.batchNumber.trim().toUpperCase();
    }

    this.batches[idx] = updated;

    this.logAudit(
      'Cập nhật lô thuốc',
      `Chỉnh sửa thông tin lô ${updated.batchNumber} (HSD: ${updated.expDate}, SL: ${updated.quantity} ${med ? med.unit : ''}) của thuốc: ${med ? med.name : current.medicineId}`,
      id
    );

    this.syncMedicine(current.medicineId);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('batches', id, updated, 'set');
    }

    return updated;
  }

  // FEFO: Get available batches sorted by expiry date ascending
  // Excludes expired batches by default (getDaysRemaining >= 0)
  public getFEFOBatches(medicineId: string, includeExpired = false): MedicineBatch[] {
    return this.batches
      .filter((b) => {
        if (b.medicineId !== medicineId || b.quantity <= 0) return false;
        if (!includeExpired && getDaysRemaining(b.expDate) < 0) return false;
        return true;
      })
      .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());
  }

  // Calculate FEFO multi-batch allocation breakdown before confirming export
  public calculateFEFOAllocation(medicineId: string, requestedQuantity: number) {
    const med = this.medicines.find((m) => m.id === medicineId);
    const validBatches = this.getFEFOBatches(medicineId, false);
    const expiredBatches = this.batches.filter(
      (b) => b.medicineId === medicineId && b.quantity > 0 && getDaysRemaining(b.expDate) < 0
    );

    let remaining = requestedQuantity;
    const allocations: { batch: MedicineBatch; allocatedQty: number }[] = [];

    for (const batch of validBatches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      allocations.push({ batch, allocatedQty: take });
      remaining -= take;
    }

    const totalValidAvailable = validBatches.reduce((sum, b) => sum + b.quantity, 0);
    const canFulfill = requestedQuantity > 0 && remaining <= 0;

    return {
      medicine: med,
      allocations,
      totalValidAvailable,
      canFulfill,
      shortage: Math.max(0, remaining),
      expiredBatches,
    };
  }

  // --- Imports (Nhập Thuốc) ---
  public importMedicineTransaction(payload: {
    transactionCode: string;
    date: string;
    source: string;
    supplierId?: string;
    supplierName?: string;
    deliverer: string;
    receiver: string;
    performer: string;
    notes?: string;
    items: {
      medicineId: string;
      batchNumber: string;
      mfgDate: string;
      expDate: string;
      quantity: number;
      unitPrice?: number;
      storageLocation?: string;
    }[];
  }): InventoryTransaction {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Phiếu nhập phải có ít nhất 1 mặt hàng.');
    }

    // Resolve supplier id & name (support free-text input from user)
    let finalSupplierId = payload.supplierId || '';
    let finalSupplierName = payload.supplierName?.trim() || '';

    if (finalSupplierId && !finalSupplierName) {
      const sup = this.suppliers.find((s) => s.id === finalSupplierId);
      if (sup) finalSupplierName = sup.name;
    }

    if (finalSupplierName) {
      const sup = this.suppliers.find(
        (s) => s.name.trim().toLowerCase() === finalSupplierName.toLowerCase() || s.id === finalSupplierId
      );
      if (sup) {
        finalSupplierId = sup.id;
        finalSupplierName = sup.name;
      } else {
        // Auto-register new supplier so it is persisted for future suggestions
        const newSup: Supplier = {
          id: 'sup-' + Date.now(),
          code: 'NCC-' + String(this.suppliers.length + 1).padStart(2, '0'),
          name: finalSupplierName,
          phone: '',
          address: '',
          contactPerson: payload.deliverer || '',
        };
        this.suppliers.push(newSup);
        finalSupplierId = newSup.id;
      }
    }

    // Validation: no negative or zero quantity, valid dates
    for (const item of payload.items) {
      if (item.quantity <= 0) {
        throw new Error(`Số lượng nhập của thuốc phải lớn hơn 0 (phát hiện số lượng: ${item.quantity}).`);
      }
      if (!item.batchNumber?.trim()) {
        throw new Error('Số lô không được để trống.');
      }
      if (item.mfgDate && item.expDate && new Date(item.expDate) <= new Date(item.mfgDate)) {
        throw new Error(`Hạn sử dụng (${item.expDate}) phải sau ngày sản xuất (${item.mfgDate}) cho lô "${item.batchNumber}".`);
      }
    }

    const transactionItems: {
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
    }[] = [];

    // Process each item & update / create batch
    for (const item of payload.items) {
      const med = this.medicines.find((m) => m.id === item.medicineId);
      if (!med) throw new Error(`Không tìm thấy mã thuốc ID: ${item.medicineId}`);

      // Find if exact batch exists for this medicine and batch number
      let existingBatch = this.batches.find(
        (b) => b.medicineId === item.medicineId && b.batchNumber.trim().toUpperCase() === item.batchNumber.trim().toUpperCase()
      );

      let batchId: string;
      if (existingBatch) {
        // Add to existing batch
        existingBatch.quantity += item.quantity;
        existingBatch.initialQuantity += item.quantity;
        batchId = existingBatch.id;
      } else {
        // Create new batch
        const newBatch: MedicineBatch = {
          id: 'batch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          medicineId: item.medicineId,
          batchNumber: item.batchNumber.trim().toUpperCase(),
          mfgDate: item.mfgDate || '2025-01-01',
          expDate: item.expDate,
          quantity: item.quantity,
          initialQuantity: item.quantity,
          supplierId: finalSupplierId,
          storageLocation: item.storageLocation || med.storageLocation,
          isDemo: false,
        };
        this.batches.push(newBatch);
        batchId = newBatch.id;
      }

      transactionItems.push({
        medicineId: med.id,
        medicineCode: med.code,
        medicineName: med.name,
        batchId,
        batchNumber: item.batchNumber.trim().toUpperCase(),
        quantity: item.quantity,
        unit: med.unit,
        expDate: item.expDate,
      });
    }

    const totalImportQty = transactionItems.reduce((s, it) => s + it.quantity, 0);

    const newTx: InventoryTransaction = {
      id: 'tx-' + Date.now(),
      transactionCode: payload.transactionCode?.trim() || this.getNextImportCode(),
      type: 'import',
      date: payload.date || new Date().toISOString().split('T')[0],
      source: payload.source,
      supplierId: finalSupplierId,
      supplierName: finalSupplierName || (this.suppliers.find((s) => s.id === finalSupplierId)?.name) || '',
      deliverer: payload.deliverer,
      receiver: payload.receiver,
      performer: payload.performer || this.currentUser.fullName,
      notes: payload.notes,
      items: transactionItems,
      status: 'completed',
      isDemo: false,
      createdAt: new Date().toISOString(),
    };

    this.transactions.unshift(newTx);
    this.logAudit(
      'Nhập kho thuốc',
      `Tạo phiếu nhập ${newTx.transactionCode}: Nhập ${transactionItems.length} thuốc (Tổng số lượng: ${totalImportQty})`,
      newTx.id
    );

    for (const item of transactionItems) {
      this.syncMedicine(item.medicineId);
    }
    this.lastInventoryMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_last_inventory_mutation_at', String(this.lastInventoryMutationAt));
    } catch {
      // ignore
    }

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'transactions', docId: newTx.id, data: newTx, op: 'set' },
      ];
      for (const item of transactionItems) {
        const b = this.batches.find((batch) => batch.id === item.batchId);
        if (b) writes.push({ subcollection: 'batches', docId: b.id, data: b, op: 'set' });
      }
      this.persistBatch(writes);
    }

    return newTx;
  }

  // --- Exports (Xuất / Cấp phát thuốc) ---
  public exportMedicineTransaction(payload: {
    transactionCode?: string;
    date: string;
    recipientName: string;
    recipientType: 'student' | 'teacher' | 'staff' | 'other';
    recipientClass?: string;
    purpose: string;
    performer: string;
    notes?: string;
    items: {
      medicineId: string;
      batchId?: string; // If not provided, auto select using FEFO
      quantity: number;
    }[];
  }): InventoryTransaction {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Phiếu xuất phải có ít nhất 1 loại thuốc.');
    }
    if (!payload.recipientName?.trim()) {
      throw new Error('Họ và tên người sử dụng/nhận thuốc không được để trống.');
    }
    if (!payload.purpose?.trim()) {
      throw new Error('Mục đích sử dụng thuốc không được để trống.');
    }

    const transactionItems: {
      medicineId: string;
      medicineCode: string;
      medicineName: string;
      batchId: string;
      batchNumber: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
      unit: string;
      expDate?: string;
    }[] = [];

    let grandTotal = 0;

    // Check each requested item against current batch balances
    for (const req of payload.items) {
      if (req.quantity <= 0) {
        throw new Error(`Số lượng xuất phải lớn hơn 0.`);
      }

      const med = this.medicines.find((m) => m.id === req.medicineId);
      if (!med) throw new Error(`Không tìm thấy thuốc ID: ${req.medicineId}`);

      // If specific batch requested:
      if (req.batchId) {
        const batch = this.batches.find((b) => b.id === req.batchId);
        if (!batch) throw new Error(`Không tìm thấy lô thuốc đã chọn.`);

        // STRICT REQUIREMENT: Do not allow export of expired batches!
        if (getDaysRemaining(batch.expDate) < 0) {
          throw new Error(
            `Lô thuốc "${batch.batchNumber}" của "${med.name}" đã hết hạn sử dụng (${formatDateVN(batch.expDate)}), không được phép xuất kho.`
          );
        }

        if (batch.quantity < req.quantity) {
          throw new Error(
            `Lô ${batch.batchNumber} chỉ còn ${batch.quantity} ${med.unit}, không đủ để xuất ${req.quantity} ${med.unit}.`
          );
        }

        // Deduct from batch
        batch.quantity -= req.quantity;
        const totalAmount = req.quantity * (batch.unitPrice || med.unitPrice || 0);
        grandTotal += totalAmount;

        transactionItems.push({
          medicineId: med.id,
          medicineCode: med.code,
          medicineName: med.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: req.quantity,
          unitPrice: batch.unitPrice || med.unitPrice || 0,
          totalAmount,
          unit: med.unit,
          expDate: batch.expDate,
        });
      } else {
        // Automatic FEFO Allocation:
        const fefoAllocation = this.calculateFEFOAllocation(med.id, req.quantity);
        if (!fefoAllocation.canFulfill) {
          if (fefoAllocation.expiredBatches.length > 0 && fefoAllocation.totalValidAvailable === 0) {
            throw new Error(
              `Không thể xuất thuốc "${med.name}": Toàn bộ các lô tồn kho hiện tại đã hết hạn sử dụng, không được phép xuất kho.`
            );
          }
          throw new Error(
            `Không đủ số lượng tồn kho còn hạn sử dụng để xuất thuốc "${med.name}". (Hiện còn hạn: ${fefoAllocation.totalValidAvailable} ${med.unit}, yêu cầu xuất: ${req.quantity} ${med.unit})`
          );
        }

        for (const item of fefoAllocation.allocations) {
          const batch = item.batch;
          const deductAmount = item.allocatedQty;
          batch.quantity -= deductAmount;

          const totalAmount = deductAmount * (batch.unitPrice || med.unitPrice || 0);
          grandTotal += totalAmount;

          transactionItems.push({
            medicineId: med.id,
            medicineCode: med.code,
            medicineName: med.name,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            quantity: deductAmount,
            unitPrice: batch.unitPrice || med.unitPrice || 0,
            totalAmount,
            unit: med.unit,
            expDate: batch.expDate,
          });
        }
      }
    }

    const txCode = payload.transactionCode?.trim() || this.getNextExportCode();
    const newTx: InventoryTransaction = {
      id: 'tx-' + Date.now(),
      transactionCode: txCode,
      type: 'export',
      date: payload.date || new Date().toISOString().split('T')[0],
      recipientName: payload.recipientName,
      recipientType: payload.recipientType,
      recipientClass: payload.recipientClass,
      purpose: payload.purpose,
      performer: payload.performer || this.currentUser.fullName,
      notes: payload.notes,
      items: transactionItems,
      totalAmount: grandTotal,
      status: 'completed',
      isDemo: false,
      createdAt: new Date().toISOString(),
    };

    this.transactions.unshift(newTx);

    // Also write into Usage Records (Sổ theo dõi sử dụng thuốc)
    for (const item of transactionItems) {
      const record: UsageRecord = {
        id: 'rec-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        transactionId: newTx.id,
        date: newTx.date,
        recipientName: payload.recipientName,
        recipientType: payload.recipientType,
        recipientClass: payload.recipientClass || 'Không có',
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        unit: item.unit,
        purpose: payload.purpose,
        performer: newTx.performer,
        notes: payload.notes,
        isDemo: false,
      };
      this.usageRecords.unshift(record);
    }

    this.logAudit(
      'Xuất cấp phát thuốc',
      `Tạo phiếu xuất ${newTx.transactionCode} cho ${payload.recipientName} (${payload.recipientType === 'student' ? 'Học sinh ' + (payload.recipientClass || '') : 'Giáo viên/Nhân viên'}): ${transactionItems.map((i) => `${i.medicineName} (${i.quantity} ${i.unit})`).join(', ')}`,
      newTx.id
    );

    for (const item of transactionItems) {
      this.syncMedicine(item.medicineId);
    }
    this.lastInventoryMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_last_inventory_mutation_at', String(this.lastInventoryMutationAt));
    } catch {
      // ignore
    }

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'transactions', docId: newTx.id, data: newTx, op: 'set' },
      ];
      for (const item of transactionItems) {
        const b = this.batches.find((batch) => batch.id === item.batchId);
        if (b) writes.push({ subcollection: 'batches', docId: b.id, data: b, op: 'set' });
      }
      for (const rec of this.usageRecords.filter((r) => r.transactionId === newTx.id)) {
        writes.push({ subcollection: 'usageRecords', docId: rec.id, data: rec, op: 'set' });
      }
      this.persistBatch(writes);
    }

    return newTx;
  }

  // --- Cancel Transaction (Hủy phiếu an toàn) ---
  public cancelTransaction(transactionId: string, reason: string): void {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) throw new Error('Không tìm thấy phiếu giao dịch.');
    if (tx.status === 'cancelled') throw new Error('Phiếu này đã được hủy trước đó.');

    // Reverse inventory effects
    if (tx.type === 'import') {
      // Must deduct what was imported; verify each batch still has enough quantity
      for (const item of tx.items) {
        const batch = this.batches.find((b) => b.id === item.batchId);
        if (batch) {
          if (batch.quantity < item.quantity) {
            throw new Error(`Không thể hủy phiếu nhập: Lô ${batch.batchNumber} đã được xuất một phần, lượng tồn hiện tại (${batch.quantity}) nhỏ hơn số lượng nhập cần hoàn tác (${item.quantity}).`);
          }
          batch.quantity -= item.quantity;
        }
      }
    } else if (tx.type === 'export') {
      // Re-add to batch quantities
      for (const item of tx.items) {
        const batch = this.batches.find((b) => b.id === item.batchId);
        if (batch) {
          batch.quantity += item.quantity;
        }
      }
      // Remove or mark usage records
      this.usageRecords = this.usageRecords.filter((r) => r.transactionId !== tx.id);
    }

    tx.status = 'cancelled';
    tx.cancellationReason = reason;

    this.logAudit(
      'HỦY PHIẾU GIAO DỊCH',
      `Hủy phiếu ${tx.transactionCode} (${tx.type === 'import' ? 'Nhập kho' : 'Xuất kho'}). Lý do: ${reason}`,
      tx.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'transactions', docId: tx.id, data: tx, op: 'set' },
      ];
      for (const item of tx.items) {
        const b = this.batches.find((batch) => batch.id === item.batchId);
        if (b) writes.push({ subcollection: 'batches', docId: b.id, data: b, op: 'set' });
      }
      this.persistBatch(writes);
    }
  }

  // --- Transactions Query ---
  public getTransactions(type?: 'import' | 'export'): InventoryTransaction[] {
    if (type) {
      return this.transactions.filter((t) => t.type === type);
    }
    return [...this.transactions];
  }

  // --- Usage Records Query ---
  public getUsageRecords(): UsageRecord[] {
    return [...this.usageRecords];
  }

  // --- Supplies (Vật tư y tế) ---
  public getSupplies(): MedicalSupply[] {
    return [...this.supplies];
  }

  public getMedicalSupplies(): MedicalSupply[] {
    return this.getSupplies();
  }

  public addSupply(supplyData: Omit<MedicalSupply, 'id'>): MedicalSupply {
    const newSupply: MedicalSupply = {
      id: 'sup-item-' + Date.now(),
      ...supplyData,
    };
    this.supplies.unshift(newSupply);
    this.logAudit('Thêm vật tư y tế', `Thêm mới vật tư: ${newSupply.name} (${newSupply.code})`);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('supplies', newSupply.id, newSupply, 'set');
    }

    return newSupply;
  }

  // --- Inventory Calculations & Stock Balances (Quản lý tồn kho) ---
  // Formula: Tồn cuối = Tồn đầu + Tổng Nhập - Tổng Xuất
  public getStockBalances(startDate?: string, endDate?: string): StockBalanceItem[] {
    const allMeds = this.getMedicines();
    const balances: StockBalanceItem[] = [];

    // Filter transactions in date range if provided
    const txInPeriod = this.transactions.filter((t) => {
      if (t.status === 'cancelled') return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });

    for (const med of allMeds) {
      const medBatches = this.batches.filter((b) => b.medicineId === med.id);

      if (medBatches.length === 0) {
        balances.push({
          medicineId: med.id,
          medicineCode: med.code,
          medicineName: med.name,
          batchNumber: 'Chưa có lô',
          expDate: '---',
          unit: med.unit,
          openingStock: 0,
          importQuantity: 0,
          exportQuantity: 0,
          closingStock: 0,
          minStock: med.minStock,
          unitPrice: med.unitPrice,
          totalValuation: 0,
          status: 'out_of_stock',
          expiryAlert: 'safe',
        });
        continue;
      }

      for (const batch of medBatches) {
        // Calculate imports and exports in period for this batch
        let importQty = 0;
        let exportQty = 0;

        for (const tx of txInPeriod) {
          for (const item of tx.items) {
            if (item.batchId === batch.id || (item.medicineId === med.id && item.batchNumber === batch.batchNumber)) {
              if (tx.type === 'import') importQty += item.quantity;
              if (tx.type === 'export') exportQty += item.quantity;
            }
          }
        }

        const closingStock = batch.quantity;
        // Opening stock for the filtered period
        const openingStock = Math.max(0, closingStock - importQty + exportQty);
        const expAlert = getExpiryAlertLevel(batch.expDate, this.settings.warningExpiringDays, this.settings.warningNoticeDays);

        let itemStatus: MedicineStatus = 'active';
        if (closingStock === 0) itemStatus = 'out_of_stock';
        else if (expAlert === 'expired') itemStatus = 'expired';
        else if (expAlert === 'warning_30') itemStatus = 'expiring_soon';
        else if (closingStock <= med.minStock) itemStatus = 'low_stock';

        balances.push({
          medicineId: med.id,
          medicineCode: med.code,
          medicineName: med.name,
          batchNumber: batch.batchNumber,
          expDate: batch.expDate,
          unit: med.unit,
          openingStock,
          importQuantity: importQty,
          exportQuantity: exportQty,
          closingStock,
          minStock: med.minStock,
          unitPrice: batch.unitPrice || med.unitPrice,
          totalValuation: closingStock * (batch.unitPrice || med.unitPrice),
          status: itemStatus,
          expiryAlert: expAlert,
        });
      }
    }

    return balances;
  }

  // --- SỔ NHẬP - XUẤT - TỒN (In-Out-Balance Report) ---
  public getStockInOutReport(options?: {
    startDate?: string;
    endDate?: string;
    medicineId?: string;
    batchNumber?: string;
  }): StockInOutBalanceRow[] {
    const { startDate, endDate, medicineId, batchNumber } = options || {};
    const rows: StockInOutBalanceRow[] = [];

    // Filter transactions
    const validTxs = this.transactions.filter((t) => t.status !== 'cancelled');

    // Filter target batches
    let targetBatches = [...this.batches];
    if (medicineId) {
      targetBatches = targetBatches.filter((b) => b.medicineId === medicineId);
    }
    if (batchNumber) {
      targetBatches = targetBatches.filter(
        (b) => b.batchNumber.toLowerCase().includes(batchNumber.toLowerCase().trim())
      );
    }

    let stt = 1;
    for (const batch of targetBatches) {
      const med = this.medicines.find((m) => m.id === batch.medicineId);
      if (!med) continue;

      let importQty = 0;
      let exportQty = 0;
      let adjQty = 0;

      // Prior to startDate: transactions used to calculate opening stock if startDate is provided
      let priorImport = 0;
      let priorExport = 0;

      for (const tx of validTxs) {
        for (const item of tx.items) {
          const match = item.batchId === batch.id || (item.medicineId === med.id && item.batchNumber === batch.batchNumber);
          if (match) {
            const inPeriod = (!startDate || tx.date >= startDate) && (!endDate || tx.date <= endDate);
            const isPrior = startDate && tx.date < startDate;

            if (inPeriod) {
              if (tx.type === 'import') importQty += item.quantity;
              if (tx.type === 'export') exportQty += item.quantity;
            }
            if (isPrior) {
              if (tx.type === 'import') priorImport += item.quantity;
              if (tx.type === 'export') priorExport += item.quantity;
            }
          }
        }
      }

      // If user specified a startDate, opening stock is calculated by back-tracking from current stock or prior sums
      const closingStock = batch.quantity;
      const openingStock = startDate
        ? Math.max(0, (batch.initialQuantity || batch.quantity) + priorImport - priorExport)
        : Math.max(0, closingStock - importQty + exportQty);

      // Check if there was an audit difference recorded
      adjQty = closingStock - (openingStock + importQty - exportQty);

      rows.push({
        id: `ior-${batch.id}`,
        stt: stt++,
        date: startDate && endDate ? `${formatDateVN(startDate)} - ${formatDateVN(endDate)}` : 'Toàn kỳ',
        medicineId: med.id,
        medicineCode: med.code,
        medicineName: med.name,
        batchNumber: batch.batchNumber,
        expDate: batch.expDate,
        unit: med.unit,
        openingStock,
        importQuantity: importQty,
        exportQuantity: exportQty,
        adjustmentQuantity: adjQty,
        closingStock,
        notes: batch.storageLocation || med.storageLocation || '',
      });
    }

    return rows;
  }

  // --- Inventory Checks (Kiểm Kê Thuốc & Vật Tư Y Tế) ---
  public getInventoryChecks(): InventoryCheck[] {
    return [...this.inventoryChecks];
  }

  public getInventoryCheckById(id: string): InventoryCheck | undefined {
    return this.inventoryChecks.find((c) => c.id === id);
  }

  public saveInventoryCheck(payload: Partial<InventoryCheck>): InventoryCheck {
    const existingIdx = payload.id ? this.inventoryChecks.findIndex((c) => c.id === payload.id) : -1;
    const checkCode = payload.checkCode?.trim() || this.getNextCheckCode();

    const checkRecord: InventoryCheck = {
      id: payload.id || 'chk-' + Date.now(),
      checkCode,
      checkDate: payload.checkDate || new Date().toISOString().split('T')[0],
      checkTime: payload.checkTime || new Date().toTimeString().slice(0, 5),
      performer: payload.performer || this.currentUser.fullName,
      participants: payload.participants || [
        this.currentUser.fullName + ' - Cán bộ Y tế học đường',
        'Ban Giám Hiệu trường',
        'Đại diện Kế toán / Thủ kho',
      ],
      notes: payload.notes || '',
      status: payload.status || 'draft',
      confirmedAt: payload.confirmedAt,
      confirmedBy: payload.confirmedBy,
      adjustedAt: payload.adjustedAt,
      adjustedBy: payload.adjustedBy,
      createdAt: payload.createdAt || new Date().toISOString(),
      items: payload.items || [],
    };

    if (existingIdx >= 0) {
      this.inventoryChecks[existingIdx] = checkRecord;
    } else {
      this.inventoryChecks.unshift(checkRecord);
    }

    this.logAudit(
      'Lập phiếu kiểm kê',
      `Lưu biên bản kiểm kê ${checkRecord.checkCode} (${checkRecord.items.length} mặt hàng). Trạng thái: ${checkRecord.status}`,
      checkRecord.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('inventoryChecks', checkRecord.id, checkRecord, 'set');
    }

    return checkRecord;
  }

  public confirmInventoryCheck(checkId: string, approverName: string): InventoryCheck {
    const check = this.inventoryChecks.find((c) => c.id === checkId);
    if (!check) throw new Error('Không tìm thấy phiếu kiểm kê.');
    if (check.status === 'adjusted') {
      throw new Error('Phiếu kiểm kê này đã được điều chỉnh kho trước đó.');
    }

    check.status = 'confirmed';
    check.confirmedAt = new Date().toISOString();
    check.confirmedBy = approverName;

    this.logAudit(
      'Xác nhận kiểm kê',
      `Xác nhận biên bản kiểm kê ${check.checkCode}. Người duyệt: ${approverName}`,
      check.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('inventoryChecks', check.id, check, 'set');
    }

    return check;
  }

  // 2-Step Workflow: Adjust inventory from confirmed or draft check
  public adjustInventoryFromCheck(
    checkId: string,
    approverName: string,
    adjustmentNotes?: string
  ): InventoryCheck {
    const check = this.inventoryChecks.find((c) => c.id === checkId);
    if (!check) throw new Error('Không tìm thấy phiếu kiểm kê.');
    if (check.status === 'adjusted') {
      throw new Error('Phiếu kiểm kê này đã được điều chỉnh kho trước đó.');
    }

    let adjustmentCount = 0;
    const adjustedDetails: string[] = [];

    for (const item of check.items) {
      if (item.difference !== 0) {
        const batch = this.batches.find((b) => b.id === item.batchId);
        if (batch) {
          const oldQty = batch.quantity;
          const newQty = item.actualQuantity;
          batch.quantity = newQty;
          adjustmentCount++;

          adjustedDetails.push(
            `${item.medicineName} (Lô ${item.batchNumber}): ${oldQty} -> ${newQty} ${item.unit} (chênh lệch: ${item.difference > 0 ? '+' : ''}${item.difference})`
          );
        }
      }
    }

    check.status = 'adjusted';
    check.adjustedAt = new Date().toISOString();
    check.adjustedBy = approverName;
    if (adjustmentNotes) {
      check.notes = (check.notes ? check.notes + ' | ' : '') + `Ghi chú điều chỉnh: ${adjustmentNotes}`;
    }

    this.logAudit(
      'ĐIỀU CHỈNH TỒN KHO THEO KIỂM KÊ',
      `Điều chỉnh số liệu kho theo biên bản ${check.checkCode}. Người duyệt: ${approverName}. Đã điều chỉnh ${adjustmentCount} mặt hàng: ${adjustedDetails.slice(0, 3).join('; ')}${adjustedDetails.length > 3 ? '...' : ''}`,
      check.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'inventoryChecks', docId: check.id, data: check, op: 'set' },
      ];
      for (const item of check.items) {
        if (item.difference !== 0) {
          const b = this.batches.find((batch) => batch.id === item.batchId);
          if (b) writes.push({ subcollection: 'batches', docId: b.id, data: b, op: 'set' });
        }
      }
      this.persistBatch(writes);
    }

    return check;
  }

  // --- Data Integrity Check (Kiểm tra tính toàn vẹn dữ liệu) ---
  public checkDataIntegrity(): DataIntegrityIssue[] {
    const issues: DataIntegrityIssue[] = [];

    // 1. Check for negative batch quantities
    for (const batch of this.batches) {
      if (batch.quantity < 0) {
        const med = this.medicines.find((m) => m.id === batch.medicineId);
        issues.push({
          id: `issue-neg-${batch.id}`,
          type: 'negative_stock',
          severity: 'error',
          medicineId: batch.medicineId,
          medicineName: med?.name || 'Không xác định',
          batchNumber: batch.batchNumber,
          description: `Lô "${batch.batchNumber}" bị tồn âm: ${batch.quantity} ${med?.unit || ''}.`,
          suggestedAction: 'Điều chỉnh số lượng về 0 hoặc kiểm tra lại phiếu xuất.',
        });
      }

      // 2. Check for missing batch number
      if (!batch.batchNumber || !batch.batchNumber.trim()) {
        issues.push({
          id: `issue-nobatch-${batch.id}`,
          type: 'invalid_batch',
          severity: 'error',
          medicineId: batch.medicineId,
          description: 'Lô thuốc bị thiếu thông tin số lô hợp lệ.',
          suggestedAction: 'Bổ sung số lô nhận diện.',
        });
      }

      // 3. Check for invalid expiry date
      if (!batch.expDate || isNaN(new Date(batch.expDate).getTime())) {
        const med = this.medicines.find((m) => m.id === batch.medicineId);
        issues.push({
          id: `issue-nodate-${batch.id}`,
          type: 'invalid_batch',
          severity: 'warning',
          medicineId: batch.medicineId,
          medicineName: med?.name,
          batchNumber: batch.batchNumber,
          description: `Lô "${batch.batchNumber}" có định dạng ngày hết hạn không hợp lệ (${batch.expDate}).`,
          suggestedAction: 'Cập nhật lại ngày hết hạn chuẩn (YYYY-MM-DD).',
        });
      }
    }

    // 4. Check for medicine totalStock discrepancy vs sum of batches
    for (const med of this.medicines) {
      const medBatches = this.batches.filter((b) => b.medicineId === med.id);
      const sumQuantity = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
      if (med.totalStock !== sumQuantity) {
        issues.push({
          id: `issue-mismatch-${med.id}`,
          type: 'discrepancy',
          severity: 'warning',
          medicineId: med.id,
          medicineName: med.name,
          description: `Chênh lệch bộ đếm tổng tồn: Thuốc ghi nhận ${med.totalStock}, tổng các lô thực tế là ${sumQuantity}.`,
          suggestedAction: 'Chạy đồng bộ tự động để tính lại từ các lô.',
        });
      }
    }

    // 5. Check for transactions with invalid or negative items
    for (const tx of this.transactions) {
      if (tx.status !== 'cancelled') {
        for (const item of tx.items) {
          if (item.quantity <= 0) {
            issues.push({
              id: `issue-txzero-${tx.id}-${item.medicineId}`,
              type: 'transaction_mismatch',
              severity: 'error',
              description: `Phiếu ${tx.transactionCode} có mặt hàng với số lượng không hợp lệ (${item.quantity}).`,
              suggestedAction: 'Kiểm tra và hủy hoặc sửa phiếu giao dịch.',
            });
          }
        }
      }
    }

    return issues;
  }

  // Auto Heal / Fix Integrity Discrepancies
  public autoFixDataIntegrity(): { fixedCount: number; message: string } {
    let fixed = 0;

    // 1. Fix negative batches
    for (const batch of this.batches) {
      if (batch.quantity < 0) {
        batch.quantity = 0;
        fixed++;
      }
    }

    // 2. Re-sync all medicine totalStock
    for (const med of this.medicines) {
      const medBatches = this.batches.filter((b) => b.medicineId === med.id);
      const sumQuantity = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);
      if (med.totalStock !== sumQuantity) {
        med.totalStock = sumQuantity;
        fixed++;
      }
    }

    this.saveAll();
    this.notify();

    return {
      fixedCount: fixed,
      message:
        fixed > 0
          ? `Đã tự động chuẩn hóa và đồng bộ thành công ${fixed} điểm dữ liệu kho!`
          : 'Toàn bộ dữ liệu kho thuốc và vật tư đã hoàn toàn toàn vẹn và chính xác 100%.',
    };
  }

  // Comprehensive synchronization of all medicines, batches, and expiry dates
  public syncAllMedicinesAndBatches(): {
    medicineCount: number;
    batchCount: number;
    activeBatchCount: number;
    expiredBatchCount: number;
    expiringSoonBatchCount: number;
    fixedDiscrepancies: number;
    message: string;
  } {
    let fixed = 0;
    const writes: BatchWriteOp[] = [];
    const warningDays = this.settings.warningExpiringDays || 30;

    // 1. Correct negative quantities and format batch numbers
    for (const b of this.batches) {
      if (b.quantity < 0) {
        b.quantity = 0;
        fixed++;
        writes.push({ subcollection: 'batches', docId: b.id, data: b, op: 'set' });
      }
      if (b.batchNumber) {
        const clean = b.batchNumber.trim().toUpperCase();
        if (clean !== b.batchNumber) {
          b.batchNumber = clean;
          fixed++;
          writes.push({ subcollection: 'batches', docId: b.id, data: b, op: 'set' });
        }
      }
    }

    // 2. Synchronize all medicines with actual batches
    for (const med of this.medicines) {
      const medBatches = this.batches.filter((b) => b.medicineId === med.id);
      const sumStock = medBatches.reduce((acc, b) => acc + (b.quantity || 0), 0);

      const activeBatches = medBatches
        .filter((b) => b.quantity > 0)
        .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());

      const earliestExp = activeBatches[0]?.expDate;
      const newStatus = computeMedicineStatus(med, this.batches, warningDays);

      let changed = false;
      if (med.totalStock !== sumStock) {
        med.totalStock = sumStock;
        changed = true;
      }
      if (med.earliestExpDate !== earliestExp) {
        med.earliestExpDate = earliestExp;
        changed = true;
      }
      if (med.computedStatus !== newStatus) {
        med.computedStatus = newStatus;
        changed = true;
      }

      if (changed) {
        fixed++;
        writes.push({ subcollection: 'medicines', docId: med.id, data: med, op: 'set' });
      }
    }

    const activeBatchCount = this.batches.filter(
      (b) => b.quantity > 0 && getDaysRemaining(b.expDate) >= 0
    ).length;
    const expiredBatchCount = this.batches.filter(
      (b) => b.quantity > 0 && getDaysRemaining(b.expDate) < 0
    ).length;
    const expiringSoonBatchCount = this.batches.filter(
      (b) =>
        b.quantity > 0 &&
        getDaysRemaining(b.expDate) >= 0 &&
        getDaysRemaining(b.expDate) <= warningDays
    ).length;

    this.saveAll();
    this.notify();

    if (this.currentUserId && writes.length > 0) {
      this.persistBatch(writes);
    }

    this.logAudit(
      'Đồng bộ dữ liệu kho thuốc & lô',
      `Đồng bộ toàn diện ${this.medicines.length} thuốc và ${this.batches.length} lô tồn kho (Đã hiệu chỉnh ${fixed} điểm dữ liệu)`
    );

    return {
      medicineCount: this.medicines.length,
      batchCount: this.batches.length,
      activeBatchCount,
      expiredBatchCount,
      expiringSoonBatchCount,
      fixedDiscrepancies: fixed,
      message: `Đã đồng bộ thành công ${this.medicines.length} loại thuốc và ${this.batches.length} lô tồn kho! Dữ liệu tồn kho và hạn dùng đã khớp 100%.`,
    };
  }

  // --- Dashboard Summary Metrics ---
  public getDashboardMetrics() {
    if (this.cachedDashboardMetrics) {
      return this.cachedDashboardMetrics;
    }
    const meds = this.getMedicines();
    const batches = this.batches;
    const warning30 = this.settings.warningExpiringDays;
    const warning60 = this.settings.warningNoticeDays || 60;

    const totalMedicineTypes = meds.length;
    const totalBatches = batches.length;
    const totalMedicineStock = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const totalMedicalSupplies = this.supplies.reduce((sum, s) => sum + (s.quantity || 0), 0);
    const totalSuppliesCount = this.supplies.length;

    // Valuation
    const totalInventoryValuation = batches.reduce(
      (sum, b) => sum + (b.quantity || 0) * (b.unitPrice || 0),
      0
    );

    // Expired batches
    const expiredBatches = batches.filter((b) => b.quantity > 0 && getDaysRemaining(b.expDate) < 0);

    // Expiring soon (0 <= days <= warning30)
    const expiringSoonBatches = batches.filter(
      (b) => b.quantity > 0 && getDaysRemaining(b.expDate) >= 0 && getDaysRemaining(b.expDate) <= warning30
    );

    // Expiring 60 days
    const expiring60Batches = batches.filter(
      (b) => b.quantity > 0 && getDaysRemaining(b.expDate) > warning30 && getDaysRemaining(b.expDate) <= warning60
    );

    // Safe batches
    const safeBatches = batches.filter((b) => b.quantity > 0 && getDaysRemaining(b.expDate) > warning60);

    // Low stock medicines (totalStock <= minStock and > 0)
    const lowStockMedicines = meds.filter((m) => m.totalStock > 0 && m.totalStock <= m.minStock);

    // Low stock supplies
    const lowStockSupplies = this.supplies.filter((s) => s.quantity <= s.minStock);

    // Out of stock medicines
    const outOfStockMedicines = meds.filter((m) => m.totalStock === 0);

    // Monthly counts
    const currentYearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlyImports = this.transactions.filter(
      (t) => t.type === 'import' && t.status === 'completed' && t.date.startsWith(currentYearMonth)
    );
    const monthlyExports = this.transactions.filter(
      (t) => t.type === 'export' && t.status === 'completed' && t.date.startsWith(currentYearMonth)
    );

    // Monthly trends for Recharts (last 6 months)
    const monthlyTrends: { month: string; imports: number; exports: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `T${d.getMonth() + 1}/${d.getFullYear().toString().slice(-2)}`;

      const imps = this.transactions
        .filter((t) => t.type === 'import' && t.status === 'completed' && t.date.startsWith(ym))
        .reduce((sum, t) => sum + t.items.reduce((s, it) => s + it.quantity, 0), 0);

      const exps = this.transactions
        .filter((t) => t.type === 'export' && t.status === 'completed' && t.date.startsWith(ym))
        .reduce((sum, t) => sum + t.items.reduce((s, it) => s + it.quantity, 0), 0);

      monthlyTrends.push({
        month: label,
        imports: imps,
        exports: exps,
      });
    }

    // Category distribution for charts
    const categoryMap: Record<string, number> = {};
    for (const m of meds) {
      const cat = m.dosageForm || 'Khác';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
    const categoryStats = Object.entries(categoryMap).map(([name, count]) => ({ name, count }));

    // Phase 3 Metrics: Clinic & Student metrics
    const todayStr = getCurrentDateISO();
    const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

    const todayVisits = this.getTodayClinicVisits();
    const monthVisits = this.getClinicVisits().filter(
      (v) => v.visitDate.startsWith(currentMonthPrefix) || this.isVisitToday(v)
    );

    const todayFirstAidCount = todayVisits.filter((v) => v.treatmentType === 'Sơ cứu').length;
    const todayParentContactCount = todayVisits.filter((v) => v.parentContacted).length;
    const todayTransfersCount = todayVisits.filter((v) => v.isTransferred || v.outcome === 'Chuyển viện').length;

    let todayMedicinesUsedCount = 0;
    for (const v of todayVisits) {
      todayMedicinesUsedCount += (v.medicinesUsed || []).reduce((sum, item) => sum + item.quantity, 0);
    }

    let todaySuppliesUsedCount = 0;
    for (const v of todayVisits) {
      todaySuppliesUsedCount += (v.suppliesUsed || []).reduce((sum, item) => sum + item.quantity, 0);
    }

    // Top reasons this month
    const reasonCounts: Record<string, number> = {};
    for (const v of monthVisits) {
      for (const r of v.reasons) {
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
    const topVisitReasonsMonth = Object.entries(reasonCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Visits by class this month
    const classVisitCounts: Record<string, number> = {};
    for (const v of monthVisits) {
      const c = v.className || 'Khác';
      classVisitCounts[c] = (classVisitCounts[c] || 0) + 1;
    }
    const visitsByClassMonth = Object.entries(classVisitCounts)
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count);

    const metricsResult = {
      totalMedicineTypes,
      totalBatches,
      totalMedicineStock,
      totalMedicalSupplies,
      totalSuppliesCount,
      totalInventoryValuation,
      expiredCount: expiredBatches.length,
      expiringSoonCount: expiringSoonBatches.length,
      lowStockCount: lowStockMedicines.length,
      outOfStockCount: outOfStockMedicines.length,
      suppliesLowStockCount: lowStockSupplies.length,
      monthlyImportsCount: monthlyImports.length,
      monthlyExportsCount: monthlyExports.length,
      totalInventoryChecksCount: this.inventoryChecks.length,
      monthlyUsageCount: monthlyExports.length,
      expiredBatches,
      expiringSoonBatches,
      lowStockMedicines,
      outOfStockMedicines,
      lowStockSupplies,
      monthlyTrends,
      categoryStats,
      expiryBreakdown: {
        expired: expiredBatches.length,
        warning30: expiringSoonBatches.length,
        warning60: expiring60Batches.length,
        safe: safeBatches.length,
      },
      // Giai đoạn 3 metrics:
      totalStudentsCount: this.students.length,
      totalClassesCount: this.classes.length,
      todayVisitsCount: todayVisits.length,
      monthVisitsCount: monthVisits.length,
      todayFirstAidCount,
      todayParentContactCount,
      todayTransfersCount,
      todayMedicinesUsedCount,
      todaySuppliesUsedCount,
      topVisitReasonsMonth,
      visitsByClassMonth,
    };
    this.cachedDashboardMetrics = metricsResult;
    return metricsResult;
  }

  // ==========================================
  // GIAI ĐOẠN 3: METHODS QUẢN LÝ HỌC SINH & PHÒNG Y TẾ
  // ==========================================

  // --- Students Management ---
  public getStudents(search?: string, className?: string, grade?: number): Student[] {
    const deletedStudentIds = this.getDeletedStudentIds();
    if (deletedStudentIds.length > 0) {
      const deletedStudentSet = new Set(deletedStudentIds);
      if (this.students.some((s) => deletedStudentSet.has(s.id))) {
        this.students = this.students.filter((s) => !deletedStudentSet.has(s.id));
      }
    }
    if (!search && (!className || className === 'all') && (!grade || grade <= 0)) {
      return this.students;
    }
    let result = [...this.students];
    if (className && className !== 'all') {
      result = result.filter(
        (s) =>
          s.className === className ||
          areClassesEquivalent(s.className, className) ||
          normalizeStudentClassName(s.className) === normalizeStudentClassName(className)
      );
    }
    if (grade && grade > 0) {
      result = result.filter(
        (s) => Number(s.grade || extractGradeFromClassOrGrade(s.grade, s.className)) === Number(grade)
      );
    }
    if (search && search.trim()) {
      result = result.filter((s) => matchesStudentSearch(s, search));
    }
    return result;
  }

  public getStudentById(id: string): Student | undefined {
    return this.students.find((s) => s.id === id);
  }

  public getStudentByCode(code: string): Student | undefined {
    return this.students.find((s) => s.studentCode.toUpperCase() === code.trim().toUpperCase());
  }

  public addStudent(studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Student {
    const cleanFullName = (studentData.fullName || '').trim().replace(/\s+/g, ' ');
    if (!cleanFullName) {
      throw new Error('Họ và tên học sinh không được để trống.');
    }
    const cleanCode = (studentData.studentCode || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new Error('Mã học sinh không được để trống.');
    }
    const cleanClass = (studentData.className || '').trim();
    const cleanGrade = Number(studentData.grade) || extractGradeFromClassOrGrade(studentData.grade, cleanClass) || 6;

    const existing = this.getStudentByCode(cleanCode);
    if (existing) {
      throw new Error(`Mã học sinh "${cleanCode}" đã tồn tại trên hệ thống.`);
    }

    const now = new Date().toISOString();
    const newStudent: Student = {
      ...studentData,
      fullName: cleanFullName,
      studentCode: cleanCode,
      className: cleanClass,
      grade: cleanGrade,
      id: `stu-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.removeDeletedStudentIds([newStudent.id]);
    this.students.push(newStudent);

    // Auto create basic health profile
    const newProfile: StudentHealthProfile = {
      id: `prof-${newStudent.id}`,
      studentId: newStudent.id,
      studentCode: newStudent.studentCode,
      fullName: newStudent.fullName,
      className: newStudent.className,
      bloodType: newStudent.bloodType,
      allergies: newStudent.allergies,
      chronicConditions: newStudent.chronicConditions,
      specialAttention: !!newStudent.specialAttention,
      emergencyContact: {
        name: newStudent.parentName || 'Phụ huynh',
        relationship: 'Phụ huynh',
        phone: newStudent.parentPhone || '',
      },
      notes: newStudent.notes,
      lastUpdated: now,
    };
    this.healthProfiles.push(newProfile);

    localStorage.setItem('thcs_dt_students_updated_at', String(Date.now()));
    localStorage.setItem('thcs_dongthanh_students_cleaned_v1', 'false');
    this.saveStudentBundleLocally();
    this.saveAll(true);
    this.logAudit('Thêm học sinh mới', `Đã thêm học sinh: ${newStudent.fullName} (${newStudent.studentCode}) - Lớp ${newStudent.className}`);
    this.notify();
    this.scheduleServerPush();

    if (this.currentUserId) {
      this.persistBatch([
        { subcollection: 'students', docId: newStudent.id, data: newStudent, op: 'set' },
        { subcollection: 'healthProfiles', docId: newProfile.id, data: newProfile, op: 'set' },
      ]);
    }

    return newStudent;
  }

  public updateStudent(id: string, updates: Partial<Student>): Student {
    const idx = this.students.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error(`Không tìm thấy học sinh với ID: ${id}`);
    }

    const current = this.students[idx];
    if (updates.studentCode && updates.studentCode !== current.studentCode) {
      const existing = this.getStudentByCode(updates.studentCode);
      if (existing && existing.id !== id) {
        throw new Error(`Mã học sinh "${updates.studentCode}" đã được sử dụng.`);
      }
    }

    const updated: Student = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.students[idx] = updated;

    // Synchronize health profile
    const pIdx = this.healthProfiles.findIndex((p) => p.studentId === id);
    if (pIdx !== -1) {
      this.healthProfiles[pIdx] = {
        ...this.healthProfiles[pIdx],
        studentCode: updated.studentCode,
        fullName: updated.fullName,
        className: updated.className,
        bloodType: updated.bloodType,
        allergies: updated.allergies,
        chronicConditions: updated.chronicConditions,
        specialAttention: !!updated.specialAttention,
        lastUpdated: new Date().toISOString(),
      };
    }

    localStorage.setItem('thcs_dt_students_updated_at', String(Date.now()));
    localStorage.setItem('thcs_dongthanh_students_cleaned_v1', 'false');
    this.saveStudentBundleLocally();
    this.saveAll(true);
    this.logAudit('Cập nhật học sinh', `Đã cập nhật thông tin học sinh: ${updated.fullName} (${updated.studentCode})`);
    this.notify();
    this.scheduleServerPush();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'students', docId: updated.id, data: updated, op: 'set' },
      ];
      if (pIdx !== -1) {
        writes.push({ subcollection: 'healthProfiles', docId: this.healthProfiles[pIdx].id, data: this.healthProfiles[pIdx], op: 'set' });
      }
      this.persistBatch(writes);
    }

    return updated;
  }

  public deleteStudent(id: string, force = true): void {
    const idx = this.students.findIndex((s) => s.id === id);
    if (idx === -1) {
      throw new Error('Không tìm thấy học sinh cần xóa.');
    }
    const student = this.students[idx];

    // Check if student has clinic visits
    const visits = this.clinicVisits.filter((v) => v.studentId === id);
    if (visits.length > 0 && !force) {
      throw new Error(`Học sinh "${student.fullName}" đã có ${visits.length} lượt khám tại phòng y tế.`);
    }

    this.addDeletedStudentIds([id]);
    this.students.splice(idx, 1);
    const deletedProfiles = this.healthProfiles.filter((p) => p.studentId === id);
    this.healthProfiles = this.healthProfiles.filter((p) => p.studentId !== id);
    if (force && visits.length > 0) {
      for (const v of visits) {
        this.addDeletedVisitId(v.id);
        if (v.visitCode) this.addDeletedVisitId(v.visitCode);
      }
      this.clinicVisits = this.clinicVisits.filter((v) => v.studentId !== id);
      this.cachedNormalizedVisits = null;
    }

    this.lastLocalStudentMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_students_updated_at', String(this.lastLocalStudentMutationAt));
    } catch {
      // ignore
    }

    for (const c of this.classes) {
      if (c.name === student.className || areClassesEquivalent(c.name, student.className)) {
        c.totalStudents = this.students.filter(
          (s) => s.className === c.name || areClassesEquivalent(s.className, c.name)
        ).length;
      }
    }

    this.saveStudentBundleLocally();
    this.saveAll();
    this.logAudit('Xóa học sinh', `Đã xóa học sinh: ${student.fullName} (${student.studentCode})${visits.length > 0 ? ` kèm ${visits.length} lượt khám` : ''}`);
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'students', docId: id, op: 'delete' },
        ...deletedProfiles.map((p) => ({ subcollection: 'healthProfiles', docId: p.id, op: 'delete' as const })),
        ...(force ? visits.map((v) => ({ subcollection: 'clinicVisits', docId: v.id, op: 'delete' as const })) : []),
      ];
      this.persistBatch(writes);
    }
  }

  public generateUniqueStudentCode(grade: number, hintIdx = 1): string {
    const existingCodes = new Set(this.students.map((s) => s.studentCode.trim().toUpperCase()));
    let nextNum = this.students.length + hintIdx;
    while (existingCodes.has(`HS${String(nextNum).padStart(4, '0')}`)) {
      nextNum++;
    }
    return `HS${String(nextNum).padStart(4, '0')}`;
  }

  public importStudentsFromExcel(
    studentsData: any[],
    options?: { autoGenerateCode?: boolean; updateExisting?: boolean; replaceAll?: boolean }
  ): { added: number; updated: number; errors: string[]; cloudSyncPromise?: Promise<any> } {
    let added = 0;
    let updated = 0;
    const errors: string[] = [];
    const updateExisting = options?.updateExisting !== false;
    const autoGenerateCode = options?.autoGenerateCode !== false;
    const shouldReplaceAll = options?.replaceAll === true || this.isHoldingOnlyDemoStudents();

    if (shouldReplaceAll) {
      // Clear demo or old students so imported list becomes the clean authoritative student list
      this.students = [];
      this.healthProfiles = [];
    }

    // Helper to normalize Vietnamese name for duplicate matching
    const normName = (s: string) =>
      String(s || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

    for (let i = 0; i < studentsData.length; i++) {
      const row = studentsData[i];
      const rowNum = i + 2; // Excel row numbering
      try {
        let rawCode = String(
          row['Mã học sinh'] ||
          row['studentCode'] ||
          row['MaHS'] ||
          row['Mã HS'] ||
          row['Mã định danh'] ||
          row['Mã số'] ||
          row['ma_hs'] ||
          ''
        ).trim();

        // Do not mistake a 1-3 digit STT row number (e.g. "1", "2", "45") for a unique school studentCode
        if (/^\d{1,3}$/.test(rawCode)) {
          rawCode = '';
        }
        let studentCode = rawCode;

        // Support both combined "Họ và tên" and split "Họ đệm" + "Tên" columns
        const splitHoDem = String(
          row['Họ và tên lót'] ||
          row['Họ và tên đệm'] ||
          row['Họ đệm'] ||
          row['Họ và đệm'] ||
          row['Họ'] ||
          row['ho_dem'] ||
          ''
        ).trim();
        const splitTen = String(row['Tên'] || row['ten'] || '').trim();
        const combinedFromSplit = splitHoDem && splitTen ? `${splitHoDem} ${splitTen}` : '';

        const fullName = String(
          row['Họ và tên'] ||
          row['fullName'] ||
          row['HoTen'] ||
          row['Họ tên'] ||
          row['Tên học sinh'] ||
          row['ten_hs'] ||
          combinedFromSplit ||
          splitTen ||
          ''
        )
          .trim()
          .replace(/\s+/g, ' ');

        // Skip non-student header/footer/summary rows gracefully
        const lowerName = fullName.toLowerCase();
        if (
          !fullName ||
          /^(họ và tên|họ tên|tên học sinh|stt|tổng số|tổng cộng|cộng|ghi chú|hiệu trưởng|giáo viên|gvcn|người lập|ngày \d|đông thạnh|\(\d+\))$/.test(lowerName) ||
          lowerName.startsWith('tổng số') ||
          lowerName.startsWith('tổng cộng:') ||
          lowerName.startsWith('danh sách học sinh') ||
          /^\d+$/.test(fullName)
        ) {
          continue;
        }

        const rawClassName = String(
          row['Lớp'] ||
          row['className'] ||
          row['Lop'] ||
          row['Tên lớp'] ||
          row['ten_lop'] ||
          row['_sectionClass'] ||
          ''
        ).trim();

        const sheetName = String(row['_sheetName'] || '').trim();
        const cleanClassName = normalizeStudentClassName(rawClassName) || normalizeStudentClassName(sheetName);

        const rawGrade =
          row['Khối'] ||
          row['grade'] ||
          row['Khoi'] ||
          row['Khối lớp'] ||
          row['Khối học'] ||
          row['khoi_lop'];

        // Robust multi-source grade detection across 4 secondary grades (6, 7, 8, 9)
        const grade = extractGradeFromClassOrGrade(rawGrade, cleanClassName || rawClassName, sheetName);

        const gender = String(row['Giới tính'] || row['gender'] || row['GioiTinh'] || row['Nữ'] || 'Nam').trim();
        const isFemale =
          gender.toLowerCase().includes('nữ') ||
          gender.toLowerCase() === 'nu' ||
          gender.toLowerCase() === 'f' ||
          gender.toLowerCase() === 'x' && Boolean(row['Nữ']);

        const rawBirthDate =
          row['Ngày sinh (ngày/tháng/năm)'] ||
          row['Ngày sinh'] ||
          row['birthDate'] ||
          row['NgaySinh'] ||
          row['Năm sinh'] ||
          '2014-01-01';
        const birthDate = normalizeDateToISO(rawBirthDate) || String(rawBirthDate).trim();

        const parentName = String(row['Phụ huynh'] || row['parentName'] || row['HoTenPhuHuynh'] || row['PhuHuynh'] || '').trim();
        const parentPhone = String(row['SĐT phụ huynh'] || row['parentPhone'] || row['SDT'] || row['DienThoai'] || '').trim();
        const fatherName = String(row['Tên cha'] || row['Họ tên cha'] || row['fatherName'] || row['Cha'] || row['HoTenCha'] || '').trim();
        const fatherPhone = String(row['SĐT cha'] || row['Số điện thoại cha'] || row['fatherPhone'] || row['SDTCha'] || row['DienThoaiCha'] || '').trim();
        const motherName = String(row['Tên mẹ'] || row['Họ tên mẹ'] || row['motherName'] || row['Me'] || row['HoTenMe'] || '').trim();
        const motherPhone = String(row['SĐT mẹ'] || row['Số điện thoại mẹ'] || row['motherPhone'] || row['SDTMe'] || row['DienThoaiMe'] || '').trim();
        const healthInsuranceCode = String(row['Mã BHYT'] || row['healthInsuranceCode'] || row['BHYT'] || '').trim();
        const citizenId = String(row['CCCD/Định danh'] || row['citizenId'] || row['CCCD'] || row['Mã định danh cá nhân'] || '').trim();
        const allergies = String(row['Dị ứng'] || row['allergies'] || '').trim();
        const chronicConditions = String(row['Bệnh nền'] || row['chronicConditions'] || '').trim();
        const homeroomTeacher = String(
          row['Giáo viên chủ nhiệm (GVCN)'] ||
          row['Giáo viên chủ nhiệm'] ||
          row['GVCN'] ||
          row['homeroomTeacher'] ||
          row['Họ tên GVCN'] ||
          row['Tên GVCN'] ||
          row['GiaoVienChuNhiem'] ||
          ''
        ).trim();
        const teacherPhone = String(
          row['SĐT GVCN'] ||
          row['Số điện thoại GVCN'] ||
          row['Điện thoại GVCN'] ||
          row['teacherPhone'] ||
          row['SDTGVCN'] ||
          ''
        ).trim();

        const finalClass = cleanClassName || (grade ? `${grade}/1` : '6/1');

        // Find existing student by explicit studentCode OR by (fullName + className + birthDate)
        let existingIdx = -1;
        if (studentCode) {
          existingIdx = this.students.findIndex(
            (s) => s.studentCode.toLowerCase() === studentCode.toLowerCase()
          );
        }
        if (existingIdx === -1) {
          const targetName = normName(fullName);
          const targetClass = normalizeStudentClassName(finalClass).toLowerCase();
          existingIdx = this.students.findIndex(
            (s) =>
              normName(s.fullName) === targetName &&
              normalizeStudentClassName(s.className).toLowerCase() === targetClass &&
              (!birthDate || !s.birthDate || s.birthDate === birthDate)
          );
        }

        if (!studentCode) {
          if (existingIdx !== -1) {
            studentCode = this.students[existingIdx].studentCode;
          } else if (autoGenerateCode) {
            studentCode = this.generateUniqueStudentCode(grade, i + 1);
          } else {
            errors.push(`Dòng ${rowNum}: Thiếu Mã học sinh.`);
            continue;
          }
        }

        const finalParentName = parentName || fatherName || motherName || undefined;
        const finalParentPhone = parentPhone || fatherPhone || motherPhone || undefined;
        const now = new Date().toISOString();

        if (existingIdx !== -1) {
          if (updateExisting) {
            const existing = this.students[existingIdx];
            existing.studentCode = studentCode || existing.studentCode;
            existing.fullName = fullName || existing.fullName;
            existing.className = finalClass;
            existing.grade = grade;
            existing.gender = isFemale ? 'Nữ' : 'Nam';
            if (birthDate) existing.birthDate = birthDate;
            if (finalParentName) existing.parentName = finalParentName;
            if (finalParentPhone) existing.parentPhone = finalParentPhone;
            if (fatherName) existing.fatherName = fatherName;
            if (fatherPhone) existing.fatherPhone = fatherPhone;
            if (motherName) existing.motherName = motherName;
            if (motherPhone) existing.motherPhone = motherPhone;
            if (healthInsuranceCode) existing.healthInsuranceCode = healthInsuranceCode;
            if (citizenId) existing.citizenId = citizenId;
            if (allergies) existing.allergies = allergies;
            if (chronicConditions) existing.chronicConditions = chronicConditions;
            existing.specialAttention = !!existing.allergies || !!existing.chronicConditions;
            existing.updatedAt = now;

            const pIdx = this.healthProfiles.findIndex((p) => p.studentId === existing.id);
            if (pIdx !== -1) {
              this.healthProfiles[pIdx].studentCode = existing.studentCode;
              this.healthProfiles[pIdx].fullName = existing.fullName;
              this.healthProfiles[pIdx].className = existing.className;
              this.healthProfiles[pIdx].allergies = existing.allergies;
              this.healthProfiles[pIdx].chronicConditions = existing.chronicConditions;
              this.healthProfiles[pIdx].specialAttention = existing.specialAttention;
              this.healthProfiles[pIdx].lastUpdated = now;
            } else {
              this.healthProfiles.push({
                id: `prof-${existing.id}`,
                studentId: existing.id,
                studentCode: existing.studentCode,
                fullName: existing.fullName,
                className: existing.className,
                allergies: existing.allergies,
                chronicConditions: existing.chronicConditions,
                specialAttention: !!existing.specialAttention,
                emergencyContact: {
                  name: existing.fatherName || existing.motherName || existing.parentName || 'Phụ huynh',
                  relationship: existing.fatherName ? 'Cha' : existing.motherName ? 'Mẹ' : 'Phụ huynh',
                  phone: existing.fatherPhone || existing.motherPhone || existing.parentPhone || '',
                },
                lastUpdated: now,
              });
            }

            updated++;
          } else {
            errors.push(`Dòng ${rowNum}: Học sinh "${fullName}" (${studentCode}) đã tồn tại.`);
            continue;
          }
        } else {
          const newStu: Student = {
            id: `stu-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            studentCode,
            fullName,
            className: finalClass,
            grade,
            gender: isFemale ? 'Nữ' : 'Nam',
            birthDate,
            schoolYear: '2026-2027',
            parentName: finalParentName,
            parentPhone: finalParentPhone,
            fatherName: fatherName || undefined,
            fatherPhone: fatherPhone || undefined,
            motherName: motherName || undefined,
            motherPhone: motherPhone || undefined,
            healthInsuranceCode: healthInsuranceCode || undefined,
            citizenId: citizenId || undefined,
            allergies: allergies || undefined,
            chronicConditions: chronicConditions || undefined,
            specialAttention: !!allergies || !!chronicConditions,
            createdAt: now,
            updatedAt: now,
          };

          this.students.push(newStu);

          this.healthProfiles.push({
            id: `prof-${newStu.id}`,
            studentId: newStu.id,
            studentCode: newStu.studentCode,
            fullName: newStu.fullName,
            className: newStu.className,
            bloodType: undefined,
            allergies: newStu.allergies,
            chronicConditions: newStu.chronicConditions,
            specialAttention: !!newStu.specialAttention,
            emergencyContact: {
              name: newStu.fatherName || newStu.motherName || newStu.parentName || 'Phụ huynh',
              relationship: newStu.fatherName ? 'Cha' : newStu.motherName ? 'Mẹ' : 'Phụ huynh',
              phone: newStu.fatherPhone || newStu.motherPhone || newStu.parentPhone || '',
            },
            lastUpdated: now,
          });

          added++;
        }

        // Auto-add or update class
        if (finalClass) {
          const existingClassIdx = this.classes.findIndex(
            (c) =>
              c.name.toLowerCase() === finalClass.toLowerCase() ||
              normalizeStudentClassName(c.name).toLowerCase() === finalClass.toLowerCase()
          );
          if (existingClassIdx === -1) {
            const newCls: SchoolClass = {
              id: `cls-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${i}`,
              name: finalClass,
              grade,
              homeroomTeacher: homeroomTeacher || '',
              teacherPhone: teacherPhone || '',
              totalStudents: 1,
              userId: this.currentUserId || undefined,
              createdAt: now,
              updatedAt: now,
            };
            this.classes.push(newCls);
          } else {
            const currentCls = this.classes[existingClassIdx];
            if (homeroomTeacher && (!currentCls.homeroomTeacher || this.isDemoSchoolClass(currentCls))) {
              currentCls.homeroomTeacher = homeroomTeacher;
              currentCls.updatedAt = now;
            }
            if (teacherPhone && (!currentCls.teacherPhone || this.isDemoSchoolClass(currentCls))) {
              currentCls.teacherPhone = teacherPhone;
              currentCls.updatedAt = now;
            }
            if (grade && currentCls.grade !== grade) {
              currentCls.grade = grade;
              currentCls.updatedAt = now;
            }
          }
        }
      } catch (err: any) {
        errors.push(`Dòng ${rowNum}: ${err.message}`);
      }
    }

    // Recalculate total students for each class and remove empty demo classes if replaceAll was used
    this.classes.forEach((c) => {
      c.totalStudents = this.students.filter(
        (s) =>
          s.className.toLowerCase() === c.name.toLowerCase() ||
          normalizeStudentClassName(s.className).toLowerCase() === normalizeStudentClassName(c.name).toLowerCase()
      ).length;
    });

    if (shouldReplaceAll && (added > 0 || updated > 0)) {
      this.classes = this.classes.filter((c) => (c.totalStudents || 0) > 0 || Boolean(c.homeroomTeacher));
    }

    this.classes.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi', { numeric: true });
    });

    let cloudSyncPromise: Promise<any> | undefined;
    if (added > 0 || updated > 0) {
      this.lastLocalStudentMutationAt = Date.now();
      if (typeof window !== 'undefined') {
        localStorage.setItem('thcs_dongthanh_real_students_imported', 'true');
        localStorage.removeItem('thcs_dongthanh_students_clean_v1');
        localStorage.setItem('thcs_dt_classes_updated_at', String(this.lastLocalStudentMutationAt));
      }
      this.saveAll(true);
      this.pushStateToServer();
      this.logAudit(
        'Import học sinh',
        `Đã import & đồng bộ thành công ${added} học sinh mới, cập nhật ${updated} học sinh từ tệp Excel (Tổng: ${this.students.length} học sinh).`
      );
      this.notify();

      cloudSyncPromise = this.syncStudentsToCloud();
    }

    return { added, updated, errors, cloudSyncPromise };
  }

  // --- Student Health Profiles ---
  public getStudentHealthProfile(studentId: string): StudentHealthProfile | undefined {
    const found = this.healthProfiles.find((p) => p.studentId === studentId);
    if (found) return found;
    const student = this.getStudentById(studentId);
    if (!student) return undefined;
    return {
      id: `prof-${student.id}`,
      studentId: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      className: student.className,
      bloodType: student.bloodType,
      allergies: student.allergies,
      chronicConditions: student.chronicConditions,
      specialAttention: Boolean(student.specialAttention),
      emergencyContact: {
        name: student.fatherName || student.motherName || student.parentName || 'Phụ huynh',
        relationship: student.fatherName ? 'Cha' : student.motherName ? 'Mẹ' : 'Phụ huynh',
        phone: student.fatherPhone || student.motherPhone || student.parentPhone || '',
      },
      lastUpdated: student.updatedAt || student.createdAt || new Date().toISOString(),
    };
  }

  public updateStudentHealthProfile(studentId: string, data: Partial<StudentHealthProfile>): StudentHealthProfile {
    const idx = this.healthProfiles.findIndex((p) => p.studentId === studentId);
    const now = new Date().toISOString();
    if (idx === -1) {
      const student = this.getStudentById(studentId);
      if (!student) throw new Error(`Không tìm thấy học sinh ID: ${studentId}`);
      const newProfile: StudentHealthProfile = {
        id: `prof-${studentId}`,
        studentId,
        studentCode: student.studentCode,
        fullName: student.fullName,
        className: student.className,
        specialAttention: false,
        emergencyContact: {
          name: student.parentName || 'Phụ huynh',
          relationship: 'Phụ huynh',
          phone: student.parentPhone || '',
        },
        ...data,
        lastUpdated: now,
      };
      this.healthProfiles.push(newProfile);
      this.saveAll();
      this.notify();

      if (this.currentUserId) {
        this.persistItem('healthProfiles', newProfile.id, newProfile, 'set');
      }

      return newProfile;
    }

    this.healthProfiles[idx] = {
      ...this.healthProfiles[idx],
      ...data,
      lastUpdated: now,
    };

    // Keep student in sync if critical health info changes
    const stuIdx = this.students.findIndex((s) => s.id === studentId);
    if (stuIdx !== -1) {
      if (data.bloodType !== undefined) this.students[stuIdx].bloodType = data.bloodType;
      if (data.allergies !== undefined) this.students[stuIdx].allergies = data.allergies;
      if (data.chronicConditions !== undefined) this.students[stuIdx].chronicConditions = data.chronicConditions;
      if (data.specialAttention !== undefined) this.students[stuIdx].specialAttention = data.specialAttention;
    }

    this.saveAll();
    this.logAudit('Cập nhật hồ sơ sức khỏe', `Đã cập nhật hồ sơ sức khỏe học sinh: ${this.healthProfiles[idx].fullName}`);
    this.notify();

    if (this.currentUserId) {
      const writes: BatchWriteOp[] = [
        { subcollection: 'healthProfiles', docId: this.healthProfiles[idx].id, data: this.healthProfiles[idx], op: 'set' },
      ];
      if (stuIdx !== -1) {
        writes.push({ subcollection: 'students', docId: this.students[stuIdx].id, data: this.students[stuIdx], op: 'set' });
      }
      this.persistBatch(writes);
    }

    return this.healthProfiles[idx];
  }

  // --- Classes & School Years ---
  public getSchoolClasses(): SchoolClass[] {
    return this.classes.map((c) => ({
      ...c,
      totalStudents:
        this.students.filter(
          (s) =>
            s.className === c.name ||
            normalizeClassName(s.className) === normalizeClassName(c.name)
        ).length ||
        c.totalStudents ||
        0,
    }));
  }

  public addSchoolClass(classData: {
    name: string;
    grade: number;
    homeroomTeacher?: string;
    teacherPhone?: string;
    room?: string;
  }): SchoolClass {
    const cleanName = (classData.name || '').trim();
    if (!cleanName) throw new Error('Tên lớp không được để trống.');

    const cleanGrade = Number(classData.grade) || parseInt(cleanName.charAt(0), 10) || 6;
    if (this.classes.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error(`Lớp "${cleanName}" đã tồn tại trong danh sách lớp.`);
    }

    const nowIso = new Date().toISOString();
    const newClass: SchoolClass = {
      id: `cls-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      grade: cleanGrade,
      homeroomTeacher: classData.homeroomTeacher?.trim() || '',
      teacherPhone: classData.teacherPhone?.trim() || '',
      room: classData.room?.trim() || '',
      totalStudents: 0,
      userId: this.currentUserId || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.removeDeletedClassIds([newClass.id, normalizeClassName(cleanName)]);
    this.classes.push(newClass);
    this.classes.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi', { numeric: true });
    });

    this.lastLocalStudentMutationAt = Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('thcs_dt_classes_updated_at', String(this.lastLocalStudentMutationAt));
    }
    this.saveAll(true);
    this.pushStateToServer();
    this.logAudit('Thêm lớp học mới', `Thêm lớp ${newClass.name} (Khối ${newClass.grade}) - GVCN: ${newClass.homeroomTeacher || 'Chưa phân công'}`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('schoolClasses', newClass.id, newClass, 'set');
    }

    return newClass;
  }

  public updateSchoolClass(id: string, updates: Partial<SchoolClass>): SchoolClass {
    const idx = this.classes.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Không tìm thấy lớp học cần sửa.');

    const current = this.classes[idx];
    if (updates.name && updates.name.trim().toLowerCase() !== current.name.toLowerCase()) {
      if (this.classes.some((c) => c.id !== id && c.name.toLowerCase() === updates.name!.trim().toLowerCase())) {
        throw new Error(`Tên lớp "${updates.name}" đã trùng với một lớp khác.`);
      }
    }

    const oldName = current.name;
    const newName = updates.name ? updates.name.trim() : current.name;
    const nowIso = new Date().toISOString();

    const updated: SchoolClass = {
      ...current,
      ...updates,
      name: newName,
      grade: updates.grade !== undefined ? Number(updates.grade) : current.grade,
      homeroomTeacher: updates.homeroomTeacher !== undefined ? updates.homeroomTeacher.trim() : current.homeroomTeacher,
      teacherPhone: updates.teacherPhone !== undefined ? updates.teacherPhone.trim() : current.teacherPhone,
      room: updates.room !== undefined ? updates.room.trim() : current.room,
      updatedAt: nowIso,
    };

    this.classes[idx] = updated;
    this.removeDeletedClassIds([updated.id, normalizeClassName(newName)]);

    // If class name changed, update students in that class
    if (newName !== oldName) {
      for (const stu of this.students) {
        if (stu.className === oldName) {
          stu.className = newName;
          stu.grade = updated.grade;
        }
      }
      for (const prof of this.healthProfiles) {
        if (prof.className === oldName) {
          prof.className = newName;
        }
      }
    }

    this.classes.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, 'vi', { numeric: true });
    });

    this.lastLocalStudentMutationAt = Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('thcs_dt_classes_updated_at', String(this.lastLocalStudentMutationAt));
    }
    this.saveAll(true);
    this.pushStateToServer();
    this.logAudit('Cập nhật lớp học', `Cập nhật thông tin lớp ${updated.name} - GVCN: ${updated.homeroomTeacher || 'Chưa phân công'}`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('schoolClasses', updated.id, updated, 'set');
    }

    return updated;
  }

  public deleteSchoolClass(id: string, reassignToClassId?: string): void {
    const target = this.classes.find((c) => c.id === id);
    if (!target) throw new Error('Lớp học không tồn tại.');

    const studentsInClass = this.students.filter((s) => s.className === target.name);
    const writes: BatchWriteOp[] = [];

    if (studentsInClass.length > 0) {
      if (reassignToClassId) {
        const destClass = this.classes.find((c) => c.id === reassignToClassId && c.id !== id);
        if (!destClass) throw new Error('Lớp chuyển đến không hợp lệ.');
        for (const stu of studentsInClass) {
          stu.className = destClass.name;
          stu.grade = destClass.grade;
          writes.push({ subcollection: 'students', docId: stu.id, data: stu, op: 'set' });
        }
      } else {
        // Unassign students
        for (const stu of studentsInClass) {
          stu.className = '';
          writes.push({ subcollection: 'students', docId: stu.id, data: stu, op: 'set' });
        }
      }
    }

    this.addDeletedClassIds([id, normalizeClassName(target.name)]);
    this.classes = this.classes.filter((c) => c.id !== id);
    writes.push({ subcollection: 'schoolClasses', docId: id, data: null, op: 'delete' });

    this.lastLocalStudentMutationAt = Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('thcs_dt_classes_updated_at', String(this.lastLocalStudentMutationAt));
    }
    this.saveAll(true);
    this.pushStateToServer();
    this.logAudit('Xóa lớp học', `Đã xóa lớp ${target.name} (Khối ${target.grade})`);
    this.notify();

    if (this.currentUserId && writes.length > 0) {
      this.persistBatch(writes);
    }
  }

  public deleteMultipleSchoolClasses(
    ids: string[],
    reassignToClassId?: string
  ): { deleted: number; reassignedStudents: number } {
    if (!ids || ids.length === 0) return { deleted: 0, reassignedStudents: 0 };
    const idSet = new Set(ids);
    const targets = this.classes.filter((c) => idSet.has(c.id));
    if (targets.length === 0) return { deleted: 0, reassignedStudents: 0 };

    const targetNames = new Set(targets.map((c) => c.name.toLowerCase()));
    let reassignedCount = 0;
    const writes: BatchWriteOp[] = [];

    const destClass = reassignToClassId ? this.classes.find((c) => c.id === reassignToClassId && !idSet.has(c.id)) : null;

    // Handle students in deleted classes
    for (const stu of this.students) {
      if (stu.className && targetNames.has(stu.className.toLowerCase())) {
        if (destClass) {
          stu.className = destClass.name;
          stu.grade = destClass.grade;
        } else {
          stu.className = '';
        }
        reassignedCount++;
        writes.push({ subcollection: 'students', docId: stu.id, data: stu, op: 'set' });
      }
    }

    // Delete classes
    this.addDeletedClassIds([
      ...ids,
      ...targets.map((t) => normalizeClassName(t.name)),
    ]);
    this.classes = this.classes.filter((c) => !idSet.has(c.id));
    for (const id of ids) {
      writes.push({ subcollection: 'schoolClasses', docId: id, data: null, op: 'delete' });
    }

    this.lastLocalStudentMutationAt = Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('thcs_dt_classes_updated_at', String(this.lastLocalStudentMutationAt));
    }
    this.saveAll(true);
    this.pushStateToServer();
    this.logAudit(
      'Xóa nhiều lớp học',
      `Đã xóa ${targets.length} lớp học: ${targets.map((t) => t.name).join(', ')}. ${reassignedCount > 0 ? `Chuyển ${reassignedCount} học sinh ${destClass ? `sang lớp ${destClass.name}` : 'về Chưa phân lớp'}.` : ''}`
    );
    this.notify();

    if (this.currentUserId && writes.length > 0) {
      this.persistBatch(writes);
    }

    return { deleted: targets.length, reassignedStudents: reassignedCount };
  }

  public cleanRedundantClasses(): { deletedCount: number; deletedNames: string[] } {
    const emptyOrInvalidClasses = this.classes.filter((c) => {
      const studentCount = this.students.filter((s) => s.className === c.name).length;
      if (studentCount > 0) return false;
      // If 0 students, is it an invalid name like "Khối 6" or a duplicate?
      if (isInvalidOrRedundantClassName(c.name)) return true;
      // Or is there another class with the same equivalence that has students or was added first?
      const betterClass = this.classes.find(
        (other) =>
          other.id !== c.id &&
          areClassesEquivalent(other.name, c.name) &&
          (this.students.filter((s) => s.className === other.name).length > 0 ||
            (Boolean(other.homeroomTeacher) && !c.homeroomTeacher))
      );
      if (betterClass) return true;
      return false;
    });

    if (emptyOrInvalidClasses.length === 0) {
      return { deletedCount: 0, deletedNames: [] };
    }

    const ids = emptyOrInvalidClasses.map((c) => c.id);
    const names = emptyOrInvalidClasses.map((c) => c.name);
    this.deleteMultipleSchoolClasses(ids);
    return { deletedCount: ids.length, deletedNames: names };
  }

  public batchUpdateTeachers(
    updates: { classId: string; homeroomTeacher: string; teacherPhone?: string; room?: string }[]
  ): number {
    let count = 0;
    const writes: BatchWriteOp[] = [];
    const nowIso = new Date().toISOString();

    for (const u of updates) {
      const idx = this.classes.findIndex((c) => c.id === u.classId);
      if (idx !== -1) {
        const cls = this.classes[idx];
        const updated: SchoolClass = {
          ...cls,
          homeroomTeacher: u.homeroomTeacher.trim(),
          teacherPhone: u.teacherPhone !== undefined ? u.teacherPhone.trim() : cls.teacherPhone,
          room: u.room !== undefined ? u.room.trim() : cls.room,
          updatedAt: nowIso,
        };
        this.classes[idx] = updated;
        writes.push({ subcollection: 'schoolClasses', docId: updated.id, data: updated, op: 'set' });
        count++;
      }
    }

    if (count > 0) {
      this.lastLocalStudentMutationAt = Date.now();
      if (typeof window !== 'undefined') {
        localStorage.setItem('thcs_dt_classes_updated_at', String(this.lastLocalStudentMutationAt));
      }
      this.saveAll(true);
      this.pushStateToServer();
      this.logAudit('Cập nhật GVCN hàng loạt', `Cập nhật GVCN cho ${count} lớp học.`);
      this.notify();
      if (this.currentUserId && writes.length > 0) {
        this.persistBatch(writes);
        this.syncAllToCloud();
      }
    }

    return count;
  }

  public importClassesFromExcel(classesData: any[]): { added: number; updated: number; errors: string[] } {
    let added = 0;
    let updated = 0;
    const errors: string[] = [];
    const writes: BatchWriteOp[] = [];

    for (let i = 0; i < classesData.length; i++) {
      const row = classesData[i];
      const rowNum = i + 2;
      try {
        let rawName = String(
          row['Tên lớp'] ||
          row['Lớp'] ||
          row['Lớp học'] ||
          row['Mã lớp'] ||
          row['name'] ||
          row['className'] ||
          row['Lop'] ||
          row['TenLop'] ||
          ''
        ).trim();

        if (!rawName) {
          continue;
        }

        // Skip banner / title rows like "Khối 6", "Khối 7", "Toàn trường", "STT"
        if (isInvalidOrRedundantClassName(rawName)) {
          continue;
        }

        // Clean leading "Lớp " / "Lop " if present for standard naming (e.g., "6/1" instead of "Lớp 6/1")
        const cleanName = rawName.replace(/^lớp\s+/i, '').replace(/^lop\s+/i, '').trim() || rawName;

        const rawGrade = row['Khối'] || row['Khối lớp'] || row['grade'] || row['Khoi'] || '';
        let grade = Number(rawGrade);
        if (isNaN(grade) || grade < 1 || grade > 12) {
          const matchDigit = cleanName.match(/\b([1-9]|1[0-2])\b/) || cleanName.match(/(\d+)/);
          grade = matchDigit ? parseInt(matchDigit[1], 10) : 6;
        }

        // Support split name: Họ đệm + Tên
        const hoDem = String(row['Họ và tên lót'] || row['Họ đệm'] || row['Họ và đệm'] || row['Họ'] || '').trim();
        const ten = String(row['Tên'] || '').trim();
        const combinedSplitName = hoDem && ten ? `${hoDem} ${ten}` : '';

        const homeroomTeacher = String(
          row['Giáo viên chủ nhiệm (GVCN)'] ||
          row['Giáo viên chủ nhiệm'] ||
          row['GVCN'] ||
          row['Họ và tên GVCN'] ||
          row['Họ tên GVCN'] ||
          row['Tên GVCN'] ||
          row['Thầy/Cô chủ nhiệm'] ||
          row['Thầy/Cô'] ||
          row['Thầy cô'] ||
          row['Họ và tên GV'] ||
          row['Họ tên GV'] ||
          row['Tên GV'] ||
          row['Họ và tên'] ||
          row['Họ tên'] ||
          row['Giáo viên'] ||
          row['GV'] ||
          row['CBGV'] ||
          row['Phụ trách'] ||
          combinedSplitName ||
          row['homeroomTeacher'] ||
          row['teacherName'] ||
          row['GiaoVienChuNhiem'] ||
          row['HoTen'] ||
          ''
        ).trim();

        const teacherPhone = String(
          row['Số điện thoại GVCN'] ||
          row['SĐT GVCN'] ||
          row['SĐT'] ||
          row['Số điện thoại'] ||
          row['Điện thoại'] ||
          row['teacherPhone'] ||
          row['phone'] ||
          row['mobile'] ||
          row['tel'] ||
          row['DienThoaiGVCN'] ||
          row['DienThoai'] ||
          row['SDT'] ||
          ''
        ).trim();

        const room = String(
          row['Phòng học'] ||
          row['Phòng'] ||
          row['Vị trí'] ||
          row['room'] ||
          row['classroom'] ||
          row['PhongHoc'] ||
          row['Phong'] ||
          ''
        ).trim();

        // Smart matching: direct, normalized, or equivalent (e.g. 6/1 vs 6A1 vs 6.1 vs 61)
        const existingIdx = this.classes.findIndex(
          (c) =>
            (row.id && c.id === row.id) ||
            c.name.toLowerCase() === rawName.toLowerCase() ||
            c.name.toLowerCase() === cleanName.toLowerCase() ||
            normalizeClassName(c.name) === normalizeClassName(cleanName) ||
            areClassesEquivalent(c.name, cleanName) ||
            areClassesEquivalent(c.name, rawName)
        );

        const nowIso = new Date().toISOString();
        if (existingIdx !== -1) {
          const existing = this.classes[existingIdx];
          const updatedCls: SchoolClass = {
            ...existing,
            grade: grade || existing.grade,
            homeroomTeacher: homeroomTeacher !== '' ? homeroomTeacher : existing.homeroomTeacher || '',
            teacherPhone: teacherPhone !== '' ? teacherPhone : existing.teacherPhone || '',
            room: room !== '' ? room : existing.room || '',
            updatedAt: nowIso,
          };
          this.classes[existingIdx] = updatedCls;
          this.removeDeletedClassIds([existing.id, normalizeClassName(existing.name)]);
          writes.push({ subcollection: 'schoolClasses', docId: existing.id, data: updatedCls, op: 'set' });
          updated++;
        } else {
          const newCls: SchoolClass = {
            id: `cls-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${i}`,
            name: cleanName,
            grade,
            homeroomTeacher: homeroomTeacher || '',
            teacherPhone: teacherPhone || '',
            room: room || '',
            totalStudents: 0,
            userId: this.currentUserId || undefined,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          this.classes.push(newCls);
          this.removeDeletedClassIds([newCls.id, normalizeClassName(cleanName)]);
          writes.push({ subcollection: 'schoolClasses', docId: newCls.id, data: newCls, op: 'set' });
          added++;
        }
      } catch (err: any) {
        errors.push(`Dòng ${rowNum}: ${err.message || 'Lỗi không xác định'}`);
      }
    }

    if (added > 0 || updated > 0) {
      this.classes.sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        return a.name.localeCompare(b.name, 'vi', { numeric: true });
      });
      this.lastLocalStudentMutationAt = Date.now();
      if (typeof window !== 'undefined') {
        localStorage.setItem('thcs_dt_classes_updated_at', String(this.lastLocalStudentMutationAt));
      }
      this.saveAll(true);
      this.pushStateToServer();
      this.logAudit(
        'Import GVCN theo lớp',
        `Nhập danh sách GVCN theo lớp: Thêm mới ${added} lớp, cập nhật GVCN cho ${updated} lớp.`
      );
      this.notify();
      if (this.currentUserId && writes.length > 0) {
        this.persistBatch(writes);
        this.syncAllToCloud();
      }
    }

    return { added, updated, errors };
  }

  public getSchoolYears(): string[] {
    return ['2026-2027', '2025-2026', '2024-2025'];
  }

  // --- Clinic Visits Management (Sổ tiếp nhận & Theo dõi phòng y tế) ---
  private normalizeClinicVisit(v: ClinicVisit): ClinicVisit {
    const dateTime =
      v.dateTime ||
      (v.visitDate ? `${v.visitDate}T${v.timeIn || '08:00'}:00` : new Date().toISOString());
    const reason =
      v.reason ||
      (v.reasons && v.reasons.length > 0 ? v.reasons.join(', ') : v.customReason || '');
    const treatment = v.treatment || v.treatmentDetails || v.treatmentType || '';
    const medicinesDispensed = v.medicinesDispensed || v.medicinesUsed || [];
    const temperature = v.temperature !== undefined ? v.temperature : v.vitals?.temperature;
    const pulse = v.pulse !== undefined ? v.pulse : v.vitals?.pulse;
    const bloodPressure = v.bloodPressure || v.vitals?.bloodPressure;
    const performer = v.performer || 'Cán bộ Y tế';
    return {
      ...v,
      dateTime,
      reason,
      treatment,
      medicinesDispensed,
      temperature,
      pulse,
      bloodPressure,
      performer,
    };
  }

  public getClinicVisits(filters?: {
    date?: string;
    className?: string;
    studentId?: string;
    reason?: string;
    month?: string;
  }): ClinicVisit[] {
    const deletedVisitSet = new Set(this.getDeletedVisitIds());
    if (deletedVisitSet.size > 0) {
      this.clinicVisits = this.clinicVisits.filter(
        (v) => !deletedVisitSet.has(v.id)
      );
    }
    this.recoverOrphanedClinicVisitsFromTransactions();
    this.cachedNormalizedVisits = this.clinicVisits.map((v) => this.normalizeClinicVisit(v));
    if (!filters || (!filters.date && !filters.month && (!filters.className || filters.className === 'all') && !filters.studentId && (!filters.reason || filters.reason === 'all'))) {
      return this.cachedNormalizedVisits;
    }
    let result = this.cachedNormalizedVisits;
    if (filters?.date) {
      result = result.filter((v) => v.visitDate === filters.date);
    }
    if (filters?.month) {
      result = result.filter((v) => v.visitDate.startsWith(filters.month!));
    }
    if (filters?.className && filters.className !== 'all') {
      result = result.filter((v) => v.className === filters.className);
    }
    if (filters?.studentId) {
      result = result.filter((v) => v.studentId === filters.studentId);
    }
    if (filters?.reason && filters.reason !== 'all') {
      result = result.filter(
        (v) => (v.reasons && v.reasons.includes(filters.reason!)) || v.reason?.includes(filters.reason!)
      );
    }
    return result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  /**
   * Reconstructs any clinic visit that had a completed medicine export transaction ("Cấp phát phòng y tế - Ca khám ...")
   * OR was recorded in auditLogs ("Tiếp nhận học sinh") if its ClinicVisit record was ever missing.
   */
  private recoverOrphanedClinicVisitsFromTransactions(): void {
    const deletedVisitSet = new Set(this.getDeletedVisitIds());
    let added = false;

    // 1. Recover from export transactions
    for (const tx of this.transactions) {
      if (!tx || tx.type !== 'export' || tx.status === 'cancelled' || tx.isDemo) continue;
      const purpose = tx.purpose || '';
      if (!purpose.includes('Ca khám')) continue;

      const recNameNorm = (tx.recipientName || '').trim().toLowerCase();
      const txDate = (tx.date || '').trim();
      if (!recNameNorm || !txDate) continue;

      const recoveredId = `vis-rec-${tx.id}`;
      if (deletedVisitSet.has(recoveredId) || deletedVisitSet.has(tx.id)) {
        continue;
      }

      const txMs = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
      const alreadyExists = this.clinicVisits.some((v) => {
        if (v.inventoryTransactionId === tx.id || v.id === recoveredId) return true;
        if (
          (v.studentName || '').trim().toLowerCase() === recNameNorm &&
          (v.visitDate || '').trim() === txDate
        ) {
          const vMs = v.createdAt ? new Date(v.createdAt).getTime() : 0;
          if (txMs > 0 && vMs > 0 && Math.abs(txMs - vMs) <= 120000) return true;
          if (!v.inventoryTransactionId) return true;
        }
        return false;
      });
      if (alreadyExists) continue;

      const codeMatch = purpose.match(/KB-\d{4}-\d+/);
      const reasonMatch = purpose.match(/\(([^)]+)\)/);
      const visitCode = codeMatch ? codeMatch[0] : this.generateNextVisitCode();
      const reasonStr = reasonMatch ? reasonMatch[1] : 'Khám & cấp phát thuốc';

      const notes = tx.notes || '';
      const condMatch = notes.match(/Tình trạng ban đầu:\s*([^.]+)/i);
      const treatMatch = notes.match(/Xử trí:\s*(.+)$/i);
      const initialCondition = condMatch ? condMatch[1].trim() : reasonStr;
      const treatmentDetails = treatMatch ? treatMatch[1].trim() : 'Cấp phát thuốc & theo dõi tại phòng y tế';

      const matchedStudent = this.students.find(
        (s) => (s.fullName || '').trim().toLowerCase() === recNameNorm
      );

      const createdDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
      let timeInStr = '08:30';
      if (!isNaN(createdDate.getTime())) {
        try {
          const vnParts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(createdDate);
          if (/^\d{2}:\d{2}$/.test(vnParts)) timeInStr = vnParts;
        } catch {
          timeInStr = `${String(createdDate.getHours()).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
        }
      }

      const medsUsed: ClinicVisitMedicineUsage[] = (tx.items || []).map((it) => ({
        medicineId: it.medicineId,
        medicineCode: it.medicineCode || '',
        medicineName: it.medicineName,
        batchId: it.batchId || '',
        batchNumber: it.batchNumber || '',
        expDate: it.expDate || '',
        quantity: it.quantity,
        unit: it.unit || 'Viên',
        unitPrice: it.unitPrice || 0,
        dosageInstructions: 'Theo chỉ định của cán bộ y tế',
      }));

      const recoveredVisit: ClinicVisit = {
        id: recoveredId,
        visitCode,
        studentId: matchedStudent?.id || '',
        studentCode: matchedStudent?.studentCode || '',
        studentName: tx.recipientName,
        className: tx.recipientClass || matchedStudent?.className || '',
        visitDate: txDate,
        timeIn: timeInStr,
        dateTime: `${txDate}T${timeInStr}:00`,
        broughtBy: 'Tự đến',
        reasons: [reasonStr],
        reason: reasonStr,
        initialCondition,
        vitals: { temperature: 37 },
        treatmentType: treatmentDetails,
        treatmentDetails,
        treatment: treatmentDetails,
        medicinesUsed: medsUsed,
        medicinesDispensed: medsUsed,
        suppliesUsed: [],
        outcome: 'Đã ổn định cho về lớp',
        parentContacted: false,
        isTransferred: false,
        performer: tx.performer || 'Nhân viên Y tế',
        inventoryTransactionId: tx.id,
        createdAt: tx.createdAt || new Date().toISOString(),
      };

      this.clinicVisits.unshift(recoveredVisit);
      added = true;
    }

    // 2. Recover any non-deleted clinic visit recorded in auditLogs ("Tiếp nhận học sinh") that was previously filtered out
    for (const log of this.auditLogs || []) {
      if (!log || log.action !== 'Tiếp nhận học sinh' || !log.details || log.id.startsWith('log-0')) continue;
      const recAuditId = `vis-aud-${log.id}`;
      if (deletedVisitSet.has(recAuditId)) continue;

      const m = log.details.match(/Đã ghi nhận ca khám\s+(KB-\d{4}-\d+)\s+cho học sinh\s+(.+?)\s*\(([^)]+)\)\.\s*Lý do:\s*(.+)$/i);
      if (!m) continue;
      const [, rawCode, rawName, rawClass, rawReasons] = m;
      const stuName = rawName.trim();
      const stuNameNorm = stuName.toLowerCase();
      const clsName = rawClass.trim();
      const logTimeMs = log.timestamp ? new Date(log.timestamp).getTime() : 0;

      // Skip if there is a subsequent "Xóa ca khám" audit log for this student
      const wasDeletedLater = (this.auditLogs || []).some((other) => {
        if (!other || other.action !== 'Xóa ca khám' || !other.details) return false;
        const otherMs = other.timestamp ? new Date(other.timestamp).getTime() : 0;
        return (
          otherMs >= logTimeMs &&
          other.details.toLowerCase().includes(stuNameNorm) &&
          other.details.includes(rawCode)
        );
      });
      if (wasDeletedLater) continue;

      // Skip if visit already exists in clinicVisits around that time or for that student today
      let visitDateIso = getCurrentDateISO();
      let timeInStr = '08:00';
      if (logTimeMs > 0) {
        try {
          const dObj = new Date(logTimeMs);
          visitDateIso = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Ho_Chi_Minh',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(dObj);
          timeInStr = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(dObj);
        } catch {
          // ignore
        }
      }

      const alreadyInVisits = this.clinicVisits.some((v) => {
        if (v.id === recAuditId) return true;
        if ((v.studentName || '').trim().toLowerCase() !== stuNameNorm) return false;
        const vMs = v.createdAt ? new Date(v.createdAt).getTime() : 0;
        if (logTimeMs > 0 && vMs > 0 && Math.abs(logTimeMs - vMs) <= 10 * 60 * 1000) return true;
        if ((v.visitDate || '').trim() === visitDateIso && v.visitCode === rawCode) return true;
        return false;
      });
      if (alreadyInVisits) continue;

      const matchedStudent = this.students.find(
        (s) => (s.fullName || '').trim().toLowerCase() === stuNameNorm
      );
      const reasonsArr = rawReasons
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      const recoveredFromAudit: ClinicVisit = {
        id: recAuditId,
        visitCode: rawCode,
        studentId: matchedStudent?.id || '',
        studentCode: matchedStudent?.studentCode || '',
        studentName: stuName,
        className: clsName || matchedStudent?.className || '',
        visitDate: visitDateIso,
        timeIn: timeInStr,
        dateTime: `${visitDateIso}T${timeInStr}:00`,
        broughtBy: 'Tự đến',
        reasons: reasonsArr.length > 0 ? reasonsArr : ['Khám sức khỏe'],
        reason: rawReasons.trim(),
        initialCondition: rawReasons.trim(),
        vitals: { temperature: 37 },
        treatmentType: 'Nghỉ ngơi, theo dõi tại phòng y tế',
        treatmentDetails: 'Nghỉ ngơi, theo dõi tại phòng y tế',
        treatment: 'Nghỉ ngơi, theo dõi tại phòng y tế',
        medicinesUsed: [],
        medicinesDispensed: [],
        suppliesUsed: [],
        outcome: 'Đã ổn định cho về lớp',
        parentContacted: false,
        isTransferred: false,
        performer: (log as any).userName || (log as any).user || 'Nhân viên Y tế',
        createdAt: log.timestamp || new Date().toISOString(),
      };

      this.clinicVisits.unshift(recoveredFromAudit);
      added = true;
    }

    if (added) {
      this.clinicVisits.sort(
        (a, b) =>
          (new Date(b.createdAt || `${b.visitDate}T${b.timeIn || '00:00'}`).getTime() || 0) -
          (new Date(a.createdAt || `${a.visitDate}T${a.timeIn || '00:00'}`).getTime() || 0)
      );
      this.safeSetLocalStorage(STORAGE_KEYS.CLINIC_VISITS, JSON.stringify(this.clinicVisits));
      this.saveOperationalBundleLocally();
      this.scheduleServerPush();
    }
  }

  /**
   * Returns all clinic visits for "Today" based strictly on the actual date
   * (Vietnam GMT+7 date or local date), reflecting the real number of cases today without fallback.
   */
  public getTodayClinicVisits(): ClinicVisit[] {
    const allVisits = this.getClinicVisits();
    if (allVisits.length === 0) return [];

    const vnToday = getCurrentDateISO();
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayCandidates = new Set([vnToday, localToday]);

    return allVisits.filter((v) => {
      const rawDate = (v.visitDate || (v.dateTime ? v.dateTime.split('T')[0] : '')).trim();
      if (!rawDate) return false;
      const isoDate = normalizeDateToISO(rawDate) || rawDate;
      return todayCandidates.has(isoDate) || todayCandidates.has(rawDate);
    });
  }

  public isVisitToday(visit: ClinicVisit): boolean {
    if (!visit) return false;
    const vnToday = getCurrentDateISO();
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayCandidates = new Set([vnToday, localToday]);

    const rawDate = (visit.visitDate || (visit.dateTime ? visit.dateTime.split('T')[0] : '')).trim();
    if (!rawDate) return false;
    const isoDate = normalizeDateToISO(rawDate) || rawDate;
    return todayCandidates.has(isoDate) || todayCandidates.has(rawDate);
  }

  public getClinicVisitById(id: string): ClinicVisit | undefined {
    const found = this.clinicVisits.find((v) => v.id === id);
    return found ? this.normalizeClinicVisit(found) : undefined;
  }

  public generateNextVisitCode(): string {
    const year = new Date().getFullYear();
    const prefix = `KB-${year}-`;
    let maxSeq = 0;
    const checkCode = (code?: string) => {
      if (!code || !code.startsWith(prefix)) return;
      const parts = code.split('-');
      if (parts.length >= 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    };
    for (const v of this.clinicVisits) {
      checkCode(v?.visitCode);
    }
    for (const tx of this.transactions) {
      const m = (tx?.purpose || '').match(/KB-\d{4}-\d+/);
      if (m) checkCode(m[0]);
    }
    for (const log of this.auditLogs || []) {
      const m = (log?.details || '').match(/KB-\d{4}-\d+/);
      if (m) checkCode(m[0]);
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  /**
   * Preview FEFO allocation for a medicine without modifying database
   */
  public previewFEFOForMedicine(
    medicineId: string,
    requestedQuantity: number
  ): { batch: MedicineBatch; quantity: number }[] {
    if (requestedQuantity <= 0) return [];
    const validBatches = this.batches
      .filter((b) => b.medicineId === medicineId && b.quantity > 0 && getDaysRemaining(b.expDate) >= 0)
      .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());

    const allocation: { batch: MedicineBatch; quantity: number }[] = [];
    let needed = requestedQuantity;

    for (const b of validBatches) {
      if (needed <= 0) break;
      const take = Math.min(b.quantity, needed);
      allocation.push({ batch: b, quantity: take });
      needed -= take;
    }

    if (needed > 0) {
      throw new Error(
        `Không đủ tồn kho khả dụng (chưa hết hạn) cho thuốc này. Còn thiếu ${needed} đơn vị.`
      );
    }
    return allocation;
  }

  /**
   * Add a new clinic visit.
   * If medicines are specified, it automatically exports them from inventory using FEFO,
   * creates an InventoryTransaction, and links the transactionId.
   * If supplies are specified, it deducts the supply stocks.
   */
  public addClinicVisit(
    payload: Omit<ClinicVisit, 'id' | 'visitCode' | 'createdAt' | 'inventoryTransactionId'> & {
      visitCode?: string;
    }
  ): ClinicVisit {
    const isStaff =
      payload.recipientType === 'teacher' ||
      payload.recipientType === 'staff' ||
      !!(payload as any).staffId;

    let student = !isStaff && payload.studentId ? this.getStudentById(payload.studentId) : undefined;
    let staffMember = isStaff && (payload as any).staffId ? this.getStaffMemberById((payload as any).staffId) : undefined;

    let recipientName = payload.studentName;
    let recipientClass = payload.className;

    if (isStaff) {
      recipientName = (payload as any).staffName || staffMember?.fullName || payload.studentName || 'Cán bộ / Giáo viên';
      recipientClass = (payload as any).department || staffMember?.department || payload.className || 'Tổ chuyên môn';
    } else {
      if (!student) {
        throw new Error(`Không tìm thấy học sinh với ID: ${payload.studentId}`);
      }
      recipientName = student.fullName;
      recipientClass = student.className;
    }

    if (!payload.reasons || payload.reasons.length === 0) {
      throw new Error('Vui lòng chọn ít nhất một lý do đến phòng y tế.');
    }
    if (!payload.treatmentDetails?.trim()) {
      throw new Error('Nội dung xử trí không được để trống.');
    }

    const visitCode = payload.visitCode || this.generateNextVisitCode();
    let inventoryTxId: string | undefined = undefined;

    // 1. Process Medication Usage: Must deduct via InventoryTransaction with FEFO
    const finalMedicinesUsed: ClinicVisitMedicineUsage[] = [];
    if (payload.medicinesUsed && payload.medicinesUsed.length > 0) {
      const itemsToExport: { medicineId: string; batchId?: string; quantity: number }[] = [];

      for (const m of payload.medicinesUsed) {
        if (m.quantity <= 0) continue;
        itemsToExport.push({
          medicineId: m.medicineId,
          batchId: m.batchId,
          quantity: m.quantity,
        });
      }

      if (itemsToExport.length > 0) {
        // Execute inventory export transaction
        const exportTx = this.exportMedicineTransaction({
          date: payload.visitDate,
          recipientName,
          recipientType: isStaff ? (payload.recipientType || staffMember?.roleCategory || 'teacher') : 'student',
          recipientClass,
          purpose: `Cấp phát phòng y tế - Ca khám ${visitCode} (${payload.reasons.join(', ')})`,
          performer: payload.performer || this.currentUser.fullName,
          notes: `Tình trạng ban đầu: ${payload.initialCondition}. Xử trí: ${payload.treatmentDetails}`,
          items: itemsToExport,
        });

        inventoryTxId = exportTx.id;

        // Map the allocated batches from the transaction items to medicinesUsed
        for (const item of exportTx.items) {
          const originalReq = payload.medicinesUsed.find((m) => m.medicineId === item.medicineId);
          finalMedicinesUsed.push({
            medicineId: item.medicineId,
            medicineCode: item.medicineCode,
            medicineName: item.medicineName,
            batchId: item.batchId,
            batchNumber: item.batchNumber,
            expDate: item.expDate || '',
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            dosageInstructions: originalReq?.dosageInstructions || 'Theo chỉ định của cán bộ y tế',
          });
        }
      }
    }

    // 2. Process Medical Supplies Usage: Deduct from supplies stock
    const finalSuppliesUsed: ClinicVisitSupplyUsage[] = [];
    if (payload.suppliesUsed && payload.suppliesUsed.length > 0) {
      for (const s of payload.suppliesUsed) {
        if (s.quantity <= 0) continue;
        const sup = this.supplies.find((item) => item.id === s.supplyId);
        if (!sup) throw new Error(`Không tìm thấy vật tư y tế ID: ${s.supplyId}`);
        if (sup.quantity < s.quantity) {
          throw new Error(`Vật tư "${sup.name}" chỉ còn ${sup.quantity} ${sup.unit}, không đủ để cấp ${s.quantity}.`);
        }
        sup.quantity -= s.quantity;
        finalSuppliesUsed.push({
          supplyId: sup.id,
          supplyCode: sup.code,
          supplyName: sup.name,
          quantity: s.quantity,
          unit: sup.unit,
        });
      }
    }

    // 3. Create Clinic Visit Record
    const now = new Date().toISOString();
    const finalReason = payload.reason || (payload.reasons && payload.reasons.length > 0 ? payload.reasons.join(', ') : '');
    const finalTreatment = payload.treatment || payload.treatmentDetails || payload.treatmentType || '';

    const newVisit: ClinicVisit = {
      ...payload,
      id: `vis-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      visitCode,
      recipientType: isStaff ? (payload.recipientType || staffMember?.roleCategory || 'teacher') : 'student',
      studentId: isStaff ? ((payload as any).staffId || payload.studentId || `staff-${Date.now()}`) : payload.studentId,
      studentCode: isStaff ? ((payload as any).staffCode || staffMember?.staffCode || payload.studentCode || 'GV/NV') : payload.studentCode,
      studentName: recipientName,
      className: recipientClass,
      staffId: (payload as any).staffId,
      staffCode: (payload as any).staffCode || staffMember?.staffCode,
      staffName: (payload as any).staffName || (isStaff ? recipientName : undefined),
      department: (payload as any).department || (isStaff ? recipientClass : undefined),
      position: (payload as any).position || staffMember?.position,
      gender: (payload as any).gender || staffMember?.gender,
      reason: finalReason,
      treatment: finalTreatment,
      medicinesUsed: finalMedicinesUsed,
      medicinesDispensed: finalMedicinesUsed,
      suppliesUsed: finalSuppliesUsed,
      inventoryTransactionId: inventoryTxId,
      createdAt: now,
    };

    this.clinicVisits.unshift(newVisit);
    this.lastInventoryMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_last_inventory_mutation_at', String(this.lastInventoryMutationAt));
    } catch {
      // ignore
    }

    // 4. If vitals provided and this is a student, optionally update student health profile
    let updatedProfile: StudentHealthProfile | undefined;
    if (!isStaff && student && (payload.vitals?.weight || payload.vitals?.height)) {
      const p = this.getStudentHealthProfile(student.id);
      if (p) {
        const height = payload.vitals.height || p.height;
        const weight = payload.vitals.weight || p.weight;
        let bmi = p.bmi;
        if (height && weight && height > 0) {
          const hM = height / 100;
          bmi = parseFloat((weight / (hM * hM)).toFixed(1));
        }
        updatedProfile = this.updateStudentHealthProfile(student.id, { height, weight, bmi });
      }
    }

    this.saveAll();
    this.pushClinicVisitToServer('upsert', newVisit, newVisit.id, updatedProfile);
    this.logAudit(
      isStaff ? 'Cấp thuốc Giáo viên & CNV' : 'Tiếp nhận học sinh',
      `Đã ghi nhận ca khám ${newVisit.visitCode} cho ${isStaff ? 'cán bộ/GV' : 'học sinh'} ${newVisit.studentName} (${newVisit.className}). Lý do: ${newVisit.reasons.join(', ')}`
    );
    this.notify();

    if (this.currentUserId) {
      this.persistItem('clinicVisits', newVisit.id, newVisit, 'set');
    }

    return newVisit;
  }

  public updateClinicVisit(id: string, updates: Partial<ClinicVisit>): ClinicVisit {
    const idx = this.clinicVisits.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error(`Không tìm thấy lượt khám ID: ${id}`);
    this.clinicVisits[idx] = {
      ...this.clinicVisits[idx],
      ...updates,
    };
    this.saveAll();
    this.pushClinicVisitToServer('upsert', this.clinicVisits[idx], id);
    this.logAudit('Cập nhật ca khám', `Cập nhật ca khám ${this.clinicVisits[idx].visitCode}`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('clinicVisits', id, this.clinicVisits[idx], 'set');
    }

    return this.clinicVisits[idx];
  }

  public deleteClinicVisit(id: string): void {
    const idx = this.clinicVisits.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error('Không tìm thấy ca khám cần xóa.');
    const visit = this.clinicVisits[idx];

    this.addDeletedVisitId(id);

    // Find associated inventory transaction (either by ID or by visitCode in purpose)
    const linkedTxId =
      visit.inventoryTransactionId ||
      this.transactions.find(
        (t) =>
          t.type === 'export' &&
          t.status !== 'cancelled' &&
          visit.visitCode &&
          (t.purpose || '').includes(visit.visitCode)
      )?.id;

    if (linkedTxId) {
      this.addDeletedVisitId(`vis-rec-${linkedTxId}`);
      this.addDeletedVisitId(linkedTxId);
      try {
        this.cancelTransaction(linkedTxId, `Hủy do xóa ca khám ${visit.visitCode}`);
      } catch (err) {
        console.warn('Could not auto cancel linked inventory transaction', err);
      }
    }

    // Restore medical supplies stock if supplies were used in this clinic visit
    if (visit.suppliesUsed && visit.suppliesUsed.length > 0) {
      for (const s of visit.suppliesUsed) {
        if (!s || s.quantity <= 0) continue;
        const sup = this.supplies.find(
          (item) => item.id === s.supplyId || item.code === s.supplyCode
        );
        if (sup) {
          sup.quantity += s.quantity;
        }
      }
    }

    this.clinicVisits.splice(idx, 1);
    this.cachedNormalizedVisits = null;
    this.lastInventoryMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_last_inventory_mutation_at', String(this.lastInventoryMutationAt));
    } catch {
      // ignore
    }
    this.saveAll();
    this.pushClinicVisitToServer('delete', undefined, id);
    this.logAudit('Xóa ca khám', `Đã xóa ca khám ${visit.visitCode} của học sinh ${visit.studentName} và hoàn trả tồn kho`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('clinicVisits', id, null, 'delete');
    }
  }

  // --- School Staff & Teacher Health Management ---
  public getStaffMembers(): SchoolStaff[] {
    return [...this.staffMembers];
  }

  public getStaffMemberById(id: string): SchoolStaff | undefined {
    return this.staffMembers.find((s) => s.id === id);
  }

  public addStaffMember(staff: Omit<SchoolStaff, 'id'>): SchoolStaff {
    const newStaff: SchoolStaff = {
      ...staff,
      id: `staff-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.staffMembers.push(newStaff);
    this.lastStaffMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_staff_updated_at', String(this.lastStaffMutationAt));
      localStorage.removeItem('thcs_dongthanh_staff_cleaned_v1');
    } catch {
      // ignore
    }
    this.saveAll();
    this.logAudit('Thêm nhân sự', `Thêm giáo viên / nhân viên: ${newStaff.fullName} (${newStaff.department})`);
    this.notify();
    this.pushStateToServer();
    fetch('/api/staff-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', staff: newStaff }),
    }).catch(() => {});
    return newStaff;
  }

  public updateStaffMember(id: string, updates: Partial<SchoolStaff>): SchoolStaff {
    const idx = this.staffMembers.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Không tìm thấy cán bộ/giáo viên ID: ${id}`);
    this.staffMembers[idx] = {
      ...this.staffMembers[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.lastStaffMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_staff_updated_at', String(this.lastStaffMutationAt));
      localStorage.removeItem('thcs_dongthanh_staff_cleaned_v1');
    } catch {
      // ignore
    }
    this.saveAll();
    this.logAudit('Cập nhật nhân sự', `Cập nhật thông tin: ${this.staffMembers[idx].fullName}`);
    this.notify();
    this.pushStateToServer();
    fetch('/api/staff-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, updates }),
    }).catch(() => {});
    return this.staffMembers[idx];
  }

  public deleteStaffMember(id: string): void {
    const target = this.staffMembers.find((s) => s.id === id);
    this.staffMembers = this.staffMembers.filter((s) => s.id !== id);
    this.addDeletedStaffIds([id]);
    this.lastStaffMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_staff_updated_at', String(this.lastStaffMutationAt));
    } catch {
      // ignore
    }
    this.saveAll();
    if (target) {
      this.logAudit('Xóa nhân sự', `Đã xóa cán bộ/giáo viên: ${target.fullName}`);
    }
    this.notify();
    this.pushStateToServer();
    fetch('/api/staff-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => {});
  }

  public deleteMultipleStaffMembers(ids: string[]): number {
    const idSet = new Set(ids);
    const initialCount = this.staffMembers.length;
    this.staffMembers = this.staffMembers.filter((s) => !idSet.has(s.id));
    const deletedCount = initialCount - this.staffMembers.length;
    this.addDeletedStaffIds(ids);
    this.lastStaffMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_staff_updated_at', String(this.lastStaffMutationAt));
    } catch {
      // ignore
    }
    this.saveAll();
    this.logAudit('Xóa nhân sự hàng loạt', `Đã xóa ${deletedCount} cán bộ/giáo viên`);
    this.notify();
    this.pushStateToServer();
    fetch('/api/staff-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_multiple', ids }),
    }).catch(() => {});
    return deletedCount;
  }

  public deleteAllStaffMembers(): number {
    const count = this.staffMembers.length;
    const oldIds = this.staffMembers.map((s) => s.id);
    this.addDeletedStaffIds(oldIds);
    this.staffMembers = [];
    this.lastStaffMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_staff_updated_at', String(this.lastStaffMutationAt));
      localStorage.setItem('thcs_dongthanh_staff_cleaned_v1', 'true');
    } catch {
      // ignore
    }
    this.saveAll();
    this.logAudit('Xóa toàn bộ nhân sự', `Đã xóa toàn bộ ${count} cán bộ, giáo viên trong danh bạ`);
    this.notify();
    this.pushStateToServer();
    fetch('/api/staff-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_all', oldIds }),
    }).catch(() => {});
    return count;
  }

  public importStaffMembersFromExcel(
    rows: any[],
    options: { replaceAll?: boolean } = {}
  ): { inserted: number; updated: number; errors: string[] } {
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return { inserted: 0, updated: 0, errors: ['Không có dữ liệu để nạp.'] };
    }

    if (options.replaceAll) {
      const oldIds = this.staffMembers.map((s) => s.id);
      this.addDeletedStaffIds(oldIds);
      this.staffMembers = [];
      this.lastStaffReplaceAll = true;
    }

    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // Extract full name
      const fullName = String(
        row['Họ và tên'] ||
        row['Họ tên'] ||
        row['Họ và tên giáo viên'] ||
        row['Họ và tên nhân sự'] ||
        row['Tên'] ||
        row['fullName'] ||
        row['name'] ||
        ''
      ).trim();

      if (!fullName || fullName.toLowerCase() === 'họ và tên') {
        continue;
      }

      // Extract staff code
      let staffCode = String(
        row['Mã GV/NV'] ||
        row['Mã GV'] ||
        row['Mã NV'] ||
        row['Mã nhân sự'] ||
        row['Mã cán bộ'] ||
        row['staffCode'] ||
        row['code'] ||
        ''
      ).trim().toUpperCase();

      // Department / Tổ bộ môn
      const department = String(
        row['Tổ chuyên môn / Phòng ban'] ||
        row['Tổ chuyên môn'] ||
        row['Tổ bộ môn'] ||
        row['Phòng ban'] ||
        row['Bộ phận'] ||
        row['Tổ'] ||
        row['department'] ||
        'Tổ Toán - Tin'
      ).trim();

      // Position / Chức vụ
      const position = String(
        row['Chức vụ'] ||
        row['Vị trí'] ||
        row['Nhiệm vụ'] ||
        row['Chức danh'] ||
        row['position'] ||
        'Giáo viên'
      ).trim();

      // Gender
      const rawGender = String(
        row['Giới tính'] ||
        row['Phái'] ||
        row['gender'] ||
        'Nữ'
      ).trim().toLowerCase();
      const gender: 'Nam' | 'Nữ' = rawGender === 'nam' || rawGender === 'm' || rawGender === '1' ? 'Nam' : 'Nữ';

      // Birth year
      let birthYear: number | undefined;
      const rawBirth = row['Năm sinh'] || row['Ngày sinh'] || row['birthYear'] || row['birthDate'];
      if (rawBirth) {
        const matchYear = String(rawBirth).match(/\b(19\d{2}|20\d{2})\b/);
        if (matchYear) {
          birthYear = parseInt(matchYear[1], 10);
        }
      }

      // Phone
      const phone = String(
        row['Số điện thoại'] ||
        row['Điện thoại'] ||
        row['SĐT'] ||
        row['phone'] ||
        row['mobile'] ||
        ''
      ).trim() || undefined;

      // Allergies
      const allergies = String(
        row['Tiền sử dị ứng'] ||
        row['Dị ứng'] ||
        row['allergies'] ||
        'Không'
      ).trim();

      // Chronic Conditions
      const chronicConditions = String(
        row['Bệnh nền / Cần lưu ý'] ||
        row['Bệnh nền'] ||
        row['Bệnh mãn tính'] ||
        row['chronicConditions'] ||
        'Không'
      ).trim();

      // Baseline BP
      const bloodPressureBaseline = String(
        row['Huyết áp nền'] ||
        row['Huyết áp'] ||
        row['bloodPressureBaseline'] ||
        '120/80'
      ).trim();

      // Notes
      const notes = String(
        row['Ghi chú'] ||
        row['Lưu ý'] ||
        row['notes'] ||
        ''
      ).trim() || undefined;

      const isTeacher = position.toLowerCase().includes('giáo viên') || department.toLowerCase().includes('tổ');
      const roleCategory: 'teacher' | 'staff' = isTeacher ? 'teacher' : 'staff';

      // Auto generate staff code if missing
      if (!staffCode) {
        const prefix = roleCategory === 'teacher' ? 'GV' : 'NV';
        const existingCount = this.staffMembers.filter((s) => s.staffCode.startsWith(prefix)).length;
        staffCode = `${prefix}${String(existingCount + inserted + 1).padStart(2, '0')}`;
      }

      // Check if exists by staffCode or by fullName + department
      const existingIdx = this.staffMembers.findIndex(
        (s) => s.staffCode.toUpperCase() === staffCode.toUpperCase() ||
          (s.fullName.toLowerCase() === fullName.toLowerCase() && s.department.toLowerCase() === department.toLowerCase())
      );

      if (existingIdx !== -1) {
        // Update existing staff
        this.staffMembers[existingIdx] = {
          ...this.staffMembers[existingIdx],
          staffCode,
          fullName,
          gender,
          birthYear: birthYear || this.staffMembers[existingIdx].birthYear,
          roleCategory,
          roleType: roleCategory,
          department,
          position,
          phone: phone || this.staffMembers[existingIdx].phone,
          allergies: allergies !== 'Không' ? allergies : this.staffMembers[existingIdx].allergies || 'Không',
          chronicConditions: chronicConditions !== 'Không' ? chronicConditions : this.staffMembers[existingIdx].chronicConditions || 'Không',
          bloodPressureBaseline: bloodPressureBaseline || this.staffMembers[existingIdx].bloodPressureBaseline || '120/80',
          notes: notes || this.staffMembers[existingIdx].notes,
          updatedAt: now,
        };
        updated++;
      } else {
        // Insert new staff
        const newStaff: SchoolStaff = {
          id: `staff-${Date.now()}-${i}-${Math.floor(100 + Math.random() * 900)}`,
          staffCode,
          fullName,
          gender,
          birthYear,
          roleCategory,
          roleType: roleCategory,
          department,
          position,
          phone,
          allergies: allergies || 'Không',
          chronicConditions: chronicConditions || 'Không',
          bloodPressureBaseline: bloodPressureBaseline || '120/80',
          notes,
          createdAt: now,
          updatedAt: now,
        };
        this.staffMembers.push(newStaff);
        inserted++;
      }
    }

    this.lastStaffMutationAt = Date.now();
    try {
      localStorage.setItem('thcs_dt_staff_updated_at', String(this.lastStaffMutationAt));
      localStorage.removeItem('thcs_dongthanh_staff_cleaned_v1');
    } catch {
      // ignore
    }
    this.saveAll();
    this.logAudit('Nạp danh sách GV & CNV từ Excel', `Đã thêm mới ${inserted} và cập nhật ${updated} cán bộ, giáo viên, nhân viên`);
    this.notify();
    this.pushStateToServer();
    fetch('/api/staff-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'import',
        staffMembers: this.staffMembers,
        replaceAll: Boolean(options.replaceAll),
      }),
    }).catch(() => {});

    return { inserted, updated, errors };
  }

  public async syncStaffToCloud(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      this.lastStaffMutationAt = Date.now();
      try {
        localStorage.setItem('thcs_dt_staff_updated_at', String(this.lastStaffMutationAt));
      } catch {}
      this.saveAll();
      const pushPromise = this.pushStateToServer();
      const directPromise = fetch('/api/staff-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          staffMembers: this.staffMembers,
          replaceAll: false,
        }),
      })
        .then((r) => r.json())
        .catch(() => null);

      await Promise.all([pushPromise, directPromise]);
      await this.pullFromServerAndMerge(true);
      return { success: true, count: this.staffMembers.length };
    } catch (err: any) {
      return { success: false, count: this.staffMembers.length, error: err?.message || 'Lỗi đồng bộ' };
    }
  }

  public getStaffClinicVisits(): ClinicVisit[] {
    return this.clinicVisits.filter(
      (v) => v.recipientType === 'teacher' || v.recipientType === 'staff' || !!v.staffId
    );
  }

  public deleteAllStaffClinicVisits(): number {
    const targets = this.getStaffClinicVisits();
    const count = targets.length;
    for (const v of targets) {
      try {
        this.deleteClinicVisit(v.id);
      } catch (e) {
        console.warn('Error deleting visit', v.id, e);
      }
    }
    this.logAudit('Xóa toàn bộ ca cấp thuốc GV', `Đã xóa toàn bộ ${count} ca cấp thuốc cán bộ/giáo viên`);
    return count;
  }

  public deleteMultipleClinicVisits(visitIds: string[]): number {
    let count = 0;
    for (const id of visitIds) {
      try {
        this.deleteClinicVisit(id);
        count++;
      } catch (e) {
        console.warn('Error deleting visit', id, e);
      }
    }
    return count;
  }

  public getStudentClinicVisits(): ClinicVisit[] {
    return this.clinicVisits.filter(
      (v) => v.recipientType !== 'teacher' && v.recipientType !== 'staff' && !v.staffId
    );
  }

  // --- Health Events (Sự kiện y tế / Tai nạn thương tích) ---
  public getHealthEvents(): HealthEvent[] {
    const deletedSet = new Set(this.getDeletedEventIds());
    if (deletedSet.size > 0 && this.healthEvents.some((e) => deletedSet.has(e.id))) {
      this.healthEvents = this.healthEvents.filter((e) => !deletedSet.has(e.id));
    }
    return [...this.healthEvents].sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  }

  public addHealthEvent(data: Omit<HealthEvent, 'id' | 'eventCode'>): HealthEvent {
    const year = new Date().getFullYear();
    const prefix = `SK-${year}-`;
    const yearEvents = this.healthEvents.filter((e) => e.eventCode.startsWith(prefix));
    const nextSeq = yearEvents.length + 1;
    const eventCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    const newEvent: HealthEvent = {
      ...data,
      id: `evt-${Date.now()}`,
      eventCode,
    };
    this.healthEvents.unshift(newEvent);
    this.saveAll();
    this.logAudit('Ghi nhận sự kiện y tế', `Ghi nhận sự kiện: ${newEvent.eventType} tại ${newEvent.location}`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('healthEvents', newEvent.id, newEvent, 'set');
    }

    return newEvent;
  }

  public updateHealthEvent(id: string, data: Partial<HealthEvent>): HealthEvent {
    const idx = this.healthEvents.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Không tìm thấy sự kiện y tế');
    const updated = {
      ...this.healthEvents[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.healthEvents[idx] = updated;
    this.saveAll();
    this.logAudit('Điều chỉnh sự kiện y tế', `Cập nhật sự kiện: ${updated.eventCode} (${updated.eventType})`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('healthEvents', id, updated, 'set');
    }
    return updated;
  }

  public deleteHealthEvent(id: string): boolean {
    const idx = this.healthEvents.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.addDeletedEventId(id);
    const removed = this.healthEvents.splice(idx, 1)[0];
    this.saveAll();
    this.logAudit('Xóa sự kiện y tế', `Đã xóa sự kiện y tế: ${removed.eventCode} (${removed.eventType})`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('healthEvents', id, null, 'delete');
    }
    return true;
  }

  public batchUpsertHealthEvents(eventsToUpsert: Partial<HealthEvent>[]): { inserted: number; updated: number } {
    let inserted = 0;
    let updated = 0;
    const writes: BatchWriteOp[] = [];

    for (const item of eventsToUpsert) {
      if (!item.dateTime && !item.eventType && !item.description) continue;

      // Check if existing by eventCode or id
      const existingIdx = this.healthEvents.findIndex(
        (e) => (item.eventCode && e.eventCode.toLowerCase() === item.eventCode.toLowerCase()) ||
               (item.id && e.id === item.id)
      );

      if (existingIdx !== -1) {
        const existing = this.healthEvents[existingIdx];
        const merged: HealthEvent = {
          ...existing,
          ...item,
          updatedAt: new Date().toISOString(),
        };
        this.healthEvents[existingIdx] = merged;
        updated++;
        writes.push({ subcollection: 'healthEvents', docId: merged.id, data: merged, op: 'set' });
      } else {
        const year = new Date().getFullYear();
        const prefix = `SK-${year}-`;
        const yearEvents = this.healthEvents.filter((e) => e.eventCode.startsWith(prefix));
        const nextSeq = yearEvents.length + 1;
        const eventCode = item.eventCode || `${prefix}${String(nextSeq).padStart(4, '0')}`;

        const newEvt: HealthEvent = {
          id: item.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          eventCode,
          dateTime: item.dateTime || new Date().toISOString(),
          location: item.location || 'Sân trường',
          eventType: (item.eventType as any) || 'Tai nạn',
          studentId: item.studentId,
          studentCode: item.studentCode,
          studentName: item.studentName,
          className: item.className,
          description: item.description || '',
          initialCondition: item.initialCondition || '',
          treatment: item.treatment || '',
          witness: item.witness || '',
          performer: item.performer || 'Y sĩ y tế học đường',
          outcome: item.outcome || 'Đã xử trí ban đầu',
          notes: item.notes || '',
          createdAt: item.createdAt || new Date().toISOString(),
        };
        this.healthEvents.unshift(newEvt);
        inserted++;
        writes.push({ subcollection: 'healthEvents', docId: newEvt.id, data: newEvt, op: 'set' });
      }
    }

    this.saveAll();
    this.logAudit('Nhập file sự kiện y tế', `Đã cập nhật ${updated} sự kiện, thêm mới ${inserted} sự kiện`);
    this.notify();

    if (this.currentUserId && writes.length > 0) {
      this.persistBatch(writes);
    }
    return { inserted, updated };
  }

  // --- Health Checkups (Khám sức khỏe định kỳ) ---
  public getHealthCheckups(filters?: { schoolYear?: string; className?: string; studentId?: string }): HealthCheckup[] {
    const deletedSet = new Set(this.getDeletedCheckupIds());
    if (deletedSet.size > 0 && this.healthCheckups.some((c) => deletedSet.has(c.id))) {
      this.healthCheckups = this.healthCheckups.filter((c) => !deletedSet.has(c.id));
    }
    let result = [...this.healthCheckups];
    if (filters?.schoolYear && filters.schoolYear !== 'all') {
      result = result.filter((c) => c.schoolYear === filters.schoolYear);
    }
    if (filters?.className && filters.className !== 'all') {
      result = result.filter((c) => c.className === filters.className);
    }
    if (filters?.studentId) {
      result = result.filter((c) => c.studentId === filters.studentId);
    }
    return result.sort((a, b) => (b.checkupDate || '').localeCompare(a.checkupDate || ''));
  }

  public addHealthCheckup(data: Omit<HealthCheckup, 'id' | 'checkupCode' | 'createdAt'>): HealthCheckup {
    const year = new Date().getFullYear();
    const prefix = `KS-${year}-`;
    const yearCheckups = this.healthCheckups.filter((c) => c.checkupCode.startsWith(prefix));
    const nextSeq = yearCheckups.length + 1;
    const checkupCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    const newCheckup: HealthCheckup = {
      ...data,
      id: `chk-${Date.now()}`,
      checkupCode,
      createdAt: new Date().toISOString(),
    };
    this.healthCheckups.unshift(newCheckup);

    // Sync back to student health profile
    const p = this.getStudentHealthProfile(data.studentId);
    if (p) {
      this.updateStudentHealthProfile(data.studentId, {
        height: data.height,
        weight: data.weight,
        bmi: data.bmi,
        visionLeft: data.eyesightLeft,
        visionRight: data.eyesightRight,
        dentalCondition: data.dentalCondition,
        specialAttention: data.hasRefraction || data.scoliosis || data.nutritionStatus !== 'Bình thường',
      });
    }

    this.saveAll();
    this.logAudit('Khám sức khỏe định kỳ', `Nhập kết quả khám sức khỏe cho học sinh: ${newCheckup.studentName}`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('healthCheckups', newCheckup.id, newCheckup, 'set');
    }

    return newCheckup;
  }

  public updateHealthCheckup(id: string, data: Partial<HealthCheckup>): HealthCheckup {
    const idx = this.healthCheckups.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Không tìm thấy phiếu khám sức khỏe');
    
    // Recalculate BMI if height or weight are updated
    let bmi = data.bmi ?? this.healthCheckups[idx].bmi;
    const h = data.height ?? this.healthCheckups[idx].height;
    const w = data.weight ?? this.healthCheckups[idx].weight;
    if (h && w && (!data.bmi || data.height || data.weight)) {
      bmi = parseFloat((w / Math.pow(h / 100, 2)).toFixed(1));
    }

    const updated: HealthCheckup = {
      ...this.healthCheckups[idx],
      ...data,
      bmi,
      updatedAt: new Date().toISOString(),
    };
    this.healthCheckups[idx] = updated;

    // Sync back to student health profile if student exists
    if (updated.studentId) {
      const p = this.getStudentHealthProfile(updated.studentId);
      if (p) {
        this.updateStudentHealthProfile(updated.studentId, {
          height: updated.height,
          weight: updated.weight,
          bmi: updated.bmi,
          visionLeft: updated.eyesightLeft,
          visionRight: updated.eyesightRight,
          dentalCondition: updated.dentalCondition,
          specialAttention: updated.hasRefraction || updated.scoliosis || updated.nutritionStatus !== 'Bình thường',
        });
      }
    }

    this.saveAll();
    this.logAudit('Điều chỉnh khám định kỳ', `Cập nhật phiếu khám: ${updated.checkupCode} (${updated.studentName})`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('healthCheckups', id, updated, 'set');
    }
    return updated;
  }

  public deleteHealthCheckup(id: string): boolean {
    const idx = this.healthCheckups.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.addDeletedCheckupId(id);
    const removed = this.healthCheckups.splice(idx, 1)[0];
    this.saveAll();
    this.logAudit('Xóa phiếu khám định kỳ', `Đã xóa phiếu khám: ${removed.checkupCode} của học sinh ${removed.studentName}`);
    this.notify();

    if (this.currentUserId) {
      this.persistItem('healthCheckups', id, null, 'delete');
    }
    return true;
  }

  public batchUpsertHealthCheckups(checkupsToUpsert: Partial<HealthCheckup>[]): { inserted: number; updated: number } {
    let inserted = 0;
    let updated = 0;
    const writes: BatchWriteOp[] = [];

    for (const item of checkupsToUpsert) {
      if (!item.studentName && !item.studentCode) continue;

      // Find student if studentId missing
      let student = item.studentId ? this.getStudentById(item.studentId) : undefined;
      if (!student && item.studentCode) {
        student = this.students.find((s) => s.studentCode.toLowerCase() === item.studentCode?.toLowerCase());
      }
      if (!student && item.studentName) {
        student = this.students.find((s) => s.fullName.toLowerCase() === item.studentName?.toLowerCase());
      }

      // Check if existing by checkupCode or (studentId + schoolYear)
      const existingIdx = this.healthCheckups.findIndex(
        (c) => (item.checkupCode && c.checkupCode.toLowerCase() === item.checkupCode.toLowerCase()) ||
               (item.id && c.id === item.id) ||
               (student && c.studentId === student.id && item.schoolYear && c.schoolYear === item.schoolYear)
      );

      const h = item.height || 150;
      const w = item.weight || 42;
      const bmi = item.bmi || parseFloat((w / Math.pow(h / 100, 2)).toFixed(1));

      if (existingIdx !== -1) {
        const existing = this.healthCheckups[existingIdx];
        const merged: HealthCheckup = {
          ...existing,
          ...item,
          studentId: student ? student.id : existing.studentId,
          studentName: student ? student.fullName : (item.studentName || existing.studentName),
          studentCode: student ? student.studentCode : (item.studentCode || existing.studentCode),
          className: student ? student.className : (item.className || existing.className),
          bmi,
          updatedAt: new Date().toISOString(),
        };
        this.healthCheckups[existingIdx] = merged;
        updated++;
        writes.push({ subcollection: 'healthCheckups', docId: merged.id, data: merged, op: 'set' });
      } else {
        const year = new Date().getFullYear();
        const prefix = `KS-${year}-`;
        const yearCheckups = this.healthCheckups.filter((c) => c.checkupCode.startsWith(prefix));
        const nextSeq = yearCheckups.length + 1;
        const checkupCode = item.checkupCode || `${prefix}${String(nextSeq).padStart(4, '0')}`;

        const newChk: HealthCheckup = {
          id: item.id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          checkupCode,
          checkupDate: item.checkupDate || new Date().toISOString().split('T')[0],
          schoolYear: item.schoolYear || '2026-2027',
          studentId: student ? student.id : (item.studentId || `stu-${Date.now()}`),
          studentCode: student ? student.studentCode : (item.studentCode || 'HS-UNKNOWN'),
          studentName: student ? student.fullName : (item.studentName || 'Học sinh'),
          className: student ? student.className : (item.className || 'Khối 6'),
          height: h,
          weight: w,
          bmi,
          pulse: item.pulse || 80,
          bloodPressure: item.bloodPressure || '105/70',
          eyesightLeft: item.eyesightLeft || '10/10',
          eyesightRight: item.eyesightRight || '10/10',
          hasRefraction: item.hasRefraction || false,
          dentalCondition: item.dentalCondition || 'Bình thường',
          entCondition: item.entCondition || 'Bình thường',
          scoliosis: item.scoliosis || false,
          nutritionStatus: (item.nutritionStatus as any) || 'Bình thường',
          recommendations: item.recommendations || 'Duy trì dinh dưỡng và vận động thể lực',
          doctorOrStaff: item.doctorOrStaff || 'Bs. Nguyễn Thanh Hà (TTYT Hóc Môn)',
          createdAt: item.createdAt || new Date().toISOString(),
        };
        this.healthCheckups.unshift(newChk);
        inserted++;
        writes.push({ subcollection: 'healthCheckups', docId: newChk.id, data: newChk, op: 'set' });
      }
    }

    this.saveAll();
    this.logAudit('Nhập file khám định kỳ', `Đã cập nhật ${updated} phiếu, thêm mới ${inserted} phiếu khám`);
    this.notify();

    if (this.currentUserId && writes.length > 0) {
      this.persistBatch(writes);
    }
    return { inserted, updated };
  }

  // --- Reverse Lookups & Cross-Module Queries ---
  public getStudentHistory(studentId: string): {
    student?: Student;
    profile?: StudentHealthProfile;
    visits: ClinicVisit[];
    medicinesTaken: {
      date: string;
      medicineName: string;
      batchNumber: string;
      quantity: number;
      unit: string;
      visitCode: string;
    }[];
    suppliesUsed: {
      date: string;
      supplyName: string;
      quantity: number;
      unit: string;
      visitCode: string;
    }[];
    checkups: HealthCheckup[];
  } {
    const student = this.getStudentById(studentId);
    const profile = this.getStudentHealthProfile(studentId);
    const visits = this.clinicVisits.filter((v) => v.studentId === studentId);
    const checkups = this.healthCheckups.filter((c) => c.studentId === studentId);

    const medicinesTaken: any[] = [];
    const suppliesUsed: any[] = [];

    for (const v of visits) {
      for (const m of v.medicinesUsed || []) {
        medicinesTaken.push({
          date: v.visitDate,
          medicineName: m.medicineName,
          batchNumber: m.batchNumber,
          quantity: m.quantity,
          unit: m.unit,
          visitCode: v.visitCode,
        });
      }
      for (const s of v.suppliesUsed || []) {
        suppliesUsed.push({
          date: v.visitDate,
          supplyName: s.supplyName,
          quantity: s.quantity,
          unit: s.unit,
          visitCode: v.visitCode,
        });
      }
    }

    return {
      student,
      profile,
      visits,
      medicinesTaken,
      suppliesUsed,
      checkups,
    };
  }

  public getMedicineUsageHistory(medicineId: string): {
    visits: {
      visitCode: string;
      visitDate: string;
      studentName: string;
      className: string;
      batchNumber: string;
      quantity: number;
      unit: string;
      reason: string;
    }[];
    totalQuantity: number;
  } {
    const rows: any[] = [];
    let totalQuantity = 0;

    for (const v of this.clinicVisits) {
      for (const m of v.medicinesUsed || []) {
        if (m.medicineId === medicineId) {
          totalQuantity += m.quantity;
          rows.push({
            visitCode: v.visitCode,
            visitDate: v.visitDate,
            studentName: v.studentName,
            className: v.className,
            batchNumber: m.batchNumber,
            quantity: m.quantity,
            unit: m.unit,
            reason: v.reasons.join(', '),
          });
        }
      }
    }

    return { visits: rows, totalQuantity };
  }

  public getBatchUsageHistory(batchNumber: string): {
    visits: {
      visitCode: string;
      visitDate: string;
      studentName: string;
      className: string;
      medicineName: string;
      quantity: number;
      unit: string;
      reason: string;
    }[];
    totalQuantity: number;
  } {
    const rows: any[] = [];
    let totalQuantity = 0;

    for (const v of this.clinicVisits) {
      for (const m of v.medicinesUsed || []) {
        if (m.batchNumber === batchNumber) {
          totalQuantity += m.quantity;
          rows.push({
            visitCode: v.visitCode,
            visitDate: v.visitDate,
            studentName: v.studentName,
            className: v.className,
            medicineName: m.medicineName,
            quantity: m.quantity,
            unit: m.unit,
            reason: v.reasons.join(', '),
          });
        }
      }
    }

    return { visits: rows, totalQuantity };
  }

  public getClassClinicStats(className: string): {
    totalVisits: number;
    totalStudents: number;
    studentsWithVisitsCount: number;
    topReasons: { reason: string; count: number }[];
    visits: ClinicVisit[];
  } {
    const classVisits = this.clinicVisits.filter((v) => v.className === className);
    const classStudents = this.students.filter((s) => s.className === className);

    const visitedStudentIds = new Set(classVisits.map((v) => v.studentId));

    const reasonCounts: Record<string, number> = {};
    for (const v of classVisits) {
      for (const r of v.reasons) {
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }

    const topReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalVisits: classVisits.length,
      totalStudents: classStudents.length,
      studentsWithVisitsCount: visitedStudentIds.size,
      topReasons,
      visits: classVisits,
    };
  }

  public getMonthlyClinicReport(monthStr: string): {
    month: string;
    totalVisits: number;
    outcomes: Record<string, number>;
    healthEventsCount: number;
    byReason: Record<string, number>;
    medicinesUsed: { medicineName: string; quantity: number; unit: string }[];
    visitsByGrade: Record<number, number>;
    visitsByClass: { className: string; count: number }[];
    commonReasons: { reason: string; count: number; percentage: number }[];
    commonTreatments: { treatment: string; count: number }[];
    emergencyTransfersCount: number;
    parentContactedCount: number;
    medicinesUsedSummary: {
      medicineName: string;
      batchNumber: string;
      quantity: number;
      unit: string;
    }[];
    suppliesUsedSummary: {
      supplyName: string;
      quantity: number;
      unit: string;
    }[];
    events: HealthEvent[];
  } {
    const monthVisits = this.clinicVisits.filter((v) => v.visitDate.startsWith(monthStr));

    const visitsByGrade: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 };
    const classMap: Record<string, number> = {};
    const reasonMap: Record<string, number> = {};
    const treatmentMap: Record<string, number> = {};
    const outcomes: Record<string, number> = {};
    let emergencyTransfersCount = 0;
    let parentContactedCount = 0;

    const medMap: Record<string, { medicineName: string; batchNumber: string; quantity: number; unit: string }> = {};
    const supMap: Record<string, { supplyName: string; quantity: number; unit: string }> = {};

    for (const v of monthVisits) {
      const student = this.getStudentById(v.studentId);
      if (student && student.grade) {
        visitsByGrade[student.grade] = (visitsByGrade[student.grade] || 0) + 1;
      }

      classMap[v.className] = (classMap[v.className] || 0) + 1;
      
      if (v.outcome) {
        outcomes[v.outcome] = (outcomes[v.outcome] || 0) + 1;
      }

      for (const r of v.reasons) {
        reasonMap[r] = (reasonMap[r] || 0) + 1;
      }

      if (v.treatmentType) {
        treatmentMap[v.treatmentType] = (treatmentMap[v.treatmentType] || 0) + 1;
      }

      if (v.isTransferred || v.outcome === 'Chuyển viện') {
        emergencyTransfersCount++;
      }
      if (v.parentContacted) {
        parentContactedCount++;
      }

      for (const m of v.medicinesUsed || []) {
        const key = `${m.medicineName}_${m.batchNumber}`;
        if (!medMap[key]) {
          medMap[key] = {
            medicineName: m.medicineName,
            batchNumber: m.batchNumber,
            quantity: 0,
            unit: m.unit,
          };
        }
        medMap[key].quantity += m.quantity;
      }

      for (const s of v.suppliesUsed || []) {
        if (!supMap[s.supplyName]) {
          supMap[s.supplyName] = {
            supplyName: s.supplyName,
            quantity: 0,
            unit: s.unit,
          };
        }
        supMap[s.supplyName].quantity += s.quantity;
      }
    }

    const totalReasons = Object.values(reasonMap).reduce((sum, c) => sum + c, 0) || 1;
    const commonReasons = Object.entries(reasonMap)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: parseFloat(((count / totalReasons) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    const visitsByClass = Object.entries(classMap)
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count);

    const commonTreatments = Object.entries(treatmentMap)
      .map(([treatment, count]) => ({ treatment, count }))
      .sort((a, b) => b.count - a.count);

    const events = this.healthEvents.filter((e) => e.dateTime.startsWith(monthStr));

    return {
      month: monthStr,
      totalVisits: monthVisits.length,
      outcomes,
      healthEventsCount: events.length,
      byReason: reasonMap,
      medicinesUsed: Object.values(medMap).map(m => ({
        medicineName: m.medicineName,
        quantity: m.quantity,
        unit: m.unit,
      })),
      visitsByGrade,
      visitsByClass,
      commonReasons,
      commonTreatments,
      emergencyTransfersCount,
      parentContactedCount,
      medicinesUsedSummary: Object.values(medMap),
      suppliesUsedSummary: Object.values(supMap),
      events,
    };
  }

  // ==========================================
  // --- QUẢN LÝ TIÊU HỦY THUỐC HẾT HẠN (Disposal Protocols & Management) ---
  // ==========================================
  public getDisposals(): MedicineDisposal[] {
    return [...this.disposals].sort(
      (a, b) => new Date(b.disposalDate || b.createdAt).getTime() - new Date(a.disposalDate || a.createdAt).getTime()
    );
  }

  public getDisposalById(id: string): MedicineDisposal | undefined {
    return this.disposals.find((d) => d.id === id);
  }

  public getNextDisposalCode(): string {
    const year = new Date().getFullYear();
    const prefix = `BB-HUY-${year}-`;
    let maxSeq = 0;
    for (const d of this.disposals) {
      if (d.disposalCode && d.disposalCode.startsWith(prefix)) {
        const numPart = parseInt(d.disposalCode.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  public getExpiredBatchesWithDetails(): {
    batch: MedicineBatch;
    medicine: Medicine;
    daysExpired: number;
    valuation: number;
  }[] {
    const results: {
      batch: MedicineBatch;
      medicine: Medicine;
      daysExpired: number;
      valuation: number;
    }[] = [];

    for (const batch of this.batches) {
      if (batch.quantity > 0) {
        const daysRemaining = getDaysRemaining(batch.expDate);
        if (daysRemaining < 0) {
          const med = this.medicines.find((m) => m.id === batch.medicineId);
          if (med) {
            const unitPrice = batch.unitPrice || med.unitPrice || 0;
            results.push({
              batch,
              medicine: med,
              daysExpired: Math.abs(daysRemaining),
              valuation: batch.quantity * unitPrice,
            });
          }
        }
      }
    }

    return results.sort((a, b) => b.daysExpired - a.daysExpired);
  }

  public getNearExpiryBatchesWithDetails(daysThreshold = 30): {
    batch: MedicineBatch;
    medicine: Medicine;
    daysRemaining: number;
    valuation: number;
  }[] {
    const results: {
      batch: MedicineBatch;
      medicine: Medicine;
      daysRemaining: number;
      valuation: number;
    }[] = [];

    for (const batch of this.batches) {
      if (batch.quantity > 0) {
        const days = getDaysRemaining(batch.expDate);
        if (days >= 0 && days <= daysThreshold) {
          const med = this.medicines.find((m) => m.id === batch.medicineId);
          if (med) {
            const unitPrice = batch.unitPrice || med.unitPrice || 0;
            results.push({
              batch,
              medicine: med,
              daysRemaining: days,
              valuation: batch.quantity * unitPrice,
            });
          }
        }
      }
    }

    return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  public saveDisposal(payload: Partial<MedicineDisposal>): MedicineDisposal {
    const existingIdx = payload.id ? this.disposals.findIndex((d) => d.id === payload.id) : -1;
    const disposalCode = payload.disposalCode?.trim() || this.getNextDisposalCode();
    const now = new Date().toISOString();

    const totalQty = (payload.items || []).reduce((sum, item) => sum + (item.disposalQuantity || 0), 0);
    const totalAmount = (payload.items || []).reduce((sum, item) => sum + (item.totalAmount || 0), 0);

    const record: MedicineDisposal = {
      id: payload.id || 'disp-' + Date.now(),
      disposalCode,
      decisionNumber: payload.decisionNumber || '',
      decisionDate: payload.decisionDate || payload.disposalDate || now.split('T')[0],
      disposalDate: payload.disposalDate || now.split('T')[0],
      schoolYear: payload.schoolYear || '2025-2026',
      councilMembers: payload.councilMembers && payload.councilMembers.length > 0 ? payload.councilMembers : [
        {
          roleTitle: 'Chủ tịch hội đồng',
          name: 'Nguyễn Văn Hưng',
          position: 'Phó Hiệu Trưởng',
        },
        {
          roleTitle: 'Thư ký hội đồng',
          name: this.currentUser.fullName,
          position: 'Cán bộ Y tế học đường',
        },
        {
          roleTitle: 'Ủy viên',
          name: 'Lê Thị Kim Cúc',
          position: 'Kế toán trường',
        },
        {
          roleTitle: 'Ủy viên giám sát',
          name: 'Trần Minh Tuấn',
          position: 'Chủ tịch Công đoàn / Trưởng ban TTND',
        },
      ],
      items: payload.items || [],
      totalQuantity: totalQty,
      totalEstimatedAmount: totalAmount,
      disposalMethod: payload.disposalMethod || 'Hòa tan, trung hòa bất hoạt và chuyển bao gói rác thải y tế chuyên trách tiêu hủy',
      disposalLocation: payload.disposalLocation || 'Phòng Y tế & Khu vực xử lý chất thải Trường THCS Đông Thạnh',
      witnessNotes: payload.witnessNotes || '',
      status: payload.status || 'pending_approval',
      createdBy: payload.createdBy || this.currentUser.id,
      createdByName: payload.createdByName || this.currentUser.fullName,
      createdAt: payload.createdAt || now,
      approvedBy: payload.approvedBy,
      approvedByName: payload.approvedByName,
      approvedAt: payload.approvedAt,
      approvalNotes: payload.approvalNotes,
      executedBy: payload.executedBy,
      executedByName: payload.executedByName,
      executedAt: payload.executedAt,
      inventoryTransactionId: payload.inventoryTransactionId,
      notes: payload.notes || '',
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      this.disposals[existingIdx] = record;
    } else {
      this.disposals.unshift(record);
    }

    this.logAudit(
      'Lập biên bản tiêu hủy',
      `Lưu biên bản tiêu hủy ${record.disposalCode} (${record.items.length} mặt hàng, ${record.totalQuantity} đơn vị). Trạng thái: ${record.status}`,
      record.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('disposals', record.id, record, 'set');
    }

    return record;
  }

  public approveDisposal(disposalId: string, approverName?: string, notes?: string): MedicineDisposal {
    const disposal = this.disposals.find((d) => d.id === disposalId);
    if (!disposal) throw new Error('Không tìm thấy biên bản tiêu hủy thuốc.');
    if (disposal.status === 'completed') {
      throw new Error('Biên bản này đã hoàn tất tiêu hủy trước đó.');
    }

    const approver = approverName || this.currentUser.fullName;
    disposal.status = 'approved';
    disposal.approvedBy = this.currentUser.id;
    disposal.approvedByName = approver;
    disposal.approvedAt = new Date().toISOString();
    if (notes) {
      disposal.approvalNotes = notes;
    }
    disposal.updatedAt = new Date().toISOString();

    this.logAudit(
      'Phê duyệt biên bản tiêu hủy',
      `Ký duyệt biên bản tiêu hủy dược phẩm ${disposal.disposalCode}. Người duyệt: ${approver}`,
      disposal.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('disposals', disposal.id, disposal, 'set');
    }

    return disposal;
  }

  public rejectDisposal(disposalId: string, reason: string): MedicineDisposal {
    const disposal = this.disposals.find((d) => d.id === disposalId);
    if (!disposal) throw new Error('Không tìm thấy biên bản tiêu hủy thuốc.');
    if (disposal.status === 'completed') {
      throw new Error('Không thể từ chối biên bản đã hoàn tất tiêu hủy.');
    }

    disposal.status = 'cancelled';
    disposal.notes = (disposal.notes ? disposal.notes + ' | ' : '') + `Lý do từ chối: ${reason}`;
    disposal.updatedAt = new Date().toISOString();

    this.logAudit(
      'Từ chối biên bản tiêu hủy',
      `Từ chối / Hủy biên bản ${disposal.disposalCode}. Lý do: ${reason}`,
      disposal.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('disposals', disposal.id, disposal, 'set');
    }

    return disposal;
  }

  public executeDisposal(
    disposalId: string,
    executorName?: string,
    executionNotes?: string
  ): { disposal: MedicineDisposal; transaction: InventoryTransaction } {
    const disposal = this.disposals.find((d) => d.id === disposalId);
    if (!disposal) throw new Error('Không tìm thấy biên bản tiêu hủy thuốc.');
    if (disposal.status === 'completed') {
      throw new Error('Biên bản tiêu hủy này đã được thực hiện và trừ kho trước đó.');
    }

    const executor = executorName || this.currentUser.fullName;
    const now = new Date().toISOString();

    // 1. Deduct quantities from batches
    const transactionItems: any[] = [];
    const writes: BatchWriteOp[] = [];

    for (const item of disposal.items) {
      const batch = this.batches.find((b) => b.id === item.batchId);
      if (batch) {
        const deductQty = Math.min(batch.quantity, item.disposalQuantity);
        batch.quantity = Math.max(0, batch.quantity - deductQty);

        transactionItems.push({
          medicineId: item.medicineId,
          medicineCode: item.medicineCode,
          medicineName: item.medicineName,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: item.disposalQuantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
          unit: item.unit,
          expDate: item.expDate,
        });

        writes.push({ subcollection: 'batches', docId: batch.id, data: batch, op: 'set' });
      }
    }

    // 2. Create export inventory transaction
    const txCode = this.getNextExportCode();
    const newTx: InventoryTransaction = {
      id: 'tx-disp-' + Date.now(),
      transactionCode: txCode,
      type: 'export',
      date: disposal.disposalDate || now.split('T')[0],
      recipientName: 'Hội đồng tiêu hủy thuốc hết hạn Trường THCS Đông Thạnh',
      recipientType: 'other',
      purpose: `Xuất hủy dược phẩm hết hạn / biến chất theo ${disposal.disposalCode}`,
      performer: executor,
      notes: `${executionNotes ? executionNotes + ' | ' : ''}Số QĐ: ${disposal.decisionNumber || 'Chưa ghi'} | Phương pháp: ${disposal.disposalMethod}`,
      items: transactionItems,
      totalAmount: disposal.totalEstimatedAmount,
      status: 'completed',
      isDemo: false,
      createdAt: now,
    };

    this.transactions.unshift(newTx);
    writes.push({ subcollection: 'transactions', docId: newTx.id, data: newTx, op: 'set' });

    // 3. Mark disposal as completed
    disposal.status = 'completed';
    disposal.executedBy = this.currentUser.id;
    disposal.executedByName = executor;
    disposal.executedAt = now;
    disposal.inventoryTransactionId = newTx.id;
    if (executionNotes) {
      disposal.witnessNotes = (disposal.witnessNotes ? disposal.witnessNotes + ' | ' : '') + `Biên bản thực tế: ${executionNotes}`;
    }
    disposal.updatedAt = now;
    writes.push({ subcollection: 'disposals', docId: disposal.id, data: disposal, op: 'set' });

    this.logAudit(
      'THỰC HIỆN TIÊU HỦY THUỐC & TRỪ KHO',
      `Đã tiêu hủy và xuất trừ kho ${disposal.totalQuantity} đơn vị thuốc theo ${disposal.disposalCode} (Phiếu xuất ${newTx.transactionCode}). Người thực hiện: ${executor}`,
      disposal.id
    );

    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistBatch(writes);
    }

    return { disposal, transaction: newTx };
  }

  public deleteDisposal(disposalId: string): void {
    const disposal = this.disposals.find((d) => d.id === disposalId);
    if (!disposal) throw new Error('Biên bản tiêu hủy không tồn tại.');
    if (disposal.status === 'completed') {
      throw new Error('Không thể xóa biên bản tiêu hủy đã hoàn tất và đã trừ kho.');
    }

    this.disposals = this.disposals.filter((d) => d.id !== disposalId);
    this.logAudit('Xóa biên bản tiêu hủy', `Xóa biên bản: ${disposal.disposalCode}`, disposalId);
    this.saveAll();
    this.notify();

    if (this.currentUserId) {
      this.persistItem('disposals', disposalId, null, 'delete');
    }
  }

  // Export JSON Backup (Updated to version 3.1 with disposal records)
  public exportBackupJson(): string {
    const backupData = {
      version: '3.1',
      exportedAt: new Date().toISOString(),
      schoolName: this.settings.schoolName,
      medicines: this.medicines,
      batches: this.batches,
      transactions: this.transactions,
      suppliers: this.suppliers,
      supplies: this.supplies,
      usageRecords: this.usageRecords,
      inventoryChecks: this.inventoryChecks,
      disposals: this.disposals,
      auditLogs: this.auditLogs,
      settings: this.settings,
      students: this.students,
      healthProfiles: this.healthProfiles,
      clinicVisits: this.clinicVisits,
      healthEvents: this.healthEvents,
      healthCheckups: this.healthCheckups,
      classes: this.classes,
    };
    return JSON.stringify(backupData, null, 2);
  }

  // Restore JSON Backup (Supports version 1, 2, and 3)
  public restoreBackupJson(jsonString: string) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.medicines || !data.batches) {
        throw new Error('Định dạng tệp sao lưu không hợp lệ.');
      }
      this.medicines = data.medicines;
      this.batches = data.batches;
      this.transactions = data.transactions || [];
      this.suppliers = data.suppliers || DEFAULT_SUPPLIERS;
      this.supplies = data.supplies || [];
      this.usageRecords = data.usageRecords || [];
      this.inventoryChecks = data.inventoryChecks || [...INITIAL_INVENTORY_CHECKS];
      this.disposals = data.disposals || [...INITIAL_DISPOSALS];
      this.auditLogs = data.auditLogs || [];
      if (data.settings) this.settings = data.settings;
      if (data.students) this.students = data.students;
      if (data.healthProfiles) this.healthProfiles = data.healthProfiles;
      if (data.clinicVisits) this.clinicVisits = data.clinicVisits;
      if (data.healthEvents) this.healthEvents = data.healthEvents;
      if (data.healthCheckups) this.healthCheckups = data.healthCheckups;
      if (data.classes) this.classes = data.classes;
      this.saveAll();
      this.logAudit('Khôi phục dữ liệu', 'Đã khôi phục thành công từ tệp sao lưu dự phòng JSON');
      this.notify();

      if (this.currentUserId) {
        this.syncAllToCloud();
      }
    } catch (err: any) {
      throw new Error(`Không thể khôi phục dữ liệu: ${err.message}`);
    }
  }
}

export const db = new AppDatabase();
