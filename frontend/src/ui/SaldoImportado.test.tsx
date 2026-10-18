import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SaldoImportado } from './SaldoImportado'

describe('Saldo importado', () => {
  it('explica datas diferentes e abre cada documento sem perder os filtros', async () => {
    render(<MemoryRouter initialEntries={['/?banco=nubank&janela=6']}><SaldoImportado saldos={[
      { accountId: 'a', bank: 'nubank', balanceCents: 20000, date: '2026-07-31', documentId: 'doc-a' },
      { accountId: 'b', bank: 'nubank', balanceCents: -35000, date: '2026-06-30', documentId: 'doc-b' },
    ]} /></MemoryRouter>)
    expect(screen.getByText(/150,00/)).toBeVisible()
    await userEvent.click(screen.getByText('Ver contas e datas'))
    expect(screen.getByText(/As contas têm extratos de datas diferentes/)).toBeVisible()
    const contas = screen.getAllByRole('listitem')
    expect(contas[0]).toHaveTextContent('31/07/2026')
    expect(contas[1]).toHaveTextContent('30/06/2026')
    expect(within(contas[0]).getByRole('link')).toHaveAttribute('href', '/faturas?banco=nubank&janela=6&documento=doc-a')
  })
  it('ausência de saldo não vira zero nem oferece um documento inventado', () => {
    render(<MemoryRouter><SaldoImportado saldos={[]} /></MemoryRouter>)
    expect(screen.getByText('—')).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
  })
})
