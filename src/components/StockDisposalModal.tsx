import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Calendar,
  FileText,
  Printer,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Plus,
  Edit3,
  Layers,
  Boxes,
  FileSpreadsheet,
  ChevronRight,
  Search,
  Filter,
  ArrowRight,
  Check,
  Building,
  UserCheck,
} from 'lucide-react';
import { db } from '../services/db';
import {
  MedicineDisposal,
  MedicineDisposalItem,
  DisposalCouncilMember,
  DisposalStatus,
} from '../types';
import { formatDateVN, formatVND } from '../utils/helpers';
import { printDisposalReportA4, exportDisposalWordA4 } from '../services/printA4Service';
import { exportDisposalExcel } from '../services/excelService';

interface StockDisposalModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface ExpiredBatchItem {
  batchId: string;
  medicineId: string;
  medicineCode: string;
  medicineName: string;
  activeIngredient: string;
  unit: string;
  batchNumber: string;
  expDate: string;
  quantity: number;
  unitPrice: number;
  daysRemaining: number;
}

const getExpiredBatchesList = (): ExpiredBatchItem[] => {
  return db.getExpiredBatchesWithDetails().map(({ batch, medicine, daysExpired }) => ({
    batchId: batch.id,
    medicineId: medicine.id,
    medicineCode: medicine.code,
    medicineName: medicine.name,
    activeIngredient: medicine.activeIngredient || '',
    unit: medicine.unit,
    batchNumber: batch.batchNumber,
    expDate: batch.expDate,
    quantity: batch.quantity,
    unitPrice: batch.unitPrice || medicine.unitPrice || 0,
    daysRemaining: -daysExpired,
  }));
};

const getNearExpiryBatchesList = (days = 60): ExpiredBatchItem[] => {
  return db.getNearExpiryBatchesWithDetails(days).map(({ batch, medicine, daysRemaining }) => ({
    batchId: batch.id,
    medicineId: medicine.id,
    medicineCode: medicine.code,
    medicineName: medicine.name,
    activeIngredient: medicine.activeIngredient || '',
    unit: medicine.unit,
    batchNumber: batch.batchNumber,
    expDate: batch.expDate,
    quantity: batch.quantity,
    unitPrice: batch.unitPrice || medicine.unitPrice || 0,
    daysRemaining,
  }));
};

