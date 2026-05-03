import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  CheckCircle2,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "pending" | "approved" | "archived" | "deleted";
type TabKey = Status | "all";

type Row = {
  id: string;
  created_at: string;
  comment: string | null;
  comment_status: Status;
  response_time_ms: number;
  question_1_score: number;
  question_2_score: number;
  question_3_trend: string;
  question_4_recommend: string;
  is_flagged: boolean;
};

type Suggestion = {
  suggested_action: Status;
  reasoning: string;
  flags: string[];
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  archived: "Archivado",
  deleted: "Borrado",
};

const STATUS_BADGE: Record<Status, string> = {
  pending: "bg-warning/10 text-warning hover:bg-warning/10",
  approved: "bg-success/10 text-success hover:bg-success/10",
  archived: "bg-muted text-muted-foreground hover:bg-muted",
  deleted: "bg-danger/10 text-danger hover:bg-danger/10",
};

export default function Comments() {
  const [tab, setTab] = useState<TabKey>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | "loading" | "error">>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("surveys")
      .select(
        "id, created_at, comment, comment_status, response_time_ms, question_1_score, question_2_score, question_3_trend, question_4_recommend, is_flagged"
      )
      .not("comment", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("No pudimos cargar los comentarios");
      setLoading(false);
      return;
    }
    setRows((data as Row[]) ?? []);
    setLoading(false);
    setSelected(new Set());
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.comment_status === tab)),
    [tab, rows]
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { pending: 0, approved: 0, archived: 0, deleted: 0, all: rows.length };
    for (const r of rows) c[r.comment_status]++;
    return c;
  }, [rows]);

  const setStatus = async (ids: string[], status: Status) => {
    if (!ids.length) return;
    const { error } = await supabase
      .from("surveys")
      .update({ comment_status: status })
      .in("id", ids);
    if (error) {
      toast.error("No se pudo actualizar");
      return;
    }
    setRows((prev) =>
      prev.map((r) => (ids.includes(r.id) ? { ...r, comment_status: status } : r))
    );
    setSelected(new Set());
    toast.success(
      ids.length > 1
        ? `${ids.length} comentarios → ${STATUS_LABEL[status]}`
        : `Comentario marcado como ${STATUS_LABEL[status]}`
    );
  };

  const suggest = async (row: Row) => {
    setSuggestions((p) => ({ ...p, [row.id]: "loading" }));
    try {
      const { data, error } = await supabase.functions.invoke<Suggestion | { error: string }>(
        "moderate-comment",
        {
          body: {
            comment: row.comment,
            scores: {
              sabor: row.question_1_score,
              limpieza: row.question_2_score,
              tendencia: row.question_3_trend,
              recomendacion: row.question_4_recommend,
            },
          },
        }
      );
      if (error || !data || "error" in (data as object)) {
        throw new Error("error");
      }
      setSuggestions((p) => ({ ...p, [row.id]: data as Suggestion }));
    } catch {
      setSuggestions((p) => ({ ...p, [row.id]: "error" }));
      toast.error("No se pudo obtener la sugerencia");
    }
  };

  const allChecked = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(filtered.map((r) => r.id)));

  const selectedIds = Array.from(selected);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="pending">Pendientes ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Aprobados ({counts.approved})</TabsTrigger>
            <TabsTrigger value="archived">Archivados ({counts.archived})</TabsTrigger>
            <TabsTrigger value="deleted">Borrados ({counts.deleted})</TabsTrigger>
            <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
          </TabsList>
        </Tabs>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <span className="font-medium">{selectedIds.length} seleccionados</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStatus(selectedIds, "approved")}>
                <CheckCircle2 className="mr-1.5 h-4 w-4 text-success" /> Aprobar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(selectedIds, "archived")}>
                <Archive className="mr-1.5 h-4 w-4" /> Archivar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(selectedIds, "deleted")}>
                <Trash2 className="mr-1.5 h-4 w-4 text-danger" /> Borrar
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No hay comentarios en esta vista.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="w-32">Fecha</TableHead>
                  <TableHead>Comentario</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-[260px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const sug = suggestions[r.id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(r.id);
                            else next.delete(r.id);
                            setSelected(next);
                          }}
                        />
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {format(new Date(r.created_at), "dd MMM HH:mm")}
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                          {(r.response_time_ms / 1000).toFixed(1)}s
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="text-sm text-foreground">{r.comment}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                          <ContextChip label="Sabor" value={`${r.question_1_score}/5`} score={r.question_1_score} />
                          <ContextChip label="Limpio" value={`${r.question_2_score}/5`} score={r.question_2_score} />
                          <ContextChip label="Tendencia" value={r.question_3_trend} />
                          <ContextChip label="Recomienda" value={r.question_4_recommend} />
                          {r.is_flagged && (
                            <Badge variant="secondary" className="bg-danger/10 text-danger hover:bg-danger/10">
                              flagged
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="secondary" className={STATUS_BADGE[r.comment_status]}>
                          {STATUS_LABEL[r.comment_status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center justify-end gap-1">
                          <IconBtn label="Aprobar" onClick={() => setStatus([r.id], "approved")}>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </IconBtn>
                          <IconBtn label="Archivar" onClick={() => setStatus([r.id], "archived")}>
                            <Archive className="h-4 w-4" />
                          </IconBtn>
                          <IconBtn label="Borrar" onClick={() => setStatus([r.id], "deleted")}>
                            <Trash2 className="h-4 w-4 text-danger" />
                          </IconBtn>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => void suggest(r)}
                                disabled={sug === "loading"}
                              >
                                {sug === "loading" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 text-brand" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              {!sug && <span>Pedir sugerencia a la IA</span>}
                              {sug === "loading" && <span>Pensando…</span>}
                              {sug === "error" && <span>Error al pedir sugerencia</span>}
                              {sug && typeof sug === "object" && (
                                <div className="space-y-1.5 text-xs">
                                  <div className="font-semibold">
                                    Sugerencia: {STATUS_LABEL[sug.suggested_action]}
                                  </div>
                                  <p>{sug.reasoning}</p>
                                  {sug.flags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {sug.flags.map((f) => (
                                        <span
                                          key={f}
                                          className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px]"
                                        >
                                          {f}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <p className="pt-1 text-muted-foreground">Tú decides la acción final.</p>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function IconBtn({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ContextChip({ label, value, score }: { label: string; value: string; score?: number }) {
  const tone =
    score === undefined
      ? "border-border text-muted-foreground"
      : score >= 4
        ? "border-success/30 text-success"
        : score >= 3
          ? "border-warning/30 text-warning"
          : "border-danger/30 text-danger";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 font-medium", tone)}>
      {label}: {value}
    </span>
  );
}
