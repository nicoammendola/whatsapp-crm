# Baileys: WAMessage Structure, Types, and Extraction

Companion to [baileys-reference.md](./baileys-reference.md). This document details the **complete WAMessage structure**, **all message types**, **body/content extraction** per type, **metadata**, **group vs individual**, and **media handling**, with TypeScript types and helper examples.

Source: `backend/Baileys/src/Types/Message.ts`, `Utils/messages.ts`, `Utils/messages-media.ts`, and WAProto.

---

## 1. Complete WAMessage structure

`WAMessage` extends WhatsApp’s `WebMessageInfo` with a required `key` and optional Baileys fields.

### TypeScript: WAMessage and WAMessageKey

```ts
// From Types/Message.ts and WAProto IWebMessageInfo
import type { proto } from '../../WAProto/index.js'

/** Baileys extends proto.IWebMessageInfo with guaranteed key and extras */
export type WAMessage = proto.IWebMessageInfo & {
  /** Always present in Baileys; unique message identifier */
  key: WAMessageKey
  /** For stub/notification messages (e.g. group events); string[] in proto */
  messageStubParameters?: any
  /** Message category (e.g. 'peer' for history) */
  category?: string
  /** Retry count when decryption failed and retry was sent */
  retryCount?: number
}

/** Unique message identifier; use for dedup and lookups */
export type WAMessageKey = proto.IMessageKey & {
  remoteJid?: string
  fromMe?: boolean
  id?: string
  participant?: string
  remoteJidAlt?: string
  participantAlt?: string
  server_id?: string
  addressingMode?: string
  isViewOnce?: boolean
}
```

### WebMessageInfo fields (proto)

| Field | Type | Description |
|-------|------|-------------|
| `key` | `WAMessageKey` | Chat, id, fromMe, participant (required in Baileys) |
| `message` | `proto.IMessage` | Actual content; one content key (see §2) |
| `messageTimestamp` | `number \| Long` | Unix **seconds** when message was sent |
| `status` | `WebMessageInfo.Status` | Delivery/read state (see §4) |
| `participant` | `string` | In groups: sender JID |
| `pushName` | `string` | Sender’s display name at time of send |
| `messageStubType` | `WebMessageInfo.StubType` | System message type (REVOKE, GROUP_*, etc.) |
| `messageStubParameters` | `string[]` | Args for stub (e.g. group subject, participant list) |
| `userReceipt` | `IUserReceipt[]` | Per-user read/delivery timestamps |
| `reactions` | `IReaction[]` | Reactions on this message |
| `verifiedBizName` | `string` | Business verified name if applicable |
| `broadcast` | `boolean` | Whether sent to a broadcast list |
| `ephemeralDuration` | `number` | Disappearing message duration (seconds) |
| `ephemeralStartTimestamp` | `number \| Long` | When ephemeral started |
| `labels` | `string[]` | Label IDs |
| `pollUpdates` | `IPollUpdate[]` | Poll votes (if poll message) |
| `eventResponses` | `IEventResponse[]` | Event RSVPs (if event message) |
| `revokeMessageTimestamp` | `number \| Long` | When message was revoked (if deleted) |

---

## 2. All message types and how to extract body/content

Content lives in `msg.message` (proto.IMessage). Exactly one key holds the “primary” content; wrappers (`ephemeralMessage`, `viewOnceMessage`, etc.) contain another message inside. Use **`normalizeMessageContent(msg.message)`** first (unwraps up to 5 levels), then **`getContentType(content)`** to get the content key.

### Text

| Content key | Body / content | Notes |
|-------------|----------------|--------|
| `conversation` | **String** — the value is the body | Plain text. |
| `extendedTextMessage` | **`content.extendedTextMessage.text`** | Link preview: `title`, `description`, `matchedText`, `jpegThumbnail`; `contextInfo` for quote/mention. |

### Media (all have `url` or `directPath` + `mediaKey` for download)

