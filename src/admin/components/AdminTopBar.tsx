import { useAuth } from "@/admin/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";

const todayLabel = () =>
  new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

export function AdminTopBar({ title }: { title: string }) {
  const { role } = useAuth();
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="text-xs capitalize text-muted-foreground">{todayLabel()}</p>
      </div>
      <Badge
        variant="secondary"
        className={
          role === "cafeteria_admin"
            ? "bg-brand/10 text-brand hover:bg-brand/10"
            : "bg-warning/10 text-warning hover:bg-warning/10"
        }
      >
        {role === "cafeteria_admin" ? "Operador del comedor" : "HR — solo lectura"}
      </Badge>
    </header>
  );
}
