import { supabase } from "@/integrations/supabase/client";
import type { PdfReportData, PdfQuestion } from "./pdfDocument";

const QUORUM = 20;
const SCORE_TO_NUM = (v: string) => (v === "yes" || v === "up" ? 1 : v === "no" || v === "down" ? 0 : Number(v));

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function stdDev(nums: number[]) {
  if (nums.length < 2) return 0;
  const m = avg(nums);
  return Math.sqrt(nums.map((n) => (n - m) ** 2).reduce((a, b) => a + b, 0) / nums.length);
}
function dayKey(iso: string) {
  return iso.slice(0, 10);
}

type SurveyRow = {
  created_at: string;
  question_1_score: number;
  question_2_score: number;
  question_3_trend: string;
  question_4_recommend: string;
  comment: string | null;
  comment_status: string;
  is_flagged: boolean;
};

async function fetchRange(start: string, end: string): Promise<SurveyRow[]> {
  const { data, error } = await supabase
    .from("surveys")
    .select(
      "created_at, question_1_score, question_2_score, question_3_trend, question_4_recommend, comment, comment_status, is_flagged"
    )
    .gte("created_at", `${start}T00:00:00.000Z`)
    .lte("created_at", `${end}T23:59:59.999Z`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SurveyRow[];
}

function questionStats(rows: SurveyRow[], picker: (r: SurveyRow) => number, text: string, prevAvg: number | null): PdfQuestion {
  const valid = rows.filter((r) => !r.is_flagged);
  const values = valid.map(picker).filter((v) => Number.isFinite(v));
  const m = avg(values);
  const sd = stdDev(values);
  const byDay = new Map<string, number[]>();
  for (const r of valid) {
    const k = dayKey(r.created_at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(picker(r));
  }
  const daily = Array.from(byDay.entries())
    .map(([date, vals]) => ({ date, value: avg(vals) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const sortedDaily = [...daily].sort((a, b) => b.value - a.value);
  const distribution = (() => {
    if (values.every((v) => v === 0 || v === 1)) {
      const yes = values.filter((v) => v === 1).length;
      const no = values.length - yes;
      return [
        { label: "Sí", count: yes },
        { label: "No", count: no },
      ];
    }
    const buckets = [0, 0, 0, 0, 0];
    for (const v of values) {
      const idx = Math.min(4, Math.max(0, Math.round(v) - 1));
      buckets[idx]++;
    }
    return buckets.map((c, i) => ({ label: `${i + 1}`, count: c }));
  })();
  const change = prevAvg && prevAvg > 0 ? ((m - prevAvg) / prevAvg) * 100 : null;
  return {
    text,
    average: m,
    stdDev: sd,
    bestDay: sortedDaily[0] ?? null,
    worstDay: sortedDaily[sortedDaily.length - 1] ?? null,
    distribution,
    daily,
    changeVsPrev: change,
  };
}

export async function buildReportData(opts: {
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  approvedOnly: boolean;
}): Promise<PdfReportData> {
  const rows = await fetchRange(opts.periodStart, opts.periodEnd);

  // previous period of equal length
  const startMs = new Date(opts.periodStart).getTime();
  const endMs = new Date(opts.periodEnd).getTime();
  const len = endMs - startMs;
  const prevStart = new Date(startMs - len - 86400000).toISOString().slice(0, 10);
  const prevEnd = new Date(startMs - 86400000).toISOString().slice(0, 10);
  const prevRows = await fetchRange(prevStart, prevEnd);
  const prevValid = prevRows.filter((r) => !r.is_flagged);

  const { data: questionRows } = await supabase
    .from("questions")
    .select("question_text, order_num")
    .order("order_num");
  const qTexts = (questionRows ?? []).map((q) => q.question_text);
  const text = (i: number, fallback: string) => qTexts[i] ?? fallback;

  const pickers: Array<(r: SurveyRow) => number> = [
    (r) => r.question_1_score,
    (r) => r.question_2_score,
    (r) => SCORE_TO_NUM(r.question_3_trend),
    (r) => SCORE_TO_NUM(r.question_4_recommend),
  ];
  const labels = [
    "¿Cómo estuvo el sabor de la comida hoy?",
    "¿Cómo estuvo el servicio?",
    "¿La comida estuvo mejor o peor que ayer?",
    "¿Recomendarías el comedor hoy?",
  ];

  const questions: PdfQuestion[] = pickers.map((p, i) =>
    questionStats(rows, p, text(i, labels[i]), avg(prevValid.map(p).filter(Number.isFinite)))
  );

  // sample-by-day
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.created_at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const lowSampleDays = Array.from(counts.entries())
    .filter(([, c]) => c < QUORUM)
    .map(([d]) => d)
    .sort();

  const flaggedExcluded = rows.filter((r) => r.is_flagged).length;
  const validResponses = rows.length - flaggedExcluded;

  // moderation breakdown over rows that have a comment
  const withComment = rows.filter((r) => r.comment && r.comment.trim().length > 0);
  const moderation = {
    approved: withComment.filter((r) => r.comment_status === "approved").length,
    archived: withComment.filter((r) => r.comment_status === "archived").length,
    deleted: withComment.filter((r) => r.comment_status === "deleted").length,
    pending: withComment.filter((r) => r.comment_status === "pending").length,
  };

  const approvedComments = withComment
    .filter((r) => (opts.approvedOnly ? r.comment_status === "approved" : r.comment_status !== "deleted"))
    .map((r) => ({
      date: dayKey(r.created_at),
      text: r.comment ?? "",
      scores: `Sabor ${r.question_1_score}/5 · Servicio ${r.question_2_score}/5 · Recomienda: ${r.question_4_recommend}`,
    }));

  // bottlenecks: bottom 3 days by Q1
  const q1Daily = questions[0]?.daily ?? [];
  const bottlenecks = [...q1Daily]
    .sort((a, b) => a.value - b.value)
    .slice(0, 3)
    .map((d) => ({ label: d.date, detail: `Sabor promedio ${d.value.toFixed(2)}` }));

  // ---- AI enrichment (graceful fallback) ----
  let aiSummary: string | null = null;
  let aiPatterns: string[] = [];
  let aiBottlenecks: { label: string; detail: string }[] = [];
  let aiRecs: { title: string; impact: string }[] = [];
  let rankedComments = approvedComments.slice(0, 20);

  try {
    const { data: ai, error: aiErr } = await supabase.functions.invoke("pdf-insights", {
      body: {
        periodStart: opts.periodStart,
        periodEnd: opts.periodEnd,
        totalResponses: rows.length,
        validResponses,
        questions: questions.map((q) => ({
          text: q.text,
          average: q.average,
          changeVsPrev: q.changeVsPrev,
        })),
        bottomDays: bottlenecks.map((b) => ({ date: b.label, avgScore: Number(b.detail.replace(/[^\d.]/g, "")) })),
        comments: approvedComments.slice(0, 40).map((c) => ({ date: c.date, text: c.text })),
      },
    });
    if (!aiErr && ai && !(ai as any).error) {
      const a = ai as any;
      aiSummary = a.executive_summary ?? null;
      aiPatterns = a.patterns ?? [];
      aiBottlenecks = a.bottlenecks ?? [];
      aiRecs = a.recommendations ?? [];
      if (Array.isArray(a.comment_scores) && a.comment_scores.length) {
        const byText = new Map<string, number>();
        for (const s of a.comment_scores) byText.set(s.text, Number(s.relevance) || 0);
        rankedComments = [...approvedComments]
          .sort((x, y) => (byText.get(y.text) ?? 0) - (byText.get(x.text) ?? 0))
          .slice(0, 20);
      }
    }
  } catch (e) {
    console.warn("pdf-insights failed, falling back", e);
  }

  return {
    title: opts.title,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    generatedBy: opts.generatedBy,
    generatedAt: new Date().toLocaleString("es-MX"),
    executiveSummary:
      aiSummary ??
      `Análisis IA no disponible. Durante el período se registraron ${rows.length} respuestas (${validResponses} válidas). ` +
        `Sabor promedio: ${questions[0].average.toFixed(2)}/5. Recomendación neta: ${(questions[3].average * 100).toFixed(0)}%.`,
    questions,
    patterns: aiPatterns,
    bottlenecks: aiBottlenecks.length ? aiBottlenecks : bottlenecks,
    comments: rankedComments,
    recommendations: aiRecs,
    methodology: {
      totalResponses: rows.length,
      validResponses,
      flaggedExcluded,
      lowSampleDays,
      moderation,
      antiFraud: [
        "Huella de dispositivo única por respuesta",
        "Tiempo mínimo de respuesta validado",
        "Marcado automático de patrones anómalos",
        "Exclusión de respuestas marcadas como sospechosas del cálculo",
      ],
    },
  };
}