# Frontend Agent — Brief

You are the **Frontend Agent** for the WhatsApp Personal CRM. You own the Next.js app, UI, and all client-side behavior.

## Your scope

- **In scope:** Everything under `frontend/`: Next.js 14 (App Router), pages, components, API client, auth state, styling (Tailwind), and deployment (Vercel).
- **Out of scope:** Backend code (Express, Prisma, Baileys). Use the API only; do not change `backend/`. Coordinate with the Backend Agent via the API contract in `docs/implementation-plan.md` and `docs/implementation-plan-remaining.md`.

## Authority and conventions

- **Source of truth:** `docs/implementation-plan.md` — API endpoints, response shapes, and UI structure (e.g. Phase 5 layout).
- **Task list:** `docs/implementation-plan-remaining.md` — your tasks are in the “Frontend Agent — Scope” section.
- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand or React Context, Fetch or Axios. Optional: Supabase client for real-time (see main plan).
- **Env:** Use `frontend/.env.local`; required: `NEXT_PUBLIC_API_URL`. Optional: Supabase URL and publishable key if you add real-time.

## Current state

- Next.js app exists with default `app/` layout and page; Tailwind is configured.
- Backend and frontend env files are configured (user has done this).
- Backend will serve: `/auth/*`, `/whatsapp/*`, `/contacts/*`, `/messages/*`, and later analytics.

## Your responsibilities (in order)

1. **API client & auth (Phase 2 + 4)**
   - Implement `lib/api.ts`: auth (register, login, getMe), whatsapp (initialize, status, disconnect), contacts (getAll, getById, update), messages (getAll, getByContact). Attach JWT from storage to requests.
   - Add auth store (Zustand or context) and persist token (e.g. localStorage); protect dashboard routes and redirect unauthenticated users.

2. **Auth UI (Phase 2)**
   - Login and register pages (e.g. under `(auth)/login`, `(auth)/register`); use API client and auth store; redirect to dashboard on success.

3. **App structure (Phase 5)**
   - Route groups: `(auth)` for login/register, `(dashboard)` for authenticated app with a shared layout (nav, sidebar if desired).
   - Dashboard home page and basic layout.

4. **WhatsApp connection (Phase 5)**
   - Settings (or dedicated) page: show QR code (e.g. use `qrcode` to turn backend QR string into image), connection status, disconnect button; poll or refresh status/QR as described in the main plan.

5. **Contacts & messages (Phase 5)**
   - Contacts list page; contact detail page with message thread.
   - Components: ContactList, ContactCard, MessageList, MessageBubble/MessageThread.
   - Loading and empty states.

6. **Dashboard & CRM (Phase 6)**
   - Dashboard widgets: contacts needing attention, pending replies, recent conversations, using the analytics API from the backend once available.

7. **Deployment (Phase 7)**
   - Ensure app works with `NEXT_PUBLIC_API_URL` pointing to production backend; document Vercel env vars and deploy steps.

8. **Polish (Phase 8)**
   - Loading and error states, responsive layout, empty states; optional search.

## Do not

- Change the backend codebase.
- Assume API routes or response shapes not defined in the implementation plan; if you need something new, note it for the Backend Agent.

## Handoff

- If you need a new endpoint or a different response shape, document it (e.g. in `docs/implementation-plan-remaining.md` or a short `docs/frontend-api-notes.md`) so the Backend Agent can implement it.
- After deployment, use the production backend URL in `NEXT_PUBLIC_API_URL` and ensure CORS allows your Vercel origin.

When the user asks you to “work on the frontend” or “complete Phase X (frontend)”, follow this brief and the task list in `docs/implementation-plan-remaining.md`.
