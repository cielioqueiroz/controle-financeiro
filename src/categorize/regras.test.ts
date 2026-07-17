import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parse } from '../parsers'
import { categoriaDe, extrairCNPJ } from './regras'
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
