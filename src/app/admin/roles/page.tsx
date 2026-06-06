import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Shield, Store, Trash2, UserCog, ChevronsUpDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { useAuth } from "@/admin/auth/AuthProvider";

type Rol = "admin" | "cliente";

type UsuarioRow = {
  user_id: string;
  email: string;
  nombre: string;
  rol: Rol;
  comedor_ids: string[];
  created_at: string;
};

type Comedor = { id: string; nombre: string };

const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  cliente: "Cliente",
};

const ROL_BADGE: Record<Rol, string> = {
  admin: "bg-brand/10 text-brand",
  cliente: "bg-emerald-100 text-emerald-800",
};

type FormState = {
  email: string;
  password: string;
  nombre: string;
  rol: Rol;
  comedor_ids: string[];
};

const emptyForm: FormState = {
  email: "",
  password: "",
  nombre: "",
  rol: "cliente",
  comedor_ids: [],
};

export default function RolesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [comedores, setComedores] = useState<Comedor[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<UsuarioRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: cData }] = await Promise.all([
      supabase.functions.invoke("admin-users", { body: { action: "list" } }),
      supabase.from("comedores").select("id, nombre").order("nombre"),
    ]);
    if (error) {
      toast.error("No pudimos cargar los usuarios");
    } else {
      setUsuarios((data?.users ?? []) as UsuarioRow[]);
    }
    setComedores((cData ?? []) as Comedor[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const comedorById = useMemo(
    () => new Map(comedores.map((c) => [c.id, c.nombre])),
    [comedores],
  );

  const openCreate = () => {
    setForm({ ...emptyForm, comedor_ids: [] });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    if (!form.email.trim() || form.password.length < 8) {
      toast.error("Email válido y contraseña de 8+ caracteres requeridos");
      return;
    }
    if (form.rol === "cliente" && form.comedor_ids.length === 0) {
      toast.error("Asigna al menos un comedor al cliente");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "invite",
        email: form.email.trim(),
        password: form.password,
        nombre: form.nombre.trim() || form.email.split("@")[0],
        role: form.rol,
        comedor_ids: form.rol === "admin" ? [] : form.comedor_ids,
      },
    });
    setSaving(false);
    if (error || data?.error) {
      const msg = data?.error || error?.message || "No se pudo crear el usuario";
      toast.error(typeof msg === "string" ? msg : "Error al crear");
      return;
    }
    toast.success("Usuario creado");
    setModalOpen(false);
    void load();
  };

  const updateRow = async (
    u: UsuarioRow,
    patch: { role?: Rol; comedor_ids?: string[] },
  ) => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "update", user_id: u.user_id, ...patch },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Error al actualizar");
      return;
    }
    toast.success("Usuario actualizado");
    void load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "remove", user_id: confirmDelete.user_id },
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Error al eliminar");
    } else {
      toast.success("Usuario eliminado");
      void load();
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles y accesos</h1>
          <p className="text-sm text-muted-foreground">
            Crea cuentas de cliente para que vean los reportes publicados de su comedor.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <UserCog className="h-12 w-12 text-muted-foreground" />
            <p className="text-base font-medium">No hay usuarios todavía</p>
            <Button onClick={openCreate} className="mt-2">
              <Plus className="mr-2 h-4 w-4" /> Crear primer usuario
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Correo</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-40">Rol</TableHead>
                <TableHead className="w-56">Comedor asignado</TableHead>
                <TableHead className="w-20 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => {
                const isSelf = user?.id === u.user_id;
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">
                      {u.email}
                      {isSelf && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          tú
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.nombre || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.rol}
                        disabled={isSelf}
                        onValueChange={(v) =>
                          updateRow(u, {
                            role: v as Rol,
                            comedor_ids: v === "admin" ? [] : u.comedor_ids,
                          })
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.rol === "admin" ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Shield className="h-3.5 w-3.5" /> Todos
                        </span>
                      ) : (
                        <ComedorMultiSelect
                          selected={u.comedor_ids}
                          comedores={comedores}
                          onChange={(ids) => updateRow(u, { comedor_ids: ids })}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf}
                        onClick={() => setConfirmDelete(u)}
                        aria-label="Eliminar usuario"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="mb-1 flex items-center gap-2 font-semibold text-foreground">
          <Store className="h-4 w-4" /> ¿Qué ve cada rol?
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><b>Administrador</b>: acceso total al panel admin.</li>
          <li><b>Cliente</b>: entra al panel de cliente y solo ve los reportes ya publicados.</li>
        </ul>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Crea una cuenta con correo y contraseña. Se confirma automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="r-email">Correo</Label>
              <Input
                id="r-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="cliente@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-nombre">Nombre (opcional)</Label>
              <Input
                id="r-nombre"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Recursos Humanos S&P"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-pwd">Contraseña inicial</Label>
              <Input
                id="r-pwd"
                type="text"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="mínimo 8 caracteres"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={form.rol}
                  onValueChange={(v) => setForm((f) => ({ ...f, rol: v as Rol }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Comedores</Label>
                <ComedorMultiSelect
                  selected={form.comedor_ids}
                  comedores={comedores}
                  disabled={form.rol === "admin"}
                  onChange={(ids) => setForm((f) => ({ ...f, comedor_ids: ids }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={`inline-block rounded px-1.5 py-0.5 ${ROL_BADGE[form.rol]}`}>
                {ROL_LABEL[form.rol]}
              </span>{" "}
              {form.rol === "cliente" &&
                "verá solo los reportes publicados de los comedores asignados (sin límite)."}
              {form.rol === "admin" && "tendrá acceso total al panel admin."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la cuenta y perderá el acceso inmediatamente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ComedorMultiSelect({
  selected,
  comedores,
  onChange,
  disabled,
}: {
  selected: string[];
  comedores: Comedor[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const map = new Map(comedores.map((c) => [c.id, c.nombre]));
  const label =
    selected.length === 0
      ? "Selecciona comedores"
      : selected.length === comedores.length
      ? `Todos (${comedores.length})`
      : selected.length === 1
      ? map.get(selected[0]) ?? "1 comedor"
      : `${selected.length} comedores`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-9 w-full justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => onChange(comedores.map((c) => c.id))}
          >
            Todos
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:underline"
            onClick={() => onChange([])}
          >
            Ninguno
          </button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto p-2">
          {comedores.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No hay comedores.</p>
          )}
          {comedores.map((c) => {
            const checked = selected.includes(c.id);
            return (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    onChange(
                      v
                        ? [...selected, c.id]
                        : selected.filter((id) => id !== c.id),
                    )
                  }
                />
                <span className="flex-1 truncate">{c.nombre}</span>
                {checked && <Check className="h-3.5 w-3.5 text-brand" />}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}