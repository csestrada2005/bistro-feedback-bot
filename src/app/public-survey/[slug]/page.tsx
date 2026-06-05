import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KioskLayout } from "@/components/survey/KioskLayout";
import { BrandLogo } from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const DemoSwitcherDialog = lazy(() => import("@/components/survey/DemoSwitcherDialog"));

type Pregunta = {
  id: string;
  texto: string;
  tipo: "escala_5" | "si_no" | "texto_abierto" | "texto_multiple_3";
  orden: number;
};

type Comedor = { id: string; slug: string; nombre: string };

const SCALE_OPTIONS = [
  { value: 5, label: "Excelente", emoji: "😋", classes: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700" },
  { value: 4, label: "Muy bueno", emoji: "🙂", classes: "bg-lime-500 hover:bg-lime-600 text-white border-lime-600" },
  { value: 3, label: "Bueno", emoji: "😐", classes: "bg-yellow-400 hover:bg-yellow-500 text-foreground border-yellow-500" },
  { value: 2, label: "Área de oportunidad", emoji: "💡", classes: "bg-sky-500 hover:bg-sky-600 text-white border-sky-600" },
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

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: com } = await supabase
        .from("comedores")
        .select("id, slug, nombre")
        .eq("slug", slug)
        .eq("activo", true)
        .maybeSingle();
      if (!com) {
        setLoading(false);
        return;
      }
      setComedor(com as Comedor);
      const { data: qs } = await supabase
        .from("preguntas")
        .select("id, texto, tipo, orden")
        .eq("activa", true)
        .or(`comedor_id.is.null,comedor_id.eq.${com.id}`)
        .order("orden", { ascending: true });
      setPreguntas((qs ?? []) as Pregunta[]);
      setLoading(false);
      // RUM: cargar el módulo en idle para no competir con el primer render.
      const comId = (com as Comedor).id;
      const sendRum = () =>
        import("@/lib/rum").then(({ trackSurveyRum }) =>
          trackSurveyRum({ slug, comedorId: comId })
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

  const reset = () => {
    setAnswers(initial());
    setStep(0);
    setDone(false);
    setCountdown(5);
  };

  useEffect(() => {
    if (!done) return;
    setCountdown(5);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          reset();
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
      const encuestaId = crypto.randomUUID();
      const { error: encErr } = await supabase
        .from("encuestas")
        .insert({ id: encuestaId, comedor_id: comedor.id });
      if (encErr) throw encErr;

      const rows: {
        encuesta_id: string;
        pregunta_id: string;
        valor_numerico: number | null;
        valor_booleano: boolean | null;
        valor_texto: string | null;
      }[] = [];

      for (const p of preguntas) {
        const a = answers[p.id];
        if (!a) continue;
        if (p.tipo === "escala_5" && a.numerico) {
          rows.push({ encuesta_id: encuestaId, pregunta_id: p.id, valor_numerico: a.numerico, valor_booleano: null, valor_texto: null });
        } else if (p.tipo === "si_no" && typeof a.booleano === "boolean") {
          rows.push({ encuesta_id: encuestaId, pregunta_id: p.id, valor_numerico: null, valor_booleano: a.booleano, valor_texto: a.texto?.trim() || null });
        } else if (p.tipo === "texto_abierto" && a.texto?.trim()) {
          rows.push({ encuesta_id: encuestaId, pregunta_id: p.id, valor_numerico: null, valor_booleano: null, valor_texto: a.texto.trim() });
        } else if (p.tipo === "texto_multiple_3" && a.textos) {
          const joined = a.textos.map((t) => t.trim()).filter(Boolean).join(" | ");
          if (joined) {
            rows.push({ encuesta_id: encuestaId, pregunta_id: p.id, valor_numerico: null, valor_booleano: null, valor_texto: joined });
          }
        }
      }

      if (rows.length) {
        const { error: respErr } = await supabase.from("respuestas").insert(rows);
        if (respErr) throw respErr;
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
    if (step > 0 && !done) setStep((s) => s - 1);
  };

  return (
    <KioskLayout>
      <div className="flex items-center justify-between px-6 pt-4 sm:px-8 sm:pt-6">
        <div className="w-14">
          {step > 0 && !done && (
            <button
              onClick={handleBack}
              aria-label="Pregunta anterior"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80"
            >
              <ArrowLeft className="h-7 w-7" />
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
              <div className="mt-10 grid grid-cols-4 gap-2 sm:mt-12 sm:gap-4">
                {SCALE_OPTIONS.map((opt) => {
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
                          if (!val) setTimeout(() => {
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
                {answers[currentQ.id]?.booleano === true && (
                  <div className="mt-10 animate-in fade-in duration-200">
                    <label className="block text-2xl font-semibold text-foreground">
                      Cuéntanos qué pasó
                    </label>
                    <Textarea
                      value={answers[currentQ.id]?.texto ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => ({
                          ...a,
                          [currentQ.id]: { ...a[currentQ.id], booleano: true, texto: e.target.value.slice(0, 500) },
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

        {done && (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-full bg-emerald-100 animate-in zoom-in-50 duration-500">
              <Check className="h-24 w-24 text-emerald-600" strokeWidth={3} />
            </div>
            <h1 className="mt-8 text-5xl font-extrabold text-foreground sm:text-6xl">
              ¡Gracias por tu opinión!
            </h1>
            <p className="mt-4 max-w-xl text-2xl text-muted-foreground">
              Tu respuesta ayuda al equipo de Main Catering a mejorar todos los días.
            </p>
            <div
              className="mt-10 flex h-24 w-24 items-center justify-center rounded-full border-4 border-brand text-3xl font-extrabold text-brand"
              aria-live="polite"
              aria-label={`Reiniciando en ${countdown} segundos`}
            >
              {countdown}
            </div>
            <p className="mt-3 text-base text-muted-foreground">Reiniciando…</p>
          </div>
        )}
      </section>

      {isWelcome && !done && (
        <div className="px-8 pb-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground/70 hover:text-foreground">
            Salir del kiosko
          </Link>
        </div>
      )}
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
    </KioskLayout>
  );
}
