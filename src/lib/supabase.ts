import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** URL e chave pública vêm do .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 *  Ver docs/SETUP-SUPABASE.md. */
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

/** O app funciona SEM Supabase (modo "importa e vê"). A persistência se
 *  acende quando as chaves estão configuradas — então tudo que depende do
 *  banco checa `supabaseConfigurado` antes. */
export const supabaseConfigurado = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url!, anonKey!)
  : null