export const StockDisposalModal: React.FC<StockDisposalModalProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'check_expiry' | 'create_disposal' | 'history'>('check_expiry');

  // Batches & Expired State
  const [expiredBatches, setExpiredBatches] = useState<ExpiredBatchItem[]>(() => getExpiredBatchesList());
  const [expiringSoonBatches, setExpiringSoonBatches] = useState<ExpiredBatchItem[]>(() => getNearExpiryBatchesList(60));
  const [disposals, setDisposals] = useState<MedicineDisposal[]>(() => db.getDisposals());
  const [settings, setSettings] = useState(() => db.getSettings());

  // Filter in Tab 1
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired_only' | 'expiring_30' | 'expiring_60'>('expired_only');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected items for disposal: batchId -> { selected: boolean, quantity: number, reason: string }
  const [selectedBatches, setSelectedBatches] = useState<
    Record<string, { selected: boolean; quantity: number; reason: string }>
  >({});

  // Disposal Form State (Tab 2)
  const [editingDisposalId, setEditingDisposalId] = useState<string | null>(null);
  const [disposalCode, setDisposalCode] = useState<string>(() => db.getNextDisposalCode());
  const [decisionNumber, setDecisionNumber] = useState<string>('15/QĐ-THCSĐT');
  const [decisionDate, setDecisionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [disposalDate, setDisposalDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [disposalLocation, setDisposalLocation] = useState<string>('Phòng Y tế Trường THCS Đông Thạnh');
  const [disposalMethod, setDisposalMethod] = useState<string>(
    'Hòa tan, trung hòa bất hoạt và chuyển bao gói rác thải y tế chuyên trách tiêu hủy theo quy định'
  );
  const [witnessNotes, setWitnessNotes] = useState<string>('Hội đồng đã kiểm tra đúng chủng loại, số lượng, niêm phong và tiêu hủy an toàn theo quy định.');
  const [councilMembers, setCouncilMembers] = useState<DisposalCouncilMember[]>([
    { roleTitle: 'Chủ tịch hội đồng', name: 'Quản trị', position: 'Đại diện Quản trị / Ban Giám hiệu' },
    { roleTitle: 'Thư ký hội đồng', name: 'Nhân viên Y tế', position: 'Phụ trách Phòng Y tế học đường' },
    { roleTitle: 'Ủy viên', name: 'Bộ phận Kế toán', position: 'Kế toán / Thủ kho' },
    { roleTitle: 'Ủy viên giám sát', name: 'Ban Giám sát', position: 'Đại diện Thanh tra / Công đoàn' },
  ]);
  const [formItems, setFormItems] = useState<MedicineDisposalItem[]>([]);

  // Feedback notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmDisposal, setDeleteConfirmDisposal] = useState<MedicineDisposal | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshData = () => {
    setExpiredBatches(getExpiredBatchesList());
    setExpiringSoonBatches(getNearExpiryBatchesList(60));
    setDisposals(db.getDisposals());
    setSettings(db.getSettings());
  };

  useEffect(() => {
    const unsub = db.subscribe(refreshData);
    return unsub;
  }, []);

  // Pre-select batches that are already expired by default
  useEffect(() => {
    const map: Record<string, { selected: boolean; quantity: number; reason: string }> = {};
    for (const b of expiredBatches) {
      if (b.quantity > 0) {
        map[b.batchId] = {
          selected: true,
          quantity: b.quantity,
          reason: 'Hết hạn sử dụng',
        };
      }
    }
    setSelectedBatches(map);
  }, [expiredBatches]);

  // Combined list for Tab 1
  const displayedBatches = useMemo(() => {
    let list = [...expiredBatches];
    if (expiryFilter === 'all') {
      // Add expiring batches not already in list
      const set = new Set(list.map((i) => i.batchId));
      for (const b of expiringSoonBatches) {
        if (!set.has(b.batchId)) list.push(b);
      }
    } else if (expiryFilter === 'expiring_30') {
      list = expiringSoonBatches.filter((b) => b.daysRemaining > 0 && b.daysRemaining <= 30);
    } else if (expiryFilter === 'expiring_60') {
      list = expiringSoonBatches.filter((b) => b.daysRemaining > 0 && b.daysRemaining <= 60);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (b) =>
          b.medicineName.toLowerCase().includes(q) ||
          b.medicineCode.toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q) ||
          (b.activeIngredient && b.activeIngredient.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [expiredBatches, expiringSoonBatches, expiryFilter, searchTerm]);

  // Total selected summary
  const selectedSummary = useMemo(() => {
    let count = 0;
    let totalQty = 0;
    let totalVal = 0;
    const all = [...expiredBatches, ...expiringSoonBatches];
    const entries = Object.entries(selectedBatches) as [string, { selected: boolean; quantity: number; reason: string }][];
    for (const [batchId, conf] of entries) {
      if (conf.selected && conf.quantity > 0) {
        const item = all.find((b) => b.batchId === batchId);
        if (item) {
          count++;
          totalQty += conf.quantity;
          totalVal += conf.quantity * item.unitPrice;
        }
      }
    }
    return { count, totalQty, totalVal };
  }, [selectedBatches, expiredBatches, expiringSoonBatches]);

  // Move selected to Tab 2
  const handleProceedToDisposalForm = () => {
    const all = [...expiredBatches, ...expiringSoonBatches];
    const items: MedicineDisposalItem[] = [];
    const entries = Object.entries(selectedBatches) as [string, { selected: boolean; quantity: number; reason: string }][];

    for (const [batchId, conf] of entries) {
      if (conf.selected && conf.quantity > 0) {
        const b = all.find((x) => x.batchId === batchId);
        if (b) {
          items.push({
            medicineId: b.medicineId,
            medicineCode: b.medicineCode,
            medicineName: b.medicineName,
            activeIngredient: b.activeIngredient,
            unit: b.unit,
            batchId: b.batchId,
            batchNumber: b.batchNumber,
            expDate: b.expDate,
            currentStock: b.quantity,
            disposalQuantity: conf.quantity,
            unitPrice: b.unitPrice,
            totalAmount: conf.quantity * b.unitPrice,
            reason: conf.reason || 'Hết hạn sử dụng',
          });
        }
      }
    }

    if (items.length === 0) {
      showToast('error', 'Vui lòng tích chọn ít nhất 1 lô thuốc để lập biên bản tiêu hủy.');
      return;
    }

    setEditingDisposalId(null);
    setDisposalCode(db.getNextDisposalCode());
    setFormItems(items);
    setActiveTab('create_disposal');
  };

  // Save disposal draft or pending approval
  const handleSaveDisposal = (executeNow = false) => {
    if (formItems.length === 0) {
      showToast('error', 'Biên bản chưa có danh mục thuốc cần tiêu hủy.');
      return;
    }

    try {
      const saved = db.saveDisposal({
        id: editingDisposalId || undefined,
        disposalCode,
        decisionNumber,
        decisionDate,
        disposalDate,
        disposalLocation,
        disposalMethod,
        witnessNotes,
        councilMembers,
        items: formItems,
        status: executeNow ? 'approved' : 'pending_approval',
      });

      if (executeNow) {
        db.executeDisposal(saved.id, councilMembers[1]?.name || 'Cán bộ Y tế', 'Tiêu hủy và xuất trừ kho tự động.');
        showToast('success', `Đã lập và thực hiện tiêu hủy thành công! Kho đã được trừ ${saved.totalQuantity} đơn vị thuốc.`);
      } else {
        showToast('success', `Đã lưu biên bản tiêu hủy ${saved.disposalCode} thành công.`);
      }

      refreshData();
      setActiveTab('history');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi lưu biên bản tiêu hủy.');
    }
  };

  // Direct execute from history
  const handleExecuteFromHistory = (disposal: MedicineDisposal) => {
    try {
      if (disposal.status !== 'approved') {
        db.approveDisposal(disposal.id, councilMembers[0]?.name || 'Ban Giám Hiệu', 'Phê duyệt tiêu hủy thuốc hết hạn.');
      }
      db.executeDisposal(disposal.id, councilMembers[1]?.name || 'Cán bộ Y tế', 'Tiêu hủy xuất trừ kho.');
      showToast('success', `Đã thực hiện trừ kho cho biên bản ${disposal.disposalCode} thành công!`);
      refreshData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast('error', err.message || 'Không thể thực hiện tiêu hủy.');
    }
  };

  // Delete disposal from history
  const handleConfirmDeleteDisposal = () => {
    if (!deleteConfirmDisposal) return;
    try {
      db.deleteDisposal(deleteConfirmDisposal.id);
      showToast('success', `Đã xóa biên bản ${deleteConfirmDisposal.disposalCode} thành công.`);
      setDeleteConfirmDisposal(null);
      refreshData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast('error', err.message || 'Không thể xóa biên bản tiêu hủy.');
      setDeleteConfirmDisposal(null);
    }
  };

  // Edit existing disposal
  const handleEditDisposal = (d: MedicineDisposal) => {
    if (d.status === 'completed') {
      showToast('error', 'Biên bản đã hoàn tất và trừ kho, không thể chỉnh sửa.');
      return;
    }
    setEditingDisposalId(d.id);
    setDisposalCode(d.disposalCode);
    setDecisionNumber(d.decisionNumber || '');
    setDecisionDate(d.decisionDate || d.disposalDate);
    setDisposalDate(d.disposalDate);
    setDisposalLocation(d.disposalLocation);
    setDisposalMethod(d.disposalMethod);
    setWitnessNotes(d.witnessNotes || '');
    setCouncilMembers(d.councilMembers);
    setFormItems(d.items);
    setActiveTab('create_disposal');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl my-4 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Kiểm Tra Hạn Dùng & Lập Biên Bản Tiêu Hủy Thuốc Hết Hạn
              </h2>
              <p className="text-xs text-slate-500">
                Quản lý dược phẩm cận hạn, lập biên bản tiêu hủy A4 chuẩn y tế học đường
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast feedback */}
        {toast && (
          <div
            className={`px-4 py-3 mx-4 mt-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-2 border-b border-slate-200 bg-white flex items-center gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('check_expiry')}
            className={`pb-3 pt-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'check_expiry'
                ? 'border-rose-600 text-rose-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>1. Kiểm tra thuốc quá hạn / cận hạn</span>
            {expiredBatches.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {expiredBatches.length} lô hết hạn
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('create_disposal')}
            className={`pb-3 pt-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'create_disposal'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>2. Soạn biên bản tiêu hủy</span>
            {formItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px]">
                {formItems.length} mục
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 pt-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>3. Sổ lưu biên bản tiêu hủy ({disposals.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {/* TAB 1: KIỂM TRA HẠN DÙNG */}
          {activeTab === 'check_expiry' && (
            <div className="space-y-4">
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900">
                  <div className="text-[11px] font-semibold text-rose-700 uppercase">Lô đã quá hạn</div>
                  <div className="text-xl font-black mt-0.5">{expiredBatches.length} <span className="text-xs font-normal">lô</span></div>
                  <div className="text-[10px] text-rose-600 mt-1">
                    Tổng tồn: {expiredBatches.reduce((s, b) => s + b.quantity, 0)} đv
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
                  <div className="text-[11px] font-semibold text-amber-700 uppercase">Cận hạn ≤ 60 ngày</div>
                  <div className="text-xl font-black mt-0.5">{expiringSoonBatches.filter(b => b.daysRemaining > 0).length} <span className="text-xs font-normal">lô</span></div>
                  <div className="text-[10px] text-amber-700 mt-1">Cần ưu tiên dùng FEFO</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 text-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Số lượng thuốc quá hạn</div>
                  <div className="text-xl font-black text-rose-600 mt-0.5">
                    {expiredBatches.reduce((s, b) => s + b.quantity, 0)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Cần lập biên bản hủy</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 text-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">Trạng thái xử lý</div>
                  <div className="text-base sm:text-lg font-black text-amber-700 mt-0.5">
                    {expiredBatches.length > 0 ? 'Chờ tiêu hủy' : 'Kho an toàn'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Lập hội đồng & biên bản hủy theo quy định</div>
                </div>
              </div>

              {/* Filters and Search */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setExpiryFilter('expired_only')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      expiryFilter === 'expired_only'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Đã hết hạn ({expiredBatches.length})
                  </button>
                  <button
                    onClick={() => setExpiryFilter('expiring_30')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      expiryFilter === 'expiring_30'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cận hạn ≤ 30 ngày
                  </button>
                  <button
                    onClick={() => setExpiryFilter('expiring_60')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      expiryFilter === 'expiring_60'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Cận hạn ≤ 60 ngày
                  </button>
                  <button
                    onClick={() => setExpiryFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      expiryFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên thuốc, số lô..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Table of Expired Batches */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={
                              displayedBatches.length > 0 &&
                              displayedBatches.every((b) => selectedBatches[b.batchId]?.selected)
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSelectedBatches((prev) => {
                                const next = { ...prev };
                                displayedBatches.forEach((b) => {
                                  next[b.batchId] = {
                                    selected: checked,
                                    quantity: b.quantity,
                                    reason: next[b.batchId]?.reason || 'Hết hạn sử dụng',
                                  };
                                });
                                return next;
                              });
                            }}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Thuốc & Hoạt chất</th>
                        <th className="p-3">Số lô</th>
                        <th className="p-3">Hạn dùng</th>
                        <th className="p-3 text-center">Tình trạng</th>
                        <th className="p-3 text-right">Tồn kho</th>
                        <th className="p-3 w-28 text-center">SL Chọn Hủy</th>
                        <th className="p-3">Lý do hủy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {displayedBatches.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            Không có lô thuốc nào thuộc danh mục lọc này.
                          </td>
                        </tr>
                      ) : (
                        displayedBatches.map((b) => {
                          const isSel = !!selectedBatches[b.batchId]?.selected;
                          const currentQty = selectedBatches[b.batchId]?.quantity ?? b.quantity;
                          const currentReason = selectedBatches[b.batchId]?.reason || 'Hết hạn sử dụng';

                          return (
                            <tr
                              key={b.batchId}
                              className={`hover:bg-slate-50 transition-colors ${
                                isSel ? 'bg-rose-50/40' : ''
                              }`}
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedBatches((prev) => ({
                                      ...prev,
                                      [b.batchId]: {
                                        selected: checked,
                                        quantity: prev[b.batchId]?.quantity ?? b.quantity,
                                        reason: prev[b.batchId]?.reason || 'Hết hạn sử dụng',
                                      },
                                    }));
                                  }}
                                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{b.medicineName}</div>
                                <div className="text-[11px] text-slate-500">
                                  Mã: <span className="font-mono">{b.medicineCode}</span>
                                  {b.activeIngredient && ` • ${b.activeIngredient}`}
                                </div>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                              <td className="p-3">
                                <div className="font-semibold text-slate-800">{formatDateVN(b.expDate)}</div>
                              </td>
                              <td className="p-3 text-center">
                                {b.daysRemaining < 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold inline-block">
                                    Quá hạn {Math.abs(b.daysRemaining)} ngày
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold inline-block">
                                    Còn {b.daysRemaining} ngày
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-bold text-slate-900">
                                {b.quantity} {b.unit}
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={b.quantity}
                                  value={currentQty}
                                  disabled={!isSel}
                                  onChange={(e) => {
                                    const val = Math.max(1, Math.min(b.quantity, Number(e.target.value) || 0));
                                    setSelectedBatches((prev) => ({
                                      ...prev,
                                      [b.batchId]: {
                                        selected: true,
                                        quantity: val,
                                        reason: currentReason,
                                      },
                                    }));
                                  }}
                                  className="w-20 px-2 py-1 text-center font-bold border border-slate-300 rounded-lg text-xs disabled:bg-slate-100"
                                />
                              </td>
                              <td className="p-3">
                                <select
                                  value={currentReason}
                                  disabled={!isSel}
                                  onChange={(e) => {
                                    const r = e.target.value;
                                    setSelectedBatches((prev) => ({
                                      ...prev,
                                      [b.batchId]: {
                                        selected: true,
                                        quantity: currentQty,
                                        reason: r,
                                      },
                                    }));
                                  }}
                                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                                >
                                  <option value="Hết hạn sử dụng">Hết hạn sử dụng</option>
                                  <option value="Thuốc ẩm mốc, biến chất">Thuốc ẩm mốc, biến chất</option>
                                  <option value="Bao bì rách nát, đổi màu">Bao bì rách nát, đổi màu</option>
                                  <option value="Thu hồi theo thông báo BYT">Thu hồi theo thông báo BYT</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom selection bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="text-xs text-slate-700">
                  <span>Đang chọn: </span>
                  <strong className="text-rose-600">{selectedSummary.count} lô thuốc</strong>
                  <span> • Tổng số lượng: </span>
                  <strong className="text-slate-900">{selectedSummary.totalQty} đơn vị</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleProceedToDisposalForm}
                    disabled={selectedSummary.count === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Lập Biên Bản Tiêu Hủy</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOẠN BIÊN BẢN TIÊU HỦY */}
          {activeTab === 'create_disposal' && (
            <div className="space-y-5">
              {/* General Form Information */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-3 border-b border-slate-100">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Thông Tin Biên Bản Tiêu Hủy Thuốc</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Mã biên bản (*)</label>
                    <input
                      type="text"
                      value={disposalCode}
                      onChange={(e) => setDisposalCode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Căn cứ Quyết định số</label>
                    <input
                      type="text"
                      value={decisionNumber}
                      onChange={(e) => setDecisionNumber(e.target.value)}
                      placeholder="VD: 15/QĐ-THCSĐT"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Ngày lập biên bản (*)</label>
                    <input
                      type="date"
                      value={disposalDate}
                      onChange={(e) => setDisposalDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 font-semibold mb-1">Địa điểm thực hiện tiêu hủy</label>
                    <input
                      type="text"
                      value={disposalLocation}
                      onChange={(e) => setDisposalLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Ngày quyết định</label>
                    <input
                      type="date"
                      value={decisionDate}
                      onChange={(e) => setDecisionDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-slate-600 font-semibold mb-1">Phương pháp xử lý tiêu hủy</label>
                    <input
                      type="text"
                      value={disposalMethod}
                      onChange={(e) => setDisposalMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Council Members */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Hội Đồng Tiêu Hủy Dược Phẩm (Theo Quyết định Hiệu Trưởng)</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {councilMembers.map((member, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-xs">
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium">{member.roleTitle}:</span>
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCouncilMembers((prev) => {
                                const next = [...prev];
                                next[idx].name = val;
                                return next;
                              });
                            }}
                            className="w-full px-2 py-1 font-bold text-slate-800 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium">Chức vụ:</span>
                          <input
                            type="text"
                            value={member.position}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCouncilMembers((prev) => {
                                const next = [...prev];
                                next[idx].position = val;
                                return next;
                              });
                            }}
                            className="w-full px-2 py-1 text-slate-700 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-rose-600" />
                    <span>Danh Mục Thuốc Tiêu Hủy ({formItems.length} mặt hàng)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('check_expiry')}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                  >
                    + Thêm thuốc từ danh sách hết hạn
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 text-center w-10">STT</th>
                        <th className="p-2.5">Mã thuốc</th>
                        <th className="p-2.5">Tên thuốc & Hoạt chất</th>
                        <th className="p-2.5">Số lô</th>
                        <th className="p-2.5">Hạn dùng</th>
                        <th className="p-2.5 text-right">SL Hủy</th>
                        <th className="p-2.5">Lý do tiêu hủy</th>
                        <th className="p-2.5 text-center w-12">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {formItems.map((item, idx) => (
                        <tr key={item.batchId} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{item.medicineCode}</td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{item.medicineName}</div>
                            {item.activeIngredient && (
                              <div className="text-[10px] text-slate-500">{item.activeIngredient}</div>
                            )}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{item.batchNumber}</td>
                          <td className="p-2.5 font-semibold text-rose-700">{formatDateVN(item.expDate)}</td>
                          <td className="p-2.5 text-right font-black text-slate-900">
                            {item.disposalQuantity} {item.unit}
                          </td>
                          <td className="p-2.5 text-slate-700">{item.reason}</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setFormItems((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-900">
                      <tr>
                        <td colSpan={5} className="p-2.5 text-center">TỔNG CỘNG</td>
                        <td className="p-2.5 text-right font-black text-rose-700">
                          {formItems.reduce((s, i) => s + i.disposalQuantity, 0)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1 text-xs">
                    Ý kiến ghi nhận của Hội đồng tiêu hủy / Ban giám sát
                  </label>
                  <textarea
                    rows={2}
                    value={witnessNotes}
                    onChange={(e) => setWitnessNotes(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                {/* Submit Actions */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSaveDisposal(false)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300"
                    >
                      Lưu Dự Thảo / Chờ Quản Trị Duyệt
                    </button>
                    {db.hasPermission('canApproveInventoryAdjustment') ? (
                      <button
                        type="button"
                        onClick={() => handleSaveDisposal(true)}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
                      >
                        Phê Duyệt Tiêu Hủy & Trừ Kho Tự Động (Quản trị)
                      </button>
                    ) : (
                      <span className="px-3.5 py-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold">
                        Nhiệm vụ Nhân viên Y tế: Lập biên bản chờ Quản trị phê duyệt trừ kho
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="px-4 py-2.5 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                  >
                    Xem danh sách đã lưu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SỔ LƯU BIÊN BẢN TIÊU HỦY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  Lịch Sử Các Biên Bản Tiêu Hủy Thuốc & Vật Tư ({disposals.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDisposalId(null);
                    setFormItems([]);
                    setActiveTab('check_expiry');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700"
                >
                  <Plus className="w-4 h-4" />
                  Lập Biên Bản Mới
                </button>
              </div>

              {disposals.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
                  <Boxes className="w-12 h-12 mx-auto text-slate-300" />
                  <div className="font-bold text-slate-600">Chưa có biên bản tiêu hủy nào được lập</div>
                  <p className="text-xs">Nhấn vào tab 1 hoặc nút bên trên để kiểm tra thuốc hết hạn và lập biên bản tiêu hủy.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {disposals.map((d) => (
                    <div
                      key={d.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {d.disposalCode}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              d.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : d.status === 'approved'
                                ? 'bg-blue-100 text-blue-800'
                                : d.status === 'cancelled'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.status === 'completed'
                              ? 'ĐÃ TIÊU HỦY & TRỪ KHO'
                              : d.status === 'approved'
                              ? 'ĐÃ DUYỆT'
                              : d.status === 'cancelled'
                              ? 'ĐÃ HỦY'
                              : 'CHỜ DUYỆT'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500">
                          Ngày tiêu hủy: <strong>{formatDateVN(d.disposalDate)}</strong>
                          {d.decisionNumber && ` • QĐ: ${d.decisionNumber}`}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-slate-400">Số mặt hàng:</span>{' '}
                          <strong>{d.items?.length || 0} thuốc</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Tổng số lượng:</span>{' '}
                          <strong className="text-slate-900">{d.totalQuantity} đơn vị</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Người lập:</span>{' '}
                          <strong>{d.createdByName}</strong>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => printDisposalReportA4(d, settings.schoolName)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            In Mẫu A4
                          </button>

                          <button
                            type="button"
                            onClick={() => exportDisposalWordA4(d, settings.schoolName)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Xuất Word (.doc)
                          </button>

                          <button
                            type="button"
                            onClick={() => exportDisposalExcel(d, settings.schoolName)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Xuất Excel (.xlsx)
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {d.status !== 'completed' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditDisposal(d)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                              >
                                Sửa
                              </button>
                              {db.hasPermission('canApproveInventoryAdjustment') &&
                                db.hasPermission('canManageTransactions') && (
                                  <button
                                    type="button"
                                    onClick={() => handleExecuteFromHistory(d)}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                                  >
                                    Xác nhận trừ kho
                                  </button>
                                )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmDisposal(d)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Xóa biên bản này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Trường THCS Đông Thạnh • Quản lý tiêu hủy dược phẩm theo Thông tư 13/2016/TTLT-BYT-BGDĐT
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmDisposal && (
        <div className="fixed inset-0 bg-slate-950/70 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Xác Nhận Xóa Biên Bản Tiêu Hủy</h3>
                <p className="text-xs text-slate-500 font-mono">{deleteConfirmDisposal.disposalCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa biên bản tiêu hủy <strong>{deleteConfirmDisposal.disposalCode}</strong> (ngày{' '}
              {formatDateVN(deleteConfirmDisposal.disposalDate)})?
            </p>

            {deleteConfirmDisposal.status === 'completed' && (
              <p className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 mt-3">
                Lưu ý: Biên bản này đã được tiêu hủy và hoàn tất trừ kho thực tế.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmDisposal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDisposal}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                Xác nhận xóa biên bản
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
