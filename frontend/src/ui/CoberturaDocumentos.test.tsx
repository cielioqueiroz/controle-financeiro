import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CoberturaDocumentos } from './CoberturaDocumentos'

const doc = (bank: string, doc_type: string, period_end: string | null) => ({ bank, doc_type, period_end })

// O mês em curso depende do relógio: fixá-lo é o que faz o teste medir o
// componente, e não o dia em que a suíte rodou.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 30))
})
afterEach(() => vi.useRealTimers())

describe('CoberturaDocumentos', () => {
  it('diz quantos documentos faltam e onde', () => {
    render(<CoberturaDocumentos documentos={[
      doc('nubank', 'fatura', '2026-07-10'),
      doc('nubank', 'fatura', '2026-09-10'),
    ]} />)
    expect(screen.getByText(/^1 documento faltando/)).toBeInTheDocument()
    const linha = screen.getByRole('row', { name: /Nubank · Fatura/ })
    expect(within(linha).getAllByText('Faltando')).toHaveLength(1)
    expect(within(linha).getAllByText('Importado')).toHaveLength(2)
  })

  it('o extrato do mês que ainda não acabou não falta', () => {
    render(<CoberturaDocumentos documentos={[
      doc('bradesco', 'extrato', '2026-09-30'),
      doc('bradesco', 'fatura', '2026-10-10'),
    ]} />)
    expect(screen.getByText('Nenhum documento faltando nos últimos 2 meses.')).toBeInTheDocument()
    const linha = screen.getByRole('row', { name: /Bradesco · Extrato/ })
    expect(within(linha).getByText('Mês em curso')).toBeInTheDocument()
  })

  it('não desenha nada sem documento com período', () => {
    const { container } = render(<CoberturaDocumentos documentos={[doc('nubank', 'fatura', null)]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
