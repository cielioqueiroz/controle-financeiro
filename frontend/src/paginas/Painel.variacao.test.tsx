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
// O relatório em PDF puxa jspdf por import dinâmico; nada aqui o exercita.
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

/** Abre o painel em JUNHO/2026 — `ref` na URL evita depender da competência
 *  mais recente com dado, que muda conforme a amostra de cada teste. */
function abrirEmJunho(lista: ReturnType<typeof tx>[]) {
  vi.mocked(puxarTudo).mockResolvedValue(lista as never)
  render(
    <MemoryRouter initialEntries={['/?ref=2026-06-15&periodo=mes']}>
      <DadosProvider>
        <Painel />
      </DadosProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

// Bloco 1 do spec (docs/prompt-dashboard-financeiro.md): "variação percentual
// contra o período anterior". O número sozinho não informa — R$ 918 em
// supermercado só vira notícia comparado com o mês passado.
describe('Painel — comparação com o período anterior', () => {
  it('diz quanto o gasto subiu em relação ao mês anterior', async () => {
    abrirEmJunho([
      tx({ competencia: '2026-05', amount_cents: 100000 }),
      tx({ competencia: '2026-06', amount_cents: 122000 }),
    ])
    expect(await screen.findByText('22% acima do período anterior')).toBeInTheDocument()
  })

  it('diz quanto caiu quando se gastou menos', async () => {
    abrirEmJunho([
      tx({ competencia: '2026-05', amount_cents: 100000 }),
      tx({ competencia: '2026-06', amount_cents: 80000 }),
    ])
    expect(await screen.findByText('20% abaixo do período anterior')).toBeInTheDocument()
  })

  // O caso que motivou o `null` em `variacaoPct`: sem mês anterior, qualquer
  // gasto seria "+100%" — que não significa "gastou o dobro", significa "não
  // havia nada antes". Estampar isso no primeiro mês importado seria mentir
  // para justamente quem ainda não tem repertório para desconfiar.
  it('não mostra comparação nenhuma quando não há mês anterior', async () => {
    abrirEmJunho([tx({ competencia: '2026-06', amount_cents: 122000 })])
    // Espera o painel ter pintado o valor antes de afirmar a ausência: sem
    // isso, o teste passaria só por ter chegado cedo demais. `findAll` porque
    // o mesmo valor aparece no tile e na lista — não é ambiguidade, é o
    // mesmo número em duas leituras.
    expect((await screen.findAllByText('R$ 1.220,00')).length).toBeGreaterThan(0)
    // Casa a FRASE da comparação, não "período anterior" solto: a barra de
    // navegação tem um botão com esse mesmo nome, e mirar nele faria o teste
    // reprovar um painel correto.
    expect(screen.queryByText(/(acima|abaixo) do período anterior/)).not.toBeInTheDocument()
    expect(screen.queryByText('igual ao período anterior')).not.toBeInTheDocument()
  })

  // Meio ponto percentual arredonda para zero, e "0% acima" soa a defeito.
  it('chama de empate a diferença que arredonda para zero', async () => {
    abrirEmJunho([
      tx({ competencia: '2026-05', amount_cents: 100000 }),
      tx({ competencia: '2026-06', amount_cents: 100300 }),
    ])
    expect(await screen.findByText('igual ao período anterior')).toBeInTheDocument()
  })

  // A cor não pode seguir só o sinal: receber 10% a mais é bom, gastar 10% a
  // mais não é. Um sinal único pintaria de vermelho um aumento de salário.
  it('pinta subir de vermelho no gasto e de verde nas entradas', async () => {
    abrirEmJunho([
      tx({ competencia: '2026-05', amount_cents: 100000 }),
      tx({ competencia: '2026-06', amount_cents: 120000 }),
      tx({ competencia: '2026-05', amount_cents: -500000, kind: 'income' }),
      tx({ competencia: '2026-06', amount_cents: -600000, kind: 'income' }),
    ])
    const linhas = await screen.findAllByText('20% acima do período anterior')
    // A ordem dos tiles é gasto, entradas — a mesma do painel.
    expect(linhas[0]).toHaveClass('text-debito')
    expect(linhas[1]).toHaveClass('text-credito')
  })
})
