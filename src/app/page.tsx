import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const prefetchSurvey = () => {
  void import("@/app/public-survey/[slug]/page");
};

export default function LandingPage() {
  useEffect(() => {
    type WinIdle = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const w = window as WinIdle;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(prefetchSurvey, { timeout: 3000 });
    } else {
      setTimeout(prefetchSurvey, 1500);
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <span className="mb-4 inline-flex items-center rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand">
        Main Catering
      </span>
      <h1 className="max-w-2xl text-5xl font-extrabold text-foreground">
        Plataforma de satisfacción de comedores
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Encuesta digital para los 15 comedores corporativos de Main Catering.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/survey/sp"
          onMouseEnter={prefetchSurvey}
          onTouchStart={prefetchSurvey}
          onFocus={prefetchSurvey}
        >
          <Button size="lg" className="h-12 px-6 text-base">Abrir encuesta (demo S&amp;P)</Button>
        </Link>
        <Link to="/login">
          <Button size="lg" variant="outline" className="h-12 px-6 text-base">Acceso administradores</Button>
        </Link>
      </div>
    </main>
  );
}
