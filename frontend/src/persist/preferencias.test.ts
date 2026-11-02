import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso, type EstadoFalso } from './neon-falso'
import { SEM_PREFERENCIAS } from '../lib/preferencias'

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

const { puxarPreferencias, salvarPreferencias } = await import('./preferencias')

function banco(estado: EstadoFalso = {}) {
  const falso = criarNeonFalso(estado)
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

describe('puxarPreferencias', () => {
  it('traduz a linha da pessoa', async () => {
    banco({ linhas: { preferencias: [{ apelido: 'Cel', tema: 'light', periodo_padrao: 'ano' }] } })
    expect(await puxarPreferencias()).toMatchObject({ apelido: 'Cel', tema: 'light', periodoPadrao: 'ano' })
  })

  it('sem linha é resposta: nada escolhido', async () => {
    banco()
    expect(await puxarPreferencias()).toEqual(SEM_PREFERENCIAS)
  })

  /** Migração 0013 não aplicada: "não sei", não "nada escolhido". */
  it('erro do servidor vira null', async () => {
    banco({ erro: { tabela: 'preferencias', op: 'select', message: 'relation does not exist' } })
    expect(await puxarPreferencias()).toBeNull()
  })

  it('sem Neon vira null', async () => {
    expect(await puxarPreferencias()).toBeNull()
  })
})

describe('salvarPreferencias', () => {
  it('faz upsert com as colunas do banco e sem user_id', async () => {
    const falso = banco()
    expect(await salvarPreferencias({ ...SEM_PREFERENCIAS, apelido: 'Cel', corAvatar: 'vinho' })).toBe(true)
    const c = falso.chamadas.find((x) => x.op === 'upsert')
    expect(c?.tabela).toBe('preferencias')
    expect(c?.linhas?.[0]).toMatchObject({ apelido: 'Cel', cor_avatar: 'vinho', tema: null })
    expect(c?.linhas?.[0]).not.toHaveProperty('user_id')
  })

  it('servidor recusou: devolve false em vez de lançar', async () => {
    banco({ erro: { tabela: 'preferencias', op: 'upsert', message: 'relation does not exist' } })
    expect(await salvarPreferencias(SEM_PREFERENCIAS)).toBe(false)
  })
})
