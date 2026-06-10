## Plan: arreglos de encuesta + flujo de PIN para kiosko

### 1. Modal "Editar pregunta" no scrolleable

En `src/app/admin/questions/page.tsx`, el `DialogContent` del modal de crear/editar (línea ~483) no tiene altura máxima ni scroll. En pantallas pequeñas el footer con "Guardar" queda fuera de vista.

- Cambiar `className="sm:max-w-[520px]"` a `className="sm:max-w-[520px] max-h-[90vh] flex flex-col"` y envolver el cuerpo en un contenedor con `overflow-y-auto` para que el footer quede siempre visible (mismo patrón que ya usa el modal de IA).

### 2. Confirmación al eliminar reportes

En `src/app/admin/reports/page.tsx` no existe el botón de eliminar.

- Agregar botón "Eliminar" (icono `Trash2`, variante destructiva) en la columna de acciones.
- Abrir un `AlertDialog` con mensaje "¿Seguro que deseas eliminar este reporte? Esta acción no se puede deshacer."
- Al confirmar: `supabase.from("reportes").delete().eq("id", id)` y refrescar la lista.

### 3. Quitar "Salir del kiosko" de `/survey/:slug`

En `src/app/public-survey/[slug]/page.tsx` (líneas 462-468) se renderiza un link "Salir del kiosko" en la pantalla de bienvenida.

- Eliminar ese bloque completo. La única forma de salir será el flujo de PIN del punto 6.

### 4. Error "No pudimos guardar la encuesta"

La encuesta hace `INSERT` directo a `encuestas` y `respuestas` desde el cliente anónimo. La policy actual de `encuestas_insert_public` valida `comedor_id` activo, pero la policy de `respuestas_insert_public` valida que `pregunta_id` pertenezca a una pregunta activa **vinculada al comedor vía `comedor_preguntas**`. La RPC `get_next_survey_questions` retorna sólo preguntas que cumplen ese join, así que el insert debería funcionar — el error real hay que diagnosticarlo.

- Investigar: revisar `console.error` en el navegador y los logs de Postgres durante un submit fallido para identificar la policy/columna que rechaza.
- Causa probable: falta `GRANT INSERT ON public.encuestas TO anon` o `GRANT INSERT ON public.respuestas TO anon` después del endurecimiento de seguridad reciente. Si es eso, migración para re-otorgar los grants mínimos a `anon` (sin tocar las policies de validación).
- Alternativa más limpia: mover el insert a una edge function pública (`submit-survey-v2`) que use service role tras validar inputs con Zod — elimina dependencia de policies anon.

### 5. Animación full-screen de agradecimiento + reset

En `src/app/public-survey/[slug]/page.tsx`, la pantalla `done` actual muestra un círculo verde y un contador; el reset llama `setStep(0)` pero NO recarga la rotación de preguntas, así que se queda con el mismo poll.

- Reemplazar la pantalla `done` por un overlay fixed inset-0 con fondo `bg-brand` / gradiente, ícono animado (`scale-in` + `fade-in`), mensaje grande "¡Gracias por tomarte el tiempo de responder la encuesta! Apreciamos tu feedback." y subtexto.
- Mantener el contador (3-5 s) y al terminar:
  - Volver a llamar `supabase.rpc("get_next_survey_questions", { p_comedor_id })` para obtener el siguiente poll rotado.
  - Resetear `answers`, `step` y `done`.

### 6. PIN de 4 dígitos para salir del kiosko + setup desde dashboard cliente

**Backend (migración):**

- Agregar columna `kiosk_exit_pin TEXT` (hash, 4 dígitos) a `usuario_comedores` (PIN por asignación comedor-cliente) — o más simple: columna `kiosk_exit_pin_hash` en `comedores`, definida por el cliente dueño.
- Policy para que el cliente con `user_has_comedor(auth.uid(), comedor_id)` pueda `UPDATE` sólo esa columna; admins también.
- Función SQL `verify_kiosk_pin(p_comedor_id uuid, p_pin text) returns boolean` security definer que compare el hash (usar `crypt`/`pgcrypto` o sha256).

**Dashboard cliente (`/cliente/encuesta`):**

- Reestructurar la página: dos botones por comedor — "Abrir encuesta" y "Configurar PIN".
- "Configurar PIN" abre un modal con input numérico de 4 dígitos (`InputOTP`) y guarda el hash.
- Antes de renderizar el botón "Abrir encuesta" para un comedor, consultar si ese comedor tiene PIN configurado. Si no tiene, deshabilitar el botón con tooltip "Configura un PIN primero".

**Acceso directo a `/survey/:slug`:**

- Al cargar la página, si el `comedor.kiosk_exit_pin_hash` es `NULL`, mostrar un `Dialog` modal a pantalla completa (no cerrable) con título "Configura un PIN primero", mensaje "El cliente debe configurar el PIN de salida desde el dashboard antes de usar este kiosko." y único botón "Volver" que navega a `/`.
- Eliminar el link "Salir del kiosko" (ya cubierto en punto 3).
- Reemplazar la flecha back actual (que sólo va a la pregunta anterior) por una flecha que:
  - Si `step > 1`: retrocede una pregunta (comportamiento actual).
  - Si `step === 1` (o un nuevo botón "Salir" arriba a la izquierda): abre un `Dialog` con `InputOTP` de 4 dígitos. Al someter, llama a `verify_kiosk_pin`. Si OK → navega a `/`. Si falla → toast de error, contador de intentos (bloquear 30 s tras 5 fallos).

**Persistencia de la barrera:** mientras `step >= 1`, no debe existir ninguna otra forma de salir desde la UI (sin links, sin "modo demo" visible salvo el tap secreto 5x al logo, que se conserva para presentaciones).

### Archivos a modificar

- `src/app/admin/questions/page.tsx` — modal scrolleable
- `src/app/admin/reports/page.tsx` — botón + AlertDialog eliminar
- `src/app/public-survey/[slug]/page.tsx` — quitar "Salir del kiosko", animación gracias, reset de poll, guard de PIN no configurado, modal de PIN para salir, fix submit
- `src/app/cliente/encuesta/page.tsx` — configurar PIN por comedor, botón deshabilitado si falta PIN
- nueva migración SQL — columna `kiosk_exit_pin_hash` en `comedores`, función `verify_kiosk_pin`, policy de UPDATE para cliente dueño
- (posible) nueva edge function `submit-survey-v2` si el grant a `anon` no es viable

### Decisiones que necesito confirmar

1. **Alcance del PIN**: ¿uno por comedor (lo que propongo) o uno global por cliente? Si un cliente tiene 3 comedores, ¿comparten PIN o cada quiosco tiene el suyo? Uno global por cliente
2. **Política de intentos fallidos**: ¿bloquear 30 s tras 5 intentos te parece bien o prefieres otro límite? Bloquea 30s tras 5 intentos fallidos
3. **Submit fallido**: ¿prefieres que primero diagnostique con logs y arregle grants (más rápido), o que mueva todo a una edge function (más seguro a largo plazo)? El que sea mejor a largo plazo.
  &nbsp;