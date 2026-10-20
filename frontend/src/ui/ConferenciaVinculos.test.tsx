import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConferenciaVinculos } from './ConferenciaVinculos'
import { DiscretoProvider } from '../dados/DiscretoProvider'
import { DiscretoToggle } from './DiscretoToggle'
import { IdiomaProvider, useT } from '../i18n/IdiomaProvider'

const docs = [
  { id: 'extrato', bank: 'nubank', doc_type: 'extrato', filename: 'extrato.pdf', declared_total: null, period_end: '2026-06-30' },
  { id: 'fatura', bank: 'bradesco', doc_type: 'fatura', filename: 'fatura.pdf', declared_total: 12500, period_end: '2026-06-10' },
]
const transacoes = [{
  id: 'pagamento', date: '2026-06-10', description: 'Pagamento de fatura',
  amount_cents: 12500, kind: 'card_payment', document_id: 'extrato',
  vinculo_document_id: 'fatura', vinculo_criterio: 'quitacao-fatura',
}]

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('cf:idioma', 'pt')
})

describe('ConferenciaVinculos', () => {
  it('revela duas pontas e abre o documento escolhido pelo usuário', async () => {
    const onVerDocumento = vi.fn()
    render(<ConferenciaVinculos transacoes={transacoes} documentos={docs} onVerDocumento={onVerDocumento} />)
    const resumo = screen.getByText('Conferir vínculos entre documentos')
    await userEvent.click(resumo)
    expect(screen.getByText('Pagamento no extrato')).toBeVisible()
    expect(screen.getByText('Nubank')).toBeVisible()
    expect(screen.getByText('Bradesco')).toBeVisible()
    expect(screen.getAllByText(/125,00/)).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('button', { name: 'Ver documento importado' })[1])
    expect(onVerDocumento).toHaveBeenCalledWith('fatura')
  })

  it('vazio não afirma quitação nem transforma ausência de evidência em valor zero', async () => {
    render(<ConferenciaVinculos transacoes={[]} documentos={docs} onVerDocumento={vi.fn()} />)
    await userEvent.click(screen.getByText('Conferir vínculos entre documentos'))
    expect(screen.getByText(/Nenhum par documentado/)).toBeVisible()
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument()
  })

  it('distingue transações indisponíveis de histórico sem pares', async () => {
    render(<ConferenciaVinculos transacoes={null} documentos={docs} onVerDocumento={vi.fn()} />)
    await userEvent.click(screen.getByText('Conferir vínculos entre documentos'))
    expect(screen.getByRole('status')).toHaveTextContent('As transações estão indisponíveis.')
    expect(screen.queryByText(/Nenhum par documentado/)).not.toBeInTheDocument()
  })

  it('mascara os valores das duas pontas ao alternar o modo discreto', async () => {
    render(<DiscretoProvider><DiscretoToggle /><ConferenciaVinculos transacoes={transacoes} documentos={docs} onVerDocumento={vi.fn()} /></DiscretoProvider>)
    await userEvent.click(screen.getByText('Conferir vínculos entre documentos'))
    expect(screen.getAllByText(/125,00/)).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: /[Ee]sconder/ }))
    expect(screen.queryByText(/125,00/)).not.toBeInTheDocument()
  })

  it('traduz a superfície montada quando o idioma muda', async () => {
    function TrocarIdioma() {
      const { setIdioma } = useT()
      return <button onClick={() => setIdioma('en')}>EN</button>
    }
    render(<IdiomaProvider><TrocarIdioma /><ConferenciaVinculos transacoes={transacoes} documentos={docs} onVerDocumento={vi.fn()} /></IdiomaProvider>)
    await userEvent.click(screen.getByText('Conferir vínculos entre documentos'))
    await userEvent.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByText('Check links between documents')).toBeVisible()
    expect(screen.getByText('Payment in the statement')).toBeVisible()
    expect(screen.queryByText('Pagamento no extrato')).not.toBeInTheDocument()
  })
})
