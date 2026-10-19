import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { toast, Toaster } from 'sonner'
import userEvent from '@testing-library/user-event'
import { ConteudoCategorias } from './Categorias'
import { editarCategoria, apagarCategoria } from '../persist/categoriasUsuario'
import { apagarRegra, salvarRegra, puxarRegras } from '../persist/regras'
import { recategorizarEmLote } from '../persist/editar'

vi.mock('../persist/editar', () => ({
  editarTransacao: vi.fn(),
  recategorizarEmLote: vi.fn(),
}))

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
  salvarRegra: vi.fn().mockResolvedValue(undefined),
}))

const props = {
  onMudou: vi.fn(),
  usoPorSlug: new Map([['u-pedreiro-ab12', 7]]),
}

describe('Categorias', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => toast.dismiss())

  it('mostra a condição completa e exclui especificamente a regra com operadores', async () => {
    vi.mocked(puxarRegras).mockResolvedValueOnce([
      { padrao: 'posto banco:nubank >100', tipo: 'consulta', categoria: 'viagem', prioridade: 1000 },
    ])
    render(<ConteudoCategorias {...props} />)
    expect(await screen.findByText('posto banco:nubank >100')).toBeVisible()
    expect(screen.getByText('Regra com operadores')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Esquecer a regra de posto banco:nubank >100' }))
    expect(apagarRegra).toHaveBeenCalledWith(expect.objectContaining({ padrao: 'posto banco:nubank >100', tipo: 'consulta' }))
  })

  it('bloqueia edição e novo envio enquanto grava', async () => {
    let concluir: (() => void) | undefined
    const pendente = new Promise<void>((resolve) => { concluir = resolve })
    vi.mocked(salvarRegra).mockReturnValueOnce(pendente)
    const usuario = userEvent.setup()
    render(<ConteudoCategorias {...props} />)
    await usuario.click(await screen.findByRole('button', { name: 'Nova regra com operadores' }))
    await usuario.type(screen.getByLabelText('Condição da regra'), '>100')
    await usuario.selectOptions(screen.getByLabelText('Categoria de destino'), 'viagem')
    await usuario.click(screen.getByRole('button', { name: 'Salvar regra' }))
    expect(screen.getByLabelText('Condição da regra')).toBeDisabled()
    expect(screen.getByLabelText('Categoria de destino')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(salvarRegra).toHaveBeenCalledOnce()
    concluir?.()
    await waitFor(() => expect(screen.queryByLabelText('Condição da regra')).not.toBeInTheDocument())
  })

  it('cria regra com texto, banco e valor apenas para próximas importações', async () => {
    const usuario = userEvent.setup()
    render(<ConteudoCategorias {...props} />)
    await usuario.click(await screen.findByRole('button', { name: 'Nova regra com operadores' }))
    expect(screen.getAllByText(/As regras valem para as próximas importações/).length).toBeGreaterThan(0)
    const salvar = screen.getByRole('button', { name: 'Salvar regra' })
    expect(salvar).toBeDisabled()
    await usuario.type(screen.getByLabelText('Condição da regra'), 'posto banco:nubank >100')
    await usuario.selectOptions(screen.getByLabelText('Categoria de destino'), 'u-pedreiro-ab12')
    await usuario.click(salvar)
    expect(salvarRegra).toHaveBeenCalledExactlyOnceWith({
      padrao: 'posto banco:nubank >100', tipo: 'consulta', categoria: 'u-pedreiro-ab12', prioridade: 1000,
    })
    await waitFor(() => expect(screen.queryByLabelText('Condição da regra')).not.toBeInTheDocument())
    expect(props.onMudou).toHaveBeenCalledOnce()
    expect(recategorizarEmLote).not.toHaveBeenCalled()
  })

  it('impede condição inválida e explica como corrigir', async () => {
    const usuario = userEvent.setup()
    render(<ConteudoCategorias {...props} />)
    await usuario.click(await screen.findByRole('button', { name: 'Nova regra com operadores' }))
    await usuario.type(screen.getByLabelText('Condição da regra'), 'banco:inexistente')
    await usuario.selectOptions(screen.getByLabelText('Categoria de destino'), 'viagem')
    expect(screen.getByRole('button', { name: 'Salvar regra' })).toBeDisabled()
    expect(screen.getByLabelText('Condição da regra')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(/Revise os operadores/)).toBeVisible()
    expect(salvarRegra).not.toHaveBeenCalled()
  })

  it('preserva a condição quando salvar falha e permite tentar novamente', async () => {
    vi.mocked(salvarRegra).mockRejectedValueOnce(new Error('detalhe interno'))
    const usuario = userEvent.setup()
    render(<><ConteudoCategorias {...props} /><Toaster /></>)
    await usuario.click(await screen.findByRole('button', { name: 'Nova regra com operadores' }))
    await usuario.type(screen.getByLabelText('Condição da regra'), '>100')
    await usuario.selectOptions(screen.getByLabelText('Categoria de destino'), 'viagem')
    await usuario.click(screen.getByRole('button', { name: 'Salvar regra' }))
    expect(await screen.findByText('Não foi possível salvar a regra. Tente novamente.')).toBeVisible()
    expect(screen.getByLabelText('Condição da regra')).toHaveValue('>100')
    expect(screen.getByRole('button', { name: 'Salvar regra' })).toBeEnabled()
    expect(screen.queryByText('detalhe interno')).not.toBeInTheDocument()
  })

  it('busca categorias pelo nome sem alterar as regras aprendidas', async () => {
    const usuario = userEvent.setup()
    render(<ConteudoCategorias {...props} />)
    await screen.findByText('Pedreiro')
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar categoria' }), 'pedreiro')
    expect(screen.getByRole('button', { name: 'Editar a categoria Pedreiro' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Editar a categoria Supermercado' })).not.toBeInTheDocument()
    expect(screen.getByText('MERCADO BOM PRECO')).toBeVisible()
    await usuario.clear(screen.getByRole('searchbox'))
    await usuario.type(screen.getByRole('searchbox'), 'inexistente')
    expect(screen.getByText('Nenhuma categoria encontrada.')).toBeVisible()
  })

  it('lista as categorias do usuário com quantos lançamentos usam', async () => {
    render(<ConteudoCategorias {...props} />)
    expect(await screen.findByText('Pedreiro')).toBeInTheDocument()
    expect(screen.getByText('7 lançamentos')).toBeInTheDocument()
  })

  it('lista as regras aprendidas com a categoria de destino', async () => {
    render(<ConteudoCategorias {...props} />)
    expect(await screen.findByText('MERCADO BOM PRECO')).toBeInTheDocument()
    expect(screen.getAllByText(/Supermercado/).length).toBeGreaterThan(0)
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
      'u-pedreiro-ab12',
      expect.objectContaining({ nome: 'Obra' }),
    )
  })

  it('permite personalizar nome e ícone de uma categoria padrão', async () => {
    render(<ConteudoCategorias {...props} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Editar a categoria Supermercado' }))
    await userEvent.clear(screen.getByLabelText('Nome da categoria'))
    await userEvent.type(screen.getByLabelText('Nome da categoria'), 'Mercado')
    await userEvent.click(screen.getByRole('button', { name: 'Ícone' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ícone: 🏠' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(editarCategoria).toHaveBeenCalledWith(null, 'supermercado',
      expect.objectContaining({ nome: 'Mercado', icone: '🏠' }))
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
