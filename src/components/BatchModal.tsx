import React, { useState, useEffect } from 'react';
import { Boxes, Calendar, Clock, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, MapPin } from 'lucide-react';
import { db, formatDateVN, getDaysRemaining } from '../services/db';
import { Medicine, MedicineBatch } from '../types';

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: Medicine;
  batchToEdit?: MedicineBatch | null;
  onSuccess: (message: string) => void;
}

export const BatchModal: React.FC<BatchModalProps> = ({
  isOpen,
  onClose,
  medicine,
  batchToEdit,
  onSuccess,
}) => {
  const [batchNumber, setBatchNumber] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expDate, setExpDate] = useState('');
  const [quantity, setQuantity] = useState<number>(50);
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [createTransaction, setCreateTransaction] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset values
  useEffect(() => {
    if (!isOpen) return;

    if (batchToEdit) {
      setBatchNumber(batchToEdit.batchNumber);
      setMfgDate(batchToEdit.mfgDate || '');
      setExpDate(batchToEdit.expDate || '');
      setQuantity(batchToEdit.quantity);
      setStorageLocation(batchToEdit.storageLocation || medicine.storageLocation || '');
      setNotes('');
      setCreateTransaction(false);
    } else {
      // Generate default values for new batch
      const year = new Date().getFullYear();
      const existingBatches = db.getBatches(medicine.id);
      const nextBatchSeq = existingBatches.length + 1;
      const cleanCode = medicine.code.replace('TH-', '').replace('VT-', '');
      const prefix = cleanCode ? cleanCode.slice(0, 4) : 'LO';

      setBatchNumber(`${prefix}-${year.toString().slice(-2)}${String(nextBatchSeq).padStart(2, '0')}`);
      setMfgDate(new Date().toISOString().split('T')[0]);

      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);
      setExpDate(future.toISOString().split('T')[0]);

      setQuantity(medicine.minStock > 0 ? medicine.minStock * 2 : 50);
      setStorageLocation(medicine.storageLocation || 'Tủ A - Ngăn 1');
      setNotes(`Nhập bổ sung lô thuốc ${medicine.name} cho tủ y tế học đường`);
      setCreateTransaction(true);
    }
    setError(null);
  }, [isOpen, medicine, batchToEdit]);

  if (!isOpen) return null;

  // Calculate days remaining and alert status
  const daysRemaining = expDate ? getDaysRemaining(expDate) : null;

  const handleQuickAddYears = (years: number) => {
    const base = mfgDate ? new Date(mfgDate) : new Date();
    base.setFullYear(base.getFullYear() + years);
    setExpDate(base.toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Auto-generate batch number if left blank
    const year = new Date().getFullYear();
    const cleanCode = (medicine.code || 'LO').replace('TH-', '').replace('VT-', '');
    const prefix = cleanCode ? cleanCode.slice(0, 4) : 'LO';
    const cleanBatchNum =
      batchNumber.trim().toUpperCase() ||
      `${prefix}-${year.toString().slice(-2)}${String(Date.now()).slice(-3)}`;

    // Auto-generate expiry date if left blank (+2 years)
    let finalExpDate = expDate;
    if (!finalExpDate) {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 2);
      finalExpDate = future.toISOString().split('T')[0];
    }

    if (mfgDate && new Date(finalExpDate) <= new Date(mfgDate)) {
      setError(`Hạn sử dụng (${finalExpDate}) phải sau ngày sản xuất (${mfgDate}).`);
      return;
    }

    const safeQty = Number(quantity) > 0 ? Number(quantity) : (medicine.minStock > 0 ? medicine.minStock * 2 : 50);

    try {
      if (batchToEdit) {
        db.updateBatch(batchToEdit.id, {
          batchNumber: cleanBatchNum,
          mfgDate: mfgDate || new Date().toISOString().split('T')[0],
          expDate: finalExpDate,
          quantity: safeQty,
          storageLocation: storageLocation.trim() || medicine.storageLocation,
        });
        onSuccess(`Đã cập nhật thông tin lô "${cleanBatchNum}" của thuốc ${medicine.name}!`);
      } else {
        db.addBatch({
          medicineId: medicine.id,
          batchNumber: cleanBatchNum,
          mfgDate: mfgDate || new Date().toISOString().split('T')[0],
          expDate: finalExpDate,
          quantity: safeQty,
          unitPrice: medicine.unitPrice || 0,
          storageLocation: storageLocation.trim() || medicine.storageLocation,
          createTransaction,
          notes: notes.trim() || `Nhập thêm lô ${cleanBatchNum} cho ${medicine.name}`,
        });
        onSuccess(
          `Đã nhập thêm thành công lô "${cleanBatchNum}" (SL: ${safeQty} ${medicine.unit}, HSD: ${formatDateVN(finalExpDate)})!`
        );
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu thông tin lô thuốc.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-linear-to-r from-emerald-50 via-teal-50 to-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                  {medicine.code}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {batchToEdit ? 'Chỉnh Sửa Lô' : 'Nhập Thêm Lô Mới'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                {batchToEdit ? `Sửa Lô: ${batchToEdit.batchNumber}` : `Nhập Thêm Lô Mới Cho Thuốc`}
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                {medicine.name} • {medicine.strength} ({medicine.unit})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form noValidate onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-semibold flex items-center gap-2 shadow-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Medicine Quick Summary Card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div>
              <span className="text-slate-500">Hoạt chất:</span>{' '}
              <strong className="text-slate-800">{medicine.activeIngredient}</strong>
            </div>
            <div>
              <span className="text-slate-500">Đơn vị:</span>{' '}
              <strong className="text-emerald-700">{medicine.unit}</strong>
            </div>
            <div>
              <span className="text-slate-500">Tồn kho hiện tại:</span>{' '}
              <strong className="text-slate-900 font-black">
                {medicine.totalStock ?? 0} {medicine.unit}
              </strong>
            </div>
          </div>

          {/* Batch Number & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Số hiệu lô riêng biệt
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="VD: LO-2026-02 hoặc HB-2601"
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Mỗi đợt nhập có thể có số lô riêng theo vỏ hộp (tự sinh nếu trống)</p>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Số lượng nhập ({medicine.unit})
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-black text-slate-900 text-base focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Cộng dồn vào tồn kho thực tế của tủ y tế trường
              </p>
            </div>
          </div>

          {/* Dates: Manufacturing Date & Expiry Date */}
          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Thời hạn riêng của lô thuốc này (FEFO)</span>
              </span>
              {/* Expiry Quick Presets */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-emerald-700 font-semibold mr-1">Hạn nhanh:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAddYears(1)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                >
                  +1 năm
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddYears(2)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                >
                  +2 năm
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddYears(3)}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                >
                  +3 năm
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ngày sản xuất (NSX):
                </label>
                <input
                  type="date"
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Hạn sử dụng riêng (HSD):
                </label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-emerald-500 bg-white font-bold text-slate-900 shadow-2xs"
                />
              </div>
            </div>

            {/* Live Expiry Preview Badge */}
            {expDate && (
              <div
                className={`p-2.5 rounded-lg flex items-center justify-between text-[11px] font-bold ${
                  daysRemaining !== null && daysRemaining < 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : daysRemaining !== null && daysRemaining <= 30
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {daysRemaining !== null && daysRemaining < 0 ? (
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : daysRemaining !== null && daysRemaining <= 30 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>
                    Hạn dùng: <strong>{formatDateVN(expDate)}</strong>
                  </span>
                </div>
                <span>
                  {daysRemaining !== null && daysRemaining < 0
                    ? `⚠️ Đã quá hạn ${Math.abs(daysRemaining)} ngày`
                    : daysRemaining !== null && daysRemaining <= 30
                    ? `⚠️ Cận hạn: Còn ${daysRemaining} ngày (Ưu tiên FEFO)`
                    : `✓ Còn ${daysRemaining} ngày sử dụng an toàn`}
                </span>
              </div>
            )}
          </div>

          {/* Storage Location & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Vị trí bảo quản lô trong tủ thuốc
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="VD: Tủ A - Ngăn 1"
                  className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800 pl-8 font-medium"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ghi chú nguồn nhập / Kinh phí
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Ngân sách y tế trường 2026-2027"
                className="w-full p-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Option: Automatically create inventory transaction (PN) */}
          {!batchToEdit && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
              <input
                type="checkbox"
                checked={createTransaction}
                onChange={(e) => setCreateTransaction(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
              />
              <div className="text-[11px]">
                <strong className="text-slate-800 block">
                  Tự động lập Phiếu nhập kho (PN) cho đợt nhập lô này
                </strong>
                <span className="text-slate-500">
                  Lô thuốc sẽ được lưu vào Sổ theo dõi Nhập - Xuất - Tồn và Báo cáo kiểm kê y tế học đường.
                </span>
              </div>
            </label>
          )}

          {/* Bottom error if any */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm cursor-pointer flex items-center gap-2 transition-all active:scale-95"
            >
              <Boxes className="w-4 h-4" />
              <span>{batchToEdit ? '✓ Lưu Thay Đổi Lô' : '+ Nhập Lô Vào Tủ Thuốc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
