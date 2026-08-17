import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraficoDiario } from './GraficoDiario'
import { porDia } from '../../persist/agrupar'
import type { TransacaoSalva } from '../../persist/puxar'

function tx(over: Partial<TransacaoSalva>): TransacaoSalva {
  return {
    id: 'x',
    date: '2026-07-10',
    competencia: '2026-07',
    description: 'COMPRA',
    label: null,
    amount_cents: 1000,
    kind: 'expense',
    category_slug: 'outros',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'd1',
    installment: null,
    ...over,
  }
}

const DIAS = porDia([
  tx({ id: 'a', date: '2026-07-03', amount_cents: 5000 }),
  tx({ id: 'b', date: '2026-07-14', amount_cents: 40000 }),
  tx({ id: 'c', date: '2026-07-14', amount_cents: 2000 }),
  tx({ id: 'd', date: '2026-07-21', amount_cents: 1000 }),
])

describe('GraficoDiario', () => {
  it('desenha uma barra por dia com gasto, em ordem cronológica', () => {
    render(<GraficoDiario dias={DIAS} onSelecionar={() => {}} />)
    const barras = screen.getAllByRole('button')
    expect(barras).toHaveLength(3)
    expect(barras[0]).toHaveAccessibleName(/3\/jul/)
    expect(barras[2]).toHaveAccessibleName(/21\/jul/)
  })

  // Sem foco, a faixa mostra o dia de maior saída: é o que alguém procura
  // primeiro num gráfico de picos, e evita a faixa vazia ocupando altura.
  it('destaca o dia de maior saída antes de qualquer interação', () => {
    render(<GraficoDiario dias={DIAS} onSelecionar={() => {}} />)
    expect(screen.getByText('14/jul')).toBeInTheDocument()
    expect(screen.getByText(/420,00/)).toBeInTheDocument()
    expect(screen.getByText('2 lançamentos')).toBeInTheDocument()
  })

  it('a média é sobre os dias COM gasto, não sobre o calendário', () => {
    // (50,00 + 420,00 + 10,00) / 3 dias = 160,00 — não /31.
    render(<GraficoDiario dias={DIAS} onSelecionar={() => {}} />)
    expect(screen.getByText(/3 dias com gasto · média R\$\s*160,00/)).toBeInTheDocument()
  })

  it('clicar num dia leva a tela para aquele dia', async () => {
    const onSelecionar = vi.fn()
    render(<GraficoDiario dias={DIAS} onSelecionar={onSelecionar} />)
    await userEvent.click(screen.getByRole('button', { name: /21\/jul/ }))
    expect(onSelecionar).toHaveBeenCalledWith('2026-07-21')
  })

  // Entrada de salário numa escala compartilhada esmagaria todas as saídas, e
  // o gráfico deixaria de responder "quando eu gastei".
  it('ignora entradas — o gráfico é de saídas', () => {
    const comSalario = porDia([
      tx({ id: 'a', date: '2026-07-03', amount_cents: 5000 }),
      tx({ id: 'b', date: '2026-07-05', amount_cents: -900000, kind: 'income' }),
      tx({ id: 'c', date: '2026-07-21', amount_cents: 1000 }),
    ])
    render(<GraficoDiario dias={comSalario} onSelecionar={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.queryByText(/9\.000,00/)).not.toBeInTheDocument()
  })

  // O limite era "menos de dois dias não desenha", e derrubava o gráfico
  // sempre que o recorte era um Dia — justamente quando ele tem mais a
  // dizer, desde que o desenho seja o mês em volta (ver `doMesCalendario`).
  // Hoje quem decide a janela é a página; o gráfico desenha o que recebe.
  it('desenha com um dia só — a janela é escolha de quem chama', () => {
    const um = porDia([tx({ id: 'a', date: '2026-07-03', amount_cents: 5000 })])
    render(<GraficoDiario dias={um} onSelecionar={() => {}} />)
    expect(screen.getByRole('button', { name: /3\/jul/ })).toBeInTheDocument()
  })

  it('sem nenhum dia com gasto, não desenha nada', () => {
    const soEntradas = porDia([
      tx({ id: 'a', date: '2026-07-03', amount_cents: -5000, kind: 'income' }),
    ])
    const { container } = render(<GraficoDiario dias={soEntradas} onSelecionar={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// Quando a página amplia a janela para o mês, o gráfico passa a mostrar mais
// do que o recorte da tela — e as duas coisas precisam ficar visíveis: onde
// o usuário está, e que os números do cabeçalho são do mês, não do dia.
describe('GraficoDiario — quando a janela é maior que o recorte', () => {
  it('o dia aberto ganha a cor da marca; o pico continua sendo o débito', () => {
    const { container } = render(
      <GraficoDiario dias={DIAS} onSelecionar={() => {}} destaque="2026-07-03" />,
    )
    const barras = [...container.querySelectorAll('button > span')]
    expect(barras[0]).toHaveClass('bg-marca') // 3/jul, o dia aberto
    expect(barras[1]).toHaveClass('bg-debito') // 14/jul, o pico
    expect(barras[2]).toHaveClass('bg-barra') // 21/jul, campo em repouso
  })

  // Sem o destaque, a faixa de leitura mostraria o pico e quem abriu o dia 3
  // leria o número do dia 14 achando que era o seu.
  it('a faixa de leitura mostra o dia aberto, não o pico', () => {
    // Consulta na FAIXA, e não na tela: "3/jul" também é a ponta esquerda da
    // régua do eixo, e um getByText solto casaria com as duas.
    const { container } = render(
      <GraficoDiario dias={DIAS} onSelecionar={() => {}} destaque="2026-07-03" />,
    )
    const faixa = container.querySelector('.bg-afundado')
    expect(faixa).toHaveTextContent('3/jul')
    expect(faixa).toHaveTextContent(/50,00/)
    expect(faixa).not.toHaveTextContent(/420,00/) // o pico, que ficou de fora
  })

  it('anuncia o que o desenho cobre, para a média não ser lida como a do dia', () => {
    render(<GraficoDiario dias={DIAS} onSelecionar={() => {}} contexto="jul 2026" />)
    expect(screen.getByText(/jul 2026/)).toBeInTheDocument()
  })
})

// O defeito relatado com o app na tela: um pagamento de empréstimo de
// R$ 41.653 num mês de compras de dezenas a poucos milhares. A escala pelo
// máximo deixava as outras 38 barras rentes ao chão — o gráfico virava uma
// régua com um espeto no meio.
describe('GraficoDiario — quando um dia é muito maior que os outros', () => {
  const COM_DISCREPANTE = porDia([
    tx({ id: 'a', date: '2026-07-02', amount_cents: 3000 }),
    tx({ id: 'b', date: '2026-07-04', amount_cents: 4500 }),
    tx({ id: 'c', date: '2026-07-06', amount_cents: 12000 }),
    tx({ id: 'd', date: '2026-07-08', amount_cents: 8000 }),
    tx({ id: 'e', date: '2026-07-10', amount_cents: 5500 }),
    tx({ id: 'f', date: '2026-07-12', amount_cents: 9000 }),
    tx({ id: 'g', date: '2026-07-14', amount_cents: 7000 }),
    tx({ id: 'h', date: '2026-07-16', amount_cents: 4165385 }),
  ])

  it('avisa até onde a escala vai e quantos dias passam dela', () => {
    render(<GraficoDiario dias={COM_DISCREPANTE} onSelecionar={() => {}} />)
    // O teto é a maior barra que não é discrepante (R$ 120,00), e o aviso
    // existe porque uma escala cortada sem declaração é um gráfico que mente.
    expect(screen.getByText(/escala até R\$\s*120,00/i)).toBeInTheDocument()
    expect(screen.getByText(/1 dia acima/i)).toBeInTheDocument()
  })

  // Quem lê por leitor de tela não vê a marca do corte: o nome acessível da
  // barra precisa dizer o mesmo que o desenho.
  it('a barra cortada se declara cortada, com o valor cheio', () => {
    render(<GraficoDiario dias={COM_DISCREPANTE} onSelecionar={() => {}} />)
    const pico = screen.getByRole('button', { name: /16\/jul/ })
    expect(pico).toHaveAccessibleName(/41\.653,85/)
    expect(pico).toHaveAccessibleName(/acima da escala/i)
  })

  it('série sem discrepante não anuncia corte nenhum', () => {
    render(<GraficoDiario dias={DIAS} onSelecionar={() => {}} />)
    expect(screen.queryByText(/escala até/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/acima da escala/i)).not.toBeInTheDocument()
  })
})
