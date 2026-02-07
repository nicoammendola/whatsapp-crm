# Baileys: Authentication and Connection

Reference for authentication state, QR/pairing flow, connection lifecycle, disconnect reasons, reconnection, and session persistence in `backend/Baileys`. Companion to [baileys-reference.md](./baileys-reference.md).

---

## 1. How useMultiFileAuthState works

**Source:** `src/Utils/use-multi-file-auth-state.ts`

`useMultiFileAuthState(folder)` returns an **AuthenticationState** (creds + keys) that persists to a single directory. It is intended for bots/single-process use; production apps should use a DB-backed store.

### 1.1 Return value

```ts
const { state, saveCreds } = await useMultiFileAuthState('auth_folder')

// state: AuthenticationState
state.creds   // AuthenticationCreds (mutated in place; persist with saveCreds())
state.keys    // SignalKeyStore (get/set) — reads/writes files in folder
// saveCreds: () => Promise<void> — writes state.creds to creds.json
```

### 1.2 File layout

- **`creds.json`** — Full `AuthenticationCreds` (noise key, identity, pre-keys metadata, `me`, `accountSettings`, `processedHistoryMessages`, etc.). Written only when you call **`saveCreds()`** (e.g. on `creds.update`).
- **Keys store:** one file per key: **`{type}-{id}.json`**, e.g.:
  - `session-<jid_device>.json` — Signal session
  - `pre-key-<id>.json` — Pre-key
  - `sender-key-<jid>.json` — Sender key
  - `app-state-sync-key-<keyId>.json` — App state sync key (restored as `proto.Message.AppStateSyncKeyData.fromObject`)
  - `device-list-<user>.json` — Device list
  - `lid-mapping-<lid>.json` — LID mapping
  - etc.

File names are sanitized: `/` → `__`, `:` → `-`.

### 1.3 Concurrency and locking

- **Per-file mutex** (from `async-mutex`): each file path has its own Mutex. All read/write for that file goes through `mutex.acquire()` so concurrent access is serialized and safe (avoids issues with async read/write and Node fs).
- **get(type, ids):** for each id, reads `{type}-{id}.json` under the lock, parses with `BufferJSON.reviver` (handles `Buffer`/`Uint8Array` in JSON).
- **set(data):** for each (category, id), either `writeData(value, file)` or `removeData(file)` (writes JSON with `BufferJSON.replacer`, or deletes file when value is null).

### 1.4 Initialization

- If `folder` does not exist, it is created (`mkdir(folder, { recursive: true })`).
- If it exists and is not a directory, an error is thrown.
- **creds** are loaded from `creds.json`; if missing, **`initAuthCreds()`** from `auth-utils.ts` is used (generates new noise key, identity key, signed pre-key, registration ID, etc.; no `me`, so first connection will be “not logged in” and trigger QR/pairing).

### 1.5 What you must do

- **Persist creds on every `creds.update`:** call **`saveCreds()`** from your `creds.update` listener. Baileys does not call it for you; if you don’t, creds (including `me` after pairing) are lost on restart.
- **Do not clear the keys directory** while the session is in use; keys are required for decryption and for the server to accept the connection.

---

## 2. QR code generation flow

**Source:** `src/Socket/socket.ts` (QR path); pairing code is separate.

### 2.1 When QR is used

- After **handshake** and **validateConnection()**, if **`creds.me`** is missing, the server sends a **pair-device** IQ with refs. Baileys then generates QR payloads from those refs.
- If `creds.me` exists, Baileys sends a **login** node and no QR is emitted (existing session).

### 2.2 Sequence

1. **WebSocket opens** → `validateConnection()` runs:
   - Sends Noise handshake (client hello).
   - Receives server hello, processes handshake.
   - Builds payload: **no login** → `generateRegistrationNode(creds, config)`; **logged in** → `generateLoginNode(creds.me.id, config)`.
   - Sends client finish (encrypted payload), finishes noise init, starts keep-alive.

2. **Server sends `CB:iq,type:set,pair-device`** (when not logged in):
   - Baileys replies with `iq` result (ack).
   - Reads **pair-device** node and children **ref** (list of ref strings).
   - Prepares constants: `noiseKeyB64`, `identityKeyB64`, `advB64`.
   - **genPairQR()** (called immediately, then on a timer):
     - If WebSocket is not open, return.
     - **Shift one ref** from the list. If none left → **end** with `DisconnectReason.timedOut` (“QR refs attempts ended”).
     - **QR payload** = `ref,noiseKeyB64,identityKeyB64,advB64` (comma-separated).
     - **Emit** `connection.update` with **`{ qr }`** (string). Your app turns this into a QR image (e.g. `qrcode` npm package) or shows pairing code instead.
     - **Schedule next QR:** `setTimeout(genPairQR, qrMs)`. First interval: **qrTimeout** (config) or 60_000 ms; later ones 20_000 ms.

