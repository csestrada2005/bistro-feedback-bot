import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">404</p>
      <h1 className="mt-2 text-4xl font-extrabold text-foreground">Página no encontrada</h1>
      <Link to="/" className="mt-6">
        <Button>Volver al inicio</Button>
      </Link>
    </main>
  );
}
