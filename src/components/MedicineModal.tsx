import React, { useState, useEffect } from 'react';
import { Trash2, AlertTriangle, Boxes, Plus, Calendar, CheckCircle2, ShieldAlert, Edit2 } from 'lucide-react';
import { db, formatDateVN, getDaysRemaining } from '../services/db';
import { Medicine, MedicineBatch } from '../types';

interface MedicineModalProps {
  isOpen?: boolean;
  onClose: () => void;
  medicineToEdit?: Medicine | null;
  onSuccess: (message: string) => void;
}

export const MedicineModal: React.FC<MedicineModalProps> = ({
  isOpen = true,
  onClose,
  medicineToEdit,
  onSuccess,
}) => {
  const suppliers = db.getSuppliers();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dosageForm, setDosageForm] = useState('Viên nén');
  const [strength, setStrength] = useState('500mg');
  const [unit, setUnit] = useState('Viên');
  const [packing, setPacking] = useState('Hộp 10 vỉ x 10 viên');
  const [manufacturer, setManufacturer] = useState('');
  const [country, setCountry] = useState('Việt Nam');
  const [supplierName, setSupplierName] = useState(() => {
    const s = suppliers.find((x) => x.id === (medicineToEdit?.supplierId || 'sup-01'));
    return s ? s.name : '';
  });
  const [minStock, setMinStock] = useState<number>(20);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [storageLocation, setStorageLocation] = useState('Tủ A - Ngăn 1');
  const [notes, setNotes] = useState('');

  // Initial batch fields (for adding brand new medicine)
  const [createInitialBatch, setCreateInitialBatch] = useState(false);
  const [initialBatchNumber, setInitialBatchNumber] = useState('');
  const [initialMfgDate, setInitialMfgDate] = useState('2025-01-01');
  const [initialExpDate, setInitialExpDate] = useState('2027-12-31');
  const [initialQuantity, setInitialQuantity] = useState<number>(100);

  // Existing batches state when editing
  const [existingBatches, setExistingBatches] = useState<MedicineBatch[]>([]);
  const [showAddBatchSection, setShowAddBatchSection] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchMfgDate, setNewBatchMfgDate] = useState('');
  const [newBatchExpDate, setNewBatchExpDate] = useState('');
  const [newBatchQuantity, setNewBatchQuantity] = useState<number>(50);
  const [batchActionMsg, setBatchActionMsg] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteMedicine = () => {
    if (!medicineToEdit) return;
    try {
      db.deleteMedicine(medicineToEdit.id, true);
      onSuccess(`Đã xóa thành công thuốc "${medicineToEdit.name}" khỏi danh mục.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa thuốc.');
      setShowDeleteConfirm(false);
    }
  };

  const handleStartEditBatch = (b: MedicineBatch) => {
    setEditingBatchId(b.id);
    setNewBatchNumber(b.batchNumber);
    setNewBatchMfgDate(b.mfgDate);
    setNewBatchExpDate(b.expDate);
    setNewBatchQuantity(b.quantity);
    setShowAddBatchSection(true);
    setBatchActionMsg(null);
  };

  const handleOpenAddNewBatchSection = () => {
    setEditingBatchId(null);
    if (medicineToEdit) {
      const cleanCode = (medicineToEdit.code || 'LO').replace('TH-', '').replace('VT-', '');
      setNewBatchNumber(
        `${cleanCode ? cleanCode.slice(0, 4) : 'LO'}-${new Date().getFullYear().toString().slice(-2)}${String(existingBatches.length + 1).padStart(2, '0')}`
      );
      setNewBatchMfgDate(new Date().toISOString().split('T')[0]);
      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);
      setNewBatchExpDate(future.toISOString().split('T')[0]);
      setNewBatchQuantity(medicineToEdit.minStock > 0 ? medicineToEdit.minStock * 2 : 50);
    }
    setShowAddBatchSection(true);
    setBatchActionMsg(null);
  };

  const handleSaveBatchDirectly = () => {
    if (!medicineToEdit) return;
    setError(null);
    setBatchActionMsg(null);

    const year = new Date().getFullYear();
    const cleanCode = (medicineToEdit.code || 'LO').replace('TH-', '').replace('VT-', '');
    const prefix = cleanCode ? cleanCode.slice(0, 4) : 'LO';
    const cleanNum =
      newBatchNumber.trim().toUpperCase() ||
      `${prefix}-${year.toString().slice(-2)}${String(Date.now()).slice(-3)}`;

    let finalExp = newBatchExpDate;
    if (!finalExp) {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 2);
      finalExp = d.toISOString().split('T')[0];
    }

    if (newBatchMfgDate && new Date(finalExp) <= new Date(newBatchMfgDate)) {
      setError(`Hạn sử dụng (${finalExp}) phải sau ngày sản xuất (${newBatchMfgDate}).`);
      return;
    }
    const safeQty = Number(newBatchQuantity) >= 0 ? Number(newBatchQuantity) : 50;

    try {
      if (editingBatchId) {
        db.updateBatch(editingBatchId, {
          batchNumber: cleanNum,
          mfgDate: newBatchMfgDate || new Date().toISOString().split('T')[0],
          expDate: finalExp,
          quantity: safeQty,
        });
        setBatchActionMsg(`✓ Đã cập nhật thành công thông tin lô "${cleanNum}"!`);
      } else {
        const added = db.addBatch({
          medicineId: medicineToEdit.id,
          batchNumber: cleanNum,
          mfgDate: newBatchMfgDate || new Date().toISOString().split('T')[0],
          expDate: finalExp,
          quantity: safeQty,
          unitPrice: Number(unitPrice) || 0,
          storageLocation,
          createTransaction: true,
          notes: `Nhập thêm lô ${cleanNum} khi sửa thông tin thuốc ${medicineToEdit.name}`,
        });
        setBatchActionMsg(
          `✓ Đã thêm thành công lô "${added.batchNumber}" (SL: ${added.quantity} ${unit}, HSD: ${formatDateVN(added.expDate)})!`
        );
      }

      const updatedBatches = db.getBatches(medicineToEdit.id);
      setExistingBatches(updatedBatches);
      setShowAddBatchSection(false);
      setEditingBatchId(null);

      // Prep next batch number
      setNewBatchNumber(
        `${cleanCode ? cleanCode.slice(0, 4) : 'LO'}-${new Date().getFullYear().toString().slice(-2)}${String(updatedBatches.length + 1).padStart(2, '0')}`
      );
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thông tin lô.');
    }
  };

  const handleDeleteBatchDirectly = (batchId: string) => {
    if (!medicineToEdit) return;
    try {
      db.deleteBatch(batchId);
      const updatedBatches = db.getBatches(medicineToEdit.id);
      setExistingBatches(updatedBatches);
      setBatchActionMsg('✓ Đã xóa lô thuốc thành công.');
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa lô.');
    }
  };

  useEffect(() => {
    if (medicineToEdit) {
      setCode(medicineToEdit.code);
      setName(medicineToEdit.name);
      setActiveIngredient(medicineToEdit.activeIngredient);
      setDosageForm(medicineToEdit.dosageForm);
      setStrength(medicineToEdit.strength);
      setUnit(medicineToEdit.unit);
      setPacking(medicineToEdit.packing);
      setManufacturer(medicineToEdit.manufacturer || '');
      setCountry(medicineToEdit.country || 'Việt Nam');
      const foundSup = suppliers.find((x) => x.id === medicineToEdit.supplierId);
      setSupplierName(foundSup ? foundSup.name : (medicineToEdit.supplierId || ''));
      setMinStock(medicineToEdit.minStock);
      setUnitPrice(medicineToEdit.unitPrice || 0);
      setStorageLocation(medicineToEdit.storageLocation);
      setNotes(medicineToEdit.notes || '');
      setCreateInitialBatch(false);

      const medBatches = db.getBatches(medicineToEdit.id);
      setExistingBatches(medBatches);
      setShowAddBatchSection(false);
      setBatchActionMsg(null);

      const cleanCode = (medicineToEdit.code || 'LO').replace('TH-', '').replace('VT-', '');
      setNewBatchNumber(`${cleanCode ? cleanCode.slice(0, 4) : 'LO'}-${new Date().getFullYear().toString().slice(-2)}${String(medBatches.length + 1).padStart(2, '0')}`);
      setNewBatchMfgDate(new Date().toISOString().split('T')[0]);
      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);
      setNewBatchExpDate(future.toISOString().split('T')[0]);
      setNewBatchQuantity(medicineToEdit.minStock > 0 ? medicineToEdit.minStock * 2 : 50);
    } else {
      // Auto-generate code
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setCode(`TH-${randNum}`);
      setName('');
      setActiveIngredient('');
      setDosageForm('Viên nén');
      setStrength('500mg');
      setUnit('Viên');
      setPacking('Hộp 10 vỉ x 10 viên');
      setManufacturer('Dược phẩm Việt Nam');
      setCountry('Việt Nam');
      setSupplierName('');
      setMinStock(20);
      setUnitPrice(0);
      setStorageLocation('Tủ A - Ngăn 1');
      setNotes('');
      setCreateInitialBatch(true);
      setInitialBatchNumber(`LO-${new Date().getFullYear()}-01`);
      setInitialMfgDate(new Date().toISOString().split('T')[0]);
      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);
      setInitialExpDate(future.toISOString().split('T')[0]);
      setInitialQuantity(50);
      setExistingBatches([]);
      setShowAddBatchSection(false);
      setBatchActionMsg(null);
    }
    setError(null);
  }, [medicineToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('Mã thuốc không được để trống.');
      return;
    }
    if (!name.trim()) {
      setError('Tên thuốc không được để trống.');
      return;
    }
    if (!activeIngredient.trim()) {
      setError('Hoạt chất của thuốc không được để trống.');
      return;
    }
    if (minStock < 0) {
      setError('Mức tồn tối thiểu không được là số âm.');
      return;
    }
    if (unitPrice < 0) {
      setError('Đơn giá không được là số âm.');
      return;
    }

    if (!medicineToEdit && createInitialBatch) {
      if (!initialBatchNumber.trim()) {
        setError('Số lô ban đầu không được để trống.');
        return;
      }
      if (initialQuantity <= 0) {
        setError('Số lượng lô ban đầu phải lớn hơn 0.');
        return;
      }
      if (new Date(initialExpDate) <= new Date(initialMfgDate)) {
        setError('Hạn sử dụng phải sau ngày sản xuất.');
        return;
      }
    }

    try {
      let finalSupplierId = '';
      const trimmedSup = supplierName.trim();
      if (trimmedSup) {
        const found = suppliers.find(
          (s) => s.name.trim().toLowerCase() === trimmedSup.toLowerCase() || s.id === trimmedSup
        );
        if (found) {
          finalSupplierId = found.id;
        } else {
          const newSup = db.addSupplier({
            code: 'NCC-' + String(suppliers.length + 1).padStart(2, '0'),
            name: trimmedSup,
            phone: '',
            address: '',
            contactPerson: '',
          });
          finalSupplierId = newSup.id;
        }
      } else {
        finalSupplierId = suppliers[0]?.id || '';
      }

      if (medicineToEdit) {
        db.updateMedicine(medicineToEdit.id, {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          activeIngredient: activeIngredient.trim(),
          dosageForm,
          strength,
          unit,
          packing,
          manufacturer,
          country,
          supplierId: finalSupplierId,
          minStock: Number(minStock),
          unitPrice: Number(unitPrice),
          storageLocation,
          notes,
        });
        onSuccess(`Đã cập nhật thông tin thuốc "${name}" thành công.`);
      } else {
        db.addMedicine(
          {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            activeIngredient: activeIngredient.trim(),
            dosageForm,
            strength,
            unit,
            packing,
            manufacturer,
            country,
            supplierId: finalSupplierId,
            minStock: Number(minStock),
            unitPrice: Number(unitPrice),
            storageLocation,
            notes,
            isDemo: false,
          },
          createInitialBatch
            ? {
                batchNumber:
                  initialBatchNumber.trim().toUpperCase() ||
                  `LO-${new Date().getFullYear().toString().slice(-2)}01`,
                mfgDate: initialMfgDate || new Date().toISOString().split('T')[0],
                expDate:
                  initialExpDate ||
                  new Date(Date.now() + 63072000000).toISOString().split('T')[0],
                quantity: Number(initialQuantity) > 0 ? Number(initialQuantity) : 100,
                unitPrice: Number(unitPrice) || 0,
              }
            : undefined
        );
        onSuccess(`Đã thêm mới thuốc "${name}" vào danh mục thành công.`);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu thông tin thuốc.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              {medicineToEdit ? 'SỬA THÔNG TIN THUỐC' : '+ THÊM THUỐC MỚI VÀO DANH MỤC'}
            </h3>
            <p className="text-xs text-slate-500">
              Cán bộ y tế phụ trách nhập đầy đủ thông số dược học theo quy định
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-medium shadow-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Row 1: Code & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mã thuốc <span className="text-rose-600">*</span>
              </label>
              <input
                id="input-med-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: TH-PARA500"
                required
                className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Tên thuốc biệt dược <span className="text-rose-600">*</span>
              </label>
              <input
                id="input-med-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Paracetamol 500mg (Hapacol)"
                required
                className="w-full p-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 2: Active ingredient & Strength */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Hoạt chất chính <span className="text-rose-600">*</span>
              </label>
              <input
                id="input-med-active"
                type="text"
                value={activeIngredient}
                onChange={(e) => setActiveIngredient(e.target.value)}
                placeholder="VD: Paracetamol"
                required
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hàm lượng / Nồng độ</label>
              <input
                id="input-med-strength"
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="VD: 500mg hoặc 10%"
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 3: Dosage form, Unit, Packing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Dạng bào chế</label>
              <select
                id="input-med-form"
                value={dosageForm}
                onChange={(e) => setDosageForm(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="Viên nén">Viên nén</option>
                <option value="Viên nén bao phim">Viên nén bao phim</option>
                <option value="Viên nang mềm">Viên nang mềm</option>
                <option value="Viên sủi bọt">Viên sủi bọt</option>
                <option value="Bột pha dung dịch">Bột pha dung dịch</option>
                <option value="Dung dịch sát khuẩn">Dung dịch sát khuẩn</option>
                <option value="Dung dịch nhỏ mắt mũi">Dung dịch nhỏ mắt mũi</option>
                <option value="Siro thuốc">Siro thuốc</option>
                <option value="Dầu xoa ngoài da">Dầu xoa ngoài da</option>
                <option value="Dạng khác">Dạng khác</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Đơn vị tính <span className="text-rose-600">*</span>
              </label>
              <input
                id="input-med-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Viên, Gói, Chai, Lọ, Tuýp..."
                required
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Quy cách đóng gói</label>
              <input
                id="input-med-packing"
                type="text"
                value={packing}
                onChange={(e) => setPacking(e.target.value)}
                placeholder="VD: Hộp 10 vỉ x 10 viên"
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 4: Manufacturer & Country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nhà sản xuất</label>
              <input
                id="input-med-manufacturer"
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="VD: Dược Hậu Giang (DHG Pharma)"
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nước sản xuất</label>
              <input
                id="input-med-country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 5: Min Stock & Storage Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mức tồn tối thiểu <span className="text-amber-600">*</span>
              </label>
              <input
                id="input-med-minstock"
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                required
                className="w-full p-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400">Cảnh báo nếu tồn kho ≤ mức này</span>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Vị trí bảo quản <span className="text-emerald-700">*</span>
              </label>
              <input
                id="input-med-location"
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="VD: Tủ A - Ngăn 1"
                required
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Supplier */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Nơi cung cấp / Nguồn thuốc</label>
            <div className="relative">
              <input
                id="input-med-supplier"
                type="text"
                list="med-supplier-suggestions"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Tự nhập nơi cung cấp (hoặc chọn gợi ý)..."
                className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white text-slate-900 placeholder:text-slate-400"
              />
              <datalist id="med-supplier-suggestions">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.code})
                  </option>
                ))}
                <option value="Trung tâm Y tế Huyện Hóc Môn" />
                <option value="Trạm Y tế Xã Đông Thạnh" />
                <option value="Bệnh viện Đa khoa Khu vực Hóc Môn" />
                <option value="Công ty Cổ phần Dược phẩm Hậu Giang (DHG Pharma)" />
                <option value="Công ty TNHH Thiết Bị & Vật Tư Y Tế Sài Gòn" />
                <option value="Nhà thuốc Long Châu" />
                <option value="Nhà thuốc An Khang" />
              </datalist>
            </div>
          </div>

          {/* Initial Batch section when creating new medicine */}
          {!medicineToEdit && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
              <label className="flex items-center gap-2 font-bold text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createInitialBatch}
                  onChange={(e) => setCreateInitialBatch(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Tạo lô nhập kho ban đầu ngay cho thuốc này</span>
              </label>

              {createInitialBatch && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div>
                    <span className="block font-bold text-slate-700">Số lô *</span>
                    <input
                      type="text"
                      value={initialBatchNumber}
                      onChange={(e) => setInitialBatchNumber(e.target.value)}
                      placeholder="VD: LO-2026-01"
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-700">Ngày SX</span>
                    <input
                      type="date"
                      value={initialMfgDate}
                      onChange={(e) => setInitialMfgDate(e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-700">Hạn sử dụng *</span>
                    <input
                      type="date"
                      value={initialExpDate}
                      onChange={(e) => setInitialExpDate(e.target.value)}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-700">Số lượng ({unit}) *</span>
                    <input
                      type="number"
                      min="1"
                      value={initialQuantity}
                      onChange={(e) => setInitialQuantity(Number(e.target.value))}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white font-black text-emerald-800"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Batches Management Section when editing existing medicine */}
          {medicineToEdit && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      Quản Lý Các Lô & Thời Hạn Riêng ({existingBatches.length} lô)
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Mỗi lô có số hiệu, ngày SX, hạn sử dụng và số lượng riêng biệt
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (showAddBatchSection) {
                      setShowAddBatchSection(false);
                      setEditingBatchId(null);
                    } else {
                      handleOpenAddNewBatchSection();
                    }
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddBatchSection ? 'Đóng form lô' : '+ Nhập Thêm Lô Mới'}</span>
                </button>
              </div>

              {batchActionMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{batchActionMsg}</span>
                </div>
              )}

              {/* Form to add or edit a batch directly */}
              {showAddBatchSection && (
                <div className="p-3 bg-white border border-emerald-200 rounded-xl shadow-xs space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-emerald-900 text-[11px] flex items-center gap-1">
                      {editingBatchId ? (
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>
                        {editingBatchId
                          ? `Chỉnh sửa thông tin lô: ${newBatchNumber}`
                          : `Nhập thêm lô mới cho thuốc ${medicineToEdit.name}`}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Hạn nhanh:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 1);
                          setNewBatchExpDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        +1 năm
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setFullYear(d.getFullYear() + 2);
                          setNewBatchExpDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        +2 năm
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="block font-bold text-slate-700 text-[11px]">Số lô riêng *</span>
                      <input
                        type="text"
                        value={newBatchNumber}
                        onChange={(e) => setNewBatchNumber(e.target.value)}
                        placeholder="VD: LO-2026-02"
                        className="w-full p-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 uppercase"
                      />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-700 text-[11px]">Ngày SX</span>
                      <input
                        type="date"
                        value={newBatchMfgDate}
                        onChange={(e) => setNewBatchMfgDate(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-slate-300 text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-700 text-[11px]">Hạn sử dụng *</span>
                      <input
                        type="date"
                        value={newBatchExpDate}
                        onChange={(e) => setNewBatchExpDate(e.target.value)}
                        className="w-full p-1.5 rounded-lg border border-emerald-500 font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-700 text-[11px]">Số lượng ({unit}) *</span>
                      <input
                        type="number"
                        min="0"
                        value={newBatchQuantity}
                        onChange={(e) => setNewBatchQuantity(Number(e.target.value))}
                        className="w-full p-1.5 rounded-lg border border-slate-300 font-black text-emerald-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddBatchSection(false);
                        setEditingBatchId(null);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBatchDirectly}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{editingBatchId ? 'Lưu Cập Nhật Lô' : 'Lưu Lô Mới Vào Tủ Thuốc'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Batches Table */}
              {existingBatches.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Thuốc này chưa có lô nào trong kho.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[9px]">
                      <tr>
                        <th className="p-2">Số lô</th>
                        <th className="p-2">Hạn sử dụng</th>
                        <th className="p-2 text-right">Tồn kho</th>
                        <th className="p-2 text-center">Tình trạng</th>
                        <th className="p-2 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {existingBatches
                        .slice()
                        .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime())
                        .map((b) => {
                          const daysLeft = getDaysRemaining(b.expDate);
                          return (
                            <tr key={b.id} className="hover:bg-slate-50/70">
                              <td className="p-2 font-mono font-bold text-slate-900">{b.batchNumber}</td>
                              <td className="p-2">
                                <span className="font-semibold text-slate-800">{formatDateVN(b.expDate)}</span>
                                <span className={`block text-[9px] font-bold ${
                                  daysLeft < 0 ? 'text-rose-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {daysLeft < 0 ? `Quá hạn ${Math.abs(daysLeft)} ngày` : `Còn ${daysLeft} ngày`}
                                </span>
                              </td>
                              <td className="p-2 text-right font-black text-slate-900">
                                {b.quantity} {unit}
                              </td>
                              <td className="p-2 text-center">
                                {daysLeft < 0 ? (
                                  <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[9px] font-bold">
                                    Hết hạn
                                  </span>
                                ) : daysLeft <= 30 ? (
                                  <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                                    Cận hạn
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                    An toàn
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditBatch(b)}
                                    className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                    title="Sửa số lô, ngày SX, HSD, số lượng"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBatchDirectly(b.id)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Ghi chú & Chỉ định sơ cứu</label>
            <textarea
              id="input-med-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Dùng khi học sinh sốt trên 38.5 độ hoặc đau đầu nhẹ..."
              className="w-full p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Bottom error if any */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-medium shadow-xs">
              ⚠️ {error}
            </div>
          )}

          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 -mx-5 -mb-5 px-5 py-4">
            <div>
              {medicineToEdit && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer"
                  title="Xóa thuốc này khỏi danh mục thuốc y tế trường"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa thuốc này</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                id="btn-save-medicine"
                type="submit"
                className="px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                {medicineToEdit ? '✓ Cập Nhật Thay Đổi' : '+ Lưu Thuốc Mới Vào Tủ'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Xác nhận xóa thuốc */}
      {showDeleteConfirm && medicineToEdit && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Xác Nhận Xóa Thuốc Khỏi Danh Mục</h3>
                <p className="text-xs text-slate-500">Hành động này sẽ xóa thuốc và các lô liên quan</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div><strong>Tên thuốc:</strong> <span className="text-slate-900 font-bold">{medicineToEdit.name}</span></div>
              <div><strong>Mã thuốc:</strong> <span className="font-mono text-slate-700">{medicineToEdit.code}</span></div>
              <div><strong>Hoạt chất:</strong> {medicineToEdit.activeIngredient}</div>
              <div><strong>Đơn vị tính:</strong> {medicineToEdit.unit}</div>
            </div>

            <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              ⚠️ Bạn có chắc chắn muốn xóa thuốc này để nhập thuốc mới thay thế?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteMedicine}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold cursor-pointer shadow-xs"
              >
                Đồng ý xóa thuốc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
