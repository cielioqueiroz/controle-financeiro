import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DadosProvider, useDados } from './DadosProvider'

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))

import { puxarTudo } from '../persist/puxar'
import { puxarCategoriasUsuario } from '../persist/categoriasUsuario'

function tx(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'a',
    date: '2026-06-10',
    competencia: '2026-06',
    description: 'X',
    label: null,
    amount_cents: 100,
    kind: 'expense',
    category_slug: 'outros',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'd1',
    installment: null,
    ...over,
  }
}

function Consumidor() {
  const { todas, carregando, erro, competenciaInicial } = useDados()
  if (carregando) return <p>carregando</p>
  if (erro) return <p>ERRO: {erro}</p>
  return (
    <div>
      <span data-testid="qtd">{todas?.length ?? -1}</span>
      <span data-testid="comp">{competenciaInicial ?? 'nenhuma'}</span>
    </div>
  )
}

describe('DadosProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(puxarTudo).mockResolvedValue([])
    vi.mocked(puxarCategoriasUsuario).mockResolvedValue([])
  })

  // O motivo do provider existir: sete páginas consumindo, uma ida ao banco.
  // Antes, cada tela que precisasse dos dados faria a sua.
  it('carrega uma vez só, mesmo com vários consumidores', async () => {
    render(
      <DadosProvider>
        <Consumidor />
        <Consumidor />
        <Consumidor />
      </DadosProvider>,
    )
    await waitFor(() => expect(screen.getAllByTestId('qtd')).toHaveLength(3))
    expect(puxarTudo).toHaveBeenCalledTimes(1)
    expect(puxarCategoriasUsuario).toHaveBeenCalledTimes(1)
  })

  it('expõe o erro em vez de derrubar a árvore', async () => {
    vi.mocked(puxarTudo).mockRejectedValueOnce(new Error('rede caiu'))
    render(
      <DadosProvider>
        <Consumidor />
      </DadosProvider>,
    )
    await screen.findByText(/ERRO: rede caiu/)
  })

  // Faturas trazem meses passados: abrir no mês corrente mostraria uma tela
  // vazia para quem acabou de importar a fatura de junho em agosto.
  it('deriva a competência mais recente dos dados', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      tx({ id: 'a', competencia: '2026-04' }),
      tx({ id: 'b', competencia: '2026-06' }),
      tx({ id: 'c', competencia: '2026-05' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)
    render(
      <DadosProvider>
        <Consumidor />
      </DadosProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('comp')).toHaveTextContent('2026-06'))
  })

  it('sobrevive a categorias e saldos falhando — só as transações são essenciais', async () => {
    vi.mocked(puxarCategoriasUsuario).mockRejectedValueOnce(new Error('sem categorias'))
    vi.mocked(puxarTudo).mockResolvedValue([tx()] as never)
    render(
      <DadosProvider>
        <Consumidor />
      </DadosProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('qtd')).toHaveTextContent('1'))
  })

  it('usar useDados fora do provider é erro de programação, não tela quebrada', () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumidor />)).toThrow(/DadosProvider/)
    silencio.mockRestore()
  })
})
