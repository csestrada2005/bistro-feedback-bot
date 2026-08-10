import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KioskLayout } from "@/components/survey/KioskLayout";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const DemoSwitcherDialog = lazy(() => import("@/components/survey/DemoSwitcherDialog"));

type Pregunta = {
  id: string;
  texto: string;
  tipo: "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3";
  orden: number;
};

type Comedor = { id: string; slug: string; nombre: string; escala_niveles?: number };

const SCALE_OPTIONS_4 = [
  { value: 5, label: "Excelente", emoji: "😋", classes: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700" },
  { value: 4, label: "Muy bueno", emoji: "🙂", classes: "bg-lime-500 hover:bg-lime-600 text-white border-lime-600" },
  { value: 3, label: "Bueno", emoji: "😐", classes: "bg-yellow-400 hover:bg-yellow-500 text-foreground border-yellow-500" },
  { value: 2, label: "Área de oportunidad", emoji: "💡", classes: "bg-sky-500 hover:bg-sky-600 text-white border-sky-600" },
];

// Escala de 5 niveles con estrellas (formato Soler y Palau), de mejor a peor.
const SCALE_OPTIONS_5 = [
  { value: 5, label: "Muy bueno", emoji: "★★★★★", classes: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700" },
  { value: 4, label: "Bueno", emoji: "★★★★", classes: "bg-lime-500 hover:bg-lime-600 text-white border-lime-600" },
  { value: 3, label: "Regular", emoji: "★★★", classes: "bg-yellow-400 hover:bg-yellow-500 text-foreground border-yellow-500" },
  { value: 2, label: "Malo", emoji: "★★", classes: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600" },
  { value: 1, label: "Deficiente", emoji: "★", classes: "bg-rose-600 hover:bg-rose-700 text-white border-rose-700" },
];

type AnswerMap = Record<string, { numerico?: number; booleano?: boolean; texto?: string; textos?: string[] }>;

const initial = (): AnswerMap => ({});

export default function PublicSurveyPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [comedor, setComedor] = useState<Comedor | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoTaps, setDemoTaps] = useState(0);
  const [allComedores, setAllComedores] = useState<Comedor[]>([]);
  const [pinRequired, setPinRequired] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitPin, setExitPin] = useState("");
  const [exitFails, setExitFails] = useState(0);
  const [exitLockUntil, setExitLockUntil] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const scaleOptions = comedor?.escala_niveles === 5 ? SCALE_OPTIONS_5 : SCALE_OPTIONS_4;

  useEffect(() => {
    void (async () => {
      setLoading(true);
      let comId: string | null = null;
      try {
        const { data: com, error: comErr } = await supabase
          .from("comedores")
          .select("id, slug, nombre, escala_niveles")
          .eq("slug", slug)
          .eq("activo", true)
          .maybeSingle();
        if (comErr) console.error("comedor load error", comErr);
        if (!com) return;
        setComedor(com as Comedor);
        comId = (com as Comedor).id;

        const [qsRes, pinRes] = await Promise.allSettled([
          supabase.rpc("get_next_survey_questions", { p_comedor_id: com.id }),
          supabase.rpc("comedor_has_kiosk_pin", { p_comedor_id: com.id }),
        ]);

        if (qsRes.status === "fulfilled") {
          const { data: qs, error: qErr } = qsRes.value;
          if (qErr) {
            console.error("rotation error", qErr);
            toast.error("No pudimos cargar las preguntas");
          }
          setPreguntas((qs ?? []) as Pregunta[]);
        } else {
          console.error("rotation rejected", qsRes.reason);
          toast.error("No pudimos cargar las preguntas");
          setPreguntas([]);
        }

        if (pinRes.status === "fulfilled") {
          const { data, error } = pinRes.value as { data: boolean | null; error: unknown };
          if (error) console.error("pin check error", error);
          // Solo bloquear cuando explícitamente devuelve false.
          setPinRequired(data === false);
        } else {
          console.error("pin check rejected", pinRes.reason);
          setPinRequired(false);
        }
      } catch (err) {
        console.error("survey load failed", err);
        toast.error("No pudimos abrir la encuesta");
      } finally {
        setLoading(false);
      }
      // RUM: cargar el módulo en idle para no competir con el primer render.
      if (comId) {
        const finalComId = comId;
        const sendRum = () =>
          import("@/lib/rum").then(({ trackSurveyRum }) =>
            trackSurveyRum({ slug, comedorId: finalComId })
          );
        type WinIdle = Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        };
        const w = window as WinIdle;
        if (typeof w.requestIdleCallback === "function") {
          w.requestIdleCallback(sendRum, { timeout: 2000 });
        } else {
          setTimeout(sendRum, 1200);
        }
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!demoOpen || allComedores.length > 0) return;
    void (async () => {
      const { data } = await supabase
        .from("comedores")
        .select("id, slug, nombre")
        .eq("activo", true)
        .order("nombre");
      setAllComedores((data ?? []) as Comedor[]);
    })();
  }, [demoOpen, allComedores.length]);

  useEffect(() => {
    if (demoTaps === 0) return;
    const t = setTimeout(() => setDemoTaps(0), 1800);
    return () => clearTimeout(t);
  }, [demoTaps]);

  const handleLogoTap = () => {
    const next = demoTaps + 1;
    if (next >= 5) {
      setDemoTaps(0);
      setDemoOpen(true);
    } else {
      setDemoTaps(next);
    }
  };

  const total = preguntas.length;

  const reset = async () => {
    setAnswers(initial());
    setStep(0);
    setDone(false);
    setCountdown(5);
    if (comedor) {
      const { data: qs } = await supabase.rpc("get_next_survey_questions", {
        p_comedor_id: comedor.id,
      });
      setPreguntas((qs ?? []) as Pregunta[]);
    }
  };

  useEffect(() => {
    if (!done) return;
    setCountdown(5);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          void reset();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [done]);

  if (loading) {
    return (
      <KioskLayout>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      </KioskLayout>
    );
  }

  if (!comedor) {
    return (
      <KioskLayout>
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <h1 className="text-5xl font-extrabold text-foreground">Comedor no encontrado</h1>
          <p className="mt-4 text-xl text-muted-foreground">
            El enlace no corresponde a ningún comedor activo.
          </p>
          <Link to="/" className="mt-8 text-base text-brand underline">
            Volver al inicio
          </Link>
        </div>
      </KioskLayout>
    );
  }

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const rows: {
        pregunta_id: string;
        valor_numerico: number | null;
        valor_booleano: boolean | null;
        valor_texto: string | null;
      }[] = [];

      for (const p of preguntas) {
        const a = answers[p.id];
        if (!a) continue;
        if (p.tipo === "escala_5" && a.numerico) {
          rows.push({ pregunta_id: p.id, valor_numerico: a.numerico, valor_booleano: null, valor_texto: null });
        } else if (p.tipo === "si_no" && typeof a.booleano === "boolean") {
          rows.push({ pregunta_id: p.id, valor_numerico: null, valor_booleano: a.booleano, valor_texto: a.texto?.trim() || null });
        } else if (p.tipo === "texto_abierto" && a.texto?.trim()) {
          rows.push({ pregunta_id: p.id, valor_numerico: null, valor_booleano: null, valor_texto: a.texto.trim() });
        } else if (p.tipo === "texto_multiple_3" && a.textos) {
          const joined = a.textos.map((t) => t.trim()).filter(Boolean).join(" | ");
          if (joined) {
            rows.push({ pregunta_id: p.id, valor_numerico: null, valor_booleano: null, valor_texto: joined });
          }
        }
      }

      if (rows.length === 0) {
        toast.error("Responde al menos una pregunta antes de enviar");
        return;
      }
      const { data, error } = await supabase.functions.invoke("submit-survey-v2", {
        body: { comedor_id: comedor.id, respuestas: rows },
      });
      if (error || !data?.ok) {
        console.error("submit error", error, data);
        throw new Error("submit failed");
      }
      setDone(true);
    } catch (err) {
      console.error(err);
      toast.error("No pudimos guardar la encuesta. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const isWelcome = step === 0;
  const isQuestion = step >= 1 && step <= total;
  const currentQ = isQuestion ? preguntas[step - 1] : null;

  const handleBack = () => {
    if (done) return;
    if (step > 1) setStep((s) => s - 1);
    else {
      setExitPin("");
      setExitOpen(true);
    }
  };

  const verifyExit = async () => {
    if (!comedor) return;
    if (Date.now() < exitLockUntil) {
      const secs = Math.ceil((exitLockUntil - Date.now()) / 1000);
      toast.error(`Demasiados intentos. Espera ${secs}s`);
      return;
    }
    if (!/^\d{4}$/.test(exitPin)) {
      toast.error("PIN inválido");
      return;
    }
    setVerifying(true);
    const { data, error } = await supabase.rpc("verify_kiosk_pin", {
      p_comedor_id: comedor.id,
      p_pin: exitPin,
    });
    setVerifying(false);
    if (error || !data) {
      const next = exitFails + 1;
      setExitPin("");
      if (next >= 5) {
        setExitLockUntil(Date.now() + 30_000);
        setExitFails(0);
        toast.error("Demasiados intentos. Bloqueado 30 segundos.");
      } else {
        setExitFails(next);
        toast.error(`PIN incorrecto (${next}/5)`);
      }
      return;
    }
    setExitOpen(false);
    navigate("/");
  };

  return (
    <KioskLayout>
      {pinRequired && (
        <Dialog open modal>
          <DialogContent
            className="sm:max-w-md"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>Configura un PIN primero</DialogTitle>
              <DialogDescription>
                El cliente debe configurar el PIN de salida del kiosko desde su dashboard
                antes de usar este comedor.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => navigate("/")} className="w-full">
                Volver al inicio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex items-center justify-between px-6 pt-4 sm:px-8 sm:pt-6">
        <div className="w-14">
          {step > 0 && !done && (
            <button
              onClick={handleBack}
              aria-label={step > 1 ? "Pregunta anterior" : "Salir del kiosko"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80"
            >
              {step > 1 ? <ArrowLeft className="h-7 w-7" /> : <LogOut className="h-7 w-7" />}
            </button>
          )}
        </div>
        <div className="flex-1 px-6 text-center">
          {isQuestion && (
            <>
              <p className="text-base font-semibold text-muted-foreground">
                Pregunta {step} de {total}
              </p>
              <div className="mx-auto mt-2 h-2 w-full max-w-xl overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-brand transition-all duration-300"
                  style={{ width: `${(step / total) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
        <div className="w-14" />
      </div>

      <section
        key={step}
        className="flex flex-1 animate-in fade-in duration-200 flex-col items-center justify-center px-6 pb-8 sm:px-8 sm:pb-10"
      >
        {isWelcome && !done && (
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              onClick={handleLogoTap}
              aria-label="Main Catering"
              className="mb-6 inline-flex items-center rounded-2xl bg-white p-2 select-none"
            >
              <BrandLogo className="h-24 w-auto" />
            </button>
            <h1 className="text-5xl font-extrabold leading-tight text-foreground sm:text-6xl">
              {comedor.nombre}
            </h1>
            <p className="mt-6 max-w-xl text-2xl text-muted-foreground">
              Tu opinión nos ayuda a mejorar. Solo te tomará 2 minutos.
            </p>
            <Button
              onClick={() => setStep(1)}
              className="mt-14 h-24 w-[28rem] max-w-full rounded-2xl bg-brand text-3xl font-bold text-brand-foreground shadow-xl shadow-brand/30 hover:bg-brand active:scale-95"
            >
              Empezar encuesta
            </Button>
          </div>
        )}

        {isQuestion && currentQ && (
          <div className="w-full max-w-5xl">
            <h2 className="text-center text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
              {currentQ.texto}
            </h2>

            {currentQ.tipo === "escala_5" && (
              <div
                className={cn(
                  "mt-10 grid gap-2 sm:mt-12 sm:gap-4",
                  scaleOptions.length === 5 ? "grid-cols-5" : "grid-cols-4"
                )}
              >
                {scaleOptions.map((opt) => {
                  const selected = answers[currentQ.id]?.numerico === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setAnswers((a) => ({ ...a, [currentQ.id]: { numerico: opt.value } }));
                        setTimeout(() => {
                          if (step === total) void submit();
                          else setStep((s) => s + 1);
                        }, 120);
                      }}
                      aria-label={`${opt.value} ${opt.label}`}
                      className={cn(
                        "flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center transition-transform active:scale-95 sm:min-h-[180px] sm:gap-2 sm:rounded-3xl sm:p-4",
                        opt.classes,
                        selected && "ring-4 ring-offset-2 ring-foreground/30"
                      )}
                    >
                      <span className="text-3xl sm:text-5xl">{opt.emoji}</span>
                      <span className="text-2xl font-extrabold sm:text-4xl">{opt.value}</span>
                      <span className="hidden text-sm font-bold sm:block sm:text-lg">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQ.tipo === "si_no" && (
              <>
                <div className="mt-14 grid grid-cols-2 gap-6">
                  {[true, false].map((val) => {
                    const selected = answers[currentQ.id]?.booleano === val;
                    return (
                      <button
                        key={String(val)}
                        onClick={() => {
                          setAnswers((a) => ({
                            ...a,
                            [currentQ.id]: { booleano: val, texto: val ? a[currentQ.id]?.texto ?? "" : "" },
                          }));
                          if (val) setTimeout(() => {
                            if (step === total) void submit();
                            else setStep((s) => s + 1);
                          }, 120);
                        }}
                        className={cn(
                          "flex min-h-[160px] items-center justify-center rounded-3xl border-2 text-4xl font-extrabold transition-transform active:scale-95",
                          selected
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border bg-card text-foreground hover:border-brand/40"
                        )}
                      >
                        {val ? "Sí" : "No"}
                      </button>
                    );
                  })}
                </div>
                {answers[currentQ.id]?.booleano === false && (
                  <div className="mt-10 animate-in fade-in duration-200">
                    <label className="block text-2xl font-semibold text-foreground">
                      Cuéntanos qué pasó
                    </label>
                    <Textarea
                      value={answers[currentQ.id]?.texto ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => ({
                          ...a,
                          [currentQ.id]: { ...a[currentQ.id], booleano: false, texto: e.target.value.slice(0, 500) },
                        }))
                      }
                      className="mt-3 min-h-[160px] rounded-2xl border-2 p-5 text-2xl"
                      placeholder="Describe el incidente..."
                    />
                    <Button
                      onClick={() => (step === total ? void submit() : setStep((s) => s + 1))}
                      disabled={submitting}
                      className="mt-6 h-20 w-full rounded-2xl bg-brand text-2xl font-bold text-brand-foreground hover:bg-brand active:scale-95"
                    >
                      {step === total ? "Enviar encuesta" : "Continuar"}
                    </Button>
                  </div>
                )}
              </>
            )}

            {currentQ.tipo === "texto_multiple_3" && (
              <>
                <p className="mt-3 text-center text-xl text-muted-foreground">Opcional</p>
                <div className="mt-10 space-y-4">
                  {[0, 1, 2].map((i) => {
                    const arr = answers[currentQ.id]?.textos ?? ["", "", ""];
                    return (
                      <div key={i} className="flex items-center gap-4">
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl font-extrabold text-brand">
                          {i + 1}
                        </span>
                        <Input
                          value={arr[i]}
                          onChange={(e) => {
                            const next = [...arr];
                            next[i] = e.target.value.slice(0, 140);
                            setAnswers((a) => ({ ...a, [currentQ.id]: { textos: next } }));
                          }}
                          placeholder={`Opción ${i + 1}`}
                          className="h-16 rounded-2xl border-2 px-5 text-xl"
                        />
                      </div>
                    );
                  })}
                </div>
                <Button
                  onClick={() => (step === total ? void submit() : setStep((s) => s + 1))}
                  disabled={submitting}
                  className="mt-10 h-20 w-full rounded-2xl bg-brand text-2xl font-bold text-brand-foreground hover:bg-brand active:scale-95"
                >
                  {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {step === total ? "Enviar encuesta" : "Continuar"}
                </Button>
              </>
            )}

            {currentQ.tipo === "texto_abierto" && (
              <>
                <Textarea
                  value={answers[currentQ.id]?.texto ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({
                      ...a,
                      [currentQ.id]: { texto: e.target.value.slice(0, 500) },
                    }))
                  }
                  className="mt-10 min-h-[180px] rounded-2xl border-2 p-5 text-2xl"
                  placeholder="Escribe tu respuesta..."
                />
                <Button
                  onClick={() => (step === total ? void submit() : setStep((s) => s + 1))}
                  disabled={submitting}
                  className="mt-10 h-20 w-full rounded-2xl bg-brand text-2xl font-bold text-brand-foreground hover:bg-brand active:scale-95"
                >
                  {step === total ? "Enviar encuesta" : "Continuar"}
                </Button>
              </>
            )}
          </div>
        )}

      </section>

      {isQuestion && (
        <footer className="border-t border-border py-3 text-center text-sm text-muted-foreground">
          {comedor.nombre}
        </footer>
      )}

      {demoOpen && (
        <Suspense fallback={null}>
          <DemoSwitcherDialog
            open={demoOpen}
            onOpenChange={setDemoOpen}
            currentId={comedor.id}
            comedores={allComedores}
            onSelect={(c) => {
              setDemoOpen(false);
              if (c.slug !== comedor.slug) navigate(`/survey/${c.slug}`);
            }}
          />
        </Suspense>
      )}

      {done && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand px-6 text-center text-brand-foreground animate-in fade-in duration-300">
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white/20 animate-in zoom-in-50 duration-500 sm:h-48 sm:w-48">
            <Check className="h-24 w-24 text-white sm:h-28 sm:w-28" strokeWidth={3} />
          </div>
          <h1 className="mt-10 max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
            ¡Gracias por tomarte el tiempo de responder!
          </h1>
          <p className="mt-6 max-w-2xl text-xl sm:text-2xl text-white/90">
            Apreciamos mucho tu feedback. Nos ayuda a mejorar todos los días.
          </p>
          <p className="mt-12 text-sm sm:text-base text-white/80" aria-live="polite">
            Volviendo a la encuesta en {countdown}…
          </p>
        </div>
      )}

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salir del modo encuesta</DialogTitle>
            <DialogDescription>
              Ingresa el PIN de 4 dígitos del cliente para salir del kiosko.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <InputOTP
              maxLength={4}
              value={exitPin}
              onChange={(v) => setExitPin(v.replace(/\D/g, ""))}
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
            <Button variant="outline" onClick={() => setExitOpen(false)} disabled={verifying}>
              Cancelar
            </Button>
            <Button onClick={verifyExit} disabled={verifying || exitPin.length !== 4}>
              {verifying ? "Verificando..." : "Salir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </KioskLayout>
  );
}
