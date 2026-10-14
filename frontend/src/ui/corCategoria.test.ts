import { describe, expect, it } from 'vitest'
import { categoria } from '../domain/categorize/categorias'
import { corCategoria } from './corCategoria'

describe('identidade visual de categoria', () => {
  it('usa tokens de tema no catálogo e preserva a escolha de categoria personalizada', () => {
    expect(corCategoria(categoria('supermercado'))).toBe('var(--color-categoria-verde)')
    expect(corCategoria(categoria('aluguel'))).toBe('var(--color-categoria-azul)')
    expect(corCategoria({ slug: 'u-projeto', nome: 'Projeto', icone: '📦', cor: '#123456' })).toBe('#123456')
  })
})
