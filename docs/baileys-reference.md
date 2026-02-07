# Baileys Reference for Read-Only Message Storage

This document is a reference for the [Baileys](https://github.com/WhiskeySockets/Baileys) library (vendored in `backend/Baileys`), focused on building a **read-only message storage system**: receiving, normalizing, and persisting messages without sending.

---

## 1. Core Architecture

### 1.1 Socket composition

Baileys builds the socket in layers:

```
makeWASocket (user entry)
  → makeCommunitiesSocket
    → makeNewsletterSocket
      → makeMessagesSocket (messages-send)
        → makeMessagesRecvSocket (messages-recv)
          → makeSocket (socket.ts — low-level WS + auth)
```

- **`makeWASocket(config)`** — Public API. Takes `UserFacingSocketConfig` (partial `SocketConfig` + required `auth`).
- **`makeSocket`** — Core: WebSocket to WA, noise protocol handshake, auth (QR/pairing), keep-alive, pre-keys, event buffer. Returns `{ ev, ws, authState, query, sendNode, ... }`.
- **`makeMessagesRecvSocket`** — Subscribes to `CB:message`, `CB:receipt`, `CB:notification`, `CB:call`; decrypts messages, calls `upsertMessage`, emits Baileys events.
- **`upsertMessage`** — Defined in `chats.ts` as `ev.createBufferedFunction(...)`. It emits `messages.upsert` and runs `processMessage()` (chats, history sync, protocol messages, reactions, etc.).

So for “read-only storage” you only need to **listen to events** and **implement `getMessage`** (and optionally `shouldSyncHistoryMessage`). You do not need to send messages or receipts unless you want to (e.g. read receipts).

### 1.2 Data flow (messages)

1. WA sends a binary node (e.g. `message`).
2. `socket.ts` decodes the frame, emits low-level callbacks (e.g. `CB:message`).
3. `messages-recv.ts` handles it: `decryptMessageNode` → optional retry on decryption failure → `cleanMessage` → `upsertMessage(msg, type)`.
4. `upsertMessage` (in `chats.ts`):
   - Buffers via `ev.createBufferedFunction` (events can be batched).
   - Emits `messages.upsert` with `{ messages: [msg], type }`.
   - Runs `processMessage()` which may emit `messaging-history.set`, `chats.update`, `messages.update`, `messages.reaction`, etc.
5. Your code subscribes to `messages.upsert` (and optionally `ev.process()`) and writes to your store.

### 1.3 Event buffer

Events are buffered while:

- Connection is established but “initial sync” hasn’t been decided.
- History sync / app state sync is in progress.

Buffered events: `messaging-history.set`, `chats.upsert`/`update`/`delete`, `contacts.upsert`/`update`, `messages.upsert`/`update`/`delete`/`reaction`, `message-receipt.update`, `groups.update`. When the buffer flushes, one consolidated `event` is emitted with a map of event name → data so you can process everything in one batch (e.g. one DB transaction).

---

## 2. Important Types and Interfaces

### 2.1 WASocket

```ts
type WASocket = ReturnType<typeof makeWASocket>
```

The object returned by `makeWASocket()`. It includes:

- **`ev`** — `BaileysEventEmitter` (with `buffer()`, `flush()`, `process()`, `on`, `off`, `emit`).
- **`authState`** — `{ creds: AuthenticationCreds, keys: SignalKeyStore }`.
- **`waitForConnectionUpdate(condition)`** — Promise that resolves when `connection.update` matches the condition.
- **`requestPairingCode(phoneNumber)`** — For pairing-code login.
- **`logout()`**, **`end()`** — Tear down.
- **`fetchMessageHistory(count, oldestMsgKey, oldestMsgTimestamp)`** — On-demand history (peer data operation).
- **`requestPlaceholderResend(messageKey)`** — Ask phone to resend a message (e.g. after decryption failure).
- Plus all send APIs (you can ignore for read-only).

### 2.2 WAMessage

```ts
// Types/Message.ts
export type WAMessage = proto.IWebMessageInfo & {
  key: WAMessageKey
  messageStubParameters?: any
  category?: string
  retryCount?: number
}
```

`proto.IWebMessageInfo` (WAProto) typically has:

- **`key`** — `WAMessageKey` (see below).
- **`message`** — `proto.IMessage` (actual content; can be wrapped in ephemeral/viewOnce/etc.).
- **`messageTimestamp`** — number (seconds).
- **`status`** — e.g. `PENDING`, `SERVER_ACK`, `DELIVERY_ACK`, `READ`, `PLAYED`, `ERROR`.
- **`messageStubType`** — For system messages (e.g. group join/leave, call missed).
- **`pushName`**, **`participant`**, **`userReceipt`**, **`reactions`**, etc.

For storage, the minimal unique identifier is `(key.remoteJid, key.id, key.fromMe)` (and in groups, `key.participant` for sender).

### 2.3 WAMessageKey

```ts
export type WAMessageKey = proto.IMessageKey & {
  remoteJidAlt?: string
  participantAlt?: string
  server_id?: string
  addressingMode?: string
  isViewOnce?: boolean
}
```

Core fields:

- **`remoteJid`** — Chat JID (group, broadcast, or DM).
- **`id`** — Message ID (unique per chat).
- **`fromMe`** — boolean.
- **`participant`** — In groups, sender JID; in broadcast, recipient JID.
- **`remoteJidAlt` / `participantAlt`** — LID/PN alternate; used for mapping.

Use `jidNormalizedUser(jid)` when persisting so you store a consistent form (no device suffix).

### 2.4 AuthenticationState

```ts
// Types/Auth.ts
export type AuthenticationState = {
  creds: AuthenticationCreds
  keys: SignalKeyStore
}
```

- **`creds`** — Identity, registration, pre-keys, `me` (your JID/LID), `accountSettings`, `processedHistoryMessages`, etc. Persist on `creds.update`.
- **`keys`** — Signal protocol store: `get(type, ids)` and `set(data)`. Types include `'pre-key'`, `'session'`, `'sender-key'`, `'app-state-sync-key'`, `'device-list'`, `'lid-mapping'`, etc.

You must persist both for reconnection. `useMultiFileAuthState(folder)` gives a file-based implementation; for production you’d typically use a DB-backed store.

### 2.5 ConnectionState

```ts
// Types/State.ts
export type WAConnectionState = 'open' | 'connecting' | 'close'

export type ConnectionState = {
  connection: WAConnectionState
  lastDisconnect?: { error?: Boom | Error; date: Date }
  isNewLogin?: boolean
  qr?: string
  receivedPendingNotifications?: boolean
  isOnline?: boolean
  legacy?: { phoneConnected: boolean; user?: Contact }
}
```

Use `connection === 'open'` for “ready to use”, and `lastDisconnect?.error` (and Boom `output.statusCode`) to decide whether to reconnect or treat as logout.

### 2.6 Chat and Contact

- **`Chat`** — Extends `proto.IConversation`; has `id`, `messages`, `conversationTimestamp`, `unreadCount`, `archived`, `readOnly`, etc. From `chats.upsert` / `chats.update` / `messaging-history.set`.
- **`Contact`** — `id`, `name`, `notify`, `verifiedName`, `imgUrl`, `lid`, `phoneNumber`. From `contacts.upsert` / `contacts.update` and from `messages.upsert` (pushName/verifiedBizName).

For read-only storage you can store Chat/Contact from events to enrich messages (e.g. chat name, sender display name).

---

## 3. Event System

### 3.1 Connection and auth

| Event | Payload | When |
|-------|--------|------|
| `connection.update` | `Partial<ConnectionState>` | Connecting, open, close, QR, pending notifications, isOnline. |
| `creds.update` | `Partial<AuthenticationCreds>` | Credentials or `me` updated; **must persist** (e.g. call `saveCreds()`). |

### 3.2 Messages (core for storage)

| Event | Payload | When |
|-------|--------|------|
| `messages.upsert` | `{ messages: WAMessage[]; type: 'append' \| 'notify'; requestId?: string }` | New or synced messages. `notify` = just received (e.g. real-time); `append` = history/offline/placeholder resend. |
| `messages.update` | `WAMessageUpdate[]` (`{ key, update }`) | Status change, revoke, edit, receipt applied to message. |
| `messages.delete` | `{ keys: WAMessageKey[] }` or `{ jid: string; all: true }` | Message(s) or full chat deleted. |
| `messages.reaction` | `{ key: WAMessageKey; reaction: proto.IReaction }[]` | Reaction add/remove. |
| `message-receipt.update` | `MessageUserReceiptUpdate[]` (`{ key, receipt }`) | Delivery/read timestamps per user. |
| `messages.media-update` | Array of `{ key, media?, error? }` | Media retry payload (e.g. for re-download). |

For a **read-only store** you care most about:

- **`messages.upsert`** — Insert or replace by `(remoteJid, id, fromMe)` (and participant if group). Use `type` to distinguish live vs history.
- **`messages.update`** — Apply `update` to the message (status, `message: null` for revoke, `editedMessage`, etc.).
- **`messages.delete`** — Remove by keys or clear chat.
- **`messages.reaction`** — Update reactions for the message (by key).

### 3.3 History and chats

| Event | Payload | When |
|-------|--------|------|
| `messaging-history.set` | `{ chats, contacts, messages, isLatest?, progress?, syncType?, lidPnMappings? }` | History sync chunk (initial, recent, on-demand, etc.). Messages are reverse chronological. |
| `chats.upsert` | `Chat[]` | Chats added/updated. |
| `chats.update` | `ChatUpdate[]` | Partial chat updates. |
| `chats.delete` | `string[]` (JIDs) | Chats removed. |

For storage: on `messaging-history.set` you can bulk-insert chats, contacts, and messages; then apply later `chats.update` / `chats.delete` and incremental `messages.upsert`/`update`/`delete`.

### 3.4 Others (optional for minimal storage)

- **`presence.update`** — Typing/recording per chat.
- **`groups.upsert`** / **`groups.update`** — Group metadata.
- **`group-participants.update`** — Join/leave/promote/demote.
- **`contacts.upsert`** / **`contacts.update`** — Contact list.
- **`blocklist.set`** / **`blocklist.update`** — Blocklist.
- **`call`** — Call events (can be stored as stub messages if needed).
- **`labels.edit`** / **`labels.association`** — Labels.
- **Newsletter** — `newsletter.reaction`, `newsletter.view`, `newsletter-participants.update`, `newsletter-settings.update`.

### 3.5 Using `ev.process()` for batch handling

```ts
sock.ev.process(async (events) => {
  if (events['connection.update']) { /* handle connection */ }
  if (events['creds.update']) { await saveCreds() }
  if (events['messaging-history.set']) { /* bulk insert chats, contacts, messages */ }
  if (events['messages.upsert']) {
    for (const msg of events['messages.upsert'].messages) {
      await storeMessage(msg, events['messages.upsert'].type)
    }
  }
  if (events['messages.update']) {
    for (const { key, update } of events['messages.update']) {
      await updateMessage(key, update)
    }
  }
  if (events['messages.delete']) { /* delete by keys or jid */ }
  if (events['messages.reaction']) { /* update reactions */ }
})
```

This lets you handle multiple event types in one batch and, if you want, run a single DB transaction.

---

## 4. Message Types and Extracting Content

**Full detail:** For complete **WAMessage structure**, **all message types**, **body extraction per type**, **metadata**, **group vs individual**, and **media handling** with TypeScript types and helpers, see **[docs/baileys-message-types.md](./baileys-message-types.md)**.

### 4.1 Normalizing and unwrapping

Message content can be wrapped (ephemeral, view-once, edited, etc.). Always normalize before reading:

```ts
import { normalizeMessageContent, getContentType, extractMessageContent } from '@whiskeysockets/baileys'

// Unwrap ephemeral, viewOnce, edited, etc. (up to 5 layers)
const content = normalizeMessageContent(msg.message)

// Get the single key that holds the real content (e.g. 'conversation', 'imageMessage')
const contentType = getContentType(content)

// For templates/buttons, extract the inner media/text
const extracted = extractMessageContent(msg.message)
```

For storage, store the **normalized** content (or the raw `msg.message`) plus `contentType` so you can index and query by type.

### 4.2 Content type keys (proto.IMessage)

Examples:

- **Text:** `conversation`, `extendedTextMessage`
- **Media:** `imageMessage`, `videoMessage`, `audioMessage`, `documentMessage`, `stickerMessage`, `ptvMessage`
- **Other:** `locationMessage`, `contactMessage`, `contactsArrayMessage`, `pollCreationMessage`, `listMessage`, `buttonsMessage`, `templateMessage`, `interactiveMessage`, `productMessage`, `orderMessage`, `groupInviteMessage`, `liveLocationMessage`, `eventMessage`
- **System:** `protocolMessage`, `reactionMessage`, `senderKeyDistributionMessage`, `documentWithCaptionMessage`, `viewOnceMessage`, `ephemeralMessage`, `editedMessage`

`MessageType` in Baileys is `keyof proto.Message` (all keys in the Message namespace).

### 4.3 Getting text from a message

```ts
const content = normalizeMessageContent(msg.message)
const text =
  content?.conversation ||
  content?.extendedTextMessage?.text ||
  content?.imageMessage?.caption ||
  content?.videoMessage?.caption ||
  content?.documentMessage?.caption
  // ... etc.
```

Or use `getContentType(content)` and then read the appropriate field (e.g. `content[contentType].text` or `content[contentType].caption`).

### 4.4 Protocol and stub types

- **`protocolMessage`** — History sync, revoke, ephemeral setting, app state key share, message edit, LID mapping sync, etc. For storage you may persist them as “system” messages or handle revoke/edit in `messages.update`.
- **`messageStubType`** — e.g. `GROUP_PARTICIPANT_ADD`, `CALL_MISSED_VIDEO`, `REVOKE`. Use for filtering or displaying system events.
- **Reactions** — In `content.reactionMessage`; also delivered via `messages.reaction` with `key` (target message) and `reaction` (emoji, etc.). You can merge into `msg.reactions` or store separately keyed by message key.

### 4.5 “Real” message vs system

From `process-message.ts`:

- **`isRealMessage(message)`** — Has content, not only protocol/reaction/pollUpdate, and not stub-only unless it’s a call-missed or GROUP_PARTICIPANT_ADD.
- **`shouldIncrementChatUnread(message)`** — `!fromMe && !messageStubType` (used for unread counts).

Use these if you only want to store user-visible messages and exclude pure system/protocol messages.

---

## 5. Session Management Patterns

**Full detail:** For **useMultiFileAuthState**, **QR/pairing flow**, **connection lifecycle**, **DisconnectReason**, **reconnection strategies**, and **session persistence**, see **[docs/baileys-auth-and-connection.md](./baileys-auth-and-connection.md)**.

### 5.1 useMultiFileAuthState

```ts
import { useMultiFileAuthState } from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth_folder')
const sock = makeWASocket({
  auth: state,
  // ...
})
sock.ev.on('creds.update', saveCreds)
```

- Writes `creds.json` and one file per key type+id (e.g. `session-xxx.json`). Uses file locks per path.
- Suitable for bots/single process; for production, implement `SignalKeyStore` and creds persistence with your DB.

### 5.2 Persisting creds

- On every **`creds.update`**, persist `authState.creds` (or the delta). If you use a callback that receives the full merged creds, persist that.
- Do **not** lose `keys`: sessions, pre-keys, sender keys, device-list, lid-mapping, app-state keys. Without them, decryption fails and you get ciphertext/placeholder messages.

### 5.3 getMessage (required for retries and some features)

Socket config:

```ts
getMessage: async (key: WAMessageKey) => {
  return await yourStore.getMessage(key.remoteJid!, key.id!, key.fromMe)
}
```

Used when:

- WA requests a retry (e.g. message wasn’t delivered to another device); Baileys may resend using the message from `getMessage`.
- Processing event responses / some protocol messages that reference another message.

For read-only storage you still implement `getMessage` so that retry/resend logic can find the message; you don’t have to actually send from your app.

### 5.4 Reconnection

Typical pattern:

```ts
sock.ev.on('connection.update', (update) => {
  if (update.connection === 'close') {
    const code = (update.lastDisconnect?.error as Boom)?.output?.statusCode
    if (code !== DisconnectReason.loggedOut && code !== DisconnectReason.badSession) {
      startSock() // recreate makeWASocket with same auth
    }
  }
})
```

Use the same persisted `auth` (creds + keys) so the session continues.

---

## 6. Common Pitfalls and Edge Cases

### 6.1 Duplicate messages

- Same message can appear in **`messaging-history.set`** and later in **`messages.upsert`** (e.g. when history sync and live stream both deliver it). Use a unique key `(remoteJid, id, fromMe)` and upsert (replace if newer or same).
- **Offline** messages are processed in a queue; order is preserved but you may see the same message from history and then again as “offline” node. Idempotent upsert avoids duplicates.

### 6.2 JID normalization

- Always store and compare JIDs with **`jidNormalizedUser(jid)`** so device part is stripped (e.g. `123456@s.whatsapp.net` instead of `123456:0@s.whatsapp.net`). Use for `remoteJid`, `participant`, and any lookups.
- **LID vs PN:** Some users are addressed by LID (`xxx@lid`). Baileys maps LID↔PN; store the primary identifier your app uses and optionally the alternate.

### 6.3 Decryption failures

- If decryption fails, Baileys sends a retry request to the server/phone. You might get the same message again via **`messages.upsert`** with `requestId` (placeholder resend). Until then, the message may appear as **ciphertext** stub or not at all.
- **`messageStubType === CIPHERTEXT`** and `messageStubParameters?.[0]` can indicate “missing keys” or “message absent”. For storage you can persist a placeholder and replace when a later upsert delivers the decrypted message.

### 6.4 Message order and timestamps

- **`messageTimestamp`** is in seconds (Unix). Order by `(remoteJid, messageTimestamp, id)` for a stable ordering; use `id` as tiebreaker.
- **History sync** messages are reverse chronological (newest first). When inserting, respect your own ordering (e.g. by timestamp) so history and live messages merge correctly.

### 6.5 Status and broadcast

- **Status (stories):** `remoteJid === 'status@broadcast'`. They expire (e.g. 24h); Baileys may skip retry for old status. Store with expiry or filter by age.
- **Broadcast lists:** Different from status; participant in key may denote recipient. Use `getChatId(key)` (from process-message) to get the logical chat id for broadcast.

### 6.6 Buffering and flush

- Events are buffered until connection is fully ready and (if applicable) initial history/app state sync is done. Then a single **flush** emits a big batch. Your handler should be able to process large batches (e.g. thousands of messages) in one go, ideally in one transaction.
- If you only listen to **`messages.upsert`** and not **`ev.process()`**, you still get the same messages; you just don’t get the consolidated batch with chats/contacts/updates in one callback.

### 6.7 History sync and shouldSyncHistoryMessage

- **`shouldSyncHistoryMessage`** in config controls whether a history sync notification is processed. If you return `false` for all, LID mappings and initial state may be incomplete (Baileys logs a warning). For read-only storage you usually want to process at least RECENT/INITIAL_BOOTSTRAP and then persist from `messaging-history.set`.
- **`syncFullHistory`** in config — when true, Baileys may request full history; you get more `messaging-history.set` chunks. Handle progress and `isLatest` if you show sync progress.

### 6.8 Groups and participant

- In groups, **`key.participant`** is the sender JID; **`key.remoteJid`** is the group. Store both so you can query “messages by sender” and “messages in group”.
- **Group metadata** (name, participants, etc.) comes from **`groups.upsert`** / **`groups.update`** and from **`chats.upsert`** / **`chats.update`** (e.g. name). Keep chats and groups in sync if you display names.

---

## 7. Real-World Usage Examples (Read-Only Storage)

### 7.1 Minimal: persist only messages

```ts
import makeWASocket, { useMultiFileAuthState, isRealMessage, normalizeMessageContent, getContentType, jidNormalizedUser } from '@whiskeysockets/baileys'

const { state, saveCreds } = await useMultiFileAuthState('auth')
const sock = makeWASocket({
  auth: state,
  getMessage: async (key) => yourDB.getMessage(key.remoteJid!, key.id!, key.fromMe),
})

sock.ev.on('creds.update', saveCreds)

sock.ev.on('messages.upsert', async ({ messages, type }) => {
  for (const msg of messages) {
    const chatId = jidNormalizedUser(msg.key.remoteJid!)
    const participant = msg.key.participant ? jidNormalizedUser(msg.key.participant) : null
    await yourDB.upsertMessage({
      chatId,
      messageId: msg.key.id!,
      fromMe: msg.key.fromMe,
      participant,
      messageTimestamp: msg.messageTimestamp,
      status: msg.status,
      message: msg.message,
      pushName: msg.pushName,
      category: msg.category,
    })
  }
})

sock.ev.on('messages.update', async (updates) => {
  for (const { key, update } of updates) {
    await yourDB.updateMessage(
      jidNormalizedUser(key.remoteJid!),
      key.id!,
      key.fromMe,
      update
    )
  }
})

sock.ev.on('messages.delete', async (payload) => {
  if ('keys' in payload) {
    for (const key of payload.keys) {
      await yourDB.deleteMessage(jidNormalizedUser(key.remoteJid!), key.id!, key.fromMe)
    }
  } else {
    await yourDB.deleteChatMessages(payload.jid)
  }
})
```

### 7.2 Batch processing with ev.process()

```ts
sock.ev.process(async (events) => {
  await yourDB.transaction(async (tx) => {
    if (events['creds.update']) await saveCreds()
    if (events['messaging-history.set']) {
      const { chats, contacts, messages } = events['messaging-history.set']
      await tx.insertChats(chats)
      await tx.insertContacts(contacts)
      await tx.upsertMessages(messages)
    }
    if (events['messages.upsert']) {
      await tx.upsertMessages(events['messages.upsert'].messages)
    }
    if (events['messages.update']) {
      for (const { key, update } of events['messages.update']) {
        await tx.updateMessage(key, update)
      }
    }
    if (events['messages.delete']) {
      if ('keys' in events['messages.delete']) {
        await tx.deleteMessages(events['messages.delete'].keys)
      } else {
        await tx.deleteChatMessages(events['messages.delete'].jid)
      }
    }
  })
})
```

### 7.3 Extracting text for search/indexing

```ts
function getMessageText(msg: WAMessage): string | undefined {
  const content = normalizeMessageContent(msg.message)
  if (!content) return undefined
  const type = getContentType(content)
  if (!type) return undefined
  const part = content[type]
  if (typeof part === 'string') return part
  if (part && typeof part === 'object') {
    if ('text' in part && typeof part.text === 'string') return part.text
    if ('caption' in part && typeof part.caption === 'string') return part.caption
    if ('contentText' in part) return part.contentText
    if ('hydratedContentText' in part) return part.hydratedContentText
  }
  return undefined
}
```

### 7.4 Connection lifecycle with reconnect

```ts
import type { Boom } from '@hapi/boom'
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const sock = makeWASocket({
    auth: state,
    getMessage: yourGetMessage,
  })

  sock.ev.on('connection.update', (update) => {
    if (update.connection === 'close') {
      const err = update.lastDisconnect?.error as Boom | undefined
      const code = err?.output?.statusCode
      if (code !== DisconnectReason.loggedOut && code !== DisconnectReason.badSession) {
        setTimeout(startSock, 3000)
      }
    }
  })
  sock.ev.on('creds.update', saveCreds)
  // ... messages.upsert, etc.
}
```

---

## Quick reference: config relevant to read-only storage

| Option | Purpose |
|--------|---------|
| `auth` | **Required.** `AuthenticationState` (creds + keys). |
| `getMessage` | **Required.** Return message by key for retries/placeholder resend. |
| `shouldSyncHistoryMessage` | Filter which history syncs to process; affects `messaging-history.set`. |
| `syncFullHistory` | Request full history; more chunks. |
| `shouldIgnoreJid` | Ignore messages/receipts from certain JIDs (e.g. status). |
| `logger` | Pino logger. |

You can omit send-related options (e.g. `patchMessageBeforeSending`, media upload, cached group metadata) if you only consume events and implement `getMessage`.

---

*Reference generated from Baileys source in `backend/Baileys`. For full API and WA protocol details, see the library repo and WAProto definitions.*
