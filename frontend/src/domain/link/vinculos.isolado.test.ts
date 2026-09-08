import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parse } from '../parsers'
import { vincular, paraVincular, gastoReal, type DocParaVincular } from './vinculos'
import type { TextItem } from '../pdf/types'

/** ## O vínculo só funciona com os documentos JUNTOS, e o app os manda um a um
 *
 *  `vinculos.test.ts` chama `vincular(docs)` com os quatro fixtures na mesma
 *  lista, e por isso passa. **O app nunca faz isso.** Tanto a gravação
 *  (`persist/salvar.ts`) quanto a prévia (`domain/insights.ts`) chamam
 *  `vincular([umDocumentoSó])` — cada importação vincula apenas o documento
 *  que está entrando.
 *
 *  Dos quatro caminhos de `vincular()`, dois dependem de cruzar documentos e
 *  portanto **nunca disparam em uso real**:
 *
 *  - **quitação de fatura**: `totaisFatura` sai dos docs da própria lista,
 *    filtrando `docType === 'fatura'`. Quando o documento que entra é o
 *    EXTRATO — que é onde a quitação aparece —, a lista de faturas está
 *    vazia, e o pagamento não casa com nada;
 *  - **pares entre contas**: exige `b.accountKey !== a.accountKey`, e com um
 *    documento só todas as transações têm a mesma chave.
 *
 *  Sobram os dois que olham uma transação de cada vez (a varredura do BB e a
 *  transferência reconhecida pelo nome do titular).
 *
 *  A consequência é o que o `CONTEXT.md` chama de **dupla contagem** — "somar
 *  o mesmo dinheiro duas vezes ao importar a fatura e o extrato do mesmo mês"
 *  — e diz, na mesma entrada, que "é o que o vínculo existe para impedir". O
 *  **gasto real**, que o glossário chama de "o número honesto do sistema",
 *  inclui hoje a quitação inteira da fatura além das compras que ela paga.
 *
 *  Estes casos existem para segurar a diferença: o mesmo documento, medido
 *  dos dois jeitos. Enquanto o app vincular um documento por vez, eles
 *  descrevem o que o usuário recebe. */

function doc(nome: string, docType: 'fatura' | 'extrato'): DocParaVincular {
  const lines = buildLines(
    JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8')) as TextItem[],
  )
  const { result } = parse(lines)
  return paraVincular(result, nome, docType)
}

const fatura = doc('nubank-fatura', 'fatura')
const extrato = doc('nubank-extrato', 'extrato')

/** A quitação da fatura do Nubank, no extrato: R$ 8.324,24. É o mesmo
 *  lançamento que `vinculos.test.ts` usa para provar que o vínculo funciona. */
const QUITACAO = 832424

const acharQuitacao = (linked: ReturnType<typeof vincular>) =>
  linked.find((t) => Math.abs(t.amountCents) === QUITACAO && /Pagamento de fatura/i.test(t.description))

describe('vincular — com os documentos juntos (o que o teste antigo mede)', () => {
  it('a quitação da fatura é reconhecida', () => {
    const pag = acharQuitacao(vincular([fatura, extrato]))
    expect(pag).toBeDefined()
    expect(pag!.link).toBe('card_payment')
  })
})

describe('vincular — um documento por vez (o que o APP faz)', () => {
  it('a mesma quitação NÃO é reconhecida', () => {
    const pag = acharQuitacao(vincular([extrato]))

    expect(pag).toBeDefined()
    // O documento é o mesmo; só a companhia mudou.
    expect(pag!.link).toBeNull()
  })

  /** O tamanho do buraco, em reais. Não é uma diferença de arredondamento:
   *  é a fatura inteira contada duas vezes — uma nas compras, outra na
   *  quitação. */
  it('e o gasto real fica MAIOR pelo valor da fatura inteira', () => {
    const juntos = gastoReal(vincular([fatura, extrato]))
    const separados = gastoReal(vincular([fatura])) + gastoReal(vincular([extrato]))

    expect(separados - juntos).toBe(QUITACAO)
  })
})
