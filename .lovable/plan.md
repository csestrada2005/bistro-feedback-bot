
## Auditoría de criterios de aceptación

Reviso el spec contra el código actual y solo queda **una pieza faltante**: la página `/admin/comedores` es un placeholder. Todo lo demás ya está implementado:

| Criterio | Estado | Dónde |
|---|---|---|
| Crear comedor y encuesta con preguntas de distinto tipo | ⚠️ Preguntas sí; **comedores no tiene CRUD UI** | `admin/questions/page.tsx` ✅ / `admin/comedores/page.tsx` ❌ |
| Responder desde pantalla pública y guardar con `comedor_id` | ✅ | `public-survey/[slug]/page.tsx` |
| Comentario abierto se guarda y aparece en panel | ✅ (como `valor_texto` de tipo `texto_abierto` / `texto_multiple_3`) | kiosko + `responses/page.tsx` |
| Reset automático tras enviar | ✅ (5s countdown) | `public-survey` línea 127–141 |
| Dashboard con KPIs y gráficas filtradas por comedor/fecha | ✅ | `admin/dashboard/page.tsx` |
| "Sugerir preguntas con IA" | ✅ | botón en `questions/page.tsx` → edge `suggest-questions` |
| "Generar análisis con IA" | ✅ | botón en `dashboard/page.tsx` → edge `analyze-responses` |
| API key de IA en edge functions, no en cliente | ✅ | `LOVABLE_API_KEY` en secrets |
| Descargar reporte PDF con KPIs + análisis | ✅ | `lib/pdf/generateReportPdf.ts` + `pdf-insights` edge |
| Admin con login; pública sin login | ✅ | `RequireAuth` + RLS abierta en kiosko |

## Único cambio a implementar

**Página `/admin/comedores` con CRUD completo:**

- Tabla con: nombre, empresa cliente, slug, estado (activo/inactivo), nº encuestas recibidas.
- Botón **Nuevo comedor** → modal con campos `nombre`, `empresa_cliente`, `slug` (auto-generado desde nombre, editable, validar unicidad y formato `[a-z0-9-]+`).
- Editar (mismo modal).
- Switch activar/desactivar (optimistic, actualiza `activo`).
- Acción **Copiar URL kiosko** (`{origin}/survey/{slug}`) con toast.
- Acción **Abrir kiosko** (nueva pestaña).
- Borrar solo si no tiene encuestas asociadas (igual que en preguntas: chequear count y bloquear con toast); si tiene, sugerir desactivar.
- Loading skeleton + empty state coherentes con el resto del admin.

Sin cambios de schema (la tabla `comedores` ya tiene todos los campos). Sin tocar edge functions ni kiosko.

## Detalles técnicos

- Archivo: reemplazar contenido de `src/app/admin/comedores/page.tsx`.
- Reutilizar componentes shadcn ya importados en `questions/page.tsx` (`Dialog`, `AlertDialog`, `Table`, `Switch`, `Input`, `Label`).
- RLS: las políticas `comedores_admin_all` ya permiten INSERT/UPDATE/DELETE a admins autenticados → no hay que cambiar nada.
- Slug helper: normalizar (`toLowerCase`, reemplazar acentos, espacios → `-`, strip no permitidos). Validar en cliente y dejar que la DB rechace duplicados (constraint UNIQUE existente).
- Contador de encuestas por comedor: una sola query `select comedor_id, count(*) from encuestas group by comedor_id` (vía `.select('comedor_id', { count: 'exact', head: false })` o agregando en cliente — preferir batch en cliente con un `in()` de ids para mantenerlo simple).

Tras aprobar este plan paso a build mode e implemento.
