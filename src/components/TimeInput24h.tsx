import React, { useState, useRef, useEffect } from 'react';
import { Clock, X, Check, RotateCcw } from 'lucide-react';
import { getCurrentTimeVN } from '../utils/helpers';

interface TimeInput24hProps {
  id?: string;
  label?: string;
  value: string; // Format "HH:mm" (24h, 00:00 - 23:59)
  onChange: (time: string) => void;
  required?: boolean;
  placeholder?: string;
  baseTime?: string; // Giờ cơ sở để tính +15p, +30p, +45p (ví dụ giờ vào)
  allowClear?: boolean;
  showQuickButtons?: boolean;
  disabled?: boolean;
  className?: string;
}

// Lấy giờ hiện tại của Việt Nam (Asia/Ho_Chi_Minh, GMT+7) 24h: "HH:mm"
export function getCurrentTime24h(): string {
  return getCurrentTimeVN();
}

// Cộng thêm số phút vào chuỗi HH:mm 24h
export function addMinutesToTime24h(baseTimeStr: string, minutesToAdd: number): string {
  if (!baseTimeStr || !baseTimeStr.includes(':')) {
    baseTimeStr = getCurrentTime24h();
  }
  const [hStr, mStr] = baseTimeStr.split(':');
  let h = parseInt(hStr, 10) || 0;
  let m = parseInt(mStr, 10) || 0;

  let totalMinutes = h * 60 + m + minutesToAdd;
  // Xử lý vòng 24h (1440 phút)
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;

  const newH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const newM = String(totalMinutes % 60).padStart(2, '0');
  return `${newH}:${newM}`;
}

