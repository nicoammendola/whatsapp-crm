# Frontend Agent — Brief

You are the **Frontend Agent** for the WhatsApp Personal CRM. You own the Next.js app, UI, and all client-side behavior.

## Your scope

- **In scope:** Everything under `frontend/`: Next.js 14 (App Router), pages, components, API client, auth state, styling (Tailwind), and deployment (Vercel).
- **Out of scope:** Backend code (Express, Prisma, Baileys). Use the API only; do not change `backend/`. Coordinate with the Backend Agent via the API contract in `docs/implementation-plan.md`, `docs/implementation-plan-remaining.md`, and the improvements plan below.

## Authority and conventions

- **Source of truth:** `docs/implementation-plan.md` — API endpoints, response shapes, and UI structure (e.g. Phase 5 layout).
- **Task list:** `docs/implementation-plan-remaining.md` — your tasks are in the "Frontend Agent — Scope" section.
- **Improvements plan:** The full plan is in **`.cursor/plans/whatsapp_crm_improvements_8496f66d.plan.md`** (workspace) or **`~/.cursor/plans/whatsapp_crm_improvements_8496f66d.plan.md`** (user home). Read it for context (current state, priorities, implementation order, real-time/send UX details). Your assigned tasks are summarized in "Frontend Agent — Implementation tasks" below. Rely on backend for new response shapes (see `docs/api.md` after Backend Agent updates).
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

When the user asks you to "work on the frontend" or "complete Phase X (frontend)", follow this brief and the task list in `docs/implementation-plan-remaining.md`.

---

## Frontend Agent — Implementation tasks (WhatsApp CRM Improvements)

Implement in this order. Backend will add new Message fields and send API response; align types and API client with `docs/api.md` once updated.

1. **Chat with self (Saved Messages) — UI**
   - Backend will set the self-chat contact name to "Saved Messages". Ensure the conversation list and thread header show this name. Optionally show a "Notes to self" subtitle or icon when the contact name is "Saved Messages" so the chat is clearly identifiable.

2. **Reply-to (quoted) messages — UI**
   - **types/index.ts:** Add to `Message`: `quotedContent?: string | null`, optionally `quotedMessage?: Message | null`.
   - **MessageBubble.tsx:** When `message.quotedContent` (or quotedMessage) is present, render a styled quote block above the main body (e.g. gray background, smaller text, "Replying to …"). Show reply content below. Avoid showing "(empty)" when the only content is the quote; show quote + "—" or similar if body is empty.

3. **Reactions — UI**
   - **types/index.ts:** Add to `Message`: `reactions?: { emoji: string; fromMe: boolean }[]` (or match backend shape).
   - **MessageBubble.tsx:** Below the bubble, render reaction emojis (with count if aggregated). Optional later: "add reaction" button and API call (Backend Agent can add send-reaction endpoint).

4. **Group sender identity — UI**
   - **types/index.ts:** Add to `Message`: `senderJid?: string | null`, `senderName?: string | null`, `senderPhone?: string | null`.
   - **MessageBubble.tsx:** For group chats (e.g. when `contact?.isGroup` or `message.senderName`/`senderJid` set), show sender above the bubble: small label or avatar (initials) with a stable color from `senderJid`/phone (e.g. hash to color array). Keep layout compact.

5. **Profile photos**
   - Use `contact.profilePicUrl` everywhere we show contact avatar: conversation list, thread header, and (for groups) optionally in MessageBubble for sender. Fallback: initials. If backend adds a profile-picture refresh endpoint, add a refresh control or periodic refetch for the current contact.

6. **Supabase real-time for new messages**
   - Enable Realtime for `messages` in Supabase dashboard if not already (Publication / REPLICA IDENTITY).
   - **MessageThread.tsx:** In a `useEffect`, subscribe to `postgres_changes` on `messages` with `event: 'INSERT'` and filter `userId=eq.${userId}` (get `userId` from auth store or `/auth/me`). In the callback, if `payload.new.contactId === contactId`, add the new message to local state (correct order by timestamp) and scroll to bottom. Cleanup: unsubscribe on unmount.

7. **SPA navigation and no full reload**
   - Use Next.js `<Link>` for any new conversation links (e.g. from search); keep `router.push()` for button-driven navigation. Optionally remove `refreshKey` from MessageThread’s `key` so switching conversations only changes `contactId` (key = `contact.id`); new messages then come from real-time or optimistic updates. Keep loading state when switching conversation.

8. **Message send UX (optimistic UI, no reload)**
   - **lib/api.ts:** Update `messagesApi.sendMessage` so the client expects `{ success: true, message: Message }` from the API (backend will return the created message).
   - **MessageThread + MessageInput:** Implement optimistic UI: MessageThread passes to MessageInput callbacks such as `onOptimisticMessage(optimisticMessage)`, `onSendSuccess(serverMessage)`, `onSendError()`. On send, MessageInput calls `onOptimisticMessage` immediately so the thread shows the message at the bottom; on API success, call `onSendSuccess(payload.message)` to replace optimistic with server message (dedupe with real-time if needed); on error, call `onSendError()` and show retry. Do not bump `refreshKey` to refetch the whole thread on send.
   - **MessageThread:** Add optimistic message to state, replace on success, remove or show retry on error; deduplicate with real-time INSERTs by `whatsappId` or temp id.