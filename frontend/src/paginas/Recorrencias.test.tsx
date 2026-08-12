import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { Recorrencias } from './Recorrencias'

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))

import { puxarTudo } from '../persist/puxar'

/** Uma assinatura: mesmo valor, todo mês, no mesmo dia — o que
 *  `detectarRecorrencias` reconhece. */
function serie(banco: string, desc: string, cents: number) {
  return ['2026-03', '2026-04', '2026-05', '2026-06'].map((comp, i) => ({
    id: `${banco}-${desc}-${i}`,
    date: `${comp}-10`,
    competencia: comp,
    description: desc,
    label: null,
    amount_cents: cents,
    kind: 'expense',
    category_slug: 'assinaturas',
    bank: banco,
    doc_type: 'fatura',
    document_id: `d-${comp}`,
    installment: null,
  }))
}

const LISTA = [...serie('nubank', 'NETFLIX', 5590), ...serie('bradesco', 'SPOTIFY', 2190)]

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <DadosProvider>
        <Recorrencias />
      </DadosProvider>
    </MemoryRouter>,
  )
}

describe('Recorrências', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(puxarTudo).mockResolvedValue(LISTA as any)
  })

  it('detecta as séries dos dois bancos quando não há filtro', async () => {
    abrir('/recorrencias?ref=2026-06')
    expect(await screen.findByText(/Netflix/i)).toBeInTheDocument()
    expect(screen.getByText(/Spotify/i)).toBeInTheDocument()
  })

  // A página obedece ao filtro de banco (usa `visiveis`). Desde que a barra
  // de navegação passou a levar o recorte junto, chegar aqui filtrado é
  // rotina — e filtro que age sem aparecer é o defeito do seletor de
  // categoria de 2026-08-05 outra vez: a tela mostra menos do que existe sem
  // dizer por quê nem oferecer como desfazer.
  it('obedecendo ao filtro de banco, MOSTRA o filtro de banco', async () => {
    abrir('/recorrencias?ref=2026-06&banco=nubank')

    expect(await screen.findByText(/Netflix/i)).toBeInTheDocument()
    expect(screen.queryByText(/Spotify/i)).not.toBeInTheDocument()

    // O controle está na tela, com o banco ativo — dá para ver e para desfazer.
    expect(screen.getByRole('button', { name: 'Nubank' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Total geral' })).toBeInTheDocument()
  })

  // O contrário da mentira acima: mostrar um controle que a página ignora.
  // Esta olha o histórico INTEIRO (reconhecer "se repete todo mês" exige mais
  // de um mês), então período aqui não faria nada.
  it('não oferece seletor de período, que esta página ignora', async () => {
    abrir('/recorrencias?ref=2026-06')
    await screen.findByText(/Netflix/i)
    expect(screen.queryByRole('button', { name: 'Mês' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Próximo período')).not.toBeInTheDocument()
  })
})
