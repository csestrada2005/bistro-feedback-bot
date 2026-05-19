# HANDOFF — Sistema de Encuestas Main Catering

**Fecha de entrega:** 3 de junio  
**Contacto soporte:** j.cuatrecasas@nebustudio.com

---

## 1. URLs

- **Panel admin:** `https://<TU-DOMINIO>/admin`  
  (Domain temporal de Lovable: `https://<id>.lovable.app/admin` — se actualizará al publicar y conectar `app.maincatering.com`)
- **Encuesta S&P (pública, sin login):** `https://<TU-DOMINIO>/survey/sp`
- **Reportes históricos:** `https://<TU-DOMINIO>/admin/reports`

> Para conectar `app.maincatering.com`: Lovable → Project Settings → Domains → Connect Domain. SSL se aprovisiona automáticamente. Compresión gzip/brotli activas por defecto en el hosting de Lovable.

---

## 2. Credenciales iniciales

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin (Nebustudio) | j.cuatrecasas@nebustudio.com | _[definir en primer login con "¿Olvidaste tu contraseña?"]_ |
| Admin (Main Catering) | _[email pendiente]_ | _[definir al crear]_ |

**Primer login:**
1. Ir a `/admin/login`.
2. Click en "¿Olvidaste tu contraseña?" → ingresar email → recibirás link.
3. Definir contraseña nueva.

---

## 3. Cómo agregar un nuevo comedor

1. Entrar a Lovable Cloud → **Database → Tables → `comedores`**.
2. Click **Insert row** y rellenar:
   - `slug`: identificador corto en URL (ej. `telcel`). Sin espacios, minúsculas.
   - `nombre`: nombre visible (ej. `Comedor Telcel Insurgentes`).
   - `empresa_cliente`: nombre del cliente corporativo (ej. `Telcel`).
   - `activo`: `true`.
3. La encuesta queda disponible en `/survey/{slug}`.
4. (Opcional) Duplicar las 16 preguntas seed para ese comedor desde **/admin/questions** o asignar `comedor_id` en `preguntas`.

---

## 4. Cómo agregar un nuevo usuario admin

1. Lovable Cloud → **Users → Add user** → email + contraseña temporal → **Create**.
2. Copiar el `user_id` que aparece.
3. Database → Tables → `usuarios` → **Insert row**:
   - `id`: pegar el `user_id` del paso 2.
   - `nombre`: nombre del usuario.
   - `rol`: `admin` (o `operador` si solo debe ver un comedor).
   - `comedor_id`: dejar vacío para admin; asignar comedor para operador.
4. El usuario ya puede entrar en `/admin/login`.

---

## 5. Cómo cambiar la API key de Claude (Anthropic)

1. Lovable Cloud → **Edge Functions → Secrets**.
2. Buscar `ANTHROPIC_API_KEY` → **Edit** → pegar nueva key → **Save**.
3. No requiere redeploy: las funciones la leen en cada invocación.

Las funciones que la usan: `suggest-questions`, `analyze-responses`.

---

## 6. Variables de entorno

**Frontend (auto-inyectadas por Lovable, no se tocan):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Backend (Edge Function secrets):**
- `ANTHROPIC_API_KEY` ✅ configurada
- `LOVABLE_API_KEY` ✅ configurada
- `SUPABASE_SERVICE_ROLE_KEY` ✅ auto-gestionada

> Nota: el stack es **Vite + React**, no Next.js. Las variables empiezan con `VITE_`, no `NEXT_PUBLIC_`.

---

## 7. Limitaciones conocidas

- **Rate limit IA:** 1 análisis cada 60 segundos por usuario admin.
- **Mínimo para análisis IA:** se requieren ≥5 encuestas en el rango seleccionado.
- **PDF:** generación client-side (~3-5s para 50-100 encuestas). Si supera 200 encuestas puede tardar más.
- **Export CSV:** límite recomendado 5.000 filas para evitar bloqueos del navegador.
- **Auth social:** solo email/password. Google/Apple no configurados (se pueden activar en Cloud → Auth).
- **Modelo IA fijo:** `claude-sonnet-4-20250514`. Cambio requiere editar edge functions.
- **Sin notificaciones por email** de incidentes (roadmap fase 2).

---

## 8. Estado de la base al entregar

- 1 comedor activo: **S&P (Soler y Palau)** — slug `sp`
- 16 preguntas seed activas
- 0 encuestas (datos de prueba borrados)
- 1 usuario admin: Josep Cuatrecasas

---

## 9. Checklist de lanzamiento

Antes de avisar al cliente, verificar manualmente:

- [ ] `/survey/sp` carga en <2s
- [ ] Enviar una encuesta de prueba completa
- [ ] Login admin funciona
- [ ] Dashboard muestra la encuesta de prueba
- [ ] Botón "Analizar con IA" devuelve resumen (requiere ≥5 encuestas)
- [ ] PDF se descarga y abre correctamente
- [ ] Candado SSL verde en el dominio final
- [ ] Vista mobile (375px) y tablet vertical (768px) sin scroll horizontal

**Después de la prueba, borrar las encuestas de test** desde `/admin/responses` (botón eliminar fila).

---

## 10. Soporte

**Josep Cuatrecasas — Nebustudio**  
✉️ j.cuatrecasas@nebustudio.com