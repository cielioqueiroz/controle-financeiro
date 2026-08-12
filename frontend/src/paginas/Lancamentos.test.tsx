import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { Lancamentos } from './Lancamentos'

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))

import { puxarTudo } from '../persist/puxar'

function tx(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'a',
    date: '2026-06-10',
    competencia: '2026-06',
    description: 'DROGASIL',
    label: null,
    amount_cents: 5000,
    kind: 'expense',
    category_slug: 'farmacia',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'd1',
    installment: null,
    ...over,
  }
}

const LISTA = [
  tx({ id: 'a', description: 'DROGASIL', category_slug: 'farmacia' }),
  tx({ id: 'b', description: 'UBER TRIP', category_slug: 'transporte' }),
  tx({ id: 'c', description: 'CARREFOUR', category_slug: 'supermercado' }),
]

/** Espelha a URL na tela, para os testes lerem o que a página escreveu nela. */
function Url() {
  const { search } = useLocation()
  return <span data-testid="url">{search}</span>
}

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <DadosProvider>
        <Lancamentos />
      </DadosProvider>
      <Url />
    </MemoryRouter>,
  )
}

describe('Lançamentos — os filtros da URL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(puxarTudo).mockResolvedValue(LISTA as any)
  })

  // O clique numa fatia do donut navega para cá com `cat` na URL. Antes, a
  // página abria na vista "por categoria" — que ignora o filtro — e a lista
  // inteira aparecia, como se o clique não tivesse acontecido. O `cat` era
  // lido, escrito e testado em filtros.ts, e nenhuma tela o consumia.
  it('chegando com ?cat, abre já filtrado por aquela categoria', async () => {
    abrir('/lancamentos?ref=2026-06&cat=transporte')

    expect(await screen.findByText('UBER TRIP')).toBeInTheDocument()
    expect(screen.queryByText('DROGASIL')).not.toBeInTheDocument()
    expect(screen.getByText(/^1 lançamento/)).toBeInTheDocument()
    // E o <select> mostra a categoria: o que se vê e o que se filtra iguais.
    expect(screen.getByLabelText('Filtrar por categoria')).toHaveValue('transporte')
  })

  it('chegando com ?q, abre já com a busca aplicada', async () => {
    abrir('/lancamentos?ref=2026-06&q=drogasil')

    expect(await screen.findByText('DROGASIL')).toBeInTheDocument()
    expect(screen.queryByText('UBER TRIP')).not.toBeInTheDocument()
  })

  // Sem isto o recorte não sobrevive ao F5 nem cabe num link — as duas coisas
  // que a fatia 2 prometeu ao pôr os filtros na URL.
  it('digitar na busca escreve na URL', async () => {
    abrir('/lancamentos?ref=2026-06&q=x')

    const campo = await screen.findByLabelText('Procurar lançamento')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'uber')

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('q=uber'))
    expect(screen.getByText('UBER TRIP')).toBeInTheDocument()
  })

  it('escolher categoria no seletor escreve na URL', async () => {
    abrir('/lancamentos?ref=2026-06&q=')

    // Sem cat nem q, a página abre na vista por categoria: vá para "Todos".
    await userEvent.click(await screen.findByRole('button', { name: 'Todos' }))
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'supermercado')

    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent('cat=supermercado'))
    expect(screen.getByText('CARREFOUR')).toBeInTheDocument()
  })

  it('sem cat nem q, abre na vista por categoria, como sempre', async () => {
    abrir('/lancamentos?ref=2026-06')
    // A vista "por categoria" agrupa: o nome da categoria aparece como grupo,
    // e o campo de busca (que só existe na vista "Todos") não está na tela.
    expect(await screen.findByText(/Farmácia/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Procurar lançamento')).not.toBeInTheDocument()
  })
})
