# User Testing Plan — WhatsApp CRM Improvements

Manual browser tests to verify that the WhatsApp CRM improvements work end-to-end. Run these after the backend and frontend are deployed (or running locally). Use a real WhatsApp account connected via the app (QR or pairing code).

---

## Prerequisites

- [ ] Backend is running and connected to Supabase (DB + optional Realtime).
- [ ] Frontend is running (e.g. `npm run dev` in `frontend/`).
- [ ] You are logged in and WhatsApp is connected (QR or pairing code).
- [ ] You have at least: one normal contact with messages, one group (optional), and your **Saved Messages** (message-to-self) chat used for reminders.

---

## 1. Status messages (stories) not stored

**Goal:** Confirm that WhatsApp status/stories do not appear as conversations or messages.

- [ ] In WhatsApp (phone or web), post a status/story if you can.
- [ ] In the CRM app, open the conversations list and refresh or wait for sync.
- [ ] **Pass:** No conversation or thread appears for "Status" or "Stories"; no status content in any chat.
- [ ] **Fail:** A chat appears for status, or status messages appear inside another conversation.

---

## 2. Saved Messages (chat with self)

**Goal:** Your reminders to yourself show correct text and the chat is labeled clearly.

- [ ] Open the **conversations list** in the CRM.
- [ ] **Pass:** A conversation appears with a clear label (e.g. "Saved Messages" or "Notes to self"), not an empty name or raw phone number.
- [ ] Open that conversation (Saved Messages).
- [ ] **Pass:** All messages show the **actual reminder text** (and media if any), not "(empty)".
- [ ] Send a new message to yourself from the CRM (e.g. "Test reminder").
- [ ] **Pass:** The new message appears with the correct body; no "(empty)".
- [ ] **Fail:** Any message in the self-chat shows "(empty)" or wrong content.

---

## 3. Profile pictures

**Goal:** Contact and conversation avatars show profile pictures where available.

- [ ] In the **conversations list**, find a contact that has a profile picture in WhatsApp.
- [ ] **Pass:** The list shows their **profile picture** (or initials if no picture).
- [ ] Open that conversation.
- [ ] **Pass:** The **thread header** shows the same profile picture (or initials).
- [ ] If you have a **group** chat: open it and check that sender avatars/labels look correct (profile pic or initials).
- [ ] **Fail:** Avatar is always a generic icon or wrong image when a profile picture exists in WhatsApp.

---

## 4. Reply-to (quoted) messages

**Goal:** When someone (or you) replies to a message, the original message is visible above the reply.

- [ ] In WhatsApp (phone or web), send a **reply** to an existing message in a chat (e.g. long-press → Reply).
- [ ] In the CRM, open that conversation and refresh or wait for sync.
- [ ] **Pass:** The reply appears with a **quoted block** above it showing the original message text (or a short placeholder for media). No "(empty)" for the quote.
- [ ] Send a **reply from the CRM** (if the UI supports it): quote an existing message and send a reply.
- [ ] **Pass:** Your reply appears with the quoted message shown above your reply text.
- [ ] **Fail:** Replies show "(empty)" or no quoted block at all.

---

## 5. Reactions

**Goal:** Reactions on messages are visible in the CRM.

- [ ] In WhatsApp, add a **reaction** (e.g. 👍) to a message in a chat.
- [ ] In the CRM, open that conversation (refresh or wait for sync / real-time).
- [ ] **Pass:** The message shows the **reaction** (emoji) below or next to it (and count if the UI shows it).
- [ ] If the CRM supports **adding** a reaction from the UI, add one and confirm it appears.
- [ ] **Fail:** Reactions never appear, or they appear on the wrong message.

---

## 6. Group sender identity

**Goal:** In group chats, each message shows who sent it.

- [ ] Open a **group** conversation in the CRM.
- [ ] **Pass:** Each message (that is not from you) shows a **sender label or avatar** (name or initials) above or beside the bubble, so you can tell who wrote it.
- [ ] **Pass:** Sender identity is stable (e.g. same color/initials for the same person).
- [ ] **Fail:** All non-you messages look the same with no sender info.

---

## 7. Real-time new messages (no reload)

**Goal:** New messages appear in the open conversation without refreshing the page.

- [ ] Open a conversation in the CRM and keep it visible.
- [ ] From your **phone or another device**, send a message to that chat (or have someone else send one).
- [ ] **Pass:** The new message **appears in the thread** within a few seconds **without** reloading the page or switching away and back.
- [ ] **Fail:** You must refresh the page or switch to another conversation and back to see the new message.

---

## 8. SPA navigation (no full page reload)

**Goal:** Switching between conversations does not reload the whole page.

- [ ] Open a conversation (e.g. Contact A).
- [ ] Click another conversation in the list (Contact B).
- [ ] **Pass:** The thread content **switches to Contact B** without a **full browser reload** (no white flash, URL may change without full reload).
- [ ] Switch back to Contact A.
- [ ] **Pass:** Again, no full reload; the list stays visible and the thread updates.
- [ ] **Fail:** Each click causes a full page reload.

---

## 9. Message send UX (optimistic, no reload)

**Goal:** Sending a message shows it immediately and does not refetch the whole thread.

- [ ] Open any conversation.
- [ ] Send a **new text message** (e.g. "Test send").
- [ ] **Pass:** The message **appears in the thread right away** (optimistic), then stays or updates with server data (e.g. timestamp). The page does **not** reload and the thread does **not** briefly clear and refetch.
- [ ] **Pass:** No **duplicate** of the same message (one from optimistic, one from server/real-time).
- [ ] **Optional:** Disconnect the network and send a message; you should see an error or retry option, not a silent failure.
- [ ] **Fail:** Message appears only after reload, or the whole thread refetches and flickers, or the message appears twice.

---

## 10. Quick smoke checklist

If time is short, at least run:

1. **Saved Messages:** Open it; messages show real text, not "(empty)".
2. **Profile picture:** One contact shows profile picture in list and in thread header.
3. **Reply:** One reply shows the quoted message above the reply.
4. **Send:** Send one message; it appears immediately without page reload and without duplicate.
5. **Real-time:** With a conversation open, receive one message from another device; it appears without reload.

---

## Notes

- If a test fails, note: **feature**, **expected**, **actual**, and **browser/device**.
- For real-time tests, ensure Supabase Realtime is enabled for the `messages` table and that the frontend is subscribed (see implementation plan).
- For profile pictures, some contacts may not have a picture set in WhatsApp; use a contact you know has a photo.
