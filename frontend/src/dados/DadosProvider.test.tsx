import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DadosProvider, useDados } from './DadosProvider'

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))

import { puxarTudo } from '../persist/puxar'
import { puxarCategoriasUsuario } from '../persist/categoriasUsuario'
import { puxarSaldos } from '../persist/documentos'
import type { TransacaoSalva } from '../aplicacao/consultas/historico'

function tx(over: Partial<TransacaoSalva> = {}): TransacaoSalva {
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
  const { todas, carregando, erro, competenciaInicial, recarregar, errosParciais } = useDados()
  if (carregando) return <p>carregando</p>
  if (erro) return <p>ERRO: {erro}</p>
  return (
    <div>
      <span data-testid="qtd">{todas?.length ?? -1}</span>
      <span data-testid="comp">{competenciaInicial ?? 'nenhuma'}</span>
      <span data-testid="parcial">{Object.keys(errosParciais ?? {}).join(',')}</span>
      <button onClick={() => void recarregar()}>recarregar</button>
    </div>
  )
}

describe('DadosProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(puxarTudo).mockResolvedValue([])
    vi.mocked(puxarCategoriasUsuario).mockResolvedValue([])
    vi.mocked(puxarSaldos).mockResolvedValue([])
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

  // O contrato mudou em 13/08. Antes o provider repassava `e.message` cru, e
  // este teste afirmava isso (`/ERRO: rede caiu/`) — estava pinando o defeito:
  // a mensagem vem da Data API em inglês técnico e ia inteira para a tela.
  // Agora ele guarda a CHAVE do dicionário e quem renderiza chama `t()`.
  it('expõe a chave do genérico quando não reconhece a causa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(puxarTudo).mockRejectedValueOnce(new Error('rede caiu'))
    render(
      <DadosProvider>
        <Consumidor />
      </DadosProvider>,
    )
    await screen.findByText(/ERRO: erro\.carregar/)
  })

  it('classifica a falha que tem conserto em vez de cair no genérico', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(puxarTudo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    render(
      <DadosProvider>
        <Consumidor />
      </DadosProvider>,
    )
    // "Sem conexão, tente de novo" em vez de "falha ao carregar": diz o que
    // fazer, que é a única diferença que justifica classificar.
    await screen.findByText(/ERRO: erro\.semConexao/)
  })

  // Faturas trazem meses passados: abrir no mês corrente mostraria uma tela
  // vazia para quem acabou de importar a fatura de junho em agosto.
  it('deriva a competência mais recente dos dados', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      tx({ id: 'a', competencia: '2026-04' }),
      tx({ id: 'b', competencia: '2026-06' }),
      tx({ id: 'c', competencia: '2026-05' }),
    ])
    render(
      <DadosProvider>
        <Consumidor />
      </DadosProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('comp')).toHaveTextContent('2026-06'))
  })

  it('sobrevive a categorias e saldos falhando — só as transações são essenciais', async () => {
    vi.mocked(puxarCategoriasUsuario).mockRejectedValueOnce(new Error('sem categorias'))
    vi.mocked(puxarSaldos).mockRejectedValueOnce(new Error('sem saldos'))
    vi.mocked(puxarTudo).mockResolvedValue([tx()])
    render(
      <DadosProvider>
        <Consumidor />
      </DadosProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('qtd')).toHaveTextContent('1'))
    expect(screen.getByTestId('parcial')).toHaveTextContent('categorias,saldos')
    fireEvent.click(screen.getByText('recarregar'))
    await waitFor(() => expect(screen.getByTestId('parcial')).toBeEmptyDOMElement())
  })

  it.each(['dados', 'erro'] as const)('ignora resposta antiga de %s após recarga mais recente', async (desfecho) => {
    let concluir!: (txs: TransacaoSalva[]) => void
    let falhar!: (erro: Error) => void
    vi.mocked(puxarTudo).mockImplementationOnce(() => new Promise((resolve, reject) => {
      concluir = resolve
      falhar = reject
    }))
    function Controle() {
      const { recarregar } = useDados()
      return <><button onClick={() => void recarregar()}>forçar recarga</button><Consumidor /></>
    }
    render(<DadosProvider><Controle /></DadosProvider>)
    vi.mocked(puxarTudo).mockResolvedValueOnce([tx({ competencia: '2026-10' })])
    fireEvent.click(screen.getByText('forçar recarga'))
    await waitFor(() => expect(screen.getByTestId('comp')).toHaveTextContent('2026-10'))
    await act(async () => {
      if (desfecho === 'erro') falhar(new Error('resposta antiga'))
      else concluir([tx({ competencia: '2026-01' })])
    })
    expect(screen.getByTestId('comp')).toHaveTextContent('2026-10')
    expect(screen.queryByText(/ERRO:/)).not.toBeInTheDocument()
  })

  it('usar useDados fora do provider é erro de programação, não tela quebrada', () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumidor />)).toThrow(/DadosProvider/)
    silencio.mockRestore()
  })
})
