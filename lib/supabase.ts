import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// ─── Config (injected via app.config.js → expo-constants) ────────────────────
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

const SUPABASE_URL  = extra.supabaseUrl  ?? 'https://roqqrtbohtqadmkhgffr.supabase.co';
const SUPABASE_ANON = extra.supabaseAnonKey ?? '';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// ─── Supabase JS client (for realtime, etc.) ───────────────────────────
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 10 } },
});

// Alias for backwards compatibility
export const supabase = supabaseClient;

// ─── Generic caller ───────────────────────────────────────────────────────────
/**
 * Call the Supabase `auth` edge function via plain fetch.
 * Accepts any action payload — type safety lives in AuthContext.
 */
export async function callAuthFunction(payload: Record<string, unknown>): Promise<any> {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token ?? '';
  let response: Response;
  try {
    response = await fetch(`${FUNCTIONS_URL}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPABASE_ANON,
        'Authorization': accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Network error — check your internet connection and try again.');
  }

    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new Error(`Server returned an invalid response (HTTP ${response.status}).`);
    }

    return { response, json };
  };

  let { response, json } = await invoke();

  const looksLikeSchemaCacheError =
    !response.ok &&
    typeof json?.error === 'string' &&
    /schema cache|Could not find the table/i.test(json.error);

  // PostgREST schema cache can lag briefly right after migrations/deploys.
  if (looksLikeSchemaCacheError) {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Ask backend to trigger an explicit schema cache reload when possible.
    if (payload.action !== 'reload-schema-cache') {
      try {
        await fetch(`${FUNCTIONS_URL}/auth`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        SUPABASE_ANON,
            'Authorization': `Bearer ${SUPABASE_ANON}`,
          },
          body: JSON.stringify({ action: 'reload-schema-cache' }),
        });
      } catch {
        // Ignore and continue with retry.
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    ({ response, json } = await invoke());
  }

  if (!response.ok) {
    throw new Error(json?.error ?? `Server error ${response.status}`);
  }

  return json;
}
