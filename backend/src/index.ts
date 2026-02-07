import app from './app';
import { createServer } from 'http';
import { ensureMediaBucket } from './config/supabase';
import { baileysService } from './services/baileys.service';
import { initSocket } from './services/socket.service';

const PORT = process.env.PORT ?? 3001;

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await ensureMediaBucket();
  await baileysService.restoreSessions();
});
