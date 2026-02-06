# WhatsApp Personal CRM — Remaining Implementation Plan

This document is the **master plan** for completing the project after Phase 1 (infrastructure and backend structure). Use it to coordinate work and hand off to the **Backend Agent** and **Frontend Agent** (see `docs/agents/`).

**Reference:** Full context, schema, and code snippets are in `docs/implementation-plan.md`.

---

## Current Status (Done)

- **Phase 1.1** — Supabase project created, credentials in env
- **Phase 1.2** — Monorepo created; backend and frontend packages installed; Prisma initialized
- **Phase 1.3** — Backend structure in place:
  - `src/`: `index.ts`, `app.ts`, `config/`, `routes/`, `controllers/`, `services/`, `middleware/`, `utils/`, `types/`
  - Auth, WhatsApp, contacts, messages routes/controllers/services scaffolded
  - Prisma schema: User, WhatsAppSession, Contact, Message, MessageType
- **Phase 1.4** — Backend and frontend `.env` / `.env.local` configured
- **Backend Agent (Phases 2–4, 6, 7)** — Completed; see “Backend Agent — Completed” and “Handoff to Frontend Agent” below.
- **Frontend Agent (Phases 2, 4, 5, 6, 7, 8)** — Completed; see “Frontend Agent — Completed” below.

---

## Backend Agent — Scope

**Owner:** Backend Agent (`docs/agents/backend-agent.md`)

| Phase | Description | Status |
|-------|-------------|--------|
| **DB & migrations** | Make DB ready for dev and prod | ✅ Done — `prisma generate`; initial migration in `prisma/migrations/20250206000000_init/`; `backend/README.md` documents `db:push` (dev) vs `migrate deploy` (prod) |
| **Phase 2** | Authentication | ✅ Done — Register/login/getMe with email/password validation and clear 400/401 errors; JWT + auth middleware working |
| **Phase 3** | Baileys integration | ✅ Done — `baileys.service.ts` hardened (lifecycle, QR, reconnection, logout); message/contact handling wired; `contacts.upsert` / `contacts.update` handlers; minimal logging |
| **Phase 4** | Messages & contacts API | ✅ Done — List messages (limit/offset validation), messages by contact (404 if contact missing); GET/PATCH contacts with 404 and partial-update for notes/tags |
| **Phase 6 (backend part)** | CRM / analytics | ✅ Done — `analytics.service.ts` + routes: `GET /api/analytics/dashboard`, `needs-attention`, `pending-replies`, `contact-stats/:contactId` |
| **Phase 7 (backend)** | Deployment prep | ✅ Done — `backend/Dockerfile` (build, migrate deploy, start); `backend/README.md` Railway checklist: env vars, volume for `SESSION_PATH`, migrations |

**Deliverables:** API supports auth, WhatsApp connect/disconnect/status, contacts CRUD, messages list, and analytics; ready to deploy on Railway.

---

## Backend Agent — Completed (summary)

- **Database:** Initial migration created; README documents `db push` (dev) vs `migrate deploy` (deploy).
- **Auth:** Request validation (email format, password min length); normalized email; clear error messages.
- **Baileys:** Connection lifecycle, QR persistence, reconnection on non-logout close, safe disconnect; incoming messages → `message.service`; contacts from store + `contacts.upsert` / `contacts.update`.
- **Messages & contacts:** Query validation (limit 1–200, offset ≥ 0); 404 for unknown contact on messages-by-contact and PATCH contact.
- **Analytics:** Service + routes under `/api/analytics` (dashboard, needs-attention, pending-replies, contact-stats).
- **Deployment:** Dockerfile; Railway env and volume for `SESSION_PATH` documented in `backend/README.md`.
- **API reference:** `docs/api.md` — full route and response shapes for Frontend Agent.

---

## Frontend Agent — Scope

