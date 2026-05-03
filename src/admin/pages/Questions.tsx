import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type QuestionRow = {
  id: string;
  order_num: number;
  question_text: string;
  question_type: "scale_5" | "trend_3" | "recommend_3" | "comment";
  is_active: boolean;
};

const TYPE_LABEL: Record<QuestionRow["question_type"], string> = {
  scale_5: "Escala 1-5",
  trend_3: "Tendencia (3 opciones)",
  recommend_3: "Recomendación (3 opciones)",
  comment: "Comentario abierto",
};

export default function Questions() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("questions")
      .select("id, order_num, question_text, question_type, is_active")
      .order("order_num", { ascending: true });
    if (error) {
      toast.error("No pudimos cargar las preguntas");
      setLoading(false);
      return;
    }
    const list = (data as QuestionRow[]) ?? [];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((q) => [q.id, q.question_text])));
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSave = async () => {
    if (!pending) return;
    setSaving(pending.id);
    const { error } = await supabase
      .from("questions")
      .update({ question_text: pending.text, updated_at: new Date().toISOString() })
      .eq("id", pending.id);
    setSaving(null);
    if (error) {
      toast.error("No se pudo guardar el cambio");
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === pending.id ? { ...r, question_text: pending.text } : r))
    );
    toast.success("Pregunta actualizada");
    setPending(null);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            Cambiar las preguntas afecta la comparabilidad histórica
          </p>
          <p className="mt-1 text-muted-foreground">
            Los datos antes y después del cambio no son directamente comparables. Cambia el texto solo cuando sea estrictamente necesario.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((q) => {
          const draft = drafts[q.id] ?? "";
          const dirty = draft.trim() !== q.question_text.trim();
          return (
            <div
              key={q.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {q.order_num}
                </span>
                <Badge variant="secondary">{TYPE_LABEL[q.question_type]}</Badge>
                {!q.is_active && <Badge variant="secondary">Inactiva</Badge>}
              </div>
              <Input
                value={draft}
                onChange={(e) => setDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
                className="text-base"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                {dirty && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrafts((p) => ({ ...p, [q.id]: q.question_text }))}
                  >
                    Cancelar
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!dirty || draft.trim().length === 0 || saving === q.id}
                  onClick={() => setPending({ id: q.id, text: draft.trim() })}
                  className="gap-1.5"
                >
                  {saving === q.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar el nuevo texto?</AlertDialogTitle>
            <AlertDialogDescription>
              Las respuestas históricas con el texto anterior se mantienen, pero los reportes a futuro
              usarán el nuevo enunciado. Confirma que el cambio es necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">"{pending?.text}"</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>Sí, guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
