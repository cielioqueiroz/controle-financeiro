import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Folego } from './Folego'
import type { FaturaAberta } from '../domain/aberto'
import type { SaldoConta } from '../domain/saldos'

/** R$ 100 por dia, de 2026-04-02 a 2026-06-30 (90 dias). */
const NOVENTA_DIAS = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 3, 2 + i)).toISOString().slice(0, 10)
  return { date: d, competencia: d.slice(0, 7), amount_cents: 10000, kind: 'expense', category_slug: 'outros' }
})

const BB: SaldoConta = { accountId: 'a', bank: 'bb', balanceCents: 600000, date: '2026-06-30' }
const NUBANK: FaturaAberta = {
  accountId: 'b', bank: 'nubank', abertoCents: 150000, proximaCents: null,
  futurasCents: null, proximoFechamento: null, date: '2026-06-20',
}
const BRADESCO: FaturaAberta = { ...NUBANK, accountId: 'c', bank: 'bradesco', abertoCents: null, futurasCents: 90000 }

describe('Folego', () => {
  it('mostra o líquido: saldo menos o em aberto dos cartões', () => {
    render(<Folego saldos={[BB]} abertos={[NUBANK]} txs={NOVENTA_DIAS} />)
    expect(screen.getByText('Líquido de curto prazo')).toBeInTheDocument()
    expect(screen.getByText('R$ 4.500,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 6.000,00 nas contas − R$ 1.500,00 em aberto nos cartões.')).toBeInTheDocument()
  })

  it('o fôlego parte do líquido quando há em aberto: dinheiro de cartão já está gasto', () => {
    render(<Folego saldos={[BB]} abertos={[NUBANK]} txs={NOVENTA_DIAS} />)
    expect(screen.getByText('45 dias')).toBeInTheDocument()
    expect(screen.getByText(/R\$ 100,00 por dia de gasto real, a média dos últimos 90 dias/)).toBeInTheDocument()
  })

  it('sem em aberto declarado, o fôlego parte do saldo e o líquido não aparece', () => {
    render(<Folego saldos={[BB]} abertos={[BRADESCO]} txs={NOVENTA_DIAS} />)
    expect(screen.queryByText('Líquido de curto prazo')).not.toBeInTheDocument()
    expect(screen.getByText('60 dias')).toBeInTheDocument()
  })

  it('nomeia o cartão que ficou de fora do líquido', () => {
    render(<Folego saldos={[BB]} abertos={[NUBANK, BRADESCO]} txs={NOVENTA_DIAS} />)
    expect(screen.getByText(/Fora da conta, por não declarar o em aberto: Bradesco\./)).toBeInTheDocument()
  })

  it('um dia é "1 dia"', () => {
    render(<Folego saldos={[{ ...BB, balanceCents: 15000 }]} abertos={[]} txs={NOVENTA_DIAS} />)
    expect(screen.getByText('1 dia')).toBeInTheDocument()
  })

  it('sem histórico suficiente nem em aberto, não desenha nada', () => {
    const { container } = render(<Folego saldos={[BB]} abertos={[]} txs={NOVENTA_DIAS.slice(-10)} />)
    expect(container).toBeEmptyDOMElement()
  })
})
