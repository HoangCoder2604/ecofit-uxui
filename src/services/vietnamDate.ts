/** Vietnam calendar day for all nutrition and hydration entries, independent of device timezone. */
export const ECOFIT_TIME_ZONE = "Asia/Ho_Chi_Minh" as const;

/** YYYY-MM-DD, computed in Vietnam time (UTC+07:00). */
export function vietnamDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ECOFIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find(part => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) {
    throw new Error("Không thể xác định ngày theo giờ Việt Nam.");
  }
  return `${year}-${month}-${day}`;
}

/** Localized screen label, based on Vietnam timezone, not phone timezone. */
export function vietnamDateLabel(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: ECOFIT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** Navigate by calendar days, independent of the phone timezone and DST. */
export function shiftVietnamDateKey(key: string, offsetDays: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isInteger(offsetDays)) {
    throw new Error("Ngày không hợp lệ.");
  }
  const day = new Date(`${key}T12:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0,10) !== key) {
    throw new Error("Ngày không hợp lệ.");
  }
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day.toISOString().slice(0,10);
}

/** Human-readable day label from a saved YYYY-MM-DD key, in Vietnam time. */
export function vietnamKeyLabel(key: string): string {
  const checked = shiftVietnamDateKey(key, 0);
  return vietnamDateLabel(new Date(`${checked}T12:00:00.000Z`));
}
