# WhatsApp CRM — API Reference

Base URL: backend root (e.g. `http://localhost:3001` or `https://your-backend.up.railway.app`).

All authenticated routes require header: `Authorization: Bearer <token>`.

---

## Auth

### POST /auth/register

**Body:** `{ "email": string, "password": string, "name"?: string }`

**Success (201):** `{ "user": { id, email, name, createdAt }, "token": string }`

**Errors:** `400` — `{ "error": "Email is required" | "Invalid email format" | "Password is required" | "Password must be at least 6 characters" | "User already exists" }`

---

### POST /auth/login

**Body:** `{ "email": string, "password": string }`

**Success (200):** `{ "user": { id, email, name, createdAt }, "token": string }`

**Errors:** `400` — validation (same as register); `401` — `{ "error": "Invalid email or password" }`

---

### GET /auth/me

**Headers:** `Authorization: Bearer <token>`

**Success (200):** `{ "user": { id, email, name, createdAt } }`

**Errors:** `401` — `{ "error": "No token provided" | "Invalid token" }`; `404` — `{ "error": "User not found" }`

---

## WhatsApp

All WhatsApp routes require auth.

### POST /whatsapp/initialize

Starts or resumes WhatsApp connection; may return a QR code to scan.

**Success (200):** `{ "success": true, "message": string, "qr"?: string, "connected"?: true }`

- If already connected: `connected: true`, no `qr`.
- If pairing: `qr` is a string (e.g. data URL or raw QR payload for frontend to render).

---

### GET /whatsapp/status

**Success (200):** `{ "connected": boolean, "session": { "phoneNumber"?, "lastConnected"?, "qrCode"? } | null }`

---

### POST /whatsapp/disconnect

**Success (200):** `{ "success": true, "message": "Disconnected" }`

---

## Contacts

All require auth.

### GET /contacts

**Success (200):** `{ "contacts": Contact[] }` — ordered by `lastInteraction` desc.

**Contact:** `{ id, userId, whatsappId, name?, pushName?, phoneNumber?, profilePicUrl?, isGroup, lastInteraction?, notes?, tags, createdAt, updatedAt }`

---

### GET /contacts/:id

**Success (200):** `{ "contact": Contact }`

**Errors:** `404` — `{ "error": "Contact not found" }`

---

### PATCH /contacts/:id

**Body:** `{ "notes"?: string, "tags"?: string[] }`

**Success (200):** `{ "success": true }`

**Errors:** `404` — `{ "error": "Contact not found" }`

---

### POST /contacts/:id/refresh-profile-picture

Fetches the contact's profile picture from WhatsApp and updates `profilePicUrl`. Requires WhatsApp to be connected.

**Success (200):** `{ "profilePicUrl": string | null }` — the new URL if fetched, otherwise the existing URL or null.

**Errors:** `404` — Contact not found; `503` — WhatsApp not connected; `500` — Failed to refresh.

---

## Messages

All require auth.

### GET /messages

**Query:** `limit` (1–200, default 100), `offset` (default 0)

**Success (200):** `{ "messages": Message[] }` — each message includes `contact: { id, name, pushName, profilePicUrl }`.

**Message:** `{ id, userId, contactId, whatsappId, fromMe, body?, timestamp, type, hasMedia, quotedContent?, quotedMessage?, senderJid?, senderName?, reactions?, contact?, ... }`

- `quotedContent` — Denormalized quoted text for display.
- `quotedMessage` — Related message when reply-to is stored (`id`, `body`, `fromMe`, `timestamp`).
- `senderJid`, `senderName` — Group sender identity (participant JID and pushName).
- `reactions` — Array of `{ emoji, fromMe }`.

---

### GET /messages/contact/:contactId

**Query:** `limit` (1–200, default 50), `offset` (default 0)

**Success (200):** `{ "messages": Message[] }` — each message includes `contact`, `quotedMessage`, `reactions`.

**Errors:** `404` — `{ "error": "Contact not found" }`

---

### POST /messages/send

**Body:** `{ "contactId": string, "body"?: string, "mediaUrl"?: string, "mediaType"?: "image" | "video" | "audio" | "document" }`

**Success (200):** `{ "success": true, "message"?: Message }` — the created message for optimistic UI and real-time dedupe.

---

## Analytics

All require auth. Base path: `/api/analytics`.

### GET /api/analytics/dashboard

**Success (200):** `{ "needsAttention": Contact[], "pendingReplies": Contact[] }`

- `needsAttention` — contacts (no groups) with no interaction in the last 7 days.
- `pendingReplies` — contacts where the last message in the thread was from them (user has not replied).

---

### GET /api/analytics/needs-attention

**Query:** `limit` (default 10)

**Success (200):** `{ "contacts": Contact[] }`

---

### GET /api/analytics/pending-replies

**Query:** `limit` (default 20)

**Success (200):** `{ "contacts": Contact[] }`

---

### GET /api/analytics/contact-stats/:contactId

**Success (200):** `{ "contactId", "totalMessages", "sentByUser", "receivedFromContact" }`

**Errors:** `404` — `{ "error": "Contact not found" }`

---

## Health

### GET /health

**Success (200):** `{ "ok": true }` — no auth required.
