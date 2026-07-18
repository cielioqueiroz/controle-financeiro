import { createClient } from '@neondatabase/neon-js'

/** Cliente único do Neon: auth + queries da Data API no mesmo objeto.
 *  URLs públicas por design (VITE_) — a proteção é o RLS no banco + o JWT.
 *  Ver docs/SETUP-NEON.md. */
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const dataApiUrl = env.VITE_NEON_DATA_API_URL
const authUrl = env.VITE_NEON_AUTH_URL

/** O app funciona SEM Neon (modo "importa e vê"). A persistência liga
 *  quando as duas URLs estão configuradas. */
export const neonConfigurado = Boolean(dataApiUrl && authUrl)

/** neon-js 0.6.2-beta só aceita a forma-de-objeto (dois URLs), não
 *  createClient(url). client.auth.* faz login; client.from().* consulta,
 *  com o JWT injetado automaticamente. */
export const neon = neonConfigurado
  ? createClient({
      auth: { url: authUrl! },
      dataApi: { url: dataApiUrl! },
    })
  : null