**Owner:** Frontend Agent (`docs/agents/frontend-agent.md`)

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 2 (frontend)** | Auth UI | ✅ Done — Login/register under `(auth)/login`, `(auth)/register`; Zustand auth store with persist; token in localStorage + rehydrate sync; `ProtectedRoute` redirects unauthenticated users to `/login`; root `/` redirects to `/login` or `/dashboard` |
| **Phase 4 (frontend)** | API client | ✅ Done — `lib/api.ts`: auth, whatsapp, contacts, messages, analytics; axios with JWT from localStorage; 401 interceptor clears token and redirects to login |
| **Phase 5** | App structure & core UI | ✅ Done — Route groups `(auth)` and `(dashboard)`; `(dashboard)/dashboard/*` for `/dashboard`, `/dashboard/contacts`, `/dashboard/contacts/[id]`, `/dashboard/settings`; shared dashboard layout with nav; reusable UI: Button, Input, Card in `components/ui/` |
| **Phase 5** | WhatsApp connection | ✅ Done — Settings page: QR via `qrcode` lib, `ConnectionStatus`, disconnect button; poll status/QR every 3s; refresh QR on demand |
| **Phase 5** | Contacts & messages | ✅ Done — ContactList (search), ContactCard, ContactDetail; MessageThread + MessageBubble; loading and empty states |
| **Phase 6 (frontend)** | Dashboard & CRM | ✅ Done — Dashboard home: needs-attention and pending-replies via `GET /api/analytics/needs-attention` and `pending-replies`; recent conversations from messages API; fallback when analytics 404 |
| **Phase 7 (frontend)** | Deployment | ✅ Done — `docs/frontend-deployment.md`: Vercel root dir `frontend`, env vars (`NEXT_PUBLIC_API_URL` required); app builds and runs with production API URL |
| **Phase 8** | Polish | ✅ Done — Loading spinners, error messages, empty states; responsive layout; contact search on contacts list |

**Deliverables:** Next.js app with auth, dashboard, WhatsApp settings, contacts, message threads, and CRM insights; deployable on Vercel.

---

## Frontend Agent — Completed (summary)

- **Auth UI:** Login and register pages; Zustand auth store with persist; token synced to localStorage for API client; `ProtectedRoute` and root redirect.
- **API client:** `lib/api.ts` — auth, whatsapp, contacts, messages, analytics; JWT on requests; 401 → clear token, redirect to login.
- **App structure:** `(auth)/login`, `(auth)/register`; `(dashboard)/dashboard/` for `/dashboard`, `/dashboard/contacts`, `/dashboard/contacts/[id]`, `/dashboard/settings`; dashboard layout with nav (Home, Contacts, Settings, Log out).
- **WhatsApp:** Settings page with QR (qrcode), connection status, disconnect; status/QR polling.
- **Contacts & messages:** ContactList with search, ContactCard, ContactDetail; MessageThread, MessageBubble; loading and empty states.
- **Dashboard & CRM:** Dashboard home uses analytics (needs-attention, pending-replies) and recent messages; graceful fallback if analytics unavailable.
- **Deployment:** `docs/frontend-deployment.md` — Vercel root `frontend`, `NEXT_PUBLIC_API_URL` and optional Supabase vars.
- **Polish:** Loading/error/empty states, responsive layout, contact search.

---

## Handoff to Frontend Agent

**Status:** Frontend Agent has implemented against the API below; both backend and frontend are complete. The following remains the API reference for maintenance and further work.

**API reference:** `docs/api.md` — use this as the single source for endpoints, request bodies, and response shapes.

**Auth:** `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (Bearer token). Validation errors return `400` with `{ "error": "..." }` (e.g. "Email is required", "Password must be at least 6 characters").

**WhatsApp:** `POST /whatsapp/initialize` (returns `qr` when pairing), `GET /whatsapp/status`, `POST /whatsapp/disconnect`. All require auth.

**Contacts:** `GET /contacts`, `GET /contacts/:id`, `PATCH /contacts/:id` (body: `notes`, `tags`). `404` for unknown contact.

**Messages:** `GET /messages` (query: `limit`, `offset`), `GET /messages/contact/:contactId` (same query; `404` if contact not found). Limit clamped 1–200.

**Analytics (dashboard/CRM):** All under `GET /api/analytics/` with auth:
- `GET /api/analytics/dashboard` — `{ needsAttention, pendingReplies }` (arrays of contacts)
- `GET /api/analytics/needs-attention` — `{ contacts }`
- `GET /api/analytics/pending-replies` — `{ contacts }`
- `GET /api/analytics/contact-stats/:contactId` — `{ contactId, totalMessages, sentByUser, receivedFromContact }` (404 if contact not found)

**CORS:** Backend uses `FRONTEND_URL`; set it to the frontend origin (e.g. `http://localhost:3000` in dev, production URL after deploy).

