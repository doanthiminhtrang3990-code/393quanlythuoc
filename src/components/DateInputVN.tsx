import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, X } from 'lucide-react';
import {
  isoToVNDate,
  parseVNDateToISO,
  getCurrentDateISO,
  getCurrentDateVN,
  getCurrentTimeVN,
  getVietnamDateParts,
} from '../utils/helpers';

interface DateInputVNProps {
  value: string; // ISO "YYYY-MM-DD" or "dd/mm/yyyy" or ""
  onChange: (isoDate: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showTodayButton?: boolean;
  allowClear?: boolean;
  min?: string;
  max?: string;
  title?: string;
}

/**
 * Formats raw user input into "dd/mm/yyyy" using "/" as they type digits.
 */
function autoMaskDDMMYYYY(raw: string): string {
  // If user explicitly types slashes or dashes, normalize '-' and '.' to '/'
  const normalized = raw.replace(/[\-.]/g, '/');

  // If user typed something with slashes like "5/9/2026", allow it while typing
  if (normalized.includes('/')) {
    const cleaned = normalized.replace(/[^0-9/]/g, '');
    const parts = cleaned.split('/');
    if (parts.length === 1) return parts[0].slice(0, 2);
    if (parts.length === 2) {
      const p0 = parts[0].length === 1 && cleaned.indexOf('/') === 1 ? '0' + parts[0] : parts[0].slice(0, 2);
      return `${p0}/${parts[1].slice(0, 2)}`;
    }
    const p0 = parts[0].length === 1 ? '0' + parts[0] : parts[0].slice(0, 2);
    const p1 = parts[1].length === 1 ? '0' + parts[1] : parts[1].slice(0, 2);
    const p2 = parts.slice(2).join('').slice(0, 4);
    return `${p0}/${p1}/${p2}`;
  }

  // Pure digits: auto-insert "/" at positions 2 and 4 -> dd/mm/yyyy
  const digits = normalized.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export const DateInputVN: React.FC<DateInputVNProps> = ({
  value,
  onChange,
  id,
  placeholder = 'dd/mm/yyyy',
  required = false,
  disabled = false,
  className = '',
  showTodayButton = false,
  allowClear = false,
  min,
  max,
  title,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => isoToVNDate(value));
  const [isInvalid, setIsInvalid] = useState(false);
  const nativeDateRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(isoToVNDate(value));
      setIsInvalid(false);
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw.trim()) {
      setDisplayValue('');
      setIsInvalid(false);
      onChange('');
      return;
    }

    const isDeleting = raw.length < displayValue.length;
    let nextDisplay = raw;

    if (!isDeleting) {
      // Only auto-insert slashes when typing forward pure digits (e.g. 02102026 -> 02/10/2026)
      const normalized = raw.replace(/[\-.]/g, '/');
      if (!normalized.includes('/')) {
        const digits = normalized.replace(/\D/g, '').slice(0, 8);
        if (digits.length <= 2) nextDisplay = digits;
        else if (digits.length <= 4) nextDisplay = `${digits.slice(0, 2)}/${digits.slice(2)}`;
        else nextDisplay = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
      } else {
        // Allow free typing with slashes (e.g. 2/10/2026 or 15/10/2026) without prematurely padding single digits
        nextDisplay = normalized.replace(/[^0-9/]/g, '').slice(0, 10);
      }
    } else {
      nextDisplay = raw;
    }

    setDisplayValue(nextDisplay);

    // Immediately sync to parent if a valid date is formed (e.g. d/m/yyyy or dd/mm/yyyy)
    const trimmed = nextDisplay.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const iso = parseVNDateToISO(trimmed);
      if (iso) {
        setIsInvalid(false);
        onChange(iso);
      } else {
        setIsInvalid(true);
      }
    } else {
      setIsInvalid(false);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const trimmed = displayValue.trim().replace(/[\-.]/g, '/');
    if (!trimmed) {
      setIsInvalid(false);
      if (value !== '') onChange('');
      return;
    }

    let candidate = trimmed;
    // Pure 8 digits: 02102026 -> 02/10/2026
    if (/^\d{8}$/.test(candidate)) {
      candidate = `${candidate.slice(0, 2)}/${candidate.slice(2, 4)}/${candidate.slice(4, 8)}`;
    } else if (/^\d{6}$/.test(candidate)) {
      // 6 digits: 021026 -> 02/10/2026
      const yy = parseInt(candidate.slice(4, 6), 10);
      const fullYear = yy >= 50 ? 1900 + yy : 2000 + yy;
      candidate = `${candidate.slice(0, 2)}/${candidate.slice(2, 4)}/${fullYear}`;
    } else {
      // Try flexible d/m/yy
      const shortYearMatch = candidate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (shortYearMatch) {
        const yy = parseInt(shortYearMatch[3], 10);
        const fullYear = yy >= 50 ? 1900 + yy : 2000 + yy;
        candidate = `${shortYearMatch[1].padStart(2, '0')}/${shortYearMatch[2].padStart(2, '0')}/${fullYear}`;
      }
    }

    const iso = parseVNDateToISO(candidate);
    if (iso) {
      setDisplayValue(isoToVNDate(iso));
      setIsInvalid(false);
      onChange(iso);
    } else {
      if (value) {
        setDisplayValue(isoToVNDate(value));
        setIsInvalid(false);
      } else {
        setIsInvalid(true);
      }
    }
  };

