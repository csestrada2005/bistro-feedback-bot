# Hacer al Asistente IA verdaderamente autónomo

## Problema

Hoy el asistente:

1. Pide IDs al usuario en lugar de buscarlos él mismo, aunque ya tiene tools para hacerlo.
2. Cuando el usuario dice "hazlo", se vuelve a confundir y pide aclaraciones obvias en lugar de actuar.
3. No infiere bulk operations (ej: "todas las preguntas → solo en comedor X" = `asignar_pregunta_comedores` con modo `reemplazar`, una por pregunta).

La causa raíz es el **prompt del sistema** demasiado pasivo y la falta de una tool para **operaciones masivas** sobre múltiples preguntas a la vez. Gemini, ante la duda, prefiere preguntar.

## Propuesta (1 sola iteración, sin nueva tabla, sin migración)

### 1. Reescribir el SYSTEM_PROMPT (archivo: `supabase/functions/admin-assistant/index.ts`)

Reglas nuevas, explícitas:

- **NUNCA pidas IDs al usuario.** Si necesitas un ID, llama tú mismo a `list_preguntas` / `list_comedores` / `listar_usuarios` y resuélvelo por nombre o coincidencia parcial (case-insensitive). El usuario habla por nombre, tú traduces a UUID.
- **Si el usuario confirma ("hazlo", "sí", "adelante") y ya hay contexto suficiente, ACTÚA.** No vuelvas a pedir aclaraciones que ya están implícitas.
- **Solo pide aclaración si hay ambigüedad real** (ej: dos comedores con nombre parecido, o una orden destructiva sin scope claro). Aun así, ofrece la opción más probable y di "voy a hacer X salvo que me digas lo contrario".
- **Operaciones masivas:** descompón en varias llamadas a `execute_mutation` en el MISMO turno. Ej: "asignar todas las preguntas solo al comedor Testing" → primero `list_preguntas` + `list_comedores`, luego una llamada `asignar_pregunta_comedores` por pregunta con `modo: "reemplazar"` y `comedor_ids: [testing_id]`. El UI las apilará como tarjetas de aprobación.
- **Ejemplos few-shot** dentro del prompt mostrando el flujo correcto (usuario pide algo vago → assistant llama tools de lectura → propone mutaciones sin volver a preguntar).

### 2. Soportar múltiples mutaciones pendientes por turno (`admin-assistant/index.ts`)

Hoy el loop sale al primer `execute_mutation`. Cambiar a:

- Recolectar **todas** las `execute_mutation` del turno en un array `pending[]`.
- Devolver `{ status: "pending_approval", pending: [...] }` (array) cuando haya ≥1.
- El cliente (`src/app/admin/asistente/page.tsx`) renderiza una tarjeta por cada propuesta, con botones "Aprobar todo" / "Aprobar" / "Rechazar".

### 3. Endpoint apply en lote (`admin-assistant-apply/index.ts`)

Aceptar `{ pending: [...] }` además del singular actual, y aplicarlas en orden, devolviendo un array de resultados. Mantener compatibilidad con el formato viejo.

### 4. UI: tarjeta multi-aprobación (`src/app/admin/asistente/page.tsx`)

- Render de lista de tarjetas pendientes.
- Botón principal "Aprobar las N acciones".
- Cada tarjeta con su propio "Rechazar" individual.
- Mensaje de éxito resume cuántas se ejecutaron.

### 5. Pequeñas mejoras de tools

- `list_preguntas` y `list_comedores`: añadir parámetro opcional `nombre_contiene` (filtro server-side) para que el modelo gaste menos tokens cuando ya sabe el nombre.

## Qué NO se toca

- Esquema de DB (sin migración).
- `_shared/admin-assistant-mutations.ts` (lógica de mutaciones queda igual).
- Auth y RLS.
- Resto del panel admin.

## Resultado esperado

Flujo "haz que las preguntas solo estén en el comedor Testing":

1. Usuario manda el mensaje.
2. Assistant llama `list_comedores(nombre_contiene: "Testing")` → 1 resultado.
3. Llama `list_preguntas()` → N preguntas.
4. Emite N `execute_mutation` tipo `asignar_pregunta_comedores` con `modo: reemplazar`, `comedor_ids: [testing_id]`.
5. UI muestra "N acciones pendientes" + botón "Aprobar todas".
6. Admin aprueba una vez, todo se ejecuta.

Sin ida y vuelta, sin pedir UUIDs, sin gastar créditos en preguntas innecesarias.

## Alternativa si prefieres ahorrar

Si crees que aun así el asistente seguirá consumiendo demasiados créditos para lo que aporta, dilo y en lugar de este plan **elimino completamente** la feature: ruta, sidebar item, edge functions, tabla `assistant_actions` (migración de drop), y la entrada en `App.tsx`. Recuperas todos los créditos futuros y el panel queda más limpio.  
  
Aplica los cambios, hago testing y verifico.

&nbsp;