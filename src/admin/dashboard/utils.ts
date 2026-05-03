import type { SurveyRow } from "./types";

export const QUORUM = 20;

export const trendToScore = (t: SurveyRow["question_3_trend"]) =>
  t === "mejor" ? 5 : t === "igual" ? 3 : 1;

export const recommendToScore = (r: SurveyRow["question_4_recommend"]) =>
  r === "si" ? 5 : r === "tal_vez" ? 3 : 1;

export function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

export function ymd(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayOfWeek(d: Date | string): number {
  // 0 = domingo … 6 = sábado
  return (typeof d === "string" ? new Date(d) : d).getDay();
}

export const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
