import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@testing-library/jest-dom/vitest'

import type { ItemFuturo, MesFuturo } from '../domain/agrupar'
import { ProximosCompromissos } from './ProximosCompromissos'

const item = (over: Partial<ItemFuturo> = {}): ItemFuturo => ({
  descricao: 'GELADEIRA BRASTEMP',
  parcela: 3,
  total: 10,
  amountCents: 25000,
  bank: 'nubank',
  ...over,
})

const mes = (over: Partial<MesFuturo> = {}): MesFuturo => ({
  competencia: '2026-07',
  totalCents: 25000,
  itens: [item()],
  porBanco: [{ bank: 'nubank', totalCents: 25000 }],
  ...over,
})

function renderCard(meses: MesFuturo[]) {
  return render(
    <MemoryRouter>
      <ProximosCompromissos meses={meses} href="/recorrencias?ref=2026-07" />
    </MemoryRouter>,
  )
}

describe('ProximosCompromissos', () => {
  it('não desenha um card sem projeção', () => {
    const { container } = renderCard([])
    expect(container).toBeEmptyDOMElement()
  })

  it('resume o total e as parcelas de toda a projeção', () => {
    renderCard([
      mes({ totalCents: 25000 }),
      mes({
        competencia: '2026-08',
        totalCents: 40000,
        itens: [item({ parcela: 4 }), item({ descricao: 'SOFÁ', amountCents: 15000 })],
      }),
      mes({ competencia: '2026-09', totalCents: 30000, itens: [item({ parcela: 5 })] }),
    ])

    expect(screen.getByText('R$ 950,00')).toBeInTheDocument()
    expect(screen.getByText('3 meses · 4 parcelas projetadas')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver recorrências/i })).toHaveAttribute(
      'href',
      '/recorrencias?ref=2026-07',
    )
  })

  it('mostra somente os três primeiros meses', () => {
    renderCard([
      mes({ competencia: '2026-07' }),
      mes({ competencia: '2026-08' }),
      mes({ competencia: '2026-09' }),
      mes({ competencia: '2026-10' }),
    ])

    expect(screen.getByText('jul 2026')).toBeInTheDocument()
    expect(screen.getByText('ago 2026')).toBeInTheDocument()
    expect(screen.getByText('set 2026')).toBeInTheDocument()
    expect(screen.queryByText('out 2026')).not.toBeInTheDocument()
  })
})
