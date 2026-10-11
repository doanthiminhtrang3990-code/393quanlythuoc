import React, { useState, useMemo, useEffect } from 'react';
import {
  Stethoscope,
  Search,
  AlertTriangle,
  Pill,
  BriefcaseMedical,
  Activity,
  CheckCircle2,
  Clock,
  User,
  Phone,
  ShieldAlert,
  Printer,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  Scale,
  Calculator,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  db,
  formatDateVN,
  formatDateFormulaVN,
  normalizeManualTime24H,
  getCurrentDateISO,
  matchesStudentSearch,
  getStudentSearchScore,
  areClassesEquivalent,
  normalizeStudentClassName,
  extractGradeFromClassOrGrade,
  maskStudentName,
} from '../services/db';
import { CLINIC_REASONS, CLINIC_TREATMENTS } from '../services/studentData';
import { Student, Medicine, MedicalSupply, ClinicVisit } from '../types';
import { printClinicVisitReceiptA4 } from '../services/printA4Service';
import { DateInputVN } from './DateInputVN';

interface WeightDosageEvaluation {
  status: 'optimal' | 'warning_overdose' | 'warning_underdose' | 'info';
  badgeText: string;
  detailNote: string;
  recommendedQuantity: number;
  recommendedDosageText: string;
  betterAlternativeMed?: Medicine;
  mgPerKg?: number;
  totalMg?: number;
}

function parseMedicineStrengthMg(med?: Medicine): number | null {
  if (!med) return null;
  const raw = `${med.strength || ''} ${med.name || ''}`.toLowerCase();
  const matchG = raw.match(/(\d+(?:[.,]\d+)?)\s*g\b/);
  if (matchG && !raw.includes('mg')) {
    const val = parseFloat(matchG[1].replace(',', '.'));
    if (!isNaN(val) && val <= 5) return val * 1000;
  }
  const matchMg = raw.match(/(\d+(?:[.,]\d+)?)\s*mg\b/);
  if (matchMg) {
    return parseFloat(matchMg[1].replace(',', '.'));
  }
  if (med.name.includes('325')) return 325;
  if (med.name.includes('250')) return 250;
  if (med.name.includes('500')) return 500;
  if (med.name.includes('100')) return 100;
  if (med.name.includes('25')) return 25;
  if (med.name.includes('10')) return 10;
  if (med.name.includes(' 4')) return 4;
  return null;
}

function evaluateMedicineForStudentWeight(
  med: Medicine | undefined,
  quantity: number,
  weightKg: number,
  allMedicines: Medicine[]
): WeightDosageEvaluation {
  if (!med || !weightKg || weightKg <= 0) {
    return {
      status: 'info',
      badgeText: 'Nhập cân nặng HS để cân đối liều',
      detailNote: 'Vui lòng nhập cân nặng (kg) của học sinh để hệ thống tính liều mg/kg an toàn.',
      recommendedQuantity: quantity || 1,
      recommendedDosageText: 'Uống 1 viên sau ăn theo chỉ định y tế',
    };
  }

  const nameLower = `${med.name} ${med.activeIngredient || ''}`.toLowerCase();
  const strengthMg = parseMedicineStrengthMg(med);
  const isParacetamol =
    nameLower.includes('paracetamol') ||
    nameLower.includes('hapacol') ||
    nameLower.includes('efferalgan') ||
    nameLower.includes('decolgen') ||
    nameLower.includes('panadol');

  // 1. Nhóm Paracetamol (Chuẩn Bộ Y tế: 10 - 15 mg/kg/lần, cách 4-6 giờ)
  if (isParacetamol && strengthMg) {
    const minSafeMg = Math.round(weightKg * 10);
    const maxSafeMg = Math.round(weightKg * 15);
    const targetMg = weightKg * 12.5;
    const recQty = Math.max(1, Math.min(2, Math.round(targetMg / strengthMg)));
    const currentTotalMg = strengthMg * quantity;
    const mgPerKg = parseFloat((currentTotalMg / weightKg).toFixed(1));

    // Find better strength medicine if current 1 unit is already > 15.5 mg/kg
    let betterAlt: Medicine | undefined;
    if (strengthMg / weightKg > 15.5) {
      betterAlt = allMedicines.find(
        (m) =>
          m.id !== med.id &&
          (m.totalStock ?? m.stock ?? 0) > 0 &&
          (m.name.toLowerCase().includes('hapacol cam 250') ||
            m.name.toLowerCase().includes('hapacol cam 325'))
      );
    } else if (weightKg >= 42 && strengthMg <= 250) {
      betterAlt = allMedicines.find(
        (m) =>
          m.id !== med.id &&
          (m.totalStock ?? m.stock ?? 0) > 0 &&
          (m.name.toLowerCase().includes('hapacol blue') ||
            m.name.toLowerCase().includes('efferalgan') ||
            m.name.toLowerCase().includes('hapacol cam 325'))
      );
    }

    const recTotalMg = strengthMg * recQty;
    const recMgPerKg = parseFloat((recTotalMg / weightKg).toFixed(1));
    const unitLabel = med.unit?.toLowerCase() || 'viên';
    const recDosageText =
      strengthMg / weightKg > 16 && strengthMg === 500
        ? `Uống 1/2 ${unitLabel} (250mg ~ ${(250 / weightKg).toFixed(1)}mg/kg) sau ăn, cách 4-6h (Cân nặng ${weightKg}kg)`
        : `Uống ${recQty} ${unitLabel}/lần (${recTotalMg}mg ~ ${recMgPerKg}mg/kg) sau ăn, cách 4-6h nếu còn sốt/đau (HS ${weightKg}kg)`;

    if (mgPerKg > 15.5) {
      return {
        status: 'warning_overdose',
        badgeText: `Cao hơn chuẩn: ${currentTotalMg}mg (${mgPerKg} mg/kg > 15 mg/kg)`,
        detailNote: `Với cân nặng ${weightKg}kg, liều Paracetamol an toàn mỗi lần là ${minSafeMg}–${maxSafeMg}mg (10–15 mg/kg). Dùng ${quantity} ${unitLabel} (${currentTotalMg}mg) vượt mức khuyến cáo.`,
        recommendedQuantity: recQty,
        recommendedDosageText: recDosageText,
        betterAlternativeMed: betterAlt,
        mgPerKg,
        totalMg: currentTotalMg,
      };
    }

    if (mgPerKg < 8.5) {
      return {
        status: 'warning_underdose',
        badgeText: `Liều thấp: ${currentTotalMg}mg (${mgPerKg} mg/kg < 10 mg/kg)`,
        detailNote: `Với cân nặng ${weightKg}kg, liều chuẩn mỗi lần là ${minSafeMg}–${maxSafeMg}mg. Nên cân đối số lượng ${recQty} ${unitLabel} (${recTotalMg}mg) hoặc đổi hàm lượng phù hợp.`,
        recommendedQuantity: recQty,
        recommendedDosageText: recDosageText,
        betterAlternativeMed: betterAlt,
        mgPerKg,
        totalMg: currentTotalMg,
      };
    }

    return {
      status: 'optimal',
      badgeText: `Chuẩn cân nặng: ${currentTotalMg}mg (${mgPerKg} mg/kg/lần)`,
      detailNote: `Phù hợp chuẩn 10–15 mg/kg/lần cho học sinh ${weightKg}kg (Khoảng chuẩn: ${minSafeMg}–${maxSafeMg}mg/lần, tối đa ${Math.min(4000, Math.round(weightKg * 60))}mg/24h).`,
      recommendedQuantity: recQty,
      recommendedDosageText: `Uống ${quantity} ${unitLabel}/lần (${currentTotalMg}mg ~ ${mgPerKg}mg/kg) sau ăn, cách 4-6h (HS ${weightKg}kg)`,
      mgPerKg,
      totalMg: currentTotalMg,
    };
  }

  // 2. Alaxan (Paracetamol 325mg + Ibuprofen 200mg)
  if (nameLower.includes('alaxan')) {
    if (weightKg < 32) {
      const alt = allMedicines.find((m) => m.name.toLowerCase().includes('hapacol cam 325'));
      return {
        status: 'warning_overdose',
        badgeText: `Lưu ý cân nặng ${weightKg}kg (< 32kg)`,
        detailNote: `Alaxan chứa Ibuprofen 200mg + Paracetamol 325mg. Với học sinh ${weightKg}kg (< 32kg), nên dùng 1/2 viên sau ăn no hoặc đổi sang Hapacol Cam 325mg.`,
        recommendedQuantity: 1,
        recommendedDosageText: `Uống 1/2 viên sau ăn no (Cân đối cho HS ${weightKg}kg)`,
        betterAlternativeMed: alt,
      };
    }
    return {
      status: quantity > 1 ? 'warning_overdose' : 'optimal',
      badgeText: quantity > 1 ? 'Chỉ dùng 1 viên/lần' : `Phù hợp cân nặng ${weightKg}kg (1 viên/lần)`,
      detailNote: `Học sinh ${weightKg}kg: Uống 1 viên Alaxan sau ăn no để giảm đau cơ xương khớp, tránh kích ứng dạ dày.`,
      recommendedQuantity: 1,
      recommendedDosageText: `Uống 1 viên sau ăn no (Cân đối theo cân nặng ${weightKg}kg)`,
    };
  }

  // 3. Cataflam 25mg (Diclofenac 25mg: 0.5 - 1 mg/kg/lần)
  if (nameLower.includes('cataflam') || nameLower.includes('diclofenac')) {
    const mgPerKg = parseFloat(((25 * quantity) / weightKg).toFixed(2));
    if (weightKg < 32 || quantity > 1) {
      return {
        status: 'warning_overdose',
        badgeText: `Lưu ý liều (${mgPerKg} mg/kg)`,
        detailNote: `Cataflam 25mg khuyến cáo cho học sinh từ 32kg trở lên (liều 0.5–1 mg/kg/lần), tối đa 1 viên/lần uống ngay sau ăn no.`,
        recommendedQuantity: 1,
        recommendedDosageText: `Uống 1 viên ngay sau ăn no (HS ${weightKg}kg)`,
      };
    }
    return {
      status: 'optimal',
      badgeText: `Chuẩn cân nặng: 25mg (${mgPerKg} mg/kg)`,
      detailNote: `Phù hợp cho học sinh ${weightKg}kg (liều chuẩn 0.5–1 mg/kg/lần). Uống sau ăn no.`,
      recommendedQuantity: 1,
      recommendedDosageText: `Uống 1 viên ngay sau ăn no (Cân đối cho HS ${weightKg}kg ~ ${mgPerKg}mg/kg)`,
      mgPerKg,
      totalMg: 25 * quantity,
    };
  }

  // 4. Berberal 10mg & Berberal 100mg
  if (nameLower.includes('berberal 100')) {
    const recQty = weightKg >= 45 ? 1 : 1;
    if (weightKg < 30) {
      const alt10 = allMedicines.find((m) => m.name.toLowerCase().includes('berberal 10') && !m.name.includes('100'));
      return {
        status: 'warning_overdose',
        badgeText: `HS ${weightKg}kg nên dùng Berberal 10mg`,
        detailNote: `Học sinh dưới 30kg nên dùng Berberal 10mg (2-3 viên/lần) để chia liều chính xác hơn viên 100mg.`,
        recommendedQuantity: 1,
        recommendedDosageText: `Uống 1 viên/lần với nước ấm (HS ${weightKg}kg)`,
        betterAlternativeMed: alt10,
      };
    }
    return {
      status: 'optimal',
      badgeText: `Chuẩn cân nặng ${weightKg}kg: ${recQty} viên 100mg`,
      detailNote: `Học sinh ${weightKg}kg: Uống 1 viên Berberal 100mg/lần, ngày 2 lần.`,
      recommendedQuantity: recQty,
      recommendedDosageText: `Uống ${recQty} viên/lần với nước ấm (Cân đối theo cân nặng ${weightKg}kg)`,
    };
  }

  if (nameLower.includes('berberal 10')) {
    const recQty = weightKg < 32 ? 2 : weightKg < 45 ? 3 : 4;
    const alt100 =
      weightKg >= 40
        ? allMedicines.find((m) => m.name.toLowerCase().includes('berberal 100') && (m.totalStock ?? m.stock ?? 0) > 0)
        : undefined;
    return {
      status: quantity === recQty ? 'optimal' : 'info',
      badgeText: `Khuyến nghị theo ${weightKg}kg: ${recQty} viên 10mg (${recQty * 10}mg)`,
      detailNote: `Viên hàm lượng nhỏ 10mg: Với học sinh ${weightKg}kg, liều cân đối là ${recQty} viên/lần (${recQty * 10}mg)${alt100 ? ' hoặc đổi sang 1 viên Berberal 100mg cho dễ uống.' : '.'}`,
      recommendedQuantity: recQty,
      recommendedDosageText: `Uống ${recQty} viên/lần (${recQty * 10}mg) với nước ấm (Cân đối theo cân nặng ${weightKg}kg)`,
      betterAlternativeMed: alt100,
    };
  }

  // 5. Clopheniramin 4mg
  if (nameLower.includes('clopheniramin')) {
    const isSmall = weightKg < 35;
    return {
      status: quantity > 1 ? 'warning_overdose' : 'optimal',
      badgeText: isSmall ? `HS ${weightKg}kg: 1/2 - 1 viên (4mg)` : `Chuẩn cân nặng ${weightKg}kg: 1 viên (4mg)`,
      detailNote: `Thuốc kháng histamin chống dị ứng: Học sinh ${weightKg}kg uống ${isSmall ? '1/2 đến 1 viên' : '1 viên'}/lần. Lưu ý thuốc có thể gây buồn ngủ nhẹ trong giờ học.`,
      recommendedQuantity: 1,
      recommendedDosageText: isSmall
        ? `Uống 1/2 - 1 viên sau ăn, lưu ý nghỉ ngơi tránh buồn ngủ (HS ${weightKg}kg)`
        : `Uống 1 viên sau ăn, theo dõi tại phòng y tế (HS ${weightKg}kg)`,
    };
  }

  // 6. Alumina (Viên nhai dạ dày)
  if (nameLower.includes('alumina')) {
    const recQty = weightKg >= 45 ? 2 : 1;
    return {
      status: 'optimal',
      badgeText: `Cân đối theo ${weightKg}kg: Nhai ${recQty} viên`,
      detailNote: `Kháng acid dạ dày: Học sinh ${weightKg}kg nhai kỹ ${recQty} viên khi đau bụng thượng vị / ợ chua.`,
      recommendedQuantity: recQty,
      recommendedDosageText: `Nhai kỹ ${recQty} viên khi đau dạ dày, uống thêm nước ấm (HS ${weightKg}kg)`,
    };
  }

  // 7. Upsa C / Calcium hasan (Viên sủi)
  if (nameLower.includes('upsa c') || nameLower.includes('calcium')) {
    return {
      status: 'optimal',
      badgeText: `Cân đối theo ${weightKg}kg: 1 viên sủi`,
      detailNote: `Hòa tan hoàn toàn 1 viên sủi trong 200ml nước đun sôi để nguội, uống sau ăn (HS ${weightKg}kg).`,
      recommendedQuantity: 1,
      recommendedDosageText: `Hòa tan 1 viên sủi trong 200ml nước, uống từ từ (HS ${weightKg}kg)`,
    };
  }

  // Default for other medicines (Eugica, dầu xoa, nước muối...)
  const unitLower = (med.unit || 'viên').toLowerCase();
  const isExternal =
    unitLower.includes('chai') ||
    unitLower.includes('lọ') ||
    unitLower.includes('cuộn') ||
    unitLower.includes('cái') ||
    unitLower.includes('miếng') ||
    nameLower.includes('dầu') ||
    nameLower.includes('nước muối') ||
    nameLower.includes('povidine') ||
    nameLower.includes('oxy già');

  if (isExternal) {
    return {
      status: 'optimal',
      badgeText: 'Dùng ngoài da / tại chỗ',
      detailNote: 'Thuốc sát khuẩn / dùng ngoài da tại phòng y tế, không phụ thuộc liều mg/kg cân nặng.',
      recommendedQuantity: 1,
      recommendedDosageText: 'Sử dụng trực tiếp tại phòng y tế theo hướng dẫn chuyên môn',
    };
  }

  return {
    status: 'optimal',
    badgeText: `Đã cân đối theo ${weightKg}kg: 1 ${unitLower}/lần`,
    detailNote: `Liều khuyến nghị tại phòng y tế học đường cho học sinh ${weightKg}kg.`,
    recommendedQuantity: 1,
    recommendedDosageText: `Dùng 1 ${unitLower}/lần sau ăn (Cân đối cho HS ${weightKg}kg)`,
  };
}

