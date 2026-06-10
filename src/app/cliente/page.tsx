import { Link } from "react-router-dom";
import { BarChart3, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ClienteHomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">¿Qué deseas hacer?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecciona una opción para continuar.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/cliente/encuesta" className="group">
          <div className="flex h-full flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 transition hover:border-brand/40 hover:bg-foreground/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Acceso a Encuesta</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Abre la encuesta del comedor para que tus comensales la respondan.
              </p>
            </div>
            <Button className="mt-auto">Abrir encuesta</Button>
          </div>
        </Link>
        <Link to="/cliente/reportes" className="group">
          <div className="flex h-full flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 transition hover:border-brand/40 hover:bg-foreground/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Acceso a Dashboard</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Consulta los reportes publicados de tus comedores.
              </p>
            </div>
            <Button variant="outline" className="mt-auto">Ver dashboard</Button>
          </div>
        </Link>
      </div>
    </div>
  );
}