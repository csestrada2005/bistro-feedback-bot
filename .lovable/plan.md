## Objetivo
Separar la información en dos vistas:
- **Vista privada (admin / operador interno)**: ve los datos crudos de las encuestas + análisis IA en vivo sobre todo lo crudo + permite editar y publicar un "reporte filtrado".
- **Vista cliente**: solo ve los reportes que el admin haya publicado (KPIs, recomendaciones, alertas ya filtradas/editadas). Nunca ve respuestas individuales crudas.

## Cambios en base de datos

1. **Nuevo rol `cliente`** en el enum `user_rol` (ya existen `admin`, `operador`).
2. **Tabla `reportes`** — añadir columnas:
   - `titulo text`
   - `estado text` con valores `borrador` / `publicado` (default `borrador`)
   - `kpis jsonb` (KPIs editables: satisfacción, NPS, etc.)
   - `recomendaciones jsonb` (lista editable de recomendaciones)
   - `alertas jsonb` (lista editable de alertas)
   - `resumen text` (texto editable del análisis)
   - `publicado_at timestamptz`
   - `publicado_por uuid`
3. **RLS de `reportes`**:
   - Admin: ALL (ya existe).
   - Operador (de un comedor): ver borradores y publicados de su `comedor_id`.
   - Cliente: solo `SELECT` donde `estado = 'publicado'` y `comedor_id = current_user_comedor()`.
4. **Bloquear acceso crudo al cliente**: las policies `respuestas_select_*` y `encuestas_select_*` se quedan como están (admin/operador). El rol `cliente` no aparece en ninguna policy de respuestas/encuestas → no puede leerlas.

## Cambios en frontend

### Rutas
- `/admin/*` → admin + operador (vista privada existente, con datos crudos).
  - **Nueva página `/admin/reports/:id/edit`**: editor del reporte (IA sugiere → admin edita texto, KPIs, recomendaciones, alertas → botón "Publicar").
  - En `/admin/responses` añadir botón "Generar borrador con IA" que crea un `reportes` en estado `borrador`.
- `/cliente/*` → solo rol `cliente`.
  - `/cliente/reportes`: lista de reportes publicados de su comedor.
  - `/cliente/reportes/:id`: vista de solo lectura con KPIs, alertas, recomendaciones (el contenido publicado).

### Auth / routing
- `RequireAuth` acepta `allow={["cliente"]}` para las rutas `/cliente/*`.
- Tras login: admin/operador → `/admin/dashboard`; cliente → `/cliente/reportes`.
- Sidebar del cliente: simple (Reportes + logout).

### IA
- **Vista privada – análisis en vivo** (ya existe `analyze-responses`): se sigue ejecutando sobre TODAS las respuestas crudas del rango.
- **Vista privada – borrador editable**: nueva edge function `draft-report` que toma respuestas crudas + llama Lovable AI (`google/gemini-3-flash-preview`) con tool calling para devolver `{ resumen, kpis[], recomendaciones[], alertas[] }`, lo guarda en `reportes` como `borrador`. El admin edita en `/admin/reports/:id/edit` y pulsa "Publicar".
- **Vista cliente**: NO llama a IA. Solo lee los campos ya guardados en `reportes` publicados.

## Detalles técnicos

- Enum update: `ALTER TYPE user_rol ADD VALUE 'cliente';`
- `AuthProvider`/tipos: añadir `"cliente"` a `AdminRol` (renombrar tipo a `UserRol`).
- Layout cliente nuevo `src/components/cliente/ClienteLayout.tsx` reutilizando estilos.
- Edge function `draft-report` con `verify_jwt = true`, validación Zod del body `{ comedor_id, fecha_desde, fecha_hasta }`, devuelve `report_id`.
- Edge function `publish-report` (o RPC) que cambia `estado` a `publicado` y setea `publicado_at`, `publicado_por`.
- No tocamos `respuestas`/`encuestas` ni los datos existentes (siguen vacíos como pediste).

## Fuera de alcance
- No cambia el flujo de encuestas públicas ni la gestión de comedores/preguntas.
- No se modifica la UX de admin existente más allá de añadir el botón de borrador y la página de edición/publicación.
