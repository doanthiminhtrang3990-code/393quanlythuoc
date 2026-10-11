import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Filter,
  UserCheck,
  AlertTriangle,
  Heart,
  Eye,
  Edit2,
  Trash2,
  X,
  Check,
  FileSpreadsheet,
  Phone,
  ShieldAlert,
  Stethoscope,
  Info,
  GraduationCap,
  Columns3,
  PhoneCall,
  User,
  HeartHandshake,
  Loader2,
  Database,
  HardDrive,
  Cloud,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Sparkles,
  EyeOff,
} from 'lucide-react';
import {
  db,
  formatDateVN,
  normalizeDateToISO,
  formatDateFormulaVN,
  normalizeStudentClassName,
  extractGradeFromClassOrGrade,
  matchesStudentSearch,
  getStudentSearchScore,
  areClassesEquivalent,
  maskStudentName,
  StorageDiagnostics,
} from '../services/db';
import { exportStudentDirectoryExcel, getFilenameDate } from '../services/excelService';
import { Student, SchoolClass } from '../types';
import { ClassManagementModal } from './ClassManagementModal';
import * as XLSX from 'xlsx';

interface StudentDirectoryProps {
  onSelectStudentForProfile?: (studentId: string) => void;
  onSelectStudentForIntake?: (studentId: string) => void;
  onNavigate?: (tab: string, filter?: string) => void;
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  onSelectStudentForProfile,
  onSelectStudentForIntake,
  onNavigate,
}) => {
  const [students, setStudents] = useState<Student[]>(() => db.getStudents());
  const [classes, setClasses] = useState<SchoolClass[]>(() => db.getSchoolClasses());
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.isPrivacyModeEnabled());

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<'all' | 'special' | 'normal'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination for high performance with 1400+ students
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  useEffect(() => {
    setDebouncedSearch(searchQuery);
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGrade, selectedClass, healthFilter]);

  // Parent column display mode: 4 separated columns (Tên cha, SĐT cha, Tên mẹ, SĐT mẹ) vs 2 combined columns
  const [parentColMode, setParentColMode] = useState<'separated' | 'combined'>('combined');

  // Display view mode: compact (vừa vặn màn hình nhỏ/thu nhỏ), full table (12 cột), cards (lưới thẻ)
  const [viewMode, setViewMode] = useState<'table-compact' | 'table-full' | 'cards'>('table-compact');

  // Toggle thu gọn danh sách thẻ lớp học
  const [isClassesRibbonExpanded, setIsClassesRibbonExpanded] = useState(false);

  // ID của học sinh vừa thêm mới để ghim đầu bảng và highlight
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    studentCode: '',
    fullName: '',
    birthDate: '2014-01-01',
    gender: 'Nam' as 'Nam' | 'Nữ',
    grade: 6,
    className: '6/1',
    schoolYear: '2026-2027',
    citizenId: '',
    healthInsuranceCode: '',
    parentName: '',
    parentPhone: '',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
    address: 'Xã Đông Thạnh, Hóc Môn, TP.HCM',
    bloodType: 'O',
    allergies: '',
    chronicConditions: '',
    specialAttention: false,
    notes: '',
  });
  const [birthDateText, setBirthDateText] = useState('01/01/2014');

  // Import state with multi-sheet and sync support
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [importUpdatedCount, setImportUpdatedCount] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [detectedSheets, setDetectedSheets] = useState<{ name: string; count: number; grade: number }[]>([]);
  const [selectedImportSheet, setSelectedImportSheet] = useState<string>('all');
  const [updateExistingStudents, setUpdateExistingStudents] = useState(true);
  const [replaceAllOnImport, setReplaceAllOnImport] = useState(false);

  // Storage & Sync Diagnostics state
  const [showStorageInfo, setShowStorageInfo] = useState(false);
  const [storageDiag, setStorageDiag] = useState<StorageDiagnostics | null>(null);
  const [isForcingSync, setIsForcingSync] = useState(false);

  const loadDiagnostics = async () => {
    try {
      const diag = await db.getStorageDiagnostics();
      setStorageDiag(diag);
    } catch (e) {
      console.warn('Error loading storage diagnostics:', e);
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, [students.length, classes.length]);

  const handleForceSyncNow = async () => {
    setIsForcingSync(true);
    try {
      const diag = await db.forceSyncAllStorage();
      setStorageDiag(diag);
      setSuccessMessage(
        `Đã lưu cứng & đồng bộ thành công ${diag.memoryStudentsCount} học sinh, ${diag.memoryClassesCount} lớp học vào cả 3 nơi lưu trữ (IndexedDB + LocalStorage + Cloud Firestore)!`
      );
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(`Lỗi khi đồng bộ: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsForcingSync(false);
    }
  };

  // Clean Sample Data Modal (for Production Publishing)
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanOptions, setCleanOptions] = useState({
    clearStudents: true,
    clearClasses: true,
    clearVisitsAndEvents: true,
  });

  const handleCleanData = () => {
    try {
      const res = db.clearStudentsAndClasses(cleanOptions);
      setShowCleanModal(false);
      const parts: string[] = [];
      if (cleanOptions.clearStudents) parts.push(`${res.studentsCount} học sinh`);
      if (cleanOptions.clearClasses) parts.push(`${res.classesCount} lớp & GVCN`);
      if (cleanOptions.clearVisitsAndEvents && (res.visitsCount > 0 || res.eventsCount > 0)) {
        parts.push(`${res.visitsCount} lượt khám`);
      }
      setSuccessMessage(
        `Đã làm sạch dữ liệu thành công! (Đã xóa ${parts.join(', ')}). Hệ thống đã sẵn sàng để nạp danh sách học sinh và phân công GVCN thực tế.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      refreshList();
    } catch (err: any) {
      setErrorMessage(`Lỗi khi làm sạch dữ liệu: ${err?.message || 'Không xác định'}`);
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const refreshList = () => {
    setStudents(db.getStudents());
    setClasses(db.getSchoolClasses());
    setPrivacyMode(db.isPrivacyModeEnabled());
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      refreshList();
    });
    return () => unsub();
  }, []);

  // Filtered Students (Optimized for lightning-fast search without O(N log N) scoring lag)
  const filteredStudents = useMemo(() => {
    const termToSearch = debouncedSearch.trim();

    const filtered = students.filter((s) => {
      // 1. Khi người dùng gõ tìm kiếm: Tìm trên TOÀN TRƯỜNG theo tên, mã HS, số điện thoại, lớp...
      if (termToSearch) {
        return matchesStudentSearch(s, termToSearch);
      }

      // 2. Khi KHÔNG có từ khóa tìm kiếm: Lọc chuẩn xác theo Khối, Lớp và Sức khỏe
      const studentGrade = Number(s.grade || extractGradeFromClassOrGrade(undefined, s.className));
      if (selectedGrade !== 'all' && studentGrade !== Number(selectedGrade)) return false;
      if (
        selectedClass !== 'all' &&
        s.className !== selectedClass &&
        !areClassesEquivalent(s.className, selectedClass) &&
        normalizeStudentClassName(s.className) !== normalizeStudentClassName(selectedClass)
      ) {
        return false;
      }
      if (healthFilter === 'special' && !s.specialAttention) return false;
      if (healthFilter === 'normal' && s.specialAttention) return false;

      return true;
    });

    if (termToSearch) {
      // Pre-calculate score for each student ONCE (Schwartzian transform)
      const scored = filtered.map((s) => {
        const score = getStudentSearchScore(s, termToSearch);
        const aGrade = s.grade || extractGradeFromClassOrGrade(undefined, s.className);
        const inFilter =
          (selectedGrade === 'all' || aGrade === selectedGrade) &&
          (selectedClass === 'all' || s.className === selectedClass || areClassesEquivalent(s.className, selectedClass));
        return { s, score, inFilter };
      });

      scored.sort((a, b) => {
        if (recentlyAddedId) {
          if (a.s.id === recentlyAddedId) return -1;
          if (b.s.id === recentlyAddedId) return 1;
        }
        if (a.score !== b.score) return b.score - a.score;
        if (a.inFilter && !b.inFilter) return -1;
        if (!a.inFilter && b.inFilter) return 1;
        const aTime = a.s.createdAt || '';
        const bTime = b.s.createdAt || '';
        if (aTime && bTime && aTime !== bTime) return bTime.localeCompare(aTime);
        return 0;
      });

      return scored.map((item) => item.s);
    }

    return filtered.sort((a, b) => {
      if (recentlyAddedId) {
        if (a.id === recentlyAddedId) return -1;
        if (b.id === recentlyAddedId) return 1;
      }
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      if (aTime && bTime && aTime !== bTime) {
        return bTime.localeCompare(aTime);
      }
      return 0;
    });
  }, [students, selectedGrade, selectedClass, healthFilter, debouncedSearch, recentlyAddedId]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    if (pageSize >= 9999) return filteredStudents;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, safeCurrentPage, pageSize]);

  const stats = useMemo(() => {
    const total = students.length;
    const special = students.filter((s) => s.specialAttention).length;
    const grade6 = students.filter((s) => (s.grade || extractGradeFromClassOrGrade(undefined, s.className)) === 6).length;
    const grade7 = students.filter((s) => (s.grade || extractGradeFromClassOrGrade(undefined, s.className)) === 7).length;
    const grade8 = students.filter((s) => (s.grade || extractGradeFromClassOrGrade(undefined, s.className)) === 8).length;
    const grade9 = students.filter((s) => (s.grade || extractGradeFromClassOrGrade(undefined, s.className)) === 9).length;
    return { total, special, grade6, grade7, grade8, grade9 };
  }, [students]);

  // Open add modal
  const handleOpenAdd = () => {
    const nextCodeNum = students.length + 1;
    const autoCode = `HS${String(nextCodeNum).padStart(4, '0')}`;
    const defaultClass = classes.find((c) => selectedGrade === 'all' || c.grade === selectedGrade)?.name || '6/1';
    const defaultGrade = typeof selectedGrade === 'number' ? selectedGrade : parseInt(defaultClass.charAt(0), 10) || 6;
    setFormData({
      studentCode: autoCode,
      fullName: '',
      birthDate: '2014-01-01',
      gender: 'Nam',
      grade: defaultGrade,
      className: defaultClass,
      schoolYear: '2026-2027',
      citizenId: '',
      healthInsuranceCode: '',
      parentName: '',
      parentPhone: '',
      fatherName: '',
      fatherPhone: '',
      motherName: '',
      motherPhone: '',
      address: 'Xã Đông Thạnh, Huyện Hóc Môn, TP.HCM',
      bloodType: 'O',
      allergies: '',
      chronicConditions: '',
      specialAttention: false,
      notes: '',
    });
    setEditingStudent(null);
    setBirthDateText('01/01/2014');
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setBirthDateText(formatDateVN(student.birthDate));
    setFormData({
      studentCode: student.studentCode,
      fullName: student.fullName,
      birthDate: student.birthDate,
      gender: student.gender,
      grade: student.grade,
      className: student.className,
      schoolYear: student.schoolYear,
      citizenId: student.citizenId || '',
      healthInsuranceCode: student.healthInsuranceCode || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      fatherName: student.fatherName || '',
      fatherPhone: student.fatherPhone || '',
      motherName: student.motherName || '',
      motherPhone: student.motherPhone || '',
      address: student.address || '',
      bloodType: student.bloodType || 'O',
      allergies: student.allergies || '',
      chronicConditions: student.chronicConditions || '',
      specialAttention: !!student.specialAttention,
      notes: student.notes || '',
    });
    setErrorMessage(null);
    setIsAddModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const finalParentName = formData.parentName.trim() || formData.fatherName.trim() || formData.motherName.trim();
      const finalParentPhone = formData.parentPhone.trim() || formData.fatherPhone.trim() || formData.motherPhone.trim();
      const finalBirthDate = normalizeDateToISO(birthDateText) || normalizeDateToISO(formData.birthDate) || formData.birthDate.trim() || '2014-01-01';

      const payload = {
        ...formData,
        birthDate: finalBirthDate,
        parentName: finalParentName,
        parentPhone: finalParentPhone,
        fatherName: formData.fatherName.trim() || undefined,
        fatherPhone: formData.fatherPhone.trim() || undefined,
        motherName: formData.motherName.trim() || undefined,
        motherPhone: formData.motherPhone.trim() || undefined,
        specialAttention: !!formData.specialAttention || !!formData.allergies || !!formData.chronicConditions,
      };

      if (editingStudent) {
        db.updateStudent(editingStudent.id, payload);
        setSuccessMessage(`Đã cập nhật học sinh ${formData.fullName} (Lớp ${formData.className})`);
        setRecentlyAddedId(editingStudent.id);
      } else {
        const newStu = db.addStudent(payload);
        setSuccessMessage(
          `Đã thêm thành công học sinh: ${formData.fullName} (Mã: ${newStu.studentCode} - Lớp: ${formData.className})! Đã tự động hiển thị ngay đầu danh sách.`
        );
        setRecentlyAddedId(newStu.id);
        // Tự động giải phóng các bộ lọc để học sinh mới hiển thị ngay đầu danh sách
        setSelectedGrade('all');
        setSelectedClass('all');
        setHealthFilter('all');
        setSearchQuery('');
        setDebouncedSearch('');
        setCurrentPage(1);
      }
      setIsAddModalOpen(false);
      refreshList();
      setTimeout(() => setSuccessMessage(null), 6000);
      setTimeout(() => setRecentlyAddedId(null), 15000);
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Delete student
  const handleDeleteConfirm = () => {
    if (!deleteConfirmStudent) return;
    try {
      db.deleteStudent(deleteConfirmStudent.id, true);
      setSuccessMessage(`Đã xóa học sinh ${deleteConfirmStudent.fullName} và dữ liệu liên quan thành công.`);
      setDeleteConfirmStudent(null);
      refreshList();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(`Không thể xóa học sinh: ${err.message}`);
      setDeleteConfirmStudent(null);
    }
  };

  // Sample Excel / CSV Download
  const handleDownloadSampleExcel = () => {
    const headers = [
      'Mã học sinh',
      'Họ và tên',
      'Lớp',
      'Giới tính',
      'Ngày sinh (ngày/tháng/năm)',
      'Khối',
      'Giáo viên chủ nhiệm (GVCN)',
      'SĐT GVCN',
      'Tên cha',
      'SĐT cha',
      'Tên mẹ',
      'SĐT mẹ',
      'Phụ huynh',
      'SĐT phụ huynh',
      'Mã BHYT',
      'CCCD/Định danh',
      'Dị ứng',
      'Bệnh nền',
    ];
    const sampleRows = [
      [
        'HS0050',
        'Nguyễn Gia Hưng',
        '6/1',
        'Nam',
        '10/05/2014',
        '6',
        'Cô Nguyễn Thị Lan',
        '0908 112 233',
        'Nguyễn Văn Thắng',
        '0912345678',
        'Lê Thị Thu',
        '0912345679',
        'Nguyễn Văn Thắng',
        '0912345678',
        'GD4790123456888',
        '079214008888',
        'Dị ứng hải sản',
        'Không',
      ],
      [
        'HS0051',
        'Trần Khánh Vy',
        '6/2',
        'Nữ',
        '18/09/2014',
        '6',
        'Thầy Trần Minh Tuấn',
        '0913 223 344',
        'Trần Văn Sơn',
        '0987654320',
        'Lê Thị Hương',
        '0987654321',
        'Lê Thị Hương',
        '0987654321',
        'GD4790123456889',
        '079314008889',
        'Không',
        'Cận thị 2.0 diop',
      ],
      [
        'HS0052',
        'Phạm Hoàng Nam',
        '6/3',
        'Nam',
        '05/12/2014',
        '6',
        'Thầy Lê Quốc Toàn',
        '0914 556 677',
        'Phạm Văn Hải',
        '0976123456',
        'Võ Thị Ngọc',
        '0976123457',
        'Phạm Văn Hải',
        '0976123456',
        'GD4790123456890',
        '079214008890',
        'Không',
        'Không',
      ],
    ];

    try {
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      worksheet['!cols'] = [
        { wch: 14 },
        { wch: 22 },
        { wch: 10 },
        { wch: 10 },
        { wch: 22 },
        { wch: 8 },
        { wch: 22 },
        { wch: 16 },
        { wch: 20 },
        { wch: 16 },
        { wch: 20 },
        { wch: 16 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhSachHocSinh');
      XLSX.writeFile(workbook, 'Mau_Danh_Sach_Hoc_Sinh_THCS_Dong_Thanh.xlsx');
    } catch {
      // Fallback to CSV if workbook export fails
      const csvContent =
        '\uFEFF' +
        [headers.join(','), ...sampleRows.map((r) => r.map((f) => `"${f}"`).join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Mau_Danh_Sach_Hoc_Sinh_THCS_Dong_Thanh.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  };

  // Export Filtered Student List to Excel (.xlsx)
  const handleExportStudentsExcel = () => {
    try {
      const filterText = `Bộ lọc: ${selectedClass !== 'all' ? 'Lớp ' + selectedClass : 'Toàn trường'} • Tổng số: ${filteredStudents.length} học sinh`;
      exportStudentDirectoryExcel(filteredStudents, filterText);
    } catch (err) {
      console.error('Lỗi khi xuất danh sách học sinh:', err);
      setErrorMessage('Có lỗi khi tạo tệp Excel. Vui lòng thử lại.');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  // Handle Excel 97-2003 (.xls), Excel (.xlsx), and CSV file drop / selection (Supports Multi-Sheet Workbooks across all grades)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportErrors([]);
    setImportSuccessCount(null);
    setImportUpdatedCount(null);

    try {
      const buffer = await file.arrayBuffer();
      // XLSX.read handles both Excel 97-2003 (.xls), modern Excel (.xlsx), and .csv
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Tập tin không có trang tính (sheet) nào.');
      }

      const allParsedRows: any[] = [];
      const sheetSummaries: { name: string; count: number; grade: number }[] = [];

      // Iterate through ALL sheets in workbook to ensure no Khối (grade) is omitted
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;
        const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (!rawMatrix || rawMatrix.length < 2) continue; // Skip empty or title-only sheets

        // Extract grade and class hints from sheet name (e.g. "Khối 6", "Khối 7", "6A1", "7/2")
        let sheetGrade = extractGradeFromClassOrGrade(undefined, undefined, sheetName);
        let sheetClass = '';
        if (/^(?:lớp\s*)?([1-9]|1[0-2])[\/A-Za-z\.\-\_]\w*$/i.test(sheetName.trim())) {
          sheetClass = normalizeStudentClassName(sheetName);
        }

        // Detect header row index
        let headerRowIndex = 0;
        let bestScore = 0;
        for (let r = 0; r < Math.min(rawMatrix.length, 20); r++) {
          const rowCells = (rawMatrix[r] || []).map((c) => String(c || '').toLowerCase().trim());
          const rowText = rowCells.join(' ');
          let score = 0;
          if (rowText.includes('mã') || rowText.includes('mahs') || rowText.includes('student') || rowCells.includes('stt') || rowCells.includes('tt')) score += 2;
          if (rowText.includes('tên') || rowText.includes('họ') || rowText.includes('fullname')) score += 4;
          if (rowText.includes('lớp') || rowText.includes('lop') || rowText.includes('class')) score += 2;
          if (rowText.includes('ngày sinh') || rowText.includes('ngaysinh') || rowText.includes('năm sinh') || rowText.includes('birth')) score += 3;
          if (rowText.includes('giới tính') || rowText.includes('phái') || rowText.includes('nữ')) score += 2;
          if (rowText.includes('khối') || rowText.includes('khoi')) score += 2;
          if (score > bestScore) {
            bestScore = score;
            headerRowIndex = r;
          }
        }

        // Scan title banner rows above headerRowIndex for class name (e.g. "DANH SÁCH HỌC SINH LỚP 6/1", "Lớp: 7A2")
        let bannerClass = sheetClass;
        let bannerTeacher = '';
        for (let r = 0; r < headerRowIndex; r++) {
          const bannerLine = (rawMatrix[r] || []).map((c) => String(c || '').trim()).join(' ');
          if (!bannerClass) {
            const classMatch = bannerLine.match(/(?:lớp|lop)\s*[:\-]?\s*([6789]\s*[\/A-Za-z\.\-]\s*\d*)/i);
            if (classMatch && classMatch[1]) {
              bannerClass = normalizeStudentClassName(classMatch[1]);
              sheetGrade = extractGradeFromClassOrGrade(undefined, bannerClass, sheetName);
            }
          }
          if (!bannerTeacher) {
            const gvMatch = bannerLine.match(/(?:gvcn|giáo viên chủ nhiệm|chủ nhiệm)\s*[:\-]?\s*([^,\-\n\r;|]+)/i);
            if (gvMatch && gvMatch[1]) {
              bannerTeacher = gvMatch[1].trim();
            }
          }
        }

        const rawHeaders = (rawMatrix[headerRowIndex] || []).map((h) => String(h || '').trim());
        const sheetRows: any[] = [];
        let currentSectionClass = bannerClass;
        let currentSectionTeacher = bannerTeacher;

        for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
          const rowData = rawMatrix[r];
          if (!rowData || rowData.length === 0) continue;
          const nonEmptyCells = rowData.filter((val) => val !== undefined && val !== null && String(val).trim() !== '');
          if (nonEmptyCells.length === 0) continue;

          // Check if this row is a mid-sheet section divider like "LỚP 6/2" or "Danh sách lớp 7/1 - GVCN: ..."
          if (nonEmptyCells.length <= 3) {
            const combinedRowText = nonEmptyCells.map((c) => String(c).trim()).join(' ');
            const secClassMatch = combinedRowText.match(/^(?:danh sách|ds)?\s*(?:học sinh)?\s*(?:lớp|lop)\s*[:\-]?\s*([6789]\s*[\/A-Za-z\.\-]\s*\d+)/i);
            if (secClassMatch && secClassMatch[1]) {
              currentSectionClass = normalizeStudentClassName(secClassMatch[1]);
              const secGvMatch = combinedRowText.match(/(?:gvcn|giáo viên chủ nhiệm|chủ nhiệm)\s*[:\-]?\s*([^,\-\n\r;|]+)/i);
              if (secGvMatch && secGvMatch[1]) {
                currentSectionTeacher = secGvMatch[1].trim();
              }
              continue;
            }
          }

          const rowObj: Record<string, any> = {
            _sheetName: sheetName,
          };

          rawHeaders.forEach((h, colIdx) => {
            let val = rowData[colIdx];
            if (val instanceof Date) {
              const y = val.getFullYear();
              const m = String(val.getMonth() + 1).padStart(2, '0');
              const d = String(val.getDate()).padStart(2, '0');
              val = `${y}-${m}-${d}`;
            } else if (typeof val === 'number') {
              val = String(val);
            } else {
              val = String(val || '').trim();
            }

            const cleanHeader = h.toLowerCase().trim();
            if (cleanHeader === 'stt' || cleanHeader === 'tt' || cleanHeader === 'số tt' || cleanHeader === 'no') {
              rowObj['_stt'] = val;
            } else if (
              cleanHeader.includes('mã học sinh') ||
              cleanHeader === 'mahs' ||
              cleanHeader === 'mã hs' ||
              cleanHeader === 'studentcode' ||
              cleanHeader === 'mã định danh' ||
              cleanHeader === 'mã số' ||
              cleanHeader === 'mã'
            ) {
              rowObj['Mã học sinh'] = val;
            } else if (
              cleanHeader.includes('họ và tên') ||
              cleanHeader.includes('họ tên') ||
              cleanHeader === 'hoten' ||
              cleanHeader === 'fullname' ||
              cleanHeader === 'tên học sinh' ||
              cleanHeader === 'họ và tên học sinh'
            ) {
              rowObj['Họ và tên'] = val;
            } else if (
              cleanHeader === 'họ đệm' ||
              cleanHeader === 'họ và chữ lót' ||
              cleanHeader === 'họ lót' ||
              cleanHeader === 'họ' ||
              cleanHeader === 'ho dem' ||
              cleanHeader === 'lastname'
            ) {
              rowObj['Họ đệm'] = val;
            } else if (
              cleanHeader === 'tên' ||
              cleanHeader === 'ten' ||
              cleanHeader === 'firstname' ||
              cleanHeader === 'tên gọi'
            ) {
              rowObj['Tên'] = val;
            } else if (cleanHeader === 'lớp' || cleanHeader === 'lop' || cleanHeader === 'classname' || cleanHeader.includes('tên lớp') || cleanHeader === 'lớp học') {
              rowObj['Lớp'] = val;
            } else if (cleanHeader.includes('giới tính') || cleanHeader === 'gioitinh' || cleanHeader === 'gender' || cleanHeader === 'phái' || cleanHeader === 'nam/nữ') {
              rowObj['Giới tính'] = val;
            } else if (cleanHeader === 'nữ' || cleanHeader === 'nu') {
              // Some Vietnamese school sheets have a column "Nữ" marked with "x" or "Nữ"
              if (val && (val.toLowerCase() === 'x' || val.toLowerCase() === 'nữ' || val.toLowerCase() === 'nu' || val === '1' || val.toLowerCase() === 'có')) {
                rowObj['Giới tính'] = 'Nữ';
              }
            } else if (cleanHeader.includes('ngày sinh') || cleanHeader === 'ngaysinh' || cleanHeader === 'birthdate' || cleanHeader.includes('năm sinh') || cleanHeader === 'ngày tháng năm sinh') {
              rowObj['Ngày sinh'] = normalizeDateToISO(val) || val;
            } else if (cleanHeader.includes('khối') || cleanHeader === 'khoi' || cleanHeader === 'grade') {
              rowObj['Khối'] = val;
            } else if (
              cleanHeader.includes('gvcn') ||
              cleanHeader.includes('giáo viên chủ nhiệm') ||
              cleanHeader.includes('chủ nhiệm') ||
              cleanHeader.includes('homeroomteacher') ||
              cleanHeader.includes('họ và tên gv') ||
              cleanHeader.includes('họ tên gv') ||
              cleanHeader.includes('tên gv') ||
              cleanHeader === 'gv' ||
              cleanHeader === 'cbgv' ||
              cleanHeader.includes('giáo viên')
            ) {
              rowObj['GVCN'] = val;
            } else if (
              cleanHeader.includes('sđt gvcn') ||
              cleanHeader.includes('sdt gvcn') ||
              cleanHeader.includes('điện thoại gvcn') ||
              cleanHeader.includes('teacherphone') ||
              cleanHeader.includes('sđt gv') ||
              cleanHeader.includes('sdt gv')
            ) {
              rowObj['SĐT GVCN'] = val;
            } else if (cleanHeader.includes('tên cha') || cleanHeader.includes('họ tên cha') || cleanHeader === 'cha' || cleanHeader === 'fathername') {
              rowObj['Tên cha'] = val;
            } else if (cleanHeader.includes('sđt cha') || cleanHeader.includes('sdt cha') || cleanHeader.includes('điện thoại cha') || cleanHeader === 'fatherphone') {
              rowObj['SĐT cha'] = val;
            } else if (cleanHeader.includes('tên mẹ') || cleanHeader.includes('họ tên mẹ') || cleanHeader === 'mẹ' || cleanHeader === 'me' || cleanHeader === 'mothername') {
              rowObj['Tên mẹ'] = val;
            } else if (cleanHeader.includes('sđt mẹ') || cleanHeader.includes('sdt mẹ') || cleanHeader.includes('điện thoại mẹ') || cleanHeader === 'motherphone') {
              rowObj['SĐT mẹ'] = val;
            } else if (cleanHeader.includes('phụ huynh') || cleanHeader === 'parentname' || cleanHeader.includes('cha mẹ') || cleanHeader.includes('người giám hộ')) {
              rowObj['Phụ huynh'] = val;
            } else if (cleanHeader.includes('sđt') || cleanHeader.includes('sdt') || cleanHeader.includes('điện thoại') || cleanHeader === 'parentphone' || cleanHeader.includes('liên hệ')) {
              rowObj['SĐT phụ huynh'] = val;
            } else if (cleanHeader.includes('bhyt') || cleanHeader === 'healthinsurancecode' || cleanHeader.includes('bảo hiểm')) {
              rowObj['Mã BHYT'] = val;
            } else if (cleanHeader.includes('cccd') || cleanHeader.includes('định danh') || cleanHeader === 'citizenid' || cleanHeader.includes('cmnd')) {
              rowObj['CCCD/Định danh'] = val;
            } else if (cleanHeader.includes('dị ứng') || cleanHeader === 'allergies') {
              rowObj['Dị ứng'] = val;
            } else if (cleanHeader.includes('bệnh nền') || cleanHeader === 'chronicconditions' || cleanHeader.includes('bệnh mãn tính')) {
              rowObj['Bệnh nền'] = val;
            } else if (cleanHeader.includes('địa chỉ') || cleanHeader === 'address' || cleanHeader.includes('nơi ở') || cleanHeader.includes('chỗ ở')) {
              rowObj['Địa chỉ'] = val;
            } else {
              rowObj[h] = val;
            }
          });

          // Combine split "Họ đệm" + "Tên" if "Họ và tên" is empty
          if (!rowObj['Họ và tên'] && (rowObj['Họ đệm'] || rowObj['Tên'])) {
            rowObj['Họ và tên'] = `${rowObj['Họ đệm'] || ''} ${rowObj['Tên'] || ''}`.replace(/\s+/g, ' ').trim();
          }

          // Filter out repeated header rows or footer summary rows
          const candidateName = String(rowObj['Họ và tên'] || '').trim();
          const lowerName = candidateName.toLowerCase();
          if (
            !candidateName ||
            lowerName === 'họ và tên' ||
            lowerName === 'họ tên' ||
            lowerName.startsWith('tổng số') ||
            lowerName.startsWith('tổng cộng') ||
            lowerName.includes('danh sách học sinh') ||
            lowerName.includes('hiểu trưởng') ||
            lowerName.includes('hiệu trưởng') ||
            lowerName.includes('người lập biểu')
          ) {
            continue;
          }

          // Ensure Khối, Lớp, and GVCN have fallbacks from section/banner/sheet info
          if (!rowObj['Lớp'] && currentSectionClass) {
            rowObj['Lớp'] = currentSectionClass;
          }
          if (!rowObj['GVCN'] && currentSectionTeacher) {
            rowObj['GVCN'] = currentSectionTeacher;
          }
          if (!rowObj['Khối']) {
            rowObj['Khối'] = extractGradeFromClassOrGrade(undefined, rowObj['Lớp'], sheetName);
          }

          sheetRows.push(rowObj);
        }

        if (sheetRows.length > 0) {
          allParsedRows.push(...sheetRows);
          sheetSummaries.push({
            name: sheetName,
            count: sheetRows.length,
            grade: sheetGrade,
          });
        }
      }

      if (allParsedRows.length === 0) {
        setImportErrors(['Không tìm thấy dòng dữ liệu học sinh nào trong tệp.']);
        return;
      }

      setDetectedSheets(sheetSummaries);
      setSelectedImportSheet('all');
      setImportRows(allParsedRows);
    } catch (err: any) {
      setImportErrors([`Lỗi khi đọc tệp Excel/CSV: ${err.message}`]);
    }
  };

  // Confirm Import & Synchronize across all grades
  const handleConfirmImport = async () => {
    const rowsToImport =
      selectedImportSheet === 'all'
        ? importRows
        : importRows.filter((r) => r._sheetName === selectedImportSheet);

    if (rowsToImport.length === 0) return;

    setIsImporting(true);
    setImportErrors([]);

    try {
      const result = db.importStudentsFromExcel(rowsToImport, {
        updateExisting: updateExistingStudents,
        autoGenerateCode: true,
        replaceAll: replaceAllOnImport,
      });

      setImportSuccessCount(result.added);
      setImportUpdatedCount(result.updated);
      setImportErrors(result.errors);
      refreshList();
      await loadDiagnostics();

      const gradeStats: Record<number, number> = {};
      rowsToImport.forEach((r) => {
        const g = extractGradeFromClassOrGrade(r['Khối'] || r['grade'], r['Lớp'] || r['className'], r['_sheetName']);
        gradeStats[g] = (gradeStats[g] || 0) + 1;
      });
      const gradeBreakdown = Object.entries(gradeStats)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([g, cnt]) => `Khối ${g}: ${cnt} HS`)
        .join(', ');

      const totalHandled = result.added + result.updated;
      if (totalHandled > 0) {
        setSuccessMessage(
          `Đã đồng bộ thành công ${totalHandled} học sinh (${result.added} thêm mới, ${result.updated} cập nhật) trên các khối: ${gradeBreakdown}! Dữ liệu đã lưu và đang đồng bộ lên Cloud.`
        );
        setTimeout(() => setSuccessMessage(null), 8000);
      }
    } catch (err: any) {
      setImportErrors([`Lỗi khi import học sinh: ${err?.message || 'Không xác định'}`]);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              GIAI ĐOẠN 3
            </span>
            <h1 className="text-xl font-bold text-slate-900">Quản Lý Hồ Sơ Học Sinh</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Quản lý danh sách, tiền sử dị ứng, bệnh nền và liên kết khám phòng y tế
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-manage-classes"
            onClick={() => setIsClassModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Quản lý Lớp & GVCN</span>
          </button>

          <button
            id="btn-add-student"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm học sinh</span>
          </button>

          <button
            id="btn-import-students"
            onClick={() => {
              setIsImportModalOpen(true);
              setImportRows([]);
              setImportFileName('');
              setImportErrors([]);
              setImportSuccessCount(null);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Excel</span>
          </button>

          <button
            id="btn-export-students"
            onClick={handleExportStudentsExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>

          <button
            id="btn-storage-diagnostics"
            onClick={() => {
              setShowStorageInfo((prev) => !prev);
              loadDiagnostics();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              showStorageInfo
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}
            title="Kiểm tra dữ liệu học sinh đang lưu ở đâu và đồng bộ 3 lớp"
          >
            <Database className="w-4 h-4" />
            <span>Nơi lưu & Đồng bộ</span>
          </button>

          <button
            id="btn-clean-students"
            onClick={() => setShowCleanModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
            title="Chuẩn bị xuất bản: Làm sạch dữ liệu học sinh, lớp học & GVCN mẫu"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Làm sạch dữ liệu</span>
          </button>
        </div>
      </div>

      {/* Storage Location & Sync Diagnostics Panel */}
      {showStorageInfo && (
        <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-sm p-4 sm:p-5 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Cơ Chế Lưu Trữ 3 Lớp & Vị Trí Lưu Dữ Liệu Học Sinh
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Đã khắc phục giới hạn bộ nhớ & xung đột đồng bộ
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Dữ liệu học sinh, lớp học & GVCN được lưu song song tại <strong>3 vị trí độc lập</strong> để đảm bảo không bao giờ mất dữ liệu khi tải danh sách lớn (1.000 - 10.000+ học sinh) hoặc khi chuyển đổi tài khoản.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleForceSyncNow}
                disabled={isForcingSync}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isForcingSync ? 'animate-spin' : ''}`} />
                <span>{isForcingSync ? 'Đang đồng bộ 3 lớp...' : 'Đồng bộ & Lưu cứng ngay'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowStorageInfo(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Layer 1: IndexedDB */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <HardDrive className="w-4 h-4 text-emerald-700" />
                  <span>1. IndexedDB (Bộ nhớ dung lượng lớn)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200/80 text-emerald-900">
                  Chính • Không giới hạn 5MB
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Lưu trữ trực tiếp trong cơ sở dữ liệu trình duyệt, chịu tải hàng chục ngàn học sinh mà không bị tràn bộ nhớ.
              </p>
              <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200/80 text-[11px] font-mono space-y-1 text-slate-700">
                <div>• DB: <strong className="text-emerald-800">{storageDiag?.idbDatabaseName || 'thcs_dongthanh_idb_v1'}</strong></div>
                <div>• Store: <strong>student_data / school_directory_v1</strong></div>
                <div>• Đang lưu: <strong className="text-emerald-700">{storageDiag ? `${storageDiag.idbStudentsCount} HS / ${storageDiag.idbClassesCount} Lớp` : `${students.length} HS`}</strong></div>
                {storageDiag?.idbUpdatedAt && (
                  <div className="text-[10px] text-slate-500">• Cập nhật: {new Date(storageDiag.idbUpdatedAt).toLocaleString('vi-VN')}</div>
                )}
              </div>
            </div>

            {/* Layer 2: LocalStorage */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <Database className="w-4 h-4 text-blue-700" />
                  <span>2. LocalStorage (Bộ nhớ tức thời)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200/80 text-blue-900">
                  Dùng chung mọi tài khoản
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Khóa lưu trữ toàn trường thống nhất giữa Cán bộ Y tế và Ban Giám hiệu trên cùng máy tính:
              </p>
              <div className="bg-white/90 p-2.5 rounded-lg border border-blue-200/80 text-[11px] font-mono space-y-1 text-slate-700">
                <div>• Key HS: <strong className="text-blue-800">thcs_dongthanh_students_v1</strong></div>
                <div>• Key Lớp: <strong className="text-blue-800">thcs_dongthanh_school_classes_v1</strong></div>
                <div>• Đang lưu: <strong className="text-blue-700">{storageDiag ? `${storageDiag.localStorageStudentsCount} HS (${storageDiag.localStorageSizeKB} KB)` : `${students.length} HS`}</strong></div>
              </div>
            </div>

            {/* Layer 3: Google Cloud Firestore */}
            <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                  <Cloud className="w-4 h-4 text-purple-700" />
                  <span>3. Google Cloud Firestore (Đám mây)</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200/80 text-purple-900">
                  {storageDiag?.cloudSyncStatus === 'synced'
                    ? '✓ Đã đồng bộ Cloud'
                    : storageDiag?.cloudSyncStatus === 'syncing'
                    ? '⟳ Đang đồng bộ...'
                    : storageDiag?.cloudSyncStatus === 'quota_protected'
                    ? '⚡ Bảo vệ Hạn mức Cloud'
                    : 'Chế độ Offline / Local'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Tự động ngắt dòng ghi lặp khi chạm ngưỡng 20.000 lượt ghi miễn phí/ngày của Google và chuyển sang lưu an toàn 100% tại IndexedDB + LocalStorage:
              </p>
              <div className="bg-white/90 p-2.5 rounded-lg border border-purple-200/80 text-[11px] font-mono space-y-1 text-slate-700">
                <div>• Project: <strong className="text-purple-800">gen-lang-client-0181503517</strong></div>
                <div className="truncate" title={storageDiag?.firestorePath}>
                  • Path: <strong className="text-purple-800">{storageDiag?.firestorePath || '/users/{uid}/students'}</strong>
                </div>
                <div>
                  • Trạng thái:{' '}
                  <strong className="text-purple-700">
                    {storageDiag?.quotaExhausted
                      ? 'Đã lưu 100% tại IndexedDB (Tạm ngắt ghi Cloud chờ reset ngày mới)'
                      : storageDiag?.cloudSyncAllowed
                      ? 'Đã kết nối tài khoản Cloud'
                      : 'Lưu cục bộ trên trình duyệt'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-medium animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-medium text-slate-500">Tổng số học sinh</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.total}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Toàn trường 4 khối</p>
        </div>

        <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200 shadow-xs">
          <p className="text-[11px] font-medium text-rose-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Theo dõi đặc biệt</span>
          </p>
          <p className="text-xl font-bold text-rose-700 mt-1">{stats.special}</p>
          <p className="text-[10px] text-rose-600/80 mt-0.5">Có dị ứng hoặc bệnh nền</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-medium text-slate-500">Khối 6</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.grade6}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {classes.filter((c) => Number(c.grade) === 6).length} lớp •{' '}
            {classes.filter((c) => Number(c.grade) === 6 && c.homeroomTeacher?.trim()).length} GVCN
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-medium text-slate-500">Khối 7</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.grade7}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {classes.filter((c) => Number(c.grade) === 7).length} lớp •{' '}
            {classes.filter((c) => Number(c.grade) === 7 && c.homeroomTeacher?.trim()).length} GVCN
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-medium text-slate-500">Khối 8</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.grade8}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {classes.filter((c) => Number(c.grade) === 8).length} lớp •{' '}
            {classes.filter((c) => Number(c.grade) === 8 && c.homeroomTeacher?.trim()).length} GVCN
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-medium text-slate-500">Khối 9</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{stats.grade9}</p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {classes.filter((c) => Number(c.grade) === 9).length} lớp •{' '}
            {classes.filter((c) => Number(c.grade) === 9 && c.homeroomTeacher?.trim()).length} GVCN
          </p>
        </div>
      </div>

      {/* Overview Ribbon: Lớp học & Giáo viên chủ nhiệm (GVCN) theo Khối */}
      <div className="bg-linear-to-r from-emerald-50/90 via-teal-50/70 to-slate-50 p-3.5 sm:p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-emerald-200/80">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-700 text-white shadow-xs shrink-0">
              <GraduationCap className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                  {selectedGrade === 'all'
                    ? `Danh Sách Lớp & Giáo Viên Chủ Nhiệm (Toàn trường: ${classes.length} lớp)`
                    : `Danh Sách Lớp & Giáo Viên Chủ Nhiệm Khối ${selectedGrade} (${classes.filter((c) => c.grade === selectedGrade).length} lớp)`}
                </h3>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  GVCN
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cán bộ y tế liên hệ Giáo viên chủ nhiệm khi học sinh đau ốm hoặc cần chuyển tuyến y tế
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsClassesRibbonExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              {isClassesRibbonExpanded ? <ChevronUp className="w-3.5 h-3.5 text-emerald-700" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />}
              <span>{isClassesRibbonExpanded ? 'Thu gọn danh sách lớp' : `Mở rộng xem ${classes.length} lớp`}</span>
            </button>
            <button
              onClick={() => setIsClassModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="Nhập danh sách GVCN theo lớp từ Excel cho nhanh"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>📥 Nhập GVCN Excel</span>
            </button>
            <button
              onClick={() => setIsClassModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{selectedGrade === 'all' ? '+ Thêm Lớp Mới' : `+ Thêm Lớp Khối ${selectedGrade}`}</span>
            </button>
          </div>
        </div>

        {/* Classes Display: Compact Row vs Full Grid */}
        {!isClassesRibbonExpanded ? (
          <div className="space-y-2 pt-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-600 font-medium mr-1">Lọc nhanh theo Khối:</span>
                {(['all', 6, 7, 8, 9] as const).map((g) => {
                  const count = g === 'all' ? classes.length : classes.filter((c) => c.grade === g).length;
                  const isSelected = selectedGrade === g && selectedClass === 'all';
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setSelectedGrade(g);
                        setSelectedClass('all');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {g === 'all' ? `Toàn trường (${count} lớp)` : `Khối ${g} (${count} lớp)`}
                    </button>
                  );
                })}
                {selectedClass !== 'all' && (
                  <span className="ml-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
                    Đang lọc Lớp {selectedClass}
                    <button
                      type="button"
                      onClick={() => setSelectedClass('all')}
                      className="hover:text-rose-600 font-bold ml-1 cursor-pointer"
                      title="Bỏ lọc lớp này"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsClassesRibbonExpanded(true)}
                className="text-xs text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Xem dạng thẻ chi tiết & SĐT từng lớp</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dải lớp học thu gọn trực quan: hiển thị rõ tên lớp, số HS, GVCN mà không bị ẩn nội dung */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
              {classes
                .filter((c) => selectedGrade === 'all' || c.grade === selectedGrade)
                .map((c) => {
                  const studentCount = students.filter(
                    (s) =>
                      s.className === c.name ||
                      normalizeStudentClassName(s.className).toLowerCase() === normalizeStudentClassName(c.name).toLowerCase()
                  ).length;
                  const isFiltered = selectedClass === c.name;
                  return (
                    <button
                      key={c.id || c.name}
                      type="button"
                      onClick={() => setSelectedClass((curr) => (curr === c.name ? 'all' : c.name))}
                      className={`shrink-0 px-3 py-1.5 rounded-xl border transition-all flex items-center gap-2 cursor-pointer text-left ${
                        isFiltered
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold ring-2 ring-emerald-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-700'
                      }`}
                      title={c.homeroomTeacher ? `GVCN: ${c.homeroomTeacher}${c.teacherPhone ? ` (${c.teacherPhone})` : ''}` : 'Chưa có GVCN'}
                    >
                      <span className="font-mono font-black text-xs px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                        {c.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {studentCount} HS
                      </span>
                      {c.homeroomTeacher && (
                        <span className="text-[11px] text-slate-600 font-medium truncate max-w-[110px] hidden sm:inline">
                          • {c.homeroomTeacher}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {classes
            .filter((c) => selectedGrade === 'all' || c.grade === selectedGrade)
            .map((c) => {
              const studentCount = students.filter(
                (s) =>
                  s.className === c.name ||
                  normalizeStudentClassName(s.className).toLowerCase() === normalizeStudentClassName(c.name).toLowerCase()
              ).length;
              const isFiltered = selectedClass === c.name;
              return (
                <div
                  key={c.id}
                  className={`bg-white p-2.5 rounded-xl border transition-all cursor-pointer relative group flex items-start justify-between ${
                    isFiltered
                      ? 'border-emerald-500 ring-2 ring-emerald-400 shadow-xs'
                      : 'border-slate-200 hover:border-emerald-300 hover:shadow-xs'
                  }`}
                  onClick={() => {
                    setSelectedClass((curr) => (curr === c.name ? 'all' : c.name));
                  }}
                  title="Bấm để lọc danh sách học sinh theo lớp này"
                >
                  <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {c.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">Khối {c.grade}</span>
                      <span className="text-[10px] text-slate-400">• {studentCount} HS</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate mt-1">
                      {c.homeroomTeacher || <span className="text-slate-400 italic">Chưa có GVCN</span>}
                    </p>
                    {c.teacherPhone ? (
                      <p className="text-[10px] text-emerald-700 flex items-center gap-1 font-mono font-semibold">
                        <Phone className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{c.teacherPhone}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Chưa có SĐT GVCN</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsClassModalOpen(true);
                    }}
                    className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors shrink-0"
                    title="Chỉnh sửa thông tin lớp & GVCN"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-student"
              type="text"
              placeholder="Tìm theo họ tên, mã học sinh (HS0001), SĐT cha, SĐT mẹ, tên cha/mẹ, mã BHYT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grade selection */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap mr-1">Khối:</span>
            {(['all', 6, 7, 8, 9] as const).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setSelectedGrade(g);
                  setSelectedClass('all');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedGrade === g
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g === 'all' ? 'Tất cả' : `Khối ${g}`}
              </button>
            ))}
          </div>

          {/* Class selection with quick + Thêm lớp button */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Lớp:</span>
            <select
              id="select-filter-class"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
            >
              <option value="all">Tất cả các lớp</option>
              {classes
                .filter((c) => selectedGrade === 'all' || c.grade === selectedGrade)
                .map((c) => (
                  <option key={c.id} value={c.name}>
                    Lớp {c.name} ({c.homeroomTeacher || 'GVCN'})
                  </option>
                ))}
            </select>
            <button
              onClick={() => setIsClassModalOpen(true)}
              className="text-[11px] font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg border border-purple-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Thêm lớp mới hoặc cập nhật Giáo viên chủ nhiệm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm lớp / Sửa GVCN</span>
            </button>
          </div>

          {/* Health Attention Filter */}
          <div className="flex items-center gap-1.5">
            <select
              id="select-filter-health"
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
            >
              <option value="all">Tất cả sức khỏe</option>
              <option value="special">⚠️ Cần theo dõi đặc biệt</option>
              <option value="normal">✓ Thể trạng bình thường</option>
            </select>
          </div>
        </div>

        {/* Filter Summary & View Mode Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-700">
              {debouncedSearch.trim() ? (
                <span>
                  Tìm thấy <strong>{filteredStudents.length}</strong> học sinh khớp từ khóa &ldquo;<strong>{debouncedSearch}</strong>&rdquo; (trên toàn trường)
                </span>
              ) : (
                <span>
                  Tìm thấy <strong>{filteredStudents.length}</strong> học sinh phù hợp
                </span>
              )}
            </span>
            {(selectedGrade !== 'all' || selectedClass !== 'all' || healthFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedGrade('all');
                  setSelectedClass('all');
                  setHealthFilter('all');
                  setSearchQuery('');
                  setDebouncedSearch('');
                }}
                className="text-emerald-700 hover:text-emerald-800 font-bold underline cursor-pointer"
              >
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>

          {/* View Mode Switcher: Thu nhỏ vừa vặn vs Bảng đầy đủ vs Lưới thẻ */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Nút Ẩn tên / Bảo mật thông tin học sinh */}
            <button
              type="button"
              onClick={() => {
                const next = db.togglePrivacyMode();
                setPrivacyMode(next);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                privacyMode
                  ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200'
                  : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
              }`}
              title={
                privacyMode
                  ? 'Đang bật chế độ ẩn tên học sinh để bảo mật. Bấm để hiển thị đầy đủ tên.'
                  : 'Bấm để ẩn tên học sinh khi trình chiếu màn hình hoặc báo cáo công khai'
              }
            >
              {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
              <span>{privacyMode ? 'Đang ẩn tên (Bảo mật)' : 'Ẩn tên HS'}</span>
            </button>

            <span className="text-slate-600 font-medium text-[11px] hidden sm:inline">Chế độ xem:</span>
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('table-compact')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table-compact'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="Bảng thu nhỏ: Tự co giãn vừa khít màn hình, không bị tràn hay mất nội dung khi thu nhỏ cửa sổ"
              >
                <List className="w-3.5 h-3.5" />
                <span>Bảng Thu Nhỏ (Vừa Màn Hình)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table-full')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table-full'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="Bảng đầy đủ: Hiện toàn bộ 12 cột thông tin chuẩn in sổ A4"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Bảng Đầy Đủ (12 Cột)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                title="Lưới thẻ: Mỗi học sinh là 1 thẻ trực quan"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Lưới Thẻ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Student List View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Banner hướng dẫn cuộn ngang khi đang ở Bảng đầy đủ */}
        {viewMode === 'table-full' && (
          <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-[11px] text-blue-900 font-medium">
            <span className="flex items-center gap-1.5">
              <span>↔ Đang mở rộng 12 cột chi tiết. Cột thao tác luôn được ghim cố định ở cạnh phải để không bị khuất.</span>
            </span>
            <button
              type="button"
              onClick={() => setViewMode('table-compact')}
              className="text-blue-700 font-bold hover:underline cursor-pointer"
            >
              Chuyển sang Bảng Thu Nhỏ
            </button>
          </div>
        )}

        {/* 1. CHẾ ĐỘ BẢNG THU NHỎ (COMPACT MODE) - HOÀN HẢO CHO MÀN HÌNH NHỎ / THU NHỎ CỬA SỔ */}
        {viewMode === 'table-compact' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 min-w-[200px]">Học sinh & Lớp</th>
                  <th className="py-3 px-3 min-w-[130px]">Ngày sinh & BHYT</th>
                  <th className="py-3 px-3 min-w-[190px]">Phụ huynh & SĐT</th>
                  <th className="py-3 px-3 min-w-[160px]">Sức khỏe & Dị ứng</th>
                  <th className="py-3 px-3 text-right min-w-[130px] whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                          <Users className="w-7 h-7" />
                        </div>
                        <h4 className="font-bold text-base text-slate-900">Chưa Có Dữ Liệu Học Sinh</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Hệ thống hiện tại chưa có danh sách học sinh. Quý Thầy/Cô có thể tải file mẫu Excel chuẩn để nạp danh sách toàn trường, hoặc bấm nút thêm từng học sinh để bắt đầu.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={handleOpenAdd}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Thêm học sinh mới</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">Không tìm thấy học sinh nào</p>
                      <p className="text-xs text-slate-400 mt-1">Thử đổi từ khóa hoặc bấm &ldquo;Xóa tất cả bộ lọc&rdquo; để tìm kiếm lại.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((stu) => {
                    const hasAllergies = stu.allergies && stu.allergies !== 'Không';
                    const hasChronic = stu.chronicConditions && stu.chronicConditions !== 'Không';
                    const isSpecial = stu.specialAttention || hasAllergies || hasChronic;
                    const isNewlyAdded = recentlyAddedId === stu.id;

                    const fatherName = stu.fatherName?.trim();
                    const fatherPhone = stu.fatherPhone?.trim();
                    const motherName = stu.motherName?.trim();
                    const motherPhone = stu.motherPhone?.trim();
                    const fallbackParentName = stu.parentName?.trim();
                    const fallbackParentPhone = stu.parentPhone?.trim();

                    return (
                      <tr
                        key={stu.id}
                        className={`transition-colors group ${
                          isNewlyAdded
                            ? 'bg-emerald-50/90 ring-2 ring-emerald-400'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* 1. Học sinh & Lớp */}
                        <td className="py-3 px-3.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="font-bold text-slate-900 text-sm"
                                title={privacyMode ? 'Đang bật bảo mật ẩn tên (Bấm nút trên thanh công cụ để hiện)' : stu.fullName}
                              >
                                {maskStudentName(stu.fullName, privacyMode)}
                              </span>
                              {stu.bloodType && (
                                <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                                  {stu.bloodType}
                                </span>
                              )}
                              {isNewlyAdded && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white animate-pulse">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>Vừa thêm mới</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200 font-semibold text-[11px]">
                                {stu.studentCode}
                              </span>
                              <span className="font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono text-[11px]">
                                Lớp {stu.className}
                              </span>
                              <span className="text-slate-500 text-[11px]">{stu.gender}</span>
                            </div>
                            {stu.notes && <p className="text-[11px] text-slate-400 italic">{stu.notes}</p>}
                          </div>
                        </td>

                        {/* 2. Ngày sinh & BHYT */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5 text-xs">
                            <div className="font-medium font-mono text-slate-700">
                              {formatDateVN(stu.birthDate) || '—'}
                            </div>
                            {stu.healthInsuranceCode ? (
                              <div className="font-mono text-[10px] text-slate-500">
                                BHYT: <span className="text-slate-800 font-semibold">{stu.healthInsuranceCode}</span>
                              </div>
                            ) : null}
                            {stu.citizenId ? (
                              <div className="font-mono text-[10px] text-slate-400">
                                ĐD: {stu.citizenId}
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* 3. Phụ huynh & SĐT (Đầy đủ, có nút gọi trực tiếp) */}
                        <td className="py-3 px-3">
                          <div className="space-y-1.5 text-xs">
                            {fatherName || fatherPhone ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-800 text-[11px]">
                                  Cha: {fatherName || 'Chưa ghi tên'}
                                </span>
                                {fatherPhone && (
                                  <a
                                    href={`tel:${fatherPhone.replace(/\s+/g, '')}`}
                                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                                    title="Bấm để gọi cha"
                                  >
                                    <Phone className="w-2.5 h-2.5 text-blue-600" />
                                    <span>{fatherPhone}</span>
                                  </a>
                                )}
                              </div>
                            ) : null}

                            {motherName || motherPhone ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-800 text-[11px]">
                                  Mẹ: {motherName || 'Chưa ghi tên'}
                                </span>
                                {motherPhone && (
                                  <a
                                    href={`tel:${motherPhone.replace(/\s+/g, '')}`}
                                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-pink-700 hover:text-pink-900 bg-pink-50 px-2 py-0.5 rounded border border-pink-200"
                                    title="Bấm để gọi mẹ"
                                  >
                                    <Phone className="w-2.5 h-2.5 text-pink-600" />
                                    <span>{motherPhone}</span>
                                  </a>
                                )}
                              </div>
                            ) : null}

                            {!fatherName && !fatherPhone && !motherName && !motherPhone && fallbackParentName ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-800 text-[11px]">
                                  PH: {fallbackParentName}
                                </span>
                                {fallbackParentPhone && (
                                  <a
                                    href={`tel:${fallbackParentPhone.replace(/\s+/g, '')}`}
                                    className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                                  >
                                    <Phone className="w-2.5 h-2.5 text-blue-600" />
                                    <span>{fallbackParentPhone}</span>
                                  </a>
                                )}
                              </div>
                            ) : null}

                            {!fatherName && !fatherPhone && !motherName && !motherPhone && !fallbackParentName && (
                              <span className="text-slate-400 italic text-[11px]">Chưa có thông tin phụ huynh</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Sức khỏe & Cảnh báo */}
                        <td className="py-3 px-3">
                          {isSpecial ? (
                            <div className="space-y-1">
                              {hasAllergies && (
                                <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span>Dị ứng: {stu.allergies}</span>
                                </div>
                              )}
                              {hasChronic && (
                                <div className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  <Info className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Bệnh nền: {stu.chronicConditions}</span>
                                </div>
                              )}
                              {!hasAllergies && !hasChronic && stu.specialAttention && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  ⚠️ Cần theo dõi đặc biệt
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Bình thường</span>
                            </span>
                          )}
                        </td>

                        {/* 5. Thao tác */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Tiếp nhận khám */}
                            <button
                              title="Tiếp nhận vào phòng y tế ngay"
                              onClick={() => onSelectStudentForIntake?.(stu.id)}
                              className="px-2.5 py-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-300 bg-emerald-50 cursor-pointer font-bold inline-flex items-center gap-1 text-xs"
                            >
                              <Stethoscope className="w-3.5 h-3.5 text-emerald-700" />
                              <span className="hidden sm:inline">Khám</span>
                            </button>

                            {/* Xem hồ sơ */}
                            <button
                              title="Xem hồ sơ sức khỏe chi tiết"
                              onClick={() => onSelectStudentForProfile?.(stu.id)}
                              className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 bg-blue-50 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Chỉnh sửa */}
                            <button
                              title="Chỉnh sửa thông tin học sinh"
                              onClick={() => handleOpenEdit(stu)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Xóa */}
                            <button
                              title="Xóa học sinh"
                              onClick={() => setDeleteConfirmStudent(stu)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {/* 2. CHẾ ĐỘ BẢNG ĐẦY ĐỦ (12 CỘT) VỚI CỘT THAO TÁC GHIM CỐ ĐỊNH PHẢI */}
        {viewMode === 'table-full' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 whitespace-nowrap">Mã HS</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Họ và tên</th>
                  <th className="py-3 px-3 whitespace-nowrap">Lớp</th>
                  <th className="py-3 px-3 whitespace-nowrap">Giới tính</th>
                  <th className="py-3 px-3 whitespace-nowrap">
                    <div>Ngày sinh</div>
                    <div className="text-[9px] font-medium text-emerald-700 normal-case tracking-normal">ngày/tháng/năm</div>
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">Mã BHYT</th>
                  {parentColMode === 'separated' ? (
                    <>
                      <th className="py-3 px-3 bg-blue-50/70 text-blue-900 border-l border-blue-100 whitespace-nowrap">Họ tên cha</th>
                      <th className="py-3 px-3 bg-blue-50/70 text-blue-900 whitespace-nowrap">SĐT cha</th>
                      <th className="py-3 px-3 bg-pink-50/70 text-pink-900 border-l border-pink-100 whitespace-nowrap">Họ tên mẹ</th>
                      <th className="py-3 px-3 bg-pink-50/70 text-pink-900 whitespace-nowrap">SĐT mẹ</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-3 bg-blue-50/50 text-blue-900 border-l border-blue-100 whitespace-nowrap">Thông tin Cha (Tên & SĐT)</th>
                      <th className="py-3 px-3 bg-pink-50/50 text-pink-900 border-l border-pink-100 whitespace-nowrap">Thông tin Mẹ (Tên & SĐT)</th>
                    </>
                  )}
                  <th className="py-3 px-3 whitespace-nowrap">Sức khỏe & Dị ứng</th>
                  {/* Sticky right Thao tác column so it NEVER disappears when scrolling */}
                  <th className="sticky right-0 bg-slate-50 z-10 py-3 px-3 text-right whitespace-nowrap shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)] border-l border-slate-200">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={parentColMode === 'separated' ? 12 : 10} className="py-14 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-14 h-14 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                          <Users className="w-7 h-7" />
                        </div>
                        <h4 className="font-bold text-base text-slate-900">Chưa Có Dữ Liệu Học Sinh</h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Hệ thống hiện tại chưa có danh sách học sinh. Quý Thầy/Cô có thể tải file mẫu Excel chuẩn để nạp danh sách toàn trường.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={parentColMode === 'separated' ? 12 : 10} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">Không tìm thấy học sinh nào</p>
                      <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bấm &ldquo;Xóa tất cả bộ lọc&rdquo;.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((stu) => {
                    const hasAllergies = stu.allergies && stu.allergies !== 'Không';
                    const hasChronic = stu.chronicConditions && stu.chronicConditions !== 'Không';
                    const isSpecial = stu.specialAttention || hasAllergies || hasChronic;
                    const isNewlyAdded = recentlyAddedId === stu.id;

                    const fatherNameDisplay = stu.fatherName || stu.parentName || '—';
                    const fatherPhoneDisplay = stu.fatherPhone || stu.parentPhone || '';
                    const motherNameDisplay = stu.motherName || '—';
                    const motherPhoneDisplay = stu.motherPhone || '';

                    return (
                      <tr
                        key={stu.id}
                        className={`transition-colors group ${
                          isNewlyAdded ? 'bg-emerald-50/90 ring-2 ring-emerald-400' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 border border-slate-200">
                            {stu.studentCode}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span title={privacyMode ? 'Đang bật bảo mật ẩn tên (Bấm nút trên thanh công cụ để hiện)' : stu.fullName}>
                              {maskStudentName(stu.fullName, privacyMode)}
                            </span>
                            {stu.bloodType && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                                {stu.bloodType}
                              </span>
                            )}
                            {isNewlyAdded && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-600 text-white">
                                Mới
                              </span>
                            )}
                          </div>
                          {stu.notes && <p className="text-[10px] text-slate-400 truncate max-w-xs">{stu.notes}</p>}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono">
                            {stu.className}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{stu.gender}</td>

                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap font-medium font-mono text-[11.5px]">
                          {formatDateVN(stu.birthDate) || '—'}
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                          {stu.healthInsuranceCode || <span className="text-slate-300">—</span>}
                        </td>

                        {parentColMode === 'separated' ? (
                          <>
                            <td className="py-3 px-3 whitespace-nowrap bg-blue-50/30 border-l border-blue-50">
                              <span className="font-semibold text-slate-900">{fatherNameDisplay}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap bg-blue-50/30">
                              {fatherPhoneDisplay ? (
                                <a
                                  href={`tel:${fatherPhoneDisplay.replace(/\s+/g, '')}`}
                                  className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white px-2 py-0.5 rounded border border-blue-200 shadow-2xs"
                                >
                                  <Phone className="w-3 h-3 text-blue-500" />
                                  <span>{fatherPhoneDisplay}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap bg-pink-50/30 border-l border-pink-50">
                              <span className="font-semibold text-slate-900">{motherNameDisplay}</span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap bg-pink-50/30">
                              {motherPhoneDisplay ? (
                                <a
                                  href={`tel:${motherPhoneDisplay.replace(/\s+/g, '')}`}
                                  className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-pink-700 hover:text-pink-900 bg-white px-2 py-0.5 rounded border border-pink-200 shadow-2xs"
                                >
                                  <Phone className="w-3 h-3 text-pink-500" />
                                  <span>{motherPhoneDisplay}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-3 whitespace-nowrap bg-blue-50/20 border-l border-blue-50">
                              <p className="font-semibold text-slate-900">{fatherNameDisplay}</p>
                              {fatherPhoneDisplay && (
                                <a
                                  href={`tel:${fatherPhoneDisplay.replace(/\s+/g, '')}`}
                                  className="text-[11px] text-blue-700 hover:underline flex items-center gap-1 font-mono font-semibold mt-0.5"
                                >
                                  <Phone className="w-3 h-3 text-blue-500" />
                                  <span>{fatherPhoneDisplay}</span>
                                </a>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap bg-pink-50/20 border-l border-pink-50">
                              <p className="font-semibold text-slate-900">{motherNameDisplay}</p>
                              {motherPhoneDisplay && (
                                <a
                                  href={`tel:${motherPhoneDisplay.replace(/\s+/g, '')}`}
                                  className="text-[11px] text-pink-700 hover:underline flex items-center gap-1 font-mono font-semibold mt-0.5"
                                >
                                  <Phone className="w-3 h-3 text-pink-500" />
                                  <span>{motherPhoneDisplay}</span>
                                </a>
                              )}
                            </td>
                          </>
                        )}

                        <td className="py-3 px-3 max-w-xs whitespace-nowrap">
                          {isSpecial ? (
                            <div className="space-y-1">
                              {hasAllergies && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span className="truncate max-w-[180px]">Dị ứng: {stu.allergies}</span>
                                </span>
                              )}
                              {hasChronic && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  <Info className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="truncate max-w-[180px]">{stu.chronicConditions}</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              <Check className="w-3 h-3 text-slate-400" />
                              <span>Bình thường</span>
                            </span>
                          )}
                        </td>

                        {/* Sticky right Actions column */}
                        <td className="sticky right-0 bg-white group-hover:bg-slate-50 z-10 py-3 px-3 text-right whitespace-nowrap shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)] border-l border-slate-200">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              title="Tiếp nhận vào phòng y tế"
                              onClick={() => onSelectStudentForIntake?.(stu.id)}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 bg-emerald-50 cursor-pointer"
                            >
                              <Stethoscope className="w-4 h-4" />
                            </button>
                            <button
                              title="Xem hồ sơ sức khỏe chi tiết"
                              onClick={() => onSelectStudentForProfile?.(stu.id)}
                              className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 bg-blue-50 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              title="Chỉnh sửa thông tin học sinh"
                              onClick={() => handleOpenEdit(stu)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Xóa học sinh"
                              onClick={() => setDeleteConfirmStudent(stu)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        )}

        {/* 3. CHẾ ĐỘ LƯỚI THẺ (CARDS MODE) - TRỰC QUAN CHO MỌI THIẾT BỊ */}
        {viewMode === 'cards' && (
          <div className="p-4">
            {students.length === 0 ? (
              <div className="py-12 text-center text-slate-400">Chưa có dữ liệu học sinh</div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-12 text-center text-slate-400">Không tìm thấy học sinh nào phù hợp</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {paginatedStudents.map((stu) => {
                  const hasAllergies = stu.allergies && stu.allergies !== 'Không';
                  const hasChronic = stu.chronicConditions && stu.chronicConditions !== 'Không';
                  const isSpecial = stu.specialAttention || hasAllergies || hasChronic;
                  const isNewlyAdded = recentlyAddedId === stu.id;

                  const parentDisplay =
                    stu.fatherPhone
                      ? `Cha: ${stu.fatherName || 'PH'} (${stu.fatherPhone})`
                      : stu.motherPhone
                      ? `Mẹ: ${stu.motherName || 'PH'} (${stu.motherPhone})`
                      : stu.parentPhone
                      ? `PH: ${stu.parentName || 'PH'} (${stu.parentPhone})`
                      : 'Chưa có SĐT PH';

                  return (
                    <div
                      key={stu.id}
                      className={`p-3.5 rounded-2xl border transition-all space-y-2.5 ${
                        isNewlyAdded
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-bold text-slate-900 text-sm"
                              title={privacyMode ? 'Đang bật bảo mật ẩn tên (Bấm nút trên thanh công cụ để hiện)' : stu.fullName}
                            >
                              {maskStudentName(stu.fullName, privacyMode)}
                            </span>
                            {stu.bloodType && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                                {stu.bloodType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                              {stu.studentCode}
                            </span>
                            <span className="font-bold px-2 py-0.2 rounded bg-emerald-100 text-emerald-900 text-[11px]">
                              Lớp {stu.className}
                            </span>
                            <span className="text-slate-500 text-[11px]">• {stu.gender}</span>
                          </div>
                        </div>

                        {isNewlyAdded && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            Mới thêm
                          </span>
                        )}
                      </div>

                      <div className="text-xs space-y-1 text-slate-600 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span>Ngày sinh:</span>
                          <span className="font-mono font-semibold">{formatDateVN(stu.birthDate) || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Liên hệ PH:</span>
                          <span className="font-medium text-blue-700 truncate max-w-[170px]">{parentDisplay}</span>
                        </div>
                        {isSpecial ? (
                          <div className="pt-1">
                            {hasAllergies && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 mr-1 mb-1">
                                ⚠️ Dị ứng: {stu.allergies}
                              </span>
                            )}
                            {hasChronic && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                Bệnh: {stu.chronicConditions}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => onSelectStudentForIntake?.(stu.id)}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Tiếp nhận khám</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            title="Xem hồ sơ sức khỏe"
                            onClick={() => onSelectStudentForProfile?.(stu.id)}
                            className="p-1.5 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 bg-blue-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Sửa học sinh"
                            onClick={() => handleOpenEdit(stu)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Xóa học sinh"
                            onClick={() => setDeleteConfirmStudent(stu)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pagination Toolbar */}
        {filteredStudents.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700"
              >
                <option value={25}>25 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
                <option value={9999}>Tất cả ({filteredStudents.length})</option>
              </select>
              <span>
                (<strong>{(safeCurrentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(safeCurrentPage * pageSize, filteredStudents.length)}</strong> trong số <strong>{filteredStudents.length}</strong> học sinh)
              </span>
            </div>

            {totalPages > 1 && pageSize < 9999 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Trước
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && safeCurrentPage > 3) {
                      pageNum = safeCurrentPage - 2 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold cursor-pointer ${
                          safeCurrentPage === pageNum
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto p-2 sm:p-6 flex items-start sm:items-center justify-center backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingStudent ? 'Chỉnh Sửa Thông Tin Học Sinh' : 'Thêm Học Sinh Mới'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Trường THCS Đông Thạnh • Niên khóa 2026-2027</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{errorMessage}</span>
                  </div>
                )}

              {/* Row 1: Code, Name, Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã học sinh <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.studentCode}
                    onChange={(e) => setFormData({ ...formData, studentCode: e.target.value.toUpperCase() })}
                    placeholder="HS0001"
                    className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 uppercase focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Họ và tên học sinh <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Nguyễn Văn An"
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Row 2: Class, Grade, BirthDate, Gender */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lớp <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formData.className}
                    onChange={(e) => {
                      const cls = e.target.value;
                      const grade = parseInt(cls.charAt(0), 10) || 6;
                      setFormData({ ...formData, className: cls, grade });
                    }}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                {/* Birth Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Ngày sinh <span className="text-emerald-700 font-normal">(ngày/tháng/năm)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">DD/MM/YYYY</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="VD: 10/05/2014 hoặc 10-05-2014"
                      value={birthDateText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBirthDateText(val);
                        const iso = normalizeDateToISO(val);
                        if (iso && iso.length === 10) {
                          setFormData((prev) => ({ ...prev, birthDate: iso }));
                        }
                      }}
                      className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                    />
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({ ...prev, birthDate: val }));
                        setBirthDateText(formatDateVN(val));
                      }}
                      className="w-10 h-[34px] px-1 text-xs border border-slate-200 rounded-xl bg-slate-50 cursor-pointer text-slate-600 shrink-0"
                      title="Chọn ngày từ lịch"
                    />
                  </div>
                  {formData.birthDate && (
                    <div className="mt-1.5 p-2 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between text-[11px] text-emerald-900">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="text-emerald-700 font-semibold shrink-0">Công thức:</span>
                        <span className="font-bold truncate">{formatDateFormulaVN(formData.birthDate)}</span>
                      </div>
                      <span className="font-mono font-bold bg-white text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-300 shrink-0">
                        {formatDateVN(formData.birthDate)}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nhóm máu</label>
                  <select
                    value={formData.bloodType}
                    onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-red-700"
                  >
                    <option value="O">Nhóm O</option>
                    <option value="A">Nhóm A</option>
                    <option value="B">Nhóm B</option>
                    <option value="AB">Nhóm AB</option>
                    <option value="Chưa rõ">Chưa rõ</option>
                  </select>
                </div>
              </div>

              {/* Row 3: BHYT & CCCD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mã thẻ BHYT</label>
                  <input
                    type="text"
                    value={formData.healthInsuranceCode}
                    onChange={(e) => setFormData({ ...formData, healthInsuranceCode: e.target.value })}
                    placeholder="GD4790123456789"
                    className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mã định danh / CCCD</label>
                  <input
                    type="text"
                    value={formData.citizenId}
                    onChange={(e) => setFormData({ ...formData, citizenId: e.target.value })}
                    placeholder="079214001234"
                    className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Row 4: Dedicated Father & Mother info */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Thông tin Phụ huynh (Cha & Mẹ)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Dùng để liên hệ khẩn cấp khi học sinh đau ốm</span>
                </div>

                {/* Thông tin Cha */}
                <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-1">
                      Họ và tên cha
                    </label>
                    <input
                      type="text"
                      value={formData.fatherName}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      placeholder="VD: Nguyễn Văn Thắng"
                      className="w-full text-xs border border-blue-200 bg-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-1">
                      Số điện thoại cha
                    </label>
                    <input
                      type="text"
                      value={formData.fatherPhone}
                      onChange={(e) => setFormData({ ...formData, fatherPhone: e.target.value })}
                      placeholder="VD: 0912 345 678"
                      className="w-full text-xs font-mono border border-blue-200 bg-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                {/* Thông tin Mẹ */}
                <div className="p-2.5 bg-pink-50/60 rounded-xl border border-pink-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-pink-950 mb-1">
                      Họ và tên mẹ
                    </label>
                    <input
                      type="text"
                      value={formData.motherName}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      placeholder="VD: Lê Thị Thu"
                      className="w-full text-xs border border-pink-200 bg-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-pink-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-pink-950 mb-1">
                      Số điện thoại mẹ
                    </label>
                    <input
                      type="text"
                      value={formData.motherPhone}
                      onChange={(e) => setFormData({ ...formData, motherPhone: e.target.value })}
                      placeholder="VD: 0987 654 321"
                      className="w-full text-xs font-mono border border-pink-200 bg-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-pink-500 font-medium"
                    />
                  </div>
                </div>

                {/* Người đại diện chính (tùy chọn) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phụ huynh đại diện chính (hoặc tự động theo Cha/Mẹ)
                    </label>
                    <input
                      type="text"
                      value={formData.parentName}
                      onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                      placeholder={formData.fatherName || formData.motherName || 'Tự động lấy tên cha/mẹ'}
                      className="w-full text-xs border border-slate-200 bg-white rounded-xl px-3 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Số điện thoại đại diện chính
                    </label>
                    <input
                      type="text"
                      value={formData.parentPhone}
                      onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                      placeholder={formData.fatherPhone || formData.motherPhone || 'Tự động lấy SĐT cha/mẹ'}
                      className="w-full text-xs font-mono border border-slate-200 bg-white rounded-xl px-3 py-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Địa chỉ thường trú</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ấp 1, Xã Đông Thạnh, Huyện Hóc Môn, TP.HCM"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              {/* Section: Medical Alert / Allergies / Chronic conditions */}
              <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-rose-900 uppercase">
                    Thông tin y tế đặc biệt & Cảnh báo an toàn
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-rose-900 mb-1">
                      Tiền sử dị ứng (Thuốc, thức ăn, phấn hoa...)
                    </label>
                    <input
                      type="text"
                      value={formData.allergies}
                      onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                      placeholder="VD: Dị ứng Penicillin, dị ứng tôm cua..."
                      className="w-full text-xs border border-rose-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-rose-500 font-medium text-rose-900 placeholder:text-rose-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-rose-900 mb-1">
                      Bệnh nền mạn tính (Hen suyễn, tim mạch, dạ dày...)
                    </label>
                    <input
                      type="text"
                      value={formData.chronicConditions}
                      onChange={(e) => setFormData({ ...formData, chronicConditions: e.target.value })}
                      placeholder="VD: Hen phế quản, cận thị nặng..."
                      className="w-full text-xs border border-rose-300 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-rose-500 font-medium text-rose-900 placeholder:text-rose-300"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="chk-special-attention"
                    checked={formData.specialAttention}
                    onChange={(e) => setFormData({ ...formData, specialAttention: e.target.checked })}
                    className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
                  />
                  <label htmlFor="chk-special-attention" className="text-xs font-semibold text-rose-900 cursor-pointer">
                    Đánh dấu học sinh cần theo dõi sức khỏe đặc biệt tại phòng y tế
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú thêm</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú sở thích, thói quen hoặc lưu ý từ giáo viên chủ nhiệm..."
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {editingStudent ? 'Lưu cập nhật' : 'Xác nhận thêm học sinh'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto p-2 sm:p-6 flex items-start sm:items-center justify-center backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Import Danh Sách Học Sinh Từ Excel / CSV</h3>
                  <p className="text-[11px] text-slate-500">Tải lên danh sách học sinh theo khối hoặc theo lớp</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Sample file download banner */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Info className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="text-xs text-blue-900">
                    <p className="font-bold">Mẫu định dạng chuẩn Excel/CSV (Hỗ trợ công thức ngày/tháng/năm)</p>
                    <p className="text-blue-700 text-[11px] leading-relaxed">
                      Cột <strong>Ngày sinh</strong> hỗ trợ linh hoạt: <strong>ngày/tháng/năm (DD/MM/YYYY)</strong> (VD: <em>10/05/2014</em>, <em>10-05-2014</em>), công thức văn bản (VD: <em>ngày 10 tháng 5 năm 2014</em>), hoặc công thức tính ngày Excel như <code>=DATE(2014, 5, 10)</code>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-semibold shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải tệp mẫu</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-800">
                  Kéo thả tệp Excel hoặc CSV vào đây hoặc bấm để chọn tệp
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Hỗ trợ định dạng <strong>Excel 97-2003 Workbook (.xls)</strong>, Excel (.xlsx) và .csv
                </p>
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={handleFileUpload}
                  className="mt-3 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
              </div>

              {importFileName && (
                <p className="text-xs text-slate-600">
                  Tệp đã chọn: <strong>{importFileName}</strong> ({importRows.length} dòng dữ liệu)
                </p>
              )}

              {/* Multi-sheet selection if workbook has multiple sheets */}
              {detectedSheets.length > 1 && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                      <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                      <span>Phát hiện {detectedSheets.length} trang tính (sheet) trong tệp Excel:</span>
                    </div>
                    <span className="text-[11px] text-blue-700 font-semibold">
                      Đang chọn: {selectedImportSheet === 'all' ? 'Toàn trường (đồng bộ tất cả các khối)' : selectedImportSheet}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedImportSheet('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedImportSheet === 'all'
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-white text-blue-800 border border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      Toàn trường ({importRows.length} HS)
                    </button>
                    {detectedSheets.map((sh) => (
                      <button
                        key={sh.name}
                        type="button"
                        onClick={() => setSelectedImportSheet(sh.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedImportSheet === sh.name
                            ? 'bg-blue-700 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sh.name} ({sh.count} HS)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Grade distribution breakdown */}
              {importRows.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Phân bổ học sinh theo 4 Khối ({selectedImportSheet === 'all' ? importRows.length : importRows.filter(r => r._sheetName === selectedImportSheet).length} HS):
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                      ✓ Đã nhận diện đúng từng khối
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[6, 7, 8, 9].map((g) => {
                      const rowsForCount = selectedImportSheet === 'all' ? importRows : importRows.filter(r => r._sheetName === selectedImportSheet);
                      const cnt = rowsForCount.filter(
                        (r) => extractGradeFromClassOrGrade(r['Khối'] || r['grade'], r['Lớp'] || r['className'], r['_sheetName']) === g
                      ).length;
                      return (
                        <div key={g} className="bg-white border border-slate-200 p-2 rounded-lg text-center shadow-2xs">
                          <span className="text-[11px] font-semibold text-slate-500">Khối {g}</span>
                          <p className="text-sm font-bold text-slate-900 mt-0.5">{cnt} HS</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sync Options */}
              {importRows.length > 0 && (
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-bold text-slate-800">Chế độ đồng bộ dữ liệu khi tải lên:</p>
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-700 select-none">
                    <input
                      type="radio"
                      name="importSyncMode"
                      checked={!replaceAllOnImport}
                      onChange={() => {
                        setReplaceAllOnImport(false);
                        setUpdateExistingStudents(true);
                      }}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span>
                      <strong>Cập nhật & Bổ sung vào danh sách hiện tại (Khuyên dùng khi tải từng lớp/khối):</strong> Giữ nguyên học sinh các lớp khác, tự động nhận diện học sinh trùng Mã HS hoặc trùng (Họ tên + Lớp) để cập nhật thông tin, không tạo bản ghi trùng lặp.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-rose-800 select-none pt-1">
                    <input
                      type="radio"
                      name="importSyncMode"
                      checked={replaceAllOnImport}
                      onChange={() => {
                        setReplaceAllOnImport(true);
                        setUpdateExistingStudents(true);
                      }}
                      className="mt-0.5 w-4 h-4 text-rose-600 border-slate-300 focus:ring-rose-500"
                    />
                    <span>
                      <strong>Thay thế toàn bộ danh sách cũ bằng tệp Excel này:</strong> Xóa sạch danh sách học sinh mẫu/cũ trước khi nạp mới để tổng số học sinh khớp 100% với tệp Excel vừa đưa lên.
                    </span>
                  </label>
                </div>
              )}

              {/* Errors Display */}
              {importErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-rose-800 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Lỗi phát hiện trong quá trình xử lý:</span>
                  </p>
                  <ul className="list-disc pl-5 text-[11px] text-rose-700 max-h-28 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Success summary */}
              {(importSuccessCount !== null || importUpdatedCount !== null) && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Đã đồng bộ thành công! {importSuccessCount !== null ? `${importSuccessCount} học sinh mới` : ''}
                    {importUpdatedCount ? `, cập nhật ${importUpdatedCount} học sinh` : ''} vào cơ sở dữ liệu và Cloud.
                  </span>
                </div>
              )}

              {/* Preview Table */}
              {importRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 flex justify-between">
                    <span>
                      Xem trước dữ liệu ({selectedImportSheet === 'all' ? importRows.length : importRows.filter(r => r._sheetName === selectedImportSheet).length} học sinh)
                    </span>
                    <span className="text-slate-500 text-[11px]">Hiển thị 6 dòng mẫu</span>
                  </div>
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          {detectedSheets.length > 1 && <th className="py-2 px-2">Sheet</th>}
                          <th className="py-2 px-2">Khối</th>
                          <th className="py-2 px-2">Lớp</th>
                          <th className="py-2 px-2.5">Mã HS</th>
                          <th className="py-2 px-2.5">Họ và tên</th>
                          <th className="py-2 px-2">Giới tính</th>
                          <th className="py-2 px-2">Ngày sinh (ngày/tháng/năm)</th>
                          <th className="py-2 px-2">GVCN</th>
                          <th className="py-2 px-2">SĐT PH</th>
                          <th className="py-2 px-2">Dị ứng / Bệnh nền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedImportSheet === 'all'
                          ? importRows
                          : importRows.filter((r) => r._sheetName === selectedImportSheet)
                        )
                          .slice(0, 6)
                          .map((r, i) => {
                            const detectedGrade = extractGradeFromClassOrGrade(
                              r['Khối'] || r['grade'],
                              r['Lớp'] || r['className'],
                              r['_sheetName']
                            );
                            const cleanCls = normalizeStudentClassName(r['Lớp'] || r['className'] || r['Lop']) || `${detectedGrade}/1`;
                            return (
                              <tr key={i} className="hover:bg-slate-50">
                                {detectedSheets.length > 1 && (
                                  <td className="py-1.5 px-2 text-slate-500 font-mono text-[10px]">
                                    {r._sheetName || '—'}
                                  </td>
                                )}
                                <td className="py-1.5 px-2 font-bold text-slate-800">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                                    Khối {detectedGrade}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 font-bold text-emerald-700">
                                  {cleanCls}
                                </td>
                                <td className="py-1.5 px-2.5 font-mono font-bold text-slate-800">
                                  {r['Mã học sinh'] || r['studentCode'] || r['MaHS'] || (
                                    <span className="text-slate-400 italic text-[10px]">Tự tạo mã</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2.5 font-medium text-slate-800">
                                  {r['Họ và tên'] || r['fullName'] || r['HoTen']}
                                </td>
                                <td className="py-1.5 px-2 text-slate-600">
                                  {r['Giới tính'] || r['gender'] || 'Nam'}
                                </td>
                                <td className="py-1.5 px-2 font-mono text-slate-700">
                                  {formatDateVN(r['Ngày sinh (ngày/tháng/năm)'] || r['Ngày sinh'] || r['birthDate']) || '—'}
                                </td>
                                <td className="py-1.5 px-2 text-purple-700 font-semibold">
                                  {r['GVCN'] || r['Giáo viên chủ nhiệm'] || '—'}
                                </td>
                                <td className="py-1.5 px-2 font-mono text-slate-600">
                                  {r['SĐT phụ huynh'] || r['parentPhone'] || '—'}
                                </td>
                                <td className="py-1.5 px-2 text-rose-700 font-medium">
                                  {r['Dị ứng'] || r['allergies'] || r['Bệnh nền'] || 'Không'}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={importRows.length === 0 || isImporting}
                onClick={handleConfirmImport}
                className="px-5 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đồng bộ dữ liệu vào hệ thống...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>
                      Xác nhận Import & Đồng bộ (
                      {selectedImportSheet === 'all'
                        ? importRows.length
                        : importRows.filter((r) => r._sheetName === selectedImportSheet).length}{' '}
                      học sinh)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Sample Data Modal (for Production Publishing) */}
      {showCleanModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto p-3 flex items-start sm:items-center justify-center backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Làm Sạch Học Sinh, Lớp & GVCN</h3>
                <p className="text-xs text-slate-500">Chuẩn bị xuất bản ứng dụng để nhập dữ liệu thực tế</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2.5 my-3">
              <p className="font-bold text-slate-900">
                Chọn các danh mục dữ liệu bạn muốn làm sạch:
              </p>
              <div className="space-y-2 bg-white/80 p-2.5 rounded-lg border border-rose-200">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={cleanOptions.clearStudents}
                    onChange={(e) =>
                      setCleanOptions((prev) => ({ ...prev, clearStudents: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Xóa danh sách học sinh & hồ sơ sức khỏe ({students.length} HS)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={cleanOptions.clearClasses}
                    onChange={(e) =>
                      setCleanOptions((prev) => ({ ...prev, clearClasses: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Xóa danh sách lớp học & phân công GVCN ({classes.length} lớp)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={cleanOptions.clearVisitsAndEvents}
                    onChange={(e) =>
                      setCleanOptions((prev) => ({ ...prev, clearVisitsAndEvents: e.target.checked }))
                    }
                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>Xóa lịch sử lượt khám & sự kiện y tế mẫu ({db.getClinicVisits().length} lượt)</span>
                </label>
              </div>

              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Kho thuốc, các lô hạn dùng và vật tư y tế vẫn được giữ nguyên an toàn 100%.</span>
              </div>

              <p className="text-[11px] text-slate-600 italic">
                Sau khi làm sạch, bạn có thể tự do thêm lớp mới, tải file Excel danh sách học sinh và phân công GVCN thực tế của trường.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowCleanModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={
                  !cleanOptions.clearStudents &&
                  !cleanOptions.clearClasses &&
                  !cleanOptions.clearVisitsAndEvents
                }
                onClick={handleCleanData}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                Xác nhận làm sạch dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmStudent && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Học Sinh</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa học sinh <strong>{deleteConfirmStudent.fullName}</strong> (Mã:{' '}
              {deleteConfirmStudent.studentCode}) khỏi hệ thống?
            </p>
            <p className="text-[11px] text-rose-600 font-medium mt-2 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              Lưu ý: Nếu học sinh đã có lịch sử khám bệnh tại phòng y tế, hệ thống sẽ ngăn chặn việc xóa để bảo vệ tính
              toàn vẹn y bạ học đường.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setDeleteConfirmStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quản lý Lớp học & Giáo viên chủ nhiệm (GVCN) */}
      <ClassManagementModal
        isOpen={isClassModalOpen}
        onClose={() => {
          setIsClassModalOpen(false);
          refreshList();
        }}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          refreshList();
          setTimeout(() => setSuccessMessage(null), 4000);
        }}
      />
    </div>
  );
};
