import axios, { type AxiosInstance } from "axios";
import type { User, Contact, ContactStats, Message, WhatsAppStatusResponse, DashboardStats, UpcomingBirthday, ImportantDate, Reminder, UpcomingReminder, ScheduledMessage } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export interface RegisterBody {
  email: string;
  password: string;
  name?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetLink?: string;
}

export interface ResetPasswordBody {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export const authApi = {
  register: (data: RegisterBody) =>
    api.post<AuthResponse>("/auth/register", data),
  login: (data: LoginBody) => api.post<AuthResponse>("/auth/login", data),
  getMe: () => api.get<User>("/auth/me"),
  forgotPassword: (data: { email: string }) =>
    api.post<ForgotPasswordResponse>("/auth/forgot-password", data),
  resetPassword: (data: ResetPasswordBody) =>
    api.post<ResetPasswordResponse>("/auth/reset-password", data),
};

// WhatsApp
export interface WhatsAppInitResponse {
  success: boolean;
  qr?: string | null;
  message?: string;
  connected?: boolean;
}

export interface WhatsAppPairResponse {
  success: boolean;
  pairingCode?: string | null;
  message?: string;
  connected?: boolean;
}

export const whatsappApi = {
  initialize: () => api.post<WhatsAppInitResponse>("/whatsapp/initialize"),
  pair: (phoneNumber: string) =>
    api.post<WhatsAppPairResponse>("/whatsapp/pair", { phoneNumber }),
  getStatus: () => api.get<WhatsAppStatusResponse>("/whatsapp/status"),
  disconnect: () => api.post<{ success: boolean; message?: string }>("/whatsapp/disconnect"),
  heartbeat: () => api.post<{ success: boolean; connected: boolean; message?: string }>("/whatsapp/heartbeat"),
  disconnectClient: () => api.post<{ success: boolean; message?: string }>("/whatsapp/disconnect-client"),
  syncContacts: () => api.post<{ success: boolean; synced: number }>("/whatsapp/sync-contacts"),
  searchAndSyncContact: (data: { phoneNumber?: string; name?: string }) =>
    api.post<{ success: boolean; contact: Contact; synced: boolean }>("/whatsapp/search-and-sync-contact", data),
};

// Contacts
export const contactsApi = {
  getAll: (params?: { search?: string }) => api.get<{ contacts?: Contact[] }>("/contacts", { params }),
  getById: (id: string) => api.get<Contact>(`/contacts/${id}`),
  getStats: (id: string) => api.get<ContactStats>(`/contacts/${id}/stats`),
  refreshProfilePicture: (id: string) =>
    api.post<{ profilePicUrl: string | null }>(`/contacts/${id}/refresh-profile-picture`),
  update: (id: string, data: {
    notes?: string;
    tags?: string[];
    birthday?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    location?: string | null;
    relationshipType?: string | null;
    contactFrequency?: string | null;
    importance?: number | null;
    customFields?: Record<string, any> | null;
    okWithoutReply?: boolean;
    profilePicUrl?: string | null;
  }) =>
    api.patch<Contact>(`/contacts/${id}`, data),
  getReminders: (contactId: string) =>
    api.get<{ reminders: Reminder[] }>(`/contacts/${contactId}/reminders`),
  createReminder: (contactId: string, data: { dueDate: string; notes?: string | null }) =>
    api.post<{ reminder: Reminder }>(`/contacts/${contactId}/reminders`, data),
  updateReminder: (contactId: string, reminderId: string, data: { dueDate?: string; notes?: string | null }) =>
    api.patch<{ reminder: Reminder }>(`/contacts/${contactId}/reminders/${reminderId}`, data),
  deleteReminder: (contactId: string, reminderId: string) =>
    api.delete<{ success: boolean }>(`/contacts/${contactId}/reminders/${reminderId}`),
};

// Scheduled messages
export const scheduledMessagesApi = {
  create: (data: { contactId: string; messageText: string; scheduledTime: string }) =>
    api.post<{ scheduledMessage: ScheduledMessage }>("/api/scheduled-messages", data),
  getByContact: (contactId: string) =>
    api.get<{ scheduledMessages: ScheduledMessage[] }>(`/api/scheduled-messages/contact/${contactId}`),
  update: (id: string, data: { messageText?: string; scheduledTime?: string }) =>
    api.put<{ scheduledMessage: ScheduledMessage }>(`/api/scheduled-messages/${id}`, data),
  delete: (id: string) =>
    api.delete<{ success: boolean }>(`/api/scheduled-messages/${id}`),
  approve: (id: string) =>
    api.post<{ success: boolean }>(`/api/scheduled-messages/${id}/approve`),
  reject: (id: string) =>
    api.post<{ success: boolean }>(`/api/scheduled-messages/${id}/reject`),
};

// Settings
export const settingsApi = {
  get: () =>
    api.get<{ anthropicModel: string; hasApiKey: boolean }>("/api/settings"),
  update: (data: { anthropic_api_key?: string; anthropic_model?: string }) =>
    api.put<{ success: boolean }>("/api/settings", data),
  testAnthropic: () =>
    api.post<{ valid: boolean; error?: string }>("/api/settings/test-anthropic"),
};

// Analysis
export const analysisApi = {
  analyzeContact: (contactId: string) =>
    api.post<{
      success: boolean;
      attributes: any;
      summary: string;
      suggestedMessage?: any;
      error?: string;
    }>(`/api/analysis/${contactId}`),
};

// Conversations
export interface Conversation {
  contact: Contact;
  lastMessage: Message;
  unreadCount: number;
}

export const conversationsApi = {
  /** Activate a chat so WhatsApp starts syncing messages (silent presence updates). Call when user opens a conversation. */
  activateChat: (jid: string) =>
    api.post<{ success: boolean; activated: string }>(`/api/conversations/${encodeURIComponent(jid)}/activate`),
};

// Messages
export const messagesApi = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get<{ messages: Message[] }>("/messages", { params }),
  getConversations: (params?: { limit?: number; offset?: number; search?: string }) =>
    api.get<{
      conversations: Conversation[];
      hasMore: boolean;
    }>("/messages/conversations", { params }),
  getByContact: (
    contactId: string,
    params?: { limit?: number; offset?: number }
  ) =>
    api.get<{ messages: Message[] }>(`/messages/contact/${contactId}`, {
      params,
    }),
  markAsRead: (contactId: string) =>
    api.post<{ success: boolean }>("/messages/mark-read", { contactId }),
  sendMessage: (
    contactId: string,
    data: { body?: string; mediaUrl?: string; mediaType?: "image" | "video" | "audio" | "document" }
  ) =>
    api.post<{ success: true; message: Message }>("/messages/send", {
      contactId,
      ...data,
    }),
  syncContactMessages: (contactId: string, limit?: number) => {
    const config = limit ? { params: { limit } } : {};
    return api.post<{ success: boolean; synced: number }>(`/messages/contact/${contactId}/sync`, {}, config);
  },
};

