import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { Painel } from './Painel'

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))
vi.mock('../lib/relatorio-pdf', () => ({ gerarRelatorioPdf: vi.fn() }))

import { puxarTudo } from '../persist/puxar'

function tx(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: crypto.randomUUID(),
    date: '2026-06-10',
    competencia: '2026-06',
    description: 'MERCADO',
    label: null,
    amount_cents: 10000,
    kind: 'expense',
    category_slug: 'supermercado',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'd1',
    installment: null,
    ...over,
  }
}

function abrir(lista: ReturnType<typeof tx>[], query: string) {
  vi.mocked(puxarTudo).mockResolvedValue(lista as never)
  render(
    <MemoryRouter initialEntries={[query]}>
      <DadosProvider>
        <Painel />
      </DadosProvider>
    </MemoryRouter>,
  )
}

const JUNHO = [
  tx({ date: '2026-06-03', amount_cents: 5000 }),
  tx({ date: '2026-06-10', amount_cents: 17900 }),
  tx({ date: '2026-06-21', amount_cents: 40000 }),
]

async function expandirAnalise() {
  fireEvent.click(await screen.findByText('Explorar o período'))
}

/** O defeito relatado com o app na tela: "quando passa a ser dias, o gráfico
 *  some". `GraficoDiario` recebia só o recorte, e no período Dia o recorte é
 *  um dia — um dia só não é ritmo, então ele se apagava e a metade direita do
 *  painel voltava a ser o buraco que ele existe para tapar. */
describe('Painel — o ritmo diário no período Dia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('continua desenhando: a janela vira o mês em volta do dia aberto', async () => {
    abrir(JUNHO, '/?ref=2026-06-10&p=dia')
    await expandirAnalise()
    // As três barras do mês, e não a única do recorte.
    expect(await screen.findByRole('button', { name: /3\/jun/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /10\/jun/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /21\/jun/ })).toBeInTheDocument()
  })

  it('diz que o desenho cobre o mês, para a média não ser lida como a do dia', async () => {
    abrir(JUNHO, '/?ref=2026-06-10&p=dia')
    await expandirAnalise()
    // No TÍTULO do gráfico: "jun 2026" também é o rótulo do navegador de
    // período no topo da página, e um getByText solto casaria com os dois.
    const titulo = await screen.findByText(/Saídas por dia/i)
    expect(titulo).toHaveTextContent(/jun 2026/i)
  })

  // Sem o destaque, quem abre o dia 10 vê o mês inteiro e perde de vista
  // onde está — e a faixa de leitura mostraria o pico (21/jun) como se
  // fosse o número do dia aberto.
  it('marca o dia aberto com a cor de destaque do gráfico', async () => {
    abrir(JUNHO, '/?ref=2026-06-10&p=dia')
    await expandirAnalise()
    const barra = await screen.findByRole('button', { name: /10\/jun/ })
    expect(barra.querySelector('span')).toHaveClass('bg-grafico-acumulado')
  })

  it('no período Mês nada é ampliado — a janela já era o mês', async () => {
    abrir(JUNHO, '/?ref=2026-06-15&p=mes')
    await expandirAnalise()
    expect(await screen.findByRole('button', { name: /3\/jun/ })).toBeInTheDocument()
    // Nenhuma barra destacada: no Mês não existe "o dia aberto".
    const marcadas = document.querySelectorAll('button > span.bg-grafico-acumulado')
    expect(marcadas).toHaveLength(0)
  })
})

/** Os três números de decisão ficam à frente da análise detalhada. */
describe('Painel — os tiles respiram como cartões separados', () => {
  beforeEach(() => vi.clearAllMocks())

  it('todo item do grid de tiles tem fundo próprio', async () => {
    abrir(JUNHO, '/?ref=2026-06-15&p=mes')
    await screen.findByText('Explorar o período')
    const grid = screen.getByRole('group', { name: 'Resumo financeiro do período' })
    const itens = [...grid.children]
    expect(itens).toHaveLength(3)
    for (const item of itens) {
      expect(item).toHaveClass('cartao')
    }
  })

  it('mantém alertas visíveis e análises recolhidas até a pessoa abrir', async () => {
    abrir(JUNHO, '/?ref=2026-06-15&p=mes')
    const resumo = await screen.findByRole('group', { name: 'Resumo financeiro do período' })
    expect(resumo).toHaveTextContent('Entradas')
    expect(resumo).toHaveTextContent('Gasto real')
    expect(resumo).toHaveTextContent('Resultado')
    expect(screen.getByText('Pontos de atenção')).toBeVisible()

    const secao = screen.getByText('Explorar o período').closest('details')
    expect(secao).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Explorar o período'))
    expect(secao).toHaveAttribute('open')
    expect(screen.getByText('Saídas por dia')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Explorar o período'))
    expect(secao).not.toHaveAttribute('open')
  })

  it('mantém compromissos acessíveis quando o período escolhido não tem transações', async () => {
    abrir([tx({ installment: { current: 1, total: 3 } })], '/?ref=2026-07&p=mes')
    fireEvent.click(await screen.findByText('Contas e compromissos'))
    expect(screen.getByText('Próximos compromissos')).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Resumo financeiro do período' })).not.toBeInTheDocument()
  })
})

function Destino() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <p data-testid="destino">{location.pathname + location.search}</p>
      <button onClick={() => navigate(-1)}>Voltar</button>
    </>
  )
}

it('abre as transações no mesmo recorte e Voltar recupera o Painel', async () => {
  vi.mocked(puxarTudo).mockResolvedValue(JUNHO as never)
  render(
    <MemoryRouter initialEntries={['/?ref=2026-06-15&p=mes&banco=nubank']}>
      <DadosProvider>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/lancamentos" element={<Destino />} />
        </Routes>
      </DadosProvider>
    </MemoryRouter>,
  )

  fireEvent.click(await screen.findByRole('link', { name: /Ver lançamentos/ }))
  expect(screen.getByTestId('destino')).toHaveTextContent('/lancamentos?ref=2026-06&banco=nubank')
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(await screen.findByRole('group', { name: 'Resumo financeiro do período' })).toBeVisible()
  expect(screen.getByRole('link', { name: /Ver lançamentos/ })).toHaveAttribute('href', '/lancamentos?ref=2026-06&banco=nubank')
  expect(screen.getByText('Explorar o período').closest('details')).not.toHaveAttribute('open')
})
