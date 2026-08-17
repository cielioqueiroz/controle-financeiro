import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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

/** O defeito relatado com o app na tela: "quando passa a ser dias, o gráfico
 *  some". `GraficoDiario` recebia só o recorte, e no período Dia o recorte é
 *  um dia — um dia só não é ritmo, então ele se apagava e a metade direita do
 *  painel voltava a ser o buraco que ele existe para tapar. */
describe('Painel — o ritmo diário no período Dia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('continua desenhando: a janela vira o mês em volta do dia aberto', async () => {
    abrir(JUNHO, '/?ref=2026-06-10&p=dia')
    // As três barras do mês, e não a única do recorte.
    expect(await screen.findByRole('button', { name: /3\/jun/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /10\/jun/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /21\/jun/ })).toBeInTheDocument()
  })

  it('diz que o desenho cobre o mês, para a média não ser lida como a do dia', async () => {
    abrir(JUNHO, '/?ref=2026-06-10&p=dia')
    // No TÍTULO do gráfico: "jun 2026" também é o rótulo do navegador de
    // período no topo da página, e um getByText solto casaria com os dois.
    const titulo = await screen.findByText(/Saídas por dia/i)
    expect(titulo).toHaveTextContent(/jun 2026/i)
  })

  // Sem o destaque, quem abre o dia 10 vê o mês inteiro e perde de vista
  // onde está — e a faixa de leitura mostraria o pico (21/jun) como se
  // fosse o número do dia aberto.
  it('marca o dia aberto com a cor da marca', async () => {
    abrir(JUNHO, '/?ref=2026-06-10&p=dia')
    const barra = await screen.findByRole('button', { name: /10\/jun/ })
    expect(barra.querySelector('span')).toHaveClass('bg-marca')
  })

  it('no período Mês nada é ampliado — a janela já era o mês', async () => {
    abrir(JUNHO, '/?ref=2026-06-15&p=mes')
    expect(await screen.findByRole('button', { name: /3\/jun/ })).toBeInTheDocument()
    // Nenhuma barra destacada: no Mês não existe "o dia aberto".
    const marcadas = document.querySelectorAll('button > span.bg-marca')
    expect(marcadas).toHaveLength(0)
  })
})

/** A régua do grid vazando por baixo dos tiles curtos era a "barra escura
 *  atravessando o painel" do print. Os dois primeiros tiles ganham a linha de
 *  variação e ficam mais altos; sem fundo no item do grid, a sobra das
 *  células 3 e 4 mostrava o `gap-px`. */
describe('Painel — os tiles preenchem a própria célula', () => {
  beforeEach(() => vi.clearAllMocks())

  it('todo item do grid de tiles tem fundo próprio', async () => {
    abrir(JUNHO, '/?ref=2026-06-15&p=mes')
    // Âncora numa barra do gráfico: é o último pedaço do painel a montar, e
    // é inequívoco. "Lançamentos" nomeia um tile E o link do rodapé; "629,00"
    // aparece no tile de gasto E no de saldo.
    await screen.findByRole('button', { name: /3\/jun/ })
    const grid = document.querySelector('.grid.gap-px.bg-carvao-800')
    expect(grid).not.toBeNull()
    const itens = [...grid!.children]
    expect(itens).toHaveLength(4)
    for (const item of itens) expect(item).toHaveClass('bg-carvao-900')
  })
})
