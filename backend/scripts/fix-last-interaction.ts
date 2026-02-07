/**
 * Script to fix stale lastInteraction values by updating them
 * based on the most recent message timestamp for each contact.
 */

import 'dotenv/config';
import { prisma } from '../src/config/database';

async function fixLastInteraction() {
  console.log('🔧 Fixing stale lastInteraction values...\n');

  // Get all contacts with messages
  const contacts = await prisma.contact.findMany({
    include: {
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const contact of contacts) {
    if (contact.messages.length === 0) {
      skipped++;
      continue;
    }

    const latestMessage = contact.messages[0];
    const currentLastInteraction = contact.lastInteraction;
    const latestMessageTime = latestMessage.timestamp;

    // Only update if the latest message is newer than the stored lastInteraction
    // or if lastInteraction is null
    if (!currentLastInteraction || latestMessageTime > currentLastInteraction) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastInteraction: latestMessageTime },
      });

      const contactName = contact.name || contact.pushName || contact.phoneNumber || contact.whatsappId;
      console.log(
        `✅ Updated ${contactName}: ${currentLastInteraction?.toISOString() || 'null'} → ${latestMessageTime.toISOString()}`
      );
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✨ Done! Updated ${updated} contacts, skipped ${skipped} contacts.`);
}

fixLastInteraction()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
