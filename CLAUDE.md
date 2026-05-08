# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Aura ID is a Spanish-language facial-recognition access control system built on Next.js 15 (App Router) + React 19. Users enroll employees with a face photo, then employees check in / check out at a kiosk via face match + AWS Rekognition liveness detection. Admins view reports.

User-facing strings, comments, and log messages are in Spanish — preserve that when editing.

## Commands

```bash
npm run dev      # next dev (http://localhost:3000)
npm run build    # next build
npm run start    # production server
npm run lint     # next lint (ESLint flat config)
```

There is no test runner configured in this repo.

## Architecture

### Three actors, enforced by middleware
[middleware.ts](middleware.ts) is the source of truth for access control. It runs on every non-API path and reads `users.role` + `users.is_kiosk` + `users.lock_session` from Supabase to decide redirects:

- `admin` — full access, including `/register`, `/reports`, `/admin/*` (the `adminOnlyPaths` list).
- `user` — standard authenticated user; can use `/access` and the home page.
- kiosk (`is_kiosk = true`) — locked to `/access` only; any other path redirects back to `/access`. `lock_session = true` hides the logout button (see [contexts/AuthContext.tsx](contexts/AuthContext.tsx) `canLogout`).

Public paths: `/`, `/login`, `/auth/callback`, `/auth/handle-session`, `/kiosk-login`. When changing route protection, update `publicPaths` / `adminOnlyPaths` in middleware **and** the `roles` filter in [components/Header.tsx](components/Header.tsx) so the nav matches the guard.

### Auth flow (Supabase)
Three Supabase clients, used in different contexts — don't cross them:
- [lib/supabase.ts](lib/supabase.ts) — `createBrowserClient` for client components.
- [lib/supabase-admin.ts](lib/supabase-admin.ts) — service-role client; **server-only**, used by API routes that need to bypass RLS (employees, access logs, kiosk creation).
- [middleware.ts](middleware.ts) — `createServerClient` with cookie adapter, used only by middleware.

`AuthContext` calls `supabase.auth.getUser()` (not `getSession()`) on mount and on every `onAuthStateChange` to validate against the server. Sign-up does **not** auto-login — it calls `/api/auth/signup` which creates the user via the admin client and sends a confirmation email through Resend ([lib/resend.ts](lib/resend.ts)); user must confirm before signing in.

### Route layout
- [app/layout.tsx](app/layout.tsx) — root layout, wraps everything in `AuthProvider`.
- [app/(with-header)/](app/(with-header)/) — route group that adds `Header` + `Footer`. Contains `/` (home), `/access`, `/register`, `/reports`, `/admin/kiosks`, `/admin/migrate`. Kiosk users render `null` for the header (see Header.tsx:17), giving them a chrome-less kiosk UI.
- [app/login/](app/login/), [app/auth/callback/](app/auth/callback/), [app/auth/handle-session/](app/auth/handle-session/) — sit outside the header group.
- [app/api/](app/api/) — server routes; the API path prefix is excluded from middleware via the matcher.

### Face recognition pipeline
[lib/rekognition.ts](lib/rekognition.ts) wraps AWS Rekognition. The collection ID comes from `AWS_REKOGNITION_COLLECTION_ID` (defaults to `EmployeesFaces`). Important detail: the Rekognition client is `null` in the browser (`typeof window === 'undefined'` guard) — only call these functions from API routes.

The link between Rekognition and Supabase is `employees.face_data`, which stores the Rekognition `FaceId`. The check-in/out flow ([app/api/access/register/route.ts](app/api/access/register/route.ts)):
1. `searchFacesByImage` (threshold 80%) → returns a `FaceId`.
2. Look up `employees` by `face_data = FaceId`.
3. Insert into `access_logs` with `type` = `check_in` | `check_out`.
4. **Auto-close logic**: if the last log is a `check_in` from a previous Bogotá day (`America/Bogota` timezone) and the current request is also `check_in`, the route inserts a synthetic `check_out` at `23:59:59-05:00` of the previous day with `auto_generated = true` before recording the new check-in. Same-day duplicate `type` returns 400. Preserve this behavior — reports rely on it.

Liveness uses `@aws-amplify/ui-react-liveness`. [app/api/liveness/create-session/route.ts](app/api/liveness/create-session/route.ts) creates an AWS face-liveness session; `aws-exports.js` configures the Amplify Identity Pool used by the client component to talk to Rekognition directly. Sessions intentionally omit `OutputConfig` so liveness frames are not stored in S3.

### Logging
Use [lib/logger.ts](lib/logger.ts) for new code — `logger.log/info/warn/debug` are silent in production; `logger.error` always logs. Existing API routes still use raw `console.log` with emoji prefixes; migrating them is fine but not required for unrelated changes.

## Environment variables

Required for full functionality (set in `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, used by supabase-admin
NEXT_PUBLIC_SITE_URL=               # used in email confirmation links

AWS_REGION=                         # server-side Rekognition/S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REKOGNITION_COLLECTION_ID=      # defaults to "EmployeesFaces"
AWS_KMS_KEY_ID=                     # optional, for liveness session

NEXT_PUBLIC_AWS_REGION=              # client Amplify (liveness)
NEXT_PUBLIC_AWS_IDENTITY_POOL_ID=

RESEND_API_KEY=                      # signup confirmation emails
```

`from` address in [lib/resend.ts](lib/resend.ts) is hardcoded to `hello@auraid.co`.

## Conventions

- Path alias `@/*` resolves to repo root (see [tsconfig.json](tsconfig.json)).
- Strict TypeScript is on; ESLint enforces `no-unused-vars` but allows `_`-prefixed names ([eslint.config.mjs](eslint.config.mjs)).
- Tailwind v3 with custom colors `#014F59` (dark teal) and `#00BF71`/`#00DD8B` (greens) — the brand palette.
- Timezones: anything user-facing or stored against a "day" must use `America/Bogota`. See the auto-close logic above for the pattern.
