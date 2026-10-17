import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { puxarTudo } from '../aplicacao/consultas/historico'
import { Relatorios } from './Relatorios'

vi.mock('../aplicacao/consultas/historico', () => ({
  puxarTudo: vi.fn(),
  puxarCategoriasUsuario: vi.fn(async () => []),
  puxarSaldos: vi.fn(async () => []),
}))

const transacao = {
  id: 'tx-1', date: '2026-07-10', competencia: '2026-07',
  description: 'MERCADO', label: null, amount_cents: 10000,
  kind: 'expense', category_slug: 'supermercado', bank: 'nubank' as const,
  doc_type: 'fatura' as const, document_id: 'doc-1', installment: null,
}

function Endereco() {
  return <output aria-label="Endereço">{useLocation().search}</output>
}

function abrir(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/relatorios${search}`]}>
      <DadosProvider><Relatorios /><Endereco /></DadosProvider>
    </MemoryRouter>,
  )
}

describe('Relatórios — estados e navegação', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reabre o detalhe indicado pela URL sem perder janela e banco', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([transacao])
    abrir('?janela=3&banco=nubank&ref=2026-07&detalhe=categoria&item=supermercado')
    const detalhe = await screen.findByRole('region', { name: 'Supermercado' })
    expect(detalhe).toHaveTextContent('R$ 100,00')
    expect(screen.getByRole('button', { name: '3 meses' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('banco=nubank')
    await userEvent.click(within(detalhe).getByRole('button', { name: 'Voltar ao gráfico' }))
    expect(screen.getByLabelText('Endereço')).not.toHaveTextContent('detalhe=')
    expect(screen.getByRole('heading', { name: 'Relatórios financeiros' })).toHaveFocus()
  })

  it('ignora um tipo de detalhe inválido e uma seleção sem transações', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([transacao])
    const primeira = abrir('?janela=3&detalhe=outro&item=supermercado')
    await screen.findByText('1 fatura')
    expect(document.querySelector('[data-prova="detalhe-relatorio"]')).not.toBeInTheDocument()
    primeira.unmount()
    abrir('?janela=3&detalhe=transacao&item=ausente')
    await screen.findByText('1 fatura')
    expect(document.querySelector('[data-prova="detalhe-relatorio"]')).not.toBeInTheDocument()
  })

  it('abre a categoria no intervalo inteiro, exclui vínculos e restaura o foco ao voltar', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      transacao,
      { ...transacao, id: 'tx-jun', document_id: 'doc-jun', competencia: '2026-06', date: '2026-06-12', amount_cents: 20000 },
      { ...transacao, id: 'vinculo', kind: 'card_payment', document_id: 'doc-vinculo', amount_cents: 30000 },
      { ...transacao, id: 'antiga', document_id: 'doc-antigo', competencia: '2025-12' },
    ])
    abrir('?janela=3&banco=nubank')
    const gatilho = await screen.findByRole('button', { name: /Supermercado.*300,00.*Ver lançamentos/ })
    await userEvent.click(gatilho)
    const detalhe = screen.getByRole('region', { name: 'Supermercado' })
    expect(within(detalhe).getByRole('heading', { name: 'Supermercado' })).toHaveFocus()
    expect(detalhe.querySelectorAll('details')).toHaveLength(2)
    const documentoJunho = within(detalhe).getByText(/Nubank.*2026-06/)
    await userEvent.click(documentoJunho)
    expect(within(documentoJunho.closest('details')!).getByRole('button', { name: 'Ver documento importado' })).toBeVisible()
    expect(within(detalhe).getByText('12/06/2026')).toBeVisible()
    expect(detalhe).not.toHaveTextContent('doc-vinculo')
    expect(detalhe).not.toHaveTextContent('doc-antigo')
    await userEvent.click(within(detalhe).getByRole('button', { name: 'Voltar ao gráfico' }))
    expect(screen.queryByRole('region', { name: 'Supermercado' })).not.toBeInTheDocument()
    expect(gatilho).toHaveFocus()
  })

  it('anuncia o carregamento sem exibir valores ou estado vazio', () => {
    vi.mocked(puxarTudo).mockReturnValue(new Promise(() => {}))
    abrir()
    expect(screen.getByRole('status', { name: /carregando seus dados/i })).toBeVisible()
    expect(screen.queryByText('Nada por aqui ainda')).not.toBeInTheDocument()
    expect(screen.queryByText('R$ 0,00')).not.toBeInTheDocument()
  })

  it('diferencia erro de vazio e permite recuperar a consulta', async () => {
    vi.mocked(puxarTudo).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([transacao])
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar.')
    expect(screen.queryByText('Nada por aqui ainda')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('1 fatura')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(puxarTudo).toHaveBeenCalledTimes(2)
  })

  it('orienta a importar quando o histórico está vazio', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([])
    abrir()
    expect(await screen.findByText('Nada por aqui ainda')).toBeVisible()
    expect(screen.getByRole('link', { name: /importar/i })).toHaveAttribute('href', '/importar')
  })

  it('mantém a janela após inicializar a competência e ao selecionar um mês do gráfico', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      transacao,
      { ...transacao, id: 'tx-2', document_id: 'doc-2', competencia: '2026-06', date: '2026-06-10' },
    ])
    abrir('?janela=3&banco=nubank')
    expect(await screen.findByText('2 faturas')).toBeVisible()
    expect(screen.getByRole('button', { name: '3 meses' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('janela=3')
    await userEvent.click(screen.getByRole('button', { name: '6 meses' }))
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('janela=6')
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('banco=nubank')
    await userEvent.click(screen.getByRole('button', { name: /jul.*entradas/i }))
    await waitFor(() => expect(screen.getByLabelText('Endereço')).toHaveTextContent('janela=6'))
  })

  it('abre uma URL copiada na mesma janela e usa 12 meses para entrada inválida', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([])
    const primeira = abrir('?janela=6')
    expect(await screen.findByText('Nada por aqui ainda')).toBeVisible()
    expect(screen.getByRole('button', { name: '6 meses' })).toHaveAttribute('aria-pressed', 'true')
    primeira.unmount()
    abrir('?janela=invalida')
    expect(await screen.findByText('Nada por aqui ainda')).toBeVisible()
    expect(screen.getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('explica meses ausentes e lista documentos sem exibir percentuais de comparação', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      transacao,
      { ...transacao, id: 'tx-2', document_id: 'doc-2', competencia: '2026-05', date: '2026-05-10' },
    ])
    abrir('?janela=3')
    expect(await screen.findByText('Meses que sustentam o relatório')).toBeVisible()
    expect(screen.getByText(/A comparação fica indisponível/)).toBeVisible()
    expect(screen.getAllByText('2 de 3 meses com transações').length).toBeGreaterThan(0)
    expect(screen.queryByText(/% contra o período anterior/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Ver meses e documentos'))
    const meses = screen.getByRole('list', { name: 'Intervalo atual' })
    const junho = within(meses).getByText('jun 2026').closest('li')!
    expect(junho).toHaveTextContent('Sem transações importadas')
    expect(junho).not.toHaveTextContent('R$')
    expect(within(meses).getAllByText('Documentos com transações: 1')).toHaveLength(2)
  })

  it('mostra variação somente com os dois intervalos preenchidos', async () => {
    vi.mocked(puxarTudo).mockResolvedValue(['02', '03', '04', '05', '06', '07'].map((mes, i) => ({
      ...transacao, id: `tx-${i}`, document_id: `doc-${i}`, competencia: `2026-${mes}`,
      date: `2026-${mes}-10`, amount_cents: i < 3 ? 10000 : 15000,
    })))
    abrir('?janela=3')
    expect(await screen.findByText('50,0% contra o período anterior')).toBeVisible()
    expect(screen.getByText(/Os dois intervalos têm a mesma duração/)).toBeVisible()
  })

  it('avalia apenas os meses do banco selecionado, sem usar outro banco para preencher lacunas', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      transacao,
      ...['02', '03', '04', '05', '06'].map((mes) => ({ ...transacao, id: `tx-${mes}`,
        document_id: `doc-${mes}`, bank: 'bradesco' as const, competencia: `2026-${mes}`, date: `2026-${mes}-10` })),
    ])
    abrir('?janela=3&banco=nubank')
    expect(await screen.findByText(/A comparação fica indisponível/)).toBeVisible()
    expect(screen.getAllByText('1 de 3 meses com transações').length).toBeGreaterThan(0)
    expect(screen.getByText('0 de 3 meses com transações')).toBeVisible()
  })
})
