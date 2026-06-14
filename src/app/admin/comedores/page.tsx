import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Store, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Comedor = {
  id: string;
  nombre: string;
  empresa_cliente: string;
  slug: string;
  activo: boolean;
  created_at: string;
};

type FormState = {
  nombre: string;
  empresa_cliente: string;
  slug: string;
  activo: boolean;
};

const emptyForm: FormState = {
  nombre: "",
  empresa_cliente: "",
  slug: "",
  activo: true,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function ComedoresPage() {
  const [loading, setLoading] = useState(true);
  const [comedores, setComedores] = useState<Comedor[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Comedor | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<Comedor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("comedores_admin")
      .select("id, nombre, empresa_cliente, slug, activo, created_at")
      .order("nombre");
    if (error) {
      toast.error("Error cargando comedores");
      setLoading(false);
      return;
    }
    const lista = (data ?? []) as Comedor[];
    setComedores(lista);

    // contadores de encuestas por comedor
    const ids = lista.map((c) => c.id);
    if (ids.length) {
      const { data: encs } = await supabase
        .from("encuestas")
        .select("comedor_id")
        .in("comedor_id", ids);
      const map: Record<string, number> = {};
      (encs ?? []).forEach((e: { comedor_id: string }) => {
        map[e.comedor_id] = (map[e.comedor_id] ?? 0) + 1;
      });
      setCounts(map);
    } else {
      setCounts({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setModalOpen(true);
  };

  const openEdit = (c: Comedor) => {
    setEditing(c);
    setForm({
      nombre: c.nombre,
      empresa_cliente: c.empresa_cliente,
      slug: c.slug,
      activo: c.activo,
    });
    setSlugTouched(true);
    setModalOpen(true);
  };

  const onNombreChange = (v: string) => {
    setForm((f) => ({
      ...f,
      nombre: v,
      slug: slugTouched ? f.slug : slugify(v),
    }));
  };

  const handleSave = async () => {
    const nombre = form.nombre.trim();
    const empresa = form.empresa_cliente.trim();
    const slug = form.slug.trim();
    if (!nombre) return toast.error("El nombre es obligatorio");
    if (!empresa) return toast.error("La empresa cliente es obligatoria");
    if (!SLUG_RE.test(slug))
      return toast.error("Slug inválido. Usa minúsculas, números y guiones.");

    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("comedores")
        .update({ nombre, empresa_cliente: empresa, slug, activo: form.activo })
        .eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error(
          error.code === "23505" ? "Ese slug ya está en uso" : "Error al guardar"
        );
        return;
      }
      toast.success("Comedor actualizado");
    } else {
      const { error } = await supabase.from("comedores").insert({
        nombre,
        empresa_cliente: empresa,
        slug,
        activo: form.activo,
      });
      setSaving(false);
      if (error) {
        toast.error(
          error.code === "23505" ? "Ese slug ya está en uso" : "Error al crear"
        );
        return;
      }
      toast.success("Comedor creado");
    }
    setModalOpen(false);
    void load();
  };

  const toggleActivo = async (c: Comedor, value: boolean) => {
    setComedores((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, activo: value } : x))
    );
    const { error } = await supabase
      .from("comedores")
      .update({ activo: value })
      .eq("id", c.id);
    if (error) {
      toast.error("Error al actualizar");
      setComedores((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, activo: !value } : x))
      );
    } else {
      toast.success(value ? "Comedor activado" : "Comedor desactivado");
    }
  };


  const handleDelete = async () => {
    if (!toDelete) return;
    const n = counts[toDelete.id] ?? 0;
    if (n > 0) {
      toast.error(
        `No se puede borrar: tiene ${n} encuesta(s). Desactívalo en su lugar.`
      );
      setToDelete(null);
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("comedores")
      .delete()
      .eq("id", toDelete.id);
    setDeleting(false);
    if (error) {
      toast.error("Error al borrar");
    } else {
      toast.success("Comedor borrado");
      void load();
    }
    setToDelete(null);
  };

  const slugPreview = useMemo(
    () => (form.slug ? `${window.location.origin}/survey/${form.slug}` : ""),
    [form.slug]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los comedores y su URL de kiosko pública.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo comedor
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : comedores.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Store className="h-12 w-12 text-muted-foreground" />
            <p className="text-base font-medium text-foreground">
              Aún no hay comedores
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea el primer comedor para empezar a recibir respuestas en su pantalla.
            </p>
            <Button onClick={openCreate} className="mt-2">
              <Plus className="mr-2 h-4 w-4" /> Crear primer comedor
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Empresa cliente</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-28">Encuestas</TableHead>
                <TableHead className="w-24">Activo</TableHead>
                <TableHead className="w-48 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comedores.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-foreground">
                    {c.nombre}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.empresa_cliente}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {c.slug}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{counts[c.id] ?? 0}</TableCell>
                  <TableCell>
                    <Switch
                      checked={c.activo}
                      onCheckedChange={(v) => void toggleActivo(c, v)}
                      aria-label="Activar comedor"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Editar"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Borrar"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setToDelete(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar comedor" : "Nuevo comedor"}
            </DialogTitle>
            <DialogDescription>
              Configura el comedor y su URL pública de kiosko.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => onNombreChange(e.target.value)}
                placeholder="Comedor Central"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa cliente</Label>
              <Input
                id="empresa"
                value={form.empresa_cliente}
                onChange={(e) =>
                  setForm((f) => ({ ...f, empresa_cliente: e.target.value }))
                }
                placeholder="Acme S.A."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL del kiosko)</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                }}
                placeholder="comedor-central"
                className="font-mono"
              />
              {slugPreview && (
                <p className="truncate text-xs text-muted-foreground">
                  {slugPreview}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Activo</p>
                <p className="text-xs text-muted-foreground">
                  Si está apagado, la URL del kiosko no muestra la encuesta.
                </p>
              </div>
              <Switch
                checked={form.activo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, activo: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este comedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si el comedor tiene encuestas
              registradas, deberás desactivarlo en lugar de borrarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
