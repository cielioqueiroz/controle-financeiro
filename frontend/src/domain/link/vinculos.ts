import type { RawTransaction, ParseResult } from '../parsers/types'
import type { Bank } from '../pdf/detect'

export type LinkKind = 'internal_transfer' | 'card_payment' | null

export type LinkedTransaction = RawTransaction & {
  accountKey: string
  bank: Bank
  /** Vínculo que tira esta transação da contagem de gastos, se houver. */
  link: LinkKind
  linkNote: string | null
}

export type DocParaVincular = {
  bank: Bank
  accountKey: string
  holderName: string | null
  declaredTotal: number | null
  docType: 'fatura' | 'extrato' | 'desconhecido'
  transactions: RawTransaction[]
}

/** Constrói um DocParaVincular a partir de um ParseResult. */
export function paraVincular(
  result: ParseResult,
  accountKey: string,
  docType: 'fatura' | 'extrato' | 'desconhecido',
): DocParaVincular {
  return {
    bank: result.account.bank,
    accountKey,
    holderName: result.account.holderName,
    declaredTotal: result.declaredTotal,
    docType,
    transactions: result.transactions,
  }
}

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/** O nome do contraparte bate com o do titular? Tolera o truncamento do
 *  Bradesco (~26 chars): um é prefixo do outro, com mínimo de 15 chars
 *  para não casar por acaso. */
function ehMesmoTitular(contraparte: string, titular: string | null): boolean {
  if (!titular) return false
  const a = norm(contraparte)
  const b = norm(titular)
  const menor = a.length < b.length ? a : b
  const maior = a.length < b.length ? b : a
  return menor.length >= 15 && maior.startsWith(menor)
}

/** Extrai o nome do contraparte de uma descrição de PIX/TED. */
function contraparteDe(desc: string): string | null {
  const m = desc.match(/(?:DES:|REM:|DEST\.)\s*([A-Za-zÀ-ú][A-Za-zÀ-ú\s]+?)(?:\s+\d|\s*-|\s*$)/)
  return m ? m[1].trim() : null
}

const PAGAMENTO_FATURA = /Pagamento de fatura|GASTOS CARTAO DE CREDITO/i

/** Varredura interna do BB: o saldo é aplicado/resgatado da aplicação
 *  automática todo dia. Entra na conferência de saldo do extrato, mas NÃO
 *  é gasto nem entrada — é dinheiro indo e voltando da própria aplicação. */
const VARREDURA_INTERNA = /Resgate Autom|Aplica[çc][ãa]o|Aplic\.?\s*BB|Resg\.?\s*BB/i

/** Cruza todos os documentos importados e marca:
 *
 *  1. `card_payment` — transação de extrato "Pagamento de fatura" cujo
 *     valor bate com o total declarado de uma fatura do mesmo titular.
 *     Deixa de contar como despesa (a fatura já detalha os gastos).
 *  2. `internal_transfer` — PIX/TED entre contas do próprio titular:
 *     quando o contraparte é o titular, OU quando há par casado (mesmo
 *     valor, contas diferentes, sinais opostos, ≤2 dias).
 *
 *  Sem isso, os quatro documentos somam o mesmo dinheiro duas vezes e os
 *  gastos inflam ~2x (ver spec, "Dupla contagem"). */
export function vincular(docs: DocParaVincular[]): LinkedTransaction[] {
  const todas: LinkedTransaction[] = docs.flatMap((d) =>
    d.transactions.map((t) => ({
      ...t,
      accountKey: d.accountKey,
      bank: d.bank,
      link: null as LinkKind,
      linkNote: null as string | null,
    })),
  )

  const totaisFatura = docs
    .filter((d) => d.docType === 'fatura' && d.declaredTotal != null)
    .map((d) => ({ bank: d.bank, total: d.declaredTotal! }))

  const titular = docs.map((d) => d.holderName).find(Boolean) ?? null

  for (const t of todas) {
    // 0. Varredura interna do BB (conta ↔ aplicação automática).
    if (VARREDURA_INTERNA.test(t.description)) {
      t.link = 'internal_transfer'
      t.linkNote = 'Aplicação automática'
      continue
    }

    // 1. Pagamento de fatura → card_payment
    if (t.kind === 'pagamento' || PAGAMENTO_FATURA.test(t.description)) {
      const valor = Math.abs(t.amountCents)
      const fatura = totaisFatura.find((f) => f.total === valor)
      if (fatura) {
        t.link = 'card_payment'
        t.linkNote = `Quitação da fatura ${fatura.bank}`
        continue
      }
    }

    // 2. Transferência para o próprio titular
    const cp = contraparteDe(t.description)
    if (cp && ehMesmoTitular(cp, titular)) {
      t.link = 'internal_transfer'
      t.linkNote = 'Transferência entre suas contas'
    }
  }

  // 2b. Pares casados entre contas diferentes (mesmo valor, sinais
  // opostos, ≤2 dias) que não foram pegos pelo nome.
  for (const a of todas) {
    if (a.link) continue
    if (a.kind !== 'compra' && a.kind !== 'entrada') continue
    for (const b of todas) {
      if (b === a || b.link) continue
      if (b.accountKey === a.accountKey) continue
      if (a.amountCents !== -b.amountCents) continue
      if (Math.abs(a.date.getTime() - b.date.getTime()) > 2 * 86400_000) continue
      a.link = 'internal_transfer'
      b.link = 'internal_transfer'
      a.linkNote = 'Transferência entre suas contas'
      b.linkNote = 'Transferência entre suas contas'
      break
    }
  }

  return todas
}

/** Soma de gastos reais: exclui vínculos e entradas. É o número honesto. */
export function gastoReal(linked: LinkedTransaction[]): number {
  return linked
    .filter((t) => t.link === null && t.amountCents > 0)
    .reduce((a, t) => a + t.amountCents, 0)
}

/** `kind` gravado é um vínculo — dinheiro que só mudou de lugar?
 *
 *  Os dois valores respondem a mesma pergunta rio abaixo: `agregar` exclui
 *  ambos do gasto, `maioresSaidas` ignora ambos e a lista desenha ambos
 *  esmaecidos. Ter o teste num lugar só evita que alguém acrescente um
 *  terceiro vínculo e conserte metade dos chamadores. */
export function ehVinculo(kind: string): boolean {
  return kind === 'internal_transfer' || kind === 'card_payment'
}

/** O `kind` a gravar quando o USUÁRIO liga ou desliga o vínculo à mão.
 *
 *  Existe porque o vínculo era 100% automático e sem recurso: quando a
 *  heurística de `vincular()` erra — deixa passar uma transferência entre
 *  contas próprias, ou marca como quitação o que era compra —, o "gasto
 *  real", que o CONTEXT.md chama de número honesto do sistema, fica errado
 *  e não havia como consertar de dentro do app.
 *
 *  Desligar devolve `expense`/`income` pelo SINAL do valor, porque o kind
 *  original não é recuperável: a coluna guarda um valor só. É a mesma
 *  convenção que `kindParaBanco` usa na importação.
 *
 *  Ligar grava sempre `internal_transfer`, nunca `card_payment`: a quitação
 *  de fatura é conclusão de uma conferência entre documentos (o valor bate
 *  com o total declarado), não algo que se afirme no olho. E como os dois
 *  são equivalentes rio abaixo, nada se perde. */
export function kindComVinculo(marcar: boolean, amountCents: number): string {
  if (marcar) return 'internal_transfer'
  return amountCents < 0 ? 'income' : 'expense'
}
