import { useParams, Link } from "react-router-dom";
import { KioskLayout } from "@/components/survey/KioskLayout";
import { comedores } from "@/lib/mockData";

export default function PublicSurveyPage() {
  const { slug } = useParams<{ slug: string }>();
  const comedor = comedores.find((c) => c.slug === slug);

  return (
    <KioskLayout>
      <header className="flex items-center justify-between px-10 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comedor
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            {comedor?.nombre ?? "Comedor no encontrado"}
          </h1>
        </div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Salir
        </Link>
      </header>
      <section className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-xl text-center">
          <p className="text-base font-semibold uppercase tracking-wider text-muted-foreground">
            Pantalla kiosko
          </p>
          <h2 className="mt-3 text-4xl font-extrabold text-foreground">
            Encuesta en construccion
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Aqui ira el flujo de las 16 preguntas. Layout listo, logica pendiente.
          </p>
        </div>
      </section>
    </KioskLayout>
  );
}
