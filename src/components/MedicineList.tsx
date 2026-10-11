import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  Pill,
  ClockAlert,
  CheckCircle2,
  MapPin,
  FileText,
  Boxes,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Calendar,
  Layers,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { db, formatDateVN, getStatusText, getDaysRemaining } from '../services/db';
import { Medicine, MedicineStatus, MedicineBatch, Supplier } from '../types';

import { ImportExcelModal, downloadStandardMedicineTemplate } from './ImportExcelModal';
import { BatchModal } from './BatchModal';

interface MedicineListProps {
  initialFilter?: string;
  onOpenAddModal: () => void;
  onOpenEditModal: (medicine: Medicine) => void;
  onOpenImportForMed: (medicine: Medicine) => void;
}

export const MedicineList: React.FC<MedicineListProps> = ({
  initialFilter = 'all',
  onOpenAddModal,
  onOpenEditModal,
  onOpenImportForMed,
}) => {
  const [medicines, setMedicines] = useState(() => db.getMedicines());
  const [batches, setBatches] = useState(() => db.getBatches());
  const [suppliers, setSuppliers] = useState(() => db.getSuppliers());

  const refreshData = () => {
    setMedicines(db.getMedicines());
    setBatches(db.getBatches());
    setSuppliers(db.getSuppliers());
  };

  useEffect(() => {
    const unsub = db.subscribe(refreshData);
    return () => unsub();
  }, []);

  // Main active view mode: 'catalog' | 'spreadsheet' | 'batches' | 'expiring'
  const [activeViewMode, setActiveViewMode] = useState<'catalog' | 'spreadsheet' | 'batches' | 'expiring'>(() => {
    if (initialFilter === 'expired' || initialFilter === 'expiring_soon') return 'expiring';
    return 'catalog';
  });

  // Search & Filter & Sort state for Catalog
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [sortBy, setSortBy] = useState<'stt' | 'name' | 'expDate' | 'stockAsc' | 'stockDesc'>('stt');

  // React to initialFilter changes from parent navigation
  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
      if (initialFilter === 'expired' || initialFilter === 'expiring_soon') {
        setActiveViewMode('expiring');
      } else {
        setActiveViewMode('catalog');
      }
    }
  }, [initialFilter]);

  // Search & Filter for Batches view
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [batchStatusFilter, setBatchStatusFilter] = useState<string>('all');

  // Expanded rows (set of medicine IDs whose batches are shown inline)
  const [expandedMedIds, setExpandedMedIds] = useState<Set<string>>(new Set());

  const toggleExpandMed = (medId: string) => {
    setExpandedMedIds((prev) => {
      const next = new Set(prev);
      if (next.has(medId)) {
        next.delete(medId);
      } else {
        next.add(medId);
      }
      return next;
    });
  };

  const expandAllMeds = () => {
    setExpandedMedIds(new Set(medicines.map((m) => m.id)));
  };

  const collapseAllMeds = () => {
    setExpandedMedIds(new Set());
  };

  // View details modal state
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);

  // Batch Management Modal state
  const [batchModalMed, setBatchModalMed] = useState<Medicine | null>(null);
  const [batchToEdit, setBatchToEdit] = useState<MedicineBatch | null>(null);

  const handleOpenAddBatch = (med: Medicine) => {
    setBatchToEdit(null);
    setBatchModalMed(med);
  };

  const handleOpenEditBatch = (med: Medicine, batch: MedicineBatch) => {
    setBatchToEdit(batch);
    setBatchModalMed(med);
  };

  const handleBatchSuccess = (msg: string) => {
    showToast('success', msg);
    refreshData();
    if (selectedMedicine && batchModalMed && selectedMedicine.id === batchModalMed.id) {
      const updated = db.getMedicines().find((m) => m.id === selectedMedicine.id);
      if (updated) setSelectedMedicine(updated);
    }
  };

  // Delete Modals & Notifications
  const [deleteConfirmMed, setDeleteConfirmMed] = useState<Medicine | null>(null);
  const [deleteConfirmBatch, setDeleteConfirmBatch] = useState<MedicineBatch | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Synchronize All Medicines & Batches
  const handleSyncData = () => {
    try {
      const res = db.syncAllMedicinesAndBatches();
      refreshData();
      showToast(
        'success',
        `✓ Đã đồng bộ thành công! Hiện có ${res.medicineCount} loại thuốc, ${res.batchCount} lô kho (${res.activeBatchCount} lô hoạt động, ${res.expiringSoonBatchCount} lô cận date, ${res.expiredBatchCount} lô hết hạn).`
      );
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi đồng bộ dữ liệu kho thuốc.');
    }
  };

  const handleDelete = (med: Medicine) => {
    setDeleteConfirmMed(med);
  };

  const executeDeleteMedicine = () => {
    if (!deleteConfirmMed) return;
    try {
      db.deleteMedicine(deleteConfirmMed.id, true);
      showToast('success', `Đã xóa thuốc "${deleteConfirmMed.name}" (${deleteConfirmMed.code}) thành công!`);
      if (selectedMedicine?.id === deleteConfirmMed.id) {
        setSelectedMedicine(null);
      }
      setDeleteConfirmMed(null);
      refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Không thể xóa thuốc.');
      setDeleteConfirmMed(null);
    }
  };

  const handleRestoreFixedCatalog = () => {
    try {
      const res = db.restoreFixedMedicineCatalog();
      showToast(
        'success',
        `Đã nạp và đồng bộ thành công ${res.totalCount} loại thuốc/vật tư và ${res.batchCount} lô tồn kho theo đúng bảng chuẩn!`
      );
      refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi nạp danh mục thuốc cố định.');
    }
  };

  const handleClearAllMedicines = () => {
    try {
      const res = db.clearMedicinesAndInventory();
      setSelectedMedicine(null);
      setShowClearAllModal(false);
      showToast(
        'success',
        `Đã làm sạch toàn bộ kho thuốc: xóa ${res.medicinesCount} thuốc, ${res.batchesCount} lô tồn kho và ${res.transactionsCount} phiếu giao dịch. Bạn có thể bắt đầu nhập loại thuốc mới!`
      );
      refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi dọn dẹp danh mục.');
      setShowClearAllModal(false);
    }
  };

  const executeDeleteBatch = () => {
    if (!deleteConfirmBatch) return;
    try {
      db.deleteBatch(deleteConfirmBatch.id);
      showToast('success', `Đã xóa thành công số lô ${deleteConfirmBatch.batchNumber}!`);
      setDeleteConfirmBatch(null);
      refreshData();
    } catch (err: any) {
      showToast('error', err.message || 'Không thể xóa lô thuốc.');
      setDeleteConfirmBatch(null);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const totalTypes = medicines.length;
    const totalStock = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
    const totalBatches = batches.length;
    const expiredBatches = batches.filter((b) => b.quantity > 0 && getDaysRemaining(b.expDate) < 0);
    const expiringSoonBatches = batches.filter(
      (b) => b.quantity > 0 && getDaysRemaining(b.expDate) >= 0 && getDaysRemaining(b.expDate) <= 30
    );
    const warning60Batches = batches.filter(
      (b) => b.quantity > 0 && getDaysRemaining(b.expDate) > 30 && getDaysRemaining(b.expDate) <= 60
    );
    const lowStockCount = medicines.filter((m) => (m.totalStock ?? 0) <= m.minStock && (m.totalStock ?? 0) > 0).length;
    const outOfStockCount = medicines.filter((m) => (m.totalStock ?? 0) === 0).length;

    return {
      totalTypes,
      totalStock,
      totalBatches,
      expiredCount: expiredBatches.length,
      expiringSoonCount: expiringSoonBatches.length,
      warning60Count: warning60Batches.length,
      lowStockCount,
      outOfStockCount,
    };
  }, [medicines, batches]);

  // Filtered & Sorted medicines (Catalog view)
  const processedMedicines = useMemo(() => {
    return medicines
      .filter((med) => {
        // Status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'active' && med.computedStatus !== 'active') return false;
          if (statusFilter === 'low_stock') {
            const isLow = med.computedStatus === 'low_stock' || ((med.totalStock ?? 0) <= med.minStock && (med.totalStock ?? 0) > 0);
            if (!isLow) return false;
          }
          if (statusFilter === 'out_of_stock') {
            const isOut = med.computedStatus === 'out_of_stock' || (med.totalStock ?? 0) === 0;
            if (!isOut) return false;
          }
          if (statusFilter === 'expiring_soon') {
            const isExpSoon =
              med.computedStatus === 'expiring_soon' ||
              batches.some((b) => b.medicineId === med.id && b.quantity > 0 && getDaysRemaining(b.expDate) >= 0 && getDaysRemaining(b.expDate) <= 30);
            if (!isExpSoon) return false;
          }
          if (statusFilter === 'expired') {
            const isExp =
              med.computedStatus === 'expired' ||
              batches.some((b) => b.medicineId === med.id && b.quantity > 0 && getDaysRemaining(b.expDate) < 0);
            if (!isExp) return false;
          }
        }

        // Search term
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        const medBatches = batches.filter((b) => b.medicineId === med.id);
        const matchBatch = medBatches.some((b) => b.batchNumber.toLowerCase().includes(q));

        return (
          med.name.toLowerCase().includes(q) ||
          med.code.toLowerCase().includes(q) ||
          med.activeIngredient.toLowerCase().includes(q) ||
          med.dosageForm.toLowerCase().includes(q) ||
          med.storageLocation.toLowerCase().includes(q) ||
          matchBatch
        );
      })
      .sort((a, b) => {
        if (sortBy === 'stt') {
          const numA = parseInt((a.id || '').replace(/\D/g, ''), 10) || 999;
          const numB = parseInt((b.id || '').replace(/\D/g, ''), 10) || 999;
          return numA - numB;
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name, 'vi');
        }
        if (sortBy === 'stockAsc') {
          return (a.totalStock ?? 0) - (b.totalStock ?? 0);
        }
        if (sortBy === 'stockDesc') {
          return (b.totalStock ?? 0) - (a.totalStock ?? 0);
        }
        if (sortBy === 'expDate') {
          const dateA = a.earliestExpDate ? new Date(a.earliestExpDate).getTime() : 9999999999999;
          const dateB = b.earliestExpDate ? new Date(b.earliestExpDate).getTime() : 9999999999999;
          return dateA - dateB;
        }
        return 0;
      });
  }, [medicines, batches, searchTerm, statusFilter, sortBy]);

  // All Batches flattened list (Batches view)
  const processedBatches = useMemo(() => {
    const medMap = new Map(medicines.map((m) => [m.id, m]));

    return batches
      .map((b) => {
        const med = medMap.get(b.medicineId);
        const daysRemaining = getDaysRemaining(b.expDate);
        return {
          ...b,
          medicine: med,
          daysRemaining,
        };
      })
      .filter((item) => {
        if (batchStatusFilter !== 'all') {
          if (batchStatusFilter === 'active' && (item.quantity <= 0 || item.daysRemaining <= 30)) return false;
          if (batchStatusFilter === 'expiring_soon' && (item.quantity <= 0 || item.daysRemaining < 0 || item.daysRemaining > 30)) return false;
          if (batchStatusFilter === 'warning_60' && (item.quantity <= 0 || item.daysRemaining <= 30 || item.daysRemaining > 60)) return false;
          if (batchStatusFilter === 'expired' && item.daysRemaining >= 0) return false;
          if (batchStatusFilter === 'out_of_stock' && item.quantity > 0) return false;
        }

        if (!batchSearchTerm.trim()) return true;
        const q = batchSearchTerm.toLowerCase();
        return (
          item.batchNumber.toLowerCase().includes(q) ||
          (item.medicine?.name || '').toLowerCase().includes(q) ||
          (item.medicine?.code || '').toLowerCase().includes(q) ||
          (item.storageLocation || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime());
  }, [batches, medicines, batchSearchTerm, batchStatusFilter]);

  // Alert Batches list (Expired & Expiring soon within 60 days)
  const alertBatches = useMemo(() => {
    const medMap = new Map(medicines.map((m) => [m.id, m]));
    return batches
      .filter((b) => b.quantity > 0 && getDaysRemaining(b.expDate) <= 60)
      .map((b) => ({
        ...b,
        medicine: medMap.get(b.medicineId),
        daysRemaining: getDaysRemaining(b.expDate),
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [batches, medicines]);

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm font-semibold transition-all shadow-md ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold ml-4 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <Pill className="w-4 h-4" />
            <span>Phòng Y Tế • THCS Đông Thạnh</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            QUẢN LÝ THUỐC, LÔ & HẠN SỬ DỤNG
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý danh mục thuốc y tế học đường, theo dõi đa số lô, hạn dùng (FEFO) và tự động đồng bộ tồn kho
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Nút Đồng bộ dữ liệu kho */}
          <button
            id="btn-sync-medicines"
            type="button"
            onClick={handleSyncData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-teal-50 text-teal-800 text-xs sm:text-sm font-bold hover:bg-teal-100 border border-teal-300 shadow-2xs transition-colors cursor-pointer"
            title="Đồng bộ lại toàn bộ số lô, hạn sử dụng và tính lại tổng tồn kho theo thực tế"
          >
            <RefreshCw className="w-4 h-4 text-teal-700 shrink-0" />
            <span>ĐỒNG BỘ DỮ LIỆU</span>
          </button>

          {medicines.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearAllModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs sm:text-sm font-bold hover:bg-rose-100 border border-rose-200 shadow-2xs transition-colors cursor-pointer"
              title="Làm sạch kho thuốc để bắt đầu nhập danh mục thực tế"
            >
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
              <span>LÀM SẠCH KHO</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRestoreFixedCatalog}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold hover:bg-emerald-100 border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
            title="Đồng bộ / Nạp 30 thuốc cố định chuẩn của trường THCS Đông Thạnh"
          >
            <Boxes className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="hidden sm:inline">NẠP 30 THUỐC CỐ ĐỊNH</span>
            <span className="sm:hidden">30 THUỐC</span>
          </button>

          <button
            type="button"
            onClick={downloadStandardMedicineTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-200 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
            title="Tải về file Excel mẫu chuẩn 12 cột để nhập dữ liệu"
          >
            <Download className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="hidden md:inline">TẢI FILE CHUẨN</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportExcelModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-bold hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">NHẬP TỪ EXCEL</span>
          </button>

          <button
            id="btn-open-add-medicine"
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ THÊM THUỐC MỚI</span>
          </button>
        </div>
      </div>

      {/* Metric Cards: Thống Kê Tổng Quan Kho Thuốc & Lô */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Tổng Loại Thuốc */}
        <div
          onClick={() => setActiveViewMode('catalog')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeViewMode === 'catalog'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Loại thuốc trong kho</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.totalTypes}</span>
            <span className="text-xs text-slate-500 font-semibold">mặt hàng</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tổng tồn: <strong>{metrics.totalStock.toLocaleString('vi-VN')}</strong> đơn vị
          </p>
        </div>

        {/* Card 2: Tổng Số Lô Thuốc */}
        <div
          onClick={() => setActiveViewMode('batches')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeViewMode === 'batches'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Tổng số lô thuốc</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-900">{metrics.totalBatches}</span>
            <span className="text-xs text-blue-600 font-semibold">lô tồn</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Bấm để xem danh sách toàn bộ các lô
          </p>
        </div>

        {/* Card 3: Lô Sắp Hết Hạn (≤ 30 ngày) */}
        <div
          onClick={() => {
            setActiveViewMode('expiring');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeViewMode === 'expiring'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Sắp hết hạn (≤ 30 ngày)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ClockAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                metrics.expiringSoonCount > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {metrics.expiringSoonCount}
            </span>
            <span className="text-xs text-amber-700 font-semibold">lô cận date</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.warning60Count > 0 ? `+ ${metrics.warning60Count} lô cảnh báo (31-60 ngày)` : 'Ưu tiên xuất cấp phát FEFO'}
          </p>
        </div>

        {/* Card 4: Lô Đã Hết Hạn */}
        <div
          onClick={() => {
            setActiveViewMode('expiring');
          }}
          className="p-4 rounded-2xl border bg-white border-slate-200 hover:border-slate-300 shadow-2xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600">Đã hết hạn sử dụng</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                metrics.expiredCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {metrics.expiredCount}
            </span>
            <span className="text-xs text-rose-600 font-semibold">lô quá hạn</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.expiredCount > 0 ? 'Cần lập biên bản kiểm kê & tiêu hủy' : 'Kho dược an toàn, không có lô quá hạn'}
          </p>
        </div>
      </div>

      {/* Main View Mode Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveViewMode('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeViewMode === 'catalog'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>DANH MỤC THUỐC (KÈM LÔ MỞ RỘNG)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeViewMode === 'catalog' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {medicines.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveViewMode('spreadsheet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeViewMode === 'spreadsheet'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>BẢNG TỔNG HỢP NGANG (MẪU 5 LÔ)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeViewMode === 'spreadsheet' ? 'bg-teal-900 text-teal-100' : 'bg-slate-100 text-slate-700'
            }`}
          >
            30 Mục • {batches.length} Lô
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveViewMode('batches')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeViewMode === 'batches'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>TẤT CẢ CÁC LÔ & HẠN DÙNG TRONG KHO</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeViewMode === 'batches' ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {batches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveViewMode('expiring')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeViewMode === 'expiring'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClockAlert className="w-4 h-4" />
          <span>CẢNH BÁO HẠN SỬ DỤNG</span>
          {(metrics.expiredCount > 0 || metrics.expiringSoonCount > 0) && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeViewMode === 'expiring' ? 'bg-amber-800 text-amber-100' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {metrics.expiredCount + metrics.expiringSoonCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: CATALOG VIEW (THEO LOẠI THUỐC, KÈM EXPAND TỪNG LÔ)                 */}
      {/* ========================================================================= */}
      {activeViewMode === 'catalog' && (
        <div className="space-y-4">
          {/* Controls: Search, Filter, Sort & Quick expand */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search box */}
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="input-search-medicine"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên thuốc, mã, hoạt chất, số lô, vị trí tủ..."
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Status */}
              <div className="md:col-span-4 flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  id="select-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">Tất cả tình trạng ({medicines.length})</option>
                  <option value="active">Đang sử dụng an toàn</option>
                  <option value="low_stock">Sắp hết (≤ mức tối thiểu)</option>
                  <option value="expiring_soon">Sắp hết hạn (≤ 30 ngày)</option>
                  <option value="expired">Đã hết hạn</option>
                  <option value="out_of_stock">Hết hàng (tồn 0)</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="md:col-span-3 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  id="select-sort-medicine"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="stt">Sắp xếp: Theo STT sổ gốc (1 - 30)</option>
                  <option value="name">Sắp xếp: Tên thuốc (A-Z)</option>
                  <option value="expDate">Sắp xếp: Hạn dùng gần nhất</option>
                  <option value="stockAsc">Sắp xếp: Số lượng tồn tăng dần</option>
                  <option value="stockDesc">Sắp xếp: Số lượng tồn giảm dần</option>
                </select>
              </div>
            </div>

            {/* Quick tabs & Bulk expand toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 mr-1 text-[11px] font-semibold">Lọc nhanh:</span>
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'active', label: 'Đang dùng' },
                  { id: 'low_stock', label: '🟡 Sắp hết' },
                  { id: 'expiring_soon', label: '🟠 Sắp hết hạn' },
                  { id: 'expired', label: '🔴 Đã hết hạn' },
                  { id: 'out_of_stock', label: 'Hết hàng' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={expandAllMeds}
                  className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
                >
                  Mở rộng tất cả lô
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={collapseAllMeds}
                  className="text-slate-500 hover:text-slate-800 font-medium hover:underline cursor-pointer"
                >
                  Thu gọn
                </button>
                <span className="text-slate-400 text-[11px] ml-2">
                  Hiển thị <strong>{processedMedicines.length}</strong> / {medicines.length} thuốc
                </span>
              </div>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-8 text-center">Lô</th>
                    <th className="py-3 px-3">Mã & Tên thuốc</th>
                    <th className="py-3 px-3">Hoạt chất / Hàm lượng</th>
                    <th className="py-3 px-3">Dạng & Quy cách</th>
                    <th className="py-3 px-3 text-center">Số lô & HSD gần nhất</th>
                    <th className="py-3 px-3 text-right">Tồn kho / Tối thiểu</th>
                    <th className="py-3 px-3">Vị trí tủ</th>
                    <th className="py-3 px-3 text-center">Tình trạng</th>
                    <th className="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 px-4 text-center">
                        <div className="text-slate-400 max-w-sm mx-auto space-y-2">
                          <Pill className="w-8 h-8 mx-auto text-slate-300" />
                          <p className="font-semibold text-slate-600">Không tìm thấy thuốc nào phù hợp.</p>
                          <p className="text-[11px] text-slate-400">
                            Thử xóa từ khóa tìm kiếm hoặc bấm &ldquo;Đồng bộ dữ liệu&rdquo; để làm mới kho.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    processedMedicines.map((med) => {
                      const statusStyle = getStatusText(med.computedStatus);
                      const medBatches = batches.filter((b) => b.medicineId === med.id);
                      const daysLeft = med.earliestExpDate ? getDaysRemaining(med.earliestExpDate) : null;
                      const isExpanded = expandedMedIds.has(med.id);

                      return (
                        <React.Fragment key={med.id}>
                          <tr className="hover:bg-slate-50/80 transition-colors group">
                            {/* Expand row toggle */}
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandMed(med.id)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                                  isExpanded
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                                }`}
                                title={isExpanded ? 'Thu gọn danh sách lô' : 'Bấm để xem các lô thuốc'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Name & Code */}
                            <td className="py-3 px-3">
                              <div className="flex items-start gap-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                  {med.name.charAt(0)}
                                </div>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedMedicine(med)}
                                    className="font-bold text-slate-900 hover:text-emerald-700 text-left text-xs sm:text-sm cursor-pointer"
                                  >
                                    {med.name}
                                  </button>
                                  <span className="block font-mono text-[10px] text-slate-500">
                                    {med.code} • NSX: {med.manufacturer || 'Việt Nam'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Active Ingredient & Strength */}
                            <td className="py-3 px-3">
                              <span className="font-medium text-slate-800">{med.activeIngredient}</span>
                              <span className="block text-[10px] text-slate-500 font-semibold">
                                Hàm lượng: {med.strength}
                              </span>
                            </td>

                            {/* Dosage Form & Packing */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="text-slate-800 font-medium">{med.dosageForm}</span>
                              <span className="block text-[10px] text-slate-500">
                                ĐVT: <strong className="text-slate-700">{med.unit}</strong> ({med.packing})
                              </span>
                            </td>

                            {/* Batches count & Inline Batch List */}
                            <td className="py-3 px-3 text-left whitespace-nowrap">
                              <div className="flex items-center gap-1.5 mb-1">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandMed(med.id)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                                    medBatches.length > 0
                                      ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}
                                  title="Bấm để mở rộng quản lý từng lô"
                                >
                                  <span>{medBatches.length} Lô</span>
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddBatch(med)}
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                                  title={`Nhập thêm lô mới cho thuốc ${med.name}`}
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Thêm lô</span>
                                </button>
                              </div>
                              {medBatches.length > 0 ? (
                                <div className="space-y-1 mt-1">
                                  {medBatches.map((b) => {
                                    const bLeft = getDaysRemaining(b.expDate);
                                    const isPlaceholderBatch = b.batchNumber.startsWith('LO-');
                                    return (
                                      <div
                                        key={b.id}
                                        className="flex items-center gap-1.5 text-[10px] bg-slate-50 border border-slate-200/80 rounded px-1.5 py-0.5"
                                      >
                                        <span className="font-mono font-bold text-slate-800">
                                          {isPlaceholderBatch ? 'Tồn kho' : `Lô ${b.batchNumber}`}
                                        </span>
                                        {!isPlaceholderBatch && (
                                          <>
                                            <span className="text-slate-400">•</span>
                                            <span className="text-slate-500">SX: {formatDateVN(b.mfgDate)}</span>
                                            <span className="text-slate-400">•</span>
                                            <span
                                              className={`font-semibold ${
                                                bLeft < 0
                                                  ? 'text-rose-600'
                                                  : bLeft <= 30
                                                  ? 'text-orange-600'
                                                  : 'text-emerald-700'
                                              }`}
                                            >
                                              HSD: {formatDateVN(b.expDate)}
                                            </span>
                                          </>
                                        )}
                                        <span className="text-slate-400">•</span>
                                        <span className="font-black text-slate-900">
                                          SL: {b.quantity} {med.unit}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="block text-[10px] text-slate-400 mt-0.5">Chưa có lô tồn kho</span>
                              )}
                            </td>

                            {/* Stock vs MinStock */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-baseline justify-end gap-1">
                                <span
                                  className={`text-sm font-black ${
                                    med.totalStock === 0
                                      ? 'text-slate-400'
                                      : med.totalStock <= med.minStock
                                      ? 'text-amber-700'
                                      : 'text-emerald-800'
                                  }`}
                                >
                                  {med.totalStock}
                                </span>
                                <span className="text-slate-500 text-[11px]">{med.unit}</span>
                              </div>
                              <span className="block text-[10px] text-slate-400">
                                Mức tối thiểu: {med.minStock} {med.unit}
                              </span>
                            </td>

                            {/* Storage location */}
                            <td className="py-3 px-3 text-slate-700">
                              <span className="inline-flex items-center gap-1 text-[11px]">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[130px]">{med.storageLocation}</span>
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black border ${statusStyle.bg} ${statusStyle.color} ${statusStyle.border}`}
                              >
                                {statusStyle.label}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMedicine(med)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                  title="Xem chi tiết thuốc và lịch sử lô"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenEditModal(med)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Sửa thông tin thuốc"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(med)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Xóa thuốc khỏi danh mục"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* INLINE ROW EXPANSION: Quản lý chi tiết các lô của thuốc này */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 border-b border-slate-200">
                              <td colSpan={9} className="p-3 sm:p-4">
                                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                                        <Boxes className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                                          Danh sách các lô của: <span className="text-emerald-800">{med.name}</span> ({med.code})
                                        </h4>
                                        <p className="text-[10px] text-slate-500">
                                          Tổng tồn hiện tại: <strong>{med.totalStock} {med.unit}</strong> • Ưu tiên xuất theo hạn dùng gần nhất (FEFO)
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => onOpenImportForMed(med)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 cursor-pointer"
                                      >
                                        <ArrowDownLeft className="w-3.5 h-3.5" />
                                        <span>Lập phiếu nhập</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAddBatch(med)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs cursor-pointer"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>+ Nhập Thêm Lô Mới</span>
                                      </button>
                                    </div>
                                  </div>

                                  {medBatches.length === 0 ? (
                                    <div className="py-4 text-center text-slate-400 space-y-1">
                                      <p className="text-xs font-medium">Thuốc này hiện chưa có lô nào trong kho.</p>
                                      <p className="text-[10px]">
                                        Bấm nút &ldquo;+ Nhập Thêm Lô Mới&rdquo; hoặc lập phiếu nhập để bổ sung tồn kho.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                                      <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
                                          <tr>
                                            <th className="p-2">Số hiệu lô</th>
                                            <th className="p-2">Ngày SX</th>
                                            <th className="p-2">Hạn sử dụng</th>
                                            <th className="p-2">Đếm ngược hạn</th>
                                            <th className="p-2 text-right">Tồn kho của lô</th>
                                            <th className="p-2">Vị trí lưu trữ</th>
                                            <th className="p-2 text-center">Tình trạng</th>
                                            <th className="p-2 text-center">Thao tác</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {medBatches
                                            .slice()
                                            .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime())
                                            .map((batch) => {
                                              const bDaysLeft = getDaysRemaining(batch.expDate);
                                              return (
                                                <tr key={batch.id} className="hover:bg-slate-50/70">
                                                  <td className="p-2 font-mono font-bold text-slate-900">
                                                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-800">
                                                      {batch.batchNumber}
                                                    </span>
                                                  </td>
                                                  <td className="p-2 text-slate-600">
                                                    {formatDateVN(batch.mfgDate)}
                                                  </td>
                                                  <td className="p-2 font-bold text-slate-800">
                                                    {formatDateVN(batch.expDate)}
                                                  </td>
                                                  <td className="p-2">
                                                    <span
                                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        bDaysLeft < 0
                                                          ? 'bg-rose-100 text-rose-700'
                                                          : bDaysLeft <= 30
                                                          ? 'bg-amber-100 text-amber-800'
                                                          : 'bg-emerald-100 text-emerald-800'
                                                      }`}
                                                    >
                                                      {bDaysLeft < 0
                                                        ? `Quá hạn ${Math.abs(bDaysLeft)} ngày`
                                                        : `Còn ${bDaysLeft} ngày`}
                                                    </span>
                                                  </td>
                                                  <td className="p-2 text-right font-black text-slate-900">
                                                    {batch.quantity} {med.unit}
                                                  </td>
                                                  <td className="p-2 text-slate-600">
                                                    {batch.storageLocation || med.storageLocation}
                                                  </td>
                                                  <td className="p-2 text-center">
                                                    {bDaysLeft < 0 ? (
                                                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                                                        ĐÃ HẾT HẠN
                                                      </span>
                                                    ) : bDaysLeft <= 30 ? (
                                                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                                                        SẮP HẾT HẠN (FEFO)
                                                      </span>
                                                    ) : batch.quantity === 0 ? (
                                                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">
                                                        Đã xuất hết
                                                      </span>
                                                    ) : (
                                                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                        Đang dùng
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="p-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenEditBatch(med, batch)}
                                                        className="p-1 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
                                                        title="Sửa thông tin số lô, ngày SX, HSD, số lượng"
                                                      >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => setDeleteConfirmBatch(batch)}
                                                        className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-700 transition-colors cursor-pointer"
                                                        title="Xóa lô này khỏi kho"
                                                      >
                                                        <Trash2 className="w-3.5 h-3.5" />
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
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1B: BẢNG TỔNG HỢP NGANG (MẪU SỔ KIỂM KÊ 5 CỘT LÔ NHƯ FILE EXCEL)     */}
      {/* ========================================================================= */}
      {activeViewMode === 'spreadsheet' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                Bảng Kê Chi Tiết Thuốc & Vật Tư Y Tế Theo Từng Lô (Mẫu Ngang 5 Lô)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hiển thị đúng cấu trúc bảng kiểm kê thực tế gồm 30 mặt hàng và toàn bộ các lô, ngày sản xuất, hạn dùng, số lượng tồn kho
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreFixedCatalog}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đồng bộ chuẩn theo bảng</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-900 font-bold">
                  <tr>
                    <th className="border border-slate-300 py-2.5 px-2 text-center w-10">Stt</th>
                    <th className="border border-slate-300 py-2.5 px-2.5 min-w-[150px]">Tên biệt dược</th>
                    <th className="border border-slate-300 py-2.5 px-2 min-w-[120px]">Tên hoạt chất</th>
                    <th className="border border-slate-300 py-2.5 px-2 whitespace-nowrap text-center">Số lượng/hộp</th>
                    <th className="border border-slate-300 py-2.5 px-2 whitespace-nowrap text-center">Hàm lượng</th>
                    <th className="border border-slate-300 py-2.5 px-2 whitespace-nowrap text-center">Đơn vị</th>
                    {[1, 2, 3, 4, 5].map((lotIdx) => (
                      <React.Fragment key={lotIdx}>
                        <th className="border border-slate-300 py-2.5 px-2 text-center bg-emerald-50/60 whitespace-nowrap">
                          lô {lotIdx > 1 ? `(${lotIdx})` : ''}
                        </th>
                        <th className="border border-slate-300 py-2.5 px-2 text-center bg-emerald-50/60 whitespace-nowrap">
                          ngày SX
                        </th>
                        <th className="border border-slate-300 py-2.5 px-2 text-center bg-emerald-50/60 whitespace-nowrap">
                          hết hạn
                        </th>
                        <th className="border border-slate-300 py-2.5 px-2 text-right bg-emerald-50/60 whitespace-nowrap">
                          Số lượng tồn kho
                        </th>
                      </React.Fragment>
                    ))}
                    <th className="border border-slate-300 py-2.5 px-2 text-right bg-amber-50 whitespace-nowrap">
                      Tổng tồn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {processedMedicines.map((med, rowIdx) => {
                    const sheetSttMap: Record<string, number> = {
                      'med-01': 1, 'med-02': 2, 'med-03': 3, 'med-04': 4, 'med-05': 5,
                      'med-06': 6, 'med-07': 7, 'med-08': 8, 'med-09': 9, 'med-10': 10,
                      'med-11': 11, 'med-12': 12, 'med-13': 13, 'med-14': 14, 'med-15': 15,
                      'med-16': 16, 'med-17': 19, 'med-18': 17, 'med-19': 18, 'med-20': 20,
                      'med-21': 21, 'med-22': 22, 'med-23': 23, 'med-24': 24, 'med-25': 28,
                      'med-26': 30, 'med-27': 25, 'med-28': 26, 'med-29': 27, 'med-30': 29,
                    };
                    const displayStt = sheetSttMap[med.id] ?? rowIdx + 1;
                    const medBatches = batches.filter((b) => b.medicineId === med.id);
                    const noPackingIds = new Set(['med-17', 'med-20', 'med-26', 'med-27', 'med-28', 'med-29', 'med-30']);
                    const displayPacking = noPackingIds.has(med.id) ? '' : med.packing;

                    return (
                      <tr key={med.id} className="hover:bg-slate-50 transition-colors">
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-bold text-slate-900">
                          {displayStt}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 font-semibold text-slate-900 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedMedicine(med)}
                            className="hover:text-emerald-700 hover:underline text-left cursor-pointer"
                          >
                            {med.name}
                          </button>
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-slate-700 whitespace-nowrap">
                          {med.activeIngredient || ''}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-700 whitespace-nowrap">
                          {displayPacking}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-700 whitespace-nowrap">
                          {med.strength || ''}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-800 font-medium whitespace-nowrap">
                          {med.unit}
                        </td>
                        {[0, 1, 2, 3, 4].map((slotIdx) => {
                          const b = medBatches[slotIdx];
                          if (!b) {
                            return (
                              <React.Fragment key={slotIdx}>
                                <td className="border border-slate-300 py-1.5 px-2"></td>
                                <td className="border border-slate-300 py-1.5 px-2"></td>
                                <td className="border border-slate-300 py-1.5 px-2"></td>
                                <td className="border border-slate-300 py-1.5 px-2"></td>
                              </React.Fragment>
                            );
                          }
                          const isSupplyStockOnly = b.batchNumber.startsWith('LO-');
                          const isCataflamMonthOnly = b.id === 'batch-09-1';
                          const mfgStr = isSupplyStockOnly
                            ? ''
                            : isCataflamMonthOnly
                            ? '02/2025'
                            : formatDateVN(b.mfgDate);
                          const expStr = isSupplyStockOnly
                            ? ''
                            : isCataflamMonthOnly
                            ? '01/2027'
                            : formatDateVN(b.expDate);

                          return (
                            <React.Fragment key={slotIdx}>
                              <td className="border border-slate-300 py-1.5 px-2 font-mono text-slate-800 whitespace-nowrap">
                                {isSupplyStockOnly ? '' : b.batchNumber}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-700 whitespace-nowrap">
                                {mfgStr}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-800 whitespace-nowrap">
                                {expStr}
                              </td>
                              <td className="border border-slate-300 py-1.5 px-2 text-right font-bold text-slate-900 whitespace-nowrap">
                                {b.quantity}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="border border-slate-300 py-1.5 px-2 text-right font-black text-emerald-800 bg-amber-50/40 whitespace-nowrap">
                          {med.totalStock || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TẤT CẢ CÁC LÔ & HẠN DÙNG (BẢNG TỔNG HỢP TOÀN BỘ LÔ TRONG KHO)     */}
      {/* ========================================================================= */}
      {activeViewMode === 'batches' && (
        <div className="space-y-4">
          {/* Controls for Batches */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-7 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={batchSearchTerm}
                  onChange={(e) => setBatchSearchTerm(e.target.value)}
                  placeholder="Tìm theo số hiệu lô, tên thuốc, mã thuốc, vị trí tủ..."
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {batchSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setBatchSearchTerm('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="md:col-span-5 flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={batchStatusFilter}
                  onChange={(e) => setBatchStatusFilter(e.target.value)}
                  className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">Tất cả các lô ({batches.length})</option>
                  <option value="active">Còn hạn an toàn (&gt; 60 ngày)</option>
                  <option value="warning_60">Cảnh báo hạn (31 - 60 ngày)</option>
                  <option value="expiring_soon">Sắp hết hạn (≤ 30 ngày)</option>
                  <option value="expired">Đã hết hạn (&lt; 0 ngày)</option>
                  <option value="out_of_stock">Đã xuất hết (tồn 0)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 mr-1 text-[11px] font-semibold">Bộ lọc nhanh:</span>
                {[
                  { id: 'all', label: 'Tất cả lô' },
                  { id: 'expiring_soon', label: '🟠 Cận date ≤30 ngày' },
                  { id: 'expired', label: '🔴 Đã hết hạn' },
                  { id: 'active', label: '🟢 Còn hạn an toàn' },
                  { id: 'out_of_stock', label: 'Hết tồn' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBatchStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                      batchStatusFilter === tab.id
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <span className="text-slate-400 text-[11px]">
                Hiển thị <strong>{processedBatches.length}</strong> / {batches.length} lô thuốc
              </span>
            </div>
          </div>

          {/* Batches Comprehensive Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Số hiệu lô</th>
                    <th className="py-3 px-3">Mã & Tên thuốc</th>
                    <th className="py-3 px-3">Ngày sản xuất</th>
                    <th className="py-3 px-3">Hạn sử dụng</th>
                    <th className="py-3 px-3">Đếm ngược hạn</th>
                    <th className="py-3 px-3 text-right">Số lượng tồn</th>
                    <th className="py-3 px-3">Vị trí tủ thuốc</th>
                    <th className="py-3 px-3 text-center">Tình trạng</th>
                    <th className="py-3 px-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 px-4 text-center text-slate-400">
                        <Boxes className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">Không tìm thấy lô thuốc nào phù hợp.</p>
                      </td>
                    </tr>
                  ) : (
                    processedBatches.map((batch) => {
                      const daysLeft = batch.daysRemaining;
                      const med = batch.medicine;

                      return (
                        <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Batch number */}
                          <td className="py-3 px-3 font-mono font-black text-slate-900 whitespace-nowrap">
                            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200">
                              {batch.batchNumber}
                            </span>
                          </td>

                          {/* Medicine name & code */}
                          <td className="py-3 px-3">
                            {med ? (
                              <div>
                                <span className="font-bold text-slate-900 block">{med.name}</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {med.code} • {med.dosageForm} ({med.strength})
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Thuốc đã bị xóa ({batch.medicineId})</span>
                            )}
                          </td>

                          {/* MFG Date */}
                          <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                            {formatDateVN(batch.mfgDate)}
                          </td>

                          {/* Expiry Date */}
                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                            {formatDateVN(batch.expDate)}
                          </td>

                          {/* Days Left badge */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                daysLeft < 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : daysLeft <= 30
                                  ? 'bg-amber-100 text-amber-800'
                                  : daysLeft <= 60
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {daysLeft < 0
                                ? `Quá hạn ${Math.abs(daysLeft)} ngày`
                                : `Còn ${daysLeft} ngày`}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            {batch.quantity} {med?.unit || 'Đơn vị'}
                          </td>

                          {/* Location */}
                          <td className="py-3 px-3 text-slate-600">
                            {batch.storageLocation || med?.storageLocation || 'Tủ A'}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {daysLeft < 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                                ĐÃ HẾT HẠN
                              </span>
                            ) : daysLeft <= 30 ? (
                              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                                SẮP HẾT HẠN (FEFO)
                              </span>
                            ) : batch.quantity === 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">
                                Đã xuất hết
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Đang sử dụng
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {med && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBatch(med, batch)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Chỉnh sửa thông tin số lô, ngày SX, hạn sử dụng, số lượng tồn"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmBatch(batch)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa lô này khỏi kho"
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: CẢNH BÁO HẠN DÙNG (CẬN DATE & HẾT HẠN)                            */}
      {/* ========================================================================= */}
      {activeViewMode === 'expiring' && (
        <div className="space-y-4">
          {/* Header notice banner */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
              <ClockAlert className="w-5 h-5" />
            </div>
            <div className="text-xs text-amber-900 space-y-1">
              <h4 className="font-bold text-sm">Quy Trình Quản Lý Lô Thuốc Theo Hạn Sử Dụng (FEFO)</h4>
              <p className="leading-relaxed">
                Theo quy định y tế học đường: Các lô thuốc cận date (dưới 30 ngày) cần được ưu tiên xuất sử dụng trước (FEFO - First Expired, First Out).
                Các lô thuốc đã quá hạn sử dụng phải được cách ly ngay khỏi tủ thuốc sơ cứu và lập biên bản kiểm kê để tiêu hủy theo quy định.
              </p>
            </div>
          </div>

          {alertBatches.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Tủ Thuốc Hoàn Toàn An Toàn!</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hiện tại không có lô thuốc nào trong kho bị hết hạn hoặc cận date dưới 60 ngày. Mọi loại thuốc đều có hạn sử dụng an toàn.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Tình trạng cảnh báo</th>
                      <th className="py-3 px-3">Số hiệu lô</th>
                      <th className="py-3 px-3">Mã & Tên thuốc</th>
                      <th className="py-3 px-3">Hạn sử dụng</th>
                      <th className="py-3 px-3">Thời gian còn lại</th>
                      <th className="py-3 px-3 text-right">Số lượng tồn</th>
                      <th className="py-3 px-3">Vị trí tủ</th>
                      <th className="py-3 px-3 text-center">Xử lý kiến nghị</th>
                      <th className="py-3 px-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alertBatches.map((batch) => {
                      const isExpired = batch.daysRemaining < 0;
                      const isVeryUrgent = batch.daysRemaining >= 0 && batch.daysRemaining <= 15;
                      const med = batch.medicine;

                      return (
                        <tr
                          key={batch.id}
                          className={isExpired ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50'}
                        >
                          <td className="py-3 px-3 whitespace-nowrap">
                            {isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-600 text-white font-black text-[10px] shadow-2xs">
                                <ShieldAlert className="w-3 h-3" />
                                <span>ĐÃ HẾT HẠN</span>
                              </span>
                            ) : isVeryUrgent ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-[10px]">
                                <ClockAlert className="w-3 h-3 text-rose-600" />
                                <span>RẤT GẤP (≤ 15 ngày)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                                <ClockAlert className="w-3 h-3 text-amber-700" />
                                <span>CẬN DATE (≤ 60 ngày)</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {batch.batchNumber}
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{med?.name || '---'}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{med?.code}</span>
                          </td>

                          <td className="py-3 px-3 font-bold text-slate-900">
                            {formatDateVN(batch.expDate)}
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`font-black text-xs ${
                                isExpired ? 'text-rose-600' : 'text-amber-800'
                              }`}
                            >
                              {isExpired
                                ? `Quá hạn ${Math.abs(batch.daysRemaining)} ngày`
                                : `Còn ${batch.daysRemaining} ngày`}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-black text-slate-900">
                            {batch.quantity} {med?.unit || ''}
                          </td>

                          <td className="py-3 px-3 text-slate-600">
                            {batch.storageLocation || med?.storageLocation}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {isExpired ? (
                              <span className="text-rose-700 font-bold text-[11px] block">
                                Cách ly & Tiêu hủy
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px] block">
                                Ưu tiên cấp phát FEFO
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {med && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditBatch(med, batch)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Chỉnh sửa thông tin lô"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmBatch(batch)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Xóa lô này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* MODAL: XEM CHI TIẾT THUỐC & LỊCH SỬ CÁC LÔ                               */}
      {/* ========================================================================= */}
      {selectedMedicine && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 mb-1">
                  MÃ THUỐC: {selectedMedicine.code}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900">
                  {selectedMedicine.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Hoạt chất: {selectedMedicine.activeIngredient} • Hàm lượng: {selectedMedicine.strength}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMedicine(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1 cursor-pointer"
              >
                ✕ Đóng
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Detailed Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Dạng bào chế:</span>
                  <strong className="text-slate-800">{selectedMedicine.dosageForm}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Đơn vị tính:</span>
                  <strong className="text-slate-800">{selectedMedicine.unit}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Quy cách đóng gói:</span>
                  <strong className="text-slate-800">{selectedMedicine.packing}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Nhà sản xuất:</span>
                  <strong className="text-slate-800">{selectedMedicine.manufacturer || '---'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Nước sản xuất:</span>
                  <strong className="text-slate-800">{selectedMedicine.country || 'Việt Nam'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Vị trí tủ thuốc:</span>
                  <strong className="text-emerald-800">{selectedMedicine.storageLocation}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Mức tồn tối thiểu:</span>
                  <strong className="text-slate-800">
                    {selectedMedicine.minStock} {selectedMedicine.unit}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Tổng tồn kho hiện tại:</span>
                  <strong className="text-emerald-700 text-sm">
                    {selectedMedicine.totalStock} {selectedMedicine.unit}
                  </strong>
                </div>
              </div>

              {selectedMedicine.notes && (
                <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-900">
                  <p className="font-bold text-[11px] mb-0.5">Ghi chú & Chỉ định sơ cứu trường học:</p>
                  <p>{selectedMedicine.notes}</p>
                </div>
              )}

              {/* Batches Table in Modal */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-emerald-600" />
                      <span>Danh Sách Các Lô Thuốc Hiện Có (Ưu tiên xuất FEFO)</span>
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Mỗi lô có số hiệu và hạn dùng riêng • Sắp xếp hạn dùng gần nhất xếp trước
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAddBatch(selectedMedicine)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Nhập Thêm Lô Mới</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Số lô</th>
                        <th className="p-2.5">Ngày SX</th>
                        <th className="p-2.5">Hạn sử dụng</th>
                        <th className="p-2.5 text-right">Tồn hiện tại</th>
                        <th className="p-2.5 text-center">Tình trạng lô</th>
                        <th className="p-2.5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {batches
                        .filter((b) => b.medicineId === selectedMedicine.id)
                        .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime())
                        .map((b) => {
                          const daysLeft = getDaysRemaining(b.expDate);
                          return (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="p-2.5 font-mono font-bold text-slate-900">
                                {b.batchNumber}
                              </td>
                              <td className="p-2.5 text-slate-600">{formatDateVN(b.mfgDate)}</td>
                              <td className="p-2.5">
                                <span className="font-bold text-slate-800">
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
                              <td className="p-2.5 text-right font-black text-slate-900">
                                {b.quantity} {selectedMedicine.unit}
                              </td>
                              <td className="p-2.5 text-center">
                                {daysLeft < 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                                    ĐÃ HẾT HẠN
                                  </span>
                                ) : daysLeft <= 30 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                                    SẮP HẾT HẠN (FEFO)
                                  </span>
                                ) : b.quantity === 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                                    Đã xuất hết
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Đang sử dụng
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditBatch(selectedMedicine, b)}
                                    className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                    title="Chỉnh sửa số lô, ngày SX, hạn sử dụng"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmBatch(b)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Xóa lô này khỏi kho"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const med = selectedMedicine;
                    setSelectedMedicine(null);
                    onOpenImportForMed(med);
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 cursor-pointer"
                >
                  + Lập Phiếu Nhập Thêm Lô
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const med = selectedMedicine;
                    handleDelete(med);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa thuốc</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const med = selectedMedicine;
                    setSelectedMedicine(null);
                    onOpenEditModal(med);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-200 text-slate-800 font-bold hover:bg-slate-300 cursor-pointer"
                >
                  Sửa thông tin
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMedicine(null)}
                  className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Xác Nhận Xóa Thuốc */}
      {deleteConfirmMed && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Thuốc Khỏi Hệ Thống</h3>
                <p className="text-xs text-slate-500 font-mono">{deleteConfirmMed.code}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 my-3">
              <p><strong>Tên thuốc:</strong> {deleteConfirmMed.name}</p>
              <p><strong>Hoạt chất / Dạng:</strong> {deleteConfirmMed.activeIngredient} ({deleteConfirmMed.dosageForm})</p>
              <p><strong>Tồn kho hiện tại:</strong> <span className="font-bold text-emerald-700">{deleteConfirmMed.totalStock ?? 0} {deleteConfirmMed.unit}</span></p>
              <p><strong>Số lượng lô liên quan:</strong> {batches.filter(b => b.medicineId === deleteConfirmMed.id).length} lô</p>
            </div>

            {(deleteConfirmMed.totalStock ?? 0) > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs mb-4">
                ⚠️ <strong>Cảnh báo tồn kho:</strong> Mặt hàng này hiện đang có <strong>{deleteConfirmMed.totalStock} {deleteConfirmMed.unit}</strong> tồn trong kho. Khi thực hiện xóa, hệ thống sẽ xóa toàn bộ các lô thuốc tương ứng.
              </div>
            )}

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn xóa hoàn toàn thuốc này khỏi danh mục không?
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmMed(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeDeleteMedicine}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Xác nhận xóa thuốc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Xác Nhận Xóa Lô Thuốc */}
      {deleteConfirmBatch && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Lô Thuốc</h3>
                <p className="text-xs text-slate-500 font-mono">Số lô: {deleteConfirmBatch.batchNumber}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 my-3">
              <p><strong>Số lô:</strong> {deleteConfirmBatch.batchNumber}</p>
              <p><strong>Hạn dùng:</strong> {formatDateVN(deleteConfirmBatch.expDate)}</p>
              <p><strong>Số lượng tồn:</strong> <span className="font-bold text-emerald-700">{deleteConfirmBatch.quantity}</span></p>
            </div>

            <p className="text-xs text-slate-600">
              Bạn có chắc chắn muốn xóa số lô này khỏi hệ thống? Số lượng tồn kho của thuốc sẽ tự động được tính lại và đồng bộ tức thì.
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmBatch(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeDeleteBatch}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Xác nhận xóa lô
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Xác Nhận Xóa Sạch Kho */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xóa Danh Mục Thuốc Mẫu</h3>
                <p className="text-xs text-slate-500">Dọn dẹp để bắt đầu nhập thuốc thực tế</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1.5 my-3">
              <p>
                ⚠️ <strong>Bạn có muốn xóa toàn bộ {medicines.length} mặt hàng thuốc mẫu hiện có không?</strong>
              </p>
              <p className="text-slate-600 leading-relaxed">
                Sau khi xóa, danh mục sẽ hoàn toàn trống để bạn tự do nhập danh sách thuốc mới của trường thông qua form nhập tay, tải file Excel hoặc khi tạo phiếu nhập kho.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleClearAllMedicines}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Đồng ý xóa sạch để nhập mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nhập Excel */}
      {showImportExcelModal && (
        <ImportExcelModal
          onClose={() => setShowImportExcelModal(false)}
          onSuccess={() => {
            refreshData();
          }}
        />
      )}

      {/* MODAL: Nhập / Sửa Lô thuốc riêng biệt */}
      {batchModalMed && (
        <BatchModal
          isOpen={true}
          medicine={batchModalMed}
          batchToEdit={batchToEdit}
          onClose={() => {
            setBatchModalMed(null);
            setBatchToEdit(null);
          }}
          onSuccess={handleBatchSuccess}
        />
      )}
    </div>
  );
};
