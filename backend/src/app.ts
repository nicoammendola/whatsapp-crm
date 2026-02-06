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

const frontendUrls = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const defaultFrontendUrls = ['http://localhost:3000', 'http://localhost:3002'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        process.env.NODE_ENV !== 'production' &&
        origin.startsWith('http://localhost:')
      ) {
        return callback(null, true);
      }
      if (frontendUrls.length === 0 && defaultFrontendUrls.includes(origin)) {
        return callback(null, true);
      }
      if (frontendUrls.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
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
