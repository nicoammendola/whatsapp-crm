# WhatsApp Personal CRM - Implementation Plan

## Project Overview
A personal CRM platform that connects to WhatsApp via QR code, stores all messages and media, and provides relationship management features like reply reminders and interaction tracking.

## Tech Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **WhatsApp Integration**: Baileys (latest version)
- **Database**: PostgreSQL (Railway)
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **File Storage**: Railway volumes (for WhatsApp session) + local/S3 for media

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State Management**: React Context / Zustand
- **API Calls**: Fetch API / Axios
- **Real-time**: WebSocket (Socket.io) for live message updates

### Deployment
- **Frontend**: Vercel (free tier)
- **Backend**: Railway ($5-10/month)
  - Express API + Baileys
  - Persistent volume for WhatsApp session data
- **Database**: Supabase (free tier)
  - PostgreSQL database
  - Storage for media files
  - Real-time subscriptions

---

## System Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│             │         │                  │         │             │
│   Next.js   │────────▶│   Express API    │────────▶│  Supabase   │
│   Frontend  │         │   + Baileys      │         │  PostgreSQL │
│  (Vercel)   │         │   (Railway)      │         │   + Storage │
│             │         │                  │         │             │
└─────────────┘         └──────────────────┘         └─────────────┘
                               │
                               │ QR Code Scan
                               ▼
                        ┌──────────────┐
                        │              │
                        │  WhatsApp    │
                        │   Servers    │
                        │              │
                        └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Session     │
                        │  Storage     │
                        │  (Railway    │
                        │   Volume)    │
                        └──────────────┘
```

---

## Database Schema (Prisma)

```prisma
// schema.prisma

model User {
  id              String          @id @default(cuid())
  email           String          @unique
  passwordHash    String
  name            String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  whatsappSession WhatsAppSession?
  contacts        Contact[]
  messages        Message[]
  
  @@map("users")
}

model WhatsAppSession {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  phoneNumber     String?
  isConnected     Boolean   @default(false)
  lastConnected   DateTime?
  qrCode          String?   // Temporary storage for QR during pairing
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@map("whatsapp_sessions")
}

