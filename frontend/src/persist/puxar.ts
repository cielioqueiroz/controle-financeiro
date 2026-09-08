import { obterNeon } from '../lib/neon'
import { competenciaDe } from '../domain/agrupar'

export type { Periodo } from '../domain/agrupar'

export type TransacaoSalva = {
  id: string
  date: string // data real da compra/débito
  competencia: string // mês de referência (fatura), YYYY-MM
  description: string
  label: string | null
  amount_cents: number
  kind: string
  category_slug: string | null
  bank: string
  doc_type: string
  document_id: string
  installment: { current: number; total: number } | null
}

const COLUNAS =
  'id, date, description, label, amount_cents, kind, category_slug, installment, document_id, accounts(bank), documents(doc_type, period_end)'

/** A leitura voltou incompleta ou deformada.
 *
 *  Erro próprio, e não um `Error` qualquer, porque ele significa uma coisa
 *  que nenhuma outra falha significa: **os números da tela não são o
 *  dinheiro todo**. `chaveDeErro` casa a mensagem e a tela mostra o aviso
 *  em vez do total menor. */
export class RecorteIncompletoError extends Error {
  constructor(motivo: string) {
    super(`Recorte incompleto: ${motivo}`)
    this.name = 'RecorteIncompletoError'
  }
}

/** Puxa TODAS as transações do usuário de uma vez, já com a competência
 *  calculada (mês do vencimento da fatura, ou do período do extrato). O
 *  dashboard fatia por dia/semana/mês/ano no cliente — os volumes são
 *  pequenos (uso pessoal) e assim navegar entre períodos é instantâneo,
 *  além de habilitar tabelas por categoria e o detalhe por dia sem novas
 *  idas ao banco. RLS garante que só vêm as transações do próprio usuário.
 *
 *  ## Por que esta função pede `count` e confere o que recebeu
 *
 *  A **Conferência** do `CONTEXT.md` cobre a extração: o parser contra o
 *  gabarito do documento. A leitura do banco não tinha equivalente, e é o
 *  único trecho do caminho do dinheiro sem um. A promessa da abertura do
 *  README — *todo número na tela veio de um documento* — precisa da outra
 *  metade: **todo documento está no número**. É a `Integridade do recorte`.
 *
 *  O modo de falha que isso fecha é silencioso por construção:
 *
 *  - A Data API do Neon aceita um teto de linhas por resposta
 *    (`db_max_rows`). Hoje ele está **vazio** neste projeto — conferido em
 *    2026-09-06 —, então não há truncamento; é um campo de formulário no
 *    console, e ligá-lo não muda nada no código, no build nem nos testes.
 *  - O cliente decide sucesso por `res.ok`, que é verdadeiro tanto para 200
 *    quanto para 206. Uma resposta truncada chega com `error: null` e um
 *    array curto — **indistinguível** de uma leitura completa.
 *  - E `count` só é preenchido se a requisição tiver pedido
 *    `{ count: 'exact' }`. Sem pedir, ele volta `null` e não há sinal algum.
 *
 *  Por isso o pedido do `count` faz parte do guarda, não é diagnóstico. */
export async function puxarTudo(): Promise<TransacaoSalva[]> {
  const neon = await obterNeon()
  if (!neon) return []
  const { data, error, count } = await neon
    .from('transactions')
    .select(COLUNAS, { count: 'exact' })
    .order('date', { ascending: false })

  if (error) throw error

  const linhas = data ?? []

  // O servidor disse quantas linhas existem; vieram menos.
  if (typeof count === 'number' && linhas.length < count) {
    throw new RecorteIncompletoError(
      `o banco tem ${count} transações e a resposta trouxe ${linhas.length}`,
    )
  }

  return linhas.map(paraTransacaoSalva)
}

/** Converte a linha do banco, conferindo a forma em runtime.
 *
 *  O que havia antes era `r.amount_cents as number`: um **cast**, que o
 *  TypeScript aceita sem olhar e que não existe depois de compilado. Se a
 *  coluna vier nula, ausente ou como texto, o cast não reclama e o valor
 *  entra na soma — `undefined` vira `NaN`, e um `NaN` numa soma apaga o
 *  total inteiro sem uma linha de erro. É o mesmo princípio do `AGENTS.md`:
 *  número que não pode ser calculado vira estado vazio, nunca zero. */
function paraTransacaoSalva(bruto: unknown): TransacaoSalva {
  const r = exigirObjeto(bruto, 'transação')
  const doc = r.documents == null ? null : exigirObjeto(r.documents, 'documents')
  const conta = r.accounts == null ? null : exigirObjeto(r.accounts, 'accounts')
  const date = exigirTexto(r.date, 'date')

  return {
    id: exigirTexto(r.id, 'id'),
    date,
    competencia: competenciaDe(texto(doc?.period_end) ?? null, date),
    description: exigirTexto(r.description, 'description'),
    label: texto(r.label) ?? null,
    amount_cents: exigirInteiro(r.amount_cents, 'amount_cents'),
    kind: exigirTexto(r.kind, 'kind'),
    category_slug: texto(r.category_slug) ?? null,
    bank: texto(conta?.bank) ?? 'desconhecido',
    doc_type: texto(doc?.doc_type) ?? 'desconhecido',
    document_id: exigirTexto(r.document_id, 'document_id'),
    installment: parcela(r.installment),
  }
}

const texto = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

function exigirObjeto(v: unknown, campo: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new RecorteIncompletoError(`${campo} não veio como objeto`)
  }
  return v as Record<string, unknown>
}

function exigirTexto(v: unknown, campo: string): string {
  if (typeof v !== 'string' || v === '') {
    throw new RecorteIncompletoError(`${campo} ausente ou vazio`)
  }
  return v
}

/** Dinheiro é centavos em INTEIRO — ver `AGENTS.md` §2.2. Um float aqui
 *  significaria que a coluna mudou de tipo, e arredondar por conta própria
 *  seria inventar dinheiro. */
function exigirInteiro(v: unknown, campo: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new RecorteIncompletoError(`${campo} não é inteiro (${String(v)})`)
  }
  return v
}

/** `installment` é `jsonb`: pode vir null, e vindo, precisa ter os dois
 *  números. Parcela pela metade quebraria a projeção de compromisso
 *  futuro — melhor tratar como ausente do que como `03/undefined`. */
function parcela(v: unknown): { current: number; total: number } | null {
  if (v == null) return null
  if (typeof v !== 'object' || Array.isArray(v)) return null
  const p = v as Record<string, unknown>
  if (typeof p.current !== 'number' || typeof p.total !== 'number') return null
  return { current: p.current, total: p.total }
}