  const handleOpenPicker = () => {
    if (disabled) return;
    if (nativeDateRef.current) {
      try {
        if (typeof (nativeDateRef.current as any).showPicker === 'function') {
          (nativeDateRef.current as any).showPicker();
        } else {
          nativeDateRef.current.focus();
          nativeDateRef.current.click();
        }
      } catch {
        nativeDateRef.current.focus();
      }
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIso = e.target.value;
    setDisplayValue(isoToVNDate(newIso));
    setIsInvalid(false);
    onChange(newIso);
  };

  const handleSetTodayVN = () => {
    if (disabled) return;
    const todayIso = getCurrentDateISO();
    setDisplayValue(getCurrentDateVN());
    setIsInvalid(false);
    onChange(todayIso);
  };

  // Current ISO value for the hidden native date picker
  const currentIsoValue = (() => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return parseVNDateToISO(value) || '';
  })();

  return (
    <div className="relative flex items-center w-full" title={title || 'Định dạng chuẩn Việt Nam: dd/mm/yyyy (VD: 29/09/2026)'}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleTextChange}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={10}
        className={`${className} pr-8 font-mono tracking-tight ${
          isInvalid ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30' : ''
        }`}
      />

      {/* Hidden native date input for popup calendar */}
      <input
        ref={nativeDateRef}
        type="date"
        value={currentIsoValue}
        min={min}
        max={max}
        onChange={handleNativeDateChange}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none absolute right-0 top-0 w-0 h-0 opacity-0"
      />

      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {allowClear && displayValue && !disabled && (
          <button
            type="button"
            onClick={() => {
              setDisplayValue('');
              setIsInvalid(false);
              onChange('');
            }}
            title="Xóa ngày"
            className="p-0.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {showTodayButton && !disabled && (
          <button
            type="button"
            onClick={handleSetTodayVN}
            title="Lấy ngày hôm nay theo giờ Việt Nam (GMT+7)"
            className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
          >
            Hôm nay
          </button>
        )}

        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={disabled}
          title="Chọn ngày trên lịch (dd/mm/yyyy)"
          className="p-1 text-slate-400 hover:text-emerald-700 disabled:opacity-40 rounded transition-colors cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface DateTimeInputVNProps {
  value: string; // "YYYY-MM-DDTHH:mm" or ISO string
  onChange: (isoDateTime: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Combined Date (dd/mm/yyyy with "/") + Time (HH:mm 24h Vietnam time) input
 */
export const DateTimeInputVN: React.FC<DateTimeInputVNProps> = ({
  value,
  onChange,
  className = '',
  required = false,
  disabled = false,
}) => {
  // Extract date part (YYYY-MM-DD) and time part (HH:mm) in Vietnam timezone
  const parseParts = (val: string): { dateIso: string; time24: string } => {
    if (!val) {
      return { dateIso: getCurrentDateISO(), time24: getCurrentTimeVN() };
    }
    const localMatch = val.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
    if (localMatch) {
      return { dateIso: localMatch[1], time24: localMatch[2] };
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const p = getVietnamDateParts(d);
      return {
        dateIso: `${p.year}-${p.month}-${p.day}`,
        time24: `${p.hours}:${p.minutes}`,
      };
    }
    return { dateIso: getCurrentDateISO(), time24: getCurrentTimeVN() };
  };

  const { dateIso, time24 } = parseParts(value);
  const [timeText, setTimeText] = useState(time24);
  const isTimeFocusedRef = useRef(false);

  useEffect(() => {
    if (!isTimeFocusedRef.current) {
      setTimeText(parseParts(value).time24);
    }
  }, [value]);

  const handleDatePartChange = (newDateIso: string) => {
    const dIso = newDateIso || getCurrentDateISO();
    onChange(`${dIso}T${timeText || '08:00'}`);
  };

  const handleTimePartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    const isDeleting = inputVal.length < timeText.length;
    let raw = inputVal.replace(/[^0-9:]/g, '');
    if (!isDeleting && !raw.includes(':') && raw.length >= 3) {
      if (raw.length === 3 && parseInt(raw.slice(0, 2), 10) > 23) {
        raw = `0${raw[0]}:${raw.slice(1, 3)}`;
      } else if (raw.length >= 4) {
        raw = `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
      }
    }
    raw = raw.slice(0, 5);
    setTimeText(raw);

    if (/^([01]?\d|2[0-3]):([0-5]\d)$/.test(raw)) {
      const [h, m] = raw.split(':');
      const norm = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      onChange(`${dateIso}T${norm}`);
    }
  };

  const handleTimeBlur = () => {
    isTimeFocusedRef.current = false;
    const trimmed = timeText.trim();
    if (!trimmed) {
      const fallback = getCurrentTimeVN();
      setTimeText(fallback);
      onChange(`${dateIso}T${fallback}`);
      return;
    }
    const digits = trimmed.replace(/\D/g, '');
    let formatted = '';
    if (!trimmed.includes(':') && digits.length === 3) {
      const hh = Math.min(23, Math.max(0, parseInt(digits[0], 10) || 0));
      const mm = Math.min(59, Math.max(0, parseInt(digits.slice(1, 3), 10) || 0));
      formatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    } else if (!trimmed.includes(':') && digits.length === 4) {
      const hh = Math.min(23, Math.max(0, parseInt(digits.slice(0, 2), 10) || 0));
      const mm = Math.min(59, Math.max(0, parseInt(digits.slice(2, 4), 10) || 0));
      formatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    } else {
      const m = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
      if (m) {
        const hh = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
        const mm = Math.min(59, Math.max(0, parseInt(m[2] ?? '0', 10) || 0));
        formatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
    }

    if (formatted) {
      setTimeText(formatted);
      onChange(`${dateIso}T${formatted}`);
    } else {
      const fallback = getCurrentTimeVN();
      setTimeText(fallback);
      onChange(`${dateIso}T${fallback}`);
    }
  };

  const handleNowVN = () => {
    const nowDate = getCurrentDateISO();
    const nowTime = getCurrentTimeVN();
    setTimeText(nowTime);
    onChange(`${nowDate}T${nowTime}`);
  };

  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 min-w-[125px]">
        <DateInputVN
          value={dateIso}
          onChange={handleDatePartChange}
          required={required}
          disabled={disabled}
          placeholder="dd/mm/yyyy"
          className={className || 'w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs'}
        />
      </div>
      <div className="relative w-22 shrink-0">
        <input
          type="text"
          inputMode="numeric"
          value={timeText}
          onChange={handleTimePartChange}
          onFocus={() => {
            isTimeFocusedRef.current = true;
          }}
          onBlur={handleTimeBlur}
          disabled={disabled}
          placeholder="HH:mm"
          maxLength={5}
          title="Nhập giờ:phút 24h (VD: 07:36 hoặc 0736)"
          className={
            className ||
            'w-full border border-slate-200 rounded-xl pl-2.5 pr-6 py-2 text-xs font-mono'
          }
        />
        <button
          type="button"
          onClick={handleNowVN}
          disabled={disabled}
          title="Lấy ngày giờ hiện tại của Việt Nam (GMT+7)"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-700 p-0.5 rounded"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