model Contact {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  whatsappId      String    // Format: 1234567890@s.whatsapp.net
  name            String?   // From WhatsApp profile
  pushName        String?   // Display name
  phoneNumber     String?
  profilePicUrl   String?
  
  isGroup         Boolean   @default(false)
  
  // CRM fields
  lastInteraction DateTime?
  notes           String?
  tags            String[]  // JSON array
  
  messages        Message[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([userId, whatsappId])
  @@index([userId, lastInteraction])
  @@map("contacts")
}

model Message {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  contactId       String
  contact         Contact   @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  whatsappId      String    @unique // Message ID from WhatsApp
  
  fromMe          Boolean   // True if sent by user, false if received
  body            String?   // Text content
  timestamp       DateTime
  
  // Message type
  type            MessageType @default(TEXT)
  
  // Media
  hasMedia        Boolean   @default(false)
  mediaUrl        String?   // Local path or S3 URL
  mediaMimeType   String?
  mediaSize       Int?
  
  // Metadata
  isRead          Boolean   @default(false)
  isDeleted       Boolean   @default(false)
  
  createdAt       DateTime  @default(now())
  
  @@index([userId, contactId, timestamp])
  @@index([userId, timestamp])
  @@map("messages")
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  STICKER
  LOCATION
  CONTACT
  OTHER
}
```

---

## Phase 1: Core Infrastructure (Week 1)

### 1.1 Supabase Setup
```bash
# Create Supabase project at https://supabase.com
# 1. Sign up / Log in
# 2. Create new project
# 3. Choose free tier
# 4. Select region closest to you
# 5. Wait for project to spin up (~2 minutes)

# Get your credentials from Project Settings > API:
# - Project URL: https://[project-ref].supabase.co
# - API Keys:
#   - publishable key (public): eyJ... (safe to use in frontend)
#   - secret key (private): eyJ... (keep secret! server-side only)

# Get database connection string from Project Settings > Database:
# Connection string (URI): postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 1.2 Project Setup
```bash
# Create monorepo structure
mkdir whatsapp-crm
cd whatsapp-crm

# Backend
mkdir -p backend/src/{routes,controllers,services,middleware,utils,types}
cd backend
npm init -y
npm install express prisma @prisma/client baileys @whiskeysockets/baileys pino qrcode-terminal bcrypt jsonwebtoken cors dotenv
npm install -D @types/express @types/node @types/bcrypt @types/jsonwebtoken @types/cors typescript ts-node nodemon prisma

# Frontend
cd ..
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir
cd frontend
npm install axios zustand socket.io-client date-fns @supabase/supabase-js

# Initialize Prisma
cd ../backend
npx prisma init
```

### 1.3 Backend Structure
```
backend/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.ts                   # Express app setup
│   ├── config/
│   │   └── database.ts          # Prisma client
│   ├── routes/
│   │   ├── auth.routes.ts       # POST /auth/register, /auth/login
│   │   ├── whatsapp.routes.ts   # GET /whatsapp/qr, POST /whatsapp/disconnect
│   │   ├── contacts.routes.ts   # GET /contacts, GET /contacts/:id
│   │   └── messages.routes.ts   # GET /messages, GET /messages/contact/:id
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── whatsapp.controller.ts
│   │   ├── contacts.controller.ts
│   │   └── messages.controller.ts
│   ├── services/
│   │   ├── baileys.service.ts   # Core Baileys integration
│   │   ├── message.service.ts   # Message handling & storage
│   │   └── contact.service.ts   # Contact management
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT verification
│   │   └── error.middleware.ts  # Error handling
│   ├── utils/
│   │   └── helpers.ts
│   └── types/
│       └── index.ts
├── prisma/
│   └── schema.prisma
├── .env
├── tsconfig.json
└── package.json
```

### 1.4 Environment Setup (.env)

**Backend (.env)**
```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres:[your-password]@db.[project-ref].supabase.co:5432/postgres"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV=development

# WhatsApp Session Storage
SESSION_PATH="./whatsapp-sessions"

# CORS
FRONTEND_URL="http://localhost:3000"

# Supabase (optional - for direct client usage in backend if needed)
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_SECRET_KEY="your-secret-key"
```

**Frontend (.env.local)**
```env
# Backend API
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Supabase (for real-time features)
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
```

---

## Phase 2: Authentication System (Days 1-2)

### 2.1 Auth Routes (`backend/src/routes/auth.routes.ts`)
```typescript
import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getMe);

export default router;
```

### 2.2 Auth Controller (`backend/src/controllers/auth.controller.ts`)
```typescript
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    
    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  // Implement login logic
  // Verify password, generate JWT
};

export const getMe = async (req: Request, res: Response) => {
  // Return current user (req.userId from middleware)
};
```

### 2.3 Auth Middleware (`backend/src/middleware/auth.middleware.ts`)
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

## Phase 3: Baileys Integration (Days 3-5)

### 3.1 Baileys Service (`backend/src/services/baileys.service.ts`)

This is the core integration with WhatsApp.

```typescript
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  WAMessage,
  proto,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import path from 'path';
import { prisma } from '../config/database';
import { messageService } from './message.service';
import { contactService } from './contact.service';

// Store active connections per user
const activeConnections = new Map<string, WASocket>();

class BaileysService {
  async initializeWhatsApp(userId: string): Promise<{ qr: string | null }> {
    try {
      const sessionPath = path.join(
        process.env.SESSION_PATH || './whatsapp-sessions',
        userId
      );

      // Load auth state (credentials)
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Create socket
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: 'silent' }),
      });

      let qrCode: string | null = null;

      // Handle connection updates
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          qrCode = qr;
          // Store QR in database temporarily
          await prisma.whatsAppSession.upsert({
            where: { userId },
            update: { qrCode: qr, isConnected: false },
            create: { userId, qrCode: qr, isConnected: false },
          });
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          if (shouldReconnect) {
            // Reconnect
            this.initializeWhatsApp(userId);
          } else {
            // Logged out - clean up
            activeConnections.delete(userId);
            await prisma.whatsAppSession.update({
              where: { userId },
              data: { isConnected: false, qrCode: null },
            });
          }
        } else if (connection === 'open') {
          console.log('WhatsApp connected for user:', userId);
          
          // Store phone number
          const phoneNumber = sock.user?.id.split(':')[0];
          
          await prisma.whatsAppSession.update({
            where: { userId },
            data: {
              isConnected: true,
              lastConnected: new Date(),
              phoneNumber,
              qrCode: null,
            },
          });

          // Store connection
          activeConnections.set(userId, sock);

          // Load initial contacts
          await this.syncContacts(userId, sock);
        }
      });

      // Save credentials on update
      sock.ev.on('creds.update', saveCreds);

      // Handle incoming messages
      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
          for (const msg of messages) {
            await messageService.handleIncomingMessage(userId, msg);
          }
        }
      });

      // Handle message updates (read receipts, etc.)
      sock.ev.on('messages.update', async (updates) => {
        // Handle message status updates if needed
      });

      return { qr: qrCode };
    } catch (error) {
      console.error('Baileys initialization error:', error);
      throw error;
    }
  }

  async syncContacts(userId: string, sock: WASocket) {
    try {
      // Get all contacts from WhatsApp
      const contacts = await sock.store?.contacts;
      
      if (contacts) {
        for (const [jid, contact] of Object.entries(contacts)) {
          await contactService.upsertContact(userId, {
            whatsappId: jid,
            name: contact.name,
            pushName: contact.notify,
          });
        }
      }
    } catch (error) {
      console.error('Error syncing contacts:', error);
    }
  }

  async disconnectWhatsApp(userId: string) {
    const sock = activeConnections.get(userId);
    
    if (sock) {
      await sock.logout();
      activeConnections.delete(userId);
    }

    await prisma.whatsAppSession.update({
      where: { userId },
      data: { isConnected: false, qrCode: null },
    });
  }

  getConnection(userId: string): WASocket | undefined {
    return activeConnections.get(userId);
  }

  isConnected(userId: string): boolean {
    return activeConnections.has(userId);
  }
}

export const baileysService = new BaileysService();
```

### 3.2 Message Service (`backend/src/services/message.service.ts`)

```typescript
import { WAMessage, proto } from '@whiskeysockets/baileys';
import { prisma } from '../config/database';
import { contactService } from './contact.service';

class MessageService {
  async handleIncomingMessage(userId: string, waMessage: WAMessage) {
    try {
      const messageId = waMessage.key.id!;
      const fromMe = waMessage.key.fromMe || false;
      const remoteJid = waMessage.key.remoteJid!;
      
      // Check if message already exists
      const existing = await prisma.message.findUnique({
        where: { whatsappId: messageId },
      });

      if (existing) return; // Already stored

      // Get or create contact
      const contact = await contactService.getOrCreateContact(userId, remoteJid);

      // Extract message content
      const body = this.extractMessageBody(waMessage);
      const messageType = this.getMessageType(waMessage);
      const timestamp = waMessage.messageTimestamp
        ? new Date(Number(waMessage.messageTimestamp) * 1000)
        : new Date();

      // Store message
      await prisma.message.create({
        data: {
          userId,
          contactId: contact.id,
          whatsappId: messageId,
          fromMe,
          body,
          type: messageType,
          timestamp,
          hasMedia: messageType !== 'TEXT',
        },
      });

      // Update contact last interaction
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastInteraction: timestamp },
      });

      console.log(`Stored message ${messageId} from ${remoteJid}`);
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  private extractMessageBody(waMessage: WAMessage): string | null {
    const msg = waMessage.message;
    if (!msg) return null;

    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;

    return null;
  }

  private getMessageType(waMessage: WAMessage): string {
    const msg = waMessage.message;
    if (!msg) return 'TEXT';

    if (msg.imageMessage) return 'IMAGE';
    if (msg.videoMessage) return 'VIDEO';
    if (msg.audioMessage) return 'AUDIO';
    if (msg.documentMessage) return 'DOCUMENT';
    if (msg.stickerMessage) return 'STICKER';
    if (msg.locationMessage) return 'LOCATION';
    if (msg.contactMessage) return 'CONTACT';

    return 'TEXT';
  }

  async getMessagesForContact(
    userId: string,
    contactId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    return prisma.message.findMany({
      where: { userId, contactId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            pushName: true,
            profilePicUrl: true,
          },
        },
      },
    });
  }

  async getAllMessages(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    return prisma.message.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            pushName: true,
            profilePicUrl: true,
          },
        },
      },
    });
  }
}

export const messageService = new MessageService();
```

### 3.3 Contact Service (`backend/src/services/contact.service.ts`)

```typescript
import { prisma } from '../config/database';

class ContactService {
  async getOrCreateContact(userId: string, whatsappId: string) {
    let contact = await prisma.contact.findUnique({
      where: {
        userId_whatsappId: {
          userId,
          whatsappId,
        },
      },
    });

    if (!contact) {
      // Determine if it's a group
      const isGroup = whatsappId.endsWith('@g.us');

      contact = await prisma.contact.create({
        data: {
          userId,
          whatsappId,
          isGroup,
        },
      });
    }

    return contact;
  }

  async upsertContact(
    userId: string,
    data: {
      whatsappId: string;
      name?: string;
      pushName?: string;
      phoneNumber?: string;
      profilePicUrl?: string;
    }
  ) {
    return prisma.contact.upsert({
      where: {
        userId_whatsappId: {
          userId,
          whatsappId: data.whatsappId,
        },
      },
      update: {
        name: data.name,
        pushName: data.pushName,
        phoneNumber: data.phoneNumber,
        profilePicUrl: data.profilePicUrl,
      },
      create: {
        userId,
        whatsappId: data.whatsappId,
        name: data.name,
        pushName: data.pushName,
        phoneNumber: data.phoneNumber,
        profilePicUrl: data.profilePicUrl,
        isGroup: data.whatsappId.endsWith('@g.us'),
      },
    });
  }

  async getAllContacts(userId: string) {
    return prisma.contact.findMany({
      where: { userId },
      orderBy: { lastInteraction: 'desc' },
    });
  }

  async getContactById(userId: string, contactId: string) {
    return prisma.contact.findFirst({
      where: { userId, id: contactId },
    });
  }
}

export const contactService = new ContactService();
```

### 3.4 WhatsApp Routes (`backend/src/routes/whatsapp.routes.ts`)

```typescript
import { Router } from 'express';
import {
  initializeConnection,
  getStatus,
  disconnect,
} from '../controllers/whatsapp.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware); // All routes require auth

router.post('/initialize', initializeConnection);
router.get('/status', getStatus);
router.post('/disconnect', disconnect);

export default router;
```

### 3.5 WhatsApp Controller (`backend/src/controllers/whatsapp.controller.ts`)

```typescript
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { baileysService } from '../services/baileys.service';
import { prisma } from '../config/database';

export const initializeConnection = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.userId!;

    // Check if already connected
    if (baileysService.isConnected(userId)) {
      return res.json({
        success: true,
        message: 'Already connected',
        connected: true,
      });
    }

    // Initialize
    const result = await baileysService.initializeWhatsApp(userId);

    res.json({
      success: true,
      qr: result.qr,
      message: result.qr ? 'Scan QR code to connect' : 'Connecting...',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize WhatsApp' });
  }
};

export const getStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const session = await prisma.whatsAppSession.findUnique({
      where: { userId },
    });

    res.json({
      connected: baileysService.isConnected(userId),
      session: session
        ? {
            phoneNumber: session.phoneNumber,
            lastConnected: session.lastConnected,
            qrCode: session.qrCode,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
};

export const disconnect = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await baileysService.disconnectWhatsApp(userId);

    res.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
};
```

---

## Phase 4: API Routes for Messages & Contacts (Days 5-6)

### 4.1 Messages Routes (`backend/src/routes/messages.routes.ts`)

```typescript
import { Router } from 'express';
import { getAllMessages, getContactMessages } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getAllMessages);
router.get('/contact/:contactId', getContactMessages);

export default router;
```

### 4.2 Messages Controller

```typescript
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { messageService } from '../services/message.service';

export const getAllMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await messageService.getAllMessages(userId, limit, offset);

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const getContactMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { contactId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await messageService.getMessagesForContact(
      userId,
      contactId,
      limit,
      offset
    );

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};
```

### 4.3 Contacts Routes & Controller

Similar pattern - create routes for:
- `GET /contacts` - list all contacts
- `GET /contacts/:id` - get single contact with stats
- `PATCH /contacts/:id` - update contact (notes, tags)

---

## Phase 5: Frontend Development (Days 7-10)

### 5.1 Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing/login page
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard layout with nav
│   │   ├── page.tsx            # Dashboard home
│   │   ├── messages/
│   │   │   └── page.tsx        # All messages view
│   │   ├── contacts/
│   │   │   ├── page.tsx        # Contacts list
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Contact detail + messages
│   │   └── settings/
│   │       └── page.tsx        # WhatsApp connection settings
│   └── api/                    # API route handlers (optional)
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── whatsapp/
│   │   ├── QRCodeDisplay.tsx
│   │   ├── ConnectionStatus.tsx
│   │   └── DisconnectButton.tsx
│   ├── messages/
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   └── MessageThread.tsx
│   ├── contacts/
│   │   ├── ContactList.tsx
│   │   ├── ContactCard.tsx
│   │   └── ContactDetails.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Card.tsx
│       └── ... (reusable components)
├── lib/
│   ├── api.ts                  # API client
│   ├── auth.ts                 # Auth helpers
│   └── utils.ts                # Utilities
├── store/
│   ├── authStore.ts            # Zustand auth store
│   └── whatsappStore.ts        # WhatsApp connection state
└── types/
    └── index.ts                # TypeScript types
```

### 5.2 API Client (`lib/api.ts`)

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

export const whatsappApi = {
  initialize: () => api.post('/whatsapp/initialize'),
  getStatus: () => api.get('/whatsapp/status'),
  disconnect: () => api.post('/whatsapp/disconnect'),
};

export const messagesApi = {
  getAll: (params?: { limit?: number; offset?: number }) =>
    api.get('/messages', { params }),
  getByContact: (contactId: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/messages/contact/${contactId}`, { params }),
};

