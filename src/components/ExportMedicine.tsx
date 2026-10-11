import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpRight,
  User,
  GraduationCap,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  FileText,
  Boxes,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { db, formatDateVN, getDaysRemaining } from '../services/db';
import { Medicine, InventoryTransaction, RecipientType, MedicineBatch } from '../types';

interface ExportMedicineProps {
  initialMedicine?: Medicine | null;
  onSuccess: (message: string) => void;
  onPrintTransaction: (tx: InventoryTransaction) => void;
}

export const ExportMedicine: React.FC<ExportMedicineProps> = ({
  initialMedicine,
  onSuccess,
  onPrintTransaction,
}) => {
  const [medicines, setMedicines] = useState<Medicine[]>(db.getMedicines());
  const [exportTransactions, setExportTransactions] = useState<InventoryTransaction[]>(db.getTransactions('export'));
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<InventoryTransaction | null>(null);

  useEffect(() => {
    const refreshData = () => {
      setMedicines(db.getMedicines());
      setExportTransactions(db.getTransactions('export'));
    };
    const unsub = db.subscribe(refreshData);
    return unsub;
  }, []);

  const handleDeleteTransaction = () => {
    if (!deleteConfirmTx) return;
    try {
      db.deleteTransaction(deleteConfirmTx.id, true);
      onSuccess(`Đã xóa thành công phiếu xuất ${deleteConfirmTx.transactionCode}!`);
      if (selectedTx?.id === deleteConfirmTx.id) {
        setSelectedTx(null);
      }
      setDeleteConfirmTx(null);
      setExportTransactions(db.getTransactions('export'));
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa phiếu xuất.');
      setDeleteConfirmTx(null);
    }
  };

  // Form states
  const [transactionCode, setTransactionCode] = useState(
    `PX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMedId, setSelectedMedId] = useState<string>(
    initialMedicine?.id || (medicines.length > 0 ? medicines[0].id : '')
  );

  // Batches for selected medicine
  const [batchMode, setBatchMode] = useState<'fefo_auto' | 'manual'>('fefo_auto');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  const [quantity, setQuantity] = useState<number>(1);
  const [recipientName, setRecipientName] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('student');
  const [recipientClass, setRecipientClass] = useState('7A1');
  const [purpose, setPurpose] = useState('Sốt nhẹ, nằm nghỉ tại phòng y tế');
  const [notes, setNotes] = useState('Đã cho uống thuốc kèm 1 ly nước ấm và đo lại nhiệt độ sau 20 phút');
  const [performer, setPerformer] = useState(db.getCurrentUser().fullName);

  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedTx, setSelectedTx] = useState<InventoryTransaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Staff members for quick picking
  const staffMembers = useMemo(() => db.getStaffMembers(), []);

  // Selected Medicine details
  const currentMed = medicines.find((m) => m.id === selectedMedId);
  const fefoBatches = currentMed ? db.getFEFOBatches(currentMed.id) : [];

  // Update selected batch when medicine changes
  useEffect(() => {
    if (fefoBatches.length > 0) {
      setSelectedBatchId(fefoBatches[0].id);
    } else {
      setSelectedBatchId('');
    }
  }, [selectedMedId]);

  // Handle Quick purpose suggestions
  const purposePresets = [
    'Sốt nhẹ 38.5 độ trong giờ học thể dục',
    'Đau đầu, mệt mỏi, chóng mặt',
    'Đau bụng, rối loạn tiêu hóa nhẹ',
    'Trầy xước da, xây xát tay chân khi vui chơi',
    'Say nắng nhẹ do hoạt động dưới sân trường',
    'Ho, rát họng, cảm cúm nhẹ',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!currentMed) {
      setError('Vui lòng chọn thuốc để xuất cấp phát.');
      return;
    }

    if (!recipientName.trim()) {
      setError('Vui lòng nhập họ và tên người sử dụng/nhận thuốc.');
      return;
    }

    if (!purpose.trim()) {
      setError('Mục đích sử dụng thuốc không được để trống.');
      return;
    }

    if (quantity <= 0) {
      setError('Số lượng xuất phải lớn hơn 0.');
      return;
    }

    // STRICT VALIDATION: Check stock before saving
    const currentStockAvailable = currentMed.totalStock ?? currentMed.stock ?? 0;
    if (quantity > currentStockAvailable) {
      setError(`Không đủ số lượng tồn kho để thực hiện xuất thuốc (Hiện còn ${currentStockAvailable} ${currentMed.unit}).`);
      return;
    }

    // If manual batch selected, check that specific batch
    if (batchMode === 'manual' && selectedBatchId) {
      const b = fefoBatches.find((x) => x.id === selectedBatchId);
      if (!b || b.quantity < quantity) {
        setError(
          `Không đủ số lượng tồn kho để thực hiện xuất thuốc. (Lô đã chọn chỉ còn ${b?.quantity || 0} ${currentMed.unit}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const newTx = db.exportMedicineTransaction({
        transactionCode: transactionCode.trim().toUpperCase(),
        date,
        recipientName: recipientName.trim(),
        recipientType,
        recipientClass: recipientClass.trim(),
        purpose: purpose.trim(),
        performer: performer.trim(),
        notes: notes.trim(),
        items: [
          {
            medicineId: currentMed.id,
            batchId: batchMode === 'manual' ? selectedBatchId : undefined, // auto FEFO if undefined
            quantity: Number(quantity),
          },
        ],
      });

      onSuccess(
        `ĐÃ LƯU THÀNH CÔNG! Phiếu xuất ${newTx.transactionCode} đã tự động trừ tồn kho và ghi nhận vào sổ theo dõi sử dụng.`
      );

      // Reset form
      setTransactionCode(
        `PX-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
      );
      setRecipientName('');
      setQuantity(1);
      setActiveTab('history');
      setSelectedTx(newTx);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu phiếu xuất thuốc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <ArrowUpRight className="w-4 h-4" />
            <span>Nghiệp Vụ Cấp Phát • Phòng Y Tế Học Đường</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            XUẤT / CẤP PHÁT THUỐC
          </h2>
          <p className="text-xs text-slate-500">
            Tự động trừ kho theo nguyên tắc FEFO (Hạn dùng gần nhất xuất trước) • Ghi sổ sử dụng
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + Lập Phiếu Cấp Phát
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white text-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lịch Sử Đã Cấp Phát ({exportTransactions.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form noValidate onSubmit={handleSubmit} className="space-y-6">
          {/* Error Notice */}
          {error && (
            <div
              id="alert-export-error"
              className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl text-rose-900 text-xs sm:text-sm font-bold flex items-center gap-3 shadow-xs"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Medicine Selection & FEFO Batch Engine */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-teal-600" />
                <span>I. Chọn Thuốc Và Lô Xuất (Ưu Tiên FEFO)</span>
              </h3>
              <span className="text-[11px] text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                FEFO: First Expired, First Out
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
              {/* Medicine Select */}
              <div className="sm:col-span-6">
                <label className="block font-bold text-slate-700 mb-1">
                  Chọn thuốc xuất cấp phát <span className="text-rose-600">*</span>
                </label>
                <select
                  id="select-export-medicine"
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm focus:ring-2 focus:ring-teal-500"
                >
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Tồn: {m.totalStock} {m.unit})
                    </option>
                  ))}
                </select>
                {currentMed && (
                  <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span>
                      Dạng: <strong>{currentMed.dosageForm}</strong> ({currentMed.strength})
                    </span>
                    <span>
                      Vị trí: <strong>{currentMed.storageLocation}</strong>
                    </span>
                    <span>
                      Tổng tồn kho:{' '}
                      <strong
                        className={`text-sm ${
                          currentMed.totalStock === 0
                            ? 'text-rose-600'
                            : currentMed.totalStock <= currentMed.minStock
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {currentMed.totalStock} {currentMed.unit}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  Số lượng xuất <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    id="input-export-quantity"
                    type="number"
                    min="1"
                    max={currentMed?.totalStock || 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    required
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-black text-slate-900 text-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="absolute right-3 top-3 text-slate-400 font-bold text-xs">
                    {currentMed?.unit}
                  </span>
                </div>
                {currentMed && quantity > currentMed.totalStock && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1">
                    ⚠️ Xuất vượt quá lượng tồn hiện có!
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  Ngày cấp phát <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-export-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* FEFO Batch Selection Table */}
            {currentMed && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs">
                    Kiểm tra các lô khả dụng theo nguyên tắc FEFO:
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="batchMode"
                        checked={batchMode === 'fefo_auto'}
                        onChange={() => setBatchMode('fefo_auto')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-medium">Tự động trừ theo FEFO (Được khuyên dùng)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="batchMode"
                        checked={batchMode === 'manual'}
                        onChange={() => setBatchMode('manual')}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-medium">Chọn chỉ định lô thủ công</span>
                    </label>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        {batchMode === 'manual' && <th className="p-2 text-center">Chọn</th>}
                        <th className="p-2">Số lô</th>
                        <th className="p-2">Hạn sử dụng</th>
                        <th className="p-2">Thời hạn còn lại</th>
                        <th className="p-2 text-right">Lượng tồn lô</th>
                        <th className="p-2 text-center">Đề xuất FEFO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {fefoBatches.length === 0 ? (
                        <tr>
                          <td
                            colSpan={batchMode === 'manual' ? 6 : 5}
                            className="p-3 text-center text-slate-400 font-semibold"
                          >
                            Hiện không có lô nào còn thuốc để xuất!
                          </td>
                        </tr>
                      ) : (
                        fefoBatches.map((b, idx) => {
                          const daysLeft = getDaysRemaining(b.expDate);
                          const isFirst = idx === 0;
                          return (
                            <tr
                              key={b.id}
                              className={`hover:bg-slate-50 ${
                                isFirst ? 'bg-teal-50/40' : ''
                              } ${
                                batchMode === 'manual' && selectedBatchId === b.id
                                  ? 'ring-2 ring-teal-500 bg-teal-50'
                                  : ''
                              }`}
                            >
                              {batchMode === 'manual' && (
                                <td className="p-2 text-center">
                                  <input
                                    type="radio"
                                    name="selectedBatch"
                                    checked={selectedBatchId === b.id}
                                    onChange={() => setSelectedBatchId(b.id)}
                                    className="text-teal-600 focus:ring-teal-500"
                                  />
                                </td>
                              )}
                              <td className="p-2 font-mono font-bold text-slate-900">
                                {b.batchNumber}
                              </td>
                              <td className="p-2 font-bold text-slate-800">
                                {formatDateVN(b.expDate)}
                              </td>
                              <td className="p-2">
                                <span
                                  className={`font-black ${
                                    daysLeft < 0
                                      ? 'text-rose-600'
                                      : daysLeft <= 30
                                      ? 'text-orange-600'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {daysLeft < 0
                                    ? `Đã hết hạn (${Math.abs(daysLeft)} ngày)`
                                    : `Còn ${daysLeft} ngày`}
                                </span>
                              </td>
                              <td className="p-2 text-right font-black text-slate-900">
                                {b.quantity} {currentMed.unit}
                              </td>
                              <td className="p-2 text-center">
                                {isFirst ? (
                                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-black text-[10px]">
                                    ★ Ưu tiên xuất số 1
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">Lô dự phòng sau</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Recipient Info (Đối tượng sử dụng & Mục đích) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" />
              <span>II. Thông Tin Người Sử Dụng Thuốc (Ghi Vào Sổ Theo Dõi)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
              {/* Recipient Type */}
              <div className="sm:col-span-4">
                <label className="block font-bold text-slate-700 mb-1">
                  Đối tượng sử dụng <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'student', label: 'Học sinh', icon: GraduationCap },
                    { id: 'teacher', label: 'Giáo viên', icon: Briefcase },
                    { id: 'staff', label: 'Nhân viên', icon: User },
                    { id: 'other', label: 'Khác', icon: HelpCircle },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRecipientType(item.id as RecipientType)}
                        className={`p-2 rounded-xl border text-center flex items-center justify-center gap-1.5 font-bold transition-all ${
                          recipientType === item.id
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recipient Full Name */}
              <div className="sm:col-span-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">
                    Họ và tên người sử dụng <span className="text-rose-600">*</span>
                  </label>
                  {(recipientType === 'teacher' || recipientType === 'staff') && staffMembers.length > 0 && (
                    <span className="text-[10px] text-teal-700 font-bold">Chọn từ danh sách GV & NV</span>
                  )}
                </div>

                {(recipientType === 'teacher' || recipientType === 'staff') && (
                  <div className="mb-2">
                    <select
                      className="w-full p-2 text-xs rounded-xl border border-teal-300 bg-teal-50/50 font-semibold text-teal-950 focus:ring-2 focus:ring-teal-500"
                      onChange={(e) => {
                        const sm = staffMembers.find((s) => s.id === e.target.value);
                        if (sm) {
                          setRecipientName(sm.fullName);
                          setRecipientClass(sm.department);
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        ⚡ Chọn nhanh Giáo viên / Nhân viên THCS Đông Thạnh...
                      </option>
                      {staffMembers
                        .filter((s) => (recipientType === 'teacher' ? (s.roleCategory === 'teacher' || s.roleType === 'teacher') : true))
                        .map((sm) => (
                          <option key={sm.id} value={sm.id}>
                            {sm.staffCode} - {sm.fullName} ({sm.position} • {sm.department})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <input
                  id="input-export-recipient-name"
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="VD: Nguyễn Văn Nam hoặc Cô Hoàng Thị Lan..."
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Class / Department */}
              <div className="sm:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  {recipientType === 'student' ? 'Lớp học' : 'Bộ phận / Tổ chuyên môn'}{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-export-recipient-class"
                  type="text"
                  value={recipientClass}
                  onChange={(e) => setRecipientClass(e.target.value)}
                  placeholder={recipientType === 'student' ? 'VD: 7A1, 8A3, 9A2' : 'VD: Tổ Toán - Tin'}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Purpose & Presets */}
            <div className="text-xs space-y-1.5">
              <label className="block font-bold text-slate-700">
                Mục đích sử dụng / Triệu chứng lâm sàng sơ bộ{' '}
                <span className="text-rose-600">*</span>
              </label>
              <input
                id="input-export-purpose"
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="VD: Sốt 38.5 độ, chóng mặt, buồn nôn, đau bụng..."
                required
                className="w-full p-2.5 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-teal-500"
              />

              {/* Purpose chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-slate-400 text-[10px]">Gợi ý nhanh:</span>
                {(recipientType === 'teacher' || recipientType === 'staff'
                  ? [
                      'Viêm họng / Khản tiếng khi giảng bài',
                      'Đau đầu / Căng thẳng tiết dạy',
                      'Đau mỏi vai gáy / Cột sống',
                      'Tăng huyết áp / Mệt mỏi',
                      'Đau dạ dày / Khó tiêu',
                      'Chóng mặt / Hạ đường huyết',
                    ]
                  : purposePresets
                ).map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPurpose(preset)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-teal-100 hover:text-teal-900 text-slate-600 text-[10px] transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes & Performer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Người thực hiện (Cán bộ y tế phụ trách) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="input-export-performer"
                  type="text"
                  value={performer}
                  onChange={(e) => setPerformer(e.target.value)}
                  required
                  className="w-full p-2 rounded-xl border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ghi chú theo dõi & Diễn biến
                </label>
                <input
                  id="input-export-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú thêm về học sinh hoặc dặn dò phụ huynh..."
                  className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="space-y-3 pt-2">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                id="btn-save-export-transaction"
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <span>{isSubmitting ? 'ĐANG LƯU PHIẾU XUẤT...' : 'LƯU PHIẾU XUẤT (TRỪ TỒN KHO)'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* History of Exports */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                LỊCH SỬ XUẤT CẤP PHÁT THUỐC PHÒNG Y TẾ
              </h3>
              <p className="text-xs text-slate-500">
                Toàn bộ dữ liệu cấp phát cho học sinh, giáo viên đã tự động khấu trừ kho và lưu nhật ký
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-bold text-xs hover:bg-teal-700"
            >
              + Cấp phát mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Số phiếu</th>
                  <th className="p-3">Ngày dùng</th>
                  <th className="p-3">Người sử dụng</th>
                  <th className="p-3">Lớp / Bộ phận</th>
                  <th className="p-3">Thuốc cấp phát & Lô</th>
                  <th className="p-3 text-right">Số lượng</th>
                  <th className="p-3">Mục đích sử dụng</th>
                  <th className="p-3 text-center">In / Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exportTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Chưa có phiếu xuất cấp phát nào.
                    </td>
                  </tr>
                ) : (
                  exportTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-teal-800">
                        {tx.transactionCode}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {formatDateVN(tx.date)}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {tx.recipientName}
                        <span className="block text-[10px] font-normal text-slate-500">
                          {tx.recipientType === 'student'
                            ? 'Học sinh'
                            : tx.recipientType === 'teacher'
                            ? 'Giáo viên'
                            : 'Nhân viên'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {tx.recipientClass || '---'}
                      </td>
                      <td className="p-3">
                        {tx.items.map((it, i) => (
                          <div key={i}>
                            <span className="font-semibold text-slate-900">{it.medicineName}</span>
                            <span className="block font-mono text-[10px] text-slate-500">
                              Lô: {it.batchNumber} (HSD: {formatDateVN(it.expDate)})
                            </span>
                          </div>
                        ))}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900">
                        {tx.items.reduce((s, it) => s + it.quantity, 0)}{' '}
                        <span className="text-[10px] font-normal text-slate-500">
                          {tx.items[0]?.unit}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 max-w-[200px]">
                        <span className="line-clamp-2">{tx.purpose}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium cursor-pointer"
                          >
                            Xem
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintTransaction(tx)}
                            className="p-1 rounded text-slate-500 hover:text-teal-700 hover:bg-teal-50 cursor-pointer"
                            title="In phiếu xuất A4"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTx(tx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Xóa phiếu xuất này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-teal-700">
                  CHI TIẾT PHIẾU XUẤT CẤP PHÁT
                </span>
                <h3 className="text-base font-black text-slate-900">{selectedTx.transactionCode}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Ngày cấp phát:</span>
                  <strong className="text-slate-800">{formatDateVN(selectedTx.date)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Người nhận thuốc:</span>
                  <strong className="text-slate-900">{selectedTx.recipientName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Lớp / Bộ phận:</span>
                  <strong className="text-slate-800">{selectedTx.recipientClass || '---'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Cán bộ y tế thực hiện:</span>
                  <strong className="text-slate-800">{selectedTx.performer}</strong>
                </div>
              </div>

              <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-xl">
                <span className="text-slate-500 block text-[10px]">Mục đích sử dụng:</span>
                <p className="font-semibold text-teal-900">{selectedTx.purpose}</p>
                {selectedTx.notes && (
                  <p className="text-[11px] text-slate-600 mt-1">Ghi chú: {selectedTx.notes}</p>
                )}
              </div>

              <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Thuốc</th>
                    <th className="p-2">Số lô</th>
                    <th className="p-2">Hạn sử dụng</th>
                    <th className="p-2 text-right">Số lượng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedTx.items.map((item, i) => (
                    <tr key={i}>
                      <td className="p-2 font-bold text-slate-900">{item.medicineName}</td>
                      <td className="p-2 font-mono">{item.batchNumber}</td>
                      <td className="p-2">{formatDateVN(item.expDate)}</td>
                      <td className="p-2 text-right font-black text-teal-800">
                        {item.quantity} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onPrintTransaction(selectedTx);
                    setSelectedTx(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>In phiếu xuất A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmTx(selectedTx);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 border border-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Xóa phiếu xuất</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-xl cursor-pointer hover:bg-slate-900"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Transaction Confirmation Modal */}
      {deleteConfirmTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-50 rounded-full border border-rose-100">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa phiếu xuất cấp phát</h3>
                <p className="text-xs text-slate-500 font-mono">{deleteConfirmTx.transactionCode}</p>
              </div>
            </div>

            <div className="text-sm text-slate-600 space-y-2 mb-6">
              <p>
                Bạn có chắc chắn muốn xóa phiếu xuất <strong>{deleteConfirmTx.transactionCode}</strong> (ngày{' '}
                {formatDateVN(deleteConfirmTx.date)})?
              </p>
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-100">
                <div><strong>Người nhận:</strong> {deleteConfirmTx.recipientName || 'Học sinh / CBGV'}</div>
                <div><strong>Mục đích:</strong> {deleteConfirmTx.purpose}</div>
                <div><strong>Số lượng mặt hàng:</strong> {deleteConfirmTx.items.length} thuốc</div>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs">
                ℹ️ <strong>Cảnh báo hoàn kho:</strong> Khi xóa phiếu xuất này, số lượng thuốc tương ứng của từng lô sẽ tự động được hoàn trả cộng lại vào tồn kho thực tế của hệ thống.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmTx(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteTransaction}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                Đồng ý xóa phiếu xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
