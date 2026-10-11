import React, { useState } from 'react';
import {
  X,
  UserCheck,
  Building,
  Save,
  RotateCcw,
  CheckCircle2,
  FileSignature,
  FileText,
  Calendar,
} from 'lucide-react';
import {
  templateConfigService,
  TemplateConfig,
  DEFAULT_TEMPLATE_CONFIG,
} from '../services/templateConfigService';

interface ReportSignerConfigModalProps {
  onClose: () => void;
  onSaved?: () => void;
}

export const ReportSignerConfigModal: React.FC<ReportSignerConfigModalProps> = ({
  onClose,
  onSaved,
}) => {
  const [config, setConfig] = useState<TemplateConfig>(() => templateConfigService.getConfig());
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = () => {
    templateConfigService.saveConfig(config);
    setToast('Đã lưu cấu hình người ký & tiêu đề báo cáo thành công!');
    setTimeout(() => {
      setToast(null);
      if (onSaved) onSaved();
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    templateConfigService.resetConfig();
    setConfig(DEFAULT_TEMPLATE_CONFIG);
    setToast('Đã khôi phục cài đặt mặc định!');
    setTimeout(() => setToast(null), 1500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl my-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Tùy Chỉnh Người Ký Tên & Tiêu Đề Báo Cáo
              </h2>
              <p className="text-xs text-slate-500">
                Áp dụng cho tất cả sổ sách, biên bản, xuất Word, Excel và In ấn A4
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

        {/* Success Toast */}
        {toast && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{toast}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Section 1: Đơn vị & Cơ quan */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm pb-2 border-b border-slate-200">
              <Building className="w-4 h-4 text-slate-600" />
              <span>Thông Tin Đơn Vị & Địa Danh</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Cơ quan cấp trên / Phòng GD&ĐT</label>
                <input
                  type="text"
                  value={config.governingBody}
                  onChange={(e) => setConfig({ ...config, governingBody: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tên trường học</label>
                <input
                  type="text"
                  value={config.schoolName}
                  onChange={(e) => setConfig({ ...config, schoolName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Bộ phận chuyên trách</label>
                <input
                  type="text"
                  value={config.department}
                  onChange={(e) => setConfig({ ...config, department: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Địa danh xuất báo cáo</label>
                <input
                  type="text"
                  value={config.location}
                  onChange={(e) => setConfig({ ...config, location: e.target.value })}
                  placeholder="VD: Đông Thạnh"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-600 font-semibold mb-1">
                  Ngày tháng ký báo cáo (để trống để tự động lấy theo ngày in/xuất file)
                </label>
                <input
                  type="text"
                  value={config.customDateStr}
                  onChange={(e) => setConfig({ ...config, customDateStr: e.target.value })}
                  placeholder="Để trống = 'Đông Thạnh, ngày ... tháng ... năm ...'"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Người Ký Báo Cáo */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm pb-2 border-b border-slate-200">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Chức Danh & Họ Tên Người Ký Báo Cáo</span>
            </div>

            {/* Chữ ký 1 */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-indigo-900 text-xs flex items-center justify-between">
                <span>1. Người Lập Báo Cáo / Cán Bộ Y Tế</span>
                <span className="text-[10px] text-slate-400 font-normal">Cột chữ ký bên trái</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Tiêu đề chức danh:</label>
                  <input
                    type="text"
                    value={config.signatory1Title}
                    onChange={(e) => setConfig({ ...config, signatory1Title: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Ghi chú ký:</label>
                  <input
                    type="text"
                    value={config.signatory1Sub}
                    onChange={(e) => setConfig({ ...config, signatory1Sub: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Họ và tên người ký:</label>
                  <input
                    type="text"
                    value={config.signatory1Name}
                    onChange={(e) => setConfig({ ...config, signatory1Name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Chữ ký 2 */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-indigo-900 text-xs flex items-center justify-between">
                <span>2. Lãnh Đạo Duyệt / Hiệu Trưởng</span>
                <span className="text-[10px] text-slate-400 font-normal">Cột chữ ký bên phải</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Tiêu đề chức danh:</label>
                  <input
                    type="text"
                    value={config.signatory2Title}
                    onChange={(e) => setConfig({ ...config, signatory2Title: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Ghi chú ký:</label>
                  <input
                    type="text"
                    value={config.signatory2Sub}
                    onChange={(e) => setConfig({ ...config, signatory2Sub: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Họ và tên người ký:</label>
                  <input
                    type="text"
                    value={config.signatory2Name}
                    onChange={(e) => setConfig({ ...config, signatory2Name: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Chữ ký 3 (Kế toán / Thủ kho) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900 text-xs">
                  <input
                    type="checkbox"
                    checked={config.showSignatory3}
                    onChange={(e) => setConfig({ ...config, showSignatory3: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>3. Bật cột chữ ký thứ ba (Kế toán / Thủ kho / Kiểm soát)</span>
                </label>
                <span className="text-[10px] text-slate-400">Cột chữ ký ở giữa</span>
              </div>

              {config.showSignatory3 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Tiêu đề chức danh:</label>
                    <input
                      type="text"
                      value={config.signatory3Title}
                      onChange={(e) => setConfig({ ...config, signatory3Title: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Ghi chú ký:</label>
                    <input
                      type="text"
                      value={config.signatory3Sub}
                      onChange={(e) => setConfig({ ...config, signatory3Sub: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Họ và tên người ký:</label>
                    <input
                      type="text"
                      value={config.signatory3Name}
                      onChange={(e) => setConfig({ ...config, signatory3Name: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-100"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục mặc định
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
            >
              <Save className="w-4 h-4" />
              Lưu Cấu Hình Người Ký
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
