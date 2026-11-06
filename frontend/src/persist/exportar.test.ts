import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarNeonFalso, type EstadoFalso } from './neon-falso'

const dublê = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../lib/neon', () => {
  const mod = {
    get neon() {
      return dublê.cliente
    },
    neonConfigurado: true,
  }
  return Object.assign(mod, { obterNeon: () => Promise.resolve(mod.neon) })
})

const { puxarMeusDados } = await import('./exportar')

function banco(estado: EstadoFalso = {}) {
  const falso = criarNeonFalso(estado)
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

describe('puxarMeusDados', () => {
  it('lê as sete tabelas da pessoa com contagem exata', async () => {
    const falso = banco({
      contas: [{ id: 'a1', bank: 'nubank', type: 'credit_card', last4: '1234', number: null }],
      documentos: [{ imported_at: '2026-11-01T00:00:00Z', file_hash: 'h1' }],
      transacoes: [{ id: 't1', amount_cents: 1234 }],
      linhas: {
        merchant_rules: [{ id: 'r1', pattern: 'PADARIA' }],
        categories: [
          { id: 'global', user_id: null, slug: 'alimentacao' },
          { id: 'c1', user_id: 'u1', slug: 'cafe' },
        ],
        client_errors: [{ id: 'e1', error_class: 'TypeError' }],
        preferencias: [{ user_id: 'u1', idioma: 'pt' }],
      },
    })

    const dados = await puxarMeusDados()

    expect(Object.keys(dados)).toEqual([
      'accounts',
      'documents',
      'transactions',
      'merchant_rules',
      'categories',
      'client_errors',
      'preferencias',
    ])
    expect(dados.categories).toEqual([{ id: 'c1', user_id: 'u1', slug: 'cafe' }])
    expect(falso.chamadas.filter((c) => c.op === 'select')).toHaveLength(7)
    expect(falso.chamadas.every((c) => c.contagem === 'exact')).toBe(true)
  })

  it('não exporta categorias globais', async () => {
    const falso = banco()
    await puxarMeusDados()
    const categorias = falso.chamadas.find((c) => c.tabela === 'categories')
    expect(categorias?.filtros).toEqual([{ tipo: 'not', coluna: 'user_id', valor: null }])
  })

  it('recusa resposta truncada em vez de baixar cópia parcial', async () => {
    banco({
      contas: [{ id: 'a1', bank: 'nubank', type: 'checking', last4: null, number: '1' }],
      truncarEm: 0,
    })
    await expect(puxarMeusDados()).rejects.toThrow(/accounts.*1.*0/i)
  })

  it('propaga erro de leitura e para sem fingir exportação completa', async () => {
    const falso = banco({ erro: { tabela: 'merchant_rules', op: 'select', message: 'boom' } })
    await expect(puxarMeusDados()).rejects.toMatchObject({ message: 'boom' })
    expect(falso.chamadas.map((c) => c.tabela)).toEqual([
      'accounts',
      'documents',
      'transactions',
      'merchant_rules',
    ])
  })
})
