import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parse, ParserNaoImplementadoError } from './index'
import type { TextItem } from '../pdf/types'
import type { Line } from '../pdf/lines'

/** O despachante nunca teve teste, e é ele que decide QUAL dos nove parsers
 *  lê o documento. Cada parser tem o seu fixture; ninguém guardava a escolha
 *  entre eles.
 *
 *  O modo de falha é o pior deste sistema: despacho errado **não dá erro**.
 *  Se o extrato do Bradesco caísse no parser do BB, o resultado seria um
 *  `ParseResult` válido, com números — e a conferência contra o gabarito
 *  reprovaria sem dizer por quê, ou pior, passaria por acaso num documento
 *  de poucas linhas.
 *
 *  ⚠️ `readFileSync` é relativo ao CWD, e o Vitest roda de `frontend/` — ver
 *  `AGENTS.md` §4.2. É o mesmo caminho que os nove testes de parser usam. */

const carregar = (nome: string): Line[] =>
  buildLines(JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8')) as TextItem[])

/** Os nove documentos de referência e o que o detector TEM que concluir. */
const ESPERADO = [
  { fixture: 'nubank-fatura', bank: 'nubank', docType: 'fatura' },
  { fixture: 'nubank-extrato', bank: 'nubank', docType: 'extrato' },
  { fixture: 'bradesco-fatura', bank: 'bradesco', docType: 'fatura' },
  { fixture: 'bradesco-extrato', bank: 'bradesco', docType: 'extrato' },
  { fixture: 'bb-extrato', bank: 'bb', docType: 'extrato' },
  { fixture: 'sicredi-extrato', bank: 'sicredi', docType: 'extrato' },
  { fixture: 'sicoob-extrato', bank: 'sicoob', docType: 'extrato' },
  { fixture: 'mercadopago-fatura', bank: 'mercadopago', docType: 'fatura' },
  { fixture: 'mercadopago-extrato', bank: 'mercadopago', docType: 'extrato' },
] as const

describe('parse — despacho por documento de referência', () => {
  for (const { fixture, bank, docType } of ESPERADO) {
    it(`${fixture} → ${bank}/${docType}`, () => {
      const { kind } = parse(carregar(fixture))
      expect(kind).toEqual({ bank, docType })
    })
  }

  /** O despacho certo não basta: o parser escolhido tem que ter LIDO algo.
   *  Um despacho para o parser errado costuma devolver zero transações, e
   *  esta asserção é o que separa "escolheu certo" de "escolheu qualquer um". */
  it('todo documento de referência sai com transações', () => {
    for (const { fixture } of ESPERADO) {
      const { result } = parse(carregar(fixture))
      expect(result.transactions.length, fixture).toBeGreaterThan(0)
    }
  })

  /** A ORDEM das assinaturas importa (o extrato do Bradesco também contém
   *  "Fatura" no rodapé — `AGENTS.md` §2.3). Se alguém reordenar `detect.ts`
   *  e quebrar isso, os dois pares fatura/extrato do mesmo banco trocam de
   *  lugar — e este é o teste que reprova. */
  it('não confunde fatura com extrato do mesmo banco', () => {
    const pares = [
      ['nubank-fatura', 'nubank-extrato'],
      ['bradesco-fatura', 'bradesco-extrato'],
      ['mercadopago-fatura', 'mercadopago-extrato'],
    ] as const
    for (const [fat, ext] of pares) {
      expect(parse(carregar(fat)).kind.docType, fat).toBe('fatura')
      expect(parse(carregar(ext)).kind.docType, ext).toBe('extrato')
    }
  })

  it('cada fixture cai num parser diferente — nenhum banco engole o do vizinho', () => {
    const escolhas = ESPERADO.map(({ fixture }) => {
      const { kind } = parse(carregar(fixture))
      return `${kind.bank}/${kind.docType}`
    })
    expect(new Set(escolhas).size).toBe(ESPERADO.length)
  })
})

describe('parse — documento que o app não lê', () => {
  const linhasSoltas = (textos: string[]): Line[] =>
    buildLines(
      textos.map((text, i) => ({
        text,
        x: 50,
        y: 700 - i * 20,
        width: text.length * 6,
        height: 12,
        page: 1,
      })) as TextItem[],
    )

  it('banco desconhecido lança ParserNaoImplementadoError', () => {
    expect(() => parse(linhasSoltas(['RECIBO', 'Valor 10,00']))).toThrow(
      ParserNaoImplementadoError,
    )
  })

  /** A mensagem é o que a tela mostra ("Ainda não sei ler este documento").
   *  Ela distingue "não reconheci o emissor" de "reconheci e não sei ler
   *  este tipo" — e `lib/falha-importacao.ts` casa por classe, não por
   *  texto, então o que este teste guarda é o CONTRATO das duas frases. */
  it('a mensagem diz que não reconheceu, quando o banco é desconhecido', () => {
    try {
      parse(linhasSoltas(['DOCUMENTO QUALQUER']))
      expect.unreachable('devia ter lançado')
    } catch (e) {
      expect(e).toBeInstanceOf(ParserNaoImplementadoError)
      expect((e as ParserNaoImplementadoError).message).toMatch(/não reconheci/i)
      expect((e as ParserNaoImplementadoError).kind.bank).toBe('desconhecido')
    }
  })

  it('o erro carrega o kind, para a tela poder dizer QUAL banco', () => {
    try {
      parse(linhasSoltas(['nada aqui']))
      expect.unreachable('devia ter lançado')
    } catch (e) {
      expect((e as ParserNaoImplementadoError).kind).toHaveProperty('bank')
      expect((e as ParserNaoImplementadoError).kind).toHaveProperty('docType')
    }
  })
})
