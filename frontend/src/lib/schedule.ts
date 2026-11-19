import type { BillFrequency } from "../api";
import { parseIsoDate } from "./dates";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en", { weekday: "long" });
const MONTH_FORMAT = new Intl.DateTimeFormat("en", { month: "long" });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export interface ScheduleShape {
  frequency: BillFrequency;
  interval: number;
  startDate: string;
}

export function scheduleSummary(schedule: ScheduleShape): string {
  const start = parseIsoDate(schedule.startDate);
  const day = start.getDate();
  const dayLabel = `${ordinal(day)}${day >= 29 ? " (or month end)" : ""}`;
  const weekday = WEEKDAY_FORMAT.format(start);
  const month = MONTH_FORMAT.format(start);

  if (schedule.frequency === "once") {
    return `One-off on ${FULL_DATE_FORMAT.format(start)}`;
  }

  if (schedule.frequency === "weekly") {
    return schedule.interval === 1
      ? `Every week on ${weekday}`
      : `Every ${schedule.interval} weeks on ${weekday}`;
  }

  if (schedule.frequency === "yearly") {
    const base = `${day} ${month}`;
    return schedule.interval === 1
      ? `Yearly on ${base}`
      : `Every ${schedule.interval} years on ${base}`;
  }

  if (schedule.interval === 1) {
    return `Monthly on the ${dayLabel}`;
  }

  if (schedule.interval === 3) {
    return `Quarterly on the ${dayLabel}`;
  }

  if (schedule.interval === 6) {
    return `Every 6 months on the ${dayLabel}`;
  }

  return `Every ${schedule.interval} months on the ${dayLabel}`;
}

export function ordinal(value: number): string {
  const remainder = value % 100;

  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
