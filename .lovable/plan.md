## Objetivo
Hacer que el sidebar del admin quede fijo al hacer scroll en el contenido, y agregar un botón para colapsarlo y aprovechar pantalla completa.

## Cambios

### 1. `src/components/admin/AdminSidebar.tsx`
- Cambiar el `<aside>` desktop de `h-screen` a `sticky top-0 h-screen` (ya está dentro de un `flex` en `AdminLayout`, así queda pegado al hacer scroll del `main`).
- Agregar estado `collapsed` (persistido en `localStorage`).
- Cuando `collapsed=true`: ancho `w-14` en lugar de `w-60`, ocultar textos (label de nav, branding, email), dejar solo iconos centrados.
- Botón toggle (icono `PanelLeftClose` / `PanelLeftOpen` de lucide) en la parte superior del sidebar desktop. En móvil no aplica (ya tiene drawer).
- Tooltips en los items cuando está colapsado para mantener legibilidad.

### 2. `src/components/admin/AdminLayout.tsx`
- Quitar `overflow-auto` del `<main>` y dejar que el scroll sea del documento (para que `sticky` funcione limpio). Alternativa: mantener `overflow-auto` en `main` y usar `sticky top-0` dentro de ese contenedor scrollable — funciona igual porque el aside está fuera del main.
- Como el aside es hermano del contenedor scrollable y el wrapper exterior es `flex min-h-screen`, basta con `h-screen sticky top-0` en el aside. No requiere más cambios al layout.

### 3. Sin cambios en lógica de negocio, rutas, ni backend.

## Notas técnicas
- El drawer móvil se conserva intacto.
- El header del admin (`AdminLayout` header) sigue siendo del contenido, no del sidebar — así el sidebar colapsado/expandido se ve uniforme.
- Se respetan tokens semánticos (`bg-card`, `border-border`, `text-brand`).
