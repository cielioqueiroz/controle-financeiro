import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseBBExtrato } from './bb-extrato'
import { detectDocument } from '../pdf/detect'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/bb-extrato.items.json', 'utf-8')) as TextItem[],
)
const r = parseBBExtrato(lines)

describe('detecção do BB', () => {
  it('reconhece o extrato de conta corrente do BB', () => {
    expect(detectDocument(lines)).toEqual({ bank: 'bb', docType: 'extrato' })
  })
})

describe('parseBBExtrato — gabarito por saldo', () => {
  it('lê o saldo inicial e o final', () => {
    // A conta varre tudo para aplicação automática todo dia: saldo 0→0.
    expect(r.balance).toEqual({ initial: 0, final: 0 })
  })

  it('a soma com sinal fecha com a variação de saldo (confere ao centavo)', () => {
    const soma = r.transactions.reduce((a, t) => a + t.amountCents, 0)
    const esperado = r.balance!.initial - r.balance!.final
    expect(soma).toBe(esperado)
  })

  it('a validação confere', () => {
    expect(validar(r).status).toBe('confere')
  })

  it('não declara totais (o BB não tem linha Total)', () => {
    expect(r.declaredIncome).toBeNull()
    expect(r.declaredExpense).toBeNull()
  })
})

describe('parseBBExtrato — leitura das linhas', () => {
  it('extrai lançamentos', () => {
    expect(r.transactions.length).toBeGreaterThan(10)
  })

  it('crédito (C) vira entrada (negativo) e débito (D) vira saída (positivo)', () => {
    expect(r.transactions.some((t) => t.amountCents < 0)).toBe(true)
    expect(r.transactions.some((t) => t.amountCents > 0)).toBe(true)
  })

  it('PIX enviado é saída', () => {
    const pix = r.transactions.find((t) => /Pix - Enviado/i.test(t.description))
    expect(pix).toBeDefined()
    expect(pix!.amountCents).toBeGreaterThan(0)
  })

  it('junta a contraparte do PIX/TED (linha de detalhe) na descrição', () => {
    const comDetalhe = r.transactions.find((t) => /Pix - Enviado.+\d{2}:\d{2}/i.test(t.description))
    expect(comDetalhe).toBeDefined()
  })

  it('lê o período do extrato', () => {
    expect(r.period).not.toBeNull()
    expect(r.period!.start.getMonth()).toBe(7) // agosto (0-based)
  })

  it('não conta as linhas de saldo como transação', () => {
    expect(r.transactions.some((t) => /S\s*A\s*L\s*D\s*O|Saldo Anterior/i.test(t.description))).toBe(
      false,
    )
  })
})

describe('BB layout A — páginas de referência de 2020', () => {
  const antigo = buildLines(JSON.parse(readFileSync('tests/fixtures/bb-extrato-antigo.items.json', 'utf-8')) as TextItem[])
  const resultado = parseBBExtrato(antigo)

  it('reconhece o título e a ordem específica das duas datas', () => {
    expect(detectDocument(antigo)).toEqual({ bank: 'bb', docType: 'extrato' })
  })

  it('lê transações nas duas páginas e confere contra o saldo', () => {
    expect(resultado.transactions.length).toBeGreaterThan(20)
    expect(resultado.transactions.some((tx) => tx.amountCents < 0)).toBe(true)
    expect(resultado.transactions.some((tx) => tx.amountCents > 0)).toBe(true)
    expect(validar(resultado).status).toBe('confere')
    expect(resultado.transactions.some((tx) => /CONTRAPARTE ANONIMA/.test(tx.description))).toBe(true)
  })

  it('usa o intervalo declarado, sem presumir o mês do computador', () => {
    expect(resultado.period?.start).toEqual(new Date(2020, 11, 1))
    expect(resultado.period?.end).toEqual(new Date(2020, 11, 31))
  })

  it('a falta de uma transação faz divergir', () => {
    expect(validar({ ...resultado, transactions: resultado.transactions.slice(1) }).status).toBe('diverge')
  })

  it('recusa uma compilação com extratos de outro banco', () => {
    expect(() => parseBBExtrato([...antigo, { text: 'GOVCONTA CAIXA', page: 3, y: 0, cells: [] }])).toThrow(/contas ou períodos/)
  })

  it('recusa página de outro emissor mesmo sem conta ou período legíveis', () => {
    const outra = [
      { text: 'Bradesco Celular', page: 3, y: 0, cells: [] },
      { text: 'Extrato de: Agência', page: 3, y: 10, cells: [] },
    ]
    expect(() => parseBBExtrato([...antigo, ...outra])).toThrow(/contas ou períodos/)
  })

  it('recusa uma página sem assinatura ou estrutura de continuação BB A', () => {
    const outra = [{ text: 'Extrato de banco não reconhecido', page: 3, y: 0, cells: [] }]
    expect(() => parseBBExtrato([...antigo, ...outra])).toThrow(/contas ou períodos/)
  })

  it('recusa data de movimento impossível em vez de normalizá-la', () => {
    const invalida = antigo.map((l) => {
      if (!l.cells.some((c) => /^09\/12\/2020$/.test(c.text.trim()))) return l
      return { ...l, cells: l.cells.map((c) => c.text.trim() === '09/12/2020' ? { ...c, text: '31/02/2020' } : c) }
    })
    expect(() => parseBBExtrato(invalida)).toThrow(/Data do movimento BB/)
  })

  it('recusa datas impossíveis no período declarado', () => {
    const invalido = antigo.map((l) => {
      if (!l.text.includes('Período do extrato')) return l
      return {
        ...l,
        text: l.text.replace('01/12/2020', '31/02/2020'),
        cells: l.cells.map((c) => ({ ...c, text: c.text.replace('01/12/2020', '31/02/2020') })),
      }
    })
    expect(() => parseBBExtrato(invalido)).toThrow(/Período do extrato BB/)
  })
})
