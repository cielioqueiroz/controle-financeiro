import { obterNeon } from '../lib/neon'

/** Tabelas da pessoa, na ordem em que saem.
 *
 *  `documents` primeiro: as transações caem junto por ON DELETE CASCADE, e é
 *  o mesmo caminho que o "apagar tudo" de Documentos percorre há meses. As
 *  `transactions` vêm logo depois para levar as que não pertencem a
 *  documento nenhum — com elas fora, nada mais aponta para conta, regra ou
 *  categoria. `categories` apaga só as PRÓPRIAS: as globais (`user_id`
 *  nulo) são de todos, e o RLS de escrita já as protege. */
const TABELAS = [
  'documents',
  'transactions',
  'accounts',
  'merchant_rules',
  'categories',
  'client_errors',
  'preferencias',
] as const

/** Apaga TODO dado da pessoa no banco. Irreversível — a tela pede a palavra
 *  digitada antes. O RLS garante que só sai o que é dela.
 *
 *  Para no primeiro erro e o devolve: apagar pela metade e dizer "pronto"
 *  seria pior que não apagar. A `preferencias` é a exceção — sem a migração
 *  0013 ela não existe, e a ausência dela não é dado que ficou para trás. */
export async function apagarMeusDados(): Promise<void> {
  const neon = await obterNeon()
  if (!neon) return
  for (const tabela of TABELAS) {
    // O PostgREST recusa DELETE sem filtro; "não nulo" casa todas as linhas
    // visíveis, e o RLS já limita à pessoa. `preferencias` não tem `id`.
    const coluna = tabela === 'categories' || tabela === 'preferencias' ? 'user_id' : 'id'
    const { error } = await neon.from(tabela).delete().not(coluna, 'is', null)
    if (error && tabela !== 'preferencias') throw error
  }
}
