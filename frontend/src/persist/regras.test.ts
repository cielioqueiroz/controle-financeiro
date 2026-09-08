import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso } from './neon-falso'

const dublê = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../lib/neon', () => {
  // `obterNeon` devolve o MESMO cliente que `neon`: o SDK passou a
  // entrar por import dinamico, e quem consome espera uma promessa.
  const mod = {
  get neon() {
    return dublê.cliente
  },
  neonConfigurado: true,
}
  // `Object.assign`, e não spread: o spread LÊ o getter na hora, e vários
  // destes mocks usam getter justamente para ser preguiçosos — ler cedo
  // estoura em "Cannot access X before initialization".
  return Object.assign(mod, { obterNeon: () => Promise.resolve(mod.neon) })
})

const { puxarRegras, salvarRegra, apagarRegra } = await import('./regras')

function comRegras(linhas: Record<string, unknown>[] = []) {
  const falso = criarNeonFalso({ linhas: { merchant_rules: linhas } })
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

describe('puxarRegras', () => {
  it('traduz match_type do banco para o `tipo` do domínio', async () => {
    comRegras([
      { padrao: 'FARMACIA', match_type: 'contains', categoria: 'farmacia', prioridade: 100 },
      { padrao: '12345678000199', match_type: 'cnpj', categoria: 'mercado', prioridade: 200 },
    ])

    expect(await puxarRegras()).toEqual([
      { padrao: 'FARMACIA', tipo: 'contains', categoria: 'farmacia', prioridade: 100 },
      { padrao: '12345678000199', tipo: 'cnpj', categoria: 'mercado', prioridade: 200 },
    ])
  })

  /** Qualquer coisa que não seja exatamente 'cnpj' vira 'contains'. O
   *  domínio só conhece dois tipos, e um valor estranho vindo do banco não
   *  pode virar um terceiro que ninguém trata. */
  it('valor desconhecido de match_type cai em contains', async () => {
    comRegras([{ padrao: 'X', match_type: 'regex-do-futuro', categoria: 'c', prioridade: 1 }])
    expect((await puxarRegras())[0].tipo).toBe('contains')
  })

  it('pede as mais recentes primeiro — é a ordem que desempata em mesclarRegras', async () => {
    const falso = comRegras([])
    await puxarRegras()
    expect(falso.chamadas[0].ordem).toEqual({ coluna: 'created_at', ascendente: false })
  })

  /** NUNCA lança: sem regra do usuário o app ainda categoriza pelas globais.
   *  Derrubar a importação inteira porque o aprendizado não carregou seria
   *  trocar uma degradação por uma falha. */
  it('erro do banco vira lista vazia, não exceção', async () => {
    const falso = criarNeonFalso({
      erro: { tabela: 'merchant_rules', op: 'select', message: 'timeout' },
    })
    dublê.cliente = falso.cliente
    await expect(puxarRegras()).resolves.toEqual([])
  })

  it('sem cliente Neon devolve lista vazia', async () => {
    dublê.cliente = null
    expect(await puxarRegras()).toEqual([])
  })
})

describe('salvarRegra', () => {
  /** Apaga antes de inserir: sem isso, corrigir o mesmo estabelecimento
   *  várias vezes acumula linhas concorrentes e a categoria valendo passa a
   *  depender da ordem de leitura. */
  it('apaga o par (padrão, tipo) ANTES de inserir', async () => {
    const falso = criarNeonFalso()
    dublê.cliente = falso.cliente
    await salvarRegra({ padrao: 'FARMACIA', tipo: 'contains', categoria: 'farmacia', prioridade: 1 })

    const ops = falso.chamadas.filter((c) => c.tabela === 'merchant_rules').map((c) => c.op)
    expect(ops).toEqual(['delete', 'insert'])
  })

  it('o delete casa pelo padrão E pelo tipo, não só pelo padrão', async () => {
    const falso = criarNeonFalso()
    dublê.cliente = falso.cliente
    await salvarRegra({ padrao: 'X', tipo: 'cnpj', categoria: 'c', prioridade: 1 })

    const del = falso.chamadas.find((c) => c.op === 'delete')
    expect(del?.filtros).toEqual([
      { tipo: 'eq', coluna: 'padrao', valor: 'X' },
      { tipo: 'eq', coluna: 'match_type', valor: 'cnpj' },
    ])
  })

  it('grava os quatro campos da regra', async () => {
    const falso = criarNeonFalso()
    dublê.cliente = falso.cliente
    await salvarRegra({ padrao: 'X', tipo: 'contains', categoria: 'c', prioridade: 9 })

    expect(falso.gravadasEm('merchant_rules')[0]).toEqual({
      padrao: 'X',
      match_type: 'contains',
      categoria: 'c',
      prioridade: 9,
    })
  })

  it('sem cliente Neon não grava nada', async () => {
    dublê.cliente = null
    await expect(
      salvarRegra({ padrao: 'X', tipo: 'contains', categoria: 'c', prioridade: 1 }),
    ).resolves.toBeUndefined()
  })
})

describe('apagarRegra', () => {
  it('é simétrico ao salvar: apaga pelo par (padrão, tipo)', async () => {
    const falso = criarNeonFalso()
    dublê.cliente = falso.cliente
    await apagarRegra({ padrao: 'FARMACIA', tipo: 'contains' })

    const del = falso.chamadas.find((c) => c.op === 'delete')
    expect(del?.filtros).toEqual([
      { tipo: 'eq', coluna: 'padrao', valor: 'FARMACIA' },
      { tipo: 'eq', coluna: 'match_type', valor: 'contains' },
    ])
  })

  it('falha do banco sobe — esquecer uma regra é ação pedida, e precisa avisar se não deu', async () => {
    const falso = criarNeonFalso({
      erro: { tabela: 'merchant_rules', op: 'delete', message: 'nao deu' },
    })
    dublê.cliente = falso.cliente
    await expect(apagarRegra({ padrao: 'X', tipo: 'contains' })).rejects.toThrow(/nao deu/)
  })
})
