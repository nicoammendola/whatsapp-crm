
import 'dotenv/config';
import { prisma } from '../src/config/database';

async function main() {
  console.log('Starting cleanup...');

  // 1. Delete status@broadcast contacts
  console.log('Deleting status@broadcast contacts...');
  const statusContacts = await prisma.contact.deleteMany({
    where: {
      whatsappId: {
        contains: 'status@broadcast',
      },
    },
  });
  console.log(`Deleted ${statusContacts.count} status contacts.`);

  // 2. Clean up "Saved Messages"
  console.log('Cleaning up "Saved Messages"...');
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    // Find Saved Messages contact for this user
    const savedContact = await prisma.contact.findFirst({
      where: {
        userId: user.id,
        OR: [
            { name: 'Saved Messages' },
            { pushName: 'Saved Messages' }
        ]
      },
    });

    if (savedContact) {
        console.log(`Found Saved Messages contact for user ${user.id}: ${savedContact.id}`);
        
        // Delete empty messages
        const deleted = await prisma.message.deleteMany({
            where: {
                contactId: savedContact.id,
                body: null,
                hasMedia: false,
                quotedContent: null
            }
        });
        console.log(`Deleted ${deleted.count} empty/broken messages in Saved Messages.`);
    }
  }

  console.log('Cleanup finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
