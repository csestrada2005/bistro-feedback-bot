## Alcance

En la base solo existe un comedor que coincide: **Comedor S&P (Soler y Palau)** (`id 6ec66cf8…`). El comedor se conserva; solo se borran sus datos generados.

Datos a eliminar (verificados):
- **24 encuestas** del comedor
- **94 respuestas** vinculadas a esas encuestas
- **8 reportes** del comedor (todos están en estado `borrador`, así que ninguno cliente los ve todavía)

Se conserva:
- El registro del comedor y su configuración (`comedor_preguntas`, `usuario_comedores`, PIN, slug, etc.)
- Preguntas del pool global.

## Pasos

1. Borrar `respuestas` cuyo `encuesta_id` pertenezca a encuestas del comedor S&P.
2. Borrar `encuestas` del comedor S&P.
3. Borrar `reportes` del comedor S&P (los 8 borradores). Esto también elimina cualquier PDF referenciado por esas filas.
4. Borrar del bucket privado `pdf-reports` los archivos bajo el prefijo `6ec66cf8-b081-4ea9-9f07-1cd656330a94/` si existen, para no dejar PDFs huérfanos.
5. Resetear `rotation_offset = 0` en `comedores` para que el pool de preguntas vuelva a empezar en limpio.

Todo se ejecuta en una sola operación de datos para que sea atómico.

## Nota

No se encontró un comedor "Soler" separado de "Palau"; ambos están juntos como un único comedor "S&P". Si en realidad te referías a dos comedores distintos, dime los nombres exactos y ajusto el plan antes de ejecutar.