interface ClinicReceptionProps {
  preselectedStudentId?: string;
  onSuccess?: (visit: ClinicVisit) => void;
  onCancel?: () => void;
  onNavigateToVisitsLog?: () => void;
  onNavigateToStaffClinic?: () => void;
}

export const ClinicReception: React.FC<ClinicReceptionProps> = ({
  preselectedStudentId,
  onSuccess,
  onNavigateToVisitsLog,
  onNavigateToStaffClinic,
}) => {
  const [students, setStudents] = useState<Student[]>(() => db.getStudents());
  const [allMedicines, setAllMedicines] = useState(() => db.getMedicines());
  const [allSupplies, setAllSupplies] = useState(() => db.getSupplies());
  const [currentUser, setCurrentUser] = useState(() => db.getCurrentUser());
  const [todayVisits, setTodayVisits] = useState<ClinicVisit[]>(() => db.getTodayClinicVisits());
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => db.isPrivacyModeEnabled());

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setStudents(db.getStudents());
      setAllMedicines(db.getMedicines());
      setAllSupplies(db.getSupplies());
      setCurrentUser(db.getCurrentUser());
      setTodayVisits(db.getTodayClinicVisits());
      setPrivacyMode(db.isPrivacyModeEnabled());
    });
    return () => unsub();
  }, []);

  // Search & Selected Student
  const [searchStudentTerm, setSearchStudentTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(() => {
    if (preselectedStudentId) {
      return students.find((s) => s.id === preselectedStudentId) || null;
    }
    return null;
  });

  // Toggle thu gọn danh sách ca khám trong ngày (mặc định thu gọn để ưu tiên biểu mẫu tiếp nhận học sinh ngay đầu trang)
  const [isTodayVisitsPanelExpanded, setIsTodayVisitsPanelExpanded] = useState(false);

  // Thêm nhanh học sinh trực tiếp tại phòng tiếp nhận
  const [isQuickAddStudentOpen, setIsQuickAddStudentOpen] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({
    studentCode: '',
    fullName: '',
    grade: 6,
    className: '6/1',
    gender: 'Nam' as 'Nam' | 'Nữ',
    parentPhone: '',
    allergies: '',
  });

  const handleOpenQuickAdd = (prefillName?: string) => {
    const nextCode = `HS${String(students.length + 1).padStart(4, '0')}`;
    const defClass = filterClass !== 'all' ? filterClass : schoolClasses[0]?.name || '6/1';
    const defGrade = typeof filterGrade === 'number' ? filterGrade : parseInt(defClass.charAt(0), 10) || 6;
    setQuickAddForm({
      studentCode: nextCode,
      fullName: prefillName ? prefillName.trim() : '',
      grade: defGrade,
      className: defClass,
      gender: 'Nam',
      parentPhone: '',
      allergies: '',
    });
    setQuickAddError(null);
    setIsQuickAddStudentOpen(true);
  };

  const handleConfirmQuickAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAddError(null);
    if (!quickAddForm.fullName.trim()) {
      setQuickAddError('Vui lòng nhập họ và tên học sinh.');
      return;
    }
    try {
      const newStu = db.addStudent({
        studentCode: quickAddForm.studentCode.trim() || `HS${String(students.length + 1).padStart(4, '0')}`,
        fullName: quickAddForm.fullName.trim(),
        birthDate: '2014-01-01',
        gender: quickAddForm.gender,
        grade: quickAddForm.grade,
        className: quickAddForm.className,
        schoolYear: '2026-2027',
        parentName: '',
        parentPhone: quickAddForm.parentPhone.trim(),
        allergies: quickAddForm.allergies.trim(),
        chronicConditions: '',
        specialAttention: !!quickAddForm.allergies.trim(),
      });
      setStudents(db.getStudents());
      setSelectedStudent(newStu);
      setSearchStudentTerm('');
      setIsQuickAddStudentOpen(false);
    } catch (err: any) {
      setQuickAddError(err.message || 'Không thể thêm học sinh.');
    }
  };

  // Time & Escort
  const now = new Date();
  const currentDateStr = getCurrentDateISO();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const [visitDate, setVisitDate] = useState(currentDateStr);
  const [timeIn, setTimeIn] = useState(currentTimeStr);
  const [timeOut, setTimeOut] = useState('');
  const [broughtBy, setBroughtBy] = useState('Tự đến');

  // Reason & Symptoms
  const [selectedReason, setSelectedReason] = useState<string>('Đau bụng');
  const [customReason, setCustomReason] = useState('');
  const [initialCondition, setInitialCondition] = useState('');

  // Vital Signs & Anthropometrics (Weight/Height for Medication Balancing)
  const [temperature, setTemperature] = useState<number | ''>(37.0);
  const [studentWeight, setStudentWeight] = useState<number | ''>('');
  const [studentHeight, setStudentHeight] = useState<number | ''>('');
  const [pulse, setPulse] = useState<number | ''>('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState<number | ''>('');
  const [spO2, setSpO2] = useState<number | ''>('');

  // Auto-load student's weight & height from Health Profile when selectedStudent changes
  useEffect(() => {
    if (!selectedStudent) {
      setStudentWeight('');
      setStudentHeight('');
      return;
    }
    const profile = db.getStudentHealthProfile(selectedStudent.id);
    if (profile?.weight && profile.weight > 0) {
      setStudentWeight(profile.weight);
    } else {
      // Reference default weight by secondary school grade (Grades 6-9) if not yet measured
      const defaultWeightByGrade: Record<number, number> = { 6: 36, 7: 41, 8: 46, 9: 51 };
      setStudentWeight(defaultWeightByGrade[selectedStudent.grade] || 40);
    }
    if (profile?.height && profile.height > 0) {
      setStudentHeight(profile.height);
    } else {
      setStudentHeight('');
    }
  }, [selectedStudent]);

  // Automatically re-balance dosage instructions when studentWeight changes
  const handleApplyWeightBalanceToAll = (targetWeight?: number) => {
    const w = targetWeight !== undefined ? targetWeight : Number(studentWeight);
    if (!w || w <= 0) return;
    setMedicinesToDispense((prev) =>
      prev.map((item) => {
        const med = allMedicines.find((m) => m.id === item.medicineId);
        const evalRes = evaluateMedicineForStudentWeight(med, item.quantity, w, allMedicines);
        // If current medicine is warning_overdose and a safer alternative exists in stock, switch to it
        if (evalRes.status === 'warning_overdose' && evalRes.betterAlternativeMed) {
          const altEval = evaluateMedicineForStudentWeight(evalRes.betterAlternativeMed, 1, w, allMedicines);
          return {
            medicineId: evalRes.betterAlternativeMed.id,
            quantity: altEval.recommendedQuantity,
            dosageInstructions: altEval.recommendedDosageText,
          };
        }
        return {
          ...item,
          quantity: evalRes.recommendedQuantity,
          dosageInstructions: evalRes.recommendedDosageText,
        };
      })
    );
  };

  // Smart weight-balanced suggestions based on current reason & studentWeight
  const weightBalancedSuggestions = useMemo(() => {
    const w = typeof studentWeight === 'number' && studentWeight > 0 ? studentWeight : 40;
    const r = selectedReason.toLowerCase();
    const suggestions: Array<{
      med: Medicine;
      quantity: number;
      dosageInstructions: string;
      reasonTag: string;
      doseBadge: string;
    }> = [];

    const findMed = (keyword: string) =>
      allMedicines.find(
        (m) =>
          (m.totalStock ?? m.stock ?? 0) > 0 &&
          (`${m.name} ${m.activeIngredient || ''}`.toLowerCase().includes(keyword.toLowerCase()))
      );

    if (r.includes('sốt') || r.includes('đau đầu') || r.includes('cảm')) {
      const preferredPara =
        w < 28
          ? findMed('hapacol cam 250') || findMed('hapacol cam 325')
          : w < 36
          ? findMed('hapacol cam 325') || findMed('hapacol cam 250')
          : findMed('hapacol blue') || findMed('efferalgan') || findMed('hapacol cam 325');

      if (preferredPara) {
        const ev = evaluateMedicineForStudentWeight(preferredPara, 1, w, allMedicines);
        suggestions.push({
          med: preferredPara,
          quantity: ev.recommendedQuantity,
          dosageInstructions: ev.recommendedDosageText,
          reasonTag: 'Hạ sốt / Giảm đau chuẩn cân nặng',
          doseBadge: ev.badgeText,
        });
      }
    }

    if (r.includes('đau bụng') || r.includes('tiêu hóa') || r.includes('buồn nôn')) {
      const alumina = findMed('alumina');
      if (alumina) {
        const ev = evaluateMedicineForStudentWeight(alumina, 1, w, allMedicines);
        suggestions.push({
          med: alumina,
          quantity: ev.recommendedQuantity,
          dosageInstructions: ev.recommendedDosageText,
          reasonTag: 'Đau dạ dày / Đau thượng vị',
          doseBadge: ev.badgeText,
        });
      }
      const berberal = w >= 38 ? findMed('berberal 100') || findMed('berberal 10') : findMed('berberal 10') || findMed('berberal 100');
      if (berberal) {
        const ev = evaluateMedicineForStudentWeight(berberal, 1, w, allMedicines);
        suggestions.push({
          med: berberal,
          quantity: ev.recommendedQuantity,
          dosageInstructions: ev.recommendedDosageText,
          reasonTag: 'Rối loạn tiêu hóa / Đau bụng',
          doseBadge: ev.badgeText,
        });
      }
    }

    if (r.includes('ho') || r.includes('họng')) {
      const eugica = findMed('eugica');
      if (eugica) {
        const ev = evaluateMedicineForStudentWeight(eugica, 1, w, allMedicines);
        suggestions.push({
          med: eugica,
          quantity: ev.recommendedQuantity,
          dosageInstructions: ev.recommendedDosageText,
          reasonTag: 'Dịu ho / Đau rát họng',
          doseBadge: ev.badgeText,
        });
      }
    }

    if (r.includes('dị ứng') || r.includes('ngứa')) {
      const clophen = findMed('clopheniramin');
      if (clophen) {
        const ev = evaluateMedicineForStudentWeight(clophen, 1, w, allMedicines);
        suggestions.push({
          med: clophen,
          quantity: ev.recommendedQuantity,
          dosageInstructions: ev.recommendedDosageText,
          reasonTag: 'Chống dị ứng / Mề đay',
          doseBadge: ev.badgeText,
        });
      }
    }

    // Always provide a weight-matched Paracetamol option if list is empty
    if (suggestions.length === 0) {
      const fallbackMed =
        w < 35
          ? findMed('hapacol cam 325') || findMed('hapacol cam 250') || allMedicines[0]
          : findMed('hapacol blue') || findMed('efferalgan') || allMedicines[0];
      if (fallbackMed) {
        const ev = evaluateMedicineForStudentWeight(fallbackMed, 1, w, allMedicines);
        suggestions.push({
          med: fallbackMed,
          quantity: ev.recommendedQuantity,
          dosageInstructions: ev.recommendedDosageText,
          reasonTag: `Gợi ý theo cân nặng ${w}kg`,
          doseBadge: ev.badgeText,
        });
      }
    }

    return suggestions;
  }, [studentWeight, selectedReason, allMedicines]);

  // Treatment & Performer
  const [treatment, setTreatment] = useState('Nghỉ ngơi, theo dõi');
  const [performer, setPerformer] = useState(currentUser.fullName || currentUser.name || 'Y sĩ Trần Thị Bích Thảo');

  // Medicines Dispensed state
  const [medicinesToDispense, setMedicinesToDispense] = useState<
    Array<{
      medicineId: string;
      quantity: number;
      dosageInstructions: string;
    }>
  >([]);

  // Supplies Used state
  const [suppliesToUse, setSuppliesToUse] = useState<
    Array<{
      supplyId: string;
      quantity: number;
    }>
  >([]);

  // Outcome & Parent Notification
  const [outcome, setOutcome] = useState<'Đã ổn định cho về lớp' | 'Nghỉ tại phòng y tế' | 'Bàn giao phụ huynh đón về' | 'Chuyển cơ sở y tế tuyến trên'>('Đã ổn định cho về lớp');
  const [parentNotified, setParentNotified] = useState(false);
  const [parentContactNotes, setParentContactNotes] = useState('');
  const [transferHospital, setTransferHospital] = useState('Bệnh viện Đa khoa Khu vực Hóc Môn');
  const [notes, setNotes] = useState('');

  // Status & Success state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedVisit, setSavedVisit] = useState<ClinicVisit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [deletingVisit, setDeletingVisit] = useState<ClinicVisit | null>(null);
  const [filterGrade, setFilterGrade] = useState<'all' | number>('all');
  const [filterClass, setFilterClass] = useState<string>('all');

  const schoolClasses = useMemo(() => db.getSchoolClasses(), [students]);
  const availableFilterClasses = useMemo(() => {
    if (filterGrade === 'all') return schoolClasses;
    return schoolClasses.filter((c) => c.grade === filterGrade);
  }, [schoolClasses, filterGrade]);

  // Student search filtering (supports accent-insensitive name, studentCode, className, and grade/class filters)
  const matchingStudents = useMemo(() => {
    const term = searchStudentTerm.trim();

    // 1. Khi người dùng gõ tìm kiếm: Tìm trên TOÀN TRƯỜNG theo tên, mã HS, SĐT, lớp...
    if (term) {
      const allMatches = students.filter((s) => matchesStudentSearch(s, term));
      // Precompute scores once for all matched students (Schwartzian transform)
      const scored = allMatches.map((s) => {
        const score = getStudentSearchScore(s, term);
        const aGrade = Number(s.grade || extractGradeFromClassOrGrade(s.grade, s.className));
        const inFilter =
          (filterGrade === 'all' || aGrade === Number(filterGrade)) &&
          (filterClass === 'all' || s.className === filterClass || areClassesEquivalent(s.className, filterClass));
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

    // 2. Khi KHÔNG có từ khóa tìm kiếm nhưng đang chọn Khối hoặc Lớp: Lọc đầy đủ toàn bộ học sinh trong lớp/khối
    if (filterGrade !== 'all' || filterClass !== 'all') {
      return students
        .filter((s) => {
          const studentGrade = Number(s.grade || extractGradeFromClassOrGrade(s.grade, s.className));
          if (filterGrade !== 'all' && studentGrade !== Number(filterGrade)) return false;
          if (
            filterClass !== 'all' &&
            s.className !== filterClass &&
            !areClassesEquivalent(s.className, filterClass) &&
            normalizeStudentClassName(s.className) !== normalizeStudentClassName(filterClass)
          ) {
            return false;
          }
          return true;
        })
        .sort((a, b) => {
          const aTime = a.createdAt || '';
          const bTime = b.createdAt || '';
          if (aTime && bTime && aTime !== bTime) return bTime.localeCompare(aTime);
          return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
        });
    }

    // 3. Khi chưa nhập từ khóa và để "Tất cả": Ẩn danh sách tên học sinh (chỉ hiển thị khi người dùng gõ từ khóa tìm kiếm hoặc chọn Khối/Lớp)
    return [];
  }, [students, searchStudentTerm, filterGrade, filterClass]);

  const handleConfirmDeleteVisit = () => {
    if (!deletingVisit) return;
    db.deleteClinicVisit(deletingVisit.id);
    setTodayVisits(db.getTodayClinicVisits());
    if (savedVisit?.id === deletingVisit.id || selectedStudent?.id === deletingVisit.studentId) {
      handleResetForNext();
    }
    setDeletingVisit(null);
  };

  // Allergy Check for Selected Student against selected medicines
  const allergyWarning = useMemo(() => {
    if (!selectedStudent || !selectedStudent.allergies || selectedStudent.allergies === 'Không') return null;
    const studentAllergyText = selectedStudent.allergies.toLowerCase();

    // Check if any selected medicine matches
    for (const medItem of medicinesToDispense) {
      const med = allMedicines.find((m) => m.id === medItem.medicineId);
      if (!med) continue;
      if (
        studentAllergyText.includes(med.name.toLowerCase()) ||
        studentAllergyText.includes(med.activeIngredient.toLowerCase())
      ) {
        return `CẢNH BÁO NGUY HIỂM: Học sinh có tiền sử dị ứng với "${selectedStudent.allergies}". Thuốc "${med.name}" (${med.activeIngredient}) có nguy cơ gây sốc hoặc phản ứng dị ứng!`;
      }
    }
    return null;
  }, [selectedStudent, medicinesToDispense, allMedicines]);

  // Handle Add Medicine row (auto-selects weight-appropriate medicine & calculates dose)
  const handleAddMedicineRow = () => {
    const w = typeof studentWeight === 'number' && studentWeight > 0 ? studentWeight : 40;
    const suggested = weightBalancedSuggestions[0]?.med;
    const availableMed =
      suggested ||
      allMedicines.find((m) => (m.totalStock ?? m.stock ?? 0) > 0) ||
      allMedicines[0];

    if (availableMed) {
      const evalRes = evaluateMedicineForStudentWeight(availableMed, 1, w, allMedicines);
      setMedicinesToDispense((prev) => [
        ...prev,
        {
          medicineId: availableMed.id,
          quantity: evalRes.recommendedQuantity,
          dosageInstructions: evalRes.recommendedDosageText,
        },
      ]);
    }
  };

  const handleRemoveMedicineRow = (index: number) => {
    setMedicinesToDispense((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Add Supply row
  const handleAddSupplyRow = () => {
    const availableSup = allSupplies.find((s) => s.quantity > 0) || allSupplies[0];
    if (availableSup) {
      setSuppliesToUse((prev) => [
        ...prev,
        {
          supplyId: availableSup.id,
          quantity: 1,
        },
      ]);
    }
  };

  const handleRemoveSupplyRow = (index: number) => {
    setSuppliesToUse((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Submission
  const executeSaveVisit = (overrideAllergy = false) => {
    if (isSubmitting) return;

    if (!selectedStudent) {
      setErrorMessage('Vui lòng chọn học sinh tiếp nhận.');
      return;
    }

    if (allergyWarning && !overrideAllergy) {
      setShowAllergyModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedTimeIn = normalizeManualTime24H(timeIn) || currentTimeStr;
      const normalizedTimeOut = timeOut ? normalizeManualTime24H(timeOut) : undefined;
      const fullDateTime = `${visitDate}T${normalizedTimeIn}:00`;
      const finalReason = selectedReason === 'Khác' && customReason ? customReason : selectedReason;
      const isTransfer = outcome === 'Chuyển cơ sở y tế tuyến trên' || (outcome as string) === 'Chuyển viện';

      const newVisit = db.addClinicVisit({
        studentId: selectedStudent.id,
        studentCode: selectedStudent.studentCode,
        studentName: selectedStudent.fullName,
        className: selectedStudent.className,
        visitDate,
        timeIn: normalizedTimeIn,
        timeOut: normalizedTimeOut,
        dateTime: fullDateTime,
        broughtBy,
        reasons: [finalReason],
        customReason: selectedReason === 'Khác' ? customReason : undefined,
        initialCondition: initialCondition || 'Học sinh báo mệt mỏi, khó chịu',
        vitals: {
          temperature: temperature !== '' ? Number(temperature) : undefined,
          weight: studentWeight !== '' ? Number(studentWeight) : undefined,
          height: studentHeight !== '' ? Number(studentHeight) : undefined,
          pulse: pulse !== '' ? Number(pulse) : undefined,
          bloodPressure: bloodPressure || undefined,
          respiratoryRate: respiratoryRate !== '' ? Number(respiratoryRate) : undefined,
          spO2: spO2 !== '' ? Number(spO2) : undefined,
        },
        treatmentType: treatment,
        treatmentDetails: treatment,
        medicinesUsed: medicinesToDispense.map((m) => {
          const medObj = allMedicines.find((x) => x.id === m.medicineId);
          return {
            medicineId: m.medicineId,
            medicineCode: medObj?.code || '',
            medicineName: medObj?.name || '',
            batchId: '',
            batchNumber: '',
            expDate: '',
            quantity: Number(m.quantity),
            unit: medObj?.unit || 'viên',
            unitPrice: medObj?.unitPrice || 0,
            dosageInstructions: m.dosageInstructions,
          };
        }),
        suppliesUsed: suppliesToUse.map((s) => {
          const supObj = allSupplies.find((x) => x.id === s.supplyId);
          return {
            supplyId: s.supplyId,
            supplyCode: supObj?.code || '',
            supplyName: supObj?.name || '',
            quantity: Number(s.quantity),
            unit: supObj?.unit || 'cái',
          };
        }),
        outcome,
        parentContacted: parentNotified,
        parentContactNotes: parentContactNotes || undefined,
        isTransferred: isTransfer,
        transferHospital: isTransfer ? transferHospital : undefined,
        performer,
        notes: notes || undefined,
      });

      setSavedVisit(newVisit);
      setTodayVisits(db.getTodayClinicVisits());
      setShowAllergyModal(false);
      onSuccess?.(newVisit);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi lưu lượt khám.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitVisit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    executeSaveVisit(false);
  };

  // Reset form for next student
  const handleResetForNext = () => {
    setSelectedStudent(null);
    setSearchStudentTerm('');
    setFilterGrade('all');
    setFilterClass('all');
    setSelectedReason('Đau bụng');
    setCustomReason('');
    const d = new Date();
    setVisitDate(getCurrentDateISO());
    setTimeIn(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setTimeOut('');
    setInitialCondition('');
    setTemperature(37.0);
    setStudentWeight('');
    setStudentHeight('');
    setPulse('');
    setBloodPressure('');
    setRespiratoryRate('');
    setSpO2('');
    setTreatment('Nghỉ ngơi, theo dõi');
    setMedicinesToDispense([]);
    setSuppliesToUse([]);
    setOutcome('Đã ổn định cho về lớp');
    setParentNotified(false);
    setParentContactNotes('');
    setNotes('');
    setSavedVisit(null);
    setErrorMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              QUY TRÌNH 10 BƯỚC CHUẨN
            </span>
            <h1 className="text-xl font-bold text-slate-900">Tiếp Nhận Học Sinh Vào Phòng Y Tế</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Trường THCS Đông Thạnh • Tự động liên kết hồ sơ sức khỏe & Trừ kho thuốc theo nguyên tắc FEFO
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('input-student-intake-search');
              el?.focus();
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            title="Cuộn nhanh tới ô nhập tên học sinh"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nhập / Chọn học sinh ngay</span>
          </button>

          {onNavigateToStaffClinic && (
            <button
              type="button"
              onClick={onNavigateToStaffClinic}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold border border-teal-300 transition-colors shadow-2xs cursor-pointer"
            >
              <BriefcaseMedical className="w-4 h-4 text-teal-700" />
              <span>Cho thuốc Giáo viên & CNV</span>
            </button>
          )}

          {onNavigateToVisitsLog && (
            <button
              type="button"
              onClick={onNavigateToVisitsLog}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors self-start md:self-auto cursor-pointer"
            >
              <span>Xem sổ phòng y tế ({todayVisits.length} ca trong ngày)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Danh Sách Ca Bệnh Trong Ngày (Live Synced Panel) */}
      <div className="bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-blue-50/70 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Ca Bệnh Đã Tiếp Nhận Trong Ngày</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-500 text-white shadow-2xs">
                  {todayVisits.length} ca thực tế
                </span>
              </h2>
              <p className="text-[11px] text-slate-600">
                Tự động đồng bộ giữa máy ở nhà và máy ở trường • Hiển thị các ca khám mới nhất trong ngày
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTodayVisitsPanelExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              {isTodayVisitsPanelExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{isTodayVisitsPanelExpanded ? 'Thu gọn' : `Mở rộng (${todayVisits.length} ca)`}</span>
            </button>
            {onNavigateToVisitsLog && (
              <button
                type="button"
                onClick={onNavigateToVisitsLog}
                className="text-xs font-bold text-blue-800 hover:text-blue-950 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <span>Mở toàn bộ Sổ phòng y tế</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {!isTodayVisitsPanelExpanded ? (
          <div className="px-5 py-3.5 bg-slate-50 flex items-center justify-between text-xs text-slate-700">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              <span>
                Đang thu gọn danh sách ca bệnh: <strong>{todayVisits.length} ca thực tế</strong> hôm nay. Toàn bộ dữ liệu được lưu an toàn.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIsTodayVisitsPanelExpanded(true)}
              className="text-blue-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Xem chi tiết danh sách ca</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : todayVisits.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">
            Chưa có ca bệnh nào được ghi nhận trong ngày. Hãy điền biểu mẫu bên dưới để tiếp nhận học sinh.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Mã ca / Thời gian</th>
                  <th className="py-2.5 px-4">Học sinh & Lớp</th>
                  <th className="py-2.5 px-4">Triệu chứng & Sinh hiệu</th>
                  <th className="py-2.5 px-4">Xử trí & Thuốc cấp</th>
                  <th className="py-2.5 px-4">Kết quả / Cán bộ</th>
                  <th className="py-2.5 px-4 text-right">Thao tác</th>
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
                    <tr key={v.id} className="hover:bg-emerald-50/30 transition-colors">
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
                          title={privacyMode ? 'Đã ẩn tên (Bảo mật)' : v.studentName}
                        >
                          {maskStudentName(v.studentName, privacyMode)}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Lớp <strong className="text-emerald-800">{v.className}</strong>
                          {v.studentCode ? ` • Mã: ${v.studentCode}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-rose-700 block">{reasonText}</span>
                        {v.initialCondition && (
                          <span className="text-[11px] text-slate-600 block">
                            Tình trạng: {v.initialCondition}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          {v.vitals?.temperature ? `${v.vitals.temperature}°C` : ''}
                          {v.vitals?.weight ? ` • ${v.vitals.weight}kg` : ''}
                          {v.vitals?.bloodPressure ? ` • HA ${v.vitals.bloodPressure}` : ''}
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
                          <span className="text-[11px] text-slate-400">Không dùng thuốc</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                          {v.outcome || 'Đã ổn định'}
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          CB: {v.performer || 'Nhân viên Y tế'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => printClinicVisitReceiptA4(v)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>In phiếu</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingVisit(v)}
                            title="Xóa ca khám này và hoàn trả thuốc/vật tư vào kho"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Success Modal / Printable Card after submission */}
      {savedVisit && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 shadow-md space-y-4 animate-in fade-in">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-900 text-base">
                  Tiếp Nhận & Xử Trí Thành Công: {savedVisit.visitCode}
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Đã ghi nhận ca khám cho học sinh <strong>{savedVisit.studentName}</strong> (Lớp {savedVisit.className}).
                  Kho thuốc và vật tư đã được tự động cập nhật theo lô FEFO!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => printClinicVisitReceiptA4(savedVisit)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 shadow-xs cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>In phiếu chăm sóc (A4)</span>
              </button>
              <button
                type="button"
                onClick={handleResetForNext}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tiếp nhận ca tiếp theo</span>
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Lý do đến:</span>
              <span className="font-semibold text-slate-800">
                {savedVisit.reason || (savedVisit.reasons && savedVisit.reasons.length > 0 ? savedVisit.reasons.join(', ') : 'Kiểm tra y tế')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Xử trí:</span>
              <span className="font-semibold text-slate-800">
                {savedVisit.treatment || savedVisit.treatmentDetails || savedVisit.treatmentType || 'Theo dõi y tế'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Kết quả:</span>
              <span className="font-semibold text-emerald-800">{savedVisit.outcome}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Thuốc cấp (FEFO):</span>
              <span className="font-bold text-slate-800">
                {(() => {
                  const dispensed = (savedVisit.medicinesUsed && savedVisit.medicinesUsed.length > 0)
                    ? savedVisit.medicinesUsed
                    : (savedVisit.medicinesDispensed || []);
                  return dispensed.length > 0
                    ? dispensed.map((m) => `${m.medicineName} (${m.quantity} ${m.unit})`).join(', ')
                    : 'Không cấp thuốc';
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Intake Form */}
      <form onSubmit={handleSubmitVisit} className="space-y-6">
        {/* Error alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* BƯỚC 1: CHỌN HỌC SINH & XEM THẺ TÓM TẮT AN TOÀN */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h2 className="font-bold text-slate-900 text-sm">Chọn Học Sinh Tiếp Nhận</h2>
            </div>
            {selectedStudent && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
                  title="Bấm để mở lại ô tìm kiếm và chọn học sinh khác"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Tìm / Đổi học sinh khác</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetForNext}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                  title="Xóa học sinh đang chọn và làm mới toàn bộ biểu mẫu về lại như cũ"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Làm mới</span>
                </button>
              </div>
            )}
          </div>

          {!selectedStudent ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-student-intake-search"
                    type="text"
                    placeholder="Gõ họ tên học sinh (có dấu/không dấu), mã HS hoặc lớp (VD: An 7A1, 6/1)..."
                    value={searchStudentTerm}
                    onChange={(e) => setSearchStudentTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && matchingStudents.length > 0) {
                        e.preventDefault();
                        setSelectedStudent(matchingStudents[0]);
                        setSearchStudentTerm('');
                      }
                    }}
                    className="w-full pl-9 pr-8 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  />
                  {searchStudentTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchStudentTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = db.togglePrivacyMode();
                      setPrivacyMode(next);
                    }}
                    className={`w-full py-2.5 px-2 rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                      privacyMode
                        ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-200'
                        : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
                    }`}
                    title={privacyMode ? 'Đang bật bảo mật ẩn tên. Bấm để hiển thị tên.' : 'Bấm để ẩn tên học sinh khi tiếp nhận'}
                  >
                    {privacyMode ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{privacyMode ? 'Đang ẩn tên' : 'Ẩn tên HS'}</span>
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuickAdd(searchStudentTerm)}
                    className="w-full py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Thêm nhanh học sinh mới vào hệ thống"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Thêm HS Mới</span>
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <select
                    value={filterGrade}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                      setFilterGrade(val);
                      setFilterClass('all');
                    }}
                    className="w-full py-2.5 px-2.5 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="all">Tất cả Khối</option>
                    <option value={6}>Khối 6</option>
                    <option value={7}>Khối 7</option>
                    <option value={8}>Khối 8</option>
                    <option value={9}>Khối 9</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="w-full py-2.5 px-2.5 text-xs border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="all">Tất cả Lớp ({availableFilterClasses.length})</option>
                    {availableFilterClasses.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        Lớp {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {students.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Hệ thống chưa có danh sách học sinh</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Để ghi nhận ca khám và cấp phát thuốc, Quý Thầy/Cô vui lòng chuyển sang mục <strong>Hồ Sơ Sức Khỏe Học Sinh</strong> để nạp danh sách học sinh từ file Excel hoặc thêm học sinh mới.
                  </p>
                </div>
              ) : searchStudentTerm.trim() && matchingStudents.length === 0 ? (
                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Không tìm thấy học sinh &ldquo;<strong>{searchStudentTerm}</strong>&rdquo;</span>
                      </p>
                      <p className="text-[11px] text-amber-800 mt-1">
                        Học sinh mới chuyển trường hoặc chưa có trong danh sách? Bấm nút bên cạnh để thêm nhanh và tiếp nhận khám ngay.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenQuickAdd(searchStudentTerm)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Thêm Nhanh & Tiếp Nhận Ngay</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {matchingStudents.length > 0 && (
                <div className="space-y-2 border border-slate-200 p-2.5 rounded-xl bg-slate-50/70">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        {searchStudentTerm.trim() ? (
                          <span>
                            Tìm thấy <span className="text-emerald-700 font-black">{matchingStudents.length}</span> học sinh khớp &ldquo;<span className="text-slate-900">{searchStudentTerm}</span>&rdquo; (toàn trường):
                          </span>
                        ) : filterClass !== 'all' ? (
                          <span>
                            Danh sách học sinh Lớp <span className="text-emerald-800 font-black">{filterClass}</span> (<span className="text-emerald-700 font-bold">{matchingStudents.length} HS</span>):
                          </span>
                        ) : filterGrade !== 'all' ? (
                          <span>
                            Danh sách học sinh Khối <span className="text-emerald-800 font-black">{filterGrade}</span> (<span className="text-emerald-700 font-bold">{matchingStudents.length} HS</span>):
                          </span>
                        ) : (
                          <span>
                            Học sinh mới thêm / tiếp nhận nhanh (<span className="text-emerald-700 font-bold">{matchingStudents.length} HS</span>):
                          </span>
                        )}
                      </span>
                    </div>

                    {(searchStudentTerm || filterGrade !== 'all' || filterClass !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchStudentTerm('');
                          setFilterGrade('all');
                          setFilterClass('all');
                        }}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                      >
                        ✕ Xóa lọc / Ẩn danh sách
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {matchingStudents.map((stu, idx) => (
                      <button
                        key={stu.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(stu);
                          setSearchStudentTerm('');
                        }}
                        className={`p-2.5 text-left rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${
                          idx === 0 && searchStudentTerm.trim()
                            ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs hover:bg-emerald-100/90'
                            : 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-bold text-xs text-slate-900 group-hover:text-emerald-900"
                              title={privacyMode ? 'Đang bật bảo mật ẩn tên' : stu.fullName}
                            >
                              {maskStudentName(stu.fullName, privacyMode)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {stu.className}
                            </span>
                            {stu.gender && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                ({stu.gender})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400 font-mono font-bold">{stu.studentCode}</span>
                            {stu.parentPhone && (
                              <span className="text-[10px] text-slate-500">
                                • SĐT: {stu.parentPhone}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          {stu.specialAttention && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                              ⚠️ Chú ý
                            </span>
                          )}
                          <span className="text-xs font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            Chọn →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg">
                    {privacyMode ? 'HS' : (selectedStudent.fullName.charAt(selectedStudent.fullName.lastIndexOf(' ') + 1) || 'H')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className="font-bold text-slate-900 text-sm"
                        title={privacyMode ? 'Đang bật bảo mật ẩn tên' : selectedStudent.fullName}
                      >
                        {maskStudentName(selectedStudent.fullName, privacyMode)}
                      </h3>
                      <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {selectedStudent.studentCode}
                      </span>
                      {selectedStudent.bloodType && (
                        <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                          Nhóm {selectedStudent.bloodType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Lớp <strong>{selectedStudent.className}</strong> • Khối {selectedStudent.grade} • Ngày sinh:{' '}
                      <strong className="text-slate-800 font-mono" title={formatDateFormulaVN(selectedStudent.birthDate)}>
                        {formatDateVN(selectedStudent.birthDate)}
                      </strong>{' '}
                      <span className="text-emerald-700 text-[11px] font-medium">({formatDateFormulaVN(selectedStudent.birthDate)})</span> ({selectedStudent.gender})
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <p className="font-semibold text-slate-800">
                    Phụ huynh: {maskStudentName(selectedStudent.parentName, privacyMode) || '—'}
                  </p>
                  <p className="text-slate-500 font-mono">SĐT: {selectedStudent.parentPhone || '—'}</p>
                </div>
              </div>

              {/* Quick Student Weight & Height Bar for Dosage Calculation */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-950">
                        Cân nặng học sinh (Cơ sở cân đối liều thuốc an toàn)
                      </span>
                      {typeof studentWeight === 'number' && studentWeight > 0 && (
                        <span className="text-[11px] font-bold text-emerald-800">
                          • Liều Paracetamol chuẩn: {Math.round(studentWeight * 10)}–{Math.round(studentWeight * 15)} mg/lần
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-800/90">
                      Hệ thống tự động quy đổi mg/kg cân nặng và cảnh báo nếu hàm lượng thuốc vượt ngưỡng an toàn.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-300 shadow-2xs">
                    <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">Cân nặng (kg):</label>
                    <input
                      type="number"
                      min="15"
                      max="120"
                      step="0.5"
                      value={studentWeight}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setStudentWeight(val);
                        if (typeof val === 'number' && val > 0 && medicinesToDispense.length > 0) {
                          handleApplyWeightBalanceToAll(val);
                        }
                      }}
                      placeholder="VD: 40"
                      className="w-16 text-xs font-extrabold text-emerald-900 text-center border border-slate-200 rounded px-1.5 py-1 focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    {[28, 34, 40, 46, 52, 60].map((wPreset) => (
                      <button
                        key={wPreset}
                        type="button"
                        onClick={() => {
                          setStudentWeight(wPreset);
                          if (medicinesToDispense.length > 0) {
                            handleApplyWeightBalanceToAll(wPreset);
                          }
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          studentWeight === wPreset
                            ? 'bg-emerald-700 text-white shadow-2xs'
                            : 'bg-white text-slate-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {wPreset}kg
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prominent Allergy / Chronic Alert */}
              {(selectedStudent.allergies || selectedStudent.chronicConditions) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    {selectedStudent.allergies && selectedStudent.allergies !== 'Không' && (
                      <p>
                        <strong>Tiền sử dị ứng:</strong> <span className="font-bold text-rose-800 underline">{selectedStudent.allergies}</span>
                      </p>
                    )}
                    {selectedStudent.chronicConditions && selectedStudent.chronicConditions !== 'Không' && (
                      <p>
                        <strong>Bệnh nền:</strong> {selectedStudent.chronicConditions}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* BƯỚC 2 & 3: THỜI GIAN & NGƯỜI ĐƯA ĐẾN */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
              2
            </span>
            <h2 className="font-bold text-slate-900 text-sm">Thời Gian & Người Đưa Đến</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày tiếp nhận (dd/mm/yyyy) <span className="text-rose-500">*</span>
              </label>
              <DateInputVN
                required
                showTodayButton
                allowClear
                value={visitDate}
                onChange={(val) => setVisitDate(val || getCurrentDateISO())}
                placeholder="dd/mm/yyyy (nhập tay)"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giờ vào (24h - tự gõ tay) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="text"
                  required
                  value={timeIn}
                  onChange={(e) => {
                    const val = e.target.value;
                    const isDeleting = val.length < timeIn.length;
                    let cleaned = val.replace(/[^0-9:.hH\s\-]/g, '');
                    if (!isDeleting && !cleaned.includes(':') && !cleaned.includes('h') && !cleaned.includes('.') && cleaned.length === 4) {
                      cleaned = `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
                    }
                    setTimeIn(cleaned.slice(0, 8));
                  }}
                  onBlur={() => {
                    if (timeIn.trim()) {
                      setTimeIn(normalizeManualTime24H(timeIn));
                    }
                  }}
                  placeholder="VD: 07:36, 8h15, 14.30"
                  maxLength={8}
                  className="w-full text-xs font-mono font-bold border border-slate-200 rounded-xl px-3 py-2 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const d = new Date();
                    setTimeIn(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                  }}
                  title="Điền giờ hiện tại"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    setTimeIn(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                  }}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200 cursor-pointer"
                >
                  Bây giờ
                </button>
                <button
                  type="button"
                  onClick={() => setTimeIn('07:15')}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200 cursor-pointer"
                >
                  07:15
                </button>
                <button
                  type="button"
                  onClick={() => setTimeIn('09:00')}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200 cursor-pointer"
                >
                  09:00
                </button>
                <button
                  type="button"
                  onClick={() => setTimeIn('13:15')}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200 cursor-pointer"
                >
                  13:15
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giờ ra (24h) <span className="text-slate-400 font-normal">(dự kiến)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="text"
                  value={timeOut}
                  onChange={(e) => {
                    const val = e.target.value;
                    const isDeleting = val.length < timeOut.length;
                    let cleaned = val.replace(/[^0-9:.hH\s\-]/g, '');
                    if (!isDeleting && !cleaned.includes(':') && !cleaned.includes('h') && !cleaned.includes('.') && cleaned.length === 4) {
                      cleaned = `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
                    }
                    setTimeOut(cleaned.slice(0, 8));
                  }}
                  onBlur={() => {
                    if (timeOut.trim()) {
                      setTimeOut(normalizeManualTime24H(timeOut));
                    }
                  }}
                  placeholder="VD: 08:30"
                  maxLength={8}
                  className="w-full text-xs font-mono font-bold border border-slate-200 rounded-xl px-3 py-2 pr-8 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const d = new Date();
                    setTimeOut(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                  }}
                  title="Điền giờ hiện tại"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const base = timeIn && timeIn.includes(':') ? timeIn : '08:00';
                    const [h, m] = base.split(':').map(Number);
                    const total = (h * 60 + m + 15) % 1440;
                    setTimeOut(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
                  }}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
                >
                  +15p
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const base = timeIn && timeIn.includes(':') ? timeIn : '08:00';
                    const [h, m] = base.split(':').map(Number);
                    const total = (h * 60 + m + 30) % 1440;
                    setTimeOut(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
                  }}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
                >
                  +30p
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const base = timeIn && timeIn.includes(':') ? timeIn : '08:00';
                    const [h, m] = base.split(':').map(Number);
                    const total = (h * 60 + m + 45) % 1440;
                    setTimeOut(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
                  }}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
                >
                  +45p
                </button>
                {timeOut && (
                  <button
                    type="button"
                    onClick={() => setTimeOut('')}
                    className="text-[10px] text-slate-400 hover:text-rose-600 px-1 py-0.5 cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Người đưa đến</label>
              <select
                value={broughtBy}
                onChange={(e) => setBroughtBy(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
              >
                <option value="Tự đến">Tự đến</option>
                <option value="Bạn cùng lớp">Bạn cùng lớp</option>
                <option value="Giáo viên bộ môn">Giáo viên bộ môn</option>
                <option value="Giáo viên chủ nhiệm">Giáo viên chủ nhiệm</option>
                <option value="Giám thị">Giám thị</option>
                <option value="Nhân viên bảo vệ">Nhân viên bảo vệ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>
        </div>

        {/* BƯỚC 4 & 5: LÝ DO ĐẾN PHÒNG Y TẾ & TRIỆU CHỨNG */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
              3
            </span>
            <h2 className="font-bold text-slate-900 text-sm">Lý Do Khám & Tình Trạng Ban Đầu</h2>
          </div>

          {/* Quick chips for reasons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Chọn nhanh lý do chính:</label>
            <div className="flex flex-wrap gap-1.5">
              {CLINIC_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedReason === r
                      ? 'bg-emerald-700 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {selectedReason === 'Khác' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi rõ lý do khác:</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Nhập lý do cụ thể..."
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả triệu chứng & Tình trạng ban đầu <span className="text-rose-600">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={initialCondition}
              onChange={(e) => setInitialCondition(e.target.value)}
              placeholder="VD: Học sinh kêu đau bụng âm ỉ vùng quanh rốn sau giờ ra chơi, buồn nôn, không sốt..."
              className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        {/* BƯỚC 6: DẤU HIỆU SINH TỒN & CÂN NẶNG THỂ TRẠNG */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                4
              </span>
              <h2 className="font-bold text-slate-900 text-sm">
                Dấu Hiệu Sinh Tồn & Cân Nặng Học Sinh (Để Cân Đối Thuốc)
              </h2>
            </div>
            {typeof studentWeight === 'number' && studentWeight > 0 && (
              <span className="text-xs font-semibold text-emerald-800">
                Cân nặng đang áp dụng: <strong>{studentWeight} kg</strong>
                {typeof studentHeight === 'number' && studentHeight > 0
                  ? ` • Chiều cao: ${studentHeight} cm (BMI: ${(
                      studentWeight / Math.pow(studentHeight / 100, 2)
                    ).toFixed(1)})`
                  : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
            <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
              <label className="block text-xs font-bold text-emerald-950 mb-1 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-700" />
                <span>Cân nặng (kg) *</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="15"
                max="120"
                value={studentWeight}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                  setStudentWeight(val);
                  if (typeof val === 'number' && val > 0 && medicinesToDispense.length > 0) {
                    handleApplyWeightBalanceToAll(val);
                  }
                }}
                placeholder="40"
                className="w-full text-xs border border-emerald-300 bg-white rounded-lg px-2.5 py-1.5 font-extrabold text-emerald-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chiều cao (cm)</label>
              <input
                type="number"
                step="0.5"
                min="100"
                max="200"
                value={studentHeight}
                onChange={(e) => setStudentHeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="150"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nhiệt độ (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="37.0"
                className={`w-full text-xs border rounded-xl px-3 py-2 font-bold ${
                  typeof temperature === 'number' && temperature >= 38.0
                    ? 'border-rose-400 bg-rose-50 text-rose-800'
                    : 'border-slate-200'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mạch (lần/phút)</label>
              <input
                type="number"
                value={pulse}
                onChange={(e) => setPulse(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="80"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Huyết áp (mmHg)</label>
              <input
                type="text"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="100/70"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nhịp thở (lần/phút)</label>
              <input
                type="number"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="20"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SpO2 (%)</label>
              <input
                type="number"
                value={spO2}
                onChange={(e) => setSpO2(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder="98"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* BƯỚC 7: PHÂN LOẠI XỬ TRÍ */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
              5
            </span>
            <h2 className="font-bold text-slate-900 text-sm">Biện Pháp Xử Trí Chăm Sóc</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Biện pháp xử trí</label>
              <select
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium"
              >
                {CLINIC_TREATMENTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cán bộ y tế thực hiện</label>
              <input
                type="text"
                required
                value={performer}
                onChange={(e) => setPerformer(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 font-medium"
              />
            </div>
          </div>
        </div>

        {/* BƯỚC 8: CẤP PHÁT THUỐC TỰ ĐỘNG CÂN ĐỐI THEO CÂN NẶNG & FEFO */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                6
              </span>
              <div>
                <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-emerald-700" />
                  <span>Cấp Phát Thuốc & Cân Đối Liều Theo Cân Nặng Học Sinh (FEFO)</span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Tự động tính liều mg/kg theo cân nặng học sinh và ưu tiên xuất lô có hạn dùng gần nhất trước.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {medicinesToDispense.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleApplyWeightBalanceToAll()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-lg text-xs font-bold border border-teal-300 transition-colors cursor-pointer"
                  title="Tự động tính toán và cân đối lại số lượng + liều dùng tất cả thuốc theo cân nặng học sinh"
                >
                  <Calculator className="w-3.5 h-3.5 text-teal-700" />
                  <span>Cân đối liều theo {studentWeight || 40}kg</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAddMedicineRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm thuốc</span>
              </button>
            </div>
          </div>

          {/* Weight-Based Dosage Reference & 1-Click Balanced Suggestions Panel */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-700" />
                  <span>Bảng cân đối thuốc theo cân nặng:</span>
                </span>
                <span className="font-extrabold text-emerald-800">
                  {studentWeight ? `${studentWeight} kg` : 'Chưa nhập (mặc định 40 kg)'}
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-slate-600">
                  Liều hạ sốt/giảm đau chuẩn (10–15 mg/kg/lần):{' '}
                  <strong className="text-slate-900">
                    {Math.round((Number(studentWeight) || 40) * 10)} – {Math.round((Number(studentWeight) || 40) * 15)} mg/lần
                  </strong>
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="text-slate-600">
                  Tối đa 24h:{' '}
                  <strong className="text-slate-900">
                    {Math.min(4000, Math.round((Number(studentWeight) || 40) * 60))} mg/ngày
                  </strong>
                </span>
              </div>

              <span className="text-[11px] font-semibold text-emerald-800">
                {Number(studentWeight || 40) < 34
                  ? 'Khuyến nghị hàm lượng: Hapacol 250mg / 325mg (Tránh viên 500mg nguyên viên)'
                  : 'Khuyến nghị hàm lượng: Hapacol Blue 500mg / Efferalgan 500mg / Hapacol 325mg'}
              </span>
            </div>

            {weightBalancedSuggestions.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">
                  Gợi ý thuốc đã cân đối cho &ldquo;{selectedReason}&rdquo; ({studentWeight || 40}kg):
                </span>
                {weightBalancedSuggestions.map((sug) => {
                  const alreadyAdded = medicinesToDispense.some((m) => m.medicineId === sug.med.id);
                  return (
                    <button
                      key={sug.med.id}
                      type="button"
                      onClick={() => {
                        if (alreadyAdded) {
                          setMedicinesToDispense((prev) =>
                            prev.map((row) =>
                              row.medicineId === sug.med.id
                                ? {
                                    ...row,
                                    quantity: sug.quantity,
                                    dosageInstructions: sug.dosageInstructions,
                                  }
                                : row
                            )
                          );
                        } else {
                          setMedicinesToDispense((prev) => [
                            ...prev,
                            {
                              medicineId: sug.med.id,
                              quantity: sug.quantity,
                              dosageInstructions: sug.dosageInstructions,
                            },
                          ]);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        alreadyAdded
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-white hover:bg-emerald-50 text-slate-800 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <Plus className="w-3 h-3 text-emerald-700" />
                      <span>
                        {sug.med.name} ({sug.quantity} {sug.med.unit})
                      </span>
                      <span className="text-[10px] text-emerald-700 font-normal">• {sug.doseBadge}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Allergy warning box if matches */}
          {allergyWarning && (
            <div className="p-3.5 bg-rose-100 border-2 border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-start gap-2 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{allergyWarning}</span>
            </div>
          )}

          {medicinesToDispense.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              Không cấp thuốc trong ca này (Bấm vào thuốc gợi ý phía trên hoặc nút &ldquo;Thêm thuốc&rdquo; để cấp phát theo cân nặng).
            </p>
          ) : (
            <div className="space-y-3">
              {medicinesToDispense.map((item, idx) => {
                const med = allMedicines.find((m) => m.id === item.medicineId);
                const w = typeof studentWeight === 'number' && studentWeight > 0 ? studentWeight : 40;
                const weightEval = evaluateMedicineForStudentWeight(med, item.quantity, w, allMedicines);

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border space-y-2.5 ${
                      weightEval.status === 'warning_overdose'
                        ? 'bg-rose-50/60 border-rose-300'
                        : weightEval.status === 'warning_underdose'
                        ? 'bg-amber-50/60 border-amber-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Tên thuốc & Hàm lượng
                        </label>
                        <select
                          value={item.medicineId}
                          onChange={(e) => {
                            const newId = e.target.value;
                            const newMed = allMedicines.find((m) => m.id === newId);
                            const newEval = evaluateMedicineForStudentWeight(newMed, 1, w, allMedicines);
                            setMedicinesToDispense((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      medicineId: newId,
                                      quantity: newEval.recommendedQuantity,
                                      dosageInstructions: newEval.recommendedDosageText,
                                    }
                                  : row
                              )
                            );
                          }}
                          className="w-full text-xs font-bold text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                        >
                          {allMedicines.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} {m.strength ? `(${m.strength})` : ''} - Tồn: {m.totalStock ?? m.stock ?? 0} {m.unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Số lượng ({med?.unit || 'viên'})
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={med ? (med.totalStock ?? med.stock ?? 10) : 10}
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value, 10) || 1;
                            const updatedEval = evaluateMedicineForStudentWeight(med, qty, w, allMedicines);
                            setMedicinesToDispense((prev) =>
                              prev.map((row, i) =>
                                i === idx
                                  ? {
                                      ...row,
                                      quantity: qty,
                                      dosageInstructions: updatedEval.recommendedDosageText,
                                    }
                                  : row
                              )
                            );
                          }}
                          className="w-full text-xs font-bold text-center border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Cách dùng & Liều lượng (Đã cân đối theo {w}kg)
                        </label>
                        <input
                          type="text"
                          value={item.dosageInstructions}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMedicinesToDispense((prev) =>
                              prev.map((row, i) => (i === idx ? { ...row, dosageInstructions: val } : row))
                            );
                          }}
                          placeholder="Uống 1 viên sau ăn với nước ấm"
                          className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">&nbsp;</label>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedicineRow(idx)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Xóa thuốc này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Live Weight-Balancing Status & Action Bar for this Medicine */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-[11px]">
                      <div className="flex items-start sm:items-center gap-2">
                        <span
                          className={`font-bold ${
                            weightEval.status === 'warning_overdose'
                              ? 'text-rose-700'
                              : weightEval.status === 'warning_underdose'
                              ? 'text-amber-800'
                              : 'text-emerald-800'
                          }`}
                        >
                          {weightEval.status === 'warning_overdose'
                            ? `⚠️ ${weightEval.badgeText}`
                            : weightEval.status === 'warning_underdose'
                            ? `ℹ️ ${weightEval.badgeText}`
                            : `✓ ${weightEval.badgeText}`}
                        </span>
                        <span className="text-slate-500 hidden md:inline">• {weightEval.detailNote}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {weightEval.betterAlternativeMed && (
                          <button
                            type="button"
                            onClick={() => {
                              const alt = weightEval.betterAlternativeMed!;
                              const altEval = evaluateMedicineForStudentWeight(alt, 1, w, allMedicines);
                              setMedicinesToDispense((prev) =>
                                prev.map((row, i) =>
                                  i === idx
                                    ? {
                                        medicineId: alt.id,
                                        quantity: altEval.recommendedQuantity,
                                        dosageInstructions: altEval.recommendedDosageText,
                                      }
                                    : row
                                )
                              );
                            }}
                            className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Đổi sang {weightEval.betterAlternativeMed.name} (Phù hợp {w}kg)
                          </button>
                        )}

                        {(item.quantity !== weightEval.recommendedQuantity ||
                          item.dosageInstructions !== weightEval.recommendedDosageText) && (
                          <button
                            type="button"
                            onClick={() => {
                              setMedicinesToDispense((prev) =>
                                prev.map((row, i) =>
                                  i === idx
                                    ? {
                                        ...row,
                                        quantity: weightEval.recommendedQuantity,
                                        dosageInstructions: weightEval.recommendedDosageText,
                                      }
                                    : row
                                )
                              );
                            }}
                            className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Áp dụng liều chuẩn ({weightEval.recommendedQuantity} {med?.unit || 'viên'})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BƯỚC 9: VẬT TƯ Y TẾ SỬ DỤNG */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                7
              </span>
              <div>
                <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <BriefcaseMedical className="w-4 h-4 text-blue-700" />
                  <span>Vật Tư Y Tế Sử Dụng (Trừ tồn kho vật tư)</span>
                </h2>
                <p className="text-[11px] text-slate-500">Bông băng, gạc, nước muối sinh lý, cồn sát khuẩn...</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddSupplyRow}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold border border-blue-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm vật tư</span>
            </button>
          </div>

          {suppliesToUse.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">Không sử dụng vật tư tiêu hao trong ca này.</p>
          ) : (
            <div className="space-y-3">
              {suppliesToUse.map((item, idx) => {
                const sup = allSupplies.find((s) => s.id === item.supplyId);
                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-8">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tên vật tư</label>
                      <select
                        value={item.supplyId}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setSuppliesToUse((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, supplyId: newId } : row))
                          );
                        }}
                        className="w-full text-xs font-bold text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                      >
                        {allSupplies.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.category}) - Còn tồn: {s.quantity} {s.unit}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                        Số lượng ({sup?.unit || 'cái'})
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={sup ? sup.quantity : 50}
                        value={item.quantity}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value, 10) || 1;
                          setSuppliesToUse((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, quantity: qty } : row))
                          );
                        }}
                        className="w-full text-xs font-bold text-center border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-1 text-right">
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">&nbsp;</label>
                      <button
                        type="button"
                        onClick={() => handleRemoveSupplyRow(idx)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Xóa vật tư này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BƯỚC 10: ĐÁNH GIÁ KẾT QUẢ & THÔNG BÁO PHỤ HUYNH */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
              8
            </span>
            <h2 className="font-bold text-slate-900 text-sm">Đánh Giá Kết Quả & Bàn Giao Học Sinh</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kết quả sau xử trí</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as any)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-slate-800"
              >
                <option value="Đã ổn định cho về lớp">Đã ổn định cho về lớp</option>
                <option value="Nghỉ tại phòng y tế">Nghỉ tại phòng y tế tiếp tục theo dõi</option>
                <option value="Bàn giao phụ huynh đón về">Bàn giao phụ huynh đón về</option>
                <option value="Chuyển cơ sở y tế tuyến trên">Chuyển cơ sở y tế tuyến trên</option>
              </select>
            </div>

            {outcome === 'Chuyển cơ sở y tế tuyến trên' && (
              <div>
                <label className="block text-xs font-semibold text-rose-800 mb-1">Cơ sở y tế chuyển đến</label>
                <input
                  type="text"
                  value={transferHospital}
                  onChange={(e) => setTransferHospital(e.target.value)}
                  className="w-full text-xs border border-rose-300 rounded-xl px-3 py-2 bg-rose-50 font-semibold text-rose-900"
                />
              </div>
            )}
          </div>

          {/* Parent notification status */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="chk-parent-notified"
                checked={parentNotified}
                onChange={(e) => setParentNotified(e.target.checked)}
                className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600"
              />
              <label htmlFor="chk-parent-notified" className="text-xs font-bold text-slate-800 cursor-pointer">
                Đã gọi điện / liên hệ thông báo cho phụ huynh học sinh
              </label>
            </div>

            {parentNotified && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nội dung trao đổi với phụ huynh:
                </label>
                <input
                  type="text"
                  value={parentContactNotes}
                  onChange={(e) => setParentContactNotes(e.target.value)}
                  placeholder="VD: Phụ huynh đồng ý cho con uống 1 viên Paracetamol và sẽ đón con lúc 11h..."
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú thêm của cán bộ y tế</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú thêm về diễn biến hoặc dặn dò học sinh..."
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
        </div>

        {/* Action Button: Confirm and Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetForNext}
            className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Làm mới biểu mẫu
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !selectedStudent}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{isSubmitting ? 'Đang lưu lượt khám...' : 'Xác nhận & Tự động xuất kho (FEFO)'}</span>
          </button>
        </div>
      </form>

      {/* Allergy Safety Confirmation In-App Modal */}
      {showAllergyModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Cảnh Báo Dị Ứng Thuốc Học Sinh!</h3>
                <p className="text-xs text-rose-600 font-semibold">Cần cán bộ y tế xác nhận an toàn trước khi cấp phát</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 leading-relaxed font-medium">
              {allergyWarning}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xuất loại thuốc này cho học sinh <strong>{selectedStudent?.fullName}</strong> không? Vui lòng đối chiếu cẩn thận tiền sử bệnh và liều lượng.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAllergyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ & Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={() => executeSaveVisit(true)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang lưu...' : 'Tôi đã kiểm tra - Vẫn tiếp tục cấp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Today's Clinic Visit Confirmation Modal */}
      {deletingVisit && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-3">
            <div className="w-11 h-11 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900">
              Xóa Ca Khám {deletingVisit.visitCode}?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa ca khám của học sinh <strong>{deletingVisit.studentName}</strong> ({deletingVisit.className})?
              Số lượng thuốc và vật tư đã cấp trong ca này sẽ được tự động hoàn trả về kho như cũ.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVisit(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVisit}
                className="flex-1 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Student Modal for Clinic Reception */}
      {isQuickAddStudentOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto p-3 sm:p-5 flex items-start sm:items-center justify-center backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] overflow-y-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Thêm Nhanh Học Sinh Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddStudentOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickAddError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold">
                {quickAddError}
              </div>
            )}

            <form onSubmit={handleConfirmQuickAddStudent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={quickAddForm.fullName}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, fullName: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 text-xs font-semibold"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã học sinh</label>
                  <input
                    type="text"
                    value={quickAddForm.studentCode}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, studentCode: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={quickAddForm.gender}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, gender: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Khối</label>
                  <select
                    value={quickAddForm.grade}
                    onChange={(e) => {
                      const g = Number(e.target.value);
                      const matchingClass = schoolClasses.find((c) => c.grade === g)?.name || `${g}/1`;
                      setQuickAddForm({ ...quickAddForm, grade: g, className: matchingClass });
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs"
                  >
                    {[6, 7, 8, 9].map((g) => (
                      <option key={g} value={g}>Khối {g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lớp</label>
                  <select
                    value={quickAddForm.className}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, className: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs"
                  >
                    {schoolClasses
                      .filter((c) => c.grade === quickAddForm.grade)
                      .map((c) => (
                        <option key={c.id || c.name} value={c.name}>Lớp {c.name}</option>
                      ))}
                    {!schoolClasses.some((c) => c.grade === quickAddForm.grade) && (
                      <option value={`${quickAddForm.grade}/1`}>Lớp {quickAddForm.grade}/1</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">SĐT phụ huynh (để liên hệ khi cần)</label>
                <input
                  type="tel"
                  placeholder="Ví dụ: 0908 123 456"
                  value={quickAddForm.parentPhone}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, parentPhone: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tiền sử dị ứng / Bệnh nền (nếu có)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Dị ứng Paracetamol, Hen suyễn... (để trống nếu không)"
                  value={quickAddForm.allergies}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, allergies: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickAddStudentOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Lưu & Tiếp Nhận Khám Ngay</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
