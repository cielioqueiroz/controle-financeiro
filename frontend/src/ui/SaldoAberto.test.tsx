import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SaldoAberto } from './SaldoAberto'

describe('SaldoAberto', () => {
  it('mostra o valor em aberto formatado', () => {
    render(<SaldoAberto bank="nubank" futurasCents={null} abertoCents={268823} proximoFechamento="2026-07-20" />)
    expect(screen.getByText(/2\.688,23/)).toBeInTheDocument()
  })

  it('nomeia o banco pelo catálogo canônico', () => {
    render(<SaldoAberto bank="nubank" futurasCents={null} abertoCents={100} proximoFechamento={null} />)
    expect(screen.getByText('Nubank')).toBeInTheDocument()
  })

  it('omite a linha de fechamento quando o banco não declara', () => {
    render(<SaldoAberto bank="bradesco" futurasCents={null} abertoCents={552944} proximoFechamento={null} />)
    expect(screen.queryByText(/fecha/i)).not.toBeInTheDocument()
  })

  it('banco fora do catálogo não quebra', () => {
    render(<SaldoAberto bank="inventado" futurasCents={null} abertoCents={1} proximoFechamento={null} />)
    expect(screen.getByText(/0,01/)).toBeInTheDocument()
  })
})

// O Bradesco não declara saldo em aberto — a fatura dele não traz o quanto já
// foi gasto no ciclo que ainda vai fechar. Declara o total já comprometido em
// parcelas, que é outro número: chamar os dois de "em aberto" poria lado a
// lado, com o mesmo rótulo, respostas para perguntas diferentes.
describe('SaldoAberto — quando o banco declara só as próximas faturas', () => {
  it('mostra o valor sob o rótulo "Próximas faturas", não "Em aberto"', () => {
    render(
      <SaldoAberto
        bank="bradesco"
        abertoCents={null}
        futurasCents={557834}
        proximoFechamento="2026-07-16"
      />,
    )
    expect(screen.getByText(/5\.578,34/)).toBeInTheDocument()
    expect(screen.getByText(/Próximas faturas/i)).toBeInTheDocument()
    expect(screen.queryByText(/Em aberto/i)).not.toBeInTheDocument()
    expect(screen.getByText(/fecha em 16\/jul/i)).toBeInTheDocument()
  })

  it('em aberto vence quando os dois existem: é o "quanto já devo agora"', () => {
    render(
      <SaldoAberto
        bank="nubank"
        abertoCents={268823}
        futurasCents={999999}
        proximoFechamento={null}
      />,
    )
    expect(screen.getByText(/2\.688,23/)).toBeInTheDocument()
    expect(screen.getByText(/Em aberto/i)).toBeInTheDocument()
  })

  it('sem nenhum dos dois, o card não aparece — não há o que dizer', () => {
    const { container } = render(
      <SaldoAberto bank="nubank" abertoCents={null} futurasCents={null} proximoFechamento={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
