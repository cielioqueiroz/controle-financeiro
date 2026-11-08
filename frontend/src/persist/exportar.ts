import { obterNeon } from '../lib/neon'
import type { DadosExportados, LinhaExportada } from '../lib/exportar-dados'

const TABELAS = [
  'accounts',
  'documents',
  'transactions',
  'document_transactions',
  'merchant_rules',
  'categories',
  'client_errors',
  'preferencias',
] as const

type TabelaExportada = (typeof TABELAS)[number]

const vazio = (): DadosExportados => ({
  accounts: [],
  documents: [],
  transactions: [],
  document_transactions: [],
  merchant_rules: [],
  categories: [],
  client_errors: [],
  preferencias: [],
})

/** Lê a cópia integral sob RLS. `count: exact` é parte da garantia: a Data API
 * pode truncar uma resposta com sucesso HTTP, e baixar uma cópia parcial sem
 * aviso seria pior que falhar. Categorias globais não são dados da pessoa. */
export async function puxarMeusDados(): Promise<DadosExportados> {
  const neon = await obterNeon()
  if (!neon) return vazio()

  const dados = vazio()
  for (const tabela of TABELAS) {
    let consulta = neon.from(tabela).select('*', { count: 'exact' })
    if (tabela === 'categories') consulta = consulta.not('user_id', 'is', null)

    const { data, error, count } = await consulta
    if (error) throw error
    const linhas = (data ?? []) as LinhaExportada[]
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
      throw new Error(`${tabela}: o banco não informou uma contagem exata válida`)
    }
    if (linhas.length !== count) {
      throw new Error(`${tabela}: o banco tem ${count} linhas e a resposta trouxe ${linhas.length}`)
    }
    dados[tabela as TabelaExportada] = linhas
  }
  return dados
}
