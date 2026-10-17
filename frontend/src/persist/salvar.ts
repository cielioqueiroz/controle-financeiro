import { obterNeon } from '../lib/neon'
import type { ParseResult, RawTransaction } from '../domain/parsers/types'
import type { DocKind } from '../domain/pdf/detect'
import { hashConteudoDocumento, hashDocumento, chaveTransacao, sha256 } from '../domain/dedupe/hash'
import { categoriaDe, REGRAS_GLOBAIS, type Regra } from '../domain/categorize/regras'
import { mesclarRegras } from '../domain/categorize/aprendizado'
import { vincular, paraVincular } from '../domain/link/vinculos'
import { compararGabaritos, validar } from '../domain/validate/checksum'
import type { ConferenciaSalva } from '../domain/validate/conferencia-salva'

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

  // Duas linhas idênticas no mesmo documento são ocorrências reais. O
  // sufixo também precisa coincidir entre documentos sobrepostos.
  const ocorrencias = new Map<string, number>()
  const transacoes: Record<string, unknown>[] = []
  for (const t of linked) {
    const base = await sha256(chaveTransacao(t, key))
    const n = (ocorrencias.get(base) ?? 0) + 1
    ocorrencias.set(base, n)
    transacoes.push({
      date: t.date.toISOString().slice(0, 10),
      description: t.description,
      amount_cents: t.amountCents,
      direction: t.amountCents >= 0 ? 'out' : 'in',
      kind: kindParaBanco(t.kind, t.link),
      category_slug: categoriaDe(t, regras),
      installment: t.installment,
      fx: t.fx,
      hash: n === 1 ? base : `${base}#${n}`,
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