**After deployment:** Set backend base URL in frontend as `NEXT_PUBLIC_API_URL`; then set backend `FRONTEND_URL` to the frontend URL.

---

## Coordination

1. **API contract** — Backend defines routes and response shapes; Frontend implements against them. **Use `docs/api.md`** for endpoints and response shapes; schema and high-level flow remain in `docs/implementation-plan.md`.
2. **Order of work** — Backend Phases 2–4 and 6–7 are done; Frontend can implement against the live API (local or deployed).
3. **Testing** — Frontend: test against local backend (`NEXT_PUBLIC_API_URL=http://localhost:3001`); later point to Railway backend.
4. **Deployment** — Backend deploys first (Railway + DB migrations + volume for `SESSION_PATH`); then Frontend (Vercel) with `NEXT_PUBLIC_API_URL` set to backend URL; then set backend `FRONTEND_URL` for CORS.

---

## Phase Summary (from main plan)

| Phase | Focus | Backend | Frontend |
|-------|--------|---------|----------|
| 2 | Auth | ✅ Done | ✅ Done — Login/register, store, protection |
| 3 | Baileys | ✅ Done | — |
| 4 | Messages & contacts API | ✅ Done | ✅ Done — API client, contacts + messages UI |
| 5 | Frontend | — | ✅ Done — Full dashboard, WhatsApp, contacts, threads |
| 6 | CRM | ✅ Done | ✅ Done — Dashboard widgets, analytics API |
| 7 | Deployment | ✅ Done (Dockerfile, Railway docs) | ✅ Done — Vercel, env (see docs/frontend-deployment.md) |
| 8 | Testing & polish | Manual/API tests | ✅ Done — UX, errors, responsive, search |

---

## File Reference (key files)

**Backend (Backend Agent — completed):**

- `backend/prisma/schema.prisma`, `backend/prisma/migrations/20250206000000_init/migration.sql`
- `backend/Dockerfile`, `backend/README.md` (DB commands + Railway deployment)
- `backend/src/app.ts`, `backend/src/index.ts`
- `backend/src/config/database.ts`
- `backend/src/routes/*.routes.ts` (auth, whatsapp, contacts, messages, **analytics.routes.ts**)
- `backend/src/controllers/*.controller.ts` (incl. **analytics.controller.ts**)
- `backend/src/services/baileys.service.ts`, `message.service.ts`, `contact.service.ts`, **analytics.service.ts**
- `backend/src/middleware/auth.middleware.ts`, `error.middleware.ts`
- **API reference for frontend:** `docs/api.md`

**Frontend (Frontend Agent — completed):**

- `frontend/app/(auth)/login/`, `frontend/app/(auth)/register/`, `frontend/app/(dashboard)/dashboard/` (page, contacts, contacts/[id], settings)
- `frontend/app/layout.tsx`, `frontend/app/page.tsx` (root redirect)
- `frontend/lib/api.ts` (auth, whatsapp, contacts, messages, analytics)
- `frontend/store/authStore.ts` (Zustand + persist)
- `frontend/components/ui/` (Button, Input, Card), `components/auth/` (LoginForm, RegisterForm, ProtectedRoute, RedirectHome), `components/dashboard/` (DashboardNav, DashboardHome), `components/whatsapp/` (WhatsAppSettings, ConnectionStatus), `components/contacts/` (ContactList, ContactCard, ContactDetail), `components/messages/` (MessageThread, MessageBubble)
- `frontend/.env.local` (NEXT_PUBLIC_API_URL)
- **Deployment:** `docs/frontend-deployment.md` (Vercel, env vars)

Use `docs/implementation-plan.md` for exact code snippets, schema, and deployment steps.
