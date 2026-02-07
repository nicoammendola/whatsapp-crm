# Code Review Agent — Plan: Review WhatsApp CRM Improvements

Review and, where needed, fix or improve the work completed by the Backend and Frontend agents for the WhatsApp CRM Improvements. Use the original implementation plan (`.cursor/plans/whatsapp_crm_improvements_8496f66d.plan.md` or `~/.cursor/plans/whatsapp_crm_improvements_8496f66d.plan.md`) and `docs/baileys/` as reference.

---

## Scope

- **In scope:** All code and config changes made for the improvements (backend + frontend). Do not refactor unrelated code unless it blocks a fix.
- **Out of scope:** New features not in the improvements plan; deployment/infra unless it breaks the checklist below.

---

## 1. Backend review

### 1.1 Status filter

- [ ] **baileys.service.ts:** Messages where `remoteJid === 'status@broadcast'` (or `endsWith('@broadcast')`) are never passed to `messageService.handleIncomingMessage` in both `messages.upsert` and `messaging-history.set`.
- [ ] Filter uses a clear helper (e.g. `isStatusJid`) or `shouldIgnoreJid` in socket config; no status messages create contacts or messages in the DB.

### 1.2 Chat with self (Saved Messages)

- [ ] **message.service.ts:** `normalizeMessageContent(waMessage.message)` is used once; body and message type are derived from the **normalized** content (not raw `waMessage.message`). `extractMessageBody` and `getMessageType` (or equivalent) accept normalized content.
- [ ] **baileys.service.ts:** When `jidNormalizedUser(msg.key.remoteJid)` equals `jidNormalizedUser(sock.user?.id)`, the contact is upserted with `name: 'Saved Messages'` and `pushName: 'Saved Messages'` (after handling the message or in the same flow).
- [ ] No regressions: existing DMs still get correct body/type.

### 1.3 Reply-to (quoted) messages

- [ ] **Prisma:** `Message` has `quotedMessageId`, `quotedContent`, and the `MessageReplies` self-relation; migration exists and is applied.
- [ ] **message.service.ts:** Quote is read from normalized content’s `contextInfo` (e.g. `extendedTextMessage.contextInfo`); `quotedContent` is set; `quotedMessageId` is set when the quoted message exists in DB (optional).
- [ ] **Message API:** `getMessagesForContact` (and any other message fetch used by the thread) includes `quotedMessage` and `quotedContent` so the UI can render the quote.
- [ ] JID normalization is used when resolving contact (`jidNormalizedUser(remoteJid)`).

### 1.4 Reactions

- [ ] **Prisma:** `Reaction` model exists with messageId, emoji, fromMe, timestamp; `Message` has `reactions` relation; appropriate unique constraint (e.g. `messageId` + `fromMe` or per-sender).
- [ ] **baileys.service.ts:** `sock.ev.on('messages.reaction', ...)` is registered; payload is treated as an array; `jidNormalizedUser(key.remoteJid)` and `jidNormalizedUser(key.participant)` are used when resolving the message; emoji is taken from `reaction.text`.
- [ ] **message.service.ts:** Reaction upsert/remove is implemented and called from the Baileys handler; messages returned to the API include `reactions` (so the UI can show them).
- [ ] No duplicate reactions for the same (message, fromMe) or (message, sender).

### 1.5 Group sender identity

- [ ] **Prisma:** `Message` has `senderJid`, `senderName`, `senderPhone`; migration applied.
- [ ] **message.service.ts:** For group chats (`remoteJid` ends with `@g.us`), `senderJid = jidNormalizedUser(waMessage.key.participant)`, `senderName = waMessage.pushName`; optional `senderPhone` from contact store.
- [ ] Message API returns these fields so the frontend can show sender.

### 1.6 Profile photos

- [ ] When upserting contacts from Baileys, `profilePicUrl` is not overwritten with `undefined` when `imgUrl` is missing (existing value is kept).
- [ ] If implemented: profile-picture refresh endpoint uses the correct JID and updates `contact.profilePicUrl` and returns the URL.

### 1.7 Message send API

- [ ] **baileys.service.ts** `sendMessage`: after `handleIncomingMessage(sentMsg)` the created message is obtained (e.g. re-fetch by `whatsappId` or return from handler).
- [ ] **messages.controller.ts** `sendMessage`: response is `{ success: true, message: Message }` with the created message object (so frontend can do optimistic UI and dedupe).

