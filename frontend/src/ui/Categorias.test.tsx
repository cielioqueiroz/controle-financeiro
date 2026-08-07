import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ConteudoCategorias } from './Categorias'
import { editarCategoria, apagarCategoria } from '../persist/categoriasUsuario'
import { apagarRegra } from '../persist/regras'

vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn().mockResolvedValue([
    { id: 'c1', slug: 'u-pedreiro-ab12', nome: 'Pedreiro', icone: '🧱', cor: '#a05bd6' },
  ]),
  editarCategoria: vi.fn().mockResolvedValue(undefined),
  apagarCategoria: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../persist/regras', () => ({
  puxarRegras: vi
    .fn()
    .mockResolvedValue([
      { padrao: 'MERCADO BOM PRECO', tipo: 'contains', categoria: 'supermercado', prioridade: 10 },
    ]),
  apagarRegra: vi.fn().mockResolvedValue(undefined),
}))

const props = {
  onMudou: vi.fn(),
  usoPorSlug: new Map([['u-pedreiro-ab12', 7]]),
}

describe('Categorias', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista as categorias do usuário com quantos lançamentos usam', async () => {
    render(<ConteudoCategorias {...props} />)
    expect(await screen.findByText('Pedreiro')).toBeInTheDocument()
    expect(screen.getByText('7 lançamentos')).toBeInTheDocument()
  })

  it('lista as regras aprendidas com a categoria de destino', async () => {
    render(<ConteudoCategorias {...props} />)
    expect(await screen.findByText('MERCADO BOM PRECO')).toBeInTheDocument()
    expect(screen.getByText(/Supermercado/)).toBeInTheDocument()
  })

  it('esquecer uma regra chama apagarRegra com padrão e tipo', async () => {
    render(<ConteudoCategorias {...props} />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Esquecer a regra de MERCADO BOM PRECO' }),
    )
    expect(apagarRegra).toHaveBeenCalledWith(
      expect.objectContaining({ padrao: 'MERCADO BOM PRECO', tipo: 'contains' }),
    )
  })

  it('editar e salvar chama editarCategoria com os campos novos', async () => {
    render(<ConteudoCategorias {...props} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar a categoria Pedreiro' }))
    const campo = screen.getByLabelText('Nome da categoria')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Obra')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(editarCategoria).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ nome: 'Obra' }),
    )
  })

  it('apagar pede confirmação e diz quantos lançamentos serão afetados', async () => {
    render(<ConteudoCategorias {...props} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar a categoria Pedreiro' }))
    expect(
      screen.getByText(/está em 7 lançamentos.*passam a aparecer como Outros/s),
    ).toBeInTheDocument()
    expect(apagarCategoria).not.toHaveBeenCalled()
  })

  it('confirmar é o que de fato apaga', async () => {
    render(<ConteudoCategorias {...props} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar a categoria Pedreiro' }))
    // O botão da confirmação é o único chamado exatamente "Apagar" — os da
    // lista têm aria-label com o nome da categoria. Sem isso o teste teria de
    // adivinhar "o último da lista", que passaria mesmo com a UI ambígua.
    await userEvent.click(screen.getByRole('button', { name: 'Apagar' }))
    expect(apagarCategoria).toHaveBeenCalledWith('c1')
  })
})
