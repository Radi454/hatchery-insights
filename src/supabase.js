import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_KEY?.trim();

export const supabaseConfigError = url && key && !key.startsWith('sb_publishable_')
  ? 'يجب استخدام مفتاح عام من نوع sb_publishable_ فقط. لا تضع مفتاحًا سريًا أو service_role في المتصفح.'
  : null;
export const supabaseConfigured = Boolean(url && key && !supabaseConfigError);
export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
