'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
}

// ─── Helpers ───

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

// ─── CalendarPanel ───

interface CalendarPanelProps {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  hoverDate: string | null;
  selecting: 'start' | 'end';
  onDateClick: (dateStr: string) => void;
  onDateHover: (dateStr: string) => void;
}

function CalendarPanel({
  year,
  month,
  startDate,
  endDate,
  hoverDate,
  selecting,
  onDateClick,
  onDateHover,
}: CalendarPanelProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Determine range for highlighting
  const rangeStart = startDate;
  const rangeEnd = selecting === 'end' && hoverDate && hoverDate > startDate ? hoverDate : endDate;

  return (
    <div className="w-[280px]">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-8" />;
          }
          const dateStr = formatDate(year, month, day);
          const isToday = dateStr === todayStr;
          const isStart = dateStr === rangeStart;
          const isEnd = dateStr === rangeEnd;
          const isInRange =
            rangeStart && rangeEnd && dateStr > rangeStart && dateStr < rangeEnd;

          let cellClass = 'h-8 w-full flex items-center justify-center text-sm cursor-pointer rounded transition-colors ';
          if (isStart || isEnd) {
            cellClass += 'bg-brand text-white font-medium ';
          } else if (isInRange) {
            cellClass += 'bg-brand/10 text-gray-700 ';
          } else if (isToday) {
            cellClass += 'text-brand font-medium hover:bg-brand/10 ';
          } else {
            cellClass += 'text-gray-700 hover:bg-gray-100 ';
          }

          return (
            <div
              key={dateStr}
              className={cellClass}
              onClick={() => onDateClick(dateStr)}
              onMouseEnter={() => onDateHover(dateStr)}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DateRangePicker ───

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const tempStartRef = useRef(startDate);
  const containerRef = useRef<HTMLDivElement>(null);

  // Left panel month
  const [leftYear, setLeftYear] = useState(() => {
    const parsed = parseDate(startDate);
    return parsed ? parsed.year : new Date().getFullYear();
  });
  const [leftMonth, setLeftMonth] = useState(() => {
    const parsed = parseDate(startDate);
    return parsed ? parsed.month : new Date().getMonth();
  });

  const rightYear = leftMonth === 11 ? leftYear + 1 : leftYear;
  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1;

  // Sync temp values when props change (only when popover is closed)
  useEffect(() => {
    if (!open) {
      setTempStart(startDate);
      setTempEnd(endDate);
      tempStartRef.current = startDate;
    }
  }, [startDate, endDate, open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Navigation
  const prevMonth = () => {
    if (leftMonth === 0) {
      setLeftYear(leftYear - 1);
      setLeftMonth(11);
    } else {
      setLeftMonth(leftMonth - 1);
    }
  };
  const nextMonth = () => {
    if (leftMonth === 11) {
      setLeftYear(leftYear + 1);
      setLeftMonth(0);
    } else {
      setLeftMonth(leftMonth + 1);
    }
  };
  const prevYear = () => setLeftYear(leftYear - 1);
  const nextYear = () => setLeftYear(leftYear + 1);

  // Date click logic
  const handleDateClick = (dateStr: string) => {
    if (selecting === 'start') {
      setTempStart(dateStr);
      setTempEnd('');
      tempStartRef.current = dateStr;
      setSelecting('end');
    } else {
      const currentStart = tempStartRef.current;
      // If clicked date is before start, swap
      const finalStart = dateStr < currentStart ? dateStr : currentStart;
      const finalEnd = dateStr < currentStart ? currentStart : dateStr;
      setTempStart(finalStart);
      setTempEnd(finalEnd);
      tempStartRef.current = finalStart;
      // Single callback with both values
      onChange(finalStart, finalEnd);
      setSelecting('start');
      setOpen(false);
    }
  };

  const handleDateHover = (dateStr: string) => {
    if (selecting === 'end') {
      setHoverDate(dateStr);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setSelecting('start');
    setHoverDate(null);
    setTempStart(startDate);
    setTempEnd(endDate);
    tempStartRef.current = startDate;
    const parsed = parseDate(startDate);
    if (parsed) {
      setLeftYear(parsed.year);
      setLeftMonth(parsed.month);
    } else {
      const now = new Date();
      setLeftYear(now.getFullYear());
      setLeftMonth(now.getMonth());
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        onClick={handleOpen}
        className="inline-flex items-center gap-1 rounded-sm border border-gray-300 h-10 text-sm cursor-pointer hover:border-brand focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
      >
        <span className={`px-3 ${startDate ? 'text-gray-700' : 'text-gray-400'}`}>
          {startDate || '开始日期'}
        </span>
        <span className="text-gray-400">至</span>
        <span className={`px-3 ${endDate ? 'text-gray-700' : 'text-gray-400'}`}>
          {endDate || '结束日期'}
        </span>
        <Calendar size={14} className="text-gray-400 mr-2 shrink-0" />
      </div>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={prevYear} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <ChevronsLeft size={16} />
              </button>
              <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <ChevronLeft size={16} />
              </button>
            </div>
            <div className="flex items-center gap-12">
              <span className="text-sm font-medium text-gray-800">
                {leftYear}年 {leftMonth + 1}月
              </span>
              <span className="text-sm font-medium text-gray-800">
                {rightYear}年 {rightMonth + 1}月
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <ChevronRight size={16} />
              </button>
              <button type="button" onClick={nextYear} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>

          {/* Dual panels */}
          <div className="flex gap-4">
            <CalendarPanel
              year={leftYear}
              month={leftMonth}
              startDate={tempStart}
              endDate={tempEnd}
              hoverDate={hoverDate}
              selecting={selecting}
              onDateClick={handleDateClick}
              onDateHover={handleDateHover}
            />
            <div className="w-px bg-gray-200" />
            <CalendarPanel
              year={rightYear}
              month={rightMonth}
              startDate={tempStart}
              endDate={tempEnd}
              hoverDate={hoverDate}
              selecting={selecting}
              onDateClick={handleDateClick}
              onDateHover={handleDateHover}
            />
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
            {selecting === 'start' ? '请选择开始日期' : '请选择结束日期'}
          </div>
        </div>
      )}
    </div>
  );
}
