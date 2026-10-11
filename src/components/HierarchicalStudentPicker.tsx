import React, { useState, useMemo, useEffect } from 'react';
import { User, Search, RotateCcw, X, AlertTriangle, Check } from 'lucide-react';
import {
  db,
  matchesStudentSearch,
  getStudentSearchScore,
  areClassesEquivalent,
  normalizeStudentClassName,
  extractGradeFromClassOrGrade,
  maskStudentName,
} from '../services/db';
import { Student } from '../types';

interface HierarchicalStudentPickerProps {
  selectedStudentId?: string;
  onSelectStudent: (student: Student | null) => void;
  label?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  helperText?: string;
}

export const HierarchicalStudentPicker: React.FC<HierarchicalStudentPickerProps> = ({
  selectedStudentId,
  onSelectStudent,
  label = 'Học sinh liên quan',
  required = false,
  allowEmpty = true,
  emptyLabel = '-- Sự cố tập thể / Không gán riêng cá nhân --',
  helperText,
}) => {
  const [allStudents, setAllStudents] = useState<Student[]>(() => db.getStudents());
  const [allClasses, setAllClasses] = useState(() => db.getSchoolClasses());
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.isPrivacyModeEnabled());

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setAllStudents(db.getStudents());
      setAllClasses(db.getSchoolClasses());
      setPrivacyMode(db.isPrivacyModeEnabled());
    });
    return () => unsub();
  }, []);

  // Find currently selected student object
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return allStudents.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, allStudents]);

  // Hierarchical filter states
  const [selectedGrade, setSelectedGrade] = useState<'all' | number>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isEditingSelection, setIsEditingSelection] = useState<boolean>(!selectedStudentId);

  // Sync state when selectedStudentId changes from parent
  useEffect(() => {
    if (selectedStudent) {
      setSelectedGrade(selectedStudent.grade);
      setSelectedClass(selectedStudent.className);
      setIsEditingSelection(false);
    } else {
      setIsEditingSelection(true);
    }
  }, [selectedStudentId, selectedStudent]);

  // Filter classes according to chosen grade
  const availableClasses = useMemo(() => {
    if (selectedGrade === 'all') {
      return allClasses;
    }
    return allClasses.filter((c) => c.grade === selectedGrade);
  }, [allClasses, selectedGrade]);

  // Filter students based on: 1. Grade, 2. Class, 3. Keyword (accent-insensitive)
  const candidateStudents = useMemo(() => {
    const kw = searchKeyword.trim();
    if (kw) {
      // When searching by keyword, precompute search score for speed
      const matches = allStudents.filter((s) => matchesStudentSearch(s, kw));
      const scored = matches.map((s) => {
        const score = getStudentSearchScore(s, kw);
        const aGrade = Number(s.grade || extractGradeFromClassOrGrade(s.grade, s.className));
        const inFilter =
          (selectedGrade === 'all' || aGrade === Number(selectedGrade)) &&
          (selectedClass === 'all' || s.className === selectedClass || areClassesEquivalent(s.className, selectedClass));
        return { s, score, inFilter };
      });

      scored.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.inFilter && !b.inFilter) return -1;
        if (!a.inFilter && b.inFilter) return 1;
        const aTime = a.s.createdAt || '';
        const bTime = b.s.createdAt || '';
        if (aTime && bTime && aTime !== bTime) return bTime.localeCompare(aTime);
        return (a.s.fullName || '').localeCompare(b.s.fullName || '', 'vi');
      });

      return scored.map((item) => item.s);
    }

    return allStudents.filter((s) => {
      const studentGrade = Number(s.grade || extractGradeFromClassOrGrade(s.grade, s.className));
      if (selectedGrade !== 'all' && studentGrade !== Number(selectedGrade)) {
        return false;
      }
      if (
        selectedClass !== 'all' &&
        s.className !== selectedClass &&
        !areClassesEquivalent(s.className, selectedClass) &&
        normalizeStudentClassName(s.className) !== normalizeStudentClassName(selectedClass)
      ) {
        return false;
      }
      return true;
    });
  }, [allStudents, selectedGrade, selectedClass, searchKeyword]);

  // Quick search suggestions when user types into the search box
  const quickSearchMatches = useMemo(() => {
    if (!searchKeyword.trim()) return [];
    return candidateStudents.slice(0, 12);
  }, [candidateStudents, searchKeyword]);

  // Handle grade change
  const handleGradeChange = (grade: 'all' | number) => {
    setSelectedGrade(grade);
    if (grade !== 'all' && selectedClass !== 'all') {
      const belongs = allClasses.some((c) => c.name === selectedClass && c.grade === grade);
      if (!belongs) {
        setSelectedClass('all');
      }
    }
  };

  // Handle student pick
  const handlePickStudent = (studentId: string) => {
    if (!studentId) {
      onSelectStudent(null);
      return;
    }
    const stu = allStudents.find((s) => s.id === studentId) || null;
    onSelectStudent(stu);
    if (stu) {
      setSelectedGrade(stu.grade);
      setSelectedClass(stu.className);
      setSearchKeyword('');
      setIsEditingSelection(false);
    }
  };

  // Clear selection and reset back to initial state
  const handleClearSelection = () => {
    onSelectStudent(null);
    setSearchKeyword('');
    setSelectedGrade('all');
    setSelectedClass('all');
    setIsEditingSelection(true);
  };

  return (
    <div className="space-y-2">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <label className="block font-bold text-slate-700 text-xs flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-emerald-700" />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
        {selectedStudent && !isEditingSelection && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchKeyword('');
                setIsEditingSelection(true);
              }}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đổi học sinh khác</span>
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Xóa chọn</span>
            </button>
          </div>
        )}
      </div>

      {/* When student is selected and not editing: Show concise, verified card */}
      {selectedStudent && !isEditingSelection ? (
        <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/90 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                {privacyMode ? 'HS' : (selectedStudent.fullName.charAt(selectedStudent.fullName.lastIndexOf(' ') + 1) || 'H')}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="font-bold text-slate-900 text-sm"
                    title={privacyMode ? 'Đang bật bảo mật ẩn tên' : selectedStudent.fullName}
                  >
                    {maskStudentName(selectedStudent.fullName, privacyMode)}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[10px]">
                    Lớp {selectedStudent.className}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 font-mono rounded text-[10px]">
                    {selectedStudent.studentCode}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Khối {selectedStudent.grade} • Giới tính: {selectedStudent.gender}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              title="Xóa chọn học sinh để chọn lại"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Contact or Allergies Alert */}
          <div className="mt-2 pt-2 border-t border-emerald-100/80 flex items-center justify-between text-[11px] flex-wrap gap-1">
            <div className="text-slate-600">
              {selectedStudent.fatherName ? (
                <span>Cha: <strong>{selectedStudent.fatherName}</strong> {selectedStudent.fatherPhone ? `(${selectedStudent.fatherPhone})` : ''}</span>
              ) : selectedStudent.motherName ? (
                <span>Mẹ: <strong>{selectedStudent.motherName}</strong> {selectedStudent.motherPhone ? `(${selectedStudent.motherPhone})` : ''}</span>
              ) : selectedStudent.parentName ? (
                <span>PH: <strong>{selectedStudent.parentName}</strong> {selectedStudent.parentPhone ? `(${selectedStudent.parentPhone})` : ''}</span>
              ) : (
                <span className="text-slate-400">Chưa có thông tin phụ huynh</span>
              )}
            </div>

            {selectedStudent.allergies && selectedStudent.allergies !== 'Không' && (
              <span className="text-rose-700 font-bold flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                <span>Dị ứng: {selectedStudent.allergies}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        /* SEARCHABLE + HIERARCHICAL PICKER */
        <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2.5">
          {/* Quick Type-to-Search Input at the top */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800">
                Gõ tìm nhanh học sinh (tên không dấu/có dấu, lớp hoặc mã HS):
              </span>
              {allowEmpty && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Để trống / Sự cố tập thể
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && quickSearchMatches.length > 0) {
                    e.preventDefault();
                    handlePickStudent(quickSearchMatches[0].id);
                  }
                }}
                placeholder="VD: Nguyễn Văn An, an 7a2, 6/1, HS0012..."
                className="w-full text-xs pl-8 pr-7 py-2 bg-white border border-emerald-500/60 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-hidden shadow-2xs"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Instant Clickable Results when typing */}
            {searchKeyword.trim() && (
              <div className="max-h-44 overflow-y-auto bg-white border border-emerald-200 rounded-lg divide-y divide-slate-100 shadow-sm">
                {quickSearchMatches.length === 0 ? (
                  <div className="p-2.5 text-center text-[11px] text-slate-500">
                    Không tìm thấy học sinh phù hợp với &ldquo;{searchKeyword}&rdquo;
                  </div>
                ) : (
                  quickSearchMatches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handlePickStudent(s.id)}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{maskStudentName(s.fullName, privacyMode)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Lớp {s.className}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{s.studentCode}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-0.5 shrink-0">
                        <Check className="w-3 h-3" />
                        Chọn
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-slate-200/70">
            {/* BƯỚC 1: TÌM / CHỌN KHỐI */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <span>Lọc theo Khối</span>
                </label>
                {selectedGrade !== 'all' && (
                  <span className="text-[10px] text-emerald-800 font-semibold">
                    Khối {selectedGrade}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {(['all', 6, 7, 8, 9] as const).map((g) => {
                  const isActive = selectedGrade === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGradeChange(g)}
                      className={`py-1 text-[11px] font-semibold rounded-lg text-center transition-all cursor-pointer ${
                        isActive
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g === 'all' ? 'Tất cả' : `K${g}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BƯỚC 2: TÌM / CHỌN LỚP */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <span>Lọc theo Lớp</span>
                </label>
                {selectedClass !== 'all' && (
                  <span className="text-[10px] text-emerald-800 font-semibold">
                    Lớp {selectedClass}
                  </span>
                )}
              </div>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
              >
                <option value="all">
                  {selectedGrade === 'all'
                    ? `-- Tất cả các lớp (${allClasses.length} lớp) --`
                    : `-- Tất cả lớp Khối ${selectedGrade} (${availableClasses.length} lớp) --`}
                </option>
                {availableClasses.map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    Lớp {c.name} {c.homeroomTeacher ? `(GVCN: ${c.homeroomTeacher})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* BƯỚC 3: CHỌN TỪ DANH SÁCH HỌC SINH */}
          <div className="pt-1.5 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700">
                Hoặc chọn từ danh sách ({candidateStudents.length} học sinh):
              </label>
            </div>

            <select
              value={selectedStudentId || ''}
              onChange={(e) => handlePickStudent(e.target.value)}
              className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
            >
              <option value="">
                {allowEmpty
                  ? emptyLabel
                  : '-- Bấm vào đây để chọn học sinh --'}
              </option>
              {candidateStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {maskStudentName(s.fullName, privacyMode)} • Lớp {s.className} (Mã: {s.studentCode})
                </option>
              ))}
            </select>

            {helperText && (
              <p className="text-[10px] text-slate-500 italic mt-1">{helperText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
