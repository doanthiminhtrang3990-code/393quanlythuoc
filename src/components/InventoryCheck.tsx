import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Users,
  X,
  Save,
  Check,
  RotateCcw,
  Sliders,
  Info,
  Trash2,
} from 'lucide-react';
import { db } from '../services/db';
import { InventoryCheck, InventoryCheckItem, MedicineBatch, Medicine } from '../types';
import { formatDateVN, formatTime24H, normalizeManualTime24H } from '../utils/helpers';
import { exportInventoryCheckExcel } from '../services/excelService';
import { printInventoryCheckA4 } from '../services/printA4Service';

export const InventoryCheckComponent: React.FC = () => {
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [settings, setSettings] = useState(db.getSettings());

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewCheck, setViewCheck] = useState<InventoryCheck | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState<InventoryCheck | null>(null);
  const [deleteConfirmCheck, setDeleteConfirmCheck] = useState<InventoryCheck | null>(null);
  const [confirmCheckTarget, setConfirmCheckTarget] = useState<InventoryCheck | null>(null);
  const [adjustReason, setAdjustReason] = useState('');
  const [approverName, setApproverName] = useState(db.getCurrentUser()?.fullName || 'Cán bộ Y tế');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteCheckConfirm = () => {
    if (!deleteConfirmCheck) return;
    try {
      db.deleteInventoryCheck(deleteConfirmCheck.id);
      showToast(`Đã xóa biên bản kiểm kê ${deleteConfirmCheck.checkCode} thành công!`);
      if (viewCheck?.id === deleteConfirmCheck.id) {
        setViewCheck(null);
      }
      setDeleteConfirmCheck(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa biên bản kiểm kê.');
      setDeleteConfirmCheck(null);
    }
  };

  const getNowTime24H = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // New Check Form State
  const [formCheckCode, setFormCheckCode] = useState('');
  const [formCheckDate, setFormCheckDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCheckTime, setFormCheckTime] = useState(getNowTime24H);
  const [formPerformer, setFormPerformer] = useState(db.getCurrentUser()?.fullName || 'Cán bộ Y tế');
  const [formParticipants, setFormParticipants] = useState<string>([
    `${db.getCurrentUser()?.fullName || 'Cán bộ Y tế'} (Cán bộ Y tế)`,
    'Đại diện Ban Giám Hiệu',
    'Kế toán / Thủ kho',
  ].join('\n'));
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState<InventoryCheckItem[]>([]);
  const [itemFilterSearch, setItemFilterSearch] = useState('');

  const loadData = () => {
    setChecks(db.getInventoryChecks());
    setMedicines(db.getMedicines());
    setBatches(db.getBatches());
    setSettings(db.getSettings());
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(loadData);
    return unsub;
  }, []);

  // Initialize new check items from all current active batches
  const handleOpenCreate = () => {
    const nextCode = db.getNextCheckCode();
    setFormCheckCode(nextCode);
    setFormCheckDate(new Date().toISOString().split('T')[0]);
    setFormCheckTime(getNowTime24H());
    setFormPerformer(db.getCurrentUser().fullName);
    setFormParticipants([
      `${db.getCurrentUser().fullName} (Cán bộ Y tế)`,
      'Đại diện Ban Giám Hiệu',
      'Kế toán / Thủ kho',
    ].join('\n'));
    setFormNotes('');
    setItemFilterSearch('');

    const currentBatches = db.getBatches();
    const currentMeds = db.getMedicines();

    const items: InventoryCheckItem[] = currentBatches.map((b) => {
      const med = currentMeds.find((m) => m.id === b.medicineId);
      return {
        id: 'item-' + b.id,
        medicineId: b.medicineId,
        medicineCode: med?.code || '',
        medicineName: med?.name || 'Thuốc không xác định',
        batchId: b.id,
        batchNumber: b.batchNumber,
        expDate: b.expDate,
        unit: med?.unit || 'Đơn vị',
        systemQuantity: b.quantity,
        bookQuantity: b.quantity,
        actualQuantity: b.quantity, // Default to bookQuantity so user only edits differences
        difference: 0,
        qualityStatus: 'good',
        reason: '',
      };
    });

    setFormItems(items);
    setShowCreateModal(true);
  };

  const handleItemQuantityChange = (batchId: string, actualVal: number) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.batchId === batchId) {
          const qty = isNaN(actualVal) || actualVal < 0 ? 0 : actualVal;
          const diff = qty - item.bookQuantity;
          return {
            ...item,
            actualQuantity: qty,
            difference: diff,
          };
        }
        return item;
      })
    );
  };

  const handleItemQualityChange = (batchId: string, status: 'good' | 'damaged' | 'expired') => {
    setFormItems((prev) =>
      prev.map((item) => (item.batchId === batchId ? { ...item, qualityStatus: status } : item))
    );
  };

  const handleItemReasonChange = (batchId: string, reason: string) => {
    setFormItems((prev) =>
      prev.map((item) => (item.batchId === batchId ? { ...item, reason } : item))
    );
  };

  const handleSaveCheck = (status: 'draft' | 'confirmed') => {
    try {
      const participantsList = (formParticipants || '')
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const saved = db.saveInventoryCheck({
        checkCode: formCheckCode,
        checkDate: formCheckDate,
        checkTime: normalizeManualTime24H(formCheckTime) || getNowTime24H(),
        performer: formPerformer,
        participants: participantsList,
        notes: formNotes,
        status: status,
        confirmedBy: status === 'confirmed' ? formPerformer : undefined,
        confirmedAt: status === 'confirmed' ? new Date().toISOString() : undefined,
        items: formItems,
      });

      setShowCreateModal(false);
      setViewCheck(saved);
      showToast(`Đã lưu biên bản kiểm kê ${saved.checkCode} thành công!`);
    } catch (err: any) {
      showToast(`Lỗi lưu phiếu kiểm kê: ${err.message}`);
    }
  };

  const handleConfirmCheck = (check: InventoryCheck) => {
    setConfirmCheckTarget(check);
  };

  const executeConfirmCheck = () => {
    if (!confirmCheckTarget) return;
    try {
      const updated = db.confirmInventoryCheck(confirmCheckTarget.id, db.getCurrentUser().fullName);
      setViewCheck(updated);
      showToast(`Đã xác nhận biên bản kiểm kê "${confirmCheckTarget.checkCode}"! Sẵn sàng cho bước điều chỉnh kho.`);
    } catch (err: any) {
      showToast(`Lỗi xác nhận: ${err.message}`);
    } finally {
      setConfirmCheckTarget(null);
    }
  };

  const handleAdjustStock = () => {
    if (!showAdjustModal) return;
    try {
      const updated = db.adjustInventoryFromCheck(
        showAdjustModal.id,
        approverName || db.getCurrentUser().fullName,
        adjustReason
      );
      setShowAdjustModal(null);
      setViewCheck(updated);
      showToast('Đã hoàn tất điều chỉnh tồn kho thực tế theo biên bản kiểm kê!');
    } catch (err: any) {
      showToast(`Lỗi điều chỉnh tồn kho: ${err.message}`);
    }
  };

  // Filtered list
  const filteredChecks = checks.filter((c) => {
    const matchesSearch =
      c.checkCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.performer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="inventory-check-module" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-700 rounded-lg border border-sky-100">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Kiểm Kê Thuốc & Vật Tư Y Tế Định Kỳ
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Quy trình 2 bước chuẩn: Lập biên bản thực kiểm đối chiếu sổ sách và Phê duyệt điều chỉnh tồn kho thực tế
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-create-inventory-check"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Lập Biên Bản Kiểm Kê Mới
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-check"
            type="text"
            placeholder="Tìm theo mã kiểm kê, người kiểm kê..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              id="select-filter-check-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Bản dự thảo</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="adjusted">Đã cân bằng kho</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table of Inventory Checks */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Mã kiểm kê</th>
                <th className="py-3 px-4">Thời gian kiểm kê</th>
                <th className="py-3 px-4">Người lập / Hội đồng</th>
                <th className="py-3 px-4 text-center">Số mặt hàng</th>
                <th className="py-3 px-4 text-center">Chênh lệch</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    Chưa có biên bản kiểm kê nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredChecks.map((check) => {
                  const discrepancyCount = check.items.filter((it) => it.difference !== 0).length;
                  return (
                    <tr key={check.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-sky-700">
                        {check.checkCode}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{formatDateVN(check.checkDate)}</div>
                        <div className="text-xs text-slate-400 font-mono">{check.checkTime ? formatTime24H(check.checkTime) : '---'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-medium">{check.performer}</div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">
                          {check.participants?.slice(0, 2).join(', ')}
                          {(check.participants?.length || 0) > 2 ? '...' : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">
                        {check.items.length} lô
                      </td>
                      <td className="py-3 px-4 text-center">
                        {discrepancyCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {discrepancyCount} mục lệch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3.5 h-3.5" />
                            Khớp 100%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {check.status === 'adjusted' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            <RotateCcw className="w-3.5 h-3.5" />
                            Đã cân bằng kho
                          </span>
                        ) : check.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã xác nhận
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Dự thảo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            title="Xem chi tiết & Thao tác"
                            onClick={() => setViewCheck(check)}
                            className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="In Mẫu A4 / Xuất PDF"
                            onClick={() => printInventoryCheckA4(check, settings.schoolName)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            title="Xuất file Excel"
                            onClick={() => exportInventoryCheckExcel(check)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <button
                            title="Xóa biên bản kiểm kê này"
                            onClick={() => setDeleteConfirmCheck(check)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
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

      {/* Modal: View & Actions for a Check */}
      {viewCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Biên Bản Kiểm Kê: {viewCheck.checkCode}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ngày {formatDateVN(viewCheck.checkDate)} lúc {viewCheck.checkTime ? formatTime24H(viewCheck.checkTime) : '---'} | Người lập: {viewCheck.performer}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewCheck(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Status and Action banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase">Trạng thái hồ sơ</div>
                  <div className="flex items-center gap-2 mt-1">
                    {viewCheck.status === 'adjusted' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                        <RotateCcw className="w-3.5 h-3.5" />
                        Đã cân bằng số liệu tồn kho (Người duyệt: {viewCheck.adjustedBy || 'BGH'})
                      </span>
                    ) : viewCheck.status === 'confirmed' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã xác nhận kiểm kê (Sẵn sàng điều chỉnh kho)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Bản dự thảo (Cần xác nhận)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => printInventoryCheckA4(viewCheck, settings.schoolName)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 rounded-lg"
                  >
                    <Printer className="w-4 h-4 text-indigo-600" />
                    In Mẫu Sổ A4 / PDF
                  </button>
                  <button
                    onClick={() => exportInventoryCheckExcel(viewCheck)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-300 rounded-lg"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Xuất File Excel
                  </button>

                  {/* Workflow buttons */}
                  {viewCheck.status === 'draft' && (
                    <button
                      onClick={() => handleConfirmCheck(viewCheck)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Bước 1: Xác Nhận Kiểm Kê
                    </button>
                  )}

                  {viewCheck.status !== 'adjusted' && (
                    db.hasPermission('canApproveInventoryAdjustment') ? (
                      <button
                        onClick={() => setShowAdjustModal(viewCheck)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                      >
                        <Sliders className="w-4 h-4" />
                        Bước 2: Phê Duyệt Cân Bằng Kho (Quản trị)
                      </button>
                    ) : (
                      <span
                        title="Chỉ nhiệm vụ Quản trị mới có quyền phê duyệt điều chỉnh chênh lệch tồn kho"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold rounded-lg"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-400" />
                        Chờ Quản trị phê duyệt cân bằng kho
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Members */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-700 mb-1">Thành viên Hội đồng kiểm kê:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                    {viewCheck.participants?.map((p, idx) => (
                      <li key={idx}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-semibold text-slate-700 mb-1">Ghi chú & Đề xuất:</div>
                  <p className="text-slate-600">{viewCheck.notes || 'Không có ghi chú bổ sung.'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 font-semibold text-xs text-slate-700 uppercase">
                  Chi tiết đối chiếu số liệu kiểm kê ({viewCheck.items.length} lô thuốc/vật tư)
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                        <th className="py-2.5 px-3">STT</th>
                        <th className="py-2.5 px-3">Tên thuốc</th>
                        <th className="py-2.5 px-3">Số lô</th>
                        <th className="py-2.5 px-3">Hạn dùng</th>
                        <th className="py-2.5 px-3 text-center">ĐVT</th>
                        <th className="py-2.5 px-3 text-right">Tồn sổ sách</th>
                        <th className="py-2.5 px-3 text-right">Thực tế</th>
                        <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                        <th className="py-2.5 px-3 text-center">Chất lượng</th>
                        <th className="py-2.5 px-3">Lý do & Xử lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewCheck.items.map((it, i) => (
                        <tr
                          key={it.id || i}
                          className={it.difference !== 0 ? 'bg-amber-50/50' : 'hover:bg-slate-50'}
                        >
                          <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            {it.medicineName}
                            <span className="text-slate-400 block text-[10px]">{it.medicineCode}</span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-sky-700">{it.batchNumber}</td>
                          <td className="py-2 px-3">{formatDateVN(it.expDate)}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-700">{it.bookQuantity}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">{it.actualQuantity}</td>
                          <td
                            className={`py-2 px-3 text-right font-bold ${
                              it.difference < 0 ? 'text-red-600' : it.difference > 0 ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            {it.difference > 0 ? '+' + it.difference : it.difference}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                              {it.qualityStatus === 'damaged' ? 'Kém/Hỏng' : it.qualityStatus === 'expired' ? 'Hết hạn' : 'Tốt'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">
                            {it.reason || (it.difference === 0 ? 'Khớp sổ' : '---')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmCheck(viewCheck);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                Xóa biên bản kiểm kê này
              </button>
              <button
                onClick={() => setViewCheck(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium rounded-lg cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Record New Inventory Check */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-sky-50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-600 text-white rounded-lg">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Lập Phiếu Kiểm Kê Kho Thực Tế</h2>
                  <p className="text-xs text-slate-500">
                    Đối chiếu số tồn trên sổ sách với số lượng kiểm đếm thực tế trong tủ y tế
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm">
              {/* Top Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mã kiểm kê</label>
                  <input
                    type="text"
                    value={formCheckCode}
                    onChange={(e) => setFormCheckCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 font-semibold text-sky-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày kiểm kê</label>
                  <input
                    type="date"
                    value={formCheckDate}
                    onChange={(e) => setFormCheckDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ kiểm kê (24h)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formCheckTime}
                      onChange={(e) => setFormCheckTime(e.target.value)}
                      onBlur={() => {
                        if (formCheckTime.trim()) {
                          setFormCheckTime(normalizeManualTime24H(formCheckTime));
                        }
                      }}
                      placeholder="14:30"
                      maxLength={8}
                      className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setFormCheckTime(getNowTime24H())}
                      title="Điền giờ hiện tại"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cán bộ lập</label>
                  <input
                    type="text"
                    value={formPerformer}
                    onChange={(e) => setFormPerformer(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Thành viên Hội đồng kiểm kê (mỗi người 1 dòng)
                  </label>
                  <textarea
                    rows={3}
                    value={formParticipants}
                    onChange={(e) => setFormParticipants(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="Nhập danh sách thành viên tham gia kiểm kê..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ghi chú / Đề xuất xử lý chung
                  </label>
                  <textarea
                    rows={3}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    placeholder="Ghi chú về điều kiện bảo quản, nhiệt độ, độ ẩm tủ thuốc..."
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="font-semibold text-xs text-slate-700 uppercase">
                    Bảng kiểm đếm số lượng thực tế ({formItems.length} lô thuốc)
                  </div>
                  <div className="w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Lọc tên thuốc, số lô..."
                      value={itemFilterSearch}
                      onChange={(e) => setItemFilterSearch(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded bg-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-700">
                        <th className="py-2.5 px-3">Tên thuốc</th>
                        <th className="py-2.5 px-3">Số lô</th>
                        <th className="py-2.5 px-3">Hạn dùng</th>
                        <th className="py-2.5 px-3 text-center">ĐVT</th>
                        <th className="py-2.5 px-3 text-right">Tồn sổ sách</th>
                        <th className="py-2.5 px-3 text-right w-24">Thực kiểm (*)</th>
                        <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                        <th className="py-2.5 px-3 w-32">Chất lượng</th>
                        <th className="py-2.5 px-3">Lý do chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {formItems
                        .filter(
                          (it) =>
                            it.medicineName.toLowerCase().includes(itemFilterSearch.toLowerCase()) ||
                            it.batchNumber.toLowerCase().includes(itemFilterSearch.toLowerCase())
                        )
                        .map((it) => (
                          <tr
                            key={it.batchId}
                            className={it.difference !== 0 ? 'bg-amber-50/60' : 'hover:bg-slate-50'}
                          >
                            <td className="py-2 px-3 font-medium text-slate-800">
                              {it.medicineName}
                            </td>
                            <td className="py-2 px-3 font-semibold text-sky-700">{it.batchNumber}</td>
                            <td className="py-2 px-3">{formatDateVN(it.expDate)}</td>
                            <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                            <td className="py-2 px-3 text-right font-medium text-slate-700">
                              {it.bookQuantity}
                            </td>
                            <td className="py-1 px-3 text-right">
                              <input
                                type="number"
                                min={0}
                                value={it.actualQuantity}
                                onChange={(e) =>
                                  handleItemQuantityChange(it.batchId, parseInt(e.target.value, 10))
                                }
                                className="w-20 px-2 py-1 border border-slate-300 rounded text-right font-bold text-slate-900 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                              />
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-bold ${
                                it.difference < 0
                                  ? 'text-red-600'
                                  : it.difference > 0
                                  ? 'text-emerald-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              {it.difference > 0 ? '+' + it.difference : it.difference}
                            </td>
                            <td className="py-1 px-3">
                              <select
                                value={it.qualityStatus}
                                onChange={(e: any) =>
                                  handleItemQualityChange(it.batchId, e.target.value)
                                }
                                className="w-full text-[11px] border border-slate-300 rounded px-1.5 py-1"
                              >
                                <option value="good">Tốt</option>
                                <option value="damaged">Hỏng / Kém</option>
                                <option value="expired">Hết hạn dùng</option>
                              </select>
                            </td>
                            <td className="py-1 px-3">
                              <input
                                type="text"
                                placeholder={it.difference !== 0 ? 'Nhập nguyên nhân lệch...' : ''}
                                value={it.reason || ''}
                                onChange={(e) => handleItemReasonChange(it.batchId, e.target.value)}
                                className="w-full text-xs px-2 py-1 border border-slate-200 rounded"
                              />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-xl">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-sky-600" />
                Số lượng lệch phát hiện: <strong>{formItems.filter((i) => i.difference !== 0).length}</strong> lô
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCheck('draft')}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Lưu Bản Dự Thảo
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCheck('confirmed')}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Lưu & Xác Nhận Kiểm Kê
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Stock Adjustment (Step 2) */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-lg">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cân Bằng Tồn Kho Thực Tế Theo Kiểm Kê
                </h3>
                <p className="text-xs text-slate-500">
                  Biên bản: <strong>{showAdjustModal.checkCode}</strong>
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠️ Chú ý về nghiệp vụ kho:</p>
              <p>
                Thao tác này sẽ tự động cập nhật lại số lượng tồn kho của các lô thuốc/vật tư có chênh lệch theo đúng số lượng thực tế kiểm kê.
              </p>
              <p>Hệ thống sẽ ghi log vết kiểm toán chi tiết và cập nhật trạng thái biên bản thành <strong>Đã cân bằng kho</strong>.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Người phê duyệt điều chỉnh
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lý do / Quyết định xử lý chênh lệch
                </label>
                <textarea
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ví dụ: Theo kết luận cuộc họp kiểm kê định kỳ cuối học kỳ..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAdjustModal(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleAdjustStock}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Đồng Ý Cân Bằng Tồn Kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Inventory Check Confirmation Modal */}
      {deleteConfirmCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-50 rounded-full border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa biên bản kiểm kê</h3>
                <p className="text-xs text-slate-500 font-mono">{deleteConfirmCheck.checkCode}</p>
              </div>
            </div>

            <div className="text-sm text-slate-600 space-y-2 mb-6">
              <p>
                Bạn có chắc chắn muốn xóa biên bản kiểm kê <strong>{deleteConfirmCheck.checkCode}</strong> (ngày{' '}
                {formatDateVN(deleteConfirmCheck.checkDate)})?
              </p>
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-100">
                <div><strong>Người lập:</strong> {deleteConfirmCheck.performer}</div>
                <div><strong>Số lượng mặt hàng kiểm kê:</strong> {deleteConfirmCheck.items.length} mục</div>
                <div><strong>Trạng thái:</strong> {deleteConfirmCheck.status === 'adjusted' ? 'Đã cân bằng kho' : deleteConfirmCheck.status === 'confirmed' ? 'Đã xác nhận' : 'Dự thảo'}</div>
              </div>
              {deleteConfirmCheck.status === 'adjusted' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                  ⚠️ <strong>Lưu ý:</strong> Biên bản này đã thực hiện cân bằng kho trước đó. Việc xóa biên bản sẽ xóa hồ sơ lưu trữ kiểm kê này khỏi hệ thống.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmCheck(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteCheckConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                Đồng ý xóa biên bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal: Confirm Inventory Check */}
      {confirmCheckTarget && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-purple-700">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-purple-700" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Xác Nhận Biên Bản Kiểm Kê</h3>
                <p className="text-xs text-purple-700 font-semibold font-mono">{confirmCheckTarget.checkCode}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xác nhận biên bản kiểm kê ngày <strong>{formatDateVN(confirmCheckTarget.checkDate || (confirmCheckTarget as any).date)}</strong>? Sau khi xác nhận, biên bản sẽ chuyển sang trạng thái sẵn sàng để Ban Giám Hiệu phê duyệt và điều chỉnh tồn kho.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmCheckTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeConfirmCheck}
                className="px-4 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Xác nhận biên bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
