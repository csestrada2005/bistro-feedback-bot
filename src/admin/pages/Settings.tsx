import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Upload, Download, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/admin/auth/AuthProvider";
import { cn } from "@/lib/utils";

type ServiceRange = { label: string; start_h: number; start_m: number; end_h: number; end_m: number };

type Settings = {
  service_hours: ServiceRange[];
  cooldown_hours: number;
  min_response_ms: number;
  quorum: number;
  alert_drop_pct: number;
  alert_menu_score: number;
  alert_pending_comments: number;
  alert_emails: string[];
  pdf_company_name: string;
  pdf_color: string;
  pdf_logo_url: string;
};

const DEFAULTS: Settings = {
  service_hours: [{ label: "Comida", start_h: 12, start_m: 0, end_h: 15, end_m: 0 }],
  cooldown_hours: 4,
  min_response_ms: 3000,
  quorum: 20,
  alert_drop_pct: 15,
  alert_menu_score: 2.5,
  alert_pending_comments: 10,
  alert_emails: [],
  pdf_company_name: "",
  pdf_color: "#0f172a",
  pdf_logo_url: "",
};

export default function Settings() {
  const { user } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (data) setS({ ...DEFAULTS, ...(data as any) });
      else setS(DEFAULTS);
    })();
  }, []);

  async function save(patch: Partial<Settings>) {
    if (!s) return;
    const next = { ...s, ...patch };
    setS(next);
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configuración guardada");
  }

  if (!s) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saving && (
        <p className="text-xs text-muted-foreground">Guardando…</p>
      )}
      <Tabs defaultValue="hours">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="hours">Horarios</TabsTrigger>
          <TabsTrigger value="fraud">Anti-fraude</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="export">Exportación</TabsTrigger>
          <TabsTrigger value="branding">Branding PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="mt-4">
          <ServiceHoursPanel value={s.service_hours} onChange={(v) => save({ service_hours: v })} />
        </TabsContent>

        <TabsContent value="fraud" className="mt-4">
          <Card title="Anti-fraude" description="Reglas para evitar respuestas fraudulentas o robóticas.">
            <NumberRow
              label="Cooldown por dispositivo"
              suffix="horas"
              min={1}
              max={24}
              value={s.cooldown_hours}
              onSave={(v) => save({ cooldown_hours: v })}
            />
            <NumberRow
              label="Tiempo mínimo de respuesta"
              suffix="ms"
              min={500}
              max={60000}
              step={100}
              value={s.min_response_ms}
              onSave={(v) => save({ min_response_ms: v })}
            />
            <NumberRow
              label="Quorum mínimo para mostrar stats diarios"
              suffix="respuestas"
              min={1}
              max={500}
              value={s.quorum}
              onSave={(v) => save({ quorum: v })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card title="Alertas automáticas" description="Reglas y destinatarios para notificaciones.">
            <NumberRow
              label="Alerta si el sabor cae más de"
              suffix="% vs promedio 7 días"
              min={1}
              max={100}
              value={s.alert_drop_pct}
              onSave={(v) => save({ alert_drop_pct: v })}
            />
            <NumberRow
              label="Alerta si un menú obtiene menos de"
              suffix="/ 5"
              min={1}
              max={5}
              step={0.1}
              value={s.alert_menu_score}
              onSave={(v) => save({ alert_menu_score: v })}
            />
            <NumberRow
              label="Alerta si comentarios pendientes superan"
              suffix="comentarios"
              min={1}
              max={500}
              value={s.alert_pending_comments}
              onSave={(v) => save({ alert_pending_comments: v })}
            />
            <EmailListField
              value={s.alert_emails}
              onChange={(v) => save({ alert_emails: v })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UsersPanel currentUserId={user?.id ?? ""} />
        </TabsContent>

        <TabsContent value="export" className="mt-4">
          <ExportPanel />
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <BrandingPanel
            value={{
              pdf_company_name: s.pdf_company_name,
              pdf_color: s.pdf_color,
              pdf_logo_url: s.pdf_logo_url,
            }}
            onSave={save}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="divide-y">{children}</div>
    </section>
  );
}

function NumberRow({
  label,
  suffix,
  value,
  min,
  max,
  step = 1,
  onSave,
}: {
  label: string;
  suffix?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onSave: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="w-28"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const n = Number(v);
            if (!Number.isFinite(n) || n < min || n > max) {
              toast.error(`Valor fuera de rango (${min}–${max})`);
              return;
            }
            onSave(n);
          }}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}

