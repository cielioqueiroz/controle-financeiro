import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parse } from '../parsers'
import { categoriaDe, extrairCNPJ, criarRegraConsulta, consultaDeRegraValida, casaRegra, REGRAS_GLOBAIS } from './regras'
import type { TextItem } from '../pdf/types'
import type { RawTransaction } from '../parsers/types'

const tx = (description: string): RawTransaction => ({
  date: new Date(2026, 5, 1),
  description,
  amountCents: 1000,
  installment: null,
  card: null,
  fx: null,
  kind: 'compra',
  raw: description,
})

describe('regras com operadores', () => {
  it('combina texto, banco e magnitude do valor, preservando os dois sinais', () => {
    const regras = [criarRegraConsulta('posto banco:nubank >100 <200', 'viagem'), ...REGRAS_GLOBAIS]
    for (const amountCents of [15000, -15000]) {
      const transacao = { ...tx('AUTO POSTO CENTRAL'), amountCents }
      expect(categoriaDe(transacao, regras, { bank: 'nubank' })).toBe('viagem')
      expect(categoriaDe(transacao, regras, { bank: 'bb' })).toBe('combustivel')
      expect(categoriaDe(transacao, regras)).toBe('combustivel')
    }
    expect(categoriaDe({ ...tx('AUTO POSTO'), amountCents: 10000 }, regras, { bank: 'nubank' })).toBe('combustivel')
  })

  it('cat e sem categoria sempre olham a categoria global, independente da ordem', () => {
    const regras = [criarRegraConsulta('cat:combustivel', 'viagem'), criarRegraConsulta('sem:categoria', 'servicos')]
    for (const ordenadas of [regras, [...regras].reverse()]) {
      expect(categoriaDe(tx('AUTO POSTO'), [...ordenadas, ...REGRAS_GLOBAIS])).toBe('viagem')
      expect(categoriaDe(tx('ALGO DESCONHECIDO'), [...ordenadas, ...REGRAS_GLOBAIS])).toBe('servicos')
    }
  })

  it('mantém prioridade, especificidade e a categoria global diante de regra inválida', () => {
    const regra = criarRegraConsulta('posto', 'viagem')
    const aprendida = { padrao: 'AUTO POSTO CENTRAL', tipo: 'contains' as const, categoria: 'servicos', prioridade: 1000 }
    expect(categoriaDe(tx('AUTO POSTO CENTRAL'), [regra, aprendida, ...REGRAS_GLOBAIS])).toBe('servicos')
    expect(categoriaDe(tx('AUTO POSTO'), [{ ...regra, padrao: '' }, ...REGRAS_GLOBAIS])).toBe('combustivel')
  })

  it.each(['', '  ', '>', '>abc', '>1,,2', '>1.2.3', '>9007199254740991', 'banco:', 'banco:inexistente', 'sem:algo', 'cat:', 'cat:inexistente', '>100 <100', '>100 <100,01', '<0', 'banco:bb banco:nubank', 'cat:taxas sem:categoria'])('recusa condição vazia ou impossível: %s', (padrao) => {
    expect(consultaDeRegraValida(padrao)).toBe(false)
    expect(() => criarRegraConsulta(padrao, 'viagem')).toThrow()
  })

  it('preserva operador desconhecido como texto e aceita limites e categorias coerentes', () => {
    expect(consultaDeRegraValida('PIX:Joao >100')).toBe(true)
    expect(consultaDeRegraValida('cat:outros sem:categoria <0,02')).toBe(true)
    expect(categoriaDe({ ...tx('PIX:Joao'), amountCents: 20000 }, [criarRegraConsulta('PIX:Joao >100', 'servicos')])).toBe('servicos')
  })

  it('exige contexto real para avaliar uma consulta avulsa', () => {
    const regra = criarRegraConsulta('posto banco:nubank >100 cat:combustivel', 'viagem')
    expect(casaRegra(regra, 'AUTO POSTO')).toBe(false)
    expect(casaRegra(regra, 'AUTO POSTO', { amountCents: 15000, bank: 'nubank', categoriaBase: 'combustivel' })).toBe(true)
  })
})

describe('categoriaDe — estabelecimentos reais', () => {
  const casos: Array<[string, string]> = [
    ['Ofertao Supermercado', 'supermercado'],
    ['Mercado Josias', 'supermercado'],
    ['Panificadora Farturao', 'padaria'],
    ["D'Tudo Massa'S", 'padaria'],
    ['Farmacia Bom Preco', 'farmacia'],
    ['Farma Lider', 'farmacia'],
    ['Auto Posto Novo Mundo', 'combustivel'],
    ['MERCADOLIVRE*MERCADOLIVRE', 'marketplace'],
    ['Americanas', 'marketplace'],
    ['Havan Palmas', 'marketplace'],
    ['EBN*SPOTIFY', 'assinaturas'],
    ['Anthropic* Claude Sub', 'assinaturas'],
    ['AmazonPrimeBR', 'assinaturas'],
    ['Hna*Oboticario', 'beleza'],
    ['Oticas Carol', 'beleza'],
    ['Airbnb * Hmmr9qz9xf', 'viagem'],
    ['Anuidade Diferenciada', 'taxas'],
    ['IOF S/ UTILIZACAO LIMITE', 'taxas'],
    ['RENDIMENTOS POUP FACIL-DEPOS', 'rendimentos'],
  ]

  for (const [desc, esperado] of casos) {
    it(`"${desc}" → ${esperado}`, () => {
      expect(categoriaDe(tx(desc))).toBe(esperado)
    })
  }
})

describe('categoriaDe — assinatura vence marketplace (prioridade)', () => {
  it('Amazon Prime é assinatura, não marketplace', () => {
    expect(categoriaDe(tx('AmazonPrimeBR'))).toBe('assinaturas')
  })
  it('Amazon Marketplace é marketplace', () => {
    expect(categoriaDe(tx('AMAZON MARKETPLACE'))).toBe('marketplace')
  })
})

describe('extrairCNPJ', () => {
  it('extrai CNPJ do extrato Nubank', () => {
    expect(extrairCNPJ('IFOOD COM ... - 14.380.200/0001-21 - ITAU')).toBe('14380200000121')
  })
  it('devolve null sem CNPJ', () => {
    expect(extrairCNPJ('Ofertao Supermercado')).toBeNull()
  })
})

describe('cobertura de categorização nos dados reais', () => {
  it('categoriza a maioria das transações (poucos em Outros)', () => {
    const fx = ['nubank-fatura', 'nubank-extrato', 'bradesco-fatura', 'bradesco-extrato']
    let total = 0
    let outros = 0
    const emOutros: string[] = []
    for (const f of fx) {
      const lines = buildLines(
        JSON.parse(readFileSync(`tests/fixtures/${f}.items.json`, 'utf-8')) as TextItem[],
      )
      const { result } = parse(lines)
      for (const t of result.transactions) {
        total++
        const cat = categoriaDe(t)
        if (cat === 'outros') {
          outros++
          emOutros.push(t.description)
        }
      }
    }
    const cobertura = (total - outros) / total
    // Log para inspeção do que ficou sem categoria
    if (outros > 0) console.log(`\n${outros}/${total} em Outros:`, [...new Set(emOutros)])
    expect(cobertura).toBeGreaterThan(0.75)
  })
})
