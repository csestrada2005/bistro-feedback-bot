import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KioskLayout } from "@/components/survey/KioskLayout";
import { comedores } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const SCALE_QUESTIONS = [
  "¿Cómo consideras el sabor de la comida?",
  "¿Cómo consideras la calidad de los alimentos?",
  "¿Cómo consideras el sabor y calidad del plato fuerte?",
  "¿Qué tan buena es la variedad del menú?",
  "¿Cómo consideras la porción de los alimentos?",
  "¿Cómo calificas el agua de sabor en el comedor?",
  "¿Cómo consideras el tiempo de servicio del comedor?",
  "¿Cómo consideras la variedad y calidad del postre?",
  "¿Cómo consideras la temperatura de los alimentos?",
  "¿Cómo consideras la limpieza de los utensilios (platos, cucharas, tenedores)?",
  "¿Cómo consideras la limpieza del área?",
  "¿El personal cumple con las medidas de higiene visibles (guantes y cubrebocas)?",
  "¿Cómo consideras el trato del personal del comedor?",
];

const SCALE_OPTIONS = [
  { value: 1, label: "Deficiente", emoji: "😣", classes: "bg-red-500 hover:bg-red-600 text-white border-red-600" },
  { value: 2, label: "Malo", emoji: "🙁", classes: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600" },
  { value: 3, label: "Regular", emoji: "😐", classes: "bg-yellow-400 hover:bg-yellow-500 text-foreground border-yellow-500" },
  { value: 4, label: "Bueno", emoji: "🙂", classes: "bg-lime-500 hover:bg-lime-600 text-white border-lime-600" },
  { value: 5, label: "Muy bueno", emoji: "😋", classes: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700" },
];

const TOTAL_STEPS = 17; // 0 welcome, 1-13 scale, 14 incidente, 15 mejoras, 16 menu, 17 thanks (final 17 not counted in progress)
const PROGRESS_STEPS = 16;

type Respuestas = {
  comedorSlug: string;
  fechaISO: string;
  respuestasEscala: Record<number, number>;
  incidente: { tuvo: boolean | null; descripcion: string };
  propuestasMejora: string[];
  propuestasMenu: string[];
};

const initialState = (slug: string): Respuestas => ({
  comedorSlug: slug,
  fechaISO: new Date().toISOString(),
  respuestasEscala: {},
  incidente: { tuvo: null, descripcion: "" },
  propuestasMejora: ["", "", ""],
  propuestasMenu: ["", "", ""],
});

export default function PublicSurveyPage() {
  const { slug = "sp" } = useParams<{ slug: string }>();
  const comedor = comedores.find((c) => c.slug === slug);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Respuestas>(() => initialState(slug));
  const [countdown, setCountdown] = useState(5);

  const reset = () => {
    setData(initialState(slug));
    setStep(0);
    setCountdown(5);
  };

  useEffect(() => {
    if (step !== 17) return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          reset();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const submit = (final: Respuestas) => {
    // eslint-disable-next-line no-console
    console.log("ENCUESTA ENVIADA", final);
    setStep(17);
  };

  const handleBack = () => {
    if (step > 0 && step < 17) setStep((s) => s - 1);
  };

  const showBack = step > 0 && step < 17;
  const showProgress = step >= 1 && step <= 16;
  const currentLabel = step >= 1 && step <= 16 ? `Pregunta ${step} de ${PROGRESS_STEPS}` : "";

  // SCALE QUESTIONS (1..13)
  const isScale = step >= 1 && step <= 13;
  const scaleIndex = step - 1;

  return (
    <KioskLayout>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-6">
        <div className="w-12">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="Atrás"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
        </div>
        <div className="flex-1 px-6 text-center">
          {showProgress && (
            <>
              <p className="text-base font-semibold text-muted-foreground">{currentLabel}</p>
              <div className="mx-auto mt-2 h-2 w-full max-w-xl overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-brand transition-all duration-300"
                  style={{ width: `${(step / PROGRESS_STEPS) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
        <div className="w-12" />
      </div>

      {/* Body */}
      <section
        key={step}
        className="flex flex-1 animate-in fade-in duration-200 flex-col items-center justify-center px-8 pb-10"
      >
        {/* Step 0: welcome */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center">
            <span className="mb-6 inline-flex items-center rounded-full bg-brand-soft px-5 py-2 text-lg font-semibold text-brand">
              Main Catering
            </span>
            <h1 className="text-6xl font-extrabold leading-tight text-foreground">
              Comedor {comedor?.nombre.split(" ")[0] ?? slug.toUpperCase()}
            </h1>
            <p className="mt-6 max-w-xl text-2xl text-muted-foreground">
              Tu opinión nos ayuda a mejorar. Solo te tomará 2 minutos.
            </p>
            <Button
              onClick={() => setStep(1)}
              className="mt-14 h-24 w-[28rem] rounded-2xl bg-brand text-3xl font-bold text-brand-foreground shadow-xl shadow-brand/30 hover:bg-brand active:scale-95"
            >
              Empezar encuesta
            </Button>
          </div>
        )}

        {/* Steps 1-13: scale */}
        {isScale && (
          <div className="w-full max-w-5xl">
            <h2 className="text-center text-5xl font-extrabold leading-tight text-foreground">
              {SCALE_QUESTIONS[scaleIndex]}
            </h2>
            <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-5">
              {SCALE_OPTIONS.map((opt) => {
                const selected = data.respuestasEscala[step] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setData((d) => ({
                        ...d,
                        respuestasEscala: { ...d.respuestasEscala, [step]: opt.value },
                      }));
                      setTimeout(() => setStep((s) => s + 1), 120);
                    }}
                    className={cn(
                      "flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-3xl border-2 p-4 text-center transition-transform active:scale-95",
                      opt.classes,
                      selected && "ring-4 ring-offset-2 ring-foreground/30"
                    )}
                  >
                    <span className="text-5xl">{opt.emoji}</span>
                    <span className="text-4xl font-extrabold">{opt.value}</span>
                    <span className="text-lg font-bold">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 14: incidente */}
        {step === 14 && (
          <div className="w-full max-w-3xl">
            <h2 className="text-center text-5xl font-extrabold text-foreground">
              ¿Has tenido algún incidente con alimentos?
            </h2>
            <div className="mt-14 grid grid-cols-2 gap-6">
              <button
                onClick={() => setData((d) => ({ ...d, incidente: { ...d.incidente, tuvo: true } }))}
                className={cn(
                  "flex min-h-[160px] items-center justify-center rounded-3xl border-2 text-4xl font-extrabold transition-transform active:scale-95",
                  data.incidente.tuvo === true
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-card text-foreground hover:border-brand/40"
                )}
              >
                Sí
              </button>
              <button
                onClick={() => {
                  setData((d) => ({ ...d, incidente: { tuvo: false, descripcion: "" } }));
                  setTimeout(() => setStep(15), 120);
                }}
                className={cn(
                  "flex min-h-[160px] items-center justify-center rounded-3xl border-2 text-4xl font-extrabold transition-transform active:scale-95",
                  data.incidente.tuvo === false
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-card text-foreground hover:border-brand/40"
                )}
              >
                No
              </button>
            </div>
            {data.incidente.tuvo === true && (
              <div className="mt-10 animate-in fade-in duration-200">
                <label className="block text-2xl font-semibold text-foreground">
                  Cuéntanos qué pasó
                </label>
                <Textarea
                  value={data.incidente.descripcion}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      incidente: { ...d.incidente, descripcion: e.target.value.slice(0, 500) },
                    }))
                  }
                  className="mt-3 min-h-[160px] rounded-2xl border-2 p-5 text-2xl"
                  placeholder="Describe el incidente..."
                />
                <Button
                  onClick={() => setStep(15)}
                  className="mt-6 h-20 w-full rounded-2xl bg-brand text-2xl font-bold text-brand-foreground hover:bg-brand active:scale-95"
                >
                  Continuar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 15: propuestas mejora */}
        {step === 15 && (
          <div className="w-full max-w-3xl">
            <h2 className="text-center text-4xl font-extrabold text-foreground">
              ¿Qué propones para mejorar el servicio del comedor?
            </h2>
            <p className="mt-3 text-center text-xl text-muted-foreground">Opcional</p>
            <div className="mt-10 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl font-extrabold text-brand">
                    {i + 1}
                  </span>
                  <Input
                    value={data.propuestasMejora[i]}
                    onChange={(e) => {
                      const next = [...data.propuestasMejora];
                      next[i] = e.target.value.slice(0, 140);
                      setData((d) => ({ ...d, propuestasMejora: next }));
                    }}
                    placeholder={`Propuesta ${i + 1}`}
                    className="h-16 rounded-2xl border-2 px-5 text-xl"
                  />
                </div>
              ))}
            </div>
            <Button
              onClick={() => setStep(16)}
              className="mt-10 h-20 w-full rounded-2xl bg-brand text-2xl font-bold text-brand-foreground hover:bg-brand active:scale-95"
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 16: propuestas menu */}
        {step === 16 && (
          <div className="w-full max-w-3xl">
            <h2 className="text-center text-4xl font-extrabold text-foreground">
              ¿Qué 3 platos fuertes te gustaría que incluyéramos?
            </h2>
            <p className="mt-3 text-center text-xl text-muted-foreground">Opcional</p>
            <div className="mt-10 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-2xl font-extrabold text-brand">
                    {i + 1}
                  </span>
                  <Input
                    value={data.propuestasMenu[i]}
                    onChange={(e) => {
                      const next = [...data.propuestasMenu];
                      next[i] = e.target.value.slice(0, 80);
                      setData((d) => ({ ...d, propuestasMenu: next }));
                    }}
                    placeholder={`Platillo ${i + 1}`}
                    className="h-16 rounded-2xl border-2 px-5 text-xl"
                  />
                </div>
              ))}
            </div>
            <Button
              onClick={() => submit({ ...data, fechaISO: new Date().toISOString() })}
              className="mt-10 h-20 w-full rounded-2xl bg-brand text-2xl font-bold text-brand-foreground hover:bg-brand active:scale-95"
            >
              Enviar encuesta
            </Button>
          </div>
        )}

        {/* Step 17: thanks */}
        {step === 17 && (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-44 w-44 items-center justify-center rounded-full bg-emerald-100 animate-in zoom-in-50 duration-500">
              <Check className="h-28 w-28 text-emerald-600" strokeWidth={3} />
            </div>
            <h1 className="mt-10 text-6xl font-extrabold text-foreground">
              ¡Gracias por tu opinión!
            </h1>
            <p className="mt-4 max-w-xl text-2xl text-muted-foreground">
              Tu respuesta ayuda al equipo de Main Catering a mejorar todos los días.
            </p>
            <p className="mt-10 text-lg text-muted-foreground">
              Reiniciando en {countdown}s…
            </p>
          </div>
        )}
      </section>

      {/* Footer breadcrumb to leave (only on welcome) */}
      {step === 0 && (
        <div className="px-8 pb-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground/70 hover:text-foreground">
            Salir del kiosko
          </Link>
        </div>
      )}

      {/* Comedor name footer */}
      {step > 0 && step < 17 && (
        <footer className="border-t border-border py-3 text-center text-sm text-muted-foreground">
          {comedor?.nombre ?? slug}
        </footer>
      )}
    </KioskLayout>
  );
}
