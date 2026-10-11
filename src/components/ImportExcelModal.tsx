import React, { useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, FileCheck, ArrowRight, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';

interface ImportExcelModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const downloadStandardMedicineTemplate = () => {
  const headers = [
    'Mã thuốc',
    'Tên thuốc / Vật tư y tế',
    'Hoạt chất chính',
    'Dạng bào chế',
    'Hàm lượng / Nồng độ',
    'Quy cách đóng gói',
    'Đơn vị tính',
    'Tồn kho tối thiểu',
    'Vị trí bảo quản (Tủ / Ngăn)',
    'Nhà sản xuất',
    'Nước sản xuất',
    'Đơn giá (VNĐ)',
  ];

  const sampleRows = [
    ['TH-EUGICA-NGAM', 'Eugica ngậm (2.5g/ 100 viên)', 'Eucalyptol, Bạc hà, Gừng, Tần dày lá', 'Viên ngậm', '2.5g', 'Hộp 10 vỉ x 10 viên', 'Viên', 20, 'Tủ A - Ngăn 1', 'Mega Lifesciences', 'Thái Lan', 1200],
    ['TH-EUGICA-XANH', 'Eugica xanh (100mg/ 100 viên)', 'Eucalyptol 100mg, Menthol, Gừng, Tần', 'Viên nang mềm', '100mg', 'Hộp 10 vỉ x 10 viên', 'Viên', 20, 'Tủ A - Ngăn 1', 'Mega Lifesciences', 'Việt Nam', 1500],
    ['TH-ALAXAN', 'Alaxan (325mg/ 100 viên)', 'Paracetamol 325mg, Ibuprofen 200mg', 'Viên nén', '325mg + 200mg', 'Hộp 10 vỉ x 10 viên', 'Viên', 20, 'Tủ A - Ngăn 2', 'United Pharma', 'Việt Nam', 1800],
    ['TH-HAP-CAM325', 'Hapacol Cam (325mg / 100 viên)', 'Paracetamol 325mg', 'Viên nén nhai', '325mg', 'Hộp 10 vỉ x 10 viên', 'Viên', 30, 'Tủ A - Ngăn 1', 'DHG Pharma', 'Việt Nam', 1100],
    ['TH-HAP-CAM250', 'Hapacol Cam (250mg / 25 gói)', 'Paracetamol 250mg', 'Thuốc cốm sủi bọt', '250mg', 'Hộp 25 gói', 'Gói', 15, 'Tủ A - Ngăn 1', 'DHG Pharma', 'Việt Nam', 2200],
    ['TH-HAP-BLUE500', 'Hapacol Blue (500mg/ 100 viên)', 'Paracetamol 500mg', 'Viên nén bao phim', '500mg', 'Hộp 10 vỉ x 10 viên', 'Viên', 30, 'Tủ A - Ngăn 1', 'DHG Pharma', 'Việt Nam', 1200],
    ['TH-EFF-SUI500', 'Efferalgan sủi (500mg/ 16 viên)', 'Paracetamol 500mg', 'Viên sủi bọt', '500mg', 'Hộp 4 vỉ x 4 viên', 'Viên', 16, 'Tủ A - Ngăn 1', 'UPSA SAS', 'Pháp', 4200],
    ['TH-DECOLGEN-ND', 'Decolgen ND (500mg/ 100 viên)', 'Paracetamol 500mg, Phenylephrine 10mg', 'Viên nén', '500mg + 10mg', 'Hộp 10 vỉ x 10 viên', 'Viên', 20, 'Tủ A - Ngăn 2', 'United Pharma', 'Việt Nam', 1600],
    ['TH-CATAFLAM25', 'Cataflam (25 mg/ 10 viên)', 'Diclofenac potassium 25mg', 'Viên bao đường', '25mg', 'Hộp 1 vỉ x 10 viên', 'Viên', 10, 'Tủ A - Ngăn 2', 'Novartis', 'Thụy Sĩ', 4800],
    ['TH-ALUMINA60', 'Alumina (......./60viên)', 'Aluminium hydroxide, Magnesium hydroxide', 'Viên nhai', 'Kháng acid dạ dày', 'Hộp 6 vỉ x 10 viên', 'Viên', 20, 'Tủ B - Ngăn tiêu hóa', 'Domesco', 'Việt Nam', 1200],
    ['TH-BERBERAL10', 'Berberal (10mg/ 120viên)', 'Berberin clorid 10mg', 'Viên bao đường', '10mg', 'Chai / Hộp 120 viên', 'Viên', 30, 'Tủ B - Ngăn tiêu hóa', 'Dược phẩm OPC', 'Việt Nam', 400],
    ['TH-BERBERAL100', 'Berberal (100mg/ 100viên)', 'Berberin clorid 100mg', 'Viên nén / bao', '100mg', 'Chai / Hộp 100 viên', 'Viên', 20, 'Tủ B - Ngăn tiêu hóa', 'Dược phẩm OPC', 'Việt Nam', 700],
    ['TH-CLOPHEN4', 'Clopheniramin (4 mg/200 viên)', 'Chlorpheniramine maleate 4mg', 'Viên nén', '4mg', 'Hộp / Chai 200 viên', 'Viên', 30, 'Tủ B - Ngăn dị ứng', 'Vidipha', 'Việt Nam', 350],
    ['TH-CALCIUM500', 'Calcium hasan (500mg/20 viên)', 'Calci nguyên tố 500mg', 'Viên sủi bọt', '500mg', 'Tuýp 20 viên', 'Viên', 10, 'Tủ B - Ngăn khoáng chất', 'Hasan-Dermapharm', 'Việt Nam', 3500],
    ['TH-UPSAC1G', 'Upsa C (1g/ 10 viên)', 'Acid ascorbic (Vitamin C 1000mg)', 'Viên sủi bọt', '1g', 'Tuýp 10 viên', 'Viên', 10, 'Tủ B - Ngăn vitamin', 'UPSA SAS', 'Pháp', 4500],
    ['TH-DANHASOT', 'Dán hạ sốt (1 hộp/    miếng)', 'Hydrogel làm mát hạ sốt', 'Miếng dán', 'Làm mát vật lý', 'Hộp 6 miếng', 'Miếng', 10, 'Tủ C - Ngăn hạ sốt sơ cứu', 'Kobayashi / Aikido', 'Nhật Bản / VN', 8000],
    ['TH-DAUPHATLINH', 'Dầu phật linh <', 'Bạc hà, Menthol, Đinh hương, Long não', 'Dầu xoa bóp', '5ml', 'Chai 5ml', 'Chai', 5, 'Tủ A - Ngăn ngoài', 'Trường Sơn', 'Việt Nam', 15000],
    ['TH-DAUXANHTS', 'Dầu Xanh Trường sơn >', 'Eucalyptol, Menthol, Methyl salicylate', 'Dầu xoa', '6ml', 'Chai 6ml', 'Chai', 5, 'Tủ A - Ngăn ngoài', 'Trường Sơn', 'Việt Nam', 18000],
    ['TH-GON-BT', 'Gòn BT viên (bịch)', '100% Cotton y tế vô trùng', 'Bông gòn viên', 'Bịch 500g', 'Bịch 500g', 'Bịch', 4, 'Tủ C - Ngăn bông băng gạc', 'Bảo Thạch', 'Việt Nam', 45000],
    ['TH-GON-BACHTUYET', 'Gòn Bạch tuyết (bịch)', '100% Cotton y tế cao cấp', 'Bông cuộn', 'Bịch 100g', 'Bịch 100g', 'Bịch', 5, 'Tủ C - Ngăn bông băng gạc', 'Bạch Tuyết', 'Việt Nam', 16000],
    ['TH-GAC-TIETTRUNG', 'Gạc tiệt trùng < (bịch)', 'Sợi cotton tiệt trùng vô khuẩn', 'Gạc vuông xếp nếp', '8cm x 10cm', 'Bịch 10 gói x 10 miếng', 'Bịch', 10, 'Tủ C - Ngăn bông băng gạc', 'Bảo Thạch', 'Việt Nam', 25000],
    ['TH-BANGKEO-CANHAN', 'Băng keo cá nhân', 'Màng PE co giãn, gạc vô trùng', 'Băng dán cá nhân', 'Miếng tiêu chuẩn', 'Hộp 100 miếng', 'Miếng', 50, 'Tủ C - Ngăn sơ cứu', 'Urgo Healthcare', 'Việt Nam', 500],
    ['TH-BANGKEO-URGO', 'Băng keo urgo 2,5cmx5m (cuộn)', 'Keo kẽm oxyde, nền vải lụa', 'Cuộn băng dính', '2.5cm x 5m', 'Cuộn 2.5cm x 5m', 'Cuộn', 5, 'Tủ C - Ngăn băng dán cố định', 'Urgo Healthcare', 'Pháp', 22000],
    ['TH-NACL09-500', 'Nước muối sinh lý (chai lớn)', 'Natri clorid 0.9%', 'Dung dịch rửa ngoài', '0.9% (500ml)', 'Chai 500ml', 'Chai', 5, 'Tủ C - Kệ dung dịch', 'Vĩnh Phúc', 'Việt Nam', 8000],
    ['TH-NACL09-MAT', 'Nưới muối nhỏ mắt (lọ)', 'Natri clorid 0.9% vô trùng', 'Dung dịch nhỏ mắt mũi', '0.9% (10ml)', 'Lọ 10ml', 'Lọ', 15, 'Tủ B - Ngăn nhỏ mắt mũi', 'Pharmedic', 'Việt Nam', 4000],
    ['TH-BANGTHUN', 'Băng thun 2 móc, 3 móc', 'Sợi cotton co giãn kèm móc cài', 'Cuộn băng chun', 'Loại 2 móc / 3 móc', 'Cuộn kèm móc gài', 'Cuộn', 5, 'Tủ C - Ngăn nẹp chấn thương', 'Bảo Thạch', 'Việt Nam', 12000],
    ['TH-OXYGIA', 'Oxy già', 'Hydrogen peroxide 3%', 'Dung dịch rửa vết thương', '3% (60ml)', 'Chai 60ml', 'Chai', 5, 'Tủ C - Ngăn sát khuẩn', 'Pharmedic', 'Việt Nam', 5000],
    ['TH-ALCOL90', 'Alcol 90', 'Ethanol 90%', 'Dung dịch sát trùng dụng cụ', '90° (500ml)', 'Chai 500ml', 'Chai', 4, 'Kệ dưới tủ C', 'Vĩnh Phúc', 'Việt Nam', 24000],
    ['TH-ALCOL70', 'Alcol 70', 'Ethanol 70%', 'Dung dịch sát khuẩn', '70° (500ml)', 'Chai 500ml', 'Chai', 5, 'Tủ C - Ngăn sát khuẩn', 'Vĩnh Phúc', 'Việt Nam', 22000],
    ['TH-POVIDIN', 'Povidin', 'Povidone Iodine 10%', 'Dung dịch sát khuẩn ngoài da', '10% (20ml)', 'Chai 20ml', 'Chai', 6, 'Tủ C - Ngăn sát trùng ngoài da', 'Pharmedic', 'Việt Nam', 8500],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhMucThuocChuan');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 15 }, // Mã thuốc
    { wch: 32 }, // Tên thuốc
    { wch: 25 }, // Hoạt chất
    { wch: 22 }, // Dạng bào chế
    { wch: 18 }, // Hàm lượng
    { wch: 22 }, // Quy cách
    { wch: 12 }, // Đơn vị
    { wch: 16 }, // Tồn tối thiểu
    { wch: 24 }, // Vị trí
    { wch: 26 }, // Nhà sản xuất
    { wch: 16 }, // Nước
    { wch: 14 }, // Đơn giá
  ];

  XLSX.writeFile(workbook, 'File_Chuan_Nhap_DanhMuc_Thuoc_VatTu_YTe.xlsx');
};

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Vui lòng chọn file Excel đã chuẩn bị.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        throw new Error('File Excel trống hoặc không có dòng dữ liệu sau tiêu đề.');
      }

      const headers = jsonData[0].map((h: any) => String(h || '').trim().toLowerCase());

      // Search flexible column indices
      const codeIdx = headers.findIndex((h) => h.includes('mã'));
      const nameIdx = headers.findIndex((h) => h.includes('tên'));
      const activeIdx = headers.findIndex((h) => h.includes('hoạt chất'));
      const formIdx = headers.findIndex((h) => h.includes('bào chế') || h.includes('dạng'));
      const strengthIdx = headers.findIndex((h) => h.includes('hàm lượng') || h.includes('nồng độ'));
      const packingIdx = headers.findIndex((h) => h.includes('quy cách') || h.includes('đóng gói'));
      const unitIdx = headers.findIndex((h) => h.includes('đơn vị'));
      const minStockIdx = headers.findIndex((h) => h.includes('tối thiểu') || h.includes('định mức'));
      const locIdx = headers.findIndex((h) => h.includes('vị trí') || h.includes('tủ') || h.includes('ngăn'));
      const mfgIdx = headers.findIndex((h) => h.includes('nhà sản xuất') || h.includes('nsx'));
      const countryIdx = headers.findIndex((h) => h.includes('nước') || h.includes('xuất xứ'));
      const priceIdx = headers.findIndex((h) => h.includes('đơn giá') || h.includes('giá'));

      if (nameIdx === -1) {
        throw new Error(
          'Không tìm thấy cột "Tên thuốc" trong file Excel. Vui lòng nhấn "Tải file mẫu chuẩn" để lấy đúng cấu trúc file.'
        );
      }

      let imported = 0;
      const medicines = db.getMedicines();

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0 || !row[nameIdx]) continue;

        const name = String(row[nameIdx] || '').trim();
        if (!name) continue;

        const code = codeIdx >= 0 && row[codeIdx] ? String(row[codeIdx]).trim() : `YT-${Date.now().toString().slice(-4)}${i}`;
        const existingMed = medicines.find((m) => m.code.toLowerCase() === code.toLowerCase() || m.name.toLowerCase() === name.toLowerCase());

        const medData = {
          code,
          name,
          activeIngredient: activeIdx >= 0 ? String(row[activeIdx] || '').trim() : '',
          dosageForm: formIdx >= 0 ? String(row[formIdx] || '').trim() : 'Viên nén',
          strength: strengthIdx >= 0 ? String(row[strengthIdx] || '').trim() : '',
          packing: packingIdx >= 0 ? String(row[packingIdx] || '').trim() : '',
          unit: unitIdx >= 0 ? String(row[unitIdx] || 'Viên').trim() : 'Viên',
          minStock: minStockIdx >= 0 && !isNaN(Number(row[minStockIdx])) ? Number(row[minStockIdx]) : 10,
          storageLocation: locIdx >= 0 ? String(row[locIdx] || 'Tủ A - Phòng y tế').trim() : 'Tủ A - Phòng y tế',
          manufacturer: mfgIdx >= 0 ? String(row[mfgIdx] || '').trim() : '',
          country: countryIdx >= 0 ? String(row[countryIdx] || '').trim() : 'Việt Nam',
          unitPrice: priceIdx >= 0 && !isNaN(Number(row[priceIdx])) ? Number(row[priceIdx]) : 0,
          supplierId: 'sup-01',
        };

        if (existingMed) {
          db.updateMedicine(existingMed.id, medData);
        } else {
          db.addMedicine(medData);
        }
        imported++;
      }

      if (imported === 0) {
        throw new Error('Không tìm thấy dòng dữ liệu thuốc nào hợp lệ để nhập.');
      }

      setSuccessCount(imported);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đọc file Excel.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Nhập Danh Mục Thuốc & Vật Tư Từ Excel</h2>
              <p className="text-xs text-slate-500">Tải file chuẩn, nhập thông tin và tải lên hệ thống</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {successCount > 0 ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Nhập Dữ Liệu Thành Công!</h3>
              <p className="text-slate-600 text-sm">
                Đã thêm mới và cập nhật thành công <strong>{successCount}</strong> danh mục thuốc & vật tư y tế vào hệ thống.
              </p>
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-xs text-sm"
              >
                Hoàn Tất & Xem Danh Mục
              </button>
            </div>
          ) : (
            <>
              {/* STEP 1: DOWNLOAD STANDARD FILE */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-200 text-blue-900 mb-1">
                      BƯỚC 1: LẤY FILE CHUẨN ĐỂ NHẬP
                    </span>
                    <h4 className="text-xs font-bold text-blue-950">
                      Tải File Mẫu Chuẩn Excel (.xlsx) Của Phòng Y Tế
                    </h4>
                    <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                      File mẫu đã cấu hình sẵn 12 cột chuẩn Bộ Y Tế & GD&ĐT (Mã thuốc, Hoạt chất, Hàm lượng, Tủ bảo quản, Đơn giá...).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={downloadStandardMedicineTemplate}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>TẢI VỀ FILE CHUẨN EXCEL (.XLSX)</span>
                </button>
              </div>

              {/* STEP 2: UPLOAD FILE */}
              <div className="space-y-2">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-900">
                  BƯỚC 2: TẢI FILE ĐÃ ĐIỀN LÊN HỆ THỐNG
                </span>

                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    file
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                  />

                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileCheck className="w-10 h-10 text-emerald-600" />
                      <span className="font-bold text-slate-900 text-sm">{file.name}</span>
                      <span className="text-xs text-emerald-700 font-medium">
                        {(file.size / 1024).toFixed(1)} KB • Sẵn sàng nhập
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="font-bold text-slate-800 text-xs">
                        Nhấn để chọn file Excel (.xlsx, .xls) hoặc kéo thả vào đây
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Hệ thống sẽ tự động đối soát và nạp vào danh mục kho thuốc
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-rose-700 bg-rose-50 p-3 rounded-xl text-xs border border-rose-200">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <p>{error}</p>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 text-xs font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!file || loading}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xs"
                >
                  {loading ? (
                    <span>Đang đọc & xử lý file...</span>
                  ) : (
                    <>
                      <span>Tiến Hành Nhập Danh Mục</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
