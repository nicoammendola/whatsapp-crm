"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { format, startOfToday, startOfWeek, startOfMonth, startOfYear, subDays, subMonths, subYears, isSameDay, startOfDay, endOfDay } from "date-fns";

export type DatePreset = 
  | "today" 
  | "thisWeek" 
  | "thisMonth" 
  | "thisYear" 
  | "last7Days" 
  | "last30Days" 
  | "lastYear"
  | "custom";

interface DateFilterProps {
  fromDate: Date;
  toDate: Date;
  oldestDate: Date | null;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
}

export default function DateFilter({
  fromDate,
  toDate,
  oldestDate,
  onFromDateChange,
  onToDateChange,
}: DateFilterProps) {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<DatePreset>("last7Days");

  const today = startOfToday();
  const minDate = oldestDate || new Date(2000, 0, 1);
  const maxDate = today;

  const presets: Array<{ id: DatePreset; label: string; getDates: () => { from: Date; to: Date } }> = [
    {
      id: "today",
      label: "Today",
      getDates: () => ({ from: today, to: today }),
    },
    {
      id: "thisWeek",
      label: "This Week",
      getDates: () => ({ from: startOfWeek(today, { weekStartsOn: 1 }), to: today }),
    },
    {
      id: "thisMonth",
      label: "This Month",
      getDates: () => ({ from: startOfMonth(today), to: today }),
    },
    {
      id: "thisYear",
      label: "This Year",
      getDates: () => ({ from: startOfYear(today), to: today }),
    },
    {
      id: "last7Days",
      label: "Last 7 Days",
      getDates: () => ({ from: subDays(today, 6), to: today }),
    },
    {
      id: "last30Days",
      label: "Last 30 Days",
      getDates: () => ({ from: subDays(today, 29), to: today }),
    },
    {
      id: "lastYear",
      label: "Last Year",
      getDates: () => ({ from: subYears(today, 1), to: today }),
    },
    {
      id: "custom",
      label: "Custom",
      getDates: () => ({ from: fromDate, to: toDate }),
    },
  ];

  const applyPreset = (preset: DatePreset) => {
    if (preset === "custom") {
      setCurrentPreset("custom");
      setShowPresetMenu(false);
      return;
    }

    const presetData = presets.find((p) => p.id === preset);
    if (presetData) {
      const dates = presetData.getDates();
      // Normalize dates
      let from = startOfDay(dates.from);
      let to = endOfDay(dates.to);
      
      // Ensure dates are within valid range
      // But don't clamp if it would change the meaning of the preset
      // (e.g., if "this week" starts before oldest date, we still want to show from oldest date)
      if (from < minDate) {
        from = startOfDay(minDate);
      }
      if (to > maxDate) {
        to = endOfDay(maxDate);
      }
      
      onFromDateChange(from);
      onToDateChange(to);
      setCurrentPreset(preset);
      setShowPresetMenu(false);
    }
  };

  const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = startOfDay(new Date(e.target.value));
    if (newDate >= startOfDay(minDate) && newDate <= endOfDay(maxDate) && newDate <= startOfDay(toDate)) {
      onFromDateChange(newDate);
      setCurrentPreset("custom");
    }
  };

  const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = endOfDay(new Date(e.target.value));
    if (newDate >= startOfDay(minDate) && newDate <= endOfDay(maxDate) && newDate >= startOfDay(fromDate)) {
      onToDateChange(newDate);
      setCurrentPreset("custom");
    }
  };

  // Detect which preset matches the current dates
  useEffect(() => {
    const normalizedFrom = startOfDay(fromDate);
    const normalizedTo = endOfDay(toDate);
    
    // Check presets in order of specificity (most specific first)
    // This ensures "today" is checked before "this week", etc.
    const presetOrder: DatePreset[] = ["today", "thisWeek", "thisMonth", "thisYear", "last7Days", "last30Days", "lastYear"];
    
    for (const presetId of presetOrder) {
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) continue;
      
      const presetDates = preset.getDates();
      let expectedFrom = startOfDay(presetDates.from);
      const expectedTo = endOfDay(presetDates.to);
      
      // Calculate what the preset would produce after clamping
      if (expectedFrom < minDate) {
        expectedFrom = startOfDay(minDate);
      }
      
      // Special handling for "this week": 
      // - If to date is today and from date matches week start (or is clamped to minDate if week start < minDate)
      // - But skip if both dates are today (that's "today", not "this week")
      if (presetId === "thisWeek") {
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const expectedWeekFrom = weekStart < minDate ? startOfDay(minDate) : startOfDay(weekStart);
        
        if (isSameDay(normalizedTo, today) && isSameDay(normalizedFrom, expectedWeekFrom)) {
          // Only match "this week" if it's not actually "today"
          if (!isSameDay(normalizedFrom, normalizedTo)) {
            setCurrentPreset("thisWeek");
            return;
          }
        }
        continue;
      }
      
      // For other presets, compare dates directly
      if (isSameDay(normalizedFrom, expectedFrom) && isSameDay(normalizedTo, expectedTo)) {
        setCurrentPreset(presetId);
        return;
      }
    }
    
    // If no preset matches, it's custom
    setCurrentPreset("custom");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  // Format dates for input fields (YYYY-MM-DD)
  const formatDateForInput = (date: Date) => format(date, "yyyy-MM-dd");

  return (
    <div className="flex items-center gap-3">
      {/* Preset Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowPresetMenu(!showPresetMenu)}
          className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <span>{presets.find((p) => p.id === currentPreset)?.label || "Select Period"}</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {showPresetMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPresetMenu(false)}
            />
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                    currentPreset === preset.id
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Date Inputs */}
      <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800">
        <Calendar className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={formatDateForInput(fromDate)}
            min={formatDateForInput(minDate)}
            max={formatDateForInput(maxDate)}
            onChange={handleFromDateChange}
            disabled={currentPreset !== "custom"}
            className={`border-none bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark] ${
              currentPreset === "custom"
                ? "text-zinc-700 dark:text-zinc-300 cursor-pointer"
                : "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            }`}
          />
          <span className="text-zinc-500 dark:text-zinc-400">to</span>
          <input
            type="date"
            value={formatDateForInput(toDate)}
            min={formatDateForInput(fromDate)}
            max={formatDateForInput(maxDate)}
            onChange={handleToDateChange}
            disabled={currentPreset !== "custom"}
            className={`border-none bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:[color-scheme:dark] ${
              currentPreset === "custom"
                ? "text-zinc-700 dark:text-zinc-300 cursor-pointer"
                : "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
