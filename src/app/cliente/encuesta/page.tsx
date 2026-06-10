import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ClipboardList, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/admin/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Comedor = { id: string; slug: string; nombre: string };

export default function ClienteEncuestaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [comedores, setComedores] = useState<Comedor[]>([]);
  const [pinSet, setPinSet] = useState<boolean>(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data, error }, pinRes] = await Promise.all([
      supabase
        .from("usuario_comedores")
        .select("comedor_id, comedores(id, slug, nombre, activo)")
        .eq("usuario_id", user.id),
      supabase.rpc("my_kiosk_pin_set"),
    ]);
    if (error) toast.error("No pudimos cargar tus comedores");
    const list = (data ?? [])
      .map((r: { comedores: { id: string; slug: string; nombre: string; activo: boolean } | null }) => r.comedores)
      .filter((c): c is Comedor & { activo: boolean } => !!c && c.activo)
      .map((c) => ({ id: c.id, slug: c.slug, nombre: c.nombre }));
    setComedores(list);
    setPinSet(Boolean(pinRes.data));
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openPinDialog = () => {
    setPinValue("");
    setPinDialogOpen(true);
  };

  const savePin = async () => {
    if (!/^\d{4}$/.test(pinValue)) {
      toast.error("El PIN debe tener 4 dígitos");
      return;
    }
    setSavingPin(true);
    const { error } = await supabase.rpc("set_my_kiosk_pin", { _pin: pinValue });
    setSavingPin(false);
    if (error) {
      toast.error("No pudimos guardar el PIN");
      return;
    }
    toast.success("PIN guardado");
    setPinSet(true);
    setPinDialogOpen(false);
  };

  const goToSurvey = (slug: string) => {
    if (!pinSet) {
      toast.error("Primero configura tu PIN de salida del kiosko");
      openPinDialog();
      return;
    }
    navigate(`/survey/${slug}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Encuesta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configura tu PIN y abre la encuesta del comedor correspondiente.
          </p>
        </div>
        <Button
          variant={pinSet ? "outline" : "default"}
          onClick={openPinDialog}
          className="gap-2"
        >
          {pinSet ? <CheckCircle2 className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
          {pinSet ? "Cambiar PIN" : "Configurar PIN"}
        </Button>
      </div>

      {!pinSet && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
          Aún no has configurado tu PIN de 4 dígitos. Es obligatorio para abrir cualquier encuesta:
          los comensales no podrán salir del modo kiosko sin él.
        </div>
      )}

      {comedores.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-base font-medium">No tienes comedores asignados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Contacta al administrador para que te asigne uno.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {comedores.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => goToSurvey(c.slug)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-brand/40 hover:bg-foreground/5 disabled:opacity-60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground">/{c.slug}</p>
                </div>
                <Button size="sm" variant="ghost">Abrir</Button>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pinSet ? "Cambiar PIN del kiosko" : "Configura tu PIN del kiosko"}</DialogTitle>
            <DialogDescription>
              Este PIN de 4 dígitos te permitirá salir del modo encuesta cuando estés en el comedor.
              Guárdalo en un lugar seguro.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            <InputOTP
              maxLength={4}
              value={pinValue}
              onChange={(v) => setPinValue(v.replace(/\D/g, ""))}
              pattern="^\d*$"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-14 w-14 text-2xl" />
                <InputOTPSlot index={1} className="h-14 w-14 text-2xl" />
                <InputOTPSlot index={2} className="h-14 w-14 text-2xl" />
                <InputOTPSlot index={3} className="h-14 w-14 text-2xl" />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)} disabled={savingPin}>
              Cancelar
            </Button>
            <Button onClick={savePin} disabled={savingPin || pinValue.length !== 4}>
              {savingPin ? "Guardando..." : "Guardar PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}