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
   * Get next 5 upcoming birthdays
   */
  async getUpcomingBirthdays(userId: string, limit = 5): Promise<UpcomingBirthday[]> {
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

    // Sort by days until (soonest first) and take only the first 'limit'
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    return upcoming.slice(0, limit);
  }

  /**
   * Parse customFields for date values and get next 5 upcoming important dates
   */
  async getUpcomingImportantDates(userId: string, limit = 5): Promise<ImportantDate[]> {
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

    // Sort by days until (soonest first) and take only the first 'limit'
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    return upcoming.slice(0, limit);
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
