import { prisma } from '../config/database';

// Frequency target mapping in days
const FREQUENCY_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

type UrgencyLevel = 'low' | 'medium' | 'high';

interface ContactWithLastMessage {
  id: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  whatsappId: string;
  profilePicUrl: string | null;
  relationshipType: string | null;
  lastMessageSnippet: string | null;
  lastMessageTime: Date;
  urgency: UrgencyLevel;
}

interface ContactToReachOut {
  id: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  whatsappId: string;
  profilePicUrl: string | null;
  contactFrequency: string;
  lastInteraction: Date | null;
  daysOverdue: number;
  urgency: UrgencyLevel;
}

interface UpcomingBirthday {
  contactId: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  profilePicUrl: string | null;
  birthday: Date;
  age: number;
  daysUntil: number;
  urgency: UrgencyLevel;
}

interface ImportantDate {
  contactId: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  profilePicUrl: string | null;
  fieldName: string;
  fieldLabel: string;
  date: Date;
  yearsAgo: number | null;
  daysUntil: number;
  urgency: UrgencyLevel;
}

export class DashboardService {
  /**
   * Get today's message statistics
   */
  async getTodayStats(userId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Get all messages from today
    const todayMessages = await prisma.message.findMany({
      where: {
        userId,
        timestamp: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      select: {
        fromMe: true,
        contactId: true,
      },
    });

    const sent = todayMessages.filter(m => m.fromMe).length;
    const received = todayMessages.filter(m => !m.fromMe).length;
    const uniqueContacts = new Set(todayMessages.map(m => m.contactId)).size;

    return {
      totalMessages: todayMessages.length,
      sent,
      received,
      uniqueContacts,
    };
  }

  /**
   * Get active contacts overview for different time periods
   */
  async getActiveContactsOverview(userId: string) {
    const now = new Date();
    
    // Calculate date thresholds
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Get counts for each period
    const [today, last7Days, last30Days, last90Days, total] = await Promise.all([
      prisma.contact.count({
        where: {
          userId,
          lastInteraction: { gte: startOfToday },
        },
      }),
      prisma.contact.count({
        where: {
          userId,
          lastInteraction: { gte: sevenDaysAgo },
        },
      }),
      prisma.contact.count({
        where: {
          userId,
          lastInteraction: { gte: thirtyDaysAgo },
        },
      }),
      prisma.contact.count({
        where: {
          userId,
          lastInteraction: { gte: ninetyDaysAgo },
        },
      }),
      prisma.contact.count({ where: { userId } }),
    ]);

    return {
      today,
      last7Days,
      last30Days,
      last90Days,
      total,
    };
  }

  /**
   * Get contacts awaiting replies (last message not from user)
   */
  async getAwaitingReplies(userId: string, limit = 10): Promise<ContactWithLastMessage[]> {
    // Get all contacts with their last message
    const contacts = await prisma.contact.findMany({
      where: { 
        userId, 
        isGroup: false,
      },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { 
            fromMe: true, 
            body: true, 
            timestamp: true,
            type: true,
          },
        },
      },
    });

    // Filter contacts where last message is not from user
    const awaitingReplies = contacts
      .filter(c => c.messages.length > 0 && !c.messages[0].fromMe)
      .map(contact => {
        const lastMessage = contact.messages[0];
        const hoursAgo = (Date.now() - new Date(lastMessage.timestamp).getTime()) / (1000 * 60 * 60);
        
        // Calculate urgency based on time elapsed
        let urgency: UrgencyLevel = 'low';
        if (hoursAgo > 24) {
          urgency = 'high';
        } else if (hoursAgo > 72) {
          urgency = 'medium';
        }

        // Create message snippet
        let snippet = lastMessage.body || '';
        if (lastMessage.type !== 'TEXT') {
          snippet = `(${lastMessage.type.toLowerCase()})`;
        } else if (snippet.length > 60) {
          snippet = snippet.slice(0, 60) + '…';
        }

        return {
          id: contact.id,
          name: contact.name,
          pushName: contact.pushName,
          phoneNumber: contact.phoneNumber,
          whatsappId: contact.whatsappId,
          profilePicUrl: contact.profilePicUrl,
          relationshipType: contact.relationshipType,
          lastMessageSnippet: snippet,
          lastMessageTime: lastMessage.timestamp,
          urgency,
        };
      })
      .sort((a, b) => a.lastMessageTime.getTime() - b.lastMessageTime.getTime()) // Oldest first (most urgent)
      .slice(0, limit);

