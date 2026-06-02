import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/admin/auth/AuthProvider";

type Kpi = { label: string; value: string };
type Reco = { titulo: string; detalle: string; prioridad: string };
type Alerta = { titulo: string; detalle: string; severidad: string };

type Reporte = {
  id: string;
  titulo: string | null;
  estado: string;
  resumen: string | null;
  kpis: Kpi[];
  recomendaciones: Reco[];
  alertas: Alerta[];
  fecha_desde: string;
  fecha_hasta: string;
  publicado_at: string | null;
};

export default function ReportEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rep, setRep] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const { data, error } = await supabase
        .from("reportes")
        .select(
          "id, titulo, estado, resumen, kpis, recomendaciones, alertas, fecha_desde, fecha_hasta, publicado_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Reporte no encontrado");
        navigate("/admin/reports");
      } else {
        setRep(data as unknown as Reporte);
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  if (loading || !rep) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const update = (patch: Partial<Reporte>) => setRep((r) => (r ? { ...r, ...patch } : r));

  const save = async (publish = false) => {
    if (publish) setPublishing(true); else setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        titulo: rep.titulo,
        resumen: rep.resumen,
        kpis: rep.kpis,
        recomendaciones: rep.recomendaciones,
        alertas: rep.alertas,
      };
      if (publish) {
        payload.estado = "publicado";
        payload.publicado_at = new Date().toISOString();
        payload.publicado_por = user?.id ?? null;
      }
      const { error } = await supabase.from("reportes").update(payload).eq("id", rep.id);
      if (error) throw error;
      toast.success(publish ? "Reporte publicado" : "Cambios guardados");
      if (publish) {
        update({ estado: "publicado", publicado_at: new Date().toISOString() });
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/reports"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <h2 className="text-2xl font-bold text-foreground">Editar reporte</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Datos crudos editables. Solo se mostrarán al cliente al publicar.
          </p>
        </div>
        <Badge variant={rep.estado === "publicado" ? "default" : "outline"}>{rep.estado}</Badge>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            value={rep.titulo ?? ""}
            onChange={(e) => update({ titulo: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Resumen</Label>
          <Textarea
            rows={6}
            value={rep.resumen ?? ""}
            onChange={(e) => update({ resumen: e.target.value })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">KPIs</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({ kpis: [...(rep.kpis ?? []), { label: "", value: "" }] })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Añadir
          </Button>
        </div>
        <div className="space-y-2">
          {(rep.kpis ?? []).map((k, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Etiqueta"
                value={k.label}
                onChange={(e) => {
                  const next = [...rep.kpis];
                  next[i] = { ...next[i], label: e.target.value };
                  update({ kpis: next });
                }}
              />
              <Input
                placeholder="Valor"
                value={k.value}
                onChange={(e) => {
                  const next = [...rep.kpis];
                  next[i] = { ...next[i], value: e.target.value };
                  update({ kpis: next });
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => update({ kpis: rep.kpis.filter((_, x) => x !== i) })}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Alertas</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                alertas: [
                  ...(rep.alertas ?? []),
                  { titulo: "", detalle: "", severidad: "media" },
                ],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Añadir
          </Button>
        </div>
        <div className="space-y-3">
          {(rep.alertas ?? []).map((a, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Título"
                  value={a.titulo}
                  onChange={(e) => {
                    const next = [...rep.alertas];
                    next[i] = { ...next[i], titulo: e.target.value };
                    update({ alertas: next });
                  }}
                />
                <Select
                  value={a.severidad}
                  onValueChange={(v) => {
                    const next = [...rep.alertas];
                    next[i] = { ...next[i], severidad: v };
                    update({ alertas: next });
                  }}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => update({ alertas: rep.alertas.filter((_, x) => x !== i) })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                rows={2}
                placeholder="Detalle"
                value={a.detalle}
                onChange={(e) => {
                  const next = [...rep.alertas];
                  next[i] = { ...next[i], detalle: e.target.value };
                  update({ alertas: next });
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Recomendaciones</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                recomendaciones: [
                  ...(rep.recomendaciones ?? []),
                  { titulo: "", detalle: "", prioridad: "media" },
                ],
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Añadir
          </Button>
        </div>
        <div className="space-y-3">
          {(rep.recomendaciones ?? []).map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Título"
                  value={r.titulo}
                  onChange={(e) => {
                    const next = [...rep.recomendaciones];
                    next[i] = { ...next[i], titulo: e.target.value };
                    update({ recomendaciones: next });
                  }}
                />
                <Select
                  value={r.prioridad}
                  onValueChange={(v) => {
                    const next = [...rep.recomendaciones];
                    next[i] = { ...next[i], prioridad: v };
                    update({ recomendaciones: next });
                  }}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    update({ recomendaciones: rep.recomendaciones.filter((_, x) => x !== i) })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                rows={2}
                placeholder="Detalle"
                value={r.detalle}
                onChange={(e) => {
                  const next = [...rep.recomendaciones];
                  next[i] = { ...next[i], detalle: e.target.value };
                  update({ recomendaciones: next });
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex justify-end gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
        <Button variant="outline" onClick={() => void save(false)} disabled={saving || publishing}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar borrador
        </Button>
        <Button onClick={() => void save(true)} disabled={saving || publishing}>
          {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {rep.estado === "publicado" ? "Re-publicar" : "Publicar al cliente"}
        </Button>
      </div>
    </div>
  );
}