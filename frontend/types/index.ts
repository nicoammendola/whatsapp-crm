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
  createdAt: string;
  updatedAt: string;
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
  contact?: {
    id: string;
    name: string | null;
    pushName: string | null;
    profilePicUrl: string | null;
  };
}