function ServiceHoursPanel({ value, onChange }: { value: ServiceRange[]; onChange: (v: ServiceRange[]) => void }) {
  const [draft, setDraft] = useState<ServiceRange[]>(value);
  useEffect(() => setDraft(value), [value]);

  const addRange = () =>
    setDraft((d) => [...d, { label: "Nuevo", start_h: 8, start_m: 0, end_h: 10, end_m: 0 }]);

  const updateRange = (i: number, patch: Partial<ServiceRange>) =>
    setDraft((d) => d.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const removeRange = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));

  return (
    <Card title="Horarios de servicio" description="Define cuándo el kiosko acepta encuestas. Acepta múltiples ventanas (ej. desayuno + comida).">
      <div className="space-y-3 p-5">
        {draft.map((r, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
            <Input
              value={r.label}
              onChange={(e) => updateRange(i, { label: e.target.value })}
              placeholder="Etiqueta"
            />
            <TimeInput
              h={r.start_h}
              m={r.start_m}
              onChange={(h, m) => updateRange(i, { start_h: h, start_m: m })}
              label="Inicio"
            />
            <span className="self-center text-muted-foreground">→</span>
            <TimeInput
              h={r.end_h}
              m={r.end_m}
              onChange={(h, m) => updateRange(i, { end_h: h, end_m: m })}
              label="Fin"
            />
            <Button variant="ghost" size="icon" onClick={() => removeRange(i)} aria-label="Eliminar">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={addRange}>
            <Plus className="mr-2 h-4 w-4" /> Añadir ventana
          </Button>
          <Button onClick={() => onChange(draft)}>Guardar horarios</Button>
        </div>
      </div>
    </Card>
  );
}

function TimeInput({
  h,
  m,
  onChange,
  label,
}: {
  h: number;
  m: number;
  onChange: (h: number, m: number) => void;
  label: string;
}) {
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-1">
      <span className="sr-only">{label}</span>
      <Input
        type="time"
        value={value}
        onChange={(e) => {
          const [hh, mm] = e.target.value.split(":").map(Number);
          if (!Number.isNaN(hh) && !Number.isNaN(mm)) onChange(hh, mm);
        }}
        className="w-32"
      />
    </div>
  );
}

function EmailListField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  return (
    <div className="space-y-3 p-5">
      <Label>Emails para alertas</Label>
      <div className="flex flex-wrap gap-2">
        {value.length === 0 && (
          <p className="text-xs text-muted-foreground">Aún no hay destinatarios.</p>
        )}
        {value.map((e) => (
          <span
            key={e}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-3 py-1 text-xs"
          >
            {e}
            <button
              onClick={() => onChange(value.filter((x) => x !== e))}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Quitar ${e}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="alguien@empresa.com"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => {
            const e = input.trim().toLowerCase();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
              toast.error("Email inválido");
              return;
            }
            if (value.includes(e)) {
              setInput("");
              return;
            }
            onChange([...value, e]);
            setInput("");
          }}
        >
          Añadir
        </Button>
      </div>
    </div>
  );
}

/* -------------------- USERS -------------------- */

type UserRow = { user_id: string; email: string; role: string; created_at: string };

function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list" },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Error");
      setRows([]);
      return;
    }
    setRows((data as any).users);
  };
  useEffect(() => {
    void load();
  }, []);

  const remove = async (user_id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "remove", user_id },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Error");
      return;
    }
    toast.success("Usuario eliminado");
    await load();
  };

  return (
    <Card title="Usuarios y roles" description="Administra quién puede acceder al panel.">
      <div className="flex justify-end p-5 pb-0">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" /> Invitar usuario
            </Button>
          </DialogTrigger>
          <InviteDialog
            onCreated={async () => {
              setOpen(false);
              await load();
            }}
          />
        </Dialog>
      </div>
      <div className="p-5">
        {!rows ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin usuarios.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Email</th>
                <th className="py-2 text-left font-medium">Rol</th>
                <th className="py-2 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.user_id}-${r.role}`} className="border-b last:border-none">
                  <td className="py-2">{r.email}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.role}</span>
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || r.user_id === currentUserId}
                      onClick={() => remove(r.user_id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function InviteDialog({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"cafeteria_admin" | "hr_viewer">("hr_viewer");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "invite", email, password, role },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Error");
      return;
    }
    toast.success("Usuario creado");
    setEmail("");
    setPassword("");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invitar usuario</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Contraseña inicial (mín. 8)</Label>
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cafeteria_admin">cafeteria_admin (operador)</SelectItem>
              <SelectItem value="hr_viewer">hr_viewer (RH lectura)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy || !email || password.length < 8}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Crear usuario
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* -------------------- EXPORT -------------------- */

function ExportPanel() {
  const [from, setFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [to, setTo] = useState<Date>(new Date());
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("surveys")
        .select(
          "created_at, question_1_score, question_2_score, question_3_trend, question_4_recommend, comment, comment_status, is_flagged, daily_menu_id, response_time_ms"
        )
        .gte("created_at", `${format(from, "yyyy-MM-dd")}T00:00:00.000Z`)
        .lte("created_at", `${format(to, "yyyy-MM-dd")}T23:59:59.999Z`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const headers = [
        "fecha",
        "sabor_q1",
        "limpieza_q2",
        "tendencia_q3",
        "recomienda_q4",
        "comentario",
        "estado_comentario",
        "marcado_sospechoso",
        "menu_id",
        "tiempo_respuesta_ms",
      ];
      const csv = [headers.join(",")]
        .concat(
          rows.map((r: any) =>
            [
              r.created_at,
              r.question_1_score,
              r.question_2_score,
              r.question_3_trend,
              r.question_4_recommend,
              csvEscape(r.comment ?? ""),
              r.comment_status,
              r.is_flagged,
              r.daily_menu_id ?? "",
              r.response_time_ms,
            ].join(",")
          )
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `encuestas_${format(from, "yyyyMMdd")}_${format(to, "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${rows.length} respuestas exportadas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Exportación de datos"
      description="Descarga las respuestas en CSV. Las huellas de dispositivo se omiten por privacidad."
    >
      <div className="grid gap-4 p-5 md:grid-cols-3">
        <div className="space-y-1">
          <Label>Desde</Label>
          <DateBtn date={from} onChange={(d) => d && setFrom(d)} />
        </div>
        <div className="space-y-1">
          <Label>Hasta</Label>
          <DateBtn date={to} onChange={(d) => d && setTo(d)} />
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Descargar CSV
          </Button>
        </div>
      </div>
    </Card>
  );
}

function csvEscape(v: string) {
  if (v == null) return "";
  const s = String(v).replace(/\r?\n/g, " ");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function DateBtn({ date, onChange }: { date: Date; onChange: (d?: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
          {format(date, "PPP")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
      </PopoverContent>
    </Popover>
  );
}

/* -------------------- BRANDING -------------------- */

function BrandingPanel({
  value,
  onSave,
}: {
  value: { pdf_company_name: string; pdf_color: string; pdf_logo_url: string };
  onSave: (patch: Partial<Settings>) => void;
}) {
  const [name, setName] = useState(value.pdf_company_name);
  const [color, setColor] = useState(value.pdf_color || "#0f172a");
  const [logo, setLogo] = useState(value.pdf_logo_url);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setName(value.pdf_company_name);
    setColor(value.pdf_color || "#0f172a");
    setLogo(value.pdf_logo_url);
  }, [value]);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    setUploading(true);
    const path = `logo-${Date.now()}.${file.name.split(".").pop() ?? "png"}`;
    const { error } = await supabase.storage.from("pdf-branding").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("pdf-branding").getPublicUrl(path);
    setLogo(data.publicUrl);
    setUploading(false);
    toast.success("Logo subido. No olvides guardar.");
  };

  return (
    <Card title="Branding del PDF" description="Datos de marca para los reportes generados.">
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nombre de la empresa</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label>Color principal</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border"
            />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-32" />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Logotipo</Label>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded border bg-muted/40">
              {logo ? (
                <img src={logo} alt="logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">Sin logo</span>
              )}
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
              <span className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
                <Upload className="mr-2 h-4 w-4" /> {uploading ? "Subiendo…" : "Subir imagen"}
              </span>
            </label>
            {logo && (
              <Button variant="ghost" size="sm" onClick={() => setLogo("")}>
                Quitar
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t p-4">
        <Button onClick={() => onSave({ pdf_company_name: name, pdf_color: color, pdf_logo_url: logo })}>
          Guardar branding
        </Button>
      </div>
    </Card>
  );
}