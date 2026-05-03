import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SurveyRow } from "./types";
import { addDays, recommendToScore, trendToScore, ymd } from "./utils";

const COLORS = {
  q1: "hsl(var(--brand))",
  q2: "hsl(var(--success))",
  q3: "hsl(var(--warning))",
  q4: "hsl(var(--danger))",
};

export function TrendChart({ surveys }: { surveys: SurveyRow[] }) {
  // Build last 30 days bucketed
  const today = new Date();
  const days: { day: string; q1: number | null; q2: number | null; q3: number | null; q4: number | null; n: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = ymd(d);
    const dayRows = surveys.filter((s) => ymd(s.created_at) === key);
    const n = dayRows.length;
    const calc = (vals: number[]) => (vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null);
    days.push({
      day: key.slice(5),
      q1: calc(dayRows.map((r) => r.question_1_score)),
      q2: calc(dayRows.map((r) => r.question_2_score)),
      q3: calc(dayRows.map((r) => trendToScore(r.question_3_trend))),
      q4: calc(dayRows.map((r) => recommendToScore(r.question_4_recommend))),
      n,
    });
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="q1" name="Sabor" stroke={COLORS.q1} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="q2" name="Limpieza" stroke={COLORS.q2} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="q3" name="Tendencia" stroke={COLORS.q3} strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="q4" name="Recomendación" stroke={COLORS.q4} strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DistributionChart({ surveys }: { surveys: SurveyRow[] }) {
  // Stacked bars per question, x-axis = bucket
  // Q1 & Q2: 1..5; Q3: peor/igual/mejor; Q4: no/tal_vez/si
  const counts = (extract: (r: SurveyRow) => string, keys: string[]) => {
    const c: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const r of surveys) c[extract(r)] = (c[extract(r)] ?? 0) + 1;
    return c;
  };

  const q1 = counts((r) => String(r.question_1_score), ["1", "2", "3", "4", "5"]);
  const q2 = counts((r) => String(r.question_2_score), ["1", "2", "3", "4", "5"]);
  const q3 = counts((r) => r.question_3_trend, ["peor", "igual", "mejor"]);
  const q4 = counts((r) => r.question_4_recommend, ["no", "tal_vez", "si"]);

  const data = [
    { q: "Sabor", bajo: q1["1"] + q1["2"], medio: q1["3"], alto: q1["4"] + q1["5"] },
    { q: "Limpieza", bajo: q2["1"] + q2["2"], medio: q2["3"], alto: q2["4"] + q2["5"] },
    { q: "Tendencia", bajo: q3["peor"], medio: q3["igual"], alto: q3["mejor"] },
    { q: "Recomienda", bajo: q4["no"], medio: q4["tal_vez"], alto: q4["si"] },
  ];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="q" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="bajo" stackId="x" name="Bajo" fill="hsl(var(--danger))" />
        <Bar dataKey="medio" stackId="x" name="Medio" fill="hsl(var(--warning))" />
        <Bar dataKey="alto" stackId="x" name="Alto" fill="hsl(var(--success))" />
      </BarChart>
    </ResponsiveContainer>
  );
}
