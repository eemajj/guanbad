const TZ = "Asia/Bangkok";

/** satang → "฿1,234" */
export const baht = (satang: number) => "฿" + Math.round(satang / 100).toLocaleString("th-TH");
/** satang → "1,234.50" for precise breakdowns */
export const bahtExact = (satang: number) =>
  "฿" + (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 });

export const toSatang = (bahtValue: number) => Math.round(bahtValue * 100);

export const thaiDate = (d: Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  d.toLocaleDateString("th-TH", { timeZone: "UTC", ...opts });

export const thaiDateLong = (d: Date) => thaiDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const thaiDateTime = (d: Date) =>
  d.toLocaleString("th-TH", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "23:39" in Bangkok time */
export const thaiTime = (d: Date) => d.toLocaleTimeString("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export const minutesSince = (d: Date, now = Date.now()) => Math.max(0, Math.floor((now - d.getTime()) / 60000));

/** Today's date in Bangkok as YYYY-MM-DD */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export const dateFromISO = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const isoFromDate = (d: Date) => d.toISOString().slice(0, 10);

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

export const thaiMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("th-TH", { timeZone: "UTC", month: "long", year: "numeric" });
};
