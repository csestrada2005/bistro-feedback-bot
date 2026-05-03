import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  MessageSquareWarning,
  Sparkles,
  TrendingDown,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/admin/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { FiltersBar } from "./Filters";
import { TrendChart, DistributionChart } from "./Charts";
import {
  QUORUM,
  addDays,
  avg,
  pct,
  recommendToScore,
  startOfDay,
  trendToScore,
  ymd,
} from "./utils";
import type { DateRange, MenuRow, SurveyRow } from "./types";

const DEFAULT_RANGE = (): DateRange => {
  const to = startOfDay(new Date());
  return { from: addDays(to, -6), to };
};

function KpiCard({
  label,
  value,
  sub,
  trend,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  warn?: boolean;
}) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {warn && (
          <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/10">
            Muestra insuficiente
          </Badge>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {trend !== null && trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              up ? "text-success" : "text-danger"
            )}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { role } = useAuth();
  const isAdmin = role === "cafeteria_admin";

  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dows, setDows] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSurveys, setAllSurveys] = useState<SurveyRow[]>([]);
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [insights, setInsights] = useState<{
    executive_summary: string;
    patterns: string[];
    bottlenecks: { label: string; detail: string }[];
    recommendations: { title: string; impact: string }[];
    cached?: boolean;
  } | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // Load last 60 days for trend & comparisons + selected range
      const earliest = addDays(startOfDay(new Date()), -60);
      const [{ data: surveys }, { data: menusData }] = await Promise.all([
        supabase
          .from("surveys")
          .select(
            "id, created_at, question_1_score, question_2_score, question_3_trend, question_4_recommend, comment, comment_status, is_flagged, daily_menu_id"
          )
          .gte("created_at", earliest.toISOString())
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("daily_menus")
          .select("id, date, main_dish")
          .order("date", { ascending: false })
          .limit(60),
      ]);
      if (cancelled) return;
      setAllSurveys((surveys as SurveyRow[]) ?? []);
      setMenus((menusData as MenuRow[]) ?? []);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const fromMs = range.from.getTime();
    const toMs = addDays(range.to, 1).getTime();
    return allSurveys.filter((s) => {
      const t = new Date(s.created_at).getTime();
      if (t < fromMs || t >= toMs) return false;
      if (menuId && s.daily_menu_id !== menuId) return false;
      if (dows.length && !dows.includes(new Date(s.created_at).getDay())) return false;
      return true;
    });
  }, [allSurveys, range, menuId, dows]);

  const cleanSurveys = useMemo(() => filtered.filter((s) => !s.is_flagged), [filtered]);
  const flaggedCount = filtered.length - cleanSurveys.length;

  // KPIs (today vs yesterday/last week — independent of range filter for "hoy")
  const todayKey = ymd(new Date());
  const yKey = ymd(addDays(new Date(), -1));
  const todayRows = allSurveys.filter((s) => ymd(s.created_at) === todayKey && !s.is_flagged);
  const yesterdayRows = allSurveys.filter((s) => ymd(s.created_at) === yKey && !s.is_flagged);
  const lastWeekRows = allSurveys.filter((s) => {
    const d = new Date(s.created_at);
    const days = (Date.now() - d.getTime()) / 86_400_000;
    return days > 1 && days <= 8 && !s.is_flagged;
  });

  const respToday = todayRows.length;
  const respYesterday = yesterdayRows.length;
  const respTrend = respYesterday ? ((respToday - respYesterday) / respYesterday) * 100 : null;

  const sabor = avg(todayRows.map((r) => r.question_1_score));
  const saborLW = avg(lastWeekRows.map((r) => r.question_1_score));
  const saborTrend = saborLW ? ((sabor - saborLW) / saborLW) * 100 : null;

  const recYes = todayRows.filter((r) => r.question_4_recommend === "si").length;
  const recPct = pct(recYes, todayRows.length);
  const recYesLW = lastWeekRows.filter((r) => r.question_4_recommend === "si").length;
  const recPctLW = pct(recYesLW, lastWeekRows.length);
  const recTrend = recPctLW ? recPct - recPctLW : null;

  const pendingComments = allSurveys.filter(
    (r) => r.comment_status === "pending" && r.comment
  ).length;

  // Bottom 5 worst-performing days within filter
  const dayBuckets = useMemo(() => {
    const map = new Map<string, SurveyRow[]>();
    for (const r of cleanSurveys) {
      const k = ymd(r.created_at);
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .map(([day, rows]) => {
        const score = avg(
          rows.map(
            (r) =>
              (r.question_1_score +
                r.question_2_score +
                trendToScore(r.question_3_trend) +
                recommendToScore(r.question_4_recommend)) /
              4
          )
        );
        const menu = rows.find((r) => r.daily_menu_id);
        const menuName = menus.find((m) => m.id === menu?.daily_menu_id)?.main_dish ?? "—";
        return { day, n: rows.length, score, menuName };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  }, [cleanSurveys, menus]);

  // Alerts
  const alerts = useMemo(() => {
    const out: { kind: "drop" | "quorum" | "flagged"; label: string }[] = [];
    if (saborTrend !== null && saborTrend <= -15)
      out.push({
        kind: "drop",
        label: `Sabor cayó ${Math.abs(saborTrend).toFixed(1)}% vs semana pasada`,
      });
    // quorum issues today
    if (respToday > 0 && respToday < QUORUM)
      out.push({
        kind: "quorum",
        label: `Hoy lleva ${respToday} respuestas (mínimo ${QUORUM})`,
      });
    if (flaggedCount > 0)
      out.push({
        kind: "flagged",
        label: `${flaggedCount} respuestas marcadas como sospechosas en el periodo`,
      });
    return out;
  }, [saborTrend, respToday, flaggedCount]);

  const todayWarn = respToday > 0 && respToday < QUORUM;

  const generateInsights = async () => {
    if (!isAdmin) return;
    setInsightsLoading(true);
    try {
      const questions = [
        { text: "Sabor (Q1)", average: avg(cleanSurveys.map((r) => r.question_1_score)) },
        { text: "Limpieza (Q2)", average: avg(cleanSurveys.map((r) => r.question_2_score)) },
        {
          text: "Tendencia vs ayer (Q3)",
          average: avg(cleanSurveys.map((r) => trendToScore(r.question_3_trend))),
        },
        {
          text: "Recomendación (Q4)",
          average: avg(cleanSurveys.map((r) => recommendToScore(r.question_4_recommend))),
        },
      ];
      const topComments = cleanSurveys
        .filter((r) => r.comment && r.comment_status !== "deleted")
        .slice(0, 20)
        .map((r) => ({ text: r.comment ?? "", date: ymd(r.created_at) }));
      const bottomDays = dayBuckets.map((b) => ({ date: b.day, avgScore: b.score }));

      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: {
          periodStart: ymd(range.from),
          periodEnd: ymd(range.to),
          totalResponses: filtered.length,
          validResponses: cleanSurveys.length,
          questions,
          topComments,
          bottomDays,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setInsights(data as any);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo generar el análisis IA");
    } finally {
      setInsightsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Respuestas hoy"
          value={String(respToday)}
          sub={`vs ${respYesterday} ayer`}
          trend={respTrend}
          warn={todayWarn}
        />
        <KpiCard
          label="Sabor promedio"
          value={sabor ? `${sabor.toFixed(2)} / 5` : "—"}
          sub="vs últimos 7 días"
          trend={saborTrend}
        />
        <KpiCard
          label="Recomendación"
          value={todayRows.length ? `${recPct.toFixed(0)}%` : "—"}
          sub="dicen Sí hoy"
          trend={recTrend}
        />
        <KpiCard
          label="Comentarios pendientes"
          value={String(pendingComments)}
          sub="por moderar"
        />
      </div>

      {/* Filters */}
      <FiltersBar
        range={range}
        onRangeChange={setRange}
        menuId={menuId}
        onMenuChange={setMenuId}
        dows={dows}
        onDowsChange={setDows}
        menus={menus}
        onReset={() => {
          setRange(DEFAULT_RANGE());
          setMenuId(null);
          setDows([]);
        }}
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Tendencia 30 días</h3>
              <span className="text-xs text-muted-foreground">Promedio diario por pregunta</span>
            </div>
            <TrendChart surveys={allSurveys.filter((s) => !s.is_flagged)} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Distribución por respuesta</h3>
              <span className="text-xs text-muted-foreground">Respeta filtros activos</span>
            </div>
            <DistributionChart surveys={cleanSurveys} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-danger" />
              <h3 className="text-sm font-semibold text-foreground">Cuellos de botella</h3>
            </div>
            {dayBuckets.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin datos en el periodo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Menú</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">N</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayBuckets.map((b) => (
                    <TableRow key={b.day}>
                      <TableCell className="font-medium">{b.day.slice(5)}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-muted-foreground">{b.menuName}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.score.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {b.n < QUORUM ? (
                          <Badge variant="secondary" className="bg-warning/10 text-warning hover:bg-warning/10">
                            {b.n}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">{b.n}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">Alertas activas</h3>
              </div>
              {isAdmin && (
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Configurar
                </Button>
              )}
            </div>
            {alerts.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Todo en orden ✨</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((a, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-sm",
                      a.kind === "drop" && "border-danger/30 bg-danger/5",
                      a.kind === "quorum" && "border-warning/30 bg-warning/5",
                      a.kind === "flagged" && "border-border bg-muted/30"
                    )}
                  >
                    {a.kind === "drop" && <TrendingDown className="mt-0.5 h-4 w-4 text-danger" />}
                    {a.kind === "quorum" && <Utensils className="mt-0.5 h-4 w-4 text-warning" />}
                    {a.kind === "flagged" && <MessageSquareWarning className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                    <span className="text-foreground">{a.label}</span>
                  </li>
                ))}
              </ul>
            )}
            {flaggedCount > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                {flaggedCount} respuesta(s) marcadas como sospechosas — se muestran aparte y no entran en métricas.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI section */}
      <div className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Hallazgos IA</h3>
              <p className="text-sm text-muted-foreground">
                Análisis automático de patrones, sentimiento y recomendaciones para el comedor.
              </p>
            </div>
          </div>
          <Button
            disabled={!isAdmin || insightsLoading}
            className="gap-2"
            onClick={generateInsights}
          >
            {insightsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {insights ? "Regenerar análisis" : "Generar análisis IA"}
          </Button>
        </div>
        {insights && (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resumen ejecutivo
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                {insights.executive_summary}
              </p>
              {insights.cached && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Resultado en caché (válido por 1 hora).
                </p>
              )}
            </div>
            <InsightList title="Patrones detectados" items={insights.patterns.map((p) => ({ title: p }))} />
            <InsightList
              title="Cuellos de botella"
              items={insights.bottlenecks.map((b) => ({ title: b.label, sub: b.detail }))}
            />
            <InsightList
              title="Recomendaciones"
              items={insights.recommendations.map((r) => ({ title: r.title, sub: r.impact }))}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InsightList({
  title,
  items,
}: {
  title: string;
  items: { title: string; sub?: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="mt-3 space-y-3">
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            <p className="font-medium text-foreground">{it.title}</p>
            {it.sub && <p className="mt-0.5 text-xs text-muted-foreground">{it.sub}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