| Content key | Body / caption | Common fields |
|-------------|----------------|----------------|
| `imageMessage` | `caption` | `url`, `directPath`, `mediaKey`, `mimetype`, `width`, `height`, `fileSha256`, `fileLength`, `jpegThumbnail`, `contextInfo` |
| `videoMessage` | `caption` | Same + `seconds`, `gifPlayback` |
| `ptvMessage` | — | Same as video (video note) |
| `audioMessage` | — | `url`, `directPath`, `mediaKey`, `mimetype`, `seconds`, `ptt` (voice note), `waveform` |
| `documentMessage` | `caption` | `url`, `directPath`, `mediaKey`, `mimetype`, `fileName`, `fileLength`, `pageCount`, `jpegThumbnail` |
| `stickerMessage` | — | Same as image; `isAnimated`, `pngThumbnail` |

### Other content

| Content key | Body / content |
|-------------|----------------|
| `locationMessage` | `degreesLatitude`, `degreesLongitude`, `name`, `address` |
| `contactMessage` | `vcard`, `displayName` |
| `contactsArrayMessage` | `contacts[]` (each with `vcard`, `displayName`) |
| `groupInviteMessage` | `inviteCode`, `inviteExpiration`, `groupJid`, `groupName`, `caption`, `jpegThumbnail` |
| `liveLocationMessage` | Same as location + `accuracyInMeters`, `speedInMps`, `degreesClockwiseFromMagneticNorth`, `caption` |
| `pollCreationMessage` | `name`, `options[]` (optionName), `selectableOptionsCount`; variants: `pollCreationMessageV2`, `pollCreationMessageV3` |
| `listMessage` | `title`, `description`, `buttonText`, `sections[]` (rows) |
| `listResponseMessage` | `title`, `singleSelectReply.selectedRowId`, `contextInfo` |
| `buttonsMessage` | `contentText` / `hydratedContentText`, `buttons[]` |
| `buttonsResponseMessage` | `selectedButtonId`, `selectedDisplayText` |
| `templateMessage` | `hydratedTemplate` / `fourRowTemplate` / `hydratedFourRowTemplate` (with `contentText`/`hydratedContentText`, image/document/video) |
| `templateButtonReplyMessage` | `selectedDisplayText`, `selectedId`, `selectedIndex` |
| `interactiveMessage` | Body in nested type (native flow, button list, etc.) |
| `interactiveResponseMessage` | Response payload |
| `productMessage` | `product` (productSnapshot), `businessOwnerJid`, `body`, `footer`, `catalogId` |
| `orderMessage` | Order details |
| `eventMessage` | `name`, `description`, `startTime`, `endTime`, `location`, `joinLink`, `isCanceled` |
| `reactionMessage` | `key` (target message), `text` (emoji), `senderTimestampMs` |
| `protocolMessage` | `type` (REVOKE, EPHEMERAL_SETTING, MESSAGE_EDIT, HISTORY_SYNC_NOTIFICATION, etc.); `key`, `editedMessage`, `historySyncNotification` |

### Wrappers (unwrap with normalizeMessageContent)

- `ephemeralMessage.message` — Disappearing message content
- `viewOnceMessage.message` / `viewOnceMessageV2` — View once content
- `documentWithCaptionMessage.message` — Document + caption
- `editedMessage.message` — Edited content
- `albumMessage` — Multiple messages (children)

---

## 3. Extraction helper examples (TypeScript)

