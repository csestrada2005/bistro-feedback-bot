import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  CalendarIcon,
  FileDown,
  Inbox,
  Lightbulb,
  Loader2,
  Quote,
  RefreshCw,
  UtensilsCrossed,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AnalisisIA = {
  resumenEjecutivo: string;
  fortalezas: { titulo: string; evidencia: string }[];
  areasOportunidad: { titulo: string; evidencia: string; severidad: "alta" | "media" | "baja" }[];
  recomendaciones: { accion: string; impactoEsperado: string; prioridad: "alta" | "media" | "baja" }[];
  sentimientoComentarios: "positivo" | "neutro" | "negativo" | "mixto";
  citasDestacadas: string[];
};

type Comedor = { id: string; nombre: string; slug: string; activo: boolean };
type Pregunta = {
  id: string;
  texto: string;
  tipo: "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3";
  orden: number;
  comedor_id: string | null;
};
type Encuesta = { id: string; fecha: string; comedor_id: string };
type Respuesta = {
  id: string;
  encuesta_id: string;
  pregunta_id: string;
  valor_numerico: number | null;
  valor_booleano: boolean | null;
  valor_texto: string | null;
  created_at: string;
};

type Stats = {
  total: number;
  promedio: number | null;
  pctIncidentes: number | null;
  totalPropuestas: number;
  porPregunta: { id: string; texto: string; promedio: number; n: number }[];
  tendencia: { fecha: string; promedio: number | null }[];
  propuestasMejora: { texto: string; fecha: string }[];
  propuestasMenu: { texto: string; fecha: string }[];
  incidentes: { texto: string; fecha: string }[];
};

const emptyStats: Stats = {
  total: 0,
  promedio: null,
  pctIncidentes: null,
  totalPropuestas: 0,
  porPregunta: [],
  tendencia: [],
  propuestasMejora: [],
  propuestasMenu: [],
  incidentes: [],
};

function barColor(v: number) {
  if (v < 2.5) return "hsl(var(--destructive))";
  if (v < 3.5) return "hsl(45 93% 47%)";
  return "hsl(142 71% 45%)";
}