export const contactsApi = {
  getAll: () => api.get('/contacts'),
  getById: (id: string) => api.get(`/contacts/${id}`),
  update: (id: string, data: { notes?: string; tags?: string[] }) =>
    api.patch(`/contacts/${id}`, data),
};

export default api;
```

### 5.3 Key Components

**QR Code Display Component**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { whatsappApi } from '@/lib/api';
import QRCode from 'qrcode';

export default function QRCodeDisplay() {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInitialize = async () => {
    setLoading(true);
    try {
      const response = await whatsappApi.initialize();
      
      if (response.data.qr) {
        // Convert QR string to image
        const qrImage = await QRCode.toDataURL(response.data.qr);
        setQrCodeUrl(qrImage);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {qrCodeUrl ? (
        <div>
          <img src={qrCodeUrl} alt="WhatsApp QR Code" className="w-64 h-64" />
          <p className="text-sm text-gray-600 mt-2">
            Scan this code with WhatsApp on your phone
          </p>
        </div>
      ) : (
        <button
          onClick={handleInitialize}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg"
        >
          {loading ? 'Loading...' : 'Generate QR Code'}
        </button>
      )}
    </div>
  );
}
```

**Message Thread Component**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { messagesApi } from '@/lib/api';

interface Message {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: string;
  contact: {
    name: string;
    pushName: string;
  };
}

