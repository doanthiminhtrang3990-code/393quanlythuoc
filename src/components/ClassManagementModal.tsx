import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Users,
  Check,
  AlertTriangle,
  MapPin,
  X,
  Building,
  FileSpreadsheet,
  Upload,
  Download,
  ClipboardPaste,
  CheckCircle2,
  ArrowRight,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  UserCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  db,
  normalizeClassName,
  areClassesEquivalent,
  isInvalidOrRedundantClassName,
} from '../services/db';
import { SchoolClass } from '../types';
import {
  exportHomeroomTeachersTemplateExcel,
  exportClassesAndTeachersExcel,
} from '../services/excelService';

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface ParsedClassRow {
  name: string;
  grade: number;
  homeroomTeacher: string;
  teacherPhone: string;
  room: string;
  isExisting: boolean;
  originalTeacher?: string;
  originalPhone?: string;
  originalRoom?: string;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [classes, setClasses] = useState<SchoolClass[]>(() => db.getSchoolClasses());
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number>(6);
  const [homeroomTeacher, setHomeroomTeacher] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [room, setRoom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [localSuccessMsg, setLocalSuccessMsg] = useState<string | null>(null);

  // Multi-selection for batch operations
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // Delete confirm state (single class)
  const [deleteConfirmClass, setDeleteConfirmClass] = useState<SchoolClass | null>(null);
  const [reassignDestClassId, setReassignDestClassId] = useState<string>('');

  // Bulk Delete Confirmation Modal
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkReassignDestClassId, setBulkReassignDestClassId] = useState<string>('');

  // Redundant Classes Cleanup Modal
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [selectedRedundantIds, setSelectedRedundantIds] = useState<string[]>([]);

  // Clean all classes modal for production publishing
  const [isCleanAllModalOpen, setIsCleanAllModalOpen] = useState(false);

  // Quick Grade 6 GVCN Assignment Modal
  const [isQuickK6ModalOpen, setIsQuickK6ModalOpen] = useState(false);
  const [k6FormRows, setK6FormRows] = useState<
    { id: string; name: string; homeroomTeacher: string; teacherPhone: string; room: string }[]
  >([]);

  // Excel / Fast Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInputMode, setImportInputMode] = useState<'file' | 'paste'>('file');
  const [importFileName, setImportFileName] = useState('');
  const [importPastedText, setImportPastedText] = useState('');
  const [parsedClassRows, setParsedClassRows] = useState<ParsedClassRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [previewGrade, setPreviewGrade] = useState<number | 'all'>('all');
  const [columnMapping, setColumnMapping] = useState<{
    nameCol: number;
    gradeCol: number;
    teacherCol: number;
    phoneCol: number;
    roomCol: number;
  }>({ nameCol: -1, gradeCol: -1, teacherCol: -1, phoneCol: -1, roomCol: -1 });
  const [rawImportMatrix, setRawImportMatrix] = useState<any[][]>([]);
  const [previewSearch, setPreviewSearch] = useState('');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [isSavingImport, setIsSavingImport] = useState(false);

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const refreshClasses = () => {
    setClasses(db.getSchoolClasses());
  };

  const handleSyncClassesWithCloud = async () => {
    setIsSyncingCloud(true);
    try {
      await db.pullFromServerAndMerge(true);
      await db.pushStateToServer();
      refreshClasses();
      setLocalSuccessMsg(
        `Đã đồng bộ ${db.getSchoolClasses().length} lớp & GVCN lên Cloud dùng chung cho cả máy ở nhà và máy ở trường!`
      );
    } finally {
      setIsSyncingCloud(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshClasses();
    setIsAdding(false);
    setEditingClass(null);
    setError(null);
    setLocalSuccessMsg(null);
    setIsImportModalOpen(false);
    setSelectedClassIds([]);
    setIsCleanModalOpen(false);
    setIsQuickK6ModalOpen(false);

    db.pullFromServerAndMerge(true).then(() => {
      refreshClasses();
    });

    const unsub = db.subscribe(() => {
      refreshClasses();
    });
    return () => unsub();
  }, [isOpen]);

  // Derived state: Redundant classes (0 students or duplicate / invalid names)
  const redundantClasses = useMemo(() => {
    return classes.filter((c) => {
      if ((c.totalStudents ?? 0) === 0) return true;
      if (isInvalidOrRedundantClassName(c.name)) return true;
      return false;
    });
  }, [classes]);

  // Derived state: Khối 6 classes and missing GVCN count
  const grade6Classes = useMemo(() => {
    return classes.filter((c) => Number(c.grade) === 6);
  }, [classes]);

  const grade6MissingTeachers = useMemo(() => {
    return grade6Classes.filter((c) => !c.homeroomTeacher || !c.homeroomTeacher.trim());
  }, [grade6Classes]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    const targetGrade = selectedGrade === 'all' ? 6 : selectedGrade;
    setEditingClass(null);
    setName(`${targetGrade}/`);
    setGrade(targetGrade);
    setHomeroomTeacher('');
    setTeacherPhone('');
    setRoom('');
    setError(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (c: SchoolClass) => {
    setIsAdding(false);
    setEditingClass(c);
    setName(c.name);
    setGrade(c.grade);
    setHomeroomTeacher(c.homeroomTeacher || '');
    setTeacherPhone(c.teacherPhone || '');
    setRoom(c.room || '');
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Vui lòng nhập tên lớp (VD: 6/1, 6A1, 7/2...).');
      return;
    }

    try {
      if (editingClass) {
        db.updateSchoolClass(editingClass.id, {
          name: cleanName,
          grade: Number(grade),
          homeroomTeacher: homeroomTeacher.trim(),
          teacherPhone: teacherPhone.trim(),
          room: room.trim(),
        });
        const msg = `Đã cập nhật thông tin lớp ${cleanName} thành công!`;
        setLocalSuccessMsg(msg);
        onSuccess(msg);
        setEditingClass(null);
      } else {
        db.addSchoolClass({
          name: cleanName,
          grade: Number(grade),
          homeroomTeacher: homeroomTeacher.trim(),
          teacherPhone: teacherPhone.trim(),
          room: room.trim(),
        });
        const msg = `Đã thêm thành công lớp ${cleanName} vào Khối ${grade}!`;
        setLocalSuccessMsg(msg);
        onSuccess(msg);
        setIsAdding(false);
      }
      refreshClasses();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thông tin lớp học.');
    }
  };

  // Delete a single class
  const handleConfirmSingleDelete = () => {
    if (!deleteConfirmClass) return;
    try {
      db.deleteSchoolClass(
        deleteConfirmClass.id,
        reassignDestClassId || undefined
      );
      const msg = `Đã xóa thành công lớp ${deleteConfirmClass.name}!`;
      setLocalSuccessMsg(msg);
      onSuccess(msg);
      setDeleteConfirmClass(null);
      setReassignDestClassId('');
      refreshClasses();
    } catch (err: any) {
      setError(err.message || 'Không thể xóa lớp học này.');
      setDeleteConfirmClass(null);
    }
  };

  // Multi-selection handlers
  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredClasses.map((c) => c.id);
    const allSelected = currentFilteredIds.every((id) => selectedClassIds.includes(id));
    if (allSelected) {
      setSelectedClassIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedClassIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Delete Confirmed
  const handleConfirmBulkDelete = () => {
    if (selectedClassIds.length === 0) return;
    try {
      const result = db.deleteMultipleSchoolClasses(
        selectedClassIds,
        bulkReassignDestClassId || undefined
      );
      const msg = `Đã xóa thành công ${result.deleted} lớp học khỏi hệ thống!`;
      setLocalSuccessMsg(msg);
      onSuccess(msg);
      setSelectedClassIds([]);
      setIsBulkDeleteModalOpen(false);
      setBulkReassignDestClassId('');
      refreshClasses();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa các lớp đã chọn.');
    }
  };

  // Open Redundant Cleanup Modal
  const handleOpenCleanupModal = () => {
    setSelectedRedundantIds(redundantClasses.map((c) => c.id));
    setIsCleanModalOpen(true);
  };

  // Execute Redundant Classes Cleanup
  const handleExecuteCleanup = () => {
    if (selectedRedundantIds.length === 0) return;
    try {
      const result = db.deleteMultipleSchoolClasses(selectedRedundantIds);
      const msg = `Đã dọn dẹp và xóa thành công ${result.deleted} lớp dư thừa!`;
      setLocalSuccessMsg(msg);
      onSuccess(msg);
      setIsCleanModalOpen(false);
      refreshClasses();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi dọn dẹp lớp dư thừa.');
    }
  };

  // Clean all classes & GVCN
  const handleCleanAllClasses = () => {
    try {
      const res = db.clearStudentsAndClasses({ clearClasses: true, clearStudents: false, clearVisitsAndEvents: false });
      refreshClasses();
      setIsCleanAllModalOpen(false);
      const msg = `Đã làm sạch toàn bộ ${res.classesCount} lớp học và phân công GVCN!`;
      setLocalSuccessMsg(msg);
      onSuccess(msg);
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi làm sạch danh sách lớp học.');
      setIsCleanAllModalOpen(false);
    }
  };

  // Open Quick Grade 6 Modal
  const handleOpenQuickK6Modal = () => {
    const k6 = classes
      .filter((c) => Number(c.grade) === 6)
      .map((c) => ({
        id: c.id,
        name: c.name,
        homeroomTeacher: c.homeroomTeacher || '',
        teacherPhone: c.teacherPhone || '',
        room: c.room || '',
      }));
    setK6FormRows(k6);
    setIsQuickK6ModalOpen(true);
  };

  // Save Quick Grade 6 Changes
  const handleSaveQuickK6 = () => {
    try {
      const count = db.batchUpdateTeachers(k6FormRows.map((r) => ({
        classId: r.id,
        homeroomTeacher: r.homeroomTeacher,
        teacherPhone: r.teacherPhone,
        room: r.room,
      })));
      const msg = `Đã cập nhật thành công GVCN cho ${count} lớp thuộc Khối 6!`;
      setLocalSuccessMsg(msg);
      onSuccess(msg);
      setIsQuickK6ModalOpen(false);
      refreshClasses();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật GVCN Khối 6.');
    }
  };

  // Download Sample Template (.xlsx)
  const handleDownloadTemplate = () => {
    try {
      exportHomeroomTeachersTemplateExcel();
    } catch (err) {
      console.error('Lỗi tải tệp mẫu GVCN:', err);
    }
  };

  // Export current classes (.xlsx)
  const handleExportClasses = () => {
    try {
      exportClassesAndTeachersExcel(classes);
    } catch (err) {
      console.error('Lỗi xuất danh sách lớp:', err);
    }
  };

  // Core Matrix Processing Engine (for both File and Pasted Text)
  const processMatrix = (
    matrix: any[][],
    forcedMapping?: { nameCol: number; gradeCol: number; teacherCol: number; phoneCol: number; roomCol: number }
  ) => {
    if (!matrix || matrix.length < 1) {
      setImportErrors(['Không có dữ liệu trong bảng tính.']);
      setParsedClassRows([]);
      return;
    }

    setRawImportMatrix(matrix);

    // 1. Detect header row index
    let bestHeaderRowIndex = 0;
    let bestScore = 0;

    for (let r = 0; r < Math.min(matrix.length, 25); r++) {
      const row = matrix[r];
      if (!row || !Array.isArray(row)) continue;
      const nonEmpties = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
      if (nonEmpties.length < 2) continue; // Skip title banners with single string

      let score = 0;
      for (const cell of row) {
        const s = String(cell || '').toLowerCase().trim();
        if (!s || s.length > 40) continue;
        if (s === 'stt' || s === 'no' || s === '#') score += 2;
        if (s.includes('tên lớp') || s === 'lớp' || s === 'lop' || s === 'class' || s === 'mã lớp' || s === 'lớp học') score += 3;
        if (s.includes('khối') || s === 'grade' || s === 'khoi') score += 2;
        if (
          s.includes('gvcn') ||
          s.includes('chủ nhiệm') ||
          s.includes('giáo viên') ||
          s.includes('giao vien') ||
          s.includes('họ và tên') ||
          s.includes('họ tên') ||
          s === 'gv' ||
          s === 'cbgv' ||
          s.includes('thầy cô') ||
          s.includes('thầy/cô') ||
          s.includes('phụ trách')
        ) score += 3;
        if (s.includes('sđt') || s.includes('sdt') || s.includes('điện thoại') || s.includes('phone') || s.includes('liên hệ')) score += 2;
        if (s.includes('phòng') || s.includes('phong') || s.includes('room') || s.includes('vị trí')) score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestHeaderRowIndex = r;
      }
    }

    const headerRowIndex = bestScore >= 3 ? bestHeaderRowIndex : 0;
    const headerRow = (matrix[headerRowIndex] || []).map((h, i) => String(h || '').trim() || `Cột ${i + 1}`);
    setDetectedHeaders(headerRow);

    // 2. Column mapping
    let colName = forcedMapping ? forcedMapping.nameCol : -1;
    let colGrade = forcedMapping ? forcedMapping.gradeCol : -1;
    let colTeacher = forcedMapping ? forcedMapping.teacherCol : -1;
    let colPhone = forcedMapping ? forcedMapping.phoneCol : -1;
    let colRoom = forcedMapping ? forcedMapping.roomCol : -1;

    let colHoDem = -1;
    let colTen = -1;

    if (!forcedMapping) {
      headerRow.forEach((h, idx) => {
        const clean = h.toLowerCase().trim();
        if (!clean) return;

        // Class name column (Check first so "Khối / Lớp" maps to class name)
        if (
          (clean.includes('tên lớp') ||
            clean === 'lớp' ||
            clean === 'lop' ||
            clean === 'lớp học' ||
            clean === 'mã lớp' ||
            clean === 'khối / lớp' ||
            clean === 'khối/lớp' ||
            clean === 'khối lớp' ||
            clean === 'khoi/lop' ||
            clean === 'class' ||
            clean === 'classname' ||
            clean === 'tenlop') &&
          colName === -1
        ) {
          colName = idx;
          return;
        }

        // Grade column
        if ((clean.includes('khối') || clean === 'grade' || clean === 'khoi') && colGrade === -1) {
          colGrade = idx;
          return;
        }

        // Phone column
        if (
          (clean.includes('sđt') ||
            clean.includes('sdt') ||
            clean.includes('điện thoại') ||
            clean.includes('dien thoai') ||
            clean.includes('phone') ||
            clean.includes('mobile') ||
            clean.includes('liên hệ') ||
            clean.includes('tel')) &&
          colPhone === -1
        ) {
          colPhone = idx;
          return;
        }

        // Room column
        if (
          (clean.includes('phòng') ||
            clean.includes('phong') ||
            clean.includes('vị trí') ||
            clean.includes('room') ||
            clean.includes('classroom')) &&
          colRoom === -1
        ) {
          colRoom = idx;
          return;
        }

        // Split name columns
        if (clean === 'họ và tên lót' || clean === 'họ đệm' || clean === 'họ và đệm' || clean === 'họ') {
          colHoDem = idx;
          return;
        }
        if (clean === 'tên' && colHoDem !== -1) {
          colTen = idx;
          return;
        }

        // Teacher column
        if (
          (clean.includes('gvcn') ||
            clean.includes('chủ nhiệm') ||
            clean.includes('giáo viên') ||
            clean.includes('giao vien') ||
            clean.includes('teacher') ||
            clean.includes('họ và tên gv') ||
            clean.includes('họ tên gv') ||
            clean.includes('tên gv') ||
            clean === 'gv' ||
            clean === 'cbgv' ||
            clean.includes('thầy cô') ||
            clean.includes('thầy/cô') ||
            clean.includes('phụ trách') ||
            clean.includes('họ và tên') ||
            clean.includes('họ tên') ||
            clean === 'hoten') &&
          colTeacher === -1
        ) {
          colTeacher = idx;
          return;
        }
      });

      // 3. Fallback: inspect data rows if any essential column is missing
      const sampleDataRows = matrix.slice(headerRowIndex + 1, headerRowIndex + 20);
      const numCols = Math.max(...sampleDataRows.map((r) => r.length), headerRow.length);

      for (let c = 0; c < numCols; c++) {
        if (c === colName || c === colGrade || c === colTeacher || c === colPhone || c === colRoom) continue;

        const values = sampleDataRows.map((r) => String(r[c] || '').trim()).filter(Boolean);
        if (values.length === 0) continue;

        // Check if phone (9-11 digits)
        if (colPhone === -1) {
          const phoneCount = values.filter((v) => /^(0|\+84)[0-9\s.-]{8,12}$/.test(v.replace(/\s+/g, ''))).length;
          if (phoneCount / values.length > 0.35) {
            colPhone = c;
            continue;
          }
        }

        // Check if class name (e.g. 6/1, 6A1, 7/2, Lớp 6/1)
        if (colName === -1) {
          const classCount = values.filter((v) => /^(lớp\s*)?([1-9]|1[0-2])[\/A-Za-z\.\-]\w*$/i.test(v)).length;
          if (classCount / values.length > 0.35) {
            colName = c;
            continue;
          }
        }

        // Check if teacher name (Vietnamese full name: 2-4 words, capitalized)
        if (colTeacher === -1 && colHoDem === -1) {
          const nameCount = values.filter((v) => {
            const words = v.split(/\s+/);
            return words.length >= 2 && words.length <= 5 && !/\d/.test(v) && /[A-ZÀ-Ỹ]/.test(words[0]);
          }).length;
          if (nameCount / values.length > 0.35) {
            colTeacher = c;
            continue;
          }
        }

        // Check if room
        if (colRoom === -1) {
          const roomCount = values.filter((v) => /^(phòng|p\.|room)\s*\w+/i.test(v)).length;
          if (roomCount / values.length > 0.35) {
            colRoom = c;
            continue;
          }
        }
      }
    }

    setColumnMapping({
      nameCol: colName,
      gradeCol: colGrade,
      teacherCol: colTeacher,
      phoneCol: colPhone,
      roomCol: colRoom,
    });

    // 4. Parse Rows
    const currentClasses = db.getSchoolClasses();
    const parsed: ParsedClassRow[] = [];

    const startRow = bestScore >= 3 ? headerRowIndex + 1 : 0;

    for (let r = startRow; r < matrix.length; r++) {
      const rowData = matrix[r];
      if (!rowData || !Array.isArray(rowData)) continue;
      const isAllEmpty = rowData.every((val) => val === undefined || val === null || String(val).trim() === '');
      if (isAllEmpty) continue;

      let rawName = colName !== -1 && rowData[colName] !== undefined ? String(rowData[colName]).trim() : '';

      // Fallback search in row for class-like value
      if (!rawName) {
        for (const cell of rowData) {
          const s = String(cell || '').trim();
          if (/^(lớp\s*)?([1-9]|1[0-2])[\/A-Za-z\.\-]\w*$/i.test(s)) {
            rawName = s;
            break;
          }
        }
      }

      if (!rawName) continue;

      // Skip invalid header/banner rows like "Khối 6", "Khối 7", "Toàn trường", "STT"
      if (isInvalidOrRedundantClassName(rawName)) continue;

      // Clean name: e.g. "Lớp 6/1" -> "6/1"
      const name = rawName.replace(/^lớp\s+/i, '').replace(/^lop\s+/i, '').trim() || rawName;

      // Grade
      let grade = 6;
      if (colGrade !== -1 && rowData[colGrade] !== undefined) {
        grade = Number(rowData[colGrade]);
      }
      if (isNaN(grade) || grade < 1 || grade > 12) {
        const matchDigit = name.match(/\b([1-9]|1[0-2])\b/) || name.match(/(\d+)/);
        grade = matchDigit ? parseInt(matchDigit[1], 10) : 6;
      }

      // Teacher
      let homeroomTeacher = '';
      if (colHoDem !== -1 && colTen !== -1 && rowData[colHoDem] && rowData[colTen]) {
        homeroomTeacher = `${String(rowData[colHoDem]).trim()} ${String(rowData[colTen]).trim()}`;
      } else if (colTeacher !== -1 && rowData[colTeacher] !== undefined) {
        homeroomTeacher = String(rowData[colTeacher]).trim();
      }

      // Phone
      let teacherPhone = '';
      if (colPhone !== -1 && rowData[colPhone] !== undefined) {
        teacherPhone = String(rowData[colPhone]).trim();
      }

      // Room
      let room = '';
      if (colRoom !== -1 && rowData[colRoom] !== undefined) {
        room = String(rowData[colRoom]).trim();
      }

      // Check matching existing class using smart equivalence (e.g. 6/1 <=> 6A1 <=> 6.1 <=> 6-1)
      const existing = currentClasses.find(
        (c) =>
          c.name.toLowerCase() === rawName.toLowerCase() ||
          c.name.toLowerCase() === name.toLowerCase() ||
          normalizeClassName(c.name) === normalizeClassName(name) ||
          areClassesEquivalent(c.name, name) ||
          areClassesEquivalent(c.name, rawName)
      );

      parsed.push({
        name: existing ? existing.name : name, // Keep existing standardized name if matched
        grade: existing ? existing.grade : grade,
        homeroomTeacher,
        teacherPhone,
        room,
        isExisting: !!existing,
        originalTeacher: existing?.homeroomTeacher,
        originalPhone: existing?.teacherPhone,
        originalRoom: existing?.room,
      });
    }

    if (parsed.length === 0) {
      setImportErrors(['Không tìm thấy dòng dữ liệu lớp học nào hợp lệ. Vui lòng kiểm tra lại dữ liệu.']);
      return;
    }

    setParsedClassRows(parsed);
  };

  // Parse Excel / CSV File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportErrors([]);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Tập tin không có trang tính (sheet) nào.');
      }

      let combinedMatrix: any[][] = [];
      if (workbook.SheetNames.length === 1) {
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        combinedMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      } else {
        // Multi-sheet: merge rows across sheets
        for (let sIdx = 0; sIdx < workbook.SheetNames.length; sIdx++) {
          const sheetName = workbook.SheetNames[sIdx];
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;
          const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (!matrix || matrix.length < 1) continue;
          if (combinedMatrix.length === 0) {
            combinedMatrix = [...matrix];
          } else {
            // Find data starting row (skip header)
            const dataRows = matrix.slice(1).filter((r) => r && Array.isArray(r) && r.some((c) => String(c || '').trim()));
            combinedMatrix.push(...dataRows);
          }
        }
      }

      if (!combinedMatrix || combinedMatrix.length < 1) {
        setImportErrors(['Tệp không có dữ liệu hợp lệ.']);
        return;
      }

      processMatrix(combinedMatrix);
    } catch (err: any) {
      setImportErrors([`Lỗi khi đọc tệp Excel/CSV: ${err.message}`]);
    }
  };

  // Parse Pasted Text (Tab / Comma separated from Excel)
  const handleParsePastedText = () => {
    if (!importPastedText.trim()) {
      setImportErrors(['Vui lòng dán dữ liệu từ bảng tính Excel trước khi bấm phân tích.']);
      return;
    }
    setImportErrors([]);

    try {
      const lines = importPastedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        setImportErrors(['Không có nội dung nào được dán.']);
        return;
      }

      const rawMatrix: any[][] = lines.map((line) => {
        let parts = line.split('\t');
        if (parts.length === 1 && line.includes(',')) {
          parts = line.split(',');
        } else if (parts.length === 1 && line.includes(';')) {
          parts = line.split(';');
        }
        return parts.map((p) => p.trim());
      });

      processMatrix(rawMatrix);
    } catch (err: any) {
      setImportErrors([`Lỗi khi phân tích dữ liệu: ${err.message}`]);
    }
  };

  // Re-map column handler
  const handleRemapColumn = (field: 'nameCol' | 'gradeCol' | 'teacherCol' | 'phoneCol' | 'roomCol', colIdx: number) => {
    const newMapping = { ...columnMapping, [field]: colIdx };
    setColumnMapping(newMapping);
    if (rawImportMatrix.length > 0) {
      processMatrix(rawImportMatrix, newMapping);
    }
  };

  // Update a single parsed row
  const handleUpdateParsedRow = (index: number, field: keyof ParsedClassRow, value: any) => {
    setParsedClassRows((prev) => {
      const copy = [...prev];
      const updated = { ...copy[index], [field]: value };
      if (field === 'name') {
        const cleanName = String(value).replace(/^lớp\s+/i, '').replace(/^lop\s+/i, '').trim();
        const existing = classes.find(
          (c) =>
            c.name.toLowerCase() === String(value).toLowerCase() ||
            c.name.toLowerCase() === cleanName.toLowerCase() ||
            normalizeClassName(c.name) === normalizeClassName(cleanName) ||
            areClassesEquivalent(c.name, cleanName)
        );
        updated.isExisting = !!existing;
        updated.originalTeacher = existing?.homeroomTeacher;
        updated.originalPhone = existing?.teacherPhone;
        updated.originalRoom = existing?.room;
      }
      copy[index] = updated;
      return copy;
    });
  };

  // Delete a parsed row
  const handleDeleteParsedRow = (index: number) => {
    setParsedClassRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (parsedClassRows.length === 0) return;
    setIsSavingImport(true);
    setImportErrors([]);
    try {
      const result = db.importClassesFromExcel(parsedClassRows);
      refreshClasses();
      setIsImportModalOpen(false);
      setParsedClassRows([]);
      setImportFileName('');
      setImportPastedText('');
      setRawImportMatrix([]);
      const msg = `Đã cập nhật GVCN theo lớp thành công: ${result.updated} lớp được cập nhật GVCN, ${result.added} lớp thêm mới!`;
      setLocalSuccessMsg(msg);
      onSuccess(msg);
    } catch (err: any) {
      setImportErrors([err.message || 'Lỗi khi lưu danh sách GVCN theo lớp.']);
    } finally {
      setIsSavingImport(false);
    }
  };

  const filteredClasses = classes.filter((c) => {
    if (selectedGrade !== 'all' && Number(c.grade) !== Number(selectedGrade)) return false;
    return true;
  });

  const allFilteredSelected =
    filteredClasses.length > 0 && filteredClasses.every((c) => selectedClassIds.includes(c.id));

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-60 overflow-y-auto p-2 sm:p-5 flex items-start sm:items-center justify-center backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full my-auto max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-linear-to-r from-emerald-50 via-teal-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Trường THCS Đông Thạnh
                </span>
                <span className="text-xs text-slate-500 font-semibold">• {classes.length} Lớp học</span>
                {redundantClasses.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                    {redundantClasses.length} lớp 0 HS
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                QUẢN LÝ LỚP HỌC & GIÁO VIÊN CHỦ NHIỆM (GVCN)
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncClassesWithCloud}
              disabled={isSyncingCloud}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Đồng bộ danh sách lớp & GVCN giữa máy ở nhà và máy ở trường"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span>{isSyncingCloud ? 'Đang đồng bộ...' : 'Đồng bộ giữa các máy'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs text-rose-500 hover:text-rose-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {localSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{localSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setLocalSuccessMsg(null)}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Attention Banner for Grade 6 missing teachers */}
          {grade6MissingTeachers.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div className="flex items-start sm:items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <p className="font-bold text-xs">
                    Khối 6 hiện có {grade6MissingTeachers.length} lớp chưa có thông tin GVCN:{' '}
                    <span className="font-mono text-amber-800 font-black">
                      {grade6MissingTeachers.map((c) => c.name).join(', ')}
                    </span>
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Bấm &quot;Điền nhanh GVCN Khối 6&quot; để nhập trực tiếp hoặc &quot;Nhập từ Excel&quot; để đối chiếu tự động.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleOpenQuickK6Modal}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>⚡ Điền nhanh GVCN Khối 6</span>
                </button>
              </div>
            </div>
          )}

          {/* Redundant Classes Notice & Clean up button */}
          {redundantClasses.length > 0 && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-xs">
                  Phát hiện <strong>{redundantClasses.length} lớp dư thừa</strong> (sĩ số 0 học sinh hoặc trùng lặp).
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenCleanupModal}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors cursor-pointer shrink-0 self-start sm:self-auto flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>🧹 Dọn dẹp {redundantClasses.length} lớp dư thừa</span>
              </button>
            </div>
          )}

          {/* Grade filter tabs & Action buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
              <span className="text-xs font-bold text-slate-600 mr-1 whitespace-nowrap">Khối:</span>
              {(['all', 6, 7, 8, 9] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedGrade === g
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {g === 'all'
                    ? `Tất cả (${classes.length})`
                    : `Khối ${g} (${classes.filter((c) => Number(c.grade) === Number(g)).length})`}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-xs transition-colors cursor-pointer"
                title="Tải tệp mẫu Excel phân công GVCN theo lớp"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Tải tệp mẫu</span>
              </button>

              <button
                type="button"
                id="btn-import-gvcn-excel"
                onClick={() => {
                  setIsImportModalOpen(true);
                  setParsedClassRows([]);
                  setImportErrors([]);
                  setImportFileName('');
                  setImportPastedText('');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                title="Nhập danh sách GVCN theo lớp từ Excel hoặc dán dữ liệu cho nhanh"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>📥 Nhập GVCN từ Excel</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Lớp Mới</span>
              </button>

              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsCleanAllModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 shadow-xs transition-colors cursor-pointer"
                  title="Chuẩn bị xuất bản: Làm sạch toàn bộ lớp học và GVCN mẫu để nhập thực tế"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Làm sạch lớp & GVCN</span>
                </button>
              )}
            </div>
          </div>

          {/* Add or Edit Form Panel */}
          {(isAdding || editingClass) && (
            <form
              onSubmit={handleSubmit}
              className="p-4 bg-emerald-50/50 border-2 border-emerald-300 rounded-2xl shadow-xs space-y-3 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                  {editingClass ? <Edit2 className="w-4 h-4 text-emerald-700" /> : <Plus className="w-4 h-4 text-emerald-700" />}
                  <span>{editingClass ? `Chỉnh sửa Lớp ${editingClass.name}` : `Thêm Lớp Mới vào Khối ${grade}`}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingClass(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-0.5 rounded hover:bg-white"
                >
                  ✕ Đóng form
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Class Name */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Tên lớp <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: 6/1, 6A1, 7/3..."
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Đặt theo mã lớp của trường</p>
                </div>

                {/* Grade */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Thuộc Khối <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={6}>Khối 6 (Lớp 6)</option>
                    <option value={7}>Khối 7 (Lớp 7)</option>
                    <option value={8}>Khối 8 (Lớp 8)</option>
                    <option value={9}>Khối 9 (Lớp 9)</option>
                  </select>
                </div>

                {/* Homeroom Teacher */}
                <div className="sm:col-span-1 lg:col-span-2">
                  <label className="block font-bold text-slate-800 mb-1">
                    Giáo viên chủ nhiệm (GVCN)
                  </label>
                  <input
                    type="text"
                    value={homeroomTeacher}
                    onChange={(e) => setHomeroomTeacher(e.target.value)}
                    placeholder="VD: Cô Nguyễn Thị Lan, Thầy Trần Minh Tuấn..."
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">Cán bộ y tế liên hệ khi học sinh đau ốm tại trường</p>
                </div>

                {/* Teacher Phone */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Số điện thoại GVCN
                  </label>
                  <input
                    type="text"
                    value={teacherPhone}
                    onChange={(e) => setTeacherPhone(e.target.value)}
                    placeholder="VD: 0908 123 456"
                    className="w-full p-2 rounded-xl border border-slate-300 bg-white font-mono font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Room & Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-emerald-200">
                <div className="w-full sm:w-auto flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Vị trí phòng học:</span>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="VD: Phòng 102 - Tầng 1 Khu A"
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium w-full sm:w-64"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingClass(null);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingClass ? 'Lưu Cập Nhật Lớp' : 'Lưu Lớp Mới Vào Hệ Thống'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Sticky Batch Selection Bar */}
          {selectedClassIds.length > 0 && (
            <div className="p-3 bg-purple-900 text-white rounded-xl shadow-md flex items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckSquare className="w-4 h-4 text-purple-300" />
                <span>Đã chọn {selectedClassIds.length} lớp học</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClassIds([])}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa {selectedClassIds.length} lớp đã chọn</span>
                </button>
              </div>
            </div>
          )}

          {/* Classes Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title="Chọn tất cả lớp trong trang"
                    />
                  </th>
                  <th className="py-3 px-3.5">Lớp học</th>
                  <th className="py-3 px-3">Khối</th>
                  <th className="py-3 px-3.5">Giáo viên chủ nhiệm (GVCN)</th>
                  <th className="py-3 px-3">SĐT GVCN</th>
                  <th className="py-3 px-3">Phòng học</th>
                  <th className="py-3 px-3 text-center">Sĩ số</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <GraduationCap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">Không có lớp nào trong khối này</p>
                      <button
                        type="button"
                        onClick={handleOpenAdd}
                        className="mt-2 text-xs text-emerald-700 font-bold hover:underline"
                      >
                        + Bấm vào đây để thêm lớp mới
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((c) => {
                    const isSelected = editingClass?.id === c.id;
                    const isChecked = selectedClassIds.includes(c.id);
                    const studentCount = c.totalStudents ?? 0;
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-emerald-50/60' : isChecked ? 'bg-purple-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectRow(c.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* Class Name */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 font-black text-slate-900 text-sm">
                            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-mono text-xs">
                              {c.name}
                            </span>
                            <span>Lớp {c.name}</span>
                          </span>
                        </td>

                        {/* Grade */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            Khối {c.grade}
                          </span>
                        </td>

                        {/* Homeroom Teacher */}
                        <td className="py-3 px-3.5">
                          {c.homeroomTeacher ? (
                            <span className="font-bold text-slate-800 text-xs">
                              {c.homeroomTeacher}
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                                Chưa có GVCN
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(c)}
                                className="text-emerald-700 hover:text-emerald-800 font-bold text-[11px] hover:underline cursor-pointer"
                              >
                                + Gán GVCN
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Teacher Phone */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {c.teacherPhone ? (
                            <a
                              href={`tel:${c.teacherPhone.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-mono font-bold text-xs"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{c.teacherPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">---</span>
                          )}
                        </td>

                        {/* Room */}
                        <td className="py-3 px-3 text-slate-600">
                          {c.room ? (
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{c.room}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">---</span>
                          )}
                        </td>

                        {/* Student Count */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-xs ${
                              studentCount > 0
                                ? 'bg-slate-100 text-slate-800'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            <Users className="w-3 h-3 text-slate-500" />
                            <span>{studentCount}</span>
                            <span className="text-[10px] text-slate-500 font-normal">HS</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Chỉnh sửa tên lớp & GVCN"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmClass(c);
                                setReassignDestClassId('');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa lớp học"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-500">
              Tổng cộng: <strong>{classes.length}</strong> lớp học thuộc 4 khối (6, 7, 8, 9)
            </span>
            <button
              type="button"
              onClick={handleExportClasses}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-700 font-semibold hover:underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất danh sách ra Excel (.xlsx)</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Single Class Delete Confirmation Modal */}
      {deleteConfirmClass && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Xác Nhận Xóa Lớp Học</h3>
                <p className="text-xs text-slate-500">Hành động này sẽ xóa lớp khỏi danh sách</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div>
                <strong>Lớp học:</strong> <span className="text-slate-900 font-bold">{deleteConfirmClass.name}</span>
              </div>
              <div>
                <strong>Thuộc khối:</strong> Khối {deleteConfirmClass.grade}
              </div>
              <div>
                <strong>GVCN:</strong> {deleteConfirmClass.homeroomTeacher || 'Chưa gán'}
              </div>
              <div>
                <strong>Sĩ số hiện tại:</strong>{' '}
                <span className="font-bold text-emerald-800">{deleteConfirmClass.totalStudents ?? 0} học sinh</span>
              </div>
            </div>

            {(deleteConfirmClass.totalStudents ?? 0) > 0 ? (
              <div className="space-y-2 bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs">
                <p className="font-bold text-amber-900">
                  ⚠️ Lớp này đang có <strong>{deleteConfirmClass.totalStudents}</strong> học sinh.
                </p>
                <p className="text-[11px] text-amber-800">
                  Bạn có thể chuyển học sinh sang một lớp khác hoặc đưa về trạng thái &quot;Chưa phân lớp&quot;:
                </p>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chuyển học sinh sang lớp:
                  </label>
                  <select
                    value={reassignDestClassId}
                    onChange={(e) => setReassignDestClassId(e.target.value)}
                    className="w-full p-2 rounded-lg border border-amber-300 bg-white font-bold text-xs"
                  >
                    <option value="">-- Đưa về trạng thái Chưa phân lớp --</option>
                    {classes
                      .filter((c) => c.id !== deleteConfirmClass.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          Lớp {c.name} (Khối {c.grade} - {c.homeroomTeacher || 'Chưa có GVCN'})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Lớp này hiện không có học sinh nào. Bạn có chắc chắn muốn xóa lớp <strong>{deleteConfirmClass.name}</strong>?
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmClass(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold cursor-pointer shadow-xs"
              >
                {(deleteConfirmClass.totalStudents ?? 0) > 0 && reassignDestClassId
                  ? 'Chuyển HS & Xóa lớp'
                  : 'Xác nhận xóa lớp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Xóa Hàng Loạt Lớp Học</h3>
                <p className="text-xs text-slate-500">
                  Bạn đang chuẩn bị xóa <strong>{selectedClassIds.length}</strong> lớp học đã chọn
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs max-h-36 overflow-y-auto space-y-1">
              {classes
                .filter((c) => selectedClassIds.includes(c.id))
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-slate-700">
                    <span className="font-bold">Lớp {c.name}</span>
                    <span className="text-slate-500">Khối {c.grade} • {c.totalStudents ?? 0} HS</span>
                  </div>
                ))}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 text-xs">
                Nếu có học sinh trong các lớp này, chuyển sang:
              </label>
              <select
                value={bulkReassignDestClassId}
                onChange={(e) => setBulkReassignDestClassId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium text-xs"
              >
                <option value="">-- Đưa về trạng thái Chưa phân lớp --</option>
                {classes
                  .filter((c) => !selectedClassIds.includes(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name} (Khối {c.grade})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold cursor-pointer shadow-xs"
              >
                Xác nhận xóa {selectedClassIds.length} lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redundant Classes Cleanup Modal */}
      {isCleanModalOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-rose-200">
            <div className="p-4 bg-linear-to-r from-rose-50 to-amber-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-800">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm">Dọn Dẹp Các Lớp Dư Thừa (0 Học Sinh)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCleanModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <p className="text-slate-600">
                Hệ thống tự động phát hiện <strong>{redundantClasses.length}</strong> lớp không có học sinh hoặc tên không chuẩn. Chọn các lớp muốn xóa:
              </p>

              <div className="flex items-center justify-between border-b pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedRedundantIds(redundantClasses.map((c) => c.id))}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Chọn tất cả ({redundantClasses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRedundantIds([])}
                  className="text-slate-500 font-medium hover:underline"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                {redundantClasses.map((c) => {
                  const isChecked = selectedRedundantIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setSelectedRedundantIds((prev) =>
                              prev.includes(c.id)
                                ? prev.filter((id) => id !== c.id)
                                : [...prev, c.id]
                            )
                          }
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800">Lớp {c.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          Khối {c.grade}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400">
                          {c.homeroomTeacher || 'Chưa có GVCN'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold text-[10px]">
                          0 HS
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsCleanModalOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={selectedRedundantIds.length === 0}
                onClick={handleExecuteCleanup}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
              >
                Xóa ngay {selectedRedundantIds.length} lớp dư thừa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean All Classes & GVCN Modal (for Production Publishing) */}
      {isCleanAllModalOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Làm Sạch Toàn Bộ Lớp & GVCN</h3>
                <p className="text-xs text-slate-500">Chuẩn bị xuất bản ứng dụng để nhập danh sách thực tế</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2.5 my-3">
              <p className="font-bold text-slate-900">
                Bạn có chắc chắn muốn xóa toàn bộ {classes.length} lớp học và phân công GVCN không?
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
                <li>Xóa toàn bộ {classes.length} lớp học và thông tin liên hệ GVCN hiện tại.</li>
                <li>Học sinh hiện có (nếu có) sẽ được chuyển về trạng thái <em>Chưa phân lớp</em>.</li>
                <li>Kho thuốc, danh mục vật tư y tế và cấu hình trường học vẫn được giữ nguyên an toàn 100%.</li>
              </ul>
              <p className="text-[11px] text-slate-600 italic">
                Sau khi làm sạch, bạn có thể tạo lại các lớp mới hoặc bấm &quot;Nhập GVCN từ Excel&quot; để nạp danh sách thực tế của nhà trường.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsCleanAllModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCleanAllClasses}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Xác nhận làm sạch lớp & GVCN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Grade 6 GVCN Assignment Modal */}
      {isQuickK6ModalOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col shadow-2xl border border-amber-200">
            <div className="p-4 bg-linear-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-bold text-base">Phân Công Nhanh GVCN Toàn Bộ Khối 6</h3>
                  <p className="text-[11px] text-amber-100">
                    Nhập trực tiếp họ tên GVCN và SĐT cho các lớp Khối 6 rồi lưu 1 lần
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickK6ModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b">
                  <tr>
                    <th className="py-2.5 px-3 w-24">Lớp</th>
                    <th className="py-2.5 px-3">Giáo viên chủ nhiệm (GVCN) *</th>
                    <th className="py-2.5 px-3 w-32">SĐT GVCN</th>
                    <th className="py-2.5 px-3 w-28">Phòng học</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {k6FormRows.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 text-sm">
                        Lớp {r.name}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={r.homeroomTeacher}
                          onChange={(e) => {
                            const val = e.target.value;
                            setK6FormRows((prev) => {
                              const copy = [...prev];
                              copy[idx].homeroomTeacher = val;
                              return copy;
                            });
                          }}
                          placeholder="Nhập tên GVCN (VD: Cô Nguyễn Thị Lan)..."
                          className="w-full p-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={r.teacherPhone}
                          onChange={(e) => {
                            const val = e.target.value;
                            setK6FormRows((prev) => {
                              const copy = [...prev];
                              copy[idx].teacherPhone = val;
                              return copy;
                            });
                          }}
                          placeholder="09xx..."
                          className="w-full p-1.5 rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={r.room}
                          onChange={(e) => {
                            const val = e.target.value;
                            setK6FormRows((prev) => {
                              const copy = [...prev];
                              copy[idx].room = val;
                              return copy;
                            });
                          }}
                          placeholder="Phòng..."
                          className="w-full p-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsQuickK6ModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveQuickK6}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Lưu Phân Công GVCN Khối 6</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT GVCN THEO LỚP MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/70 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-purple-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-purple-100 bg-linear-to-r from-purple-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-white/20 uppercase tracking-wider text-purple-100">
                      Nhập Nhanh Hàng Loạt
                    </span>
                    <span className="text-xs text-purple-200">• Excel (.xlsx, .xls, .csv) & Dán bảng</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black mt-0.5">
                    NHẬP PHÂN CÔNG GIÁO VIÊN CHỦ NHIỆM (GVCN) THEO LỚP
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Guidance Banner */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 flex items-start gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-bold text-purple-950">
                    Nhập nhanh toàn bộ GVCN của các lớp chỉ trong vài giây!
                  </p>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    • <strong>Khớp thông minh:</strong> Hệ thống tự động nhận diện các định dạng tương đương như{' '}
                    <code className="bg-purple-100 px-1 rounded font-bold">6/1</code> ⬄{' '}
                    <code className="bg-purple-100 px-1 rounded font-bold">6A1</code> ⬄{' '}
                    <code className="bg-purple-100 px-1 rounded font-bold">6.1</code> ⬄{' '}
                    <code className="bg-purple-100 px-1 rounded font-bold">61</code>.<br />
                    • <strong>Lớp đã có sẵn:</strong> Tự động cập nhật họ tên GVCN, SĐT liên hệ và Phòng học mới nhất.<br />
                    • <strong>Lớp chưa có:</strong> Tự động thêm mới vào danh sách lớp của trường.
                  </p>
                </div>
              </div>

              {/* Input Mode Selector Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setImportInputMode('file')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    importInputMode === 'file'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Cách 1: Tải lên tệp Excel / CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportInputMode('paste')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    importInputMode === 'paste'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Cách 2: Dán nhanh từ bảng tính Excel</span>
                </button>
              </div>

              {/* Tab 1: File Upload */}
              {importInputMode === 'file' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-800">Tệp mẫu chuẩn phân công GVCN (.xlsx)</p>
                      <p className="text-[11px] text-slate-500">
                        Cột: Tên lớp, Khối, Giáo viên chủ nhiệm (GVCN), Số điện thoại GVCN, Phòng học
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-purple-700 border border-purple-300 hover:bg-purple-50 rounded-xl font-bold text-xs shadow-xs cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải tệp mẫu</span>
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-purple-200 rounded-2xl p-6 text-center hover:border-purple-500 transition-colors bg-purple-50/20">
                    <Upload className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-800">
                      Chọn tệp Excel hoặc CSV phân công GVCN
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Hỗ trợ tệp <strong>.xlsx, .xls, .csv</strong> (tối đa 10MB)
                    </p>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="mt-3 text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-700 file:text-white hover:file:bg-purple-800 cursor-pointer"
                    />
                  </div>

                  {importFileName && (
                    <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      📁 Đã nạp tệp: <strong>{importFileName}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Tab 2: Quick Copy & Paste */}
              {importInputMode === 'paste' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] space-y-1">
                    <p className="font-bold text-amber-950 flex items-center gap-1">
                      <ClipboardPaste className="w-3.5 h-3.5 text-amber-700" />
                      <span>Hướng dẫn Copy & Paste nhanh từ Excel:</span>
                    </p>
                    <p>
                      Mở file Excel của trường, chọn/bôi đen các cột (<strong>Tên lớp</strong>, <strong>GVCN</strong>, <strong>SĐT</strong>, <strong>Phòng học</strong>) ➔ nhấn <strong>Ctrl + C</strong> ➔ dán vào khung bên dưới ➔ bấm <strong>Phân tích dữ liệu dán</strong>.
                    </p>
                  </div>

                  <div>
                    <textarea
                      rows={5}
                      value={importPastedText}
                      onChange={(e) => setImportPastedText(e.target.value)}
                      placeholder={`Ví dụ dữ liệu copy từ Excel:\n6/1\tCô Nguyễn Thị Lan\t0908 112 233\tPhòng 101\n6/2\tThầy Trần Minh Tuấn\t0913 223 344\tPhòng 102\n7/1\tCô Lê Thị Mai\t0988 334 455\tPhòng 201`}
                      className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Phân tích dữ liệu vừa dán</span>
                  </button>
                </div>
              )}

              {/* Errors Display */}
              {importErrors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-800">
                  <p className="font-bold flex items-center gap-1 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Lỗi phát hiện khi đọc dữ liệu:</span>
                  </p>
                  <ul className="list-disc pl-5 text-[11px] max-h-24 overflow-y-auto">
                    {importErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Column Mapping Bar */}
              {detectedHeaders.length > 0 && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-purple-950 text-xs">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-purple-700" />
                      <span>Nhận diện cột dữ liệu:</span>
                      <span className="text-[11px] text-purple-700 font-normal">
                        (Hệ thống tự động khớp cột. Nếu sai, bạn có thể chỉnh lại ở đây)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowColumnSettings(!showColumnSettings)}
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white px-2.5 py-1 rounded-lg border border-purple-200 shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{showColumnSettings ? 'Ẩn tùy chọn cột ▲' : 'Tùy chỉnh chọn cột ▼'}</span>
                    </button>
                  </div>

                  {showColumnSettings && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-purple-200 text-[11px]">
                      <div>
                        <label className="block font-bold text-slate-700 mb-0.5">Cột Tên lớp:</label>
                        <select
                          value={columnMapping.nameCol}
                          onChange={(e) => handleRemapColumn('nameCol', Number(e.target.value))}
                          className="w-full p-1.5 rounded-lg border border-purple-300 bg-white font-medium text-slate-800"
                        >
                          <option value={-1}>-- Tự động --</option>
                          {detectedHeaders.map((h, i) => (
                            <option key={i} value={i}>{`Cột ${i + 1}: ${h}`}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-0.5">Cột Khối:</label>
                        <select
                          value={columnMapping.gradeCol}
                          onChange={(e) => handleRemapColumn('gradeCol', Number(e.target.value))}
                          className="w-full p-1.5 rounded-lg border border-purple-300 bg-white font-medium text-slate-800"
                        >
                          <option value={-1}>-- Tự động --</option>
                          {detectedHeaders.map((h, i) => (
                            <option key={i} value={i}>{`Cột ${i + 1}: ${h}`}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-purple-900 mb-0.5">Cột GVCN (*):</label>
                        <select
                          value={columnMapping.teacherCol}
                          onChange={(e) => handleRemapColumn('teacherCol', Number(e.target.value))}
                          className="w-full p-1.5 rounded-lg border border-purple-500 bg-purple-50 font-bold text-purple-900 ring-1 ring-purple-400"
                        >
                          <option value={-1}>-- Tự động nhận diện --</option>
                          {detectedHeaders.map((h, i) => (
                            <option key={i} value={i}>{`Cột ${i + 1}: ${h}`}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-0.5">Cột SĐT GVCN:</label>
                        <select
                          value={columnMapping.phoneCol}
                          onChange={(e) => handleRemapColumn('phoneCol', Number(e.target.value))}
                          className="w-full p-1.5 rounded-lg border border-purple-300 bg-white font-medium text-slate-800"
                        >
                          <option value={-1}>-- Bỏ qua / Tự động --</option>
                          {detectedHeaders.map((h, i) => (
                            <option key={i} value={i}>{`Cột ${i + 1}: ${h}`}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-0.5">Cột Phòng học:</label>
                        <select
                          value={columnMapping.roomCol}
                          onChange={(e) => handleRemapColumn('roomCol', Number(e.target.value))}
                          className="w-full p-1.5 rounded-lg border border-purple-300 bg-white font-medium text-slate-800"
                        >
                          <option value={-1}>-- Bỏ qua / Tự động --</option>
                          {detectedHeaders.map((h, i) => (
                            <option key={i} value={i}>{`Cột ${i + 1}: ${h}`}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              {parsedClassRows.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-800 text-xs">
                        Kết quả phân tích: {parsedClassRows.length} lớp
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {parsedClassRows.filter((r) => r.isExisting).length} lớp cập nhật GVCN
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                        {parsedClassRows.filter((r) => !r.isExisting).length} lớp thêm mới
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Filter by grade in preview */}
                      <div className="flex items-center gap-1">
                        {(['all', 6, 7, 8, 9] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setPreviewGrade(g)}
                            className={`px-2 py-1 rounded text-[11px] font-bold ${
                              previewGrade === g
                                ? 'bg-purple-700 text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {g === 'all'
                              ? 'Tất cả'
                              : `K${g} (${parsedClassRows.filter((r) => Number(r.grade) === Number(g)).length})`}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-44">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={previewSearch}
                          onChange={(e) => setPreviewSearch(e.target.value)}
                          placeholder="Tìm lớp / GVCN..."
                          className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-2.5 w-10 text-center">STT</th>
                          <th className="py-2.5 px-3 w-28">Tên lớp</th>
                          <th className="py-2.5 px-2.5 w-20">Khối</th>
                          <th className="py-2.5 px-3 min-w-[200px]">Giáo viên chủ nhiệm (GVCN) *</th>
                          <th className="py-2.5 px-2.5 w-32">SĐT GVCN</th>
                          <th className="py-2.5 px-2.5 w-28">Phòng học</th>
                          <th className="py-2.5 px-3 text-center w-28">Trạng thái</th>
                          <th className="py-2.5 px-2 text-center w-10">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedClassRows
                          .map((r, originalIdx) => ({ r, originalIdx }))
                          .filter(({ r }) => {
                            if (previewGrade !== 'all' && Number(r.grade) !== Number(previewGrade)) return false;
                            if (!previewSearch.trim()) return true;
                            const q = previewSearch.toLowerCase().trim();
                            return (
                              r.name.toLowerCase().includes(q) ||
                              r.homeroomTeacher.toLowerCase().includes(q) ||
                              r.teacherPhone.includes(q) ||
                              r.room.toLowerCase().includes(q)
                            );
                          })
                          .map(({ r, originalIdx }) => (
                            <tr key={originalIdx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                                {originalIdx + 1}
                              </td>
                              <td className="py-1.5 px-3 font-mono font-bold text-slate-900">
                                <input
                                  type="text"
                                  value={r.name}
                                  onChange={(e) => handleUpdateParsedRow(originalIdx, 'name', e.target.value)}
                                  className="w-full p-1 rounded-md border border-slate-200 font-mono font-black text-slate-900 text-xs focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-1.5 px-2.5">
                                <select
                                  value={r.grade}
                                  onChange={(e) => handleUpdateParsedRow(originalIdx, 'grade', Number(e.target.value))}
                                  className="p-1 rounded-md border border-slate-200 font-semibold text-slate-800 text-xs"
                                >
                                  <option value={6}>Khối 6</option>
                                  <option value={7}>Khối 7</option>
                                  <option value={8}>Khối 8</option>
                                  <option value={9}>Khối 9</option>
                                </select>
                              </td>
                              <td className="py-1.5 px-3">
                                <input
                                  type="text"
                                  value={r.homeroomTeacher}
                                  placeholder="Nhập họ tên GVCN..."
                                  onChange={(e) => handleUpdateParsedRow(originalIdx, 'homeroomTeacher', e.target.value)}
                                  className={`w-full p-1 rounded-md border text-xs font-bold transition-all focus:ring-1 focus:ring-purple-500 ${
                                    r.homeroomTeacher
                                      ? 'border-slate-200 text-slate-900 bg-white'
                                      : 'border-amber-300 bg-amber-50 text-amber-900 placeholder:text-amber-500'
                                  }`}
                                />
                                {r.isExisting && r.originalTeacher && r.originalTeacher !== r.homeroomTeacher && (
                                  <span className="block text-[10px] text-slate-400 mt-0.5 line-through">
                                    Cũ: {r.originalTeacher}
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2.5">
                                <input
                                  type="text"
                                  value={r.teacherPhone}
                                  placeholder="09xx..."
                                  onChange={(e) => handleUpdateParsedRow(originalIdx, 'teacherPhone', e.target.value)}
                                  className="w-full p-1 rounded-md border border-slate-200 font-mono text-xs text-slate-800 focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-1.5 px-2.5">
                                <input
                                  type="text"
                                  value={r.room}
                                  placeholder="Phòng..."
                                  onChange={(e) => handleUpdateParsedRow(originalIdx, 'room', e.target.value)}
                                  className="w-full p-1 rounded-md border border-slate-200 text-xs text-slate-800 focus:ring-1 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-1.5 px-3 text-center whitespace-nowrap">
                                {r.isExisting ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Cập nhật</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                                    <Plus className="w-3 h-3" />
                                    <span>Thêm mới</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteParsedRow(originalIdx)}
                                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xóa dòng này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-slate-500 italic">
                    💡 Mẹo: Bạn có thể chỉnh sửa trực tiếp tên GVCN, SĐT, hoặc xóa dòng thừa ngay trên bảng trước khi bấm Lưu!
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                disabled={parsedClassRows.length === 0 || isSavingImport}
                onClick={handleConfirmImport}
                className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-white font-bold shadow-xs transition-all cursor-pointer ${
                  parsedClassRows.length > 0 && !isSavingImport
                    ? 'bg-purple-700 hover:bg-purple-800 cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                {isSavingImport ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      Xác nhận lưu {parsedClassRows.length > 0 ? `${parsedClassRows.length} Lớp & GVCN` : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
