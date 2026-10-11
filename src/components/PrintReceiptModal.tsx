import React from 'react';
import { Printer, X } from 'lucide-react';
import { InventoryTransaction } from '../types';
import { db, formatVND, formatDateVN } from '../services/db';

interface PrintReceiptModalProps {
  transaction: InventoryTransaction | null;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  transaction,
  onClose,
}) => {
  if (!transaction) return null;

  const isImport = transaction.type === 'import';
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-slate-700" />
            <span className="font-bold text-slate-800 text-sm">
              Xem trước biểu mẫu in chuẩn A4 (Trường THCS Đông Thạnh)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>In Phiếu Ngay</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 overflow-y-auto flex-1 bg-white text-slate-900 font-serif text-xs leading-normal">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
            <div className="text-center font-sans">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                PHÒNG GD&ĐT HUYỆN HÓC MÔN
              </p>
              <p className="text-xs font-black uppercase text-slate-900">
                TRƯỜNG THCS ĐÔNG THẠNH
              </p>
              <p className="text-[10px] text-slate-600">BỘ PHẬN Y TẾ HỌC ĐƯỜNG</p>
            </div>

            <div className="text-center font-sans">
              <p className="text-xs font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="text-[11px] font-bold">Độc lập - Tự do - Hạnh phúc</p>
              <p className="text-[10px] text-slate-500 mt-1 italic">
                Đông Thạnh, ngày {new Date(transaction.date).getDate()} tháng{' '}
                {new Date(transaction.date).getMonth() + 1} năm{' '}
                {new Date(transaction.date).getFullYear()}
              </p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-4 font-sans">
            <h1 className="text-lg font-black uppercase tracking-wide text-slate-900">
              {isImport ? 'PHIẾU NHẬP THUỐC VÀ VẬT TƯ Y TẾ' : 'PHIẾU XUẤT CẤP PHÁT THUỐC HỌC ĐƯỜNG'}
            </h1>
            <p className="text-xs font-mono font-bold text-slate-600 mt-0.5">
              Số: {transaction.transactionCode}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-5 text-xs font-sans">
            <div>
              <span className="font-semibold text-slate-600">Ngày lập phiếu: </span>
              <strong>{formatDateVN(transaction.date)}</strong>
            </div>

            {isImport ? (
              <>
                <div>
                  <span className="font-semibold text-slate-600">Nơi cung cấp / Đơn vị cấp: </span>
                  <strong>
                    {transaction.supplierName ||
                      db.getSuppliers().find((s) => s.id === transaction.supplierId)?.name ||
                      '---'}
                  </strong>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Nguồn kinh phí: </span>
                  <strong>{transaction.source || 'Ngân sách trường'}</strong>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Người giao hàng: </span>
                  <strong>{transaction.deliverer || 'Đại diện nơi cung cấp'}</strong>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Người nhận hàng: </span>
                  <strong>{transaction.receiver || transaction.performer}</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="font-semibold text-slate-600">Người nhận / sử dụng: </span>
                  <strong>{transaction.recipientName}</strong>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Đối tượng / Lớp: </span>
                  <strong>
                    {transaction.recipientType === 'student'
                      ? `Học sinh lớp ${transaction.recipientClass || ''}`
                      : `${transaction.recipientType} (${transaction.recipientClass || ''})`}
                  </strong>
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Cán bộ y tế phụ trách: </span>
                  <strong>{transaction.performer}</strong>
                </div>
                <div className="col-span-2">
                  <span className="font-semibold text-slate-600">Lý do / Triệu chứng: </span>
                  <span>{transaction.purpose}</span>
                </div>
              </>
            )}

            {transaction.notes && (
              <div className="col-span-2 italic text-slate-600">
                <span>Ghi chú: </span>
                <span>{transaction.notes}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse border border-slate-900 mb-6 text-xs font-sans">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] text-center">
                <th className="border border-slate-900 p-2 w-10">STT</th>
                <th className="border border-slate-900 p-2 text-left">Tên thuốc / Biệt dược</th>
                <th className="border border-slate-900 p-2">Số lô</th>
                <th className="border border-slate-900 p-2">Hạn dùng</th>
                <th className="border border-slate-900 p-2 w-16">ĐVT</th>
                <th className="border border-slate-900 p-2 text-right w-20">Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {transaction.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                  <td className="border border-slate-900 p-2 font-bold">{item.medicineName}</td>
                  <td className="border border-slate-900 p-2 text-center font-mono">
                    {item.batchNumber}
                  </td>
                  <td className="border border-slate-900 p-2 text-center">
                    {formatDateVN(item.expDate)}
                  </td>
                  <td className="border border-slate-900 p-2 text-center">{item.unit}</td>
                  <td className="border border-slate-900 p-2 text-right font-bold">
                    {item.quantity}
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-slate-50">
                <td colSpan={5} className="border border-slate-900 p-2 text-right uppercase">
                  Tổng số lượng:
                </td>
                <td className="border border-slate-900 p-2 text-right text-slate-950">
                  {transaction.items.reduce((s, it) => s + it.quantity, 0)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-4 text-center mt-8 font-sans pt-4">
            <div>
              <p className="font-bold uppercase text-[11px]">Người lập phiếu</p>
              <p className="text-[10px] italic text-slate-500">(Ký và ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="font-bold text-xs">{transaction.performer}</p>
            </div>

            <div>
              <p className="font-bold uppercase text-[11px]">
                {isImport ? 'Người giao hàng' : 'Người nhận / Học sinh'}
              </p>
              <p className="text-[10px] italic text-slate-500">(Ký và ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="font-bold text-xs">
                {isImport ? transaction.deliverer || 'Đại diện bên giao' : transaction.recipientName}
              </p>
            </div>

            <div>
              <p className="font-bold uppercase text-[11px]">Ban Giám Hiệu duyệt</p>
              <p className="text-[10px] italic text-slate-500">(Ký, đóng dấu)</p>
              <div className="h-16"></div>
              <p className="font-bold text-xs">Hiệu Trưởng</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
