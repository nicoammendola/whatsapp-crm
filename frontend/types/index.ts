// Auth
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

// WhatsApp
export interface WhatsAppSession {
  phoneNumber: string | null;
  lastConnected: string | null;
  qrCode: string | null;
}

export interface WhatsAppStatusResponse {
  connected: boolean;
  session: WhatsAppSession | null;
}

// Contacts
export interface Contact {
  id: string;
  whatsappId: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  profilePicUrl: string | null;
  isGroup: boolean;
  lastInteraction: string | null;
  notes: string | null;
  tags: string[];
  birthday?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  relationshipType?: string | null;
  contactFrequency?: string | null;
  importance?: number | null;
  customFields?: Record<string, any> | null;
  interactionCount7d?: number | null;
  interactionCount30d?: number | null;
  interactionCount90d?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactStats {
  contactId: string;
  lastInteraction: string | null;
  interactionCount7d: number;
  interactionCount30d: number;
  interactionCount90d: number;
  totalMessages: number;
  sentByUser: number;
  receivedFromContact: number;
  averageResponseTime?: string | null;
}

// Messages
export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "STICKER"
  | "LOCATION"
  | "CONTACT"
  | "OTHER";

export interface Message {
  id: string;
  contactId: string;
  whatsappId: string;
  fromMe: boolean;
  body: string | null;
  timestamp: string;
  type: MessageType;
  hasMedia: boolean;
  mediaUrl: string | null;
  isRead: boolean;
  quotedContent?: string | null;
  quotedMessage?: Message | null;
  senderJid?: string | null;
  senderName?: string | null;
  senderPhone?: string | null;
  reactions?: { emoji: string; fromMe: boolean }[];
  contact?: {
    id: string;
    name: string | null;
    pushName: string | null;
    profilePicUrl: string | null;
  };
}

// Dashboard
export type UrgencyLevel = 'low' | 'medium' | 'high';

export interface TodayStats {
  totalMessages: number;
  sent: number;
  received: number;
  uniqueContacts: number;
}

export interface ActiveContactsOverview {
  today: number;
  last7Days: number;
  last30Days: number;
  last90Days: number;
  total: number;
}

export interface ContactWithLastMessage {
  id: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  whatsappId: string;
  profilePicUrl: string | null;
  relationshipType: string | null;
  lastMessageSnippet: string | null;
  lastMessageTime: string;
  urgency: UrgencyLevel;
}

export interface ContactToReachOut {
  id: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  whatsappId: string;
  profilePicUrl: string | null;
  contactFrequency: string;
  lastInteraction: string | null;
  daysOverdue: number;
  urgency: UrgencyLevel;
}

export interface UpcomingBirthday {
  contactId: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  profilePicUrl: string | null;
  birthday: string;
  age: number;
  daysUntil: number;
  urgency: UrgencyLevel;
}

export interface ImportantDate {
  contactId: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  profilePicUrl: string | null;
  fieldName: string;
  fieldLabel: string;
  date: string;
  yearsAgo: number | null;
  daysUntil: number;
  urgency: UrgencyLevel;
}

export interface RelationshipHealth {
  score: number;
  onTrack: number;
  needsAttention: number;
  atRisk: number;
  total: number;
  topSuggestion: string | null;
}

export interface WeeklyInsights {
  weeklyMessages: number;
  newContacts: number;
}

export interface DashboardStats {
  today: TodayStats;
  activeContacts: ActiveContactsOverview;
  awaitingReplies: ContactWithLastMessage[];
  toContact: ContactToReachOut[];
  upcomingBirthdays: UpcomingBirthday[];
  upcomingImportantDates: ImportantDate[];
  relationshipHealth: RelationshipHealth;
  weeklyInsights: WeeklyInsights;
}
