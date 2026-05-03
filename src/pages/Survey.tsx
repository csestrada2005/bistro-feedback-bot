import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitSurvey } from "@/lib/api";
import { getDeviceFingerprint } from "@/lib/fingerprint";

type Option = { emoji: string; label: string; value: string };
type Question = {
  id: string;
  title: string;
  options: Option[];
};

const QUESTIONS: Question[] = [
  {
    id: "q1",
    title: "¿Qué tal la comida de hoy?",
    options: [
      { emoji: "🤢", label: "Mala", value: "1" },
      { emoji: "😕", label: "Regular", value: "2" },
      { emoji: "😐", label: "Normal", value: "3" },
      { emoji: "🙂", label: "Buena", value: "4" },
      { emoji: "😋", label: "Muy buena", value: "5" },
    ],
  },
  {
    id: "q2",
    title: "¿Cómo viste el comedor hoy de limpio?",
    options: [
      { emoji: "🤢", label: "Sucio", value: "1" },
      { emoji: "😕", label: "Mal", value: "2" },
      { emoji: "😐", label: "Más o menos", value: "3" },
      { emoji: "🙂", label: "Limpio", value: "4" },
      { emoji: "✨", label: "Muy limpio", value: "5" },
    ],
  },
  {
    id: "q3",
    title: "Comparado con la semana pasada, ¿cómo va el comedor?",
    options: [
      { emoji: "👎", label: "Peor", value: "peor" },
      { emoji: "👌", label: "Igual", value: "igual" },
      { emoji: "👍", label: "Mejor", value: "mejor" },
    ],
  },
  {
    id: "q4",
    title: "¿Le recomendarías el comedor a un compañero nuevo?",
    options: [
      { emoji: "👎", label: "No", value: "no" },
      { emoji: "🤔", label: "Tal vez", value: "tal_vez" },
      { emoji: "👍", label: "Sí", value: "si" },
    ],
  },
];

const TOTAL_STEPS = 5;

const ProgressDots = ({ step }: { step: number }) => (
  <div className="flex items-center justify-center gap-3">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <span
        key={i}
        className={cn(
          "h-3 rounded-full transition-all",
          i === step ? "w-10 bg-brand" : i < step ? "w-3 bg-brand/60" : "w-3 bg-border"
        )}
      />
    ))}
  </div>
);

const Survey = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef<number>(performance.now());

  const isQuestion = step < QUESTIONS.length;
  const currentQ = isQuestion ? QUESTIONS[step] : null;
  const currentValue = currentQ ? answers[currentQ.id] : null;

  const canNext = useMemo(() => {
    if (!currentQ) return true;
    return Boolean(currentValue);
  }, [currentQ, currentValue]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate("/"), 5000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const handleBack = () => {
    if (step === 0) navigate("/");
    else setStep((s) => s - 1);
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      void finalizeSubmission(comment);
    }
  };

  const finalizeSubmission = async (finalComment: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const q1 = Number(answers["q1"]);
      const q2 = Number(answers["q2"]);
      const q3 = answers["q3"] as "peor" | "igual" | "mejor";
      const q4 = answers["q4"] as "no" | "tal_vez" | "si";
      await submitSurvey({
        q1,
        q2,
        q3,
        q4,
        comment: finalComment.trim() ? finalComment.trim() : null,
        response_time_ms: Math.round(performance.now() - startedAtRef.current),
        device_fingerprint: getDeviceFingerprint(),
      });
      setDone(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "COOLDOWN_ACTIVE") {
        toast("Ya registramos tu opinión 🙏", {
          description: "Vuelve a votar más tarde.",
        });
        navigate("/");
      } else if (code === "OUTSIDE_HOURS") {
        toast("El comedor está cerrado ahora", {
          description: "Las encuestas están disponibles de 12:00 a 15:00.",
        });
        navigate("/");
      } else {
        toast("No pudimos guardar tu encuesta", {
          description: "Inténtalo de nuevo en un momento.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-success/15 animate-in zoom-in-50 duration-500">
          <Check className="h-24 w-24 text-success" strokeWidth={3} />
        </div>
        <h1 className="mt-10 text-6xl font-extrabold text-foreground">¡Gracias!</h1>
        <p className="mt-4 text-2xl text-muted-foreground">Tu opinión llegó al chef 👨‍🍳</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="px-8 pt-10">
        <ProgressDots step={step} />
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {isQuestion && currentQ ? (
          <div className="w-full max-w-5xl">
            <h2 className="text-center text-5xl font-extrabold leading-tight text-foreground md:text-6xl">
              {currentQ.title}
            </h2>
            <div
              className={cn(
                "mt-16 grid gap-5",
                currentQ.options.length === 5
                  ? "grid-cols-2 md:grid-cols-5"
                  : "grid-cols-1 md:grid-cols-3"
              )}
            >
              {currentQ.options.map((opt) => {
                const selected = currentValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setAnswers((a) => ({ ...a, [currentQ.id]: opt.value }))
                    }
                    className={cn(
                      "group flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-3xl border-2 p-6 transition-all",
                      "hover:scale-105 active:scale-95",
                      selected
                        ? "border-brand bg-brand-soft shadow-lg shadow-brand/20"
                        : "border-border bg-card hover:border-brand/40"
                    )}
                  >
                    <span className="text-7xl">{opt.emoji}</span>
                    <span className="text-2xl font-bold text-foreground">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl">
            <h2 className="text-center text-5xl font-extrabold text-foreground">
              ¿Algo que el chef deba saber?
            </h2>
            <p className="mt-4 text-center text-2xl text-muted-foreground">
              (Opcional)
            </p>
            <div className="mt-12">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 200))}
                placeholder="Escribe aquí..."
                className="min-h-[200px] rounded-2xl border-2 p-6 text-2xl"
              />
              <div className="mt-2 flex justify-end text-lg text-muted-foreground">
                {comment.length}/200
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between gap-4 px-8 pb-10">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="h-16 rounded-2xl px-6 text-xl font-semibold"
        >
          <ArrowLeft className="mr-2 h-6 w-6" />
          Atrás
        </Button>

        <div className="flex items-center gap-3">
          {!isQuestion && (
            <Button
              variant="ghost"
              onClick={() => {
                setComment("");
                void finalizeSubmission("");
              }}
              disabled={submitting}
              className="h-16 rounded-2xl px-6 text-xl font-semibold"
            >
              Saltar
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canNext || submitting}
            className={cn(
              "h-20 min-w-[220px] rounded-2xl bg-brand px-10 text-2xl font-bold text-brand-foreground shadow-lg shadow-brand/30 transition-transform",
              "hover:scale-105 hover:bg-brand active:scale-95",
              "disabled:opacity-40 disabled:hover:scale-100"
            )}
          >
            {step === TOTAL_STEPS - 1 ? "Enviar" : "Siguiente"}
            <ArrowRight className="ml-2 h-7 w-7" />
          </Button>
        </div>
      </footer>

      <Link
        to="/"
        className="absolute right-4 top-4 text-sm text-muted-foreground/70 hover:text-foreground"
      >
        Cancelar
      </Link>
    </main>
  );
};

export default Survey;
