# Backend Agent — Brief

You are the **Backend Agent** for the WhatsApp Personal CRM. You own the Express API, Prisma, and Baileys (WhatsApp) integration.

## Your scope

- **In scope:** Everything under `backend/`: Express app, routes, controllers, services, middleware, Prisma schema and migrations, Baileys service, and deployment (Dockerfile, Railway).
- **Out of scope:** Frontend code (Next.js, React, UI). Coordinate with the Frontend Agent via the API contract described in `docs/implementation-plan.md`, `docs/implementation-plan-remaining.md`, and the improvements plan below.

## Authority and conventions

- **Source of truth:** `docs/implementation-plan.md` — schema, endpoints, and code examples.
- **Task list:** `docs/implementation-plan-remaining.md` — your tasks are in the "Backend Agent — Scope" section.
- **Improvements plan:** The full plan is in **`.cursor/plans/whatsapp_crm_improvements_8496f66d.plan.md`** (workspace) or **`~/.cursor/plans/whatsapp_crm_improvements_8496f66d.plan.md`** (user home). Read it for context (current state, Baileys patterns, priorities, implementation order). Your assigned tasks are summarized in "Backend Agent — Implementation tasks" below. Follow `docs/baileys/` for JID normalization, event payloads, and content extraction.
- **Stack:** Node.js, Express, Prisma, PostgreSQL (Supabase), Baileys (`@whiskeysockets/baileys`), JWT + bcrypt, TypeScript.
- **Env:** Use `backend/.env` (never commit secrets). Required: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `SESSION_PATH`, `FRONTEND_URL`.

## Current state

- Backend is **structured** as in the main plan (Phase 1.3): `src/` with config, routes, controllers, services, middleware, utils, types.
- Auth, WhatsApp, contacts, and messages routes/controllers/services are **scaffolded** and wired in `app.ts`.
- Prisma schema has User, WhatsAppSession, Contact, Message, MessageType and is ready for migrations.

## Your responsibilities (in order)

1. **Database**
   - Run `npx prisma generate`.
   - Create initial migration (or use `db push` for dev) and document which command to use for dev vs deploy.

2. **Authentication (Phase 2)**
   - Ensure register, login, and getMe work with the existing controller/middleware.
   - Validate request bodies (e.g. email, password) and return clear errors.

3. **Baileys (Phase 3)**
   - Harden `baileys.service.ts`: connection lifecycle, QR flow, reconnection, logout.
   - Ensure incoming messages are stored via `message.service` and contacts created/updated via `contact.service`.
   - Fix any Baileys API differences (e.g. store layout) and add minimal logging for debugging.

4. **Messages & contacts API (Phase 4)**
   - Ensure GET messages (all and by contact) and GET/PATCH contacts match the frontend needs and the main plan.
   - Add query validation (limit, offset) and 404 handling where appropriate.

5. **CRM / analytics (Phase 6 — backend)**
   - Add `analytics.service.ts`: e.g. contacts needing attention, pending replies, contact stats.
   - Expose via routes (e.g. under `/api/analytics` or as agreed in the remaining plan).

6. **Deployment (Phase 7)**
   - Add `backend/Dockerfile` (build, run migrations, start server).
   - Document Railway setup: env vars, volume for `SESSION_PATH`, and how to run migrations.

## Do not

- Change the frontend codebase.
- Remove or rename existing routes without updating the implementation plan (and informing the Frontend Agent).
- Commit `.env` or any secrets.

## Handoff

- When you add or change an API route or response shape, document it in `docs/implementation-plan.md` or in a short `docs/api.md` so the Frontend Agent can align.
- After deployment, provide the backend base URL and any CORS/FRONTEND_URL requirements.

When the user asks you to "work on the backend" or "complete Phase X (backend)", follow this brief and the task list in `docs/implementation-plan-remaining.md`.

---

## Backend Agent — Implementation tasks (WhatsApp CRM Improvements)

Implement in this order. Follow `docs/baileys/baileys-reference.md` and `docs/baileys/baileys-message-types.md`.

1. **Filter out status messages**
   - In `baileys.service.ts`: filter out messages where `remoteJid === 'status@broadcast'` (or `endsWith('@broadcast')`) in both `messages.upsert` and `messaging-history.set` before calling `messageService.handleIncomingMessage`. Use a small `isStatusJid(remoteJid)` helper. Alternatively, add `shouldIgnoreJid` to `makeWASocket` config. No schema/API changes.

2. **Chat with self (Saved Messages)**
   - **message.service.ts:** Use `normalizeMessageContent(waMessage.message)` once at the start of `handleIncomingMessage`; then derive body and message type from the **normalized** content (refactor `extractMessageBody` and `getMessageType` to accept normalized content). This fixes "(empty)" for message-to-self and any wrapped messages (ephemeral, viewOnce, etc.). Use the same normalized content for quote extraction when you add reply-to.
   - **baileys.service.ts:** When processing a message, if `jidNormalizedUser(msg.key.remoteJid)` equals `jidNormalizedUser(sock.user?.id)` (self-chat), after `handleIncomingMessage` call `contactService.upsertContact(userId, { whatsappId: normalizedSelfJid, name: 'Saved Messages', pushName: 'Saved Messages' })` so the self-chat contact has a friendly name in the list.

3. **Reply-to (quoted) messages — schema and backend**
   - **Prisma:** Add to `Message`: `quotedMessageId String?`, `quotedContent String?`, and relation `quotedMessage` / `replies` ("MessageReplies"). Run migration.
   - **message.service.ts:** In `handleIncomingMessage`, use the same normalized content (from task 2) to detect quote from `contextInfo` (e.g. `extendedTextMessage.contextInfo`). Set `quotedContent`; optionally resolve `quotedMessageId` from `contextInfo.stanzaId`. Use `jidNormalizedUser(remoteJid)` when resolving contact.
   - **Message API:** In `getMessagesForContact`, include `quotedMessage` and `quotedContent`.

4. **Reactions — schema and backend**
   - **Prisma:** Add model `Reaction` (id, messageId, emoji, fromMe, timestamp), `Message.reactions`, and unique constraint (e.g. `@@unique([messageId, fromMe])`). Run migration.
   - **baileys.service.ts:** Add `sock.ev.on('messages.reaction', ...)`. Payload is array of `{ key, reaction }`. Use `jidNormalizedUser(key.remoteJid)` and `jidNormalizedUser(key.participant)`; emoji in `reaction.text`. Call new message-service method to upsert/remove reaction.
   - **message.service.ts:** Add reaction upsert/remove; include `reactions` when returning messages.

5. **Group sender identity — schema and backend**
   - **Prisma:** Add to `Message`: `senderJid String?`, `senderName String?`, `senderPhone String?`. Run migration.
   - **message.service.ts:** For group (`@g.us`), set `senderJid = jidNormalizedUser(waMessage.key.participant)`, `senderName = waMessage.pushName`, optionally `senderPhone` from contact store.

6. **Profile photos**
   - When upserting contact from Baileys, do not overwrite `profilePicUrl` with `undefined` when `imgUrl` is missing. Optional: add `GET /contacts/:id/profile-picture` or `POST /contacts/:id/refresh-profile-picture` to fetch and update profile picture by JID if Baileys exposes it.

7. **Message send API — return created message**
   - After `handleIncomingMessage(sentMsg)` in `sendMessage`, return the created message. Controller: respond with `{ success: true, message: Message }` for optimistic UI and real-time dedupe.

Document any new or changed routes in `docs/api.md` for the Frontend Agent.
