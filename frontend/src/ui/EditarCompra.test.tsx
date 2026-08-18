import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditarCompra } from './EditarCompra'
import type { TransacaoSalva } from '../persist/puxar'

/** Corrigir a categoria de UMA compra tem que consertar as iguais que já
 *  estão gravadas. A lógica de quem é alcançado está testada pura em
 *  `domain/categorize/aprendizado.test.ts`; aqui se testa a FIAÇÃO — que a
 *  prévia conte o mesmo que o domínio diz, e que a caixa marcada realmente
 *  chegue ao banco. É a parte que falharia em silêncio: sem isto, alguém
 *  pode desligar o cabo e nenhum teste fica vermelho. */

const editarTransacao = vi.fn().mockResolvedValue(undefined)
const recategorizarEmLote = vi.fn().mockImplementation((ids: string[]) => Promise.resolve(ids.length))
const salvarRegra = vi.fn().mockResolvedValue(undefined)
const aplicarRecategorizacao = vi.fn()

let historico: TransacaoSalva[] = []

vi.mock('../persist/editar', () => ({
  editarTransacao: (...a: unknown[]) => editarTransacao(...a),
  recategorizarEmLote: (...a: unknown[]) => recategorizarEmLote(...a),
}))
vi.mock('../persist/regras', () => ({
  salvarRegra: (...a: unknown[]) => salvarRegra(...a),
}))
vi.mock('../persist/categoriasUsuario', () => ({
  criarCategoria: vi.fn(),
}))
vi.mock('../dados/DadosProvider', () => ({
  useDados: () => ({ todas: historico, aplicarRecategorizacao }),
}))

const tx = (id: string, description: string, category_slug: string | null): TransacaoSalva => ({
  id,
  date: '2026-06-10',
  competencia: '2026-06',
  description,
  label: null,
  amount_cents: 12300,
  kind: 'expense',
  category_slug,
  bank: 'nubank',
  doc_type: 'fatura',
  document_id: 'doc-1',
  installment: null,
})

const EM_FOCO = tx('1', 'Atacadao Palmas', 'outros')

beforeEach(() => {
  vi.clearAllMocks()
  historico = [
    EM_FOCO,
    tx('2', 'Atacadao Palmas', 'outros'),
    tx('3', 'Atacadao Palmas', 'outros'),
    tx('4', 'Farmacia Bom Preco', 'farmacia'),
  ]
})

function abrir() {
  const onFechar = vi.fn()
  const onSalvo = vi.fn()
  render(<EditarCompra tx={EM_FOCO} onFechar={onFechar} onSalvo={onSalvo} />)
  return { onFechar, onSalvo }
}

/** Troca a categoria e confirma no diálogo. */
async function corrigirPara(u: ReturnType<typeof userEvent.setup>, nome: string) {
  await u.click(screen.getByRole('button', { name: new RegExp(nome, 'i') }))
  await u.click(screen.getByRole('button', { name: /^salvar$/i }))
  const dialogo = await screen.findByRole('dialog')
  return dialogo
}

describe('EditarCompra — a correção alcança o histórico', () => {
  it('oferece corrigir as outras compras iguais, com a contagem certa', async () => {
    const u = userEvent.setup()
    abrir()

    // Antes de trocar a categoria não há o que corrigir.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: /supermercado/i }))

    const caixa = screen.getByRole('checkbox')
    expect(caixa).toBeChecked()
    // As duas outras 'Atacadao Palmas'. A farmácia não entra.
    expect(screen.getByText(/outras 2 compras/i)).toBeInTheDocument()
  })

  it('marcada, manda ao banco exatamente os ids alcançados', async () => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await corrigirPara(u, 'supermercado')
    await u.click(within(dialogo).getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(recategorizarEmLote).toHaveBeenCalledTimes(1))
    expect(recategorizarEmLote).toHaveBeenCalledWith(['2', '3'], 'supermercado')
    // E a tela reflete na hora, sem reler o banco.
    expect(aplicarRecategorizacao).toHaveBeenCalledWith(['2', '3'], 'supermercado')
  })

  it('desmarcada, salva só esta compra e não toca no histórico', async () => {
    const u = userEvent.setup()
    abrir()
    await u.click(screen.getByRole('button', { name: /supermercado/i }))
    await u.click(screen.getByRole('checkbox'))

    await u.click(screen.getByRole('button', { name: /^salvar$/i }))
    const dialogo = await screen.findByRole('dialog')
    await u.click(within(dialogo).getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(editarTransacao).toHaveBeenCalledTimes(1))
    expect(recategorizarEmLote).not.toHaveBeenCalled()
    expect(aplicarRecategorizacao).not.toHaveBeenCalled()
  })

  it('a confirmação declara o alcance — não fala no singular mexendo em três', async () => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await corrigirPara(u, 'supermercado')
    expect(within(dialogo).getByText(/outras 2 compras/i)).toBeInTheDocument()
  })

  it('sem outras iguais no histórico, não oferece nada', async () => {
    historico = [EM_FOCO, tx('4', 'Farmacia Bom Preco', 'farmacia')]
    const u = userEvent.setup()
    abrir()
    await u.click(screen.getByRole('button', { name: /supermercado/i }))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
