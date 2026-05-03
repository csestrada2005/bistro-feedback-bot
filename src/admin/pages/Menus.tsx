import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, Pencil, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Menu = {
  id: string;
  date: string;
  main_dish: string;
  side_dish: string | null;
  notes: string | null;
};

const ymdLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Menus() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Menu> & { date: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_menus")
      .select("id, date, main_dish, side_dish, notes")
      .order("date", { ascending: false })
      .limit(120);
    if (error) {
      toast.error("No pudimos cargar los menús");
      setLoading(false);
      return;
    }
    setMenus((data as Menu[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, Menu>();
    for (const x of menus) m.set(x.date, x);
    return m;
  }, [menus]);

  const today = ymdLocal(new Date());
  const hasToday = byDate.has(today);

  const openForDate = (dateStr: string) => {
    const existing = byDate.get(dateStr);
    setEditing(
      existing ?? { date: dateStr, main_dish: "", side_dish: "", notes: "" }
    );
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.main_dish?.trim()) {
      toast.error("El plato fuerte es obligatorio");
      return;
    }
    setSaving(true);
    const payload = {
      date: editing.date,
      main_dish: editing.main_dish.trim(),
      side_dish: editing.side_dish?.trim() || null,
      notes: editing.notes?.trim() || null,
    };
    const { data: userData } = await supabase.auth.getUser();
    const created_by = userData.user?.id ?? null;

    const { error } = editing.id
      ? await supabase.from("daily_menus").update(payload).eq("id", editing.id)
      : await supabase.from("daily_menus").insert({ ...payload, created_by });
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar el menú");
      return;
    }
    toast.success("Menú guardado");
    setEditing(null);
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Menús del día</h2>
          <p className="text-sm text-muted-foreground">
            Cada respuesta de la encuesta se asocia automáticamente al menú del día servido.
          </p>
        </div>
        <Button
          onClick={() => openForDate(today)}
          className="gap-1.5"
          variant={hasToday ? "outline" : "default"}
        >
          <Plus className="h-4 w-4" />
          {hasToday ? "Editar menú de hoy" : "Agregar menú de hoy"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <Calendar
            mode="single"
            selected={undefined}
            onSelect={(d) => d && openForDate(ymdLocal(d))}
            locale={es}
            modifiers={{ hasMenu: menus.map((m) => new Date(m.date + "T12:00")) }}
            modifiersClassNames={{
              hasMenu: "bg-brand/15 text-brand font-semibold",
            }}
            className={cn("p-3 pointer-events-auto")}
          />
          <p className="mt-2 px-2 text-xs text-muted-foreground">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand" /> días con menú registrado
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : menus.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Aún no hay menús registrados. Empieza con el de hoy.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {menus.map((m) => (
                <li key={m.id} className="flex items-start gap-4 p-4">
                  <div className="flex w-20 flex-col items-center rounded-lg border border-border bg-muted/30 px-2 py-2 text-center">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="mt-1 text-xs uppercase text-muted-foreground">
                      {format(new Date(m.date + "T12:00"), "MMM", { locale: es })}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {format(new Date(m.date + "T12:00"), "dd")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{m.main_dish}</p>
                    {m.side_dish && (
                      <p className="text-sm text-muted-foreground">+ {m.side_dish}</p>
                    )}
                    {m.notes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">{m.notes}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Editar menú" : "Agregar menú"}
            </DialogTitle>
            <DialogDescription>
              Las respuestas del kiosko de este día se asociarán a este menú.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 font-normal"
                    disabled={!!editing?.id}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {editing?.date
                      ? format(new Date(editing.date + "T12:00"), "EEEE dd 'de' MMMM yyyy", { locale: es })
                      : "Selecciona una fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={editing?.date ? new Date(editing.date + "T12:00") : undefined}
                    onSelect={(d) =>
                      d && setEditing((prev) => prev && { ...prev, date: ymdLocal(d) })
                    }
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="main">Plato fuerte *</Label>
              <Input
                id="main"
                value={editing?.main_dish ?? ""}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, main_dish: e.target.value })
                }
                placeholder="Ej. Pollo en mole"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="side">Guarnición</Label>
              <Input
                id="side"
                value={editing?.side_dish ?? ""}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, side_dish: e.target.value })
                }
                placeholder="Ej. Arroz rojo y frijoles"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={editing?.notes ?? ""}
                onChange={(e) =>
                  setEditing((prev) => prev && { ...prev, notes: e.target.value })
                }
                placeholder="Cambios, ingredientes nuevos, observaciones…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              <X className="mr-1.5 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