// Analytics (Phase 6 — backend: GET /api/analytics/*)
export const analyticsApi = {
  getContactsNeedingAttention: () =>
    api.get<{ contacts?: Contact[] }>("/api/analytics/needs-attention").catch(() => ({ data: { contacts: [] } })),
  getPendingReplies: () =>
    api.get<{ contacts?: Contact[] }>("/api/analytics/pending-replies").catch(() => ({ data: { contacts: [] } })),
};

// Dashboard
export interface MessagesGraphDataPoint {
  date: string;
  sent: number;
  received: number;
}

export interface ActiveContactsGraphDataPoint {
  date: string;
  daily: number;
  weekly: number;
  monthly: number;
}

export interface HealthStatusContact {
  id: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  profilePicUrl: string | null;
  lastMessageSnippet: string | null;
  lastMessageTime: string | null;
  contactFrequency?: string | null;
  daysOverdue?: number;
}

export interface AwaitingReplyContact {
  id: string;
  name: string | null;
  pushName: string | null;
  phoneNumber: string | null;
  profilePicUrl: string | null;
  lastMessageSnippet: string | null;
  lastMessageTime: string;
  okWithoutReply?: boolean;
}

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>("/api/dashboard/stats"),
  getMessagesGraph: (fromDate: string, toDate: string) =>
    api.get<MessagesGraphDataPoint[]>("/api/dashboard/messages-graph", {
      params: { fromDate, toDate },
    }),
  getActiveContactsGraph: (fromDate: string, toDate: string) =>
    api.get<ActiveContactsGraphDataPoint[]>("/api/dashboard/active-contacts-graph", {
      params: { fromDate, toDate },
    }),
  getOldestMessageDate: () =>
    api.get<{ oldestDate: string | null }>("/api/dashboard/oldest-message-date"),
  getContactsByHealthStatus: (
    status: 'onTrack' | 'needsAttention' | 'atRisk',
    limit?: number,
    offset?: number
  ) =>
    api.get<{ contacts: HealthStatusContact[]; total: number; hasMore: boolean }>(
      "/api/dashboard/contacts-by-health-status",
      {
        params: { status, limit, offset },
      }
    ),
  getAwaitingReplies: (limit?: number, offset?: number) =>
    api.get<{ contacts: AwaitingReplyContact[]; total: number; hasMore: boolean }>(
      "/api/dashboard/awaiting-replies",
      {
        params: { limit, offset },
      }
    ),
  getToReplies: (limit?: number, offset?: number) =>
    api.get<{ contacts: AwaitingReplyContact[]; total: number; hasMore: boolean }>(
      "/api/dashboard/to-reply",
      { params: { limit, offset } }
    ),
  getAwaitingReply: (limit?: number, offset?: number) =>
    api.get<{ contacts: AwaitingReplyContact[]; total: number; hasMore: boolean }>(
      "/api/dashboard/awaiting-reply",
      { params: { limit, offset } }
    ),
  getUpcomingBirthdays: (limit?: number, offset?: number) =>
    api.get<{ birthdays: UpcomingBirthday[]; total: number; hasMore: boolean }>(
      "/api/dashboard/upcoming-birthdays",
      {
        params: { limit, offset },
      }
    ),
  getUpcomingImportantDates: (limit?: number, offset?: number) =>
    api.get<{ dates: ImportantDate[]; total: number; hasMore: boolean }>(
      "/api/dashboard/upcoming-important-dates",
      {
        params: { limit, offset },
      }
    ),
  getUpcomingReminders: (limit?: number, offset?: number) =>
    api.get<{ reminders: UpcomingReminder[]; total: number; hasMore: boolean }>(
      "/api/dashboard/upcoming-reminders",
      { params: { limit, offset } }
    ),
  getUpcomingScheduledMessages: (limit?: number, offset?: number) =>
    api.get<{ scheduledMessages: any[]; total: number; hasMore: boolean }>(
      "/api/dashboard/upcoming-scheduled-messages",
      { params: { limit, offset } }
    ),
};

export default api;
