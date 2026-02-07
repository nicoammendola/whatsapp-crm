import axios, { type AxiosInstance } from "axios";
import type { User, Contact, ContactStats, Message, WhatsAppStatusResponse, DashboardStats } from "@/types";

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

export const authApi = {
  register: (data: RegisterBody) =>
    api.post<AuthResponse>("/auth/register", data),
  login: (data: LoginBody) => api.post<AuthResponse>("/auth/login", data),
  getMe: () => api.get<User>("/auth/me"),
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
    birthday?: string;
    company?: string;
    jobTitle?: string;
    location?: string;
    relationshipType?: string;
    contactFrequency?: string;
    importance?: number;
    customFields?: Record<string, any>;
  }) =>
    api.patch<Contact>(`/contacts/${id}`, data),
};

// Conversations
export interface Conversation {
  contact: Contact;
  lastMessage: Message;
  unreadCount: number;
}

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
};

// Analytics (Phase 6 — backend: GET /api/analytics/*)
export const analyticsApi = {
  getContactsNeedingAttention: () =>
    api.get<{ contacts?: Contact[] }>("/api/analytics/needs-attention").catch(() => ({ data: { contacts: [] } })),
  getPendingReplies: () =>
    api.get<{ contacts?: Contact[] }>("/api/analytics/pending-replies").catch(() => ({ data: { contacts: [] } })),
};

// Dashboard
export const dashboardApi = {
  getStats: () => api.get<DashboardStats>("/api/dashboard/stats"),
};

export default api;
