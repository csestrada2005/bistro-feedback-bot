## Objetivo
El rol `cliente` representa al **dueño de todos los comedores** (no de uno solo). Debe ver los reportes publicados de TODOS los comedores, sin estar atado a un `comedor_id`.

## Cambios en base de datos

1. **RLS de `reportes` para cliente** — reemplazar la policy actual `reportes_select_cliente`:
   - Antes: `rol = 'cliente' AND comedor_id = current_user_comedor() AND estado = 'publicado'`
   - Después: `rol = 'cliente' AND estado = 'publicado'` (sin filtro por comedor → ve todos los publicados)

2. **`usuarios.comedor_id` para clientes**: queda como `NULL` (ya es nullable). El cliente no necesita comedor asignado.

3. No se toca el resto de policies (admin/operador siguen igual).

## Cambios en frontend

1. **`/cliente/reportes`** (lista): mostrar columna "Comedor" para que el cliente sepa de qué comedor es cada reporte publicado. Añadir filtro/selector por comedor (opcional, dropdown con todos los comedores que tengan al menos un reporte publicado).

2. **`/cliente/reportes/:id`** (detalle): mostrar el nombre del comedor en el encabezado del reporte.

3. **`ClienteLayout`**: el saludo / sidebar no asume un comedor específico; muestra "Vista cliente — todos los comedores".

4. **Login redirect**: sin cambios (cliente → `/cliente/reportes`).

5. **Creación de usuarios cliente** (si existe UI en `admin-users`): permitir crear cliente sin tener que elegir comedor (campo opcional / oculto para rol cliente).

## Fuera de alcance
- No se cambia la lógica de admin ni operador.
- No se modifica el flujo de generación / publicación de reportes.
- No se cambian tablas de respuestas / encuestas.
