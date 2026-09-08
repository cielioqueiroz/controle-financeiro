import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parse } from '../parsers'
import { vincular, paraVincular, type DocParaVincular, type LinkedTransaction } from './vinculos'
import type { TextItem } from '../pdf/types'

/** ## O app manda os documentos um a um, e dois vínculos nunca disparam
 *
 *  `vinculos.test.ts` chama `vincular(docs)` com os quatro fixtures na mesma
 *  lista. **O app nunca faz isso**: tanto a gravação (`persist/salvar.ts`)
 *  quanto a prévia (`domain/insights.ts`) chamam `vincular([umDocumentoSó])`.
 *
 *  Dos quatro caminhos de `vincular()`, dois dependem de cruzar documentos e
 *  portanto não disparam em uso real:
 *
 *  - **quitação de fatura**: `totaisFatura` sai dos docs da própria lista,
 *    filtrando `docType === 'fatura'`. Quando o documento que entra é o
 *    EXTRATO — que é onde a quitação aparece —, a lista de faturas está vazia;
 *  - **pares entre contas**: exige `accountKey` diferente, e com um documento
 *    só todas as transações têm a mesma chave.
 *
 *  ## ⚠️ E ainda assim o GASTO não muda — a primeira versão deste arquivo errou
 *
 *  A versão de 2026-09-08 media `gastoReal()`, que filtra por `link`, e
 *  concluía que faltavam R$ 8.324,24 ao número do usuário. **Estava errado, e
 *  o erro foi olhar a função que o app não usa nesse caminho.**
 *
 *  Quem decide o que é gasto na leitura é o `kind` GRAVADO (`agrupar.ts` faz
 *  `t.kind !== 'expense'`), e quem grava é o `kindParaBanco`, que já devolve
 *  `card_payment` quando o parser marcou a transação como `pagamento` —
 *  **independentemente do `link`**. A quitação de fatura, que é o caso mais
 *  visível, é reconhecida pelo parser e sai da contagem por essa via.
 *
 *  O caso abaixo mede o gasto pelo mesmo critério da leitura, e dá **zero de
 *  diferença**: R$ 41.012,25 dos dois jeitos — que é o número de referência do
 *  `AGENTS.md` para estes quatro documentos.
 *
 *  ## O que então se perde de verdade
 *
 *  1. **O `linkNote`.** "Quitação da fatura nubank" e "Transferência entre suas
 *     contas" são a explicação que a tela mostra, e ela não é produzida.
 *  2. **A rede de segurança.** Os dois caminhos que não disparam são
 *     justamente os que não dependem de o parser ter acertado o `kind`. Hoje o
 *     número está certo porque uma segunda via o segura; o dia em que um
 *     parser novo não marcar `pagamento`, ou em que a transferência entre
 *     contas próprias não for reconhecida pelo nome do titular, a dupla
 *     contagem aparece — e não haverá nada atrás.
 *
 *  Por isso estes casos existem: eles fixam o que é verdade hoje (o número
 *  está certo) e o que é frágil (a razão de ele estar certo é uma só). */

function doc(nome: string, docType: 'fatura' | 'extrato'): DocParaVincular {
  const lines = buildLines(
    JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8')) as TextItem[],
  )
  const { result } = parse(lines)
  return paraVincular(result, nome, docType)
}

const DOCS = [
  doc('nubank-fatura', 'fatura'),
  doc('nubank-extrato', 'extrato'),
  doc('bradesco-fatura', 'fatura'),
  doc('bradesco-extrato', 'extrato'),
]

/** Cópia fiel do `kindParaBanco` de `persist/salvar.ts`, que é privado.
 *
 *  Duplicar é o menor mal aqui: exportá-lo só para o teste alargaria a
 *  superfície de um módulo de escrita, e o que este arquivo precisa provar é
 *  justamente que **a regra de gravação tem uma segunda via** que o `link` não
 *  conhece. Se a lá mudar e esta não, o caso do gasto abaixo passa a divergir
 *  do número de referência do `AGENTS.md` — e é isso que se quer que apareça. */
const kindParaBanco = (kind: string, link: string | null): string => {
  if (link === 'internal_transfer') return 'internal_transfer'
  if (link === 'card_payment') return 'card_payment'
  if (kind === 'entrada') return 'income'
  if (kind === 'pagamento') return 'card_payment'
  return 'expense'
}

/** O gasto pelo critério da LEITURA: o `kind` gravado, não o `link`. */
const gastoDaLeitura = (linked: LinkedTransaction[]): number =>
  linked
    .filter((t) => kindParaBanco(t.kind, t.link) === 'expense' && t.amountCents > 0)
    .reduce((a, t) => a + t.amountCents, 0)

const QUITACAO = 832424

const acharQuitacao = (linked: LinkedTransaction[]) =>
  linked.find(
    (t) => Math.abs(t.amountCents) === QUITACAO && /Pagamento de fatura/i.test(t.description),
  )

describe('vincular — o app manda um documento por vez', () => {
  it('com os documentos juntos, a quitação é reconhecida', () => {
    expect(acharQuitacao(vincular(DOCS))!.link).toBe('card_payment')
  })

  it('um a um, a mesma quitação fica sem vínculo', () => {
    const so = vincular([DOCS[1]])
    expect(acharQuitacao(so)).toBeDefined()
    expect(acharQuitacao(so)!.link).toBeNull()
  })

  it('e são dois vínculos a menos no total', () => {
    const juntos = vincular(DOCS).filter((t) => t.link).length
    const umAUm = DOCS.flatMap((d) => vincular([d])).filter((t) => t.link).length

    expect(juntos).toBe(6)
    expect(umAUm).toBe(4)
  })
})

describe('vincular — e mesmo assim o gasto da tela não muda', () => {
  /** O que segura o número é o `kind` do parser, não o `link`: a quitação vem
   *  marcada como `pagamento`, e o `kindParaBanco` a grava como
   *  `card_payment` de qualquer jeito. */
  it('a quitação é gravada como vínculo mesmo sem link', () => {
    const so = vincular([DOCS[1]])
    const pag = acharQuitacao(so)!

    expect(pag.link).toBeNull()
    expect(kindParaBanco(pag.kind, pag.link)).toBe('card_payment')
  })

  /** R$ 41.012,25 é o número de referência do `AGENTS.md` para estes quatro
   *  documentos. Ele é o mesmo com os documentos juntos e um a um — a
   *  diferença é ZERO, e não os R$ 8.324,24 que a primeira versão deste
   *  arquivo afirmou. */
  it('o gasto é o mesmo dos dois jeitos, e é o número de referência', () => {
    const juntos = gastoDaLeitura(vincular(DOCS))
    const umAUm = DOCS.map((d) => gastoDaLeitura(vincular([d]))).reduce((a, b) => a + b, 0)

    expect(juntos).toBe(4101225)
    expect(umAUm - juntos).toBe(0)
  })
})
