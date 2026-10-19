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
      { padrao: '>100 banco:nubank', match_type: 'consulta', categoria: 'viagem', prioridade: 1000 },
    ])

    expect(await puxarRegras()).toEqual([
      { padrao: 'FARMACIA', tipo: 'contains', categoria: 'farmacia', prioridade: 100 },
      { padrao: '12345678000199', tipo: 'cnpj', categoria: 'mercado', prioridade: 200 },
      { padrao: '>100 banco:nubank', tipo: 'consulta', categoria: 'viagem', prioridade: 1000 },
    ])
  })

  /** Tipo futuro desconhecido mantém a compatibilidade de texto literal. */
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
  it.each(['contains', 'cnpj', 'consulta'] as const)('grava %s numa única RPC com os quatro campos', async (tipo) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    dublê.cliente = { rpc }
    await salvarRegra({ padrao: 'posto banco:nubank >100', tipo, categoria: 'viagem', prioridade: 1000 })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('salvar_regra_atomica', {
      p_regra: { padrao: 'posto banco:nubank >100', match_type: tipo, categoria: 'viagem', prioridade: 1000 },
    })
  })

  it('recusa consulta inválida sem enviar escrita alguma', async () => {
    const rpc = vi.fn()
    dublê.cliente = { rpc }
    await expect(salvarRegra({ padrao: 'banco:', tipo: 'consulta', categoria: 'viagem', prioridade: 1000 })).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propaga falha da RPC sem recorrer à antiga escrita parcial', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC indisponível' } })
    dublê.cliente = { rpc }
    await expect(salvarRegra({ padrao: '>100', tipo: 'consulta', categoria: 'viagem', prioridade: 1000 })).rejects.toMatchObject({ message: 'RPC indisponível' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('consulta sem persistência falha em vez de afirmar que salvou', async () => {
    await expect(salvarRegra({ padrao: '>100', tipo: 'consulta', categoria: 'viagem', prioridade: 1000 })).rejects.toThrow()
  })

  it('sem cliente Neon não grava nada', async () => {
    dublê.cliente = null
    await expect(
      salvarRegra({ padrao: 'X', tipo: 'contains', categoria: 'c', prioridade: 1 }),
    ).resolves.toBeUndefined()
  })
})

describe('apagarRegra', () => {
  it('exclui só o tipo consulta sem atingir aprendizado com o mesmo padrão', async () => {
    const falso = comRegras()
    await apagarRegra({ padrao: 'POSTO', tipo: 'consulta' })
    expect(falso.chamadas[0].filtros).toEqual([
      { tipo: 'eq', coluna: 'padrao', valor: 'POSTO' },
      { tipo: 'eq', coluna: 'match_type', valor: 'consulta' },
    ])
  })
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
