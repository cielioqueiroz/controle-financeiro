import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const { apagarMeusDados } = await import('./conta')

function banco(estado: EstadoFalso = {}) {
  const falso = criarNeonFalso(estado)
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

describe('apagarMeusDados', () => {
  it('apaga todas as tabelas da pessoa, documentos primeiro', async () => {
    const falso = banco()
    await apagarMeusDados()
    const apagadas = falso.chamadas.filter((c) => c.op === 'delete').map((c) => c.tabela)
    expect(apagadas).toEqual([
      'documents',
      'transactions',
      'accounts',
      'merchant_rules',
      'categories',
      'client_errors',
      'preferencias',
    ])
  })

  /** As categorias globais têm `user_id` nulo e são de todo mundo. */
  it('em categories, filtra só as próprias', async () => {
    const falso = banco()
    await apagarMeusDados()
    const cat = falso.chamadas.find((c) => c.tabela === 'categories')
    expect(cat?.filtros).toEqual([{ tipo: 'not', coluna: 'user_id', valor: null }])
  })

  it('para no primeiro erro e não segue apagando', async () => {
    const falso = banco({ erro: { tabela: 'accounts', op: 'delete', message: 'boom' } })
    await expect(apagarMeusDados()).rejects.toMatchObject({ message: 'boom' })
    const apagadas = falso.chamadas.filter((c) => c.op === 'delete').map((c) => c.tabela)
    expect(apagadas).toEqual(['documents', 'transactions', 'accounts'])
  })

  /** Sem a migração 0013 a tabela não existe — e isso não é dado sobrando. */
  it('tabela de preferências ausente não derruba a exclusão', async () => {
    banco({ erro: { tabela: 'preferencias', op: 'delete', message: 'relation does not exist' } })
    await expect(apagarMeusDados()).resolves.toBeUndefined()
  })
})
