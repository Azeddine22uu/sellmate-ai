import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

type CloudStateRow = {
  user_id: string;
  state_key: string;
  value: unknown;
};

export async function getCloudState<T>(
  stateKey: string,
  fallback: T,
): Promise<T> {
  if (!supabase) return fallback;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fallback;

  const { data, error } = await supabase
    .from('sellmate_state')
    .select('value')
    .eq('user_id', user.id)
    .eq('state_key', stateKey)
    .maybeSingle<Pick<CloudStateRow, 'value'>>();

  if (error || !data) return fallback;
  return data.value as T;
}

export async function saveCloudState<T>(stateKey: string, value: T) {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('sellmate_state').upsert(
    {
      user_id: user.id,
      state_key: stateKey,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,state_key' },
  );
}