function computeStats(
  preguntas: Pregunta[],
  encuestas: Encuesta[],
  respuestas: Respuesta[]
): Stats {
  if (encuestas.length === 0) return emptyStats;

  const pregById = new Map(preguntas.map((p) => [p.id, p]));
  const encById = new Map(encuestas.map((e) => [e.id, e]));

  // Promedio por pregunta escala_5
  const escala = preguntas.filter((p) => p.tipo === "escala_5");
  const porPregunta = escala
    .map((p) => {
      const vals = respuestas
        .filter((r) => r.pregunta_id === p.id && r.valor_numerico != null)
        .map((r) => r.valor_numerico as number);
      const n = vals.length;
      const prom = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
      return { id: p.id, texto: p.texto, promedio: prom, n };
    })
    .filter((x) => x.n > 0);

  const promedio =
    porPregunta.length > 0
      ? porPregunta.reduce((a, b) => a + b.promedio, 0) / porPregunta.length
      : null;

  // % incidentes
  const incidenteQ = preguntas.find((p) => p.tipo === "si_no");
  let pctIncidentes: number | null = null;
  const incidentesList: { texto: string; fecha: string }[] = [];
  if (incidenteQ) {
    const incResp = respuestas.filter((r) => r.pregunta_id === incidenteQ.id);
    const yes = incResp.filter((r) => r.valor_booleano === true);
    pctIncidentes = incResp.length > 0 ? (yes.length / incResp.length) * 100 : null;
    yes.forEach((r) => {
      const e = encById.get(r.encuesta_id);
      incidentesList.push({
        texto: r.valor_texto?.trim() || "(sin descripción)",
        fecha: e?.fecha ?? r.created_at,
      });
    });
    incidentesList.sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  }

  // Propuestas (texto_multiple_3 + texto_abierto)
  const propuestasMejora: { texto: string; fecha: string }[] = [];
  const propuestasMenu: { texto: string; fecha: string }[] = [];
  let totalPropuestas = 0;
  respuestas.forEach((r) => {
    const p = pregById.get(r.pregunta_id);
    if (!p) return;
    if (p.tipo !== "texto_multiple_3" && p.tipo !== "texto_abierto") return;
    const raw = r.valor_texto?.trim();
    if (!raw) return;
    const partes = raw
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (partes.length === 0) return;
    totalPropuestas += partes.length;
    const fecha = encById.get(r.encuesta_id)?.fecha ?? r.created_at;
    const esMenu = /men[uú]/i.test(p.texto);
    partes.forEach((t) => {
      (esMenu ? propuestasMenu : propuestasMejora).push({ texto: t, fecha });
    });
  });
  propuestasMejora.sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));
  propuestasMenu.sort((a, b) => +new Date(b.fecha) - +new Date(a.fecha));

  // Tendencia diaria: promedio de escala por día
  const byDay = new Map<string, number[]>();
  respuestas.forEach((r) => {
    const p = pregById.get(r.pregunta_id);
    if (!p || p.tipo !== "escala_5" || r.valor_numerico == null) return;
    const e = encById.get(r.encuesta_id);
    if (!e) return;
    const key = format(new Date(e.fecha), "yyyy-MM-dd");
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(r.valor_numerico);
  });
  const tendencia = Array.from(byDay.entries())
    .map(([fecha, vals]) => ({
      fecha,
      promedio: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    total: encuestas.length,
    promedio,
    pctIncidentes,
    totalPropuestas,
    porPregunta,
    tendencia,
    propuestasMejora: propuestasMejora.slice(0, 10),
    propuestasMenu: propuestasMenu.slice(0, 10),
    incidentes: incidentesList,
  };
}

export default function DashboardPage() {
  const [comedores, setComedores] = useState<Comedor[]>([]);
  const [comedorId, setComedorId] = useState<string>("");
  const [desde, setDesde] = useState<Date>(subDays(new Date(), 30));
  const [hasta, setHasta] = useState<Date>(new Date());
  const [pendingComedor, setPendingComedor] = useState<string>("");
  const [pendingDesde, setPendingDesde] = useState<Date>(subDays(new Date(), 30));
  const [pendingHasta, setPendingHasta] = useState<Date>(new Date());
  const [incluirPruebas, setIncluirPruebas] = useState<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [prevStats, setPrevStats] = useState<Stats>(emptyStats);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalisis, setAiAnalisis] = useState<AnalisisIA | null>(null);
  const [reporteId, setReporteId] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Cargar comedores
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("comedores")
        .select("id, nombre, slug, activo")
        .order("nombre");
      const lista = (data ?? []) as Comedor[];
      setComedores(lista);
      const first = lista.find((c) => c.activo) ?? lista[0];
      if (first) {
        setComedorId(first.id);
        setPendingComedor(first.id);
      }
    })();
  }, []);

  const load = useCallback(
    async (cId: string, d: Date, h: Date) => {
      if (!cId) return;
      setLoading(true);
      const desdeISO = startOfDay(d).toISOString();
      const hastaISO = addDays(startOfDay(h), 1).toISOString();
      const rango = differenceInCalendarDays(h, d) + 1;
      const prevDesde = subDays(d, rango);
      const prevHasta = subDays(d, 1);
      const prevDesdeISO = startOfDay(prevDesde).toISOString();
      const prevHastaISO = addDays(startOfDay(prevHasta), 1).toISOString();

      const [pQ, cE, pE] = await Promise.all([
        supabase.from("preguntas").select("*").order("orden"),
        (incluirPruebas
          ? supabase
              .from("encuestas")
              .select("id, fecha, comedor_id")
              .eq("comedor_id", cId)
              .gte("fecha", desdeISO)
              .lt("fecha", hastaISO)
          : supabase
              .from("encuestas")
              .select("id, fecha, comedor_id")
              .eq("comedor_id", cId)
              .eq("es_prueba", false)
              .gte("fecha", desdeISO)
              .lt("fecha", hastaISO)),
        (incluirPruebas
          ? supabase
              .from("encuestas")
              .select("id, fecha, comedor_id")
              .eq("comedor_id", cId)
              .gte("fecha", prevDesdeISO)
              .lt("fecha", prevHastaISO)
          : supabase
              .from("encuestas")
              .select("id, fecha, comedor_id")
              .eq("comedor_id", cId)
              .eq("es_prueba", false)
              .gte("fecha", prevDesdeISO)
              .lt("fecha", prevHastaISO)),
      ]);

      if (pQ.error || cE.error || pE.error) {
        toast.error("Error cargando datos");
        setLoading(false);
        return;
      }

      const preguntas = (pQ.data ?? []) as Pregunta[];
      const encActual = (cE.data ?? []) as Encuesta[];
      const encPrev = (pE.data ?? []) as Encuesta[];
      const idsActual = encActual.map((e) => e.id);
      const idsPrev = encPrev.map((e) => e.id);

      const [rA, rP] = await Promise.all([
        idsActual.length
          ? supabase.from("respuestas").select("*").in("encuesta_id", idsActual)
          : Promise.resolve({ data: [], error: null }),
        idsPrev.length
          ? supabase.from("respuestas").select("*").in("encuesta_id", idsPrev)
          : Promise.resolve({ data: [], error: null }),
      ]);

      setStats(computeStats(preguntas, encActual, (rA.data ?? []) as Respuesta[]));
      setPrevStats(computeStats(preguntas, encPrev, (rP.data ?? []) as Respuesta[]));
      setLoading(false);
    },
    [incluirPruebas]
  );

  useEffect(() => {
    if (comedorId) void load(comedorId, desde, hasta);
  }, [comedorId, desde, hasta, load]);

  // Reset análisis al cambiar filtros
  useEffect(() => {
    setAiAnalisis(null);
    setReporteId(null);
  }, [comedorId, desde, hasta, incluirPruebas]);

  const runAnalysis = useCallback(async () => {
    if (!comedorId) return;
    setAiOpen(true);
    setAiLoading(true);
    setAiAnalisis(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-responses", {
        body: {
          comedorId,
          fechaDesde: startOfDay(desde).toISOString(),
          fechaHasta: addDays(startOfDay(hasta), 1).toISOString(),
        },
      });
      if (error) {
        const msg =
          (error as { context?: { error?: string } })?.context?.error ?? error.message;
        toast.error(msg || "No pudimos analizar las respuestas");
        setAiOpen(false);
        return;
      }
      if (!data?.analisis) {
        toast.error(data?.error || "Respuesta inválida");
        setAiOpen(false);
        return;
      }
      setAiAnalisis(data.analisis);
      setReporteId(data.reporteId ?? null);
      toast.success("Análisis listo");
    } catch (e) {
      console.error(e);
      toast.error("No pudimos analizar las respuestas");
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  }, [comedorId, desde, hasta]);

  const downloadPdf = async () => {
    if (!reporteId) return;
    setPdfLoading(true);
    try {
      const { downloadReportPdf } = await import("@/lib/pdf/generateReportPdf");
      await downloadReportPdf(reporteId);
      toast.success("Reporte descargado");
    } catch (e) {
      console.error("PDF error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`No pudimos generar el PDF: ${msg}`);
    } finally {
      setPdfLoading(false);
    }
  };

  const aplicar = () => {
    setComedorId(pendingComedor);
    setDesde(pendingDesde);
    setHasta(pendingHasta);
  };

  const tendenciaFmt = useMemo(
    () =>
      stats.tendencia.map((t) => ({
        ...t,
        label: format(new Date(t.fecha), "dd MMM", { locale: es }),
      })),
    [stats.tendencia]
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Filtros sticky */}
        <div className="sticky top-0 z-10 -mx-8 -mt-6 border-b border-border bg-background/95 px-8 py-4 backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Comedor</p>
                <Select value={pendingComedor} onValueChange={setPendingComedor}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {comedores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DateField label="Desde" value={pendingDesde} onChange={setPendingDesde} />
              <DateField label="Hasta" value={pendingHasta} onChange={setPendingHasta} />
              <Button onClick={aplicar}>Aplicar filtros</Button>
              <div className="flex items-center gap-2 pb-2 pl-2">
                <Switch
                  id="incluir-pruebas"
                  checked={incluirPruebas}
                  onCheckedChange={setIncluirPruebas}
                />
                <Label htmlFor="incluir-pruebas" className="text-sm">
                  Incluir encuestas de prueba
                </Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={runAnalysis} disabled={aiLoading || !comedorId}>
                <Brain className="mr-2 h-4 w-4" /> Analizar con IA
              </Button>
              {reporteId ? (
                <Button variant="outline" onClick={downloadPdf} disabled={pdfLoading}>
                  {pdfLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="mr-2 h-4 w-4" />
                  )}
                  Descargar reporte PDF
                </Button>
              ) : (
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="outline" disabled>
                        <FileDown className="mr-2 h-4 w-4" /> Descargar reporte PDF
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Disponible tras análisis con IA</TooltipContent>
                </UiTooltip>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : stats.total === 0 ? (
          <EmptyState slug={comedores.find((c) => c.id === comedorId)?.slug ?? ""} />
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Total respuestas"
                value={stats.total.toString()}
                prev={prevStats.total}
                curr={stats.total}
              />
              <Kpi
                label="Promedio general"
                value={stats.promedio != null ? stats.promedio.toFixed(2) : "—"}
                prev={prevStats.promedio ?? 0}
                curr={stats.promedio ?? 0}
                suffix=" / 5"
              />
              <Kpi
                label="% incidentes"
                value={stats.pctIncidentes != null ? `${stats.pctIncidentes.toFixed(1)}%` : "—"}
                prev={prevStats.pctIncidentes ?? 0}
                curr={stats.pctIncidentes ?? 0}
                invert
              />
              <Kpi
                label="Propuestas recibidas"
                value={stats.totalPropuestas.toString()}
                prev={prevStats.totalPropuestas}
                curr={stats.totalPropuestas}
              />
            </div>

            {/* Gráfico promedio por pregunta */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-base font-semibold">Promedio por pregunta</h2>
              {stats.porPregunta.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, stats.porPregunta.length * 48)}>
                  <BarChart
                    data={stats.porPregunta.map((p) => ({
                      ...p,
                      texto: p.texto.length > 60 ? p.texto.slice(0, 60) + "…" : p.texto,
                    }))}
                    layout="vertical"
                    margin={{ left: 20, right: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="texto"
                      width={240}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(v: number, _n, p) => [
                        `${Number(v).toFixed(2)} (${(p.payload as { n: number }).n} resp.)`,
                        "Promedio",
                      ]}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="promedio" radius={[0, 6, 6, 0]}>
                      {stats.porPregunta.map((p) => (
                        <Cell key={p.id} fill={barColor(p.promedio)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tendencia */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 text-base font-semibold">Tendencia diaria</h2>
              {tendenciaFmt.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin datos en este rango.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={tendenciaFmt} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => [Number(v).toFixed(2), "Promedio"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="promedio"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Propuestas */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PropuestasCol
                icon={<Lightbulb className="h-4 w-4" />}
                title="Propuestas de mejora"
                items={stats.propuestasMejora}
              />
              <PropuestasCol
                icon={<UtensilsCrossed className="h-4 w-4" />}
                title="Propuestas de menú"
                items={stats.propuestasMenu}
              />
            </div>

            {/* Incidentes */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Incidentes reportados
              </h2>
              {stats.incidentes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Sin incidentes en este rango.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {stats.incidentes.map((i, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{i.texto}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(i.fecha), "dd MMM yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                      <Badge variant="destructive" className="shrink-0">Atender</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <Dialog open={aiOpen} onOpenChange={setAiOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" /> Análisis con IA
              </DialogTitle>
              <DialogDescription>
                Resumen ejecutivo generado a partir de las respuestas del rango seleccionado.
              </DialogDescription>
            </DialogHeader>

            {aiLoading ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-base font-medium">Analizando respuestas…</p>
                <p className="text-sm text-muted-foreground">Esto toma entre 15 y 30 segundos.</p>
              </div>
            ) : aiAnalisis ? (
              <AnalysisView analisis={aiAnalisis} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin análisis.</p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setAiOpen(false)}>
                Cerrar
              </Button>
              {aiAnalisis && !aiLoading && (
                <>
                  <Button variant="outline" onClick={runAnalysis}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-analizar
                  </Button>
                  <Button onClick={downloadPdf} disabled={pdfLoading || !reporteId}>
                    {pdfLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Descargar como PDF
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[180px] justify-start font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(value, "dd MMM yyyy", { locale: es })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => d && onChange(d)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Kpi({
  label,
  value,
  prev,
  curr,
  suffix,
  invert,
}: {
  label: string;
  value: string;
  prev: number;
  curr: number;
  suffix?: string;
  invert?: boolean;
}) {
  const diff = curr - prev;
  const isUp = diff > 0.0001;
  const isDown = diff < -0.0001;
  const positive = invert ? isDown : isUp;
  const negative = invert ? isUp : isDown;
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : ArrowRight;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <div
        className={cn(
          "mt-2 flex items-center gap-1 text-xs",
          positive && "text-[hsl(142_71%_35%)]",
          negative && "text-destructive",
          !positive && !negative && "text-muted-foreground"
        )}
      >
        <Icon className="h-3 w-3" />
        <span>vs. período anterior</span>
      </div>
    </div>
  );
}

function PropuestasCol({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: { texto: string; fecha: string }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
        {icon}
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Sin propuestas todavía.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li key={idx} className="rounded-lg border border-border p-3">
              <p className="text-sm text-foreground">{it.texto}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(it.fecha), "dd MMM yyyy", { locale: es })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ slug }: { slug: string }) {
  const url = slug ? `${window.location.origin}/survey/${slug}` : "";
  const copy = () => {
    if (!url) return;
    void navigator.clipboard.writeText(url);
    toast.success("URL copiada al portapapeles");
  };
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-16 text-center">
      <Inbox className="h-12 w-12 text-muted-foreground" />
      <p className="text-base font-medium text-foreground">Sin respuestas en este rango</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Cuando los comensales completen la encuesta, aquí verás los KPIs.
      </p>
      {url && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <code className="rounded-md bg-muted px-3 py-1.5 text-xs text-foreground">{url}</code>
          <Button size="sm" variant="outline" onClick={copy}>
            Compartir URL de encuesta
          </Button>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

const SEVERIDAD_STYLE: Record<"alta" | "media" | "baja", string> = {
  alta: "border-destructive/40 bg-destructive/5",
  media: "border-yellow-500/40 bg-yellow-500/5",
  baja: "border-border bg-card",
};
const PRIORIDAD_BADGE: Record<"alta" | "media" | "baja", "destructive" | "secondary" | "outline"> = {
  alta: "destructive",
  media: "secondary",
  baja: "outline",
};
const SENTIMIENTO_STYLE: Record<string, string> = {
  positivo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  neutro: "bg-muted text-muted-foreground",
  negativo: "bg-destructive/15 text-destructive",
  mixto: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
};

function AnalysisView({ analisis }: { analisis: AnalisisIA }) {
  return (
    <div className="space-y-6">
      {/* Resumen ejecutivo */}
      <section className="rounded-xl border-l-4 border-l-primary border border-border bg-primary/5 p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
          Resumen ejecutivo
        </h3>
        <div className="space-y-1 text-sm">
          {analisis.resumenEjecutivo.split("\n").map((line, i) => {
            const t = line.replace(/^[-*]\s*/, "").trim();
            if (!t) return null;
            return (
              <div key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{t}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sentimiento */}
      <section className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Sentimiento general:</span>
        <span
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-semibold capitalize",
            SENTIMIENTO_STYLE[analisis.sentimientoComentarios] ?? SENTIMIENTO_STYLE.neutro
          )}
        >
          {analisis.sentimientoComentarios}
        </span>
      </section>

      {/* Fortalezas / Áreas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Fortalezas
          </h3>
          {analisis.fortalezas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin fortalezas identificadas.</p>
          ) : (
            <ul className="space-y-3">
              {analisis.fortalezas.map((f, i) => (
                <li key={i} className="rounded-lg bg-card p-3">
                  <p className="text-sm font-semibold">{f.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.evidencia}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
            Áreas de oportunidad
          </h3>
          {analisis.areasOportunidad.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin áreas detectadas.</p>
          ) : (
            <ul className="space-y-3">
              {analisis.areasOportunidad.map((a, i) => (
                <li
                  key={i}
                  className={cn("rounded-lg border p-3", SEVERIDAD_STYLE[a.severidad] ?? "")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{a.titulo}</p>
                    <Badge variant={PRIORIDAD_BADGE[a.severidad] ?? "outline"} className="capitalize">
                      {a.severidad}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.evidencia}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recomendaciones */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
          Recomendaciones
        </h3>
        {analisis.recomendaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin recomendaciones.</p>
        ) : (
          <ol className="space-y-3">
            {analisis.recomendaciones.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-border p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{r.accion}</p>
                    <Badge variant={PRIORIDAD_BADGE[r.prioridad] ?? "outline"} className="capitalize">
                      {r.prioridad}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Impacto esperado: {r.impactoEsperado}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Citas destacadas */}
      {analisis.citasDestacadas.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
            Citas destacadas
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {analisis.citasDestacadas.map((c, i) => (
              <blockquote
                key={i}
                className="rounded-xl border border-border bg-muted/30 p-4 text-sm italic text-foreground"
              >
                <Quote className="mb-2 h-4 w-4 text-muted-foreground" />
                "{c}"
              </blockquote>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
