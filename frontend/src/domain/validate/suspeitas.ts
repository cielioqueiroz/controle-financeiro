import type { ParseResult, RawTransaction } from '../parsers/types'
import type { ComparacaoGabarito } from './checksum'

/** Uma linha que explicaria sozinha a diferença de uma conferência.
 *
 *  `igual`: a diferença é exatamente o valor dela — entrou numa soma em que
 *  não devia (o pagamento da fatura anterior lido como compra, 03/11/2026).
 *  `dobro`: a diferença é o dobro dela — ela entrou com o sinal trocado (o
 *  estorno lido como compra soma +x em vez de −x). */
export type LinhaSuspeita = { tipo: 'igual' | 'dobro'; transacao: RawTransaction }

/** Acima disso, apontar uma linha entre várias de mesmo valor é chute. */
const MAX_SUSPEITAS = 3

/** Quanto a transação soma no critério, ou `null` se fica fora dele. É o
 *  espelho de `compararGabaritos`: o que entra lá é o que pode ser suspeito
 *  aqui. */
function contribuicao(criterio: ComparacaoGabarito['criterio'], t: RawTransaction): number | null {
  switch (criterio) {
    case 'total-fatura': return t.kind === 'compra' || t.kind === 'encargo' ? t.amountCents : null
    case 'entradas': return t.amountCents < 0 ? -t.amountCents : null
    case 'saidas': return t.amountCents > 0 ? t.amountCents : null
    case 'variacao-saldo': return t.amountCents
  }
}

/** As linhas que explicariam sozinhas a diferença de uma comparação.
 *
 *  Só aponta: quem decide é a pessoa, com o PDF na mão. Diferença para
 *  menos em entradas ou saídas é linha que NÃO foi lida, e essa não está
 *  no resultado para ser apontada. O sinal trocado só existe nas somas que
 *  misturam os dois sinais (total da fatura e variação do saldo). */
export function linhasSuspeitas(result: ParseResult, comparacao: ComparacaoGabarito): LinhaSuspeita[] {
  const d = comparacao.diferencaCents
  if (d === 0) return []
  const misturaSinais = comparacao.criterio === 'total-fatura' || comparacao.criterio === 'variacao-saldo'
  const suspeitas: LinhaSuspeita[] = []
  for (const transacao of result.transactions) {
    const valor = contribuicao(comparacao.criterio, transacao)
    if (valor === null) continue
    if (valor === d) suspeitas.push({ tipo: 'igual', transacao })
    else if (misturaSinais && 2 * valor === d) suspeitas.push({ tipo: 'dobro', transacao })
  }
  return suspeitas.length <= MAX_SUSPEITAS ? suspeitas : []
}
