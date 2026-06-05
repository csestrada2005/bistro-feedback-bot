import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Sparkles, Trash2, FileQuestion, Loader2, Check, X } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Tipo = "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3";

type Pregunta = {
  id: string;
  texto: string;
  tipo: Tipo;
  orden: number;
  activa: boolean;
  comedor_id: string | null;
};

type Comedor = { id: string; nombre: string; slug: string };

const TIPO_LABEL: Record<Tipo, string> = {
  escala_5: "Escala 1–5",
  si_no: "Sí o No",
  texto_abierto: "Texto abierto",
  texto_multiple_3: "3 textos cortos",
};

const TIPO_OPTIONS: { value: Tipo; label: string }[] = [
  { value: "escala_5", label: "Escala 1–5" },
  { value: "si_no", label: "Sí o No" },
  { value: "texto_abierto", label: "Texto abierto" },
  { value: "texto_multiple_3", label: "3 textos cortos" },
];

const ALL = "__all__";

type FormState = {
  texto: string;
  tipo: Tipo;
  activa: boolean;
  comedorIds: string[];
};

const emptyForm: FormState = {
  texto: "",
  tipo: "escala_5",
  activa: true,
  comedorIds: [],
};

export default function QuestionsPage() {
  const [loading, setLoading] = useState(true);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [comedores, setComedores] = useState<Comedor[]>([]);
  const [filterComedor, setFilterComedor] = useState<string>(ALL);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pregunta | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Pregunta | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiContexto, setAiContexto] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSugerencias, setAiSugerencias] = useState<
    { texto: string; tipo: "escala_5" | "si_no" | "texto_abierto"; justificacion: string }[]
  >([]);
  const [aiComedor, setAiComedor] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [
      { data: pData, error: pErr },
      { data: cData, error: cErr },
      { data: aData, error: aErr },
    ] = await Promise.all([
      supabase.from("preguntas").select("*").order("orden", { ascending: true }),
      supabase.from("comedores").select("id, nombre, slug").order("nombre"),
      supabase.from("comedor_preguntas").select("pregunta_id, comedor_id"),
    ]);
    if (pErr) toast.error("Error cargando preguntas");
    if (cErr) toast.error("Error cargando comedores");
    if (aErr) toast.error("Error cargando asignaciones");
    setPreguntas((pData ?? []) as Pregunta[]);
    setComedores((cData ?? []) as Comedor[]);
    const map: Record<string, string[]> = {};
    for (const row of (aData ?? []) as { pregunta_id: string; comedor_id: string }[]) {
      (map[row.pregunta_id] ??= []).push(row.comedor_id);
    }
    setAssignments(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibles = useMemo(() => {
    if (filterComedor === ALL) return preguntas;
    return preguntas.filter((p) => assignments[p.id]?.includes(filterComedor));
  }, [preguntas, filterComedor, assignments]);

  // Default comedor para sugerencias = filtro actual o primero
  useEffect(() => {
    if (!aiComedor) {
      if (filterComedor !== ALL) setAiComedor(filterComedor);
      else if (comedores[0]) setAiComedor(comedores[0].id);
    }
  }, [filterComedor, comedores, aiComedor]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibles.findIndex((p) => p.id === active.id);
    const newIndex = visibles.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(visibles, oldIndex, newIndex);
    // Re-asignar orden secuencial a las visibles
    const updates = reordered.map((p, idx) => ({ id: p.id, orden: idx + 1 }));

    // Optimistic: actualizar state combinando con preguntas no visibles
    const idToOrden = new Map(updates.map((u) => [u.id, u.orden]));
    setPreguntas((prev) =>
      [...prev]
        .map((p) => (idToOrden.has(p.id) ? { ...p, orden: idToOrden.get(p.id)! } : p))
        .sort((a, b) => a.orden - b.orden)
    );

    const results = await Promise.all(
      updates.map((u) => supabase.from("preguntas").update({ orden: u.orden }).eq("id", u.id))
    );
    if (results.some((r) => r.error)) {
      toast.error("Error al reordenar");
      void loadData();
    } else {
      toast.success("Orden actualizado");
    }
  };

  const toggleActiva = async (p: Pregunta, value: boolean) => {
    setPreguntas((prev) => prev.map((x) => (x.id === p.id ? { ...x, activa: value } : x)));
    const { error } = await supabase.from("preguntas").update({ activa: value }).eq("id", p.id);
    if (error) {
      toast.error("Error al actualizar");
      setPreguntas((prev) => prev.map((x) => (x.id === p.id ? { ...x, activa: !value } : x)));
    } else {
      toast.success(value ? "Pregunta activada" : "Pregunta desactivada");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      comedorIds:
        filterComedor !== ALL ? [filterComedor] : comedores.map((c) => c.id),
    });
    setModalOpen(true);
  };

  const openEdit = (p: Pregunta) => {
    setEditing(p);
    setForm({
      texto: p.texto,
      tipo: p.tipo,
      activa: p.activa,
      comedorIds: assignments[p.id] ?? [],
    });
    setModalOpen(true);
  };

  const syncAssignments = async (preguntaId: string, comedorIds: string[]) => {
    const current = new Set(assignments[preguntaId] ?? []);
    const next = new Set(comedorIds);
    const toAdd = [...next].filter((c) => !current.has(c));
    const toRemove = [...current].filter((c) => !next.has(c));
    if (toAdd.length) {
      await supabase
        .from("comedor_preguntas")
        .insert(toAdd.map((c) => ({ pregunta_id: preguntaId, comedor_id: c })));
    }
    if (toRemove.length) {
      await supabase
        .from("comedor_preguntas")
        .delete()
        .eq("pregunta_id", preguntaId)
        .in("comedor_id", toRemove);
    }
  };

  const handleSave = async () => {
    if (!form.texto.trim()) {
      toast.error("El texto de la pregunta es obligatorio");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("preguntas")
        .update({
          texto: form.texto.trim(),
          tipo: form.tipo,
          activa: form.activa,
        })
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast.error("Error al guardar");
        return;
      }
      await syncAssignments(editing.id, form.comedorIds);
      setSaving(false);
      toast.success("Pregunta actualizada");
    } else {
      const maxOrden = preguntas.reduce((m, p) => Math.max(m, p.orden), 0);
      const { data: inserted, error } = await supabase
        .from("preguntas")
        .insert({
          texto: form.texto.trim(),
          tipo: form.tipo,
          activa: form.activa,
          orden: maxOrden + 1,
        })
        .select("id")
        .single();
      if (error) {
        setSaving(false);
        toast.error("Error al crear");
        return;
      }
      if (inserted && form.comedorIds.length) {
        await supabase
          .from("comedor_preguntas")
          .insert(form.comedorIds.map((c) => ({ pregunta_id: inserted.id, comedor_id: c })));
      }
      setSaving(false);
      toast.success("Pregunta creada");
    }
    setModalOpen(false);
    void loadData();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { count, error: countErr } = await supabase
      .from("respuestas")
      .select("*", { count: "exact", head: true })
      .eq("pregunta_id", confirmDelete.id);
    if (countErr) {
      toast.error("No se pudo verificar respuestas asociadas");
      setConfirmDelete(null);
      return;
    }
    if ((count ?? 0) > 0) {
      toast.error("No se puede borrar: tiene respuestas. Desactívala en su lugar.");
      setConfirmDelete(null);
      return;
    }
    const { error } = await supabase.from("preguntas").delete().eq("id", confirmDelete.id);
    if (error) {
      toast.error("Error al borrar");
    } else {
      toast.success("Pregunta borrada");
      void loadData();
    }
    setConfirmDelete(null);
  };

  const openAi = () => {
    setAiSugerencias([]);
    setAiContexto("");
    setAiOpen(true);
  };

  const generarSugerencias = async () => {
    const comedor = comedores.find((c) => c.id === aiComedor);
    if (!comedor) {
      toast.error("Selecciona un comedor primero");
      return;
    }
    setAiLoading(true);
    setAiSugerencias([]);
    try {
      const preguntasContexto = preguntas
        .filter((p) => p.comedor_id === null || p.comedor_id === aiComedor)
        .map((p) => p.texto);
      const { data, error } = await supabase.functions.invoke("suggest-questions", {
        body: {
          comedorNombre: comedor.nombre,
          contextoAdicional: aiContexto.trim(),
          preguntasExistentes: preguntasContexto,
        },
      });
      if (error || !data?.sugerencias) {
        console.error("Sugerencias error", error, data);
        toast.error("No pudimos generar sugerencias. Intenta de nuevo.");
        return;
      }
      setAiSugerencias(data.sugerencias);
    } catch (e) {
      console.error(e);
      toast.error("No pudimos generar sugerencias. Intenta de nuevo.");
    } finally {
      setAiLoading(false);
    }
  };

  const aceptarSugerencia = async (
    s: { texto: string; tipo: "escala_5" | "si_no" | "texto_abierto"; justificacion: string },
    idx: number
  ) => {
    const maxOrden = preguntas.reduce((m, p) => Math.max(m, p.orden), 0);
    const { data: inserted, error } = await supabase
      .from("preguntas")
      .insert({
        texto: s.texto,
        tipo: s.tipo,
        activa: true,
        orden: maxOrden + 1,
      })
      .select("id")
      .single();
    if (error) {
      toast.error("No se pudo agregar");
      return;
    }
    if (inserted && aiComedor) {
      await supabase
        .from("comedor_preguntas")
        .insert({ pregunta_id: inserted.id, comedor_id: aiComedor });
    }
    toast.success("Pregunta agregada");
    setAiSugerencias((prev) => prev.filter((_, i) => i !== idx));
    void loadData();
  };

  const descartarSugerencia = (idx: number) => {
    setAiSugerencias((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm text-muted-foreground">Filtrar por comedor:</Label>
          <Select value={filterComedor} onValueChange={setFilterComedor}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los comedores</SelectItem>
              {comedores.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openAi}>
            <Sparkles className="mr-2 h-4 w-4" /> Sugerir preguntas con IA
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nueva pregunta
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <FileQuestion className="h-12 w-12 text-muted-foreground" />
            <p className="text-base font-medium text-foreground">Aún no hay preguntas</p>
            <p className="text-sm text-muted-foreground">
              Crea la primera para comenzar a recolectar feedback.
            </p>
            <Button onClick={openCreate} className="mt-2">
              <Plus className="mr-2 h-4 w-4" /> Crear primera pregunta
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="w-16">Orden</TableHead>
                <TableHead>Texto</TableHead>
                <TableHead className="w-40">Tipo</TableHead>
                <TableHead className="w-40">Comedor</TableHead>
                <TableHead className="w-24">Activa</TableHead>
                <TableHead className="w-28 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibles.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {visibles.map((p) => (
                    <SortableRow
                      key={p.id}
                      pregunta={p}
                      comedorNombre={
                        p.comedor_id
                          ? comedores.find((c) => c.id === p.comedor_id)?.nombre ?? "—"
                          : null
                      }
                      onToggle={(v) => toggleActiva(p, v)}
                      onEdit={() => openEdit(p)}
                      onDelete={() => setConfirmDelete(p)}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </DndContext>
          </Table>
        )}
      </div>

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar pregunta" : "Nueva pregunta"}</DialogTitle>
            <DialogDescription>
              Configura cómo aparecerá esta pregunta en la encuesta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="texto">Texto de la pregunta</Label>
              <Textarea
                id="texto"
                value={form.texto}
                onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
                rows={3}
                placeholder="¿Cómo evalúas la calidad de la comida?"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as Tipo }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aplica a</Label>
              <Select
                value={form.comedor_id ?? ALL}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, comedor_id: v === ALL ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los comedores</SelectItem>
                  {comedores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Solo {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Activa</p>
                <p className="text-xs text-muted-foreground">
                  Si está apagada, no aparece en la encuesta pública.
                </p>
              </div>
              <Switch
                checked={form.activa}
                onCheckedChange={(v) => setForm((f) => ({ ...f, activa: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta pregunta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si la pregunta ya tiene respuestas asociadas,
              no podrá borrarse — desactívala en su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal IA */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> Sugerencias inteligentes
            </DialogTitle>
            <DialogDescription>
              La IA propondrá preguntas nuevas para este comedor, evitando las que ya existen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comedor</Label>
              <Select value={aiComedor} onValueChange={setAiComedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un comedor" />
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
            <div className="space-y-2">
              <Label htmlFor="ai-ctx">Contexto adicional (opcional)</Label>
              <Textarea
                id="ai-ctx"
                value={aiContexto}
                onChange={(e) => setAiContexto(e.target.value)}
                placeholder="Ej: vamos a lanzar nuevo menú vegetariano"
                rows={3}
              />
            </div>
            <Button onClick={generarSugerencias} disabled={aiLoading} className="w-full">
              {aiLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Generar sugerencias
                </>
              )}
            </Button>

            {aiSugerencias.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {aiSugerencias.length} sugerencia{aiSugerencias.length !== 1 ? "s" : ""}
                </p>
                {aiSugerencias.map((s, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 text-sm font-medium">{s.texto}</p>
                      <Badge variant="secondary" className="shrink-0">
                        {TIPO_LABEL[s.tipo]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.justificacion}</p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => aceptarSugerencia(s, i)}>
                        <Check className="mr-1 h-3 w-3" /> Agregar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => descartarSugerencia(i)}
                      >
                        <X className="mr-1 h-3 w-3" /> Descartar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableRow({
  pregunta,
  comedorNombre,
  onToggle,
  onEdit,
  onDelete,
}: {
  pregunta: Pregunta;
  comedorNombre: string | null;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pregunta.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">{pregunta.orden}</TableCell>
      <TableCell className="max-w-md">
        <p className="line-clamp-2 text-sm">{pregunta.texto}</p>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{TIPO_LABEL[pregunta.tipo]}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {comedorNombre ?? "Todos"}
      </TableCell>
      <TableCell>
        <Switch checked={pregunta.activa} onCheckedChange={onToggle} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label="Borrar"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
