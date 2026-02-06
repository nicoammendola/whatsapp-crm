import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase] SUPABASE_URL or SUPABASE_SECRET_KEY not set — media upload will be disabled'
  );
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const MEDIA_BUCKET = 'media';

/**
 * Ensure the media bucket exists. Call once at startup.
 */
export async function ensureMediaBucket(): Promise<void> {
  if (!supabase) return;

  const { data, error } = await supabase.storage.getBucket(MEDIA_BUCKET);
  if (error && error.message.includes('not found')) {
    const { error: createError } = await supabase.storage.createBucket(MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
    });
    if (createError) {
      console.error('[Supabase] Failed to create media bucket:', createError);
    } else {
      console.log('[Supabase] Created media bucket');
    }
  } else if (data) {
    console.log('[Supabase] Media bucket ready');
  }
}
