import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso } from './neon-falso'

const dublê = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../lib/neon', () => ({
  get neon() {
    return dublê.cliente
  },
  neonConfigurado: true,
}))

const { editarTransacao, recategorizarEmLote } = await import('./editar')

let falso: ReturnType<typeof criarNeonFalso>
const montar = (estado: Parameters<typeof criarNeonFalso>[0] = {}) => {
  falso = criarNeonFalso(estado)
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

describe('editarTransacao', () => {
  it('manda só os campos recebidos, e filtra pelo id', async () => {
    montar()
    await editarTransacao('tx-1', { label: 'Padaria da esquina', category_slug: 'padaria' })

    const [c] = falso.chamadas
    expect(c.tabela).toBe('transactions')
    expect(c.op).toBe('update')
    expect(c.campos).toEqual({ label: 'Padaria da esquina', category_slug: 'padaria' })
    expect(c.filtros).toEqual([{ tipo: 'eq', coluna: 'id', valor: 'tx-1' }])
  })

  /** A migração `0006` passa a permitir UPDATE só em `label`, `category_slug`
   *  e `kind`. Se alguém acrescentar um campo aqui sem ampliar o GRANT, o
   *  Postgres recusa a edição inteira — este teste é o lembrete de que a
   *  lista tem dois donos. */
  it('nunca manda campo fora dos três que o banco autoriza', async () => {
    montar()
    await editarTransacao('tx-1', { label: 'x', category_slug: 'y', kind: 'internal_transfer' })
    const permitidos = new Set(['label', 'category_slug', 'kind'])
    for (const campo of Object.keys(falso.chamadas[0].campos ?? {})) {
      expect(permitidos.has(campo), `campo "${campo}" não está no GRANT`).toBe(true)
    }
  })

  it('não manda `kind` quando o vínculo não mudou', async () => {
    montar()
    await editarTransacao('tx-1', { label: null, category_slug: 'outros' })
    expect(falso.chamadas[0].campos).not.toHaveProperty('kind')
  })

  it('sem cliente Neon, não faz nada e não quebra', async () => {
    dublê.cliente = null
    await expect(editarTransacao('tx-1', { label: 'x' })).resolves.toBeUndefined()
  })

  it('falha do banco sobe', async () => {
    montar({ erro: { tabela: 'transactions', op: 'update', message: 'permission denied' } })
    await expect(editarTransacao('tx-1', { label: 'x' })).rejects.toThrow(/permission denied/)
  })
})

describe('recategorizarEmLote', () => {
  it('lista vazia não vai ao banco', async () => {
    montar()
    expect(await recategorizarEmLote([], 'padaria')).toBe(0)
    expect(falso.chamadas).toHaveLength(0)
  })

  /** O teto de 200 existe porque a Data API monta o filtro na QUERY STRING:
   *  uma correção de estabelecimento frequente alcança centenas de linhas, e
   *  um 414 no meio deixaria metade do histórico corrigido e metade não. */
  it('quebra em lotes de 200', async () => {
    montar()
    const ids = Array.from({ length: 450 }, (_, i) => `tx-${i}`)

    expect(await recategorizarEmLote(ids, 'padaria')).toBe(450)

    const lotes = falso.chamadas.filter((c) => c.op === 'update')
    expect(lotes).toHaveLength(3)
    const tamanhos = lotes.map((c) => (c.filtros[0].valor as string[]).length)
    expect(tamanhos).toEqual([200, 200, 50])
  })

  it('todo lote atualiza só a categoria', async () => {
    montar()
    await recategorizarEmLote(['a', 'b'], 'farmacia')
    expect(falso.chamadas[0].campos).toEqual({ category_slug: 'farmacia' })
  })

  /** Falha alto de propósito: quem chama já gravou a transação em foco, e
   *  engolir o erro faria a tela anunciar "mais 26 corrigidas" sem que
   *  nenhuma tivesse sido. */
  it('falha alto, sem contabilizar o lote que errou', async () => {
    montar({ erro: { tabela: 'transactions', op: 'update', message: 'rede fora' } })
    await expect(recategorizarEmLote(['a', 'b'], 'x')).rejects.toThrow(/rede fora/)
  })

  it('sem cliente Neon devolve zero', async () => {
    dublê.cliente = null
    expect(await recategorizarEmLote(['a'], 'x')).toBe(0)
  })
})
