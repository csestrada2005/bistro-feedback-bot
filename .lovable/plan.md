# Fase 1 + 2 — Higiene crítica y entrega presentable

## Ya ejecutado en este turno (no requiere build mode)
- 🗑️ Eliminadas edge functions huérfanas `pdf-insights` y `generate-insights`.
- 🏬 Precargados 15 comedores adicionales en estado **inactivo** (Arteche, Flowserve, UCQ, Kiewit, Telcel, Bimbo, Interceramic, Berlinerluft, Tec de Monterrey).

## Pendiente — requiere aprobación del plan

### 1. Reset de contraseña
- **`src/app/reset-password/page.tsx` (nuevo)** — formulario con dos campos (nueva contraseña + confirmar), validación mínima (≥8 caracteres, coinciden), llama `supabase.auth.updateUser({ password })`, toast + redirect a `/admin/dashboard`.
- **`src/admin/auth/AuthProvider.tsx`** — al recibir el evento `PASSWORD_RECOVERY` de Supabase Auth, redirigir a `/reset-password` (sin tocar el flujo normal).
- **`src/App.tsx`** — registrar la ruta pública `/reset-password` fuera de `RequireAuth`.
- **`src/app/login/page.tsx`** — añadir enlace "¿Olvidaste tu contraseña?" que abre un mini-diálogo con un input de email y llama `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${origin}/reset-password\` })`. Toast de confirmación.

### 2. Branding Main Catering
La cotización es para Main Catering, pero el panel usa el indigo genérico de shadcn. Sin tener su logo oficial, aplico una paleta cálida creíble de catering (naranja apetitoso + slate profundo) usando solo tokens HSL — fácil de re-tunear cuando me pases el logo real.

- **`src/index.css`** — cambiar `--brand` de `226 71% 40%` (indigo) a `18 85% 45%` (naranja Main Catering); ajustar `--brand-soft` y `--primary` en consecuencia. Todo el panel, kiosko, badges y barras del dashboard heredan el cambio automáticamente.
- **`src/lib/pdf/ReportTemplate.tsx`** — cambiar `C.accent` de `#2563EB` a `#D45A1A` para que el PDF refleje la misma identidad.
- *(El sidebar y el kiosko ya usan `bg-brand` / `text-brand`, no requieren edición; el cambio en `index.css` los propaga.)*

### 3. Plan para tu logo (siguiente iteración, no en este turno)
Cuando me pases el logo en PNG/SVG transparente lo subo al bucket `pdf-branding` (ya existe) y lo intercambio por el ícono `UtensilsCrossed` del sidebar/kiosko y por un `<Image>` en el header del PDF. Sin logo no tiene sentido tocar esto ahora.

## Fuera de scope (no se ejecuta hoy)
- UI de gestión de operadores (`/admin/usuarios`) — la cotización original no la incluye.
- Configuración de plantillas de email de auth con dominio Main Catering — los emails de reset salen con el dominio default de Lovable Cloud, que basta para arranque.

## Archivos tocados
- Modificados: `src/index.css`, `src/admin/auth/AuthProvider.tsx`, `src/app/login/page.tsx`, `src/App.tsx`, `src/lib/pdf/ReportTemplate.tsx`
- Creado: `src/app/reset-password/page.tsx`
