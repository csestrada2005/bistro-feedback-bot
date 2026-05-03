import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <main className="kiosk-pattern relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-brand" />
      <div className="flex flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center rounded-full bg-brand-soft px-5 py-2 text-base font-semibold text-brand">
          Comedor industrial
        </span>
        <h1 className="max-w-4xl text-6xl font-extrabold leading-tight text-foreground md:text-7xl">
          ¿Cómo estuvo tu comida hoy?
        </h1>
        <p className="mt-6 text-2xl font-medium text-muted-foreground">
          Tu opinión es <span className="text-foreground font-bold">100% anónima</span>
        </p>

        <Link to="/survey" className="mt-14">
          <Button
            size="lg"
            className="h-24 w-96 rounded-2xl bg-brand text-3xl font-bold text-brand-foreground shadow-xl shadow-brand/30 transition-transform hover:scale-105 hover:bg-brand active:scale-95"
          >
            EMPEZAR
          </Button>
        </Link>

        <div className="mt-16 flex items-center gap-2 text-lg text-muted-foreground">
          <Clock className="h-5 w-5" />
          <span>Toma 15 segundos</span>
        </div>
      </div>
    </main>
  );
};

export default Index;
