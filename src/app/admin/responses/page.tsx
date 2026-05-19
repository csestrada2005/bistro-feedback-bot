import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import Papa from "papaparse";
import {
  ArrowUpDown,
  CalendarIcon,
  Download,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Tipo = "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3";
type Comedor = { id: string; nombre: string; slug: string };
type Pregunta = {
  id: string;
  texto: string;
  tipo: Tipo;
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
};

type Row = {
  id: string;
  fecha: string;
  comedor_id: string;
  promedio: number | null;
  incidente: boolean | null;
  incidenteDesc: string | null;
  numPropuestas: number;
  respuestas: Respuesta[];
};

const ALL = "__all__";
const PAGE_SIZE = 50;

export default function ResponsesPage() {
  const [comedores, setComedores] = useState<Comedor[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [comedorId, setComedorId] = useState<string>(ALL);
  const [desde, setDesde] = useState<Date>(subDays(new Date(), 30));
  const [hasta, setHasta] = useState<Date>(new Date());
  const [tipoFiltro, setTipoFiltro] = useState<string>(ALL);
  const [soloIncidente, setSoloIncidente] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Row | null>(null);

  // Cargar comedores + preguntas (una vez)
  useEffect(() => {
    void (async () => {
      const [c, p] = await Promise.all([
        supabase.from("comedores").select("id, nombre, slug").order("nombre"),
        supabase.from("preguntas").select("*").order("orden"),
      ]);
      setComedores((c.data ?? []) as Comedor[]);
      setPreguntas((p.data ?? []) as Pregunta[]);
    })();
  }, []);

  const pregById = useMemo(() => new Map(preguntas.map((p) => [p.id, p])), [preguntas]);
  const comedorById = useMemo(
    () => new Map(comedores.map((c) => [c.id, c])),
    [comedores]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const desdeISO = startOfDay(desde).toISOString();
    const hastaISO = addDays(startOfDay(hasta), 1).toISOString();

    // Encuestas filtradas + count
    let q = supabase
      .from("encuestas")
      .select("id, fecha, comedor_id", { count: "exact" })
      .gte("fecha", desdeISO)
      .lt("fecha", hastaISO);
    if (comedorId !== ALL) q = q.eq("comedor_id", comedorId);
    q = q.order("fecha", { ascending: !sortDesc });
    q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const { data: encData, error: encErr, count } = await q;
    if (encErr) {
      toast.error("Error cargando encuestas");
      setLoading(false);
      return;
    }
    const encuestas = (encData ?? []) as Encuesta[];
    setTotalCount(count ?? 0);

    const ids = encuestas.map((e) => e.id);
    let respuestas: Respuesta[] = [];
    if (ids.length) {
      const { data } = await supabase.from("respuestas").select("*").in("encuesta_id", ids);
      respuestas = (data ?? []) as Respuesta[];
    }

    let rowsBuilt: Row[] = encuestas.map((e) => {
      const own = respuestas.filter((r) => r.encuesta_id === e.id);
      const escalas = own
        .filter((r) => {
          const p = pregById.get(r.pregunta_id);
          return p?.tipo === "escala_5" && r.valor_numerico != null;
        })
        .map((r) => r.valor_numerico as number);
      const prom = escalas.length
        ? escalas.reduce((a, b) => a + b, 0) / escalas.length
        : null;

      const incResp = own.find((r) => pregById.get(r.pregunta_id)?.tipo === "si_no");
      const incidente = incResp?.valor_booleano ?? null;
      const incidenteDesc = incResp?.valor_texto ?? null;

      let numProps = 0;
      own.forEach((r) => {
        const p = pregById.get(r.pregunta_id);
        if (!p) return;
        if (p.tipo !== "texto_multiple_3" && p.tipo !== "texto_abierto") return;
        const partes = (r.valor_texto ?? "")
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
        numProps += partes.length;
      });

      return {
        id: e.id,
        fecha: e.fecha,
        comedor_id: e.comedor_id,
        promedio: prom,
        incidente,
        incidenteDesc,
        numPropuestas: numProps,
        respuestas: own,
      };
    });

    // Filtros client-side (sobre la página actual)
    if (soloIncidente) rowsBuilt = rowsBuilt.filter((r) => r.incidente === true);
    if (tipoFiltro !== ALL) {
      rowsBuilt = rowsBuilt.filter((r) =>
        r.respuestas.some((x) => pregById.get(x.pregunta_id)?.tipo === tipoFiltro)
      );
    }

    setRows(rowsBuilt);
    setLoading(false);
  }, [comedorId, desde, hasta, page, sortDesc, soloIncidente, tipoFiltro, pregById]);

  useEffect(() => {
    if (preguntas.length) void load();
  }, [load, preguntas.length]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [comedorId, desde, hasta, tipoFiltro, soloIncidente, sortDesc]);

  const exportCSV = async () => {
    const desdeISO = startOfDay(desde).toISOString();
    const hastaISO = addDays(startOfDay(hasta), 1).toISOString();
    let q = supabase
      .from("encuestas")
      .select("id, fecha, comedor_id")
      .gte("fecha", desdeISO)
      .lt("fecha", hastaISO)
      .order("fecha", { ascending: !sortDesc });
    if (comedorId !== ALL) q = q.eq("comedor_id", comedorId);

    const { data: encs, error } = await q;
    if (error) {
      toast.error("Error exportando");
      return;
    }
    const encuestas = (encs ?? []) as Encuesta[];
    const ids = encuestas.map((e) => e.id);
    let resps: Respuesta[] = [];
    if (ids.length) {
      const { data } = await supabase.from("respuestas").select("*").in("encuesta_id", ids);
      resps = (data ?? []) as Respuesta[];
    }
    const incidenteQ = preguntas.find((p) => p.tipo === "si_no");
    const otras = preguntas.filter((p) => p.id !== incidenteQ?.id);

    const rowsCSV = encuestas
      .map((e) => {
        const own = resps.filter((r) => r.encuesta_id === e.id);
        const obj: Record<string, string | number | null> = {
          id: e.id,
          fecha: format(new Date(e.fecha), "yyyy-MM-dd HH:mm"),
          comedor: comedorById.get(e.comedor_id)?.nombre ?? "",
        };
        const incR = incidenteQ ? own.find((r) => r.pregunta_id === incidenteQ.id) : undefined;
        obj["incidente_si_no"] = incR?.valor_booleano == null ? "" : incR.valor_booleano ? "sí" : "no";
        obj["incidente_desc"] = incR?.valor_texto ?? "";
        otras.forEach((p) => {
          const r = own.find((x) => x.pregunta_id === p.id);
          let v: string | number = "";
          if (r) {
            if (p.tipo === "escala_5") v = r.valor_numerico ?? "";
            else v = r.valor_texto ?? "";
          }
          obj[p.texto] = v;
        });
        // Filtros aplican igual que en tabla
        if (soloIncidente && incR?.valor_booleano !== true) return null;
        return obj;
      })
      .filter(Boolean) as Record<string, unknown>[];

    const csv = Papa.unparse(rowsCSV);
    const comedorSlug =
      comedorId === ALL ? "todos" : comedorById.get(comedorId)?.slug ?? "comedor";
    const fname = `respuestas_${comedorSlug}_${format(desde, "yyyyMMdd")}_${format(
      hasta,
      "yyyyMMdd"
    )}.csv`;
    // BOM para que Excel detecte UTF-8
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Comedor">
            <Select value={comedorId} onValueChange={setComedorId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {comedores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DateField label="Desde" value={desde} onChange={setDesde} />
          <DateField label="Hasta" value={hasta} onChange={setHasta} />
          <Field label="Tipo de pregunta">
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                <SelectItem value="escala_5">Escala 1–5</SelectItem>
                <SelectItem value="si_no">Sí o No</SelectItem>
                <SelectItem value="texto_abierto">Texto abierto</SelectItem>
                <SelectItem value="texto_multiple_3">3 textos cortos</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2 pb-2">
            <Switch
              id="solo-inc"
              checked={soloIncidente}
              onCheckedChange={setSoloIncidente}
            />
            <Label htmlFor="solo-inc" className="text-sm">
              Solo con incidente
            </Label>
          </div>
          <div className="ml-auto">
            <Button onClick={exportCSV} variant="outline">
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No hay encuestas con estos filtros.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={() => setSortDesc((s) => !s)}
                    >
                      Fecha <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Comedor</TableHead>
                  <TableHead>Promedio</TableHead>
                  <TableHead>Incidente</TableHead>
                  <TableHead>Propuestas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.id.slice(-6)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(r.fecha), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {comedorById.get(r.comedor_id)?.nombre ?? "—"}
                    </TableCell>
                    <TableCell>
                      {r.promedio != null ? (
                        <Badge variant="secondary">{r.promedio.toFixed(2)}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.incidente == null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : r.incidente ? (
                        <Badge variant="destructive">Sí</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{r.numPropuestas}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(r)}>
                        <Eye className="mr-1 h-4 w-4" /> Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {totalCount} encuestas · página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <DetailSheet
        row={detail}
        onClose={() => setDetail(null)}
        preguntas={preguntas}
        comedorNombre={detail ? comedorById.get(detail.comedor_id)?.nombre ?? "—" : ""}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
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
    <Field label={label}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[170px] justify-start font-normal">
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
    </Field>
  );
}

function scoreColor(v: number) {
  if (v < 2.5) return "bg-destructive/15 text-destructive";
  if (v < 3.5) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
}

function DetailSheet({
  row,
  onClose,
  preguntas,
  comedorNombre,
}: {
  row: Row | null;
  onClose: () => void;
  preguntas: Pregunta[];
  comedorNombre: string;
}) {
  const pregById = useMemo(() => new Map(preguntas.map((p) => [p.id, p])), [preguntas]);

  const escalas = row
    ? preguntas
        .filter((p) => p.tipo === "escala_5")
        .map((p) => ({
          p,
          r: row.respuestas.find((x) => x.pregunta_id === p.id),
        }))
        .filter((x) => x.r?.valor_numerico != null)
    : [];

  const incidenteQ = preguntas.find((p) => p.tipo === "si_no");
  const incidenteR = row && incidenteQ ? row.respuestas.find((x) => x.pregunta_id === incidenteQ.id) : null;

  const propMejora: { texto: string; pregunta: string }[] = [];
  const propMenu: { texto: string; pregunta: string }[] = [];
  if (row) {
    row.respuestas.forEach((r) => {
      const p = pregById.get(r.pregunta_id);
      if (!p) return;
      if (p.tipo !== "texto_multiple_3" && p.tipo !== "texto_abierto") return;
      const partes = (r.valor_texto ?? "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      const esMenu = /men[uú]/i.test(p.texto);
      partes.forEach((t) => {
        (esMenu ? propMenu : propMejora).push({ texto: t, pregunta: p.texto });
      });
    });
  }

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle>Detalle de encuesta</SheetTitle>
              <SheetDescription>
                {format(new Date(row.fecha), "dd MMM yyyy, HH:mm", { locale: es })} · {comedorNombre}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Escala 1–5
                </h3>
                {escalas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin respuestas.</p>
                ) : (
                  <ul className="space-y-2">
                    {escalas.map(({ p, r }) => (
                      <li
                        key={p.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <p className="flex-1 text-sm">{p.texto}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold",
                            scoreColor(r!.valor_numerico as number)
                          )}
                        >
                          {r!.valor_numerico}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Incidente
                </h3>
                {!incidenteR ? (
                  <p className="text-sm text-muted-foreground">Sin respuesta.</p>
                ) : (
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-2">
                      {incidenteR.valor_booleano ? (
                        <Badge variant="destructive">Sí</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </div>
                    {incidenteR.valor_texto && (
                      <p className="text-sm text-foreground">{incidenteR.valor_texto}</p>
                    )}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Propuestas de mejora
                </h3>
                {propMejora.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin propuestas.</p>
                ) : (
                  <ul className="space-y-2">
                    {propMejora.map((x, i) => (
                      <li key={i} className="rounded-lg border border-border p-3 text-sm">
                        {x.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Propuestas de menú
                </h3>
                {propMenu.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin propuestas.</p>
                ) : (
                  <ul className="space-y-2">
                    {propMenu.map((x, i) => (
                      <li key={i} className="rounded-lg border border-border p-3 text-sm">
                        {x.texto}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
