import { describe, it, expect, afterEach } from 'vitest'
import { categoria, nomeCategoria, definirIdiomaCategorias, registrarCategoriasUsuario, todasCategorias, type Categoria } from './categorias'

afterEach(() => {
  definirIdiomaCategorias('pt')
  registrarCategoriasUsuario([])
})

describe('nomeCategoria', () => {
  it('em pt devolve o nome do catálogo', () => {
    expect(nomeCategoria(categoria('supermercado'))).toBe('Supermercado')
  })

  it('traduz uma embutida em en e es', () => {
    const sup = categoria('supermercado')
    definirIdiomaCategorias('en')
    expect(nomeCategoria(sup)).toBe('Groceries')
    definirIdiomaCategorias('es')
    expect(nomeCategoria(sup)).toBe('Supermercado')
  })

  it('categoria do usuário nunca é traduzida', () => {
    const user: Categoria = { slug: 'u-x', nome: 'Meu rótulo', icone: '🏷️', cor: '#fff' }
    definirIdiomaCategorias('en')
    expect(nomeCategoria(user)).toBe('Meu rótulo')
  })

  it('personaliza uma categoria padrão mantendo o slug e sem duplicá-la', () => {
    registrarCategoriasUsuario([{ slug: 'supermercado', nome: 'Mercado', icone: '🧺', cor: '#123456' }])
    const supermercado = categoria('supermercado')
    expect(supermercado).toEqual({ slug: 'supermercado', nome: 'Mercado', icone: '🧺', cor: '#123456' })
    expect(todasCategorias().filter((item) => item.slug === 'supermercado')).toHaveLength(1)
    definirIdiomaCategorias('en')
    expect(nomeCategoria(supermercado)).toBe('Mercado')
  })
})
