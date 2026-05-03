import { type ReactNode } from "react";

export function StubPage({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <StubPage
      title={title}
      description="Esta sección se conectará en los próximos pasos."
    />
  );
}
