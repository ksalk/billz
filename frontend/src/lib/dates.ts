const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day || month > 12) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  return date;
}

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function startOfCalendarGrid(date: Date): Date {
  const first = startOfMonth(date);
  const mondayOffset = (first.getDay() + 6) % 7;
  return addDays(first, -mondayOffset);
}

export function calendarDays(date: Date): Date[] {
  const start = startOfCalendarGrid(date);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function calendarRange(date: Date): { from: string; to: string } {
  const days = calendarDays(date);
  const first = days[0];
  const last = days.at(-1);

  if (!first || !last) {
    throw new Error("Calendar grid is empty.");
  }

  return { from: isoDate(first), to: isoDate(last) };
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function weekdayLabels(): string[] {
  return DAY_NAMES;
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function formatIsoDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseIsoDate(value));
}