```ts
import type { WAMessage, WAMessageContent } from '@whiskeysockets/baileys'
import { normalizeMessageContent, getContentType, extractMessageContent } from '@whiskeysockets/baileys'

/** Normalized content type key */
export type MessageContentType = keyof NonNullable<WAMessageContent>

/** Get the single content key (conversation | extendedTextMessage | imageMessage | ...) */
export function getMessageContentType(msg: WAMessage): MessageContentType | undefined {
  const content = normalizeMessageContent(msg.message)
  return content ? getContentType(content) : undefined
}

/** Extract plain text or caption from any message (for search/indexing) */
export function getMessageBody(msg: WAMessage): string | undefined {
  const content = normalizeMessageContent(msg.message)
  if (!content) return undefined

  const type = getContentType(content)
  if (!type) return undefined

  const part = content[type]
  if (typeof part === 'string') return part // conversation
  if (!part || typeof part !== 'object') return undefined

  if ('text' in part && typeof part.text === 'string') return part.text
  if ('caption' in part && typeof part.caption === 'string') return part.caption
  if ('contentText' in part) return part.contentText as string
  if ('hydratedContentText' in part) return part.hydratedContentText as string
  const hydrated = (part as { hydratedFourRowTemplate?: { hydratedContentText?: string } }).hydratedFourRowTemplate
  if (hydrated?.hydratedContentText) return hydrated.hydratedContentText
  const fourRow = (part as { fourRowTemplate?: { contentText?: string } }).fourRowTemplate
  if (fourRow?.contentText) return fourRow.contentText
  if ('name' in part && typeof part.name === 'string') return part.name
  if ('address' in part && typeof part.address === 'string') return part.address
  if ('displayName' in part && typeof part.displayName === 'string') return part.displayName

  return undefined
}

/** Type-safe content by kind */
export function getMessageContentByType<T extends MessageContentType>(
  msg: WAMessage,
  contentType: T
): (NonNullable<WAMessageContent>[T] & object) | undefined {
  const content = normalizeMessageContent(msg.message)
  if (!content || getContentType(content) !== contentType) return undefined
  const part = content[contentType]
  return part && typeof part === 'object' ? (part as NonNullable<WAMessageContent>[T] & object) : undefined
}

/** Check if message has a media payload */
export function isMediaMessage(msg: WAMessage): boolean {
  const content = extractMessageContent(msg.message)
  if (!content) return false
  const type = getContentType(content)
  return !!(
    type &&
    ['imageMessage', 'videoMessage', 'ptvMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(type)
  )
}
```

---

## 4. Message metadata (timestamp, read status, etc.)

- **Timestamp:** `msg.messageTimestamp` is Unix **seconds**. Use for ordering; combine with `key.id` for stable sort.
- **Status** (`msg.status`) — `proto.WebMessageInfo.Status`:
  - `ERROR = 0` — Send failed or error ack
  - `PENDING = 1` — Sent, not yet server ack
  - `SERVER_ACK = 2` — Reached server
  - `DELIVERY_ACK = 3` — Delivered to device(s)
  - `READ = 4` — Read
  - `PLAYED = 5` — Played (e.g. voice)
- **Read/delivery per user (groups):** `msg.userReceipt` — each has `userJid`, `receiptTimestamp`, `readTimestamp`. Also see `message-receipt.update` events.
- **Reactions:** `msg.reactions` — array of `{ key, text, senderTimestampMs }`; also `messages.reaction` events.
- **Revoked:** `messageStubType === REVOKE` or `messages.update` with `update: { message: null, messageStubType: REVOKE }`; optional `revokeMessageTimestamp`.
- **Edited:** `protocolMessage.type === MESSAGE_EDIT` or `editedMessage`; body in `protocolMessage.editedMessage` or `editedMessage.message`; Baileys also emits `messages.update` with new content.

### WebMessageInfo.StubType (selected)

| Value | Meaning |
|-------|--------|
| `REVOKE` | Message deleted |
| `CIPHERTEXT` | Decryption failed (placeholder) |
| `GROUP_CREATE`, `GROUP_CHANGE_SUBJECT`, `GROUP_CHANGE_ICON`, `GROUP_CHANGE_INVITE_LINK`, `GROUP_CHANGE_DESCRIPTION`, `GROUP_CHANGE_RESTRICT`, `GROUP_CHANGE_ANNOUNCE` | Group settings |
| `GROUP_PARTICIPANT_ADD`, `GROUP_PARTICIPANT_REMOVE`, `GROUP_PARTICIPANT_LEAVE`, `GROUP_PARTICIPANT_PROMOTE`, `GROUP_PARTICIPANT_DEMOTE`, `GROUP_PARTICIPANT_INVITE`, `GROUP_PARTICIPANT_CHANGE_NUMBER` | Group participants |
| `CALL_MISSED_VOICE`, `CALL_MISSED_VIDEO`, `CALL_MISSED_GROUP_VOICE`, `CALL_MISSED_GROUP_VIDEO` | Missed calls |
| `CHANGE_EPHEMERAL_SETTING` | Disappearing mode changed |

