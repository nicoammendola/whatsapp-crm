# Message Handling Fixes - February 7, 2026

## Overview
Fixed multiple message type handling issues discovered through raw message analysis using the new `rawMessage` JSONB field.

## Issues Fixed

### 1. ✅ Media Messages Showing False Quote Detection
**Problem**: Images/videos with captions were incorrectly showing the caption as quoted content.

**Root Cause**: The code treated ANY `contextInfo` as a quote, but `contextInfo` can exist for other reasons (mentions, expiration, statusSourceType, etc.).

**Fix**: Added validation to only treat as quote if `contextInfo.quotedMessage` or `contextInfo.stanzaId` exists.

**Files Modified**:
- `backend/src/services/message.service.ts` (extractQuoted method)

---

### 2. ✅ Polls Showing as Empty
**Problem**: Poll messages displayed as "(empty)" in the UI.

**Root Cause**: 
- Not detecting `pollCreationMessageV3` (and v1, v2) as a message type
- Not extracting poll question from the `name` field

**Fix**: 
- Added `POLL` to MessageType enum
- Updated `getMessageType()` to detect all poll versions
- Updated `extractMessageBody()` to extract poll question
- Created `PollContent` component with poll icon

**Files Modified**:
- `backend/prisma/schema.prisma` (added POLL enum value)
- `backend/src/services/message.service.ts` (detection + extraction)
- `frontend/types/index.ts` (added POLL type)
- `frontend/components/messages/MessageBubble.tsx` (display component)

**Migration**: `20260207190647_add_poll_message_type`

---

### 3. ✅ Poll Votes Cluttering Message List
**Problem**: Each poll vote created a message entry (showing as empty/TEXT).

**Root Cause**: Poll votes (`pollUpdateMessage`) are encrypted metadata, not useful for CRM.

**Fix**: Skip `pollUpdateMessage` type during message processing (similar to reactions).

**Files Modified**:
- `backend/src/services/message.service.ts` (skip pollUpdateMessage)

---

### 4. ✅ Mentions Showing Phone Numbers Instead of Names
**Problem**: Mentions displayed as `@24640244191244` instead of contact names.

**Root Cause**: 
- WhatsApp uses **two different JID formats** for the same user:
  - **@lid format** (Local ID): `24640244191244@lid` - used in mentions, NOT the phone number
  - **@s.whatsapp.net format**: `393289647325@s.whatsapp.net` - the actual phone number
- The number in `@lid` is different from the actual phone number
- Contacts stored with `@s.whatsapp.net`, but mentions use `@lid`
- No mapping between the two formats

**Example**:
```json
// Same user, two different JIDs:
"participant": "24640244191244@lid"        // Used in mentions
"participantAlt": "393289647325@s.whatsapp.net"  // Actual phone number
```

**Fix**: 
1. Added `alternativeJid` field to Contact model to store @lid ↔ @s.whatsapp.net mapping
2. When processing group messages, store BOTH JIDs:
   - Primary: `whatsappId` = `participantAlt` (the real phone number)
   - Alternative: `alternativeJid` = `participant` (the @lid for mention resolution)
3. Store mentioned JIDs in database (`mentionedJids` array field)
4. Enrich messages by searching contacts where `whatsappId` OR `alternativeJid` matches mentioned JIDs
5. Frontend parses message body and replaces `@number` with `@Name`

**Files Modified**:
- `backend/prisma/schema.prisma` (added mentionedJids field + alternativeJid field)
- `backend/src/services/contact.service.ts` (upsertContact accepts alternativeJid)
- `backend/src/services/message.service.ts` (extraction, dual JID storage, enrichment with OR query)
- `frontend/types/index.ts` (added mentions field)
- `frontend/lib/mentions.ts` (NEW: parsing and display name logic)
- `frontend/components/messages/MessageTextWithMentions.tsx` (NEW: rendering component)
- `frontend/components/messages/MessageBubble.tsx` (integration)

**Migrations**: 
- `20260207191254_add_mentioned_jids_to_messages`
- `20260207192323_add_alternative_jid_to_contacts`

---

### 5. ✅ Group Messages Missing Sender Names
**Problem**: Messages in groups from other users didn't show who sent them.

**Status**: Actually already working correctly! The code was extracting `senderName` from `pushName` and displaying it in the UI.

**Verification**: Confirmed with test message from "Eleonora M." showing sender name correctly.

---

### 6. ✅ Reply-to Messages Detection
**Problem**: Some messages incorrectly detected as replies.

