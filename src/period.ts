// Period filtering and date calculations for Africa/Tunis timezone

export type PeriodType = "day" | "week" | "month" | "year" | "custom";

export interface PeriodRange {
  type: PeriodType;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
  referenceDate: string; // YYYY-MM-DD used to compute prev/next
}

const TUNIS_TZ = "Africa/Tunis";

/**
 * Returns the current date in YYYY-MM-DD format in Africa/Tunis timezone.
 */
export function getTunisToday(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TUNIS_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback if timezone not supported
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formats a YYYY-MM-DD date into a readable French string.
 */
export function formatDay(dateStr: string, options: { withYear?: boolean; short?: boolean } = {}): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr + "T12:00:00+01:00");
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: options.short ? "short" : "long",
    year: options.withYear ? "numeric" : undefined,
  });
}

/**
 * Parses YYYY-MM-DD into a localized Date object at noon UTC+1.
 */
function toTunisDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00+01:00");
}

/**
 * Formats Date to YYYY-MM-DD.
 */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calculates start and end dates for a period of a given type and reference date.
 */
export function computePeriod(
  type: PeriodType,
  refDate: string = getTunisToday(),
  customEnd?: string
): PeriodRange {
  const safeRef = /^\d{4}-\d{2}-\d{2}$/.test(refDate) ? refDate : getTunisToday();
  const d = toTunisDate(safeRef);

  if (type === "day") {
    const today = getTunisToday();
    const isToday = safeRef === today;
    const dayLabel = formatDay(safeRef, { withYear: true });
    return {
      type: "day",
      start: safeRef,
      end: safeRef,
      label: isToday ? `Aujourd'hui · ${dayLabel}` : dayLabel,
      referenceDate: safeRef,
    };
  }

  if (type === "week") {
    // Week: Monday (1) to Sunday (7)
    // d.getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
    const dayOfWeek = d.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const start = toDateStr(monday);
    const end = toDateStr(sunday);
    const sameYear = monday.getFullYear() === sunday.getFullYear();
    const sameMonth = sameYear && monday.getMonth() === sunday.getMonth();

    let label: string;
    if (sameMonth) {
      const mStr = monday.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      label = `Semaine du ${monday.getDate()} au ${sunday.getDate()} ${mStr}`;
    } else if (sameYear) {
      const m1 = monday.toLocaleDateString("fr-FR", { month: "short" });
      const m2 = sunday.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      label = `Semaine du ${monday.getDate()} ${m1} au ${sunday.getDate()} ${m2}`;
    } else {
      const m1 = monday.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      const m2 = sunday.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      label = `Semaine du ${monday.getDate()} ${m1} au ${sunday.getDate()} ${m2}`;
    }

    return {
      type: "week",
      start,
      end,
      label,
      referenceDate: safeRef,
    };
  }

  if (type === "month") {
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const monthName = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return {
      type: "month",
      start,
      end,
      label: capitalized,
      referenceDate: safeRef,
    };
  }

  if (type === "year") {
    const y = d.getFullYear();
    const start = `${y}-01-01`;
    const end = `${y}-12-31`;

    return {
      type: "year",
      start,
      end,
      label: `Année ${y}`,
      referenceDate: safeRef,
    };
  }

  // Custom period
  const start = safeRef;
  const rawEnd = customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : safeRef;
  const end = rawEnd < start ? start : rawEnd;
  const startFmt = formatDay(start, { withYear: true, short: true });
  const endFmt = formatDay(end, { withYear: true, short: true });

  return {
    type: "custom",
    start,
    end,
    label: start === end ? startFmt : `Du ${startFmt} au ${endFmt}`,
    referenceDate: safeRef,
  };
}

/**
 * Shifts the period forward (+1) or backward (-1).
 */
export function shiftPeriod(current: PeriodRange, direction: -1 | 1): PeriodRange {
  const d = toTunisDate(current.referenceDate);

  if (current.type === "day") {
    d.setDate(d.getDate() + direction);
    return computePeriod("day", toDateStr(d));
  }

  if (current.type === "week") {
    d.setDate(d.getDate() + direction * 7);
    return computePeriod("week", toDateStr(d));
  }

  if (current.type === "month") {
    d.setMonth(d.getMonth() + direction);
    return computePeriod("month", toDateStr(d));
  }

  if (current.type === "year") {
    d.setFullYear(d.getFullYear() + direction);
    return computePeriod("year", toDateStr(d));
  }

  // Custom: shift both start and end by the interval duration
  const startD = toTunisDate(current.start);
  const endD = toTunisDate(current.end);
  const diffTime = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1);

  startD.setDate(startD.getDate() + direction * diffTime);
  endD.setDate(endD.getDate() + direction * diffTime);

  const newStart = toDateStr(startD);
  const newEnd = toDateStr(endD);
  return computePeriod("custom", newStart, newEnd);
}

/**
 * Checks if a given event date string (YYYY-MM-DD) falls within [start, end] inclusive.
 */
export function isDateInPeriod(dateStr: string, start: string, end: string): boolean {
  if (!dateStr) return false;
  const trimmed = dateStr.slice(0, 10);
  return trimmed >= start && trimmed <= end;
}
