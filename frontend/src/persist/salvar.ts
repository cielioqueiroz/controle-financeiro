import { obterNeon } from '../lib/neon'
import type { ParseResult, RawTransaction } from '../domain/parsers/types'
import type { DocKind } from '../domain/pdf/detect'
import { hashConteudoDocumento, hashDocumento, chaveTransacao, chaveTransacaoLegada, sha256 } from '../domain/dedupe/hash'
import { categoriaDe, REGRAS_GLOBAIS, type Regra } from '../domain/categorize/regras'
import { mesclarRegras } from '../domain/categorize/aprendizado'
import { vincular, paraVincular } from '../domain/link/vinculos'
import { compararGabaritos, validar } from '../domain/validate/checksum'
import type { ConferenciaSalva } from '../domain/validate/conferencia-salva'
import { RecorteIncompletoError } from './puxar'

export type ResultadoSalvar =
  | { status: 'salvo'; documentId: string; inseridas: number; jaExistiam: number }
  | { status: 'documento-duplicado'; importadoEm: string }
  | { status: 'sem-persistencia' }

const accountKey = (result: ParseResult, kind: DocKind): string =>
  `${kind.bank}-${kind.docType}-${result.account.last4 ?? result.account.number ?? 'x'}`

/** A preparação é local; a RPC grava tudo na mesma transação, sob RLS.
 * Sem a migração 0008, falha sem recorrer à antiga escrita parcial. */
export async function salvarDocumento(
  result: ParseResult,
  kind: DocKind,
  fileBytes: ArrayBuffer,
  filename: string,
  regrasUsuario: Regra[],
): Promise<ResultadoSalvar> {
  const neon = await obterNeon()
  if (!neon) return { status: 'sem-persistencia' }

  const conf = validar(result)
  if (conf.status === 'diverge') throw new Error('Conferência divergente')
  const valores = [
    ...result.transactions.map((t) => t.amountCents), conf.somaExtraida,
    result.declaredTotal, result.declaredIncome, result.declaredExpense,
    result.balance?.initial, result.balance?.final,
    result.forward.nextInvoiceBalance, result.forward.totalOpenBalance,
    result.forward.futureInstallmentsTotal,
  ]
  if (valores.some((valor) => valor != null && !Number.isSafeInteger(valor))) {
    throw new Error('Valor fora do inteiro seguro de centavos')
  }
  const conferencia: ConferenciaSalva = {
    versao: 1, status: conf.status, contagem: conf.contagem,
    comparacoes: compararGabaritos(result),
  }
  const { data: sess } = await neon.auth.getSession()
  if (!sess?.session) throw new Error('Faça login para salvar.')

  const regras = mesclarRegras(regrasUsuario, REGRAS_GLOBAIS)
  const fileHash = await hashDocumento(fileBytes)
  const contentHash = await hashConteudoDocumento(result, kind)
  const key = accountKey(result, kind)
  const linked = vincular([paraVincular(result, key, kind.docType)])
  const identidades = await Promise.all(linked.map(async (t) => ({
    atual: await sha256(chaveTransacao(t, key)),
    legada: t.installment ? await sha256(chaveTransacaoLegada(t, key)) : null,
  })))
  const existentes = await lerHashesParcelados(neon, linked, identidades)
  const usados = new Set([...existentes.values()].flat())

  // Cada ocorrência real tem uma chave. Reusar os hashes gravados preserva
  // a deduplicação mesmo quando o histórico mistura chaves antigas e novas.
  const ocorrencias = new Map<string, number>()
  const transacoes: Record<string, unknown>[] = []
  for (const [i, t] of linked.entries()) {
    const base = identidades[i].atual
    const n = (ocorrencias.get(base) ?? 0) + 1
    ocorrencias.set(base, n)
    let hash = existentes.get(base)?.[n - 1]
    if (!hash) {
      let indice = n
      hash = hashDaOcorrencia(base, indice)
      while (usados.has(hash)) hash = hashDaOcorrencia(base, ++indice)
      usados.add(hash)
    }
    transacoes.push({
      date: t.date.toISOString().slice(0, 10),
      description: t.description,
      amount_cents: t.amountCents,
      direction: t.amountCents >= 0 ? 'out' : 'in',
      kind: kindParaBanco(t.kind, t.link),
      category_slug: categoriaDe(t, regras, { bank: kind.bank }),
      installment: t.installment,
      fx: t.fx,
      hash,
    })
  }

  const { data, error } = await neon.rpc('salvar_documento_atomico', {
    p_conta: {
      bank: kind.bank, type: result.account.type, last4: result.account.last4,
      agency: result.account.agency, number: result.account.number,
    },
    p_documento: {
      file_hash: fileHash,
      content_hash: contentHash,
      doc_type: kind.docType,
      period_start: result.period?.start.toISOString().slice(0, 10) ?? null,
      period_end: result.period?.end.toISOString().slice(0, 10) ?? null,
      declared_total: result.declaredTotal,
      declared_income: result.declaredIncome,
      declared_expense: result.declaredExpense,
      filename,
      end_balance_cents: result.balance?.final ?? null,
      next_close_date: result.forward.nextCloseDate?.toISOString().slice(0, 10) ?? null,
      next_invoice_balance: result.forward.nextInvoiceBalance,
      total_open_balance: result.forward.totalOpenBalance,
      future_installments_total: result.forward.futureInstallmentsTotal,
      conferencia,
    },
    p_transacoes: transacoes,
  })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Gravação atômica indisponível')
    }
    throw new Error(error.message)
  }
  return lerResultado(data, transacoes.length)
}

