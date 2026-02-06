import app from './app';
import { ensureMediaBucket } from './config/supabase';
import { baileysService } from './services/baileys.service';

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await ensureMediaBucket();
  await baileysService.restoreSessions();
});