### 1.8 General backend

- [ ] No new lint or TypeScript errors. Prisma client is generated after schema changes.
- [ ] Error handling: message/reaction handlers do not crash the process; errors are logged and, where appropriate, returned as 4xx/5xx.
- [ ] `docs/api.md` (or equivalent) documents any new or changed routes and response shapes.

---

## 2. Frontend review

### 2.1 Chat with self (Saved Messages)

- [ ] Conversation list and thread header show the contact name (backend sets "Saved Messages"). Optional: "Notes to self" subtitle or icon when the contact is the self-chat.
- [ ] Messages in the self-chat show real body text and type (no "(empty)" for normal reminders).

### 2.2 Reply-to (quoted) messages

- [ ] **types:** `Message` includes `quotedContent` and optionally `quotedMessage`.
- [ ] **MessageBubble:** When `quotedContent` (or `quotedMessage`) is present, a quote block is rendered above the main body (e.g. gray background, "Replying to …"). Reply content is below. No "(empty)" when the only content is the quote.

### 2.3 Reactions

- [ ] **types:** `Message` includes `reactions` (shape matches backend, e.g. `{ emoji: string; fromMe: boolean }[]`).
- [ ] **MessageBubble:** Reactions are shown below the bubble (emoji and optionally count). No layout overflow or missing key warnings.

### 2.4 Group sender identity

- [ ] **types:** `Message` includes `senderJid`, `senderName`, `senderPhone`.
- [ ] **MessageBubble:** For group messages, sender is shown above the bubble (label or avatar with initials and stable color). Layout stays compact.

### 2.5 Profile photos

- [ ] Conversation list uses `contact.profilePicUrl` for the avatar (fallback: initials).
- [ ] Thread header uses `contact.profilePicUrl` for the avatar (fallback: initials).
- [ ] If group sender avatar is implemented, it uses a stable color/initials and does not break for missing `profilePicUrl`.

### 2.6 Supabase real-time

- [ ] **MessageThread:** Subscribes to `postgres_changes` on `messages` with `event: 'INSERT'` and filter by `userId`. When `payload.new.contactId === contactId`, the new message is added to state in correct order and scroll-to-bottom runs. Channel is removed on unmount.
- [ ] `userId` is available (e.g. from auth store or `/auth/me`). RLS allows the user to read their own messages.

### 2.7 SPA navigation

- [ ] Conversation links use Next.js `<Link>` where appropriate; programmatic navigation uses `router.push()`. Switching conversations does not cause a full page reload.
- [ ] MessageThread key does not unnecessarily include `refreshKey` so that switching conversations only changes `contactId` and new messages come from real-time/optimistic updates.

### 2.8 Message send UX

- [ ] **lib/api.ts:** `messagesApi.sendMessage` expects and uses `{ success: true, message: Message }` from the API.
- [ ] **MessageInput + MessageThread:** Optimistic message is added to the thread immediately on send. On success, it is replaced with the server message (dedupe with real-time if needed). On error, retry or error state is shown. No full thread refetch on send (no `refreshKey` bump that refetches the whole thread).
- [ ] Sent messages appear at once and then update with server data; no double messages from optimistic + real-time if dedupe is correct.

### 2.9 General frontend

- [ ] No new lint or TypeScript errors. Types align with backend responses (and `docs/api.md`).
- [ ] Loading and error states are handled; no uncaught promise rejections or missing keys in lists.

---

## 3. Cross-cutting and fixes

- [ ] **Consistency:** Backend response shapes match what the frontend expects (Message with quotedContent, reactions, senderJid/senderName/senderPhone, etc.).
- [ ] **Baileys alignment:** JID normalization (`jidNormalizedUser`) is used wherever JIDs are stored or compared; content extraction uses normalized content for body/type/quote. Event payload shapes match `docs/baileys/baileys-reference.md`.
- [ ] **Fixes:** For each checkbox that fails, implement the minimal fix (code or config). Re-run the checklist for the changed area.
- [ ] **Improvements:** If you see clear improvements (e.g. error messages, edge cases, accessibility, performance) that are small and within scope, apply them and note them in a short "Code review changes" summary.

---

## 4. Output

- Produce a short **Code review summary**: list of items that passed, items that were fixed (with file/change), and any optional improvements made.
- Do not change behavior or APIs beyond what is needed to satisfy the checklist and the original implementation plan.