const hashDaOcorrencia = (base: string, n: number): string => n === 1 ? base : `${base}#${n}`

/** A chave antiga já inclui conta, data, valor e estabelecimento. A parcela
 *  gravada determina qual cobrança a chave antiga realmente representa. */
async function lerHashesParcelados(
  neon: NonNullable<Awaited<ReturnType<typeof obterNeon>>>,
  transacoes: RawTransaction[],
  identidades: { atual: string; legada: string | null }[],
): Promise<Map<string, string[]>> {
  const equivalencias = new Map<string, string>()
  const datas: string[] = []
  for (const [i, t] of transacoes.entries()) {
    const { atual, legada } = identidades[i]
    if (!t.installment || !legada) continue
    const { current, total } = t.installment
    equivalencias.set(`${legada}/${current}/${total}`, atual)
    equivalencias.set(`${atual}/${current}/${total}`, atual)
    datas.push(t.date.toISOString().slice(0, 10))
  }
  const existentes = new Map<string, string[]>()
  if (datas.length === 0) return existentes
  datas.sort()
  const { data, error, count } = await neon.from('transactions')
    .select('hash, installment', { count: 'exact' })
    .not('installment', 'is', null)
    .gte('date', datas[0])
    .lte('date', datas[datas.length - 1])
  if (error) throw error
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0
    || !Array.isArray(data) || data.length !== count) {
    throw new RecorteIncompletoError('a leitura dos hashes de parcelas veio incompleta')
  }

  const vistos = new Set<string>()
  for (const linha of data as unknown[]) {
    const r = linha as { hash?: unknown; installment?: { current?: unknown; total?: unknown } } | null
    const hash = r?.hash
    const parcela = r?.installment
    const base = typeof hash === 'string' ? hash.match(/^([a-f0-9]{64})(?:#[1-9]\d*)?$/)?.[1] : null
    if (typeof hash !== 'string' || !base || vistos.has(hash)
      || typeof parcela?.current !== 'number' || typeof parcela.total !== 'number'
      || !Number.isSafeInteger(parcela.current) || !Number.isSafeInteger(parcela.total)
      || parcela.current < 1 || parcela.current > parcela.total) {
      throw new RecorteIncompletoError('a leitura trouxe uma identidade de parcela inválida')
    }
    vistos.add(hash)
    const atual = equivalencias.get(`${base}/${parcela.current}/${parcela.total}`)
    if (!atual) continue
    const hashes = existentes.get(atual)
    if (hashes) hashes.push(hash)
    else existentes.set(atual, [hash])
  }
  for (const hashes of existentes.values()) hashes.sort()
  return existentes
}

function lerResultado(data: unknown, contagem: number): ResultadoSalvar {
  if (data && typeof data === 'object') {
    const r = data as Record<string, unknown>
    if (r.status === 'documento-duplicado' && typeof r.importadoEm === 'string'
      && !Number.isNaN(Date.parse(r.importadoEm))) {
      return { status: 'documento-duplicado', importadoEm: r.importadoEm }
    }
    if (r.status === 'salvo' && typeof r.documentId === 'string' && r.documentId !== ''
      && typeof r.inseridas === 'number' && Number.isSafeInteger(r.inseridas) && r.inseridas >= 0
      && typeof r.jaExistiam === 'number' && Number.isSafeInteger(r.jaExistiam) && r.jaExistiam >= 0
      && r.inseridas + r.jaExistiam === contagem) {
      return { status: 'salvo', documentId: r.documentId, inseridas: r.inseridas, jaExistiam: r.jaExistiam }
    }
  }
  throw new Error('Resposta de gravação incompleta')
}

function kindParaBanco(
  kind: RawTransaction['kind'],
  link: 'internal_transfer' | 'card_payment' | null,
): string {
  if (link === 'internal_transfer') return 'internal_transfer'
  if (link === 'card_payment') return 'card_payment'
  if (kind === 'entrada') return 'income'
  if (kind === 'pagamento') return 'card_payment'
  return 'expense'
}
