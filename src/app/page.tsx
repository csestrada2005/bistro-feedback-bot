import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <BrandLogo className="mb-6 h-24 w-auto" />
      <h1 className="max-w-2xl text-5xl font-extrabold text-foreground">
        Plataforma de satisfacción de comedores
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Encuesta digital para los 15 comedores corporativos de Main Catering.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link to="/login">
          <Button size="lg" className="h-12 px-8 text-base">Acceder</Button>
        </Link>
      </div>
    </main>
  );
}
