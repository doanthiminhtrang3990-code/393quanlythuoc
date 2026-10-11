import { formatDateFormulaVN } from '../utils/helpers';

// Service quản lý cấu hình biểu mẫu báo cáo, sổ y tế học đường
// Cho phép tùy chỉnh tên trường, cơ quan cấp trên, chức danh chữ ký, ngày tháng, ghi chú

export interface TemplateConfig {
  governingBody: string;       // Cơ quan chủ quản (VD: PHÒNG GD&ĐT HUYỆN HÓC MÔN)
  schoolName: string;          // Tên trường (VD: TRƯỜNG THCS ĐÔNG THẠNH)
  department: string;          // Bộ phận (VD: Bộ phận: Phòng Y Tế Học Đường)
  nationalTitle: string;       // Quốc hiệu
  nationalMotto: string;       // Tiêu ngữ
  location: string;            // Địa danh (VD: Đông Thạnh)
  customDateStr: string;       // Chuỗi ngày tháng tự nhập hoặc rỗng để tự động
  academicYear: string;        // Năm học (VD: 2026 - 2027)
  legalBasis: string;          // Căn cứ pháp lý chân trang
  
  // Chữ ký 1: Cán bộ y tế
  signatory1Title: string;
  signatory1Sub: string;
  signatory1Name: string;

  // Chữ ký 2: Hiệu trưởng / Lãnh đạo duyệt
  signatory2Title: string;
  signatory2Sub: string;
  signatory2Name: string;

  // Chữ ký 3: Kế toán / Phụ trách khác (tùy chọn)
  showSignatory3: boolean;
  signatory3Title: string;
  signatory3Sub: string;
  signatory3Name: string;

  // Tùy chỉnh tiêu đề riêng cho từng mẫu
  customTitles: {
    mau1: string;
    mau2: string;
    mau3: string;
    mau4: string;
    mau5: string;
    mau6: string;
  };

  // Định dạng in ấn
  orientation: 'portrait' | 'landscape';
  fontSize: '10pt' | '11pt' | '12pt';
}

const STORAGE_KEY = 'school_health_custom_template_config_v1';

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  governingBody: 'PHÒNG GD&ĐT HUYỆN HÓC MÔN',
  schoolName: 'TRƯỜNG THCS ĐÔNG THẠNH',
  department: 'Bộ phận: Phòng Y Tế Học Đường',
  nationalTitle: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
  nationalMotto: 'Độc lập - Tự do - Hạnh phúc',
  location: 'Đông Thạnh',
  customDateStr: '',
  academicYear: '2026 - 2027',
  legalBasis: 'Căn cứ Thông tư liên tịch số 13/2016/TTLT-BYT-BGDĐT quy định về công tác y tế trường học',
  
  signatory1Title: 'CÁN BỘ Y TẾ TRƯỜNG HỌC',
  signatory1Sub: '(Ký và ghi rõ họ tên)',
  signatory1Name: 'Y sĩ Trần Thị Bích Thảo',

  signatory2Title: 'HIỆU TRƯỞNG PHÊ DUYỆT',
  signatory2Sub: '(Ký, đóng dấu)',
  signatory2Name: 'Ban Giám Hiệu',

  showSignatory3: false,
  signatory3Title: 'KẾ TOÁN / THỦ KHO',
  signatory3Sub: '(Ký và ghi rõ họ tên)',
  signatory3Name: 'Đại diện kiểm soát',

  customTitles: {
    mau1: 'SỔ THEO DÕI HỌC SINH ĐẾN PHÒNG Y TẾ',
    mau2: 'SỔ THEO DÕI THUỐC VÀ VẬT TƯ Y TẾ ĐÃ SỬ DỤNG',
    mau3: 'BÁO CÁO CÔNG TÁC Y TẾ TRƯỜNG HỌC ĐỊNH KỲ',
    mau4: 'DANH SÁCH HỌC SINH CẦN THEO DÕI SỨC KHỎE ĐẶC BIỆT',
    mau5: 'SỔ THEO DÕI NHẬP - XUẤT - TỒN THUỐC VÀ VẬT TƯ Y TẾ',
    mau6: 'BIÊN BẢN XỬ LÝ SỰ CỐ TAI NẠN THƯƠNG TÍCH HỌC ĐƯỜNG',
  },

  orientation: 'portrait',
  fontSize: '11pt',
};

export const templateConfigService = {
  getConfig(): TemplateConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_TEMPLATE_CONFIG,
          ...parsed,
          customTitles: {
            ...DEFAULT_TEMPLATE_CONFIG.customTitles,
            ...(parsed.customTitles || {}),
          },
        };
      }
    } catch (e) {
      console.warn('Lỗi đọc cấu hình biểu mẫu từ localStorage:', e);
    }
    return { ...DEFAULT_TEMPLATE_CONFIG };
  },

  saveConfig(config: TemplateConfig) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Lỗi lưu cấu hình biểu mẫu:', e);
    }
  },

  resetConfig(): TemplateConfig {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Lỗi xóa cấu hình biểu mẫu:', e);
    }
    return { ...DEFAULT_TEMPLATE_CONFIG };
  },

  getDateString(config: TemplateConfig): string {
    if (config.customDateStr && config.customDateStr.trim()) {
      return config.customDateStr.trim();
    }
    return formatDateFormulaVN(new Date(), true, config.location || 'Đông Thạnh');
  },
};
