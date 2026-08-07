import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaldoConta } from './SaldoConta'

describe('SaldoConta', () => {
  it('mostra banco, valor e data', () => {
    render(<SaldoConta bank="nubank" balanceCents={123456} date="2026-06-30" />)
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    expect(screen.getByText(/1\.234,56/)).toBeInTheDocument()
    expect(screen.getByText(/30\/jun/i)).toBeInTheDocument()
  })

  it('saldo negativo ganha a cor de falha', () => {
    render(<SaldoConta bank="bradesco" balanceCents={-3500} date="2026-06-30" />)
    const valor = screen.getByText(/-R\$\s?35,00|-35,00/)
    expect(valor.className).toMatch(/text-falha/)
  })

  it('banco desconhecido não quebra', () => {
    render(<SaldoConta bank="zzz" balanceCents={1000} date="2026-01-05" />)
    expect(screen.getByText(/5\/jan/i)).toBeInTheDocument()
  })
})