export const TimeInput24h: React.FC<TimeInput24hProps> = ({
  id,
  label,
  value,
  onChange,
  required = false,
  placeholder = 'HH:mm (24h)',
  baseTime,
  allowClear = true,
  showQuickButtons = true,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Đồng bộ prop value với local state
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Đóng popover khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Phân tách giờ và phút hiện tại từ value
  const [currentHourStr, currentMinuteStr] = (value || '08:00').split(':');
  const currentHour = parseInt(currentHourStr, 10) || 0;
  const currentMinute = parseInt(currentMinuteStr, 10) || 0;

  // Xử lý khi người dùng nhập trực tiếp từ bàn phím
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Chỉ cho phép số và dấu hai chấm
    val = val.replace(/[^0-9:]/g, '');

    // Tự động chèn dấu hai chấm nếu người dùng gõ 2 chữ số (ví dụ: 14 -> 14:)
    if (val.length === 2 && !val.includes(':') && !inputValue.endsWith(':')) {
      const h = parseInt(val, 10);
      if (h >= 0 && h <= 23) {
        val = val + ':';
      }
    }

    if (val.length <= 5) {
      setInputValue(val);
      // Nếu nhập đủ 5 ký tự dạng HH:mm
      if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val)) {
        const [h, m] = val.split(':');
        const normalized = `${String(parseInt(h, 10)).padStart(2, '0')}:${String(parseInt(m, 10)).padStart(2, '0')}`;
        onChange(normalized);
      }
    }
  };

  const handleBlur = () => {
    if (!inputValue.trim()) {
      if (!required) {
        onChange('');
        setInputValue('');
      } else {
        const now = getCurrentTime24h();
        onChange(now);
        setInputValue(now);
      }
      return;
    }

    // Chuẩn hóa định dạng nếu nhập thiếu (ví dụ "8:3" -> "08:03", "8" -> "08:00", "1430" -> "14:30")
    let raw = inputValue.replace(/[^0-9]/g, '');
    if (raw.length === 3) {
      // ví dụ 830 -> 08:30
      raw = '0' + raw;
    }
    if (raw.length === 4) {
      const h = parseInt(raw.slice(0, 2), 10);
      const m = parseInt(raw.slice(2, 4), 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        const normalized = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange(normalized);
        setInputValue(normalized);
        return;
      }
    }

    if (inputValue.includes(':')) {
      const [hStr, mStr] = inputValue.split(':');
      let h = parseInt(hStr, 10);
      let m = parseInt(mStr, 10);
      if (!isNaN(h) && h >= 0 && h <= 23) {
        if (isNaN(m) || m < 0 || m > 59) m = 0;
        const normalized = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange(normalized);
        setInputValue(normalized);
        return;
      }
    }

    // Nếu không hợp lệ, khôi phục lại giá trị hợp lệ trước đó hoặc giờ hiện tại
    if (value) {
      setInputValue(value);
    } else if (required) {
      const now = getCurrentTime24h();
      onChange(now);
      setInputValue(now);
    } else {
      onChange('');
      setInputValue('');
    }
  };

  const setHour = (h: number) => {
    const formattedH = String(h).padStart(2, '0');
    const formattedM = String(currentMinute).padStart(2, '0');
    const newVal = `${formattedH}:${formattedM}`;
    onChange(newVal);
    setInputValue(newVal);
  };

  const setMinute = (m: number) => {
    const formattedH = String(currentHour).padStart(2, '0');
    const formattedM = String(m).padStart(2, '0');
    const newVal = `${formattedH}:${formattedM}`;
    onChange(newVal);
    setInputValue(newVal);
  };

  const handleSetNow = () => {
    const now = getCurrentTime24h();
    onChange(now);
    setInputValue(now);
  };

  const handleClear = () => {
    onChange('');
    setInputValue('');
  };

  // Mảng giờ 00 đến 23 (24h)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Mảng phút thông dụng: 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
  const commonMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-mono">
            24H
          </span>
        </div>
      )}

      {/* Input Field Control */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-2][0-9]:[0-5][0-9]"
          required={required}
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded-xl px-3 py-2 pr-16 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
        />

        {/* Action icons right inside the input */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {allowClear && !required && value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
              title="Xóa giờ"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className={`p-1.5 rounded-lg border transition-all ${
              isOpen
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border-slate-200'
            }`}
            title="Mở bảng chọn giờ 24h"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick helper buttons below the input */}
      {showQuickButtons && !disabled && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSetNow}
            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200 transition-colors"
            title="Lấy giờ hiện tại trên máy"
          >
            Bây giờ ({getCurrentTime24h()})
          </button>

          {/* Quick offsets if baseTime is given (e.g. for Giờ ra dự kiến) */}
          {baseTime && (
            <>
              {[15, 30, 45, 60].map((mins) => {
                const calculated = addMinutesToTime24h(baseTime, mins);
                const isSelected = value === calculated;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      onChange(calculated);
                      setInputValue(calculated);
                    }}
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                    title={`Nghỉ ${mins} phút kể từ giờ vào (${baseTime} ➔ ${calculated})`}
                  >
                    +{mins}p ({calculated})
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Interactive 24-Hour Picker Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-slate-300 rounded-2xl shadow-xl p-3 w-72 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">Chọn giờ 24h</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                {value || '00:00'}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Grid Layout: Giờ (00-23) & Phút (00-55) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Cột 1: Giờ 00 đến 23 */}
            <div>
              <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span>Giờ (00 - 23)</span>
                <span className="text-[10px] text-emerald-700 font-mono font-bold">
                  {String(currentHour).padStart(2, '0')}h
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-1 bg-slate-50 space-y-0.5">
                {hours.map((h) => {
                  const isSelected = h === currentHour;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHour(h)}
                      className={`w-full text-left px-2.5 py-1 rounded-lg font-mono text-xs font-semibold flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-white hover:text-emerald-800'
                      }`}
                    >
                      <span>{String(h).padStart(2, '0')}:00</span>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cột 2: Phút 00 đến 55 */}
            <div>
              <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span>Phút</span>
                <span className="text-[10px] text-emerald-700 font-mono font-bold">
                  {String(currentMinute).padStart(2, '0')}p
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-1 bg-slate-50 space-y-0.5">
                {commonMinutes.map((m) => {
                  const isSelected = m === currentMinute;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMinute(m);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1 rounded-lg font-mono text-xs font-semibold flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-white hover:text-emerald-800'
                      }`}
                    >
                      <span>:{String(m).padStart(2, '0')}</span>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer presets */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={handleSetNow}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt giờ hiện tại</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-xs"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
