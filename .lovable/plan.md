## Plan: Asistente IA en el panel Admin

Objetivo: agregar un asistente conversacional en el sidebar de Admin que entienda el negocio (comedores, preguntas, respuestas, reportes) y pueda ejecutar acciones reales sobre la base de datos vía tool-calling, no solo dar consejos.

### Stack técnico

- **AI SDK** + Lovable AI Gateway (ya está activo en el proyecto vía `suggest-questions`, `analyze-responses`, etc.).
- Modelo por defecto: `google/gemini-3-flash-preview` (rápido y soporta tools). Subir a `google/gemini-2.5-pro` solo para tareas analíticas largas.
- **Edge function** nueva `admin-assistant` que valida JWT + rol admin (mismo patrón que `analyze-responses`), define las tools con Zod, ejecuta con service role y devuelve stream `toUIMessageStreamResponse`.
- **UI**: AI Elements (`Conversation`, `Message`, `MessageResponse`, `Tool`, `PromptInput`, `Shimmer`) — se instalan con `bunx ai-elements@latest add conversation message prompt-input shimmer tool`.

### Pregunta de producto principal: ¿Dónde vive el asistente?

**Propuesta A — Página dedicada `/admin/asistente**` (recomendada para empezar)

- Nuevo item "Asistente" en `AdminSidebar` con ícono `Sparkles`/`Bot`.
- Página completa con transcript + composer. Más espacio para mostrar resultados de tools (tablas de preguntas afectadas, previews de reportes, etc.).
- Historial guardado por admin (Lovable Cloud, tabla `assistant_threads` + `assistant_messages`, RLS por `auth.uid()`).
- Pro: el admin puede tener conversaciones largas, abrir tablas/diff, copiar resultados.
- Contra: requiere navegar fuera de la pantalla actual.

**Propuesta B — Widget flotante global (botón circular abajo-derecha)**

- Disponible en cualquier pantalla del admin.
- Contexto automático: el asistente sabe en qué página está el admin ("estás viendo Preguntas filtradas por Comedor X") y propone acciones relevantes.
- Sin persistencia o solo última conversación en localStorage.
- Pro: siempre a la mano, contextual.
- Contra: poco espacio para resultados ricos.

**Propuesta C — Híbrido**: widget flotante para preguntas rápidas + página completa para sesiones largas (comparten threads desde la BD). Más trabajo pero la mejor UX a futuro.

---

### Capacidades (tools) sugeridas — agrupadas por categoría

**Bloque 1: Gestión de preguntas (lo que pediste)**

- `list_preguntas({ filtroComedor?, activa? })` — devuelve preguntas, su tipo y a cuántos/cuáles comedores están asignadas.
- `toggle_pregunta_activa({ preguntaId, activa })` — prender/apagar.
- `bulk_toggle_preguntas({ ids[], activa })` — operación masiva.
- `asignar_pregunta_comedores({ preguntaId, comedorIds[], modo: "agregar" | "reemplazar" | "quitar" })` — controla en qué comedores aparece.
- `crear_pregunta({ texto, tipo, comedorIds[], activa })` — crear directo (con confirmación).
- `editar_pregunta({ id, texto?, tipo?, activa? })`.
- `eliminar_pregunta({ id })` — solo si no tiene respuestas (replica la validación actual).
- `reordenar_preguntas({ orden: [id, ...] })`.

**Bloque 2: Gestión de comedores**

- `list_comedores({ activo? })`.
- `toggle_comedor_activo({ id, activo })`.
- `crear_comedor({ nombre, slug, empresa_cliente })`.
- `editar_comedor({ id, ...campos })`.

**Bloque 3: Insights y análisis (lectura + IA)**

- `resumen_comedor({ comedorId, dias })` — promedios, NPS-like, % flagged, comentarios destacados.
- `comparar_comedores({ ids[], dias })` — ranking por satisfacción.
- `analizar_comentarios({ comedorId, dias })` — usa la edge function `analyze-responses` ya existente.
- `top_problemas({ comedorId, dias, n })` — preguntas peor evaluadas + ejemplos.
- `tendencia({ comedorId, metrica, dias })` — devuelve serie temporal lista para mostrar como mini-chart.

**Bloque 4: Reportes**

- `crear_reporte({ comedorId, desde, hasta, titulo? })` — invoca `generate-insights` + inserta borrador.
- `publicar_reporte({ id })`, `despublicar_reporte({ id })`.
- `listar_reportes({ comedorId?, estado? })`.

**Bloque 5: Usuarios / accesos**

