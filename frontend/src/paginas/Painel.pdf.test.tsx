import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Uma transação basta: os botões de PDF só aparecem com lançamentos no
// período. vi.mock é içado para o topo, então a data nasce DENTRO da fábrica.
vi.mock('../persist/puxar', () => {
  const hoje = new Date()
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-15`
  return {
    puxarTudo: vi.fn().mockResolvedValue([
      {
        id: 't1',
        date: iso,
        description: 'MERCADO X',
        label: null,
        amount_cents: 5000,
        category_slug: 'supermercado',
        kind: 'expense',
        bank: 'nubank',
        doc_type: 'fatura',
        document_id: 'd1',
        competencia: iso.slice(0, 7),
        installment: null,
      },
    ]),
  }
})
vi.mock('../persist/categoriasUsuario', () => ({ puxarCategoriasUsuario: vi.fn().mockResolvedValue([]) }))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn().mockResolvedValue([]) }))
vi.mock('../persist/saldos', () => ({ saldosPorConta: vi.fn().mockReturnValue([]) }))

const gerarRelatorioPdf = vi.fn().mockResolvedValue(new Blob(['%PDF-x'], { type: 'application/pdf' }))
vi.mock('../lib/relatorio-pdf', () => ({
  montarDadosRelatorio: vi.fn().mockReturnValue({}),
  gerarRelatorioPdf: (...a: unknown[]) => gerarRelatorioPdf(...a),
}))

const baixarArquivo = vi.fn()
const compartilharArquivo = vi.fn()
vi.mock('../lib/compartilhar', () => ({
  baixarArquivo: (...a: unknown[]) => baixarArquivo(...a),
  compartilharArquivo: (...a: unknown[]) => compartilharArquivo(...a),
  podeCompartilharArquivo: () => true,
}))

import { Painel } from './Painel'
import { DadosProvider } from '../dados/DadosProvider'
import { MemoryRouter } from 'react-router-dom'

beforeEach(() => {
  baixarArquivo.mockClear()
  compartilharArquivo.mockClear()
  gerarRelatorioPdf.mockClear()
})
afterEach(() => vi.restoreAllMocks())

async function abrir() {
  // O Dashboard passou a ler o histórico do DadosProvider, em vez de
  // buscá-lo ele mesmo. Os mocks de puxar/categoriasUsuario/documentos lá
  // em cima continuam valendo — quem os chama agora é o provider.
  render(
    <MemoryRouter>
      <DadosProvider>
        <Painel />
      </DadosProvider>
    </MemoryRouter>,
  )
  // Espera o carregamento terminar (os botões só existem com dados).
  return await screen.findAllByRole('button', { name: /Baixar PDF/ })
}

describe('Dashboard — baixar e compartilhar são ações separadas', () => {
  it('mostra os dois botões quando o aparelho compartilha arquivos', async () => {
    await abrir()
    expect(screen.getAllByRole('button', { name: /Baixar PDF/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Compartilhar/ }).length).toBeGreaterThan(0)
  })

  // O pedido do usuário: no desktop havia só compartilhar. Baixar NUNCA pode
  // passar pela folha de compartilhar.
  it('“Baixar PDF” baixa direto, sem tocar em compartilhar', async () => {
    const user = userEvent.setup()
    const [botao] = await abrir()
    await user.click(botao)
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalledTimes(1))
    expect(compartilharArquivo).not.toHaveBeenCalled()
  })

  // O bug: share falhava (user activation expirada) e virava "não consegui
  // gerar o PDF", perdendo um arquivo que já estava pronto.
  it('se compartilhar falhar, cai para o download em vez de errar', async () => {
    compartilharArquivo.mockRejectedValueOnce(new DOMException('gesture', 'NotAllowedError'))
    const user = userEvent.setup()
    await abrir()
    await user.click(screen.getAllByRole('button', { name: /Compartilhar/ })[0])
    await waitFor(() => expect(baixarArquivo).toHaveBeenCalledTimes(1))
  })
})