3. **User scans QR** → server sends **`CB:iq,,pair-success`**:
   - Baileys runs **configureSuccessfulPairing(stanza, creds)** (updates creds with `me`, device identity, etc.).
   - Emits **`creds.update`** (updated creds) and **`connection.update`** with **`{ isNewLogin: true, qr: undefined }`**.
   - Sends reply node; server typically closes the connection so the client can **reconnect with the new creds** and then receives **`CB:success`** (open).

### 2.3 Config

- **qrTimeout** (SocketConfig): first QR TTL in ms (default 60_000); subsequent refs use 20_000 ms.
- **printQRInTerminal:** deprecated; Baileys only emits `connection.update` with `qr`; you must render QR or use pairing code yourself.

### 2.4 Pairing code (alternative to QR)

- Use **`sock.requestPairingCode(phoneNumber, customPairingCode?)`** when you have **`connection.update`** with **`qr`** and want to avoid QR (e.g. headless).
- It sets **creds.me** to a placeholder and **creds.pairingCode**, emits **creds.update**, and sends a **link_code_companion_reg** node; the user enters the 8-digit code in the WhatsApp “Link with phone number” flow. Pairing success is still signaled by **pair-success** and then reconnect.

---

## 3. Connection lifecycle (connecting → open → close)

**Source:** `src/Types/State.ts`, `src/Socket/socket.ts`, event emission.

### 3.1 States

- **`connection: 'connecting'`** — Socket is starting or handshake in progress. Emitted in **process.nextTick** after socket creation, with **`receivedPendingNotifications: false`** and **`qr: undefined`**.
- **`connection: 'open'`** — Logged in and ready. Emitted when **`CB:success`** is received (after pre-key upload and passive IQ). Optional **`receivedPendingNotifications: true`** is emitted when **`CB:ib,,offline`** is handled (offline notifications processed).
- **`connection: 'close'`** — Connection ended. Emitted by **end()** with **`lastDisconnect: { error, date }`**.

### 3.2 Flow (high level)

```
[Start]
  → WebSocket created, connect()
  → process.nextTick: ev.emit('connection.update', { connection: 'connecting', receivedPendingNotifications: false, qr: undefined })
  → ws 'open' → validateConnection()
       ├─ no creds.me → server may send pair-device → QR loop (connection.update { qr })
       │     → user scans → pair-success → creds.update, connection.update { isNewLogin, qr: undefined } → often close
       └─ creds.me → login node → server sends success
  → CB:success → uploadPreKeysToServerIfRequired(), sendPassiveIq('active'), digestKeyBundle optional
  → ev.emit('connection.update', { connection: 'open' })
  → If had buffered: later CB:ib,,offline → ev.emit('connection.update', { receivedPendingNotifications: true })
  → [Running: keep-alive ping, message handling]
  → On ws 'close' / 'error' / CB:stream:error / CB:failure / etc. → end(error)
  → ev.emit('connection.update', { connection: 'close', lastDisconnect: { error, date } })
  → ev.removeAllListeners('connection.update')
[End]
```

### 3.3 end()

- **end(error)** is the single teardown: sets **closed = true**, clears keep-alive and QR timer, removes ws listeners, closes WebSocket if needed, emits **connection.update** with **connection: 'close'** and **lastDisconnect**, then **removeAllListeners('connection.update')** so no further connection updates.

---

## 4. DisconnectReason enum and handling

**Source:** `src/Types/index.ts`, `src/Utils/generics.ts`, `src/Socket/socket.ts`.

### 4.1 Enum (numeric status codes)

```ts
export enum DisconnectReason {
  connectionClosed = 428,   // Generic close / connection terminated
  connectionLost = 408,     // Keep-alive timeout (no response for keepAliveIntervalMs + 5s)
  connectionReplaced = 440, // Same session opened elsewhere (e.g. conflict)
  timedOut = 408,          // Query timeout or QR refs exhausted
  loggedOut = 401,         // Explicit logout or server says logged out
  badSession = 500,        // Stream error / invalid session (default in getErrorCodeFromStreamError)
  restartRequired = 515,   // Server asks for restart
  multideviceMismatch = 411, // e.g. downgrade_webclient
  forbidden = 403,
  unavailableService = 503
}
```

### 4.2 Where codes are set

- **socket.ts:**  
  - **connectionClosed (428):** `Connection Closed`, `Connection Terminated`, `Connection Terminated by Server`, WS close.  
  - **connectionLost (408):** Keep-alive timeout (no response in time).  
  - **timedOut (408):** QR refs exhausted, or query timeout in promiseTimeout.  
  - **loggedOut (401):** Intentional logout or mobile API error.  
  - **multideviceMismatch (411):** `CB:ib,,downgrade_webclient`.  
- **generics.ts — getErrorCodeFromStreamError(node):**  
  - Uses **node.attrs.code** if present, else **CODE_MAP[reason]** (e.g. `conflict` → **connectionReplaced**), else **badSession (500)**.  
  - Used by **CB:stream:error** handler; Baileys then calls **end(new Boom(..., { statusCode }))**.
