import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraficoFluxo } from './GraficoFluxo'
import type { PontoMes } from '../../domain/agrupar'

const SERIE: PontoMes[] = [
  { competencia: '2026-05', gastoCents: 120000, entradasCents: 300000 },
  { competencia: '2026-06', gastoCents: 250000, entradasCents: 200000 },
  { competencia: '2026-07', gastoCents: 90000, entradasCents: 180000 },
]

describe('GraficoFluxo', () => {
  it('não desenha nada com menos de dois meses', () => {
    const { container } = render(
      <GraficoFluxo serie={SERIE.slice(0, 1)} ativo="2026-05" onSelecionar={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra entradas, saídas e a leitura acumulada', () => {
    const { container } = render(
      <GraficoFluxo serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />,
    )

    expect(screen.getByText('Entradas')).toBeInTheDocument()
    expect(screen.getByText('Saídas')).toBeInTheDocument()
    expect(screen.getAllByText('Saldo acumulado').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: /fluxo financeiro/i })).toBeInTheDocument()
    expect(container.querySelector('path[stroke-dasharray="5 4"]')).toBeInTheDocument()
    expect(container.querySelector('line[stroke="var(--color-grade-grafico)"]')).toBeInTheDocument()
  })

  it('alterna para o resultado do período', async () => {
    const user = userEvent.setup()
    render(<GraficoFluxo serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox'), 'periodo')

    expect(screen.getByRole('combobox')).toHaveValue('periodo')
    expect(screen.getAllByText('Resultado do período').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: /resultado do período/i })).toBeInTheDocument()
  })

  it('descreve e seleciona o mês clicado', async () => {
    const onSelecionar = vi.fn()
    render(<GraficoFluxo serie={SERIE} ativo="2026-06" onSelecionar={onSelecionar} />)

    const julho = screen.getByRole('button', { name: /jul/i })
    expect(julho).toHaveAccessibleName(/entradas.*1\.800,00.*saídas.*900,00.*resultado.*900,00/i)

    await userEvent.click(julho)

    expect(onSelecionar).toHaveBeenCalledWith('2026-07')
  })
})
