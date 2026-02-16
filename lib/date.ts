export const toISODate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseISODate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

export const getTodayIsoDate = () => toISODate(new Date());

export const isValidIsoDate = (value: string | null | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");

export const getWeekStart = (d: Date) => {
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(d, delta);
};

export const getWeekRange = (isoDate: string) => {
  const date = parseISODate(isoDate);
  const start = getWeekStart(date);
  const end = addDays(start, 6);
  return { start: toISODate(start), end: toISODate(end) };
};

export const getMonthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("ru-RU", { month: "short", year: "numeric" });
};

export const getMonthRange = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: toISODate(start), end: toISODate(end) };
};

export const formatTimeHm = (iso: string | null) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};
