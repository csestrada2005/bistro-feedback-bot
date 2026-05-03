# Plan: Connect Kiosk to Lovable Cloud

## 1. Enable Lovable Cloud
Activate the backend so we get Postgres, Auth, Edge Functions, and the auto-generated Supabase client at `src/integrations/supabase/client.ts`.

## 2. Database schema (migration)

Create enums:
- `app_role`: `cafeteria_admin`, `hr_viewer`
- `trend_answer`: `peor`, `igual`, `mejor`
- `recommend_answer`: `no`, `tal_vez`, `si`
- `comment_moderation_status`: `pending`, `approved`, `archived`, `deleted`
- `question_kind`: `scale_5`, `trend_3`, `recommend_3`, `comment`

Tables (all with RLS enabled):

**`user_roles`** — `(id, user_id → auth.users, role app_role, created_at)`, unique `(user_id, role)`.

**`questions`** — `(id, order_num int, question_text text, question_type question_kind, is_active bool default true, updated_at, updated_by uuid)`.

**`daily_menus`** — `(id, date date unique, main_dish text, side_dish text null, notes text null, created_by uuid, created_at)`.

**`surveys`** — fields per spec: scores 1–5 with CHECK, `question_3_trend`, `question_4_recommend`, `comment text null` (length ≤ 200 CHECK), `comment_status` default `pending`, `response_time_ms int`, `device_fingerprint text not null`, `daily_menu_id uuid null → daily_menus`, `is_flagged bool default false`, `created_at`. Index on `(device_fingerprint, created_at desc)` for fast cooldown lookup.

**`pdf_reports`** — `(id, generated_at, period_start, period_end, generated_by uuid, pdf_url text)`.

Security definer function `public.has_role(_user_id uuid, _role app_role) returns bool` (avoids recursive RLS — see knowledge rule).

## 3. RLS policies

| Table | Policy |
|---|---|
| `surveys` | INSERT: `to anon, authenticated` with `true` (kiosk submits). SELECT/UPDATE/DELETE: only `has_role(auth.uid(),'cafeteria_admin')`. |
| `daily_menus` | ALL: `has_role(auth.uid(),'cafeteria_admin')`. SELECT also allowed for `anon` so kiosk/edge can resolve today's menu (read-only). |
| `questions` | SELECT: `to anon, authenticated using (true)`. INSERT/UPDATE/DELETE: `cafeteria_admin` only. |
| `user_roles` | No policies → only `service_role` (which bypasses RLS) can manage. Authenticated users may SELECT their own row to enable client-side role checks. |
| `pdf_reports` | ALL for `cafeteria_admin`. SELECT for `hr_viewer`. |

## 4. Edge Functions

Both deployed with `verify_jwt = false` in `supabase/config.toml` (kiosk is anonymous). Use service role key inside the function for inserts/lookups; validate input with zod; standard CORS headers.

### `supabase/functions/submit-survey/index.ts`
Body schema (zod):
```
{ q1: 1..5, q2: 1..5, q3: 'peor'|'igual'|'mejor',
  q4: 'no'|'tal_vez'|'si', comment?: string<=200,
  response_time_ms: int>=0, device_fingerprint: string }
```
Logic:
1. Parse + validate → 400 `INVALID_INPUT` on failure.
2. Time-of-day check using `America/Mexico_City` (configurable constants `SERVING_START=12`, `SERVING_END=15`). If outside → 403 `OUTSIDE_HOURS`.
3. Cooldown: query `surveys` for newest row with same `device_fingerprint`. If `< 4h` ago → 429 `COOLDOWN_ACTIVE` with `retry_after_seconds`.
4. Compute `is_flagged = response_time_ms < 3000` OR all answers identical extreme (1/1 or 5/5).
5. Look up today's `daily_menus` row (date = today in MX TZ); attach `daily_menu_id` if present.
6. Insert with `comment_status = 'pending'`.
7. Return `{ ok: true, id, is_flagged }`.

Error response shape: `{ error: { code, message, ...meta } }`.

### `supabase/functions/get-public-questions/index.ts`
- GET → returns `questions` where `is_active = true` ordered by `order_num`.
- Selects only fields the kiosk needs: `id, order_num, question_text, question_type`.

## 5. Seed data (insert tool, not migration)
Insert the 4 active questions matching the kiosk copy from prompt 1 so `get-public-questions` returns real data. (Kiosk UI keeps its hardcoded emojis/labels; questions table drives ordering and text.)

## 6. Client wiring (no UI changes)

- Add `src/lib/fingerprint.ts`: stable device fingerprint stored in `localStorage` (`crypto.randomUUID()` on first run). Returned synchronously.
- Add `src/lib/api.ts`:
  - `fetchPublicQuestions()` → `supabase.functions.invoke('get-public-questions')`
  - `submitSurvey(payload)` → `supabase.functions.invoke('submit-survey', { body })`
- Update `src/pages/Survey.tsx`:
  - Track `startedAt = performance.now()` on mount; compute `response_time_ms` at submit.
  - On final "Enviar" / "Saltar": call `submitSurvey` with answers + comment + fingerprint.
  - Map error codes to friendly toast messages (`COOLDOWN_ACTIVE` → "Ya registramos tu opinión hoy 🙏", `OUTSIDE_HOURS` → "El comedor está cerrado ahora", others → genérico). Still navigate to thank-you on success.
  - Keep all current UI/animations untouched.
- `src/pages/Index.tsx`: unchanged.

## 7. Out of scope (future prompts)
Admin login, dashboard, moderation UI, PDF generation, AI analysis, configurable hours UI. Schema and RLS already prepared for them.

## Technical notes
- Migration is one SQL file; enums + tables + function + policies in correct order.
- `has_role` uses `SECURITY DEFINER` and `SET search_path = public` per knowledge guidance.
- `surveys.device_fingerprint` is opaque (UUID) — no PII collected, satisfying the anonymity guardrail.
- Edge functions never trust client time; they use `Date` server-side with explicit MX timezone via `Intl.DateTimeFormat`.
- Cooldown enforced server-side only (frontend doesn't precheck) — matches business rule #3.
