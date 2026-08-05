import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SaldoAberto } from './SaldoAberto'

describe('SaldoAberto', () => {
  it('mostra o valor em aberto formatado', () => {
    render(<SaldoAberto bank="nubank" abertoCents={268823} proximoFechamento="2026-07-20" />)
    expect(screen.getByText(/2\.688,23/)).toBeInTheDocument()
  })

  it('nomeia o banco pelo catálogo canônico', () => {
    render(<SaldoAberto bank="nubank" abertoCents={100} proximoFechamento={null} />)
    expect(screen.getByText('Nubank')).toBeInTheDocument()
  })

  it('omite a linha de fechamento quando o banco não declara', () => {
    render(<SaldoAberto bank="bradesco" abertoCents={552944} proximoFechamento={null} />)
    expect(screen.queryByText(/fecha/i)).not.toBeInTheDocument()
  })

  it('banco fora do catálogo não quebra', () => {
    render(<SaldoAberto bank="inventado" abertoCents={1} proximoFechamento={null} />)
    expect(screen.getByText(/0,01/)).toBeInTheDocument()
  })
})