export default function MessageThread({ contactId }: { contactId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [contactId]);

  const loadMessages = async () => {
    try {
      const response = await messagesApi.getByContact(contactId);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading messages...</div>;

  return (
    <div className="flex flex-col gap-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] p-3 rounded-lg ${
              msg.fromMe
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-black'
            }`}
          >
            <p>{msg.body}</p>
            <span className="text-xs opacity-70">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5.4 Optional: Supabase Real-time Features

One of the benefits of using Supabase is built-in real-time subscriptions. You can make messages appear instantly without polling.

**Setup Supabase Client (`lib/supabase.ts`)**
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
```

**Enhanced Message Thread with Real-time Updates**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { messagesApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function MessageThreadRealtime({ contactId }: { contactId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    loadMessages();

    // Subscribe to new messages for this contact
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `contactId=eq.${contactId}`,
        },
        (payload) => {
          // Add new message to state
          setMessages((prev) => [payload.new as Message, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId]);

  // Rest of component...
}
```

**Note:** For real-time to work, you need to enable it in Supabase:
1. Go to Database → Replication
2. Enable replication for `messages` table
3. Make sure your Prisma schema matches Supabase schema exactly

This is **optional** for MVP but provides a much better UX as messages appear instantly.

---

## Phase 6: CRM Features (Days 11-12)

### 6.1 Relationship Insights

Add analytics service to backend:

```typescript
// backend/src/services/analytics.service.ts

class AnalyticsService {
  async getContactsNeedingAttention(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return prisma.contact.findMany({
      where: {
        userId,
        lastInteraction: {
          lt: sevenDaysAgo,
        },
        isGroup: false,
      },
      orderBy: {
        lastInteraction: 'asc',
      },
      take: 10,
    });
  }

  async getPendingReplies(userId: string) {
    // Get contacts where last message was not from user
    const contacts = await prisma.contact.findMany({
      where: { userId, isGroup: false },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    return contacts.filter(
      (c) => c.messages.length > 0 && !c.messages[0].fromMe
    );
  }

  async getContactStats(userId: string, contactId: string) {
    const messages = await prisma.message.findMany({
      where: { userId, contactId },
    });

    const sentByUser = messages.filter((m) => m.fromMe).length;
    const receivedFromContact = messages.filter((m) => !m.fromMe).length;

    return {
      totalMessages: messages.length,
      sentByUser,
      receivedFromContact,
      averageResponseTime: null, // TODO: Calculate
    };
  }
}

export const analyticsService = new AnalyticsService();
```

### 6.2 Dashboard Page

Create a dashboard showing:
- Contacts needing attention
- Pending replies
- Recent conversations
- Stats

```typescript
// app/(dashboard)/page.tsx

export default async function DashboardPage() {
  // Fetch data from API
  const needsAttention = await fetch('/api/analytics/needs-attention');
  const pendingReplies = await fetch('/api/analytics/pending-replies');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Need to Reach Out</h2>
        {/* List contacts you haven't talked to in a while */}
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Pending Replies</h2>
        {/* List contacts waiting for your response */}
      </div>

      <div className="bg-white p-6 rounded-lg shadow col-span-2">
        <h2 className="text-xl font-bold mb-4">Recent Conversations</h2>
        {/* Recent message threads */}
      </div>
    </div>
  );
}
```

---

## Phase 7: Deployment (Day 13)

### 7.1 Database Deployment (Supabase)

Your Supabase database is already set up from Phase 1! Just need to run migrations:

```bash
# From backend directory
# Make sure DATABASE_URL in .env points to Supabase
npx prisma migrate deploy
```

### 7.2 Backend Deployment (Railway)

**Prepare Backend for Deployment:**

1. **Create `backend/Dockerfile`**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

2. **Create Railway Account**
```bash
# Sign up at https://railway.app
# Install Railway CLI
npm i -g @railway/cli
railway login
```

3. **Deploy Backend to Railway**
```bash
# From backend directory
cd backend
railway init

# This creates a new Railway project
# Railway will auto-detect Dockerfile and build
railway up
```

4. **Add Persistent Volume for WhatsApp Sessions**
- Go to Railway dashboard
- Select your backend service
- Click "Volumes" tab
- Click "New Volume"
- Set mount path: `/data`
- This persists WhatsApp session data across deploys

5. **Configure Environment Variables in Railway Dashboard**

Go to your backend service → Variables, add:
```
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
JWT_SECRET=<generate-strong-secret-key>
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
SESSION_PATH=/data/whatsapp-sessions
FRONTEND_URL=https://your-app.vercel.app
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SECRET_KEY=<your-secret-key>
```

6. **Get Backend URL**
- Railway will provide a URL like: `https://your-backend.up.railway.app`
- Copy this for frontend configuration

### 7.3 Frontend Deployment (Vercel)

**Deploy to Vercel (easiest option for Next.js):**

1. **Push Code to GitHub**
```bash
# From project root
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/yourusername/whatsapp-crm.git
git push -u origin main
```

2. **Deploy on Vercel**
- Go to https://vercel.com
- Click "Add New Project"
- Import your GitHub repository
- Vercel auto-detects Next.js
- Set root directory: `frontend`
- Add environment variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
```

3. **Deploy**
- Click "Deploy"
- Vercel builds and deploys automatically
- Get your URL: `https://your-app.vercel.app`

4. **Update Backend FRONTEND_URL**
- Go back to Railway dashboard
- Update `FRONTEND_URL` environment variable with your Vercel URL
- Redeploy backend

### 7.4 Database Migrations

To run database migrations on production:

```bash
# Option 1: Railway CLI
railway run npx prisma migrate deploy

# Option 2: Direct connection
# Set DATABASE_URL to Supabase in your local .env
npx prisma migrate deploy
```

### 7.5 Post-Deployment Checklist

- [ ] Backend is running on Railway
- [ ] Frontend is deployed on Vercel
- [ ] Database migrations ran successfully on Supabase
- [ ] Volume mounted for WhatsApp sessions
- [ ] All environment variables configured
- [ ] CORS configured (FRONTEND_URL in backend)
- [ ] Can access frontend URL
- [ ] Can register/login
- [ ] QR code generation works
- [ ] WhatsApp connection persists after backend restart

### 7.6 Cost Summary

**Monthly Costs:**

| Service | Cost | What You Get |
|---------|------|--------------|
| Supabase | **$0** | 500MB DB, 1GB storage, unlimited API requests |
| Railway (Backend) | **$5-10** | Backend + WhatsApp session volume |
| Vercel | **$0** | Frontend hosting, 100GB bandwidth |
| **TOTAL** | **$5-10/month** | Full production app |

### 7.7 Monitoring & Logs

**Railway Logs:**
```bash
railway logs
```

**Vercel Logs:**
- Go to Vercel dashboard → your project → Deployments → View logs

**Supabase Logs:**
- Supabase dashboard → Logs → Select log type

### 7.8 Alternative: Railway CLI Deployment (Without GitHub)

If you prefer not to use GitHub:

**Backend:**
```bash
cd backend
railway up
```

**Frontend on Railway (instead of Vercel):**
```bash
cd frontend
railway init
railway up
```

Note: This adds $5-10/month for frontend on Railway vs $0 on Vercel.

---

## Phase 8: Testing & Polish (Day 14)

### 8.1 Testing Checklist

- [ ] User registration and login
- [ ] QR code generation and scanning
- [ ] WhatsApp connection status
- [ ] Receiving and storing messages
- [ ] Contact list display
- [ ] Message thread view
- [ ] Dashboard analytics
- [ ] Session persistence across restarts
- [ ] Disconnection and reconnection

### 8.2 Polish Items

- Add loading states
- Error handling and user feedback
- Responsive design
- Empty states
- Search functionality
- Pagination for messages
- Date grouping in message threads

---

## Future Enhancements (Post-MVP)

### Phase 9: Advanced Features
- [ ] Media download and storage (images, videos, documents)
- [ ] Full-text search across messages
- [ ] Export conversations
- [ ] Contact tagging and categorization
- [ ] Reminders and notifications
- [ ] Contact merge/deduplication
- [ ] Group chat support
- [ ] Message templates
- [ ] Scheduled messages
- [ ] Analytics dashboard (charts, trends)
- [ ] Email digests

### Phase 10: Optimization
- [ ] Message indexing for faster search
- [ ] Pagination optimization
- [ ] Caching layer (Redis)
- [ ] Real-time updates with WebSocket
- [ ] Background job processing for heavy tasks
- [ ] Rate limiting

---

## Project Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1. Infrastructure | 1 day | Project setup, database schema |
| 2. Authentication | 2 days | User registration/login, JWT |
| 3. Baileys Integration | 3 days | QR code, message receiving, storage |
| 4. API Routes | 1 day | Messages & contacts endpoints |
| 5. Frontend | 4 days | Complete UI for browsing messages |
| 6. CRM Features | 2 days | Analytics, insights, dashboard |
| 7. Deployment | 1 day | Vercel + Railway + Supabase setup |
| 8. Testing & Polish | 1 day | Bug fixes, UX improvements |

**Total: ~14 days for MVP**

---

## Development Tips

1. **Start Backend First**: Get Baileys working and storing messages before building frontend
2. **Test Incrementally**: Don't wait until everything is built to test WhatsApp connection
3. **Monitor Logs**: Baileys can be finicky - watch console logs carefully
4. **Session Backup**: Railway volumes can fail - consider backing up session data periodically
5. **Rate Limiting**: Don't hammer WhatsApp's API - you're just receiving, so should be fine
6. **Database Indexes**: Add indexes on frequently queried fields (userId, timestamp, contactId)

---

## Key Files to Create First

1. `backend/prisma/schema.prisma` - Database schema
2. `backend/src/services/baileys.service.ts` - WhatsApp integration
3. `backend/src/services/message.service.ts` - Message handling
4. `backend/src/app.ts` - Express app setup
5. `backend/src/index.ts` - Server entry point
6. `frontend/lib/api.ts` - API client
7. `frontend/app/(dashboard)/page.tsx` - Main dashboard

---

## Resources & Documentation

- **Baileys**: https://github.com/WhiskeySockets/Baileys
- **Prisma**: https://www.prisma.io/docs
- **Supabase**: https://supabase.com/docs
- **Railway**: https://docs.railway.app
- **Vercel**: https://vercel.com/docs
- **Next.js**: https://nextjs.org/docs
- **Express**: https://expressjs.com

---

## Final Architecture Summary

Your WhatsApp Personal CRM uses a **hybrid cloud architecture** optimized for cost and performance:

```
┌─────────────────────────────────────────────────────────┐
│                     YOUR STACK                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend (Vercel - FREE)                              │
│  ├─ Next.js 14 with App Router                         │
│  ├─ Tailwind CSS for styling                           │
│  ├─ Real-time UI updates with Supabase                 │
│  └─ Deployed via GitHub integration                    │
│                                                         │
│  Backend (Railway - $5-10/mo)                          │
│  ├─ Express.js API                                     │
│  ├─ Baileys WhatsApp integration                       │
│  ├─ Persistent volume for session data                 │
│  └─ Always-on server for WhatsApp connection           │
│                                                         │
│  Database (Supabase - FREE)                            │
│  ├─ PostgreSQL database (500MB)                        │
│  ├─ Storage for media files (1GB)                      │
│  ├─ Real-time subscriptions                            │
│  └─ Managed backups & migrations                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Why This Setup?**
- ✅ **Lowest Cost**: Only pay for Railway backend (~$5-10/month)
- ✅ **Best Performance**: Each service runs on its optimal platform
- ✅ **Easy Scaling**: Can upgrade individual components as needed
- ✅ **Modern Stack**: Built with latest technologies
- ✅ **Great DX**: Hot reload, instant deploys, excellent logging

**Total Monthly Cost: $5-10** (vs $20-30 for all-in-one solutions)

---

Good luck building your Personal CRM! 🚀

Start with Phase 1 and work your way through. Don't hesitate to adjust the plan as you go - software development is iterative!
