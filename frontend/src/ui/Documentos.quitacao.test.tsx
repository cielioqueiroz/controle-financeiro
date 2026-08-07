import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Documentos } from './Documentos'

vi.mock('../persist/documentos', () => ({
  puxarDocumentos: vi.fn().mockResolvedValue([
    {
      id: 'f-nu',
      bank: 'nubank',
      doc_type: 'fatura',
      period_start: '2026-05-21',
      period_end: '2026-06-20',
      filename: 'nubank.pdf',
      imported_at: '2026-06-21T10:00:00Z',
      declared_total: 832424,
    },
    {
      id: 'f-bra',
      bank: 'bradesco',
      doc_type: 'fatura',
      period_start: '2026-05-11',
      period_end: '2026-06-10',
      filename: 'bradesco.pdf',
      imported_at: '2026-06-21T10:00:00Z',
      declared_total: 552944,
    },
    {
      id: 'e-nu',
      bank: 'nubank',
      doc_type: 'extrato',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      filename: 'extrato.pdf',
      imported_at: '2026-07-01T10:00:00Z',
      declared_total: null,
    },
  ]),
  apagarDocumento: vi.fn(),
  apagarTudo: vi.fn(),
}))

const props = {
  onFechar: () => {},
  onMudou: () => {},
  contagem: new Map<string, { qtd: number; totalCents: number }>(),
}

describe('Documentos — selo de quitação', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca como quitada a fatura que tem pagamento correspondente', async () => {
    render(
      <Documentos
        {...props}
        pagamentos={[
          { id: 'p1', date: '2026-06-20', amount_cents: -832424, kind: 'card_payment' },
        ]}
      />,
    )
    expect(await screen.findByText('quitada')).toBeInTheDocument()
    // A outra fatura continua em aberto — o pagamento não vale para as duas.
    expect(screen.getAllByText('em aberto')).toHaveLength(1)
  })

  it('a fatura sem pagamento aparece em aberto', async () => {
    render(<Documentos {...props} pagamentos={[]} />)
    expect(await screen.findAllByText('em aberto')).toHaveLength(2)
  })

  it('sem pagamento nenhum, nenhuma fatura é quitada', async () => {
    render(<Documentos {...props} pagamentos={[]} />)
    await screen.findAllByText('em aberto')
    expect(screen.queryByText('quitada')).not.toBeInTheDocument()
  })

  it('extrato não recebe selo (não se quita um extrato)', async () => {
    render(<Documentos {...props} pagamentos={[]} />)
    // 3 documentos, mas só as 2 faturas têm selo.
    await screen.findAllByText('em aberto')
    expect(screen.getAllByText(/quitada|em aberto/)).toHaveLength(2)
  })
})
