import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso } from './neon-falso'

const dublê = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../lib/neon', () => ({
  get neon() {
    return dublê.cliente
  },
  neonConfigurado: true,
}))

const { puxarCategoriasUsuario, criarCategoria, editarCategoria, apagarCategoria } =
  await import('./categoriasUsuario')

let falso: ReturnType<typeof criarNeonFalso>
const montar = (linhas: Record<string, unknown>[] = []) => {
  falso = criarNeonFalso({ linhas: { categories: linhas } })
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

describe('puxarCategoriasUsuario', () => {
  it('devolve as categorias do usuário na ordem de exibição', async () => {
    montar([
      { id: 'c1', slug: 'u-padaria-ab12', nome: 'Padaria', icone: '🥖', cor: '#fff' },
      { id: 'c2', slug: 'u-pet-cd34', nome: 'Pet', icone: '🐶', cor: '#000' },
    ])

    const r = await puxarCategoriasUsuario()
    expect(r).toHaveLength(2)
    expect(r[0]).toEqual({ id: 'c1', slug: 'u-padaria-ab12', nome: 'Padaria', icone: '🥖', cor: '#fff' })
    expect(falso.chamadas[0].ordem).toEqual({ coluna: 'sort_order', ascendente: true })
  })

  it('falha do banco sobe', async () => {
    falso = criarNeonFalso({ erro: { tabela: 'categories', op: 'select', message: 'caiu' } })
    dublê.cliente = falso.cliente
    await expect(puxarCategoriasUsuario()).rejects.toThrow(/caiu/)
  })

  it('sem cliente Neon devolve lista vazia', async () => {
    dublê.cliente = null
    expect(await puxarCategoriasUsuario()).toEqual([])
  })
})

describe('criarCategoria', () => {
  /** O prefixo `u-` é o que garante que categoria do usuário nunca colida
   *  com o slug de uma embutida (`padaria`, `farmacia`…). Sem ele, criar
   *  uma categoria chamada "Padaria" sequestraria todas as transações já
   *  classificadas na embutida. */
  it('gera slug com prefixo u- e sufixo aleatório', async () => {
    montar()
    await criarCategoria({ nome: 'Padaria', icone: '🥖', cor: '#fff' })

    const slug = falso.gravadasEm('categories')[0].slug as string
    expect(slug).toMatch(/^u-padaria-[a-z0-9]{4}$/)
  })

  it('normaliza acento e espaço no slug, sem perder o nome original', async () => {
    montar()
    await criarCategoria({ nome: 'Saúde e Bem-Estar', icone: '💊', cor: '#0f0' })

    const linha = falso.gravadasEm('categories')[0]
    expect(linha.slug as string).toMatch(/^u-saude-e-bem-estar-[a-z0-9]{4}$/)
    expect(linha.nome).toBe('Saúde e Bem-Estar')
  })

  it('nome só de símbolos ainda produz slug válido', async () => {
    montar()
    await criarCategoria({ nome: '★★★', icone: '⭐', cor: '#00f' })
    expect(falso.gravadasEm('categories')[0].slug as string).toMatch(/^u-cat-[a-z0-9]{4}$/)
  })

  it('dois nomes iguais geram slugs diferentes', async () => {
    montar()
    await criarCategoria({ nome: 'Pet', icone: '🐶', cor: '#111' })
    await criarCategoria({ nome: 'Pet', icone: '🐱', cor: '#222' })

    const [a, b] = falso.gravadasEm('categories').map((l) => l.slug)
    expect(a).not.toBe(b)
  })

  it('apara o nome antes de gravar', async () => {
    montar()
    await criarCategoria({ nome: '  Pet  ', icone: '🐶', cor: '#111' })
    expect(falso.gravadasEm('categories')[0].nome).toBe('Pet')
  })

  /** Diferente das outras funções deste módulo: aqui não dá para "não fazer
   *  nada", porque quem chama espera a categoria de volta para selecioná-la. */
  it('sem cliente Neon LANÇA, em vez de devolver categoria falsa', async () => {
    dublê.cliente = null
    await expect(criarCategoria({ nome: 'X', icone: '?', cor: '#000' })).rejects.toThrow(
      /conexão/i,
    )
  })
})

describe('editarCategoria', () => {
  /** O `slug` é o que as transações guardam. Mexer nele órfãozaria todas as
   *  compras já classificadas — por isso a edição toca só nome, ícone e cor. */
  it('NUNCA manda o slug', async () => {
    montar()
    await editarCategoria('c1', { nome: 'Novo', icone: '🎯', cor: '#abc' })

    const c = falso.chamadas[0]
    expect(c.op).toBe('update')
    expect(c.campos).toEqual({ nome: 'Novo', icone: '🎯', cor: '#abc' })
    expect(c.campos).not.toHaveProperty('slug')
    expect(c.filtros).toEqual([{ tipo: 'eq', coluna: 'id', valor: 'c1' }])
  })

  it('apara o nome', async () => {
    montar()
    await editarCategoria('c1', { nome: '  Pet  ', icone: '🐶', cor: '#111' })
    expect(falso.chamadas[0].campos?.nome).toBe('Pet')
  })

  it('sem cliente Neon lança', async () => {
    dublê.cliente = null
    await expect(editarCategoria('c1', { nome: 'X', icone: '?', cor: '#000' })).rejects.toThrow(
      /conexão/i,
    )
  })
})

describe('apagarCategoria', () => {
  it('apaga pelo id', async () => {
    montar()
    await apagarCategoria('c1')

    const c = falso.chamadas[0]
    expect(c.op).toBe('delete')
    expect(c.filtros).toEqual([{ tipo: 'eq', coluna: 'id', valor: 'c1' }])
  })

  it('falha do banco sobe', async () => {
    falso = criarNeonFalso({ erro: { tabela: 'categories', op: 'delete', message: 'nao deu' } })
    dublê.cliente = falso.cliente
    await expect(apagarCategoria('c1')).rejects.toThrow(/nao deu/)
  })

  it('sem cliente Neon não faz nada', async () => {
    dublê.cliente = null
    await expect(apagarCategoria('c1')).resolves.toBeUndefined()
  })
})
