## Diagnóstico

En `src/app/public-survey/[slug]/page.tsx`, el `useEffect` que carga la encuesta usa un `Promise.all([...])` con dos RPCs (`get_next_survey_questions` y `comedor_has_kiosk_pin`). Si **cualquiera** de las dos promesas se rechaza (excepción de red, fetch interrumpido por re-render/StrictMode, refresh de token simultáneo, etc.), la función async lanza sin handler y **`setLoading(false)` nunca corre** → spinner infinito.

Además, el RPC `comedor_has_kiosk_pin` se invoca con `rpcAny` (cast), y si el método retorna `{ data: null, error: ... }` por algún motivo, hoy se interpreta como "PIN no configurado" en lugar de mostrar un error claro.

El flujo del cliente autenticado que clickea "Abrir" navega a `/survey/:slug` siendo cliente con sesión activa — la página originalmente fue diseñada como pública y no maneja bien algunos timings con la sesión.

## Cambios

### 1. `src/app/public-survey/[slug]/page.tsx` — hacer la carga resiliente

- Envolver TODA la lógica del `useEffect` en un `try/catch/finally` que garantice `setLoading(false)` siempre.
- Reemplazar `Promise.all([...])` por `Promise.allSettled([...])` para que un fallo en `comedor_has_kiosk_pin` no impida cargar las preguntas (y viceversa).
- Manejar cada resultado individualmente:
  - Si `get_next_survey_questions` falló → `setPreguntas([])` y mostrar toast de error.
  - Si `comedor_has_kiosk_pin` falló o devolvió `null` → tratar como "estado desconocido" pero **no** bloquear con el modal de PIN (solo bloquear cuando explícitamente devuelve `false`).
- Loggear el error real a consola para poder diagnosticar futuras regresiones.

### 2. (Opcional) Forzar firma de sesión limpia para el kiosko

Si el cliente sigue autenticado en el dispositivo, sus headers de autorización viajan en cada RPC y eso puede gatillar refresh de tokens que retrase la respuesta. Como el kiosko está pensado para uso público y el cliente ya cerró sesión al entregar el dispositivo, agregar un botón "Iniciar modo kiosko" no aplica aquí, pero el `try/finally` del paso 1 cubre el caso de timing.

### 3. Verificación

Después de aplicar:
- Reproducir: login como cliente → configurar PIN → click "Abrir" → la página debe mostrar la pantalla de bienvenida en < 2 s, nunca el spinner permanente.
- Si por alguna razón los RPCs fallan, el usuario verá un toast con el error y la pantalla "Comedor no encontrado" o la encuesta con 0 preguntas en vez de un spinner infinito.

## Archivos a tocar

- `src/app/public-survey/[slug]/page.tsx` (solo el `useEffect` de carga inicial).

No requiere migraciones ni cambios en edge functions.