Full enum is in WAProto `WebMessageInfo.StubType`.

---

## 5. Group vs individual messages

- **Individual (DM):** `key.remoteJid` is e.g. `1234567890@s.whatsapp.net`; `key.participant` is usually absent. **Chat id** = `key.remoteJid` (use `jidNormalizedUser`).
- **Group:** `key.remoteJid` = group JID (e.g. `123@g.us`); **`key.participant`** = sender JID. **Chat id** = `key.remoteJid`; **sender** = `key.participant`. Store both for “who said what in which group”.
- **Broadcast list:** For “received in my inbox” the logical chat may be `key.participant` when not fromMe. Use `getChatId(key)` from `process-message.ts`: for broadcast (not status) and not fromMe it returns `participant`, else `remoteJid`.
- **Status (stories):** `key.remoteJid === 'status@broadcast'`; status messages expire (e.g. 24h).

Always store JIDs with **`jidNormalizedUser(jid)`** so the device part is stripped.

---

## 6. Media handling patterns

Media messages have `url` or `directPath` plus `mediaKey`. Content is encrypted; Baileys derives keys and decrypts.

### 6.1 Detect media and get download params

```ts
import { extractMessageContent, getContentType } from '@whiskeysockets/baileys'

const content = extractMessageContent(msg.message)
const contentType = getContentType(content)
// One of: imageMessage, videoMessage, ptvMessage, audioMessage, documentMessage, stickerMessage
const media = content?.[contentType]
if (!media || !('url' in media) && !('directPath' in media)) return
// media: url?, directPath?, mediaKey?, mimetype?, caption?, fileName? (document), etc.
```

### 6.2 Download as buffer or stream

Use Baileys’ **`downloadMediaMessage`** (in `Utils/messages.ts`):

```ts
import { downloadMediaMessage } from '@whiskeysockets/baileys'

const buffer = await downloadMediaMessage(msg, 'buffer', { logger })
const stream = await downloadMediaMessage(msg, 'stream', { logger })
```

Internally it uses **`downloadContentFromMessage(media, mediaType, opts)`** with `{ mediaKey, directPath, url }` and optional `startByte`/`endByte`/`options`. Keys are derived via **`getMediaKeys(mediaKey, mediaType)`**; download URL is `url` or `https://mmg.whatsapp.net/${directPath}`.

### 6.3 Media type mapping

Map content key → Baileys `MediaType` (for `getMediaKeys` / HKDF):

- `imageMessage`, `stickerMessage` → `'image'` or `'sticker'`
- `videoMessage`, `ptvMessage` → `'video'` or `'ptv'`
- `audioMessage` → `'audio'` or `'ptt'`
- `documentMessage` → `'document'`

`MEDIA_KEYS`, `MEDIA_PATH_MAP`, and `MEDIA_HKDF_KEY_MAPPING` in `Defaults` define supported types and key derivation.

### 6.4 Thumbnails and failures

- Many media have **`jpegThumbnail`** (base64/buffer). Documents may have **`thumbnailDirectPath`** + **`thumbnailSha256`** (same decrypt pattern with thumbnail type).
- If URL/directPath returns 410/404, Baileys can request re-upload; `downloadMediaMessage` accepts a context with **`reuploadRequest(msg)`** to retry after re-upload. For read-only storage you can store metadata and attempt download when needed.

---

*See [baileys-reference.md](./baileys-reference.md) for architecture, events, session management, and pitfalls.*
