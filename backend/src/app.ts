import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import contactsRoutes from './routes/contacts.routes';
import messagesRoutes from './routes/messages.routes';
import analyticsRoutes from './routes/analytics.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/contacts', contactsRoutes);
app.use('/messages', messagesRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(errorMiddleware);

export default app;
