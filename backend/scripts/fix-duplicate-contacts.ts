import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '../.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function findAndFixDuplicates() {
  console.log('=== Finding Duplicate Contacts ===\n');

  // Get all contacts
  const contacts = await prisma.contact.findMany({
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  // Group by name
  const nameGroups = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const name = contact.name || contact.pushName || '';
    if (!name) continue;
    
    const existing = nameGroups.get(name) || [];
    existing.push(contact);
    nameGroups.set(name, existing);
  }

  // Find duplicates
  const duplicates = Array.from(nameGroups.entries())
    .filter(([_, contacts]) => contacts.length > 1);

  console.log(`Found ${duplicates.length} names with multiple contacts:\n`);

  for (const [name, dupes] of duplicates) {
    console.log(`\n📛 Name: "${name}" has ${dupes.length} contacts:`);
    
    for (const contact of dupes) {
      const phone = contact.whatsappId.split('@')[0];
      console.log(`  - ID: ${contact.id}`);
      console.log(`    whatsappId: ${contact.whatsappId}`);
      console.log(`    Phone: ${phone}`);
      console.log(`    Messages: ${contact._count.messages}`);
    }

    // Check if one is @lid and one is @s.whatsapp.net with matching phone
    const lidContact = dupes.find((c) => c.whatsappId.endsWith('@lid'));
    const normalContacts = dupes.filter((c) => c.whatsappId.endsWith('@s.whatsapp.net'));

    if (lidContact && normalContacts.length > 0) {
      console.log(`\n  ⚠️  Found @lid contact that should be merged!`);
      console.log(`     LID contact: ${lidContact.id} (${lidContact.whatsappId})`);
      
      // Try to find matching phone number
      const lidPhone = lidContact.whatsappId.split('@')[0];
      const matchingNormal = normalContacts.find((c) => {
        const normalPhone = c.whatsappId.split('@')[0];
        return normalPhone === lidPhone || c.phoneNumber === lidPhone;
      });

      if (matchingNormal) {
        console.log(`     ✅ Found match: ${matchingNormal.id} (${matchingNormal.whatsappId})`);
        console.log(`\n     Would merge ${lidContact._count.messages} messages from LID to normal contact`);
      } else {
        console.log(`     ⚠️  No matching normal contact found by phone`);
        console.log(`     Normal contacts:`, normalContacts.map(c => ({
          id: c.id,
          whatsappId: c.whatsappId,
          phone: c.whatsappId.split('@')[0],
        })));
      }
    }
  }

  // Special check for Sebastiano
  console.log('\n\n=== Special Check: Sebastiano Ammendola ===\n');
  const sebastianoContacts = contacts.filter(
    (c) => (c.name?.includes('Sebastiano') || c.pushName?.includes('Sebastiano'))
  );

  if (sebastianoContacts.length > 0) {
    console.log(`Found ${sebastianoContacts.length} contacts:`);
    for (const contact of sebastianoContacts) {
      console.log(`\n  Contact ID: ${contact.id}`);
      console.log(`  whatsappId: ${contact.whatsappId}`);
      console.log(`  name: ${contact.name}`);
      console.log(`  pushName: ${contact.pushName}`);
      console.log(`  phoneNumber: ${contact.phoneNumber}`);
      console.log(`  Messages: ${contact._count.messages}`);
      
      // Show latest message
      const latestMsg = await prisma.message.findFirst({
        where: { contactId: contact.id },
        orderBy: { timestamp: 'desc' },
        select: {
          body: true,
          type: true,
          timestamp: true,
          fromMe: true,
        },
      });
      
      if (latestMsg) {
        console.log(`  Latest message: ${latestMsg.type} at ${latestMsg.timestamp}`);
        console.log(`    ${latestMsg.fromMe ? 'You' : 'Them'}: ${latestMsg.body || `[${latestMsg.type}]`}`);
      }
    }

    // Ask if we should merge
    if (sebastianoContacts.length > 1) {
      console.log('\n\n⚠️  MERGE RECOMMENDED');
      console.log('Run this script with --fix to merge these contacts');
    }
  }
}

async function fixDuplicates() {
  console.log('=== Fixing Duplicates ===\n');
  
  // Find "Sebastiano Ammendola" contacts only (not other Sebastianos)
  const sebastianoContacts = await prisma.contact.findMany({
    where: {
      OR: [
        { name: 'Sebastiano Ammendola' },
        { pushName: 'Sebastiano Ammendola' },
      ],
    },
    include: {
      _count: {
        select: { messages: true },
      },
    },
  });

  if (sebastianoContacts.length <= 1) {
    console.log('No duplicates found for Sebastiano Ammendola');
    return;
  }

  console.log(`Found ${sebastianoContacts.length} "Sebastiano Ammendola" contacts:\n`);
  
  for (const contact of sebastianoContacts) {
    console.log(`  - ${contact.id}`);
    console.log(`    whatsappId: ${contact.whatsappId}`);
    console.log(`    name: ${contact.name}`);
    console.log(`    pushName: ${contact.pushName}`);
    console.log(`    messages: ${contact._count.messages}\n`);
  }

  // Find the "real" one (with @s.whatsapp.net and phone 393289647325)
  const realContact = sebastianoContacts.find(
    (c) => c.whatsappId === '393289647325@s.whatsapp.net'
  );

  if (!realContact) {
    console.log('⚠️  Could not find the real contact (393289647325@s.whatsapp.net)');
    console.log('Available contacts:', sebastianoContacts.map(c => c.whatsappId));
    return;
  }

  console.log(`✅ Real contact identified: ${realContact.id} (${realContact.whatsappId})`);
  console.log(`   Current messages: ${realContact._count.messages}\n`);

  // Find duplicates (not the real one)
  const duplicateContacts = sebastianoContacts.filter((c) => c.id !== realContact.id);

  console.log(`🔄 Will merge ${duplicateContacts.length} duplicate(s):\n`);

  for (const duplicate of duplicateContacts) {
    console.log(`  Duplicate: ${duplicate.id} (${duplicate.whatsappId})`);
    console.log(`  Messages to merge: ${duplicate._count.messages}`);

    // Move all messages from duplicate to real contact
    const updateResult = await prisma.message.updateMany({
      where: { contactId: duplicate.id },
      data: { contactId: realContact.id },
    });

    console.log(`  ✅ Moved ${updateResult.count} messages`);

    // Delete the duplicate contact
    await prisma.contact.delete({
      where: { id: duplicate.id },
    });

    console.log(`  ✅ Deleted duplicate contact\n`);
  }

  const finalCount = await prisma.message.count({
    where: { contactId: realContact.id },
  });

  console.log(`✅ Done! All messages now in one contact.`);
  console.log(`   Contact: ${realContact.id} (${realContact.whatsappId})`);
  console.log(`   Total messages: ${finalCount}`);
}

const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');

if (shouldFix) {
  fixDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  findAndFixDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
