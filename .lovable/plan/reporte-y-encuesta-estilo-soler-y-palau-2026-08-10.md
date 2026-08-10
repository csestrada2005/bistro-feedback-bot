# Reporte y encuesta estilo Soler y Palau

Dos cambios, ambos limitados al comedor **Comedor S&P (Soler y Palau)** (slug `sp`). Los otros 15 comedores siguen exactamente igual.

## Tarea 1 — PDF del reporte con el formato de la presentación S&P

El PDF de referencia es una presentación horizontal con esta estructura, que se replicará:

```text
Portada        Encuesta Comedor <mes/año> · nombre del comedor · rango de fechas
Objetivo       texto de objetivo + tabla de escala (5 estrellas..1 estrella) +
               total de encuestas y % de participación
Una lámina     título "N. ¿PREGUNTA?" + gráfica de pastel con % por
por pregunta   calificación (5,4,3,2,1) + tabla de escala con estrellas
Incidentes     "¿Has tenido algún incidente?" NO/SI en % + tabla
               INCIDENTE / NO. ordenada de mayor a menor
Propuestas     "¿Qué propones para mejorar el servicio?" tabla PROPUESTAS / NO.
Menú           "Propuestas de menú (plato fuerte)" tabla PROPUESTAS / NO.
Cierre         "¡Gracias!"
```

Detalles:
- Formato horizontal (A4 landscape), estilo rojo/blanco de la referencia, marca del cliente en la portada y folio + dominio en el pie de cada lámina.
- Las gráficas de pastel se dibujan como vectores dentro del PDF (no imágenes), con etiqueta de porcentaje y estrellas por segmento.
- Los porcentajes salen de las respuestas reales del rango de fechas del reporte; cada lámina indica cuántas respuestas la sustentan.
- Se agrega un campo opcional de "total de personal" por comedor para poder calcular el "% de participación" de la lámina de objetivo. Si está vacío, esa línea se omite.
- Este formato se aplica solo cuando el comedor tiene la plantilla S&P asignada; los demás comedores conservan el PDF actual. El botón de descarga es el mismo en `/admin/reports` y en la vista de cliente: elige la plantilla automáticamente.

### Agrupación de comentarios con IA
Las tablas de incidentes, propuestas y menú necesitan categorías con conteos (ej. "CABELLO/PELO EN LA COMIDA — 88"). Se añade una función de servidor que:
1. Recibe los comentarios del rango del reporte agrupados por tipo (incidentes, mejoras, menú).
2. Usa Lovable AI para normalizar y agrupar en categorías en MAYÚSCULAS con su conteo.
3. Guarda el resultado en el reporte, para que descargar el PDF varias veces no vuelva a gastar IA ni cambie los números.

Si la IA falla o no hay crédito, el PDF se genera con las tablas en modo textual y un aviso visible en la lámina.

## Tarea 2 — Preguntas de la encuesta de S&P

Se cargan las 13 preguntas de la foto como el pool exclusivo de S&P, en este orden:

1. ¿Cómo consideras el sabor de la comida?
2. ¿Cómo consideras la calidad de los alimentos?
3. ¿Cómo consideras el sabor y calidad del plato fuerte?
4. ¿Qué tan buena es la variedad del menú?
5. ¿Cómo consideras la porción de los alimentos?
6. ¿Cómo calificas el agua de sabor en el comedor?
7. ¿Cómo consideras el tiempo de servicio en el comedor?
8. ¿Cómo consideras la variedad y calidad del postre?
9. ¿Cómo consideras la temperatura de los alimentos?
10. ¿Cómo consideras la limpieza de los utensilios (platos, cucharas, tenedores, etc.)?
11. ¿Cómo consideras la limpieza del área?
12. ¿El personal cumple con las medidas de higiene visible al servir los alimentos (guantes y cubrebocas)?
13. ¿Cómo consideras el trato del personal del comedor?

Más las tres del cierre del reporte: incidente (sí/no, con detalle cuando responde "no"), propuestas de mejora y propuestas de menú.

Comportamiento:
- Se mantiene la rotación: cada sesión muestra 5 preguntas y va avanzando por el pool, tal como funciona hoy.
- Las 12 preguntas genéricas que hoy están asignadas a S&P se desasignan (siguen disponibles para el resto de comedores).
- **Escala de 5 niveles solo en S&P**: 5 Muy bueno · 4 Bueno · 3 Regular · 2 Malo · 1 Deficiente, mostradas de mejor a peor con estrellas. El resto de comedores conserva las 4 opciones actuales.

## Detalles técnicos

- Migración: `comedores` gana `plantilla_reporte` (`estandar` | `sp`), `escala_niveles` (4 | 5) y `total_personal` (opcional); `reportes` gana una columna jsonb para las agrupaciones cacheadas. Se marca S&P con plantilla `sp` y escala 5.
- Migración de datos: insertar las 13 preguntas + 3 de cierre como preguntas propias de S&P, vincularlas en `comedor_preguntas`, quitar las 12 vinculaciones genéricas y reiniciar `rotation_offset`.
- `src/app/public-survey/[slug]/page.tsx`: la escala se construye desde `escala_niveles` del comedor (5 niveles con estrellas para S&P, 4 actuales para el resto); se guarda `valor_numerico` 1–5.
- Nueva plantilla `src/lib/pdf/SPReportTemplate.tsx` con `@react-pdf/renderer` en landscape y un helper de pastel en SVG; `generateReportPdf.ts` selecciona plantilla según `plantilla_reporte` y calcula la distribución porcentual por calificación además de los promedios actuales.
- Nueva edge function `group-comments` (AI Gateway con `google/gemini-3.6-flash`, verificación de JWT de admin como el resto de funciones), invocada al generar/actualizar el reporte y cacheada en `reportes`.
- Las nuevas columnas de `comedores` se leen a través de la función/vista admin existente para no exponer datos a usuarios anónimos.

## Verificación

- Responder la encuesta de `sp` y comprobar que la escala muestra 5 niveles y rota de 5 en 5.
- Generar un reporte de S&P y revisar el PDF lámina por lámina (portada, objetivo, 13 gráficas, incidentes, propuestas, menú, gracias) sin texto cortado ni traslapes.
- Comprobar que un comedor distinto (ej. Telcel Reforma) sigue con encuesta de 4 opciones y PDF actual.