    return awaitingReplies;
  }

  /**
   * Get contacts that need to be reached out to based on frequency targets
   */
  async getContactsToReachOut(userId: string, limit = 10): Promise<ContactToReachOut[]> {
    const now = new Date();

    // Get contacts with frequency targets set, including their most recent message
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        isGroup: false,
        contactFrequency: { not: null },
      },
      select: {
        id: true,
        name: true,
        pushName: true,
        phoneNumber: true,
        whatsappId: true,
        profilePicUrl: true,
        contactFrequency: true,
        lastInteraction: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { timestamp: true },
        },
      },
    });

    const toContact: ContactToReachOut[] = [];

    for (const contact of contacts) {
      const frequency = contact.contactFrequency;
      if (!frequency || !FREQUENCY_DAYS[frequency]) continue;

      const targetDays = FREQUENCY_DAYS[frequency];
      
      // Use the most recent timestamp between lastInteraction and latest message
      let lastInteraction = contact.lastInteraction || new Date(0);
      if (contact.messages.length > 0 && contact.messages[0].timestamp) {
        const latestMessageTime = new Date(contact.messages[0].timestamp);
        if (latestMessageTime > lastInteraction) {
          lastInteraction = latestMessageTime;
        }
      }
      
      const daysSinceLastInteraction = Math.floor(
        (now.getTime() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysOverdue = daysSinceLastInteraction - targetDays;

      // Only include if overdue or approaching (80%+ of target)
      if (daysSinceLastInteraction >= targetDays * 0.8) {
        let urgency: UrgencyLevel = 'low';
        
        if (daysOverdue > targetDays) {
          // More than 2x target overdue
          urgency = 'high';
        } else if (daysOverdue > 0) {
          // Between 1x and 2x target overdue
          urgency = 'medium';
        }

        toContact.push({
          id: contact.id,
          name: contact.name,
          pushName: contact.pushName,
          phoneNumber: contact.phoneNumber,
          whatsappId: contact.whatsappId,
          profilePicUrl: contact.profilePicUrl,
          contactFrequency: frequency,
          lastInteraction: lastInteraction.getTime() > 0 ? lastInteraction : null,
          daysOverdue: Math.max(0, daysOverdue),
          urgency,
        });
      }
    }

    // Sort by days overdue (most overdue first)
    toContact.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return toContact.slice(0, limit);
  }

  /**
   * Get upcoming birthdays with pagination
   */
  async getUpcomingBirthdaysPaginated(
    userId: string,
    limit: number = 5,
    offset: number = 0
  ): Promise<{ birthdays: UpcomingBirthday[]; total: number; hasMore: boolean }> {
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        isGroup: false,
        birthday: { not: null },
      },
      select: {
        id: true,
        name: true,
        pushName: true,
        phoneNumber: true,
        profilePicUrl: true,
        birthday: true,
      },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const upcoming: UpcomingBirthday[] = [];

    for (const contact of contacts) {
      if (!contact.birthday) continue;

      const birthday = new Date(contact.birthday);
      const birthYear = birthday.getFullYear();
      
      // Calculate next birthday occurrence
      let nextBirthday = new Date(currentYear, birthday.getMonth(), birthday.getDate());
      
      // If birthday already passed this year, use next year
      if (nextBirthday < now) {
        nextBirthday = new Date(currentYear + 1, birthday.getMonth(), birthday.getDate());
      }

      const daysUntil = Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const age = currentYear - birthYear + (nextBirthday.getFullYear() > currentYear ? 1 : 0);
      
      // Calculate urgency
      let urgency: UrgencyLevel = 'low';
      if (daysUntil === 0) {
        urgency = 'high'; // Today
      } else if (daysUntil <= 7) {
        urgency = 'high'; // This week
      } else if (daysUntil <= 14) {
        urgency = 'medium'; // Next 2 weeks
      }

      upcoming.push({
        contactId: contact.id,
        name: contact.name,
        pushName: contact.pushName,
        phoneNumber: contact.phoneNumber,
        profilePicUrl: contact.profilePicUrl,
        birthday: birthday,
        age,
        daysUntil,
        urgency,
      });
    }

    // Sort by days until (soonest first)
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    const total = upcoming.length;
    const paginatedBirthdays = upcoming.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      birthdays: paginatedBirthdays,
      total,
      hasMore,
    };
  }

  /**
   * Get next 5 upcoming birthdays (legacy method for backward compatibility)
   */
  async getUpcomingBirthdays(userId: string, limit = 5): Promise<UpcomingBirthday[]> {
    const result = await this.getUpcomingBirthdaysPaginated(userId, limit, 0);
    return result.birthdays;
  }

  /**
   * Parse customFields for date values and get upcoming important dates with pagination
   */
  async getUpcomingImportantDatesPaginated(
    userId: string,
    limit: number = 5,
    offset: number = 0
  ): Promise<{ dates: ImportantDate[]; total: number; hasMore: boolean }> {
    // Get all contacts - we'll filter by customFields in memory
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        isGroup: false,
      },
      select: {
        id: true,
        name: true,
        pushName: true,
        phoneNumber: true,
        profilePicUrl: true,
        customFields: true,
      },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const upcoming: ImportantDate[] = [];

    for (const contact of contacts) {
      if (!contact.customFields || typeof contact.customFields !== 'object') continue;

      const fields = contact.customFields as Record<string, any>;

      for (const [fieldName, value] of Object.entries(fields)) {
        // Handle both plain string dates and structured date objects
        let dateString: string | null = null;
        
        if (typeof value === 'string') {
          // Direct string format: "fieldName": "1956-10-29"
          dateString = value;
        } else if (typeof value === 'object' && value !== null) {
          // Structured format: "fieldName": { "type": "date", "value": "1956-10-29" }
          const obj = value as { type?: string; value?: string };
          if (obj.type === 'date' && typeof obj.value === 'string') {
            dateString = obj.value;
          }
        }
        
        // Skip if no valid date string found
        if (!dateString) continue;
        
        // Try to parse as date
        const parsedDate = new Date(dateString);
        if (isNaN(parsedDate.getTime())) continue;

        // Check if it's a reasonable date (between 1900 and 2100)
        const year = parsedDate.getFullYear();
        if (year < 1900 || year > 2100) continue;

        const originalYear = parsedDate.getFullYear();
        
        // Calculate next occurrence
        let nextOccurrence = new Date(currentYear, parsedDate.getMonth(), parsedDate.getDate());
        
        // If date already passed this year, use next year
        if (nextOccurrence < now) {
          nextOccurrence = new Date(currentYear + 1, parsedDate.getMonth(), parsedDate.getDate());
        }

        const daysUntil = Math.ceil((nextOccurrence.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const yearsAgo = currentYear - originalYear + (nextOccurrence.getFullYear() > currentYear ? 1 : 0);
        
        // Calculate urgency
        let urgency: UrgencyLevel = 'low';
        if (daysUntil === 0) {
          urgency = 'high'; // Today
        } else if (daysUntil <= 7) {
          urgency = 'high'; // This week
        } else if (daysUntil <= 14) {
          urgency = 'medium'; // Next 2 weeks
        }

        // Convert field name to readable label
        const fieldLabel = fieldName
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        upcoming.push({
          contactId: contact.id,
          name: contact.name,
          pushName: contact.pushName,
          phoneNumber: contact.phoneNumber,
          profilePicUrl: contact.profilePicUrl,
          fieldName,
          fieldLabel,
          date: parsedDate,
          yearsAgo: yearsAgo > 0 ? yearsAgo : null,
          daysUntil,
          urgency,
        });
      }
    }

    // Sort by days until (soonest first)
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    const total = upcoming.length;
    const paginatedDates = upcoming.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      dates: paginatedDates,
      total,
      hasMore,
    };
  }

  /**
   * Parse customFields for date values and get next 5 upcoming important dates (legacy method)
   */
  async getUpcomingImportantDates(userId: string, limit = 5): Promise<ImportantDate[]> {
    const result = await this.getUpcomingImportantDatesPaginated(userId, limit, 0);
    return result.dates;
  }

  /**
   * Calculate relationship health score based on contacts meeting frequency targets
   */
  async calculateRelationshipHealth(userId: string) {
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        isGroup: false,
        contactFrequency: { not: null },
      },
      select: {
        id: true,
        name: true,
        pushName: true,
        phoneNumber: true,
        contactFrequency: true,
        lastInteraction: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { timestamp: true },
        },
      },
    });

    if (contacts.length === 0) {
      return {
        score: 100,
        onTrack: 0,
        needsAttention: 0,
        atRisk: 0,
        total: 0,
        topSuggestion: null,
      };
    }

    const now = new Date();
    let onTrack = 0;
    let needsAttention = 0;
    let atRisk = 0;
    let mostOverdueContact: { name: string; daysOverdue: number } | null = null;
    let maxOverdue = 0;

    for (const contact of contacts) {
      const frequency = contact.contactFrequency;
      if (!frequency || !FREQUENCY_DAYS[frequency]) continue;

      const targetDays = FREQUENCY_DAYS[frequency];
      
      // Use the most recent timestamp between lastInteraction and latest message
      let lastInteraction = contact.lastInteraction || new Date(0);
      if (contact.messages.length > 0 && contact.messages[0].timestamp) {
        const latestMessageTime = new Date(contact.messages[0].timestamp);
        if (latestMessageTime > lastInteraction) {
          lastInteraction = latestMessageTime;
        }
      }
      
      const daysSinceLastInteraction = Math.floor(
        (now.getTime() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysOverdue = daysSinceLastInteraction - targetDays;

      if (daysOverdue > targetDays) {
        // More than 2x overdue - at risk
        atRisk++;
        if (daysOverdue > maxOverdue) {
          maxOverdue = daysOverdue;
          const displayName = contact.name || contact.pushName || contact.phoneNumber || 'Unknown';
          mostOverdueContact = { name: displayName, daysOverdue };
        }
      } else if (daysOverdue > 0) {
        // Between 1x and 2x overdue - needs attention
        needsAttention++;
      } else {
        // On track
        onTrack++;
      }
    }

    const score = Math.round((onTrack / contacts.length) * 100);

    let topSuggestion: string | null = null;
    if (mostOverdueContact) {
      topSuggestion = `Check in with ${mostOverdueContact.name} (${mostOverdueContact.daysOverdue} days overdue)`;
    } else if (needsAttention > 0) {
      topSuggestion = `${needsAttention} ${needsAttention === 1 ? 'contact needs' : 'contacts need'} attention`;
    }

    return {
      score,
      onTrack,
      needsAttention,
      atRisk,
      total: contacts.length,
      topSuggestion,
    };
  }

  /**
   * Get contacts by health status (onTrack, needsAttention, atRisk)
   */
  async getContactsByHealthStatus(
    userId: string, 
    status: 'onTrack' | 'needsAttention' | 'atRisk',
    limit: number = 20,
    offset: number = 0
  ) {
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        isGroup: false,
        contactFrequency: { not: null },
      },
      select: {
        id: true,
        name: true,
        pushName: true,
        phoneNumber: true,
        profilePicUrl: true,
        contactFrequency: true,
        lastInteraction: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { 
            timestamp: true,
            body: true,
            type: true,
          },
        },
      },
    });

    const now = new Date();
    const filteredContacts: Array<{
      id: string;
      name: string | null;
      pushName: string | null;
      phoneNumber: string | null;
      profilePicUrl: string | null;
      lastMessageSnippet: string | null;
      lastMessageTime: Date | null;
      contactFrequency: string | null;
      daysOverdue: number;
    }> = [];

    for (const contact of contacts) {
      const frequency = contact.contactFrequency;
      if (!frequency || !FREQUENCY_DAYS[frequency]) continue;

      const targetDays = FREQUENCY_DAYS[frequency];
      
      // Use the most recent timestamp between lastInteraction and latest message
      let lastInteraction = contact.lastInteraction || new Date(0);
      if (contact.messages.length > 0 && contact.messages[0].timestamp) {
        const latestMessageTime = new Date(contact.messages[0].timestamp);
        if (latestMessageTime > lastInteraction) {
          lastInteraction = latestMessageTime;
        }
      }
      
      const daysSinceLastInteraction = Math.floor(
        (now.getTime() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysOverdue = daysSinceLastInteraction - targetDays;

      let contactStatus: 'onTrack' | 'needsAttention' | 'atRisk';
      if (daysOverdue > targetDays) {
        contactStatus = 'atRisk';
      } else if (daysOverdue > 0) {
        contactStatus = 'needsAttention';
      } else {
        contactStatus = 'onTrack';
      }

      if (contactStatus === status) {
        // Get last message snippet
        let lastMessageSnippet: string | null = null;
        let lastMessageTime: Date | null = null;
        
        if (contact.messages.length > 0) {
          const lastMessage = contact.messages[0];
          lastMessageTime = new Date(lastMessage.timestamp);
          
          if (lastMessage.type === 'TEXT' && lastMessage.body) {
            lastMessageSnippet = lastMessage.body.length > 60 
              ? lastMessage.body.slice(0, 60) + '…' 
              : lastMessage.body;
          } else if (lastMessage.type !== 'TEXT') {
            lastMessageSnippet = `(${lastMessage.type.toLowerCase()})`;
          }
        }

        filteredContacts.push({
          id: contact.id,
          name: contact.name,
          pushName: contact.pushName,
          phoneNumber: contact.phoneNumber,
          profilePicUrl: contact.profilePicUrl,
          lastMessageSnippet,
          lastMessageTime,
          contactFrequency: frequency,
          daysOverdue: Math.max(0, daysOverdue),
        });
      }
    }

    // Sort by days overdue (most overdue first) for needsAttention and atRisk
    // For onTrack, sort by last message time (most recent first)
    if (status === 'needsAttention' || status === 'atRisk') {
      filteredContacts.sort((a, b) => {
        const daysOverdueA = a.daysOverdue || 0;
        const daysOverdueB = b.daysOverdue || 0;
        return daysOverdueB - daysOverdueA; // Most overdue first
      });
    } else {
      filteredContacts.sort((a, b) => {
        const timeA = a.lastMessageTime?.getTime() || 0;
        const timeB = b.lastMessageTime?.getTime() || 0;
        return timeB - timeA; // Most recent first
      });
    }

    // Apply pagination
    const total = filteredContacts.length;
    const paginatedContacts = filteredContacts.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      contacts: paginatedContacts,
      total,
      hasMore,
    };
  }

  /**
   * Get contacts awaiting replies with pagination (last message not from user)
   */
  async getAwaitingRepliesPaginated(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ) {
    // Get all contacts with their last message, excluding those marked as okWithoutReply
    const contacts = await prisma.contact.findMany({
      where: { 
        userId, 
        isGroup: false,
        okWithoutReply: false, // Exclude contacts marked as OK without reply
      },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { 
            fromMe: true, 
            body: true, 
            timestamp: true,
            type: true,
          },
        },
      },
    });

    // Filter contacts where last message is not from user
    const awaitingReplies = contacts
      .filter(c => c.messages.length > 0 && !c.messages[0].fromMe)
      .map(contact => {
        const lastMessage = contact.messages[0];
        
        // Create message snippet
        let snippet = lastMessage.body || '';
        if (lastMessage.type !== 'TEXT') {
          snippet = `(${lastMessage.type.toLowerCase()})`;
        } else if (snippet.length > 60) {
          snippet = snippet.slice(0, 60) + '…';
        }

        return {
          id: contact.id,
          name: contact.name,
          pushName: contact.pushName,
          phoneNumber: contact.phoneNumber,
          profilePicUrl: contact.profilePicUrl,
          lastMessageSnippet: snippet,
          lastMessageTime: lastMessage.timestamp,
          okWithoutReply: contact.okWithoutReply || false,
        };
      })
      .sort((a, b) => a.lastMessageTime.getTime() - b.lastMessageTime.getTime()) // Oldest first (most urgent)
      .slice(offset, offset + limit);

    const total = contacts.filter(c => c.messages.length > 0 && !c.messages[0].fromMe).length;
    const hasMore = offset + limit < total;

    return {
      contacts: awaitingReplies,
      total,
      hasMore,
    };
  }

  private lastMessageHasQuestion(body: string | null, type: string): boolean {
    if (type !== 'TEXT' || !body) return false;
    return body.includes('?');
  }

  /**
   * Get contacts "To reply" with pagination: last message not from user AND contains a question mark.
   */
  async getToRepliesPaginated(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ) {
    const contacts = await prisma.contact.findMany({
      where: { 
        userId, 
        isGroup: false,
        okWithoutReply: false,
      },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { 
            fromMe: true, 
            body: true, 
            timestamp: true,
            type: true,
          },
        },
      },
    });

    const toReplies = contacts
      .filter(c => {
        if (c.messages.length === 0) return false;
        const last = c.messages[0];
        return !last.fromMe && this.lastMessageHasQuestion(last.body, last.type);
      })
      .map(contact => {
        const lastMessage = contact.messages[0];
        let snippet = lastMessage.body || '';
        if (lastMessage.type !== 'TEXT') {
          snippet = `(${lastMessage.type.toLowerCase()})`;
        } else if (snippet.length > 60) {
          snippet = snippet.slice(0, 60) + '…';
        }
        return {
          id: contact.id,
          name: contact.name,
          pushName: contact.pushName,
          phoneNumber: contact.phoneNumber,
          profilePicUrl: contact.profilePicUrl,
          lastMessageSnippet: snippet,
          lastMessageTime: lastMessage.timestamp,
          okWithoutReply: contact.okWithoutReply || false,
        };
      })
      .sort((a, b) => a.lastMessageTime.getTime() - b.lastMessageTime.getTime())
      .slice(offset, offset + limit);

    const total = contacts.filter(c => {
      if (c.messages.length === 0) return false;
      const last = c.messages[0];
      return !last.fromMe && this.lastMessageHasQuestion(last.body, last.type);
    }).length;
    const hasMore = offset + limit < total;

    return { contacts: toReplies, total, hasMore };
  }

  /**
   * Get contacts "Awaiting reply" with pagination: last message from user AND contains a question mark.
   * Excludes contacts marked as OK without reply.
   */
  async getAwaitingReplyPaginated(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ) {
    const contacts = await prisma.contact.findMany({
      where: { userId, isGroup: false, okWithoutReply: false },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: { fromMe: true, body: true, timestamp: true, type: true },
        },
      },
    });

    const awaitingReply = contacts
      .filter(c => {
        if (c.messages.length === 0) return false;
        const last = c.messages[0];
        return last.fromMe && this.lastMessageHasQuestion(last.body, last.type);
      })
      .map(contact => {
        const lastMessage = contact.messages[0];
        let snippet = lastMessage.body || '';
        if (lastMessage.type !== 'TEXT') {
          snippet = `(${lastMessage.type.toLowerCase()})`;
        } else if (snippet.length > 60) {
          snippet = snippet.slice(0, 60) + '…';
        }
        return {
          id: contact.id,
          name: contact.name,
          pushName: contact.pushName,
          phoneNumber: contact.phoneNumber,
          profilePicUrl: contact.profilePicUrl,
          lastMessageSnippet: snippet,
          lastMessageTime: lastMessage.timestamp,
          okWithoutReply: contact.okWithoutReply || false,
        };
      })
      .sort((a, b) => a.lastMessageTime.getTime() - b.lastMessageTime.getTime())
      .slice(offset, offset + limit);

    const total = contacts.filter(c => {
      if (c.messages.length === 0) return false;
      const last = c.messages[0];
      return last.fromMe && this.lastMessageHasQuestion(last.body, last.type);
    }).length;
    const hasMore = offset + limit < total;

    return { contacts: awaitingReply, total, hasMore };
  }

  /**
   * Get basic weekly insights (message count and new contacts this week)
   */
  async getBasicWeeklyInsights(userId: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [weeklyMessages, newContacts] = await Promise.all([
      prisma.message.count({
        where: {
          userId,
          timestamp: { gte: sevenDaysAgo },
        },
      }),
      prisma.contact.count({
        where: {
          userId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return {
      weeklyMessages,
      newContacts,
    };
  }

  /**
   * Get messages graph data (sent/received by day)
   */
  async getMessagesGraphData(userId: string, fromDate: Date, toDate: Date) {
    // Normalize dates to start/end of day
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    // Get all messages in the date range
    const messages = await prisma.message.findMany({
      where: {
        userId,
        timestamp: {
          gte: from,
          lte: to,
        },
      },
      select: {
        timestamp: true,
        fromMe: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Group by date
    const dataByDate: Record<string, { sent: number; received: number }> = {};
    
    // Initialize all dates in range with 0 counts
    const currentDate = new Date(from);
    while (currentDate <= to) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dataByDate[dateKey] = { sent: 0, received: 0 };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count messages by date
    for (const message of messages) {
      const dateKey = new Date(message.timestamp).toISOString().split('T')[0];
      if (dataByDate[dateKey]) {
        if (message.fromMe) {
          dataByDate[dateKey].sent++;
        } else {
          dataByDate[dateKey].received++;
        }
      }
    }

    // Convert to array format for frontend
    return Object.entries(dataByDate)
      .map(([date, counts]) => ({
        date,
        sent: counts.sent,
        received: counts.received,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get active contacts graph data (daily/weekly/monthly by day)
   */
  async getActiveContactsGraphData(userId: string, fromDate: Date, toDate: Date) {
    // Normalize dates to start/end of day
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    // We need to fetch messages from up to 30 days before 'from' to properly calculate
    // weekly and monthly rolling windows for dates early in the range
    const extendedFrom = new Date(from);
    extendedFrom.setDate(extendedFrom.getDate() - 30);
    extendedFrom.setHours(0, 0, 0, 0);

    // Get all messages in the extended date range with contact info
    const messages = await prisma.message.findMany({
      where: {
        userId,
        timestamp: {
          gte: extendedFrom,
          lte: to,
        },
      },
      select: {
        timestamp: true,
        contactId: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Group by date and track unique contacts for each period
    const dataByDate: Record<string, {
      daily: Set<string>;
      weekly: Set<string>;
      monthly: Set<string>;
    }> = {};

    // Initialize all dates in range
    const currentDate = new Date(from);
    while (currentDate <= to) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dataByDate[dateKey] = {
        daily: new Set<string>(),
        weekly: new Set<string>(),
        monthly: new Set<string>(),
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process messages to build rolling windows
    // For each date in the range, count contacts active in different time windows
    for (const [dateKey, contactSets] of Object.entries(dataByDate)) {
      // Parse date key (YYYY-MM-DD) - treat as local date
      const checkDate = new Date(dateKey + 'T00:00:00');
      
      // Daily: contacts with messages on this exact day
      const dailyStart = new Date(checkDate);
      dailyStart.setHours(0, 0, 0, 0);
      const dailyEnd = new Date(checkDate);
      dailyEnd.setHours(23, 59, 59, 999);
      
      // Weekly: contacts with messages in the 7 days ending on this date (including today)
      // This means: checkDate and the 6 days before it
      const weeklyStart = new Date(checkDate);
      weeklyStart.setDate(weeklyStart.getDate() - 6);
      weeklyStart.setHours(0, 0, 0, 0);
      const weeklyEnd = new Date(checkDate);
      weeklyEnd.setHours(23, 59, 59, 999);
      
      // Monthly: contacts with messages in the 30 days ending on this date (including today)
      // This means: checkDate and the 29 days before it
      const monthlyStart = new Date(checkDate);
      monthlyStart.setDate(monthlyStart.getDate() - 29);
      monthlyStart.setHours(0, 0, 0, 0);
      const monthlyEnd = new Date(checkDate);
      monthlyEnd.setHours(23, 59, 59, 999);
      
      // Process all messages to see which ones fall into these windows
      for (const message of messages) {
        const messageTimestamp = new Date(message.timestamp);
        
        // Daily: message on this exact day
        if (messageTimestamp >= dailyStart && messageTimestamp <= dailyEnd) {
          contactSets.daily.add(message.contactId);
        }
        
        // Weekly: message within last 7 days (including today)
        if (messageTimestamp >= weeklyStart && messageTimestamp <= weeklyEnd) {
          contactSets.weekly.add(message.contactId);
        }
        
        // Monthly: message within last 30 days (including today)
        if (messageTimestamp >= monthlyStart && messageTimestamp <= monthlyEnd) {
          contactSets.monthly.add(message.contactId);
        }
      }
    }

    // Convert to array format
    return Object.entries(dataByDate)
      .map(([date, sets]) => ({
        date,
        daily: sets.daily.size,
        weekly: sets.weekly.size,
        monthly: sets.monthly.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get the oldest message timestamp for a user
   */
  async getOldestMessageDate(userId: string): Promise<Date | null> {
    const oldestMessage = await prisma.message.findFirst({
      where: { userId },
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    return oldestMessage?.timestamp || null;
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(userId: string) {
    const [
      todayStats,
      activeContacts,
      awaitingReplies,
      toContact,
      upcomingBirthdays,
      upcomingImportantDates,
      relationshipHealth,
      weeklyInsights,
    ] = await Promise.all([
      this.getTodayStats(userId),
      this.getActiveContactsOverview(userId),
      this.getAwaitingReplies(userId, 10),
      this.getContactsToReachOut(userId, 10),
      this.getUpcomingBirthdays(userId, 5),
      this.getUpcomingImportantDates(userId, 5),
      this.calculateRelationshipHealth(userId),
      this.getBasicWeeklyInsights(userId),
    ]);

    return {
      today: todayStats,
      activeContacts,
      awaitingReplies,
      toContact,
      upcomingBirthdays,
      upcomingImportantDates,
      relationshipHealth,
      weeklyInsights,
    };
  }
}

export const dashboardService = new DashboardService();
