import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

export async function debugConversations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId!;

    // Get all contacts
    const contacts = await prisma.contact.findMany({
      where: { userId },
      select: {
        id: true,
        whatsappId: true,
        name: true,
        pushName: true,
        phoneNumber: true,
      },
    });

    // Get message count per contact
    const messageCounts = await Promise.all(
      contacts.map(async (contact) => ({
        contactId: contact.id,
        name: contact.name || contact.pushName,
        whatsappId: contact.whatsappId,
        messageCount: await prisma.message.count({
          where: { contactId: contact.id, userId },
        }),
      }))
    );

    // Run the same query as getConversations
    const rawQuery = await prisma.$queryRaw<
      Array<{ contactId: string; lastTs: Date; unreadCount: bigint }>
    >`
      SELECT m."contactId",
             MAX(m."timestamp") as "lastTs",
             COUNT(*) FILTER (WHERE m."isRead" = false AND m."fromMe" = false)::bigint as "unreadCount"
      FROM messages m
      WHERE m."userId" = ${userId}
      GROUP BY m."contactId"
      ORDER BY "lastTs" DESC NULLS LAST
    `;

    // Check for duplicates in query result
    const contactIdCounts = new Map<string, number>();
    for (const row of rawQuery) {
      const count = contactIdCounts.get(row.contactId) || 0;
      contactIdCounts.set(row.contactId, count + 1);
    }

    const duplicates = Array.from(contactIdCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([contactId, count]) => ({ contactId, count }));

    // Fetch contacts for the query results
    const queryContactIds = rawQuery.map((r) => r.contactId);
    const queryContacts = await prisma.contact.findMany({
      where: { id: { in: queryContactIds }, userId },
    });

    // Check for duplicate names
    const nameMap = new Map<string, Array<{ id: string; whatsappId: string }>>();
    for (const contact of queryContacts) {
      const name = contact.name || contact.pushName || contact.whatsappId;
      const existing = nameMap.get(name) || [];
      existing.push({ id: contact.id, whatsappId: contact.whatsappId });
      nameMap.set(name, existing);
    }

    const duplicateNames = Array.from(nameMap.entries())
      .filter(([_, contacts]) => contacts.length > 1)
      .map(([name, contacts]) => ({ name, contacts }));

    res.json({
      totalContacts: contacts.length,
      totalConversations: rawQuery.length,
      messageCounts,
      duplicateContactIds: duplicates,
      duplicateNames,
      rawQuerySample: rawQuery.slice(0, 10).map((r) => ({
        contactId: r.contactId,
        contact: queryContacts.find((c) => c.id === r.contactId),
        lastTs: r.lastTs,
        unreadCount: Number(r.unreadCount),
      })),
    });
  } catch (error) {
    console.error('Debug conversations error:', error);
    res.status(500).json({ error: 'Failed to debug conversations' });
  }
}