- `listar_usuarios({ rol? })`.
- `invitar_cliente({ email, password_temporal, comedorIds[] })` — reusa la edge function `admin-users`.
- `asignar_comedores_a_cliente({ usuarioId, comedorIds[], modo })`.

**Bloque 6: Sugerencias asistidas**

- `sugerir_preguntas({ comedorId, contexto })` — reutiliza `suggest-questions`. El asistente puede generar 3 sugerencias y, si el admin dice "agrega la primera", llama `crear_pregunta`.
- `detectar_preguntas_duplicadas()` — escanea similitud semántica entre preguntas activas y propone fusionar/desactivar.
- `recomendar_rotacion({ comedorId })` — si una pregunta lleva mucho tiempo dominando rotación, propone desactivarla.

### Modelo de seguridad para mutaciones

Cada tool con efectos se clasifica:

- **Lectura libre** (Bloque 1 list, 3, 4 listar) → ejecuta sin pedir confirmación.
- **Mutación reversible** (toggle activa, asignar/desasignar comedores, publicar/despublicar, reordenar) → ejecuta y muestra "Hecho ✓ — Deshacer" inline en la respuesta.
- **Mutación destructiva o sensible** (eliminar pregunta/comedor/reporte, crear usuario, cambiar contraseñas) → `needsApproval: true` del AI SDK. La UI muestra una tarjeta "El asistente quiere ejecutar X" con botones Aprobar / Rechazar antes de aplicar.

Todas las mutaciones quedan auditadas en una nueva tabla `assistant_actions(id, admin_id, tool, params, result, created_at)` para trazabilidad.

### Experiencia conversacional concreta — ejemplos

1. "Apaga las preguntas de tipo escala que estén asignadas al comedor Planta Norte y no hayan recibido respuestas en 30 días." → `list_preguntas` + filtro → `bulk_toggle_preguntas` (con confirmación porque son varias).
2. "Asígnale al comedor Oficinas CDMX las mismas preguntas que tiene Planta Sur." → `list_preguntas` con asignación de Planta Sur → `asignar_pregunta_comedores` por cada una en modo "agregar".
3. "Genera un reporte de los últimos 14 días para todos los comedores activos y publícalos." → loop con `crear_reporte` + `publicar_reporte` (cada publicación pide aprobación).
4. "¿Qué comedor está peor evaluado esta semana y por qué?" → `comparar_comedores` + `analizar_comentarios`.
5. "Crea una pregunta nueva 'Hoy hubo suficiente variedad de platos' tipo sí/no para todos los comedores." → `crear_pregunta` con confirmación.

### Persistencia de historial (preguntar al usuario)

Necesito decidir entre:

- **Sin historial** — cada visita arranca limpio (más simple, menos BD).
- **Una conversación por admin** guardada en BD — siempre puede continuar la última sesión.
- **Hilos múltiples** con sidebar de conversaciones (estilo ChatGPT) — más trabajo, mejor para uso frecuente.

### UI rica en respuestas

Cuando una tool devuelve datos tabulares (lista de preguntas, comedores, reportes), el asistente los renderiza dentro del mensaje como mini-tabla con acciones inline ("Apagar", "Editar"), no solo texto. Esto requiere componentes custom de `<Tool>` con renderers por nombre de tool.

### Archivos previstos

- nueva edge function `supabase/functions/admin-assistant/index.ts` (auth admin + AI SDK + tools)
- migración: tabla `assistant_threads`, `assistant_messages`, `assistant_actions` con RLS
- `src/app/admin/asistente/page.tsx` (si Propuesta A o C)
- `src/components/admin/AssistantWidget.tsx` (si Propuesta B o C)
- Componentes AI Elements en `src/components/ai-elements/*` (auto-instalados)
- `src/components/admin/assistant/ToolResultRenderers.tsx` para tablas inline por tool
- `src/components/admin/AdminSidebar.tsx` — agregar nav item
- `src/App.tsx` — ruta nueva

### Decisiones que necesito antes de implementar

1. **Ubicación del asistente**: ¿A (página dedicada), B (widget flotante) o C (híbrido)? A 
2. **Historial**: ¿sin historial, una conversación por admin, o hilos múltiples? Sin historial
3. **Alcance del MVP**: ¿empezamos solo con Bloque 1 + 3 (preguntas + insights), o vamos completo con los 6 bloques desde el inicio? Completo
4. **Mutaciones masivas**: ¿prefieres que TODA mutación pida aprobación explícita (más seguro, más fricción) o solo las destructivas (más fluido)? toda mutación pida aprobación