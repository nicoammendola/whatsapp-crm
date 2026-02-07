# Bug Fix: Duplicate Conversations for Same Contact

## Issue
Users were seeing duplicate conversations for the same contact in the conversations list. For example, a contact "Sebastiano Ammendola" appeared twice with different message threads.

## Root Cause
WhatsApp sometimes uses **@lid** (Local ID) JIDs for certain messages instead of the standard **@s.whatsapp.net** format. When a message arrived with an @lid JID, the system treated it as a completely different contact, creating a duplicate.

### Example
- Normal JID: `393289647325@s.whatsapp.net`
- LID JID: `24640244191244@lid`

Both represent the same contact, but the system was creating separate Contact records for each.

## Impact
- Multiple conversation threads for the same person
- Confusion for users trying to find messages
- Database bloat with duplicate contact records

## Fix
### 1. Immediate Fix: Merged Duplicate Contacts
Created a script (`fix-duplicate-contacts.ts`) that:
- Identifies duplicate contacts with the same name
- Finds @lid JID duplicates
- Merges all messages into the correct contact (with @s.whatsapp.net JID)
- Deletes the duplicate contact records

### 2. Prevention: Skip @lid Messages
Modified the message handler to skip messages with @lid JIDs:

```typescript
// In message.service.ts - handleIncomingMessage
if (normalizedRemoteJid.endsWith('@lid')) {
  console.warn(`${LOG_PREFIX} Skipping message with @lid JID: ${normalizedRemoteJid}`);
  return;
}
```

Also updated contact sync handlers in `baileys.service.ts` to skip @lid contacts during:
- `contacts.upsert` events
- `contacts.update` events
- `messaging-history.set` events
- Contact store syncing

### 3. Why Skip Instead of Normalize?
@lid JIDs don't contain the actual phone number - they're temporary identifiers. The same message/contact will arrive again with the proper @s.whatsapp.net JID, so we can safely skip the @lid version.

## Testing
1. **Manual Test**: Send yourself a photo from a contact and verify only one conversation appears
2. **Database Check**: Run `fix-duplicate-contacts.ts` without `--fix` to scan for duplicates
3. **Backend Logs**: Check for "Skipping @lid" warnings to confirm the fix is working

## Files Changed
- `backend/src/services/message.service.ts` - Skip @lid messages
- `backend/src/services/baileys.service.ts` - Skip @lid contacts in sync
- `backend/scripts/fix-duplicate-contacts.ts` - Utility to find and merge duplicates
- `backend/src/controllers/debug.controller.ts` - Debug endpoint for investigations

## Future Considerations
- Monitor for other JID formats that might cause similar issues
- Consider adding a migration to clean up any remaining @lid contacts
- Add automated tests to prevent regression

## Related
- WhatsApp Baileys library: https://github.com/WhiskeySockets/Baileys
- JID (Jabber ID) documentation: Standard WhatsApp identifier format