**Status**: Fixed as part of issue #1 (false quote detection fix).

---

### 7. ✅ Links in Messages
**Problem**: URLs not displayed properly.

**Status**: Body extraction already works correctly. Link preview rendering is a frontend enhancement (optional).

---

## New Database Fields

### Messages Table
```sql
-- Store complete WAMessage for debugging and future reprocessing
rawMessage JSONB

-- Store JIDs of mentioned users
mentionedJids TEXT[] DEFAULT ARRAY[]::TEXT[]
```

### Contacts Table
```sql
-- Store alternative JID for mention resolution (@lid ↔ @s.whatsapp.net mapping)
alternativeJid TEXT
```

**Why alternativeJid?** WhatsApp uses different JID formats for the same user:
- Primary `whatsappId`: Real phone number (e.g., `393289647325@s.whatsapp.net`)
- Alternative `alternativeJid`: Local ID used in mentions (e.g., `24640244191244@lid`)
- These are DIFFERENT numbers for the same person!

## API Response Changes

### Messages API
Messages now include:
```typescript
{
  // ... existing fields ...
  mentionedJids: string[],  // JIDs of mentioned users
  mentions: Array<{         // NEW: Enriched mention info
    jid: string,
    name: string | null,
    pushName: string | null
  }>
}
```

## Testing Checklist

- [x] Regular text messages
- [x] Media messages with captions (no false quote)
- [x] Polls (display question + icon)
- [x] Poll votes (skipped)
- [x] Group messages with sender names
- [x] Messages with mentions (show names not numbers)
- [x] Reply-to messages (correct quote detection)
- [x] Messages with links (body extracted correctly)

## Raw Message Analysis

All new messages now store the complete `rawMessage` JSONB field for:
- Debugging production issues
- Understanding new message types
- Reprocessing historical messages
- Future enhancements

See `/docs/analyzing-raw-messages.md` for SQL queries and analysis workflows.

## Performance Considerations

### Mention Enrichment
- Single query to fetch all mentioned contacts per message batch
- Bidirectional JID mapping (O(1) lookup)
- Automatic contact creation for group participants

### Contact Creation
- Upsert pattern (idempotent)
- Uses `participantAlt` for accurate @s.whatsapp.net JIDs
- Fire-and-forget for mentioned users (doesn't block message processing)

## Known Limitations

1. **Mention Names**: If a mentioned user hasn't sent a message and isn't in your contact list, their name might not be available (falls back to phone number). This is acceptable as WhatsApp group metadata sync should populate most names.

2. **Link Previews**: Currently just displaying URL text. Rich preview rendering (title, description, thumbnail) could be added as frontend enhancement.

3. **Poll Votes**: Encrypted and not displayed. Could show "X voted on poll" notification if desired.

## Future Enhancements

1. Rich link preview rendering (extract from extendedTextMessage.matchedText, title, description)
2. Poll results display (if vote decryption is added)
3. Mention autocomplete in message composer
4. Contact sync from WhatsApp group metadata for better name resolution
5. Reprocess historical messages to extract mentions/polls from rawMessage

## Files Changed

### Backend
- `backend/prisma/schema.prisma` (2 changes: POLL enum, mentionedJids field)
- `backend/src/services/message.service.ts` (major refactor)
- `backend/src/services/contact.service.ts` (no changes needed)

### Frontend
- `frontend/types/index.ts` (POLL type, mentions field)
- `frontend/lib/mentions.ts` (NEW file)
- `frontend/components/messages/MessageTextWithMentions.tsx` (NEW file)
- `frontend/components/messages/MessageBubble.tsx` (integrated mentions + polls)

### Documentation
- `docs/analyzing-raw-messages.md` (NEW: SQL queries and workflows)
- `docs/message-handling-fixes.md` (THIS FILE)

## Deployment Notes

1. Run migrations:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. Restart backend server (new message processing logic)

3. Deploy frontend (new components + types)

4. Existing messages: 
   - `rawMessage` will be NULL (only new messages have it)
   - `mentionedJids` will be empty (only new messages)
   - Consider reprocessing script if needed

## Verification Steps

After deployment:
1. Send a poll in a group → Should display with poll icon + question
2. Send a message with @mentions → Should show contact names, not numbers
3. Send an image with caption → Should NOT show caption as quote
4. Reply to a message → Should correctly show as quoted
5. Check database for `rawMessage` field populated on new messages
