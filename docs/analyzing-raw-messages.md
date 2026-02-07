# Analyzing Raw WhatsApp Messages

This document provides SQL queries and analysis tips for the `rawMessage` JSONB field in the `messages` table.

## Overview

The `rawMessage` field stores the complete `WAMessage` object from Baileys, allowing us to:
- Debug message processing issues
- Discover new message types and fields
- Reprocess messages if extraction logic is improved
- Understand WhatsApp's data structures

## Useful SQL Queries

### 1. Find messages with specific content types

```sql
-- Find all messages by content type
SELECT 
  id,
  "whatsappId",
  "fromMe",
  body,
  type,
  "rawMessage"->'message' as message_content,
  "timestamp"
FROM messages
WHERE "rawMessage" IS NOT NULL
ORDER BY "timestamp" DESC
LIMIT 50;
```

### 2. Analyze message content types

```sql
-- Count messages by Baileys content type
SELECT 
  jsonb_object_keys("rawMessage"->'message') as content_type,
  COUNT(*) as count
FROM messages
WHERE "rawMessage" IS NOT NULL
  AND "rawMessage"->'message' IS NOT NULL
GROUP BY content_type
ORDER BY count DESC;
```

### 3. Find messages with contextInfo (quotes, mentions, etc.)

```sql
-- Find messages with contextInfo
SELECT 
  id,
  "whatsappId",
  body,
  "rawMessage"->'message'->'extendedTextMessage'->'contextInfo' as context_info,
  "timestamp"
FROM messages
WHERE "rawMessage"->'message'->'extendedTextMessage'->'contextInfo' IS NOT NULL
ORDER BY "timestamp" DESC
LIMIT 20;
```

### 4. Find poll messages

```sql
-- Find poll messages
SELECT 
  id,
  body,
  "rawMessage"->'message'->'pollCreationMessage' as poll_data,
  "timestamp"
FROM messages
WHERE "rawMessage"->'message'->'pollCreationMessage' IS NOT NULL
ORDER BY "timestamp" DESC;
```

### 5. Find messages with mentions

```sql
-- Find messages with mentions
SELECT 
  id,
  body,
  "rawMessage"->'message'->'extendedTextMessage'->'contextInfo'->'mentionedJid' as mentioned_jids,
  "timestamp"
FROM messages
WHERE "rawMessage"->'message'->'extendedTextMessage'->'contextInfo'->'mentionedJid' IS NOT NULL
ORDER BY "timestamp" DESC;
```

### 6. Find group messages with sender info

```sql
-- Analyze group message sender data
SELECT 
  id,
  "senderJid",
  "senderName",
  "rawMessage"->'key'->'participant' as participant_from_key,
  "rawMessage"->'participant' as participant_field,
  "rawMessage"->'pushName' as push_name,
  body,
  "timestamp"
FROM messages
WHERE "senderJid" IS NOT NULL
ORDER BY "timestamp" DESC
LIMIT 20;
```

### 7. Find messages classified as OTHER

```sql
-- See what's being classified as OTHER type
SELECT 
  id,
  body,
  type,
  "rawMessage"->'message' as message_content,
  "timestamp"
FROM messages
WHERE type = 'OTHER'
  AND "rawMessage" IS NOT NULL
ORDER BY "timestamp" DESC
LIMIT 20;
```

### 8. Find media messages from "me" that might be misclassified

```sql
-- Find media messages from me with contextInfo
SELECT 
  id,
  "fromMe",
  "hasMedia",
  type,
  "quotedContent",
  "rawMessage"->'message' as message_content,
  "timestamp"
FROM messages
WHERE "fromMe" = true
  AND "hasMedia" = true
  AND "rawMessage" IS NOT NULL
ORDER BY "timestamp" DESC
LIMIT 20;
```

### 9. Find status/broadcast messages (if any slipped through)

```sql
-- Find potential status messages
SELECT 
  id,
  "rawMessage"->'key'->'remoteJid' as remote_jid,
  body,
  "timestamp"
FROM messages
WHERE "rawMessage"->'key'->'remoteJid'::text LIKE '%broadcast%'
ORDER BY "timestamp" DESC;
```

### 10. Pretty print a specific message for deep inspection

```sql
-- Deep dive into a specific message
SELECT 
  jsonb_pretty("rawMessage") as pretty_raw_message
FROM messages
WHERE id = 'YOUR_MESSAGE_ID_HERE';
```

## Analysis Workflow

1. **Restart backend and collect messages** - Let the system run and collect various message types

2. **Check content type distribution**:
   ```sql
   SELECT 
     jsonb_object_keys("rawMessage"->'message') as content_type,
     COUNT(*) as count
   FROM messages
   WHERE "rawMessage" IS NOT NULL
   GROUP BY content_type
   ORDER BY count DESC;
   ```

3. **Inspect problematic messages** - Use the queries above to find specific issues:
   - Messages showing as "(empty)"
   - Media messages appearing as replies
   - Group messages without sender names
   - Messages with mentions showing phone numbers

4. **Extract patterns** - For each issue, look at the raw message structure:
   ```sql
   SELECT jsonb_pretty("rawMessage")
   FROM messages
   WHERE body IS NULL AND type != 'OTHER'
   LIMIT 1;
   ```

5. **Update extraction logic** - Based on patterns, update `message.service.ts` to properly extract:
   - Poll data (`pollCreationMessage`)
   - Mentions (`contextInfo.mentionedJid`)
   - Link previews (`extendedTextMessage.matchedText`, `canonicalUrl`)
   - Proper sender info for groups
   - Media captions and metadata

## Common Issues and Where to Look

| Issue | Field to Check | Expected Structure |
|-------|----------------|-------------------|
| Empty messages (polls) | `rawMessage.message.pollCreationMessage` | `{ name: "Question", options: [...] }` |
| Mentions showing numbers | `rawMessage.message.extendedTextMessage.contextInfo.mentionedJid` | Array of JIDs |
| Group sender missing | `rawMessage.key.participant`, `rawMessage.participant`, `rawMessage.pushName` | Should contain sender info |
| Links not parsed | `rawMessage.message.extendedTextMessage` | `{ text, matchedText, canonicalUrl, title, description }` |
| Media as reply | `rawMessage.message.imageMessage.contextInfo` (or videoMessage, etc.) | Check if contextInfo exists when it shouldn't |

## Storage Considerations

- Average raw message size: ~1-3 KB
- For 10,000 messages: ~10-30 MB
- JSONB is indexed and queryable
- Consider adding a retention policy if storage becomes an issue (keep raw messages for last 30 days only)

## Next Steps

After collecting and analyzing raw messages:
1. Document all message types you're receiving
2. Update `MessageType` enum if needed (add POLL, etc.)
3. Enhance extraction functions in `message.service.ts`
4. Add proper display handling in frontend for new types
5. Consider creating a reprocessing script to fix historical messages
