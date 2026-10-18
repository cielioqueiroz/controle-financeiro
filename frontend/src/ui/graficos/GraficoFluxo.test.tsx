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
  it('não pinta de déficit o acumulado positivo de um mês com resultado negativo', async () => {
    render(<GraficoFluxo serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Resultado acumulado' }))
    expect(screen.getByText('1.300,00')).not.toHaveClass('text-debito')
    await userEvent.click(screen.getByRole('button', { name: 'Resultado do período' }))
    expect(screen.getByText(/^[−-]?\s*500,00$/)).toHaveClass('text-debito')
  })

  it('usa o centro de cada faixa de mês tanto na linha quanto na interação', () => {
    const { container } = render(<GraficoFluxo serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)
    expect(screen.getByRole('img')).toHaveAttribute('preserveAspectRatio', 'none')
    const linha = container.querySelector('path[data-serie="resultado"]')!
    expect(linha.getAttribute('d')).toMatch(/^M 120\.00 .*L 360\.00 .*L 600\.00 /)
  })

  it('permite fixar uma série por toque e desfazer pelo teclado', async () => {
    render(<GraficoFluxo serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)
    const entrada = screen.getByRole('button', { name: 'Entradas' })
    await userEvent.click(entrada)
    expect(entrada).toHaveAttribute('aria-pressed', 'true')
    await userEvent.keyboard('{Enter}')
    expect(entrada).toHaveAttribute('aria-pressed', 'false')
  })

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
    expect(screen.getAllByText('Resultado do período').length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: /fluxo financeiro/i })).toBeInTheDocument()
    expect(container.querySelector('path[data-serie="resultado"][stroke-dasharray="6 4"]')).toBeInTheDocument()
    expect(container.querySelectorAll('rect[data-serie="entrada"]')).toHaveLength(3)
    expect(container.querySelectorAll('rect[data-serie="saida"]')).toHaveLength(3)
    expect(container.querySelector('line[stroke="var(--color-grade-grafico)"]')).toBeInTheDocument()
  })

  it('alterna para o resultado do período', async () => {
    const user = userEvent.setup()
    render(<GraficoFluxo serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Resultado do período' }))

    expect(screen.getByRole('button', { name: 'Resultado do período' })).toHaveAttribute('aria-pressed', 'true')
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

  it('permite ver o acumulado com lacunas sem tratar mês ausente como zero', async () => {
    const onSelecionar = vi.fn()
    const { container } = render(<GraficoFluxo
      serie={[SERIE[0], SERIE[2]]}
      competencias={['2026-05', '2026-06', '2026-07']}
      ativo="2026-07" onSelecionar={onSelecionar}
    />)
    const acumulado = screen.getByRole('button', { name: 'Resultado acumulado' })
    expect(acumulado).toBeEnabled()
    await userEvent.click(acumulado)
    expect(acumulado).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/meses documentados.*não são tratadas como zero/i)).toBeVisible()
    const junho = screen.getByRole('button', { name: /jun: sem transações importadas/i })
    expect(junho).toHaveAttribute('aria-disabled', 'true')
    await userEvent.hover(junho)
    expect(screen.getByText('Sem transações importadas')).toBeVisible()
    await userEvent.click(junho)
    expect(onSelecionar).not.toHaveBeenCalled()
    const linha = container.querySelector('path[data-serie="acumulado"]')!
    // Dois movimentos independentes: não há segmento ligando maio a julho.
    expect(linha.getAttribute('d')?.match(/M /g)).toHaveLength(2)
    expect(linha.getAttribute('d')).not.toContain('L ')
    const area = container.querySelector('path[fill="var(--color-grafico-acumulado)"]')!
    expect(area.getAttribute('d')?.match(/Z/g)).toHaveLength(2)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: /jul: entradas/i }))
    expect(onSelecionar).toHaveBeenCalledWith('2026-07')
  })

  it('mantém os dois modos disponíveis quando todos os meses da janela têm dados', async () => {
    render(<GraficoFluxo serie={SERIE} competencias={SERIE.map((p) => p.competencia)} ativo="2026-07" onSelecionar={vi.fn()} />)
    const acumulado = screen.getByRole('button', { name: 'Resultado acumulado' })
    expect(acumulado).toBeEnabled()
    await userEvent.click(acumulado)
    expect(acumulado).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: /resultado acumulado/i })).toBeInTheDocument()
  })
})
