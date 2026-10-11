import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  Plus,
  Trash2,
  FileText,
  Printer,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Building2,
  Clock,
  ExternalLink,
  X,
  Sparkles,
} from 'lucide-react';
import { db, formatDateVN } from '../services/db';
import { Medicine, InventoryTransaction } from '../types';
import { MedicineModal } from './MedicineModal';

interface ImportMedicineProps {
  initialMedicine?: Medicine | null;
  onSuccess: (message: string) => void;
  onPrintTransaction: (tx: InventoryTransaction) => void;
}

interface ImportRow {
  medicineId: string;
  medicineName: string;
  unit: string;
  activeIngredient: string;
  dosageForm: string;
  batchNumber: string;
  mfgDate: string;
  expDate: string;
  quantity: number;
  unitPrice: number;
  storageLocation: string;
  isNewMedicine?: boolean;
}

export const ImportMedicine: React.FC<ImportMedicineProps> = ({
  initialMedicine,
  onSuccess,
  onPrintTransaction,
}) => {
  const [medicines, setMedicines] = useState<Medicine[]>(db.getMedicines());
  const [suppliers, setSuppliers] = useState(db.getSuppliers());
  const [importTransactions, setImportTransactions] = useState<InventoryTransaction[]>(db.getTransactions('import'));
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<InventoryTransaction | null>(null);

  useEffect(() => {
    const refreshData = () => {
      setMedicines(db.getMedicines());
      setSuppliers(db.getSuppliers());
      setImportTransactions(db.getTransactions('import'));
    };
    const unsub = db.subscribe(refreshData);
    return unsub;
  }, []);

  const handleDeleteTransaction = () => {
    if (!deleteConfirmTx) return;
    try {
      db.deleteTransaction(deleteConfirmTx.id, true);
      onSuccess(`Đã xóa thành công phiếu nhập ${deleteConfirmTx.transactionCode}!`);
      if (selectedTx?.id === deleteConfirmTx.id) {
        setSelectedTx(null);
      }
      setDeleteConfirmTx(null);
      setImportTransactions(db.getTransactions('import'));
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa phiếu nhập.');
      setDeleteConfirmTx(null);
    }
  };

  // Form State
  const [transactionCode, setTransactionCode] = useState(
    `PN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [source, setSource] = useState('Ngân sách y tế trường học năm học 2026-2027');
  const [supplierName, setSupplierName] = useState(() => {
    const sups = db.getSuppliers();
    return sups.length > 0 ? sups[0].name : 'Trạm Y tế Xã Đông Thạnh';
  });
  const [deliverer, setDeliverer] = useState('');
  const [receiver, setReceiver] = useState(() => db.getCurrentUser()?.fullName || 'Cán bộ y tế');
  const [notes, setNotes] = useState('');
  const [showAddMedModal, setShowAddMedModal] = useState(false);

  // Rows of medicines to import
  const [items, setItems] = useState<ImportRow[]>(() => {
    const defaultMed = initialMedicine || medicines[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 2);

    return [
      {
        medicineId: defaultMed ? defaultMed.id : '',
        medicineName: defaultMed ? defaultMed.name : '',
        unit: defaultMed ? defaultMed.unit : 'Viên',
        activeIngredient: defaultMed ? defaultMed.activeIngredient : '',
        dosageForm: defaultMed ? defaultMed.dosageForm : 'Viên nén',
        batchNumber: `L${new Date().getFullYear().toString().slice(-2)}${String(
          new Date().getMonth() + 1
        ).padStart(2, '0')}-01`,
        mfgDate: new Date().toISOString().split('T')[0],
        expDate: nextYear.toISOString().split('T')[0],
        quantity: 50,
        unitPrice: defaultMed ? defaultMed.unitPrice : 1000,
        storageLocation: defaultMed ? defaultMed.storageLocation : 'Tủ A',
        isNewMedicine: false,
      },
    ];
  });

  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [selectedTx, setSelectedTx] = useState<InventoryTransaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Grand total calculation
  const grandTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Handle adding new item row
  const handleAddRow = () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 2);

    setItems([
      ...items,
      {
        medicineId: '',
        medicineName: '',
        unit: 'Viên',
        activeIngredient: '',
        dosageForm: 'Viên nén',
        batchNumber: `L${new Date().getFullYear().toString().slice(-2)}${String(
          new Date().getMonth() + 1
        ).padStart(2, '0')}-0${items.length + 1}`,
        mfgDate: new Date().toISOString().split('T')[0],
        expDate: nextYear.toISOString().split('T')[0],
        quantity: 50,
        unitPrice: 1000,
        storageLocation: 'Tủ A',
        isNewMedicine: false,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      // Thay vì chặn không cho xóa, xóa sạch dòng hiện tại để người dùng nhập mới dễ dàng
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 2);
      setItems([
        {
          medicineId: '',
          medicineName: '',
          unit: 'Viên',
          activeIngredient: '',
          dosageForm: 'Viên nén',
          batchNumber: `L${new Date().getFullYear().toString().slice(-2)}${String(
            new Date().getMonth() + 1
          ).padStart(2, '0')}-01`,
          mfgDate: new Date().toISOString().split('T')[0],
          expDate: nextYear.toISOString().split('T')[0],
          quantity: 50,
          unitPrice: 1000,
          storageLocation: 'Tủ A',
          isNewMedicine: false,
        },
      ]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleMedicineNameChange = (index: number, val: string) => {
    const newItems = [...items];
    const trimmed = val.trim();

    // Kiểm tra xem tên gõ vào có trùng với thuốc đã có trong danh mục không
    const matched = medicines.find(
      (m) =>
        m.name.toLowerCase() === trimmed.toLowerCase() ||
        m.code.toLowerCase() === trimmed.toLowerCase() ||
        m.id === val
    );

    if (matched) {
      newItems[index].medicineId = matched.id;
      newItems[index].medicineName = matched.name;
      newItems[index].unit = matched.unit;
      newItems[index].activeIngredient = matched.activeIngredient;
      newItems[index].dosageForm = matched.dosageForm;
      newItems[index].unitPrice = matched.unitPrice;
      newItems[index].storageLocation = matched.storageLocation;
      newItems[index].isNewMedicine = false;
    } else {
      newItems[index].medicineId = '';
      newItems[index].medicineName = val;
      newItems[index].isNewMedicine = trimmed.length > 0;
      if (!newItems[index].unit) newItems[index].unit = 'Viên';
      if (!newItems[index].dosageForm) newItems[index].dosageForm = 'Viên nén';
      if (!newItems[index].storageLocation) newItems[index].storageLocation = 'Tủ A';
    }
    setItems(newItems);
  };

  const handleClearMedicine = (index: number) => {
    const newItems = [...items];
    newItems[index].medicineId = '';
    newItems[index].medicineName = '';
    newItems[index].unit = 'Viên';
    newItems[index].activeIngredient = '';
    newItems[index].isNewMedicine = false;
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    // Smart fallbacks so the form never fails unexpectedly
    const cleanTxCode =
      transactionCode.trim().toUpperCase() ||
      `PN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const finalSupplier = supplierName.trim() || 'Trạm Y tế Xã / Cung ứng y tế học đường';
    const finalReceiver = receiver.trim() || db.getCurrentUser()?.fullName || 'Cán bộ y tế';

    if (items.length === 0) {
      setError('Phiếu nhập phải có ít nhất 1 dòng thuốc.');
      return;
    }

    // Prepare items with safe auto-corrections
    const sanitizedItems = [...items];
    for (let i = 0; i < sanitizedItems.length; i++) {
      const item = sanitizedItems[i];
      if (!item.medicineName.trim() && !item.medicineId) {
        setError(`Dòng số ${i + 1}: Vui lòng chọn hoặc nhập tên thuốc cần lưu vào kho.`);
        const inputEl = document.getElementById(`med-input-${i}`);
        if (inputEl) {
          inputEl.focus();
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Auto-generate batch number if left blank
      if (!item.batchNumber || !item.batchNumber.trim()) {
        const yearStr = new Date().getFullYear().toString().slice(-2);
        item.batchNumber = `L${yearStr}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(
          i + 1
        ).padStart(2, '0')}`;
      }

      // Auto-set safe expiry date (+2 years) if left blank
      if (!item.expDate) {
        const nextTwoYears = new Date();
        nextTwoYears.setFullYear(nextTwoYears.getFullYear() + 2);
        item.expDate = nextTwoYears.toISOString().split('T')[0];
      }

      // Ensure positive quantity
      if (!item.quantity || Number(item.quantity) <= 0) {
        item.quantity = 50;
      }

      // Ensure valid unit
      if (!item.unit || !item.unit.trim()) {
        item.unit = 'Viên';
      }

      if (item.mfgDate && item.expDate && new Date(item.expDate) <= new Date(item.mfgDate)) {
        setError(
          `Dòng số ${i + 1} (Lô "${item.batchNumber}"): Hạn sử dụng (${item.expDate}) phải sau ngày sản xuất (${item.mfgDate}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Xử lý thuốc: nếu thuốc mới chưa có trong danh mục, tự động tạo mới vào DB
      const currentMeds = db.getMedicines();
      const processedItems = sanitizedItems.map((item, idx) => {
        let medId = item.medicineId;
        const existingMed = currentMeds.find(
          (m) =>
            m.id === medId ||
            m.name.trim().toLowerCase() === item.medicineName.trim().toLowerCase()
        );

        if (existingMed) {
          medId = existingMed.id;
        } else {
          // Tự động thêm thuốc mới vào danh mục
          const newMedCode = `TH-${String(currentMeds.length + 1 + idx).padStart(3, '0')}`;
          const created = db.addMedicine({
            code: newMedCode,
            name: item.medicineName.trim(),
            activeIngredient: item.activeIngredient.trim() || item.medicineName.trim(),
            dosageForm: item.dosageForm || 'Viên nén',
            strength: '',
            unit: item.unit.trim() || 'Viên',
            packing: 'Hộp',
            manufacturer: 'Việt Nam',
            country: 'Việt Nam',
            supplierId: '',
            minStock: 20,
            unitPrice: item.unitPrice || 1000,
            storageLocation: item.storageLocation || 'Tủ A',
            notes: 'Tự động tạo từ phiếu nhập kho',
          });
          medId = created.id;
        }

        return {
          medicineId: medId,
          batchNumber: item.batchNumber.trim().toUpperCase(),
          mfgDate: item.mfgDate || new Date().toISOString().split('T')[0],
          expDate: item.expDate,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice) || 0,
          storageLocation: item.storageLocation || 'Tủ A',
        };
      });

      const newTx = db.importMedicineTransaction({
        transactionCode: cleanTxCode,
        date: date || new Date().toISOString().split('T')[0],
        source: source.trim() || 'Ngân sách y tế trường học',
        supplierName: finalSupplier,
        deliverer: deliverer.trim() || 'Đại diện cung ứng',
        receiver: finalReceiver,
        performer: db.getCurrentUser()?.fullName || 'Cán bộ y tế',
        notes: notes.trim(),
        items: processedItems,
      });

      onSuccess(
        `ĐÃ LƯU THÀNH CÔNG! Phiếu nhập ${newTx.transactionCode} đã tự động cộng số lượng vào kho.`
      );

      // Reset form
      setTransactionCode(
        `PN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
      );
      setSupplierName('');
      setDeliverer('');
      setNotes('');
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 2);
      setItems([
        {
          medicineId: '',
          medicineName: '',
          unit: 'Viên',
          activeIngredient: '',
          dosageForm: 'Viên nén',
          batchNumber: `L${new Date().getFullYear().toString().slice(-2)}${String(
            new Date().getMonth() + 1
          ).padStart(2, '0')}-01`,
          mfgDate: new Date().toISOString().split('T')[0],
          expDate: nextYear.toISOString().split('T')[0],
          quantity: 50,
          unitPrice: 1000,
          storageLocation: 'Tủ A',
          isNewMedicine: false,
        },
      ]);
      setActiveTab('history');
      setSelectedTx(newTx);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu phiếu nhập thuốc.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
            <ArrowDownLeft className="w-4 h-4" />
            <span>Nghiệp vụ Kho Dược • Trường THCS Đông Thạnh</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            NHẬP THUỐC VÀO TỦ Y TẾ
          </h2>
          <p className="text-xs text-slate-500">
            Lập phiếu nhập thuốc theo lô, hạn dùng. Hệ thống tự động cập nhật tồn kho an toàn
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + Lập Phiếu Mới
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-2 rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lịch Sử Phiếu Nhập ({importTransactions.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form noValidate onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2 shadow-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: General Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>I. Thông Tin Chung Phiếu Nhập</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Số phiếu nhập
                </label>
                <input
                  id="input-import-code"
                  type="text"
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-slate-900 bg-slate-50 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ngày nhập kho
                </label>
                <input
                  id="input-import-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nơi cung cấp / Đơn vị cấp
                </label>
                <div className="relative">
                  <input
                    id="input-import-supplier"
                    type="text"
                    list="supplier-suggestions-list"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Nhập hoặc chọn đơn vị cung cấp..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                  />
                  <datalist id="supplier-suggestions-list">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                    <option value="Trạm Y tế Xã Đông Thạnh" />
                    <option value="Trung tâm Y tế Huyện Hóc Môn" />
                    <option value="Bệnh viện Đa khoa Khu vực Hóc Môn" />
                    <option value="Nhà thuốc Long Châu" />
                    <option value="Nhà thuốc An Khang" />
                    <option value="Tự bổ sung tủ y tế trường học" />
                  </datalist>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400">Chọn nhanh:</span>
                  {['Trạm Y tế Xã Đông Thạnh', 'Trung tâm Y tế Huyện Hóc Môn', 'Tự bổ sung tủ y tế'].map(
                    (name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSupplierName(name)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-colors border cursor-pointer truncate max-w-[190px] ${
                          supplierName === name
                            ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border-slate-200/60'
                        }`}
                        title={name}
                      >
                        {name}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nguồn kinh phí / Thuốc</label>
                <input
                  id="input-import-source"
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="VD: Ngân sách y tế trường học..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Người giao hàng / Đại diện</label>
                <input
                  id="input-import-deliverer"
                  type="text"
                  value={deliverer}
                  onChange={(e) => setDeliverer(e.target.value)}
                  placeholder="Họ tên người giao từ NCC"
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Người nhận (Cán bộ y tế nhận)
                </label>
                <input
                  id="input-import-receiver"
                  type="text"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  placeholder="Cán bộ phụ trách y tế trường"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-slate-700 mb-1">Ghi chú phiếu nhập</label>
              <input
                id="input-import-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Thuốc đợt 1 kiểm kê đầu năm học, bao bì nguyên vẹn..."
                className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Section 2: Details of Medicines to Import */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-600" />
                <span>II. Danh Sách Thuốc Nhập Kho (Quản lý theo Lô & HSD)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 cursor-pointer"
                  title="Thêm thuốc mới tinh vào danh mục thuốc của trường"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tạo thuốc mới vào danh mục</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm dòng thuốc</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">STT</th>
                    <th className="p-2.5 min-w-[260px]">Tên thuốc (Gõ mới hoặc chọn) *</th>
                    <th className="p-2.5 min-w-[120px]">Số lô *</th>
                    <th className="p-2.5 min-w-[130px]">Ngày SX</th>
                    <th className="p-2.5 min-w-[130px]">Hạn sử dụng *</th>
                    <th className="p-2.5 min-w-[90px] text-right">Số lượng *</th>
                    <th className="p-2.5 text-center">Xóa/Làm mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row, idx) => {
                    const selectedMed = medicines.find(
                      (m) => m.id === row.medicineId || m.name.toLowerCase() === row.medicineName.trim().toLowerCase()
                    );
                    const rowTotal = row.quantity * row.unitPrice;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-mono">{idx + 1}</td>

                        {/* Medicine Input & Selector */}
                        <td className="p-2.5">
                          <div className="relative">
                            <input
                              id={`med-input-${idx}`}
                              type="text"
                              list={`med-suggestions-${idx}`}
                              value={row.medicineName}
                              onChange={(e) => handleMedicineNameChange(idx, e.target.value)}
                              placeholder="Gõ tên thuốc mới hoặc chọn từ danh sách..."
                              className={`w-full p-2 pr-7 rounded-lg border font-bold text-xs ${
                                !row.medicineName && error
                                  ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50/50'
                                  : row.isNewMedicine
                                  ? 'border-blue-300 bg-blue-50/40 text-blue-900 focus:ring-2 focus:ring-blue-500'
                                  : row.medicineId
                                  ? 'border-emerald-200 bg-emerald-50/30 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                                  : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500'
                              }`}
                            />
                            {row.medicineName && (
                              <button
                                type="button"
                                onClick={() => handleClearMedicine(idx)}
                                className="absolute right-2 top-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-full p-0.5 cursor-pointer"
                                title="Xóa tên thuốc này để gõ tên thuốc mới"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <datalist id={`med-suggestions-${idx}`}>
                              {medicines.map((m) => (
                                <option key={m.id} value={m.name}>
                                  {m.code} - ĐVT: {m.unit} ({m.activeIngredient})
                                </option>
                              ))}
                            </datalist>
                          </div>

                          {/* Medicine details / Status & Unit selection */}
                          <div className="flex items-center justify-between gap-1.5 mt-1 text-[11px]">
                            {row.isNewMedicine ? (
                              <span className="inline-flex items-center gap-1 text-blue-700 font-bold bg-blue-100/80 px-1.5 py-0.5 rounded text-[10px]">
                                ✨ Thuốc mới (sẽ tự thêm vào danh mục)
                              </span>
                            ) : row.medicineId ? (
                              <span className="text-emerald-700 font-medium text-[10px] truncate max-w-[170px]" title={`${selectedMed?.code} • ${selectedMed?.activeIngredient || ''}`}>
                                ✓ {selectedMed?.code} • {selectedMed?.unit}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Gõ tên thuốc mới hoặc chọn</span>
                            )}

                            {/* Unit selector/input */}
                            <div className="flex items-center gap-1 shrink-0 ml-auto">
                              <span className="text-slate-500 text-[10px] font-semibold">ĐVT:</span>
                              <input
                                type="text"
                                list="common-units-list"
                                value={row.unit}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].unit = e.target.value;
                                  setItems(newItems);
                                }}
                                placeholder="Viên"
                                className="w-16 p-0.5 text-center font-bold text-[11px] rounded border border-slate-200 bg-white"
                                title="Đơn vị tính (Viên, Gói, Lọ, Chai, Tuýp, Vỉ...)"
                              />
                            </div>
                          </div>
                        </td>

                        {/* Batch Number */}
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={row.batchNumber}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx].batchNumber = e.target.value.toUpperCase();
                              setItems(newItems);
                            }}
                            placeholder="Số lô (tự sinh nếu trống)"
                            className="w-full p-1.5 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        {/* Mfg Date */}
                        <td className="p-2.5">
                          <input
                            type="date"
                            value={row.mfgDate}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx].mfgDate = e.target.value;
                              setItems(newItems);
                            }}
                            className="w-full p-1.5 rounded-lg border border-slate-200"
                          />
                        </td>

                        {/* Exp Date */}
                        <td className="p-2.5">
                          <input
                            type="date"
                            value={row.expDate}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx].expDate = e.target.value;
                              setItems(newItems);
                            }}
                            className="w-full p-1.5 rounded-lg border border-slate-200 font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[idx].quantity = Number(e.target.value);
                              setItems(newItems);
                            }}
                            className="w-20 p-1.5 rounded-lg border border-slate-200 text-right font-black text-blue-900 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>

                        {/* Remove */}
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Xóa dòng"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Footer */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                <span>Tổng số mặt hàng thuốc: </span>
                <strong className="text-slate-900">{items.length} thuốc</strong>
                <span className="mx-2">•</span>
                <span>Tổng số lượng nhập kho: </span>
                <strong className="text-blue-700 font-bold">
                  {items.reduce((s, i) => s + (i.quantity || 0), 0).toLocaleString()} đơn vị
                </strong>
              </div>

              <div className="text-xs text-slate-500 italic">
                * Thuốc sẽ được nhập trực tiếp vào hệ thống quản lý tồn kho và theo dõi hạn sử dụng
              </div>
            </div>
          </div>

          {/* Submit Button & Bottom Error Alert */}
          <div className="space-y-3 pt-2">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                id="btn-save-import-transaction"
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                <span>{isSubmitting ? 'ĐANG LƯU PHIẾU NHẬP...' : 'LƯU PHIẾU NHẬP VÀO KHO'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* History of Import Transactions */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                LỊCH SỬ CÁC PHIẾU NHẬP THUỐC VÀO TỦ Y TẾ
              </h3>
              <p className="text-xs text-slate-500">
                Toàn bộ dữ liệu nhập thuốc đã tự động ghi nhận vào tồn kho và nhật ký hệ thống
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700"
            >
              + Lập phiếu mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Số phiếu</th>
                  <th className="p-3">Ngày nhập</th>
                  <th className="p-3">Nguồn thuốc / NCC</th>
                  <th className="p-3">Người giao - nhận</th>
                  <th className="p-3 text-center">Số mặt hàng</th>
                  <th className="p-3 text-right">Tổng số lượng</th>
                  <th className="p-3 text-center">Tình trạng</th>
                  <th className="p-3 text-center">In / Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Chưa có phiếu nhập nào.
                    </td>
                  </tr>
                ) : (
                  importTransactions.map((tx) => {
                    const sup = suppliers.find((s) => s.id === tx.supplierId);
                    const displaySupplier = tx.supplierName || sup?.name || tx.source || '---';
                    const totalQty = tx.items.reduce((s, i) => s + (i.quantity || 0), 0);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-blue-900">
                          {tx.transactionCode}
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {formatDateVN(tx.date)}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-900 block">
                            {displaySupplier}
                          </span>
                          <span className="block text-[10px] text-slate-500">{tx.source}</span>
                        </td>
                        <td className="p-3 text-slate-700">
                          <span>Giao: {tx.deliverer || 'Đại diện NCC'}</span>
                          <span className="block text-[10px] text-slate-500">
                            Nhận: {tx.receiver || tx.performer}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {tx.items.length} thuốc
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {totalQty.toLocaleString()} đơn vị
                        </td>
                        <td className="p-3 text-center">
                          {tx.status === 'completed' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Đã nhập kho
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              Đã hủy
                            </span>
                          )}
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
                              className="p-1 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                              title="In phiếu nhập A4"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmTx(tx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Xóa phiếu nhập này"
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
      )}

      {/* View Detail Modal for Transaction */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-blue-700">
                  CHI TIẾT PHIẾU NHẬP
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
                  <span className="text-slate-400 block text-[10px]">Ngày nhập:</span>
                  <strong className="text-slate-800">{formatDateVN(selectedTx.date)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Người nhận:</span>
                  <strong className="text-slate-800">{selectedTx.receiver || selectedTx.performer}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Người giao:</span>
                  <strong className="text-slate-800">{selectedTx.deliverer || 'Đại diện NCC'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Nơi cung cấp / Đơn vị cấp:</span>
                  <strong className="text-slate-800">
                    {selectedTx.supplierName ||
                      suppliers.find((s) => s.id === selectedTx.supplierId)?.name ||
                      '---'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Nguồn thuốc:</span>
                  <strong className="text-slate-800">{selectedTx.source}</strong>
                </div>
              </div>

              <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Tên thuốc</th>
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
                      <td className="p-2 text-right font-black">
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
                  <span>In biểu mẫu phiếu A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmTx(selectedTx);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 border border-rose-200 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Xóa phiếu nhập</span>
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
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa phiếu nhập kho</h3>
                <p className="text-xs text-slate-500 font-mono">{deleteConfirmTx.transactionCode}</p>
              </div>
            </div>

            <div className="text-sm text-slate-600 space-y-2 mb-6">
              <p>
                Bạn có chắc chắn muốn xóa phiếu nhập <strong>{deleteConfirmTx.transactionCode}</strong> (ngày{' '}
                {formatDateVN(deleteConfirmTx.date)})?
              </p>
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-100">
                <div>
                  <strong>Nơi cung cấp:</strong>{' '}
                  {deleteConfirmTx.supplierName ||
                    suppliers.find((s) => s.id === deleteConfirmTx.supplierId)?.name ||
                    deleteConfirmTx.source ||
                    '---'}
                </div>
                <div><strong>Nguồn thuốc:</strong> {deleteConfirmTx.source}</div>
                <div><strong>Tổng số lượng:</strong> {deleteConfirmTx.items.reduce((s, i) => s + (i.quantity || 0), 0).toLocaleString()} đơn vị</div>
                <div><strong>Số lượng mặt hàng:</strong> {deleteConfirmTx.items.length} thuốc</div>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                ⚠️ <strong>Cảnh báo điều chỉnh kho:</strong> Khi xóa phiếu nhập này, hệ thống sẽ tự động hoàn tác/trừ lại số lượng tồn kho tương ứng của các lô thuốc đã nhập trong phiếu.
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
                Đồng ý xóa phiếu nhập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tạo thuốc mới nhanh vào danh mục */}
      {showAddMedModal && (
        <MedicineModal
          medicineToEdit={null}
          onClose={() => setShowAddMedModal(false)}
          onSuccess={(msg) => {
            setShowAddMedModal(false);
            onSuccess(msg);
            setMedicines(db.getMedicines());
          }}
        />
      )}

      {/* Danh sách đơn vị tính phổ biến */}
      <datalist id="common-units-list">
        <option value="Viên" />
        <option value="Gói" />
        <option value="Lọ" />
        <option value="Chai" />
        <option value="Tuýp" />
        <option value="Vỉ" />
        <option value="Cuộn" />
        <option value="Hộp" />
        <option value="Ống" />
        <option value="Miếng" />
      </datalist>
    </div>
  );
};