- **CB:failure:** **statusCode = node.attrs.reason** (numeric) or 500.
- **getCodeFromWSError(error):** Maps WS/network errors (e.g. “Unexpected server response: 401”, or timeout/ENOTFOUND) to a status code (401 or 408); used by **mapWebSocketError** when WS emits error/close.

### 4.3 Reading the reason in your code

- On **`connection.update`** with **`connection === 'close'`**, use **`lastDisconnect?.error`**. If it’s a **Boom** from Baileys:
  - **`(error as Boom).output?.statusCode`** is the numeric DisconnectReason.
- Compare against **DisconnectReason** to decide:
  - **loggedOut / badSession / forbidden:** do not reconnect; session invalid or user logged out.
  - **connectionClosed / connectionLost / timedOut / unavailableService / restartRequired:** can reconnect with same auth (optionally with backoff).
  - **connectionReplaced:** another client took the session; reconnect only if you intend to replace that client.
  - **multideviceMismatch:** account/device config issue; usually do not auto-reconnect.

---

## 5. Reconnection strategies

Baileys does **not** reconnect by itself. Your code must create a new socket and re-use the same auth state.

### 5.1 Basic reconnect on close (Example pattern)

```ts
import { Boom } from '@hapi/boom'
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys'

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_folder')
  const sock = makeWASocket({
    auth: state,
    // ...
  })

  sock.ev.on('connection.update', (update) => {
    if (update.connection !== 'close') return
    const statusCode = (update.lastDisconnect?.error as Boom)?.output?.statusCode
    if (statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.badSession) {
      startSock() // reconnect (same state)
    }
  })
  sock.ev.on('creds.update', saveCreds)
  // ...
}
```

### 5.2 With backoff and max retries

- Maintain **retryCount** and **maxRetries** (e.g. 5).
- On **close**, if status is retryable: **setTimeout(() => startSock(), delay)** with **delay = min(backoffBase * 2^retryCount, maxDelay)** (e.g. 3s, 6s, 12s, …), then increment retryCount.
- On **open**, set **retryCount = 0**.
- If **retryCount > maxRetries**, stop or alert.

### 5.3 Do not reconnect for

- **DisconnectReason.loggedOut** — User or server logged out; clear auth or re-pair.
- **DisconnectReason.badSession** — Session invalid; often need new pairing.
- **DisconnectReason.forbidden** — Blocked/banned.
- **DisconnectReason.multideviceMismatch** — Config/account issue.

### 5.4 waitForConnectionUpdate

- **sock.waitForConnectionUpdate(condition, timeoutMs)** (from `bindWaitForConnectionUpdate(ev)`): resolves when **connection.update** satisfies **condition(update)**, or rejects on **close** (with lastDisconnect error) / timeout. Useful for tests or “wait until open” before sending.

---

## 6. Session persistence best practices

### 6.1 Always persist creds

- **On every `creds.update`** call **saveCreds()** (with multi-file auth) or your equivalent. Creds change on: login (me, lid), pairing, pre-key upload, app state key, routing info, account settings, etc. If you don’t persist, a restart loses the session or causes re-pairing.

### 6.2 Persist the keys store

- **useMultiFileAuthState** persists keys in the same folder. If you use a custom store (e.g. Redis/DB), implement **SignalKeyStore** so that **get** and **set** are durable. Do not drop keys on restart; without them, decryption fails and the server may not accept the connection.

### 6.3 Same auth for reconnect

- Use the **same** **AuthenticationState** (same creds object and same keys backend) when creating a new socket after disconnect. Do not create a new **initAuthCreds()** unless you want a new session (new QR/pairing).

### 6.4 Optional: cache keys for performance

- **makeCacheableSignalKeyStore(store, logger, cache?)** wraps a **SignalKeyStore** with an in-memory cache (e.g. NodeCache, 5 min TTL) to reduce disk/DB reads. Use the same underlying store for persistence; the cache is only for speed.

### 6.5 Production: DB-backed store

- For multiple processes or robustness, implement **SignalKeyStore** and creds persistence yourself:
  - **get(type, ids):** return map of id → value from DB.
  - **set(data):** for each (type, id, value), upsert or delete in DB. Use transactions where possible.
  - **creds:** save to DB on every **creds.update** (or merge and save in a single place).
- Ensure **Buffer**/binary fields (e.g. in sessions, pre-keys) are stored and loaded correctly (e.g. base64 or blob).

### 6.6 Logout

- **sock.logout(msg?)** sends **remove-companion-device** and then calls **end** with **DisconnectReason.loggedOut**. After that, **creds.me** (and possibly server-side session) are invalid. Clear or replace auth state if you want to force re-pairing on next start.

---

*See [baileys-reference.md](./baileys-reference.md) for architecture and events, and [baileys-message-types.md](./baileys-message-types.md) for message handling.*
