import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraficoCompromissos } from './GraficoCompromissos'
import type { MesFuturo } from '../persist/agrupar'

const mes = (competencia: string, faixas: [string, number][]): MesFuturo => ({
  competencia,
  totalCents: faixas.reduce((a, [, c]) => a + c, 0),
  itens: faixas.map(([bank, amountCents], i) => ({
    descricao: `COMPRA ${i}`,
    parcela: 2,
    total: 6,
    amountCents,
    bank,
  })),
  porBanco: faixas.map(([bank, totalCents]) => ({ bank, totalCents })),
})

const MESES = [
  mes('2026-08', [
    ['bradesco', 250000],
    ['nubank', 91571],
  ]),
  mes('2026-09', [['nubank', 135976]]),
  mes('2026-10', [['bradesco', 101325]]),
  mes('2026-11', [['nubank', 4316]]),
]

describe('GraficoCompromissos', () => {
  it('desenha uma barra por mês futuro, em ordem', () => {
    render(<GraficoCompromissos meses={MESES} onSelecionar={vi.fn()} />)
    const barras = screen.getAllByRole('button')
    expect(barras).toHaveLength(4)
    expect(barras[0]).toHaveAccessibleName(/ago/i)
    expect(barras[3]).toHaveAccessibleName(/nov/i)
  })

  // A cor do banco é a resposta de "de qual cartão é essa parcela" sem
  // precisar abrir o mês — o motivo de o gráfico existir. Sai do catálogo
  // (`BANCOS`), a mesma fonte dos pontinhos do filtro e dos cards de saldo,
  // para o roxo do Nubank e o vermelho do Bradesco serem os mesmos na tela
  // inteira.
  it('pinta cada faixa com a cor institucional do banco', () => {
    const { container } = render(<GraficoCompromissos meses={MESES} onSelecionar={vi.fn()} />)
    const nubank = container.querySelector<HTMLElement>('[data-banco="nubank"]')
    const bradesco = container.querySelector<HTMLElement>('[data-banco="bradesco"]')
    expect(nubank).toHaveStyle({ backgroundColor: '#820AD1' })
    expect(bradesco).toHaveStyle({ backgroundColor: '#CC092F' })
  })

  it('a legenda nomeia só os bancos que aparecem no gráfico', () => {
    render(<GraficoCompromissos meses={MESES} onSelecionar={vi.fn()} />)
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    expect(screen.getByText('Bradesco')).toBeInTheDocument()
    expect(screen.queryByText('Banco do Brasil')).not.toBeInTheDocument()
  })

  // Quem lê por leitor de tela não vê a pilha: o nome acessível carrega a
  // mesma divisão que as cores mostram.
  it('o nome acessível traz o total do mês e a parte de cada banco', () => {
    render(<GraficoCompromissos meses={MESES} onSelecionar={vi.fn()} />)
    const agosto = screen.getByRole('button', { name: /ago/i })
    expect(agosto).toHaveAccessibleName(/3\.415,71/)
    expect(agosto).toHaveAccessibleName(/Bradesco.*2\.500,00/)
    expect(agosto).toHaveAccessibleName(/Nubank.*915,71/)
  })

  it('mostra os valores do mês sob o cursor', async () => {
    render(<GraficoCompromissos meses={MESES} onSelecionar={vi.fn()} />)
    await userEvent.hover(screen.getByRole('button', { name: /set/i }))
    // Duas vezes de propósito: o total do mês e, ao lado, de quem ele é.
    expect(screen.getAllByText(/1\.359,76/)).toHaveLength(2)
    expect(screen.getByText(/Nubank R\$\s*1\.359,76/)).toBeInTheDocument()
  })

  it('clicar num mês entrega a competência', async () => {
    const onSelecionar = vi.fn()
    render(<GraficoCompromissos meses={MESES} onSelecionar={onSelecionar} />)
    await userEvent.click(screen.getByRole('button', { name: /out/i }))
    expect(onSelecionar).toHaveBeenCalledWith('2026-10')
  })

  // Uma barra sozinha não compara nada — é o número do card ao lado,
  // desenhado, ocupando meia tela.
  it('não desenha nada com menos de dois meses', () => {
    const { container } = render(
      <GraficoCompromissos meses={MESES.slice(0, 1)} onSelecionar={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
