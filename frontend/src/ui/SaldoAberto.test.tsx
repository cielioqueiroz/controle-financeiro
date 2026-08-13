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

  it('omite a data de fechamento quando o banco não declara', () => {
    render(<SaldoAberto bank="bradesco" futurasCents={null} abertoCents={552944} proximoFechamento={null} />)
    expect(screen.queryByText(/fecha em/i)).not.toBeInTheDocument()
  })

  it('banco fora do catálogo não quebra', () => {
    render(<SaldoAberto bank="inventado" futurasCents={null} abertoCents={1} proximoFechamento={null} />)
    expect(screen.getByText(/0,01/)).toBeInTheDocument()
  })
})

// Os dois bancos declaram números diferentes — o Nubank, o gasto do ciclo que
// ainda não fechou; o Bradesco, o total já parcelado que ainda vai ser
// cobrado. A rodada de 12/08 deu a cada um um RÓTULO diferente, e a fileira
// ficou com "Em aberto Nubank" ao lado de "Próximas faturas Bradesco": dois
// cards irmãos, com cara de coisas diferentes, foi o que o usuário apontou.
//
// Agora o rótulo é um só — verdadeiro para ambos, porque os dois números
// respondem "o que ainda vem" — e a diferença vive na linha de detalhe, que é
// onde ela cabe sem quebrar a leitura da fileira.
describe('SaldoAberto — rótulo padrão na fileira inteira', () => {
  it('o ciclo em aberto entra sob "Próximas faturas", com o detalhe do ciclo', () => {
    render(
      <SaldoAberto
        bank="nubank"
        abertoCents={271775}
        futurasCents={null}
        proximoFechamento="2026-08-20"
      />,
    )
    expect(screen.getByText(/Próximas faturas/i)).toBeInTheDocument()
    // O rótulo do topo, e só ele: "em aberto" continua dito na linha de
    // detalhe logo abaixo, que é onde a distinção passou a morar.
    expect(screen.queryByText(/^Em aberto$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/ciclo em aberto/i)).toBeInTheDocument()
    expect(screen.getByText(/fecha em 20\/ago/i)).toBeInTheDocument()
  })

  it('as parcelas futuras entram sob o mesmo rótulo, com o detalhe delas', () => {
    render(
      <SaldoAberto
        bank="bradesco"
        abertoCents={null}
        futurasCents={328813}
        proximoFechamento="2026-07-16"
      />,
    )
    expect(screen.getByText(/3\.288,13/)).toBeInTheDocument()
    expect(screen.getByText(/Próximas faturas/i)).toBeInTheDocument()
    // Parcelas a vencer não são "o que fecha na próxima": elas se espalham
    // por vários meses, e carimbar uma data de fechamento nesse número diria
    // que tudo cai de uma vez.
    expect(screen.getByText(/parcelas a vencer/i)).toBeInTheDocument()
    expect(screen.queryByText(/fecha em/i)).not.toBeInTheDocument()
  })

  it('o ciclo em aberto vence quando os dois existem: é o "quanto já devo agora"', () => {
    render(
      <SaldoAberto
        bank="nubank"
        abertoCents={268823}
        futurasCents={999999}
        proximoFechamento={null}
      />,
    )
    expect(screen.getByText(/2\.688,23/)).toBeInTheDocument()
    expect(screen.getByText(/ciclo em aberto/i)).toBeInTheDocument()
  })

  it('sem nenhum dos dois, o card não aparece — não há o que dizer', () => {
    const { container } = render(
      <SaldoAberto bank="nubank" abertoCents={null} futurasCents={null} proximoFechamento={null} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
