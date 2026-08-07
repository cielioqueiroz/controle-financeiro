import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraficoEvolucao } from './GraficoEvolucao'
import type { PontoMes } from '../persist/agrupar'

const SERIE: PontoMes[] = [
  { competencia: '2026-05', gastoCents: 120000, entradasCents: 300000 },
  { competencia: '2026-06', gastoCents: 250000, entradasCents: 200000 },
  { competencia: '2026-07', gastoCents: 90000, entradasCents: 180000 },
]

describe('GraficoEvolucao', () => {
  // Com um mês só não existe evolução — desenhar uma barra sozinha sugere
  // uma tendência que o dado não tem.
  it('não desenha nada com menos de dois meses', () => {
    const { container } = render(
      <GraficoEvolucao serie={SERIE.slice(0, 1)} ativo="2026-05" onSelecionar={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  // Duas séries exigem legenda: sem ela a identidade fica só na cor, que
  // não é informação para quem não a distingue.
  it('traz legenda das duas séries', () => {
    render(<GraficoEvolucao serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)
    expect(screen.getByText('Entradas')).toBeInTheDocument()
    expect(screen.getByText('Saídas')).toBeInTheDocument()
  })

  // O nome acessível carrega os DOIS valores: quem usa leitor de tela não
  // vê altura de barra.
  it('descreve entradas e saídas de cada mês no nome acessível', () => {
    render(<GraficoEvolucao serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)
    const junho = screen.getByRole('button', { name: /jun/i })
    expect(junho).toHaveAccessibleName(/entradas.*2\.000,00/i)
    expect(junho).toHaveAccessibleName(/saídas.*2\.500,00/i)
  })

  it('leva ao mês clicado', async () => {
    const onSelecionar = vi.fn()
    render(<GraficoEvolucao serie={SERIE} ativo="2026-06" onSelecionar={onSelecionar} />)
    await userEvent.click(screen.getByRole('button', { name: /jul/i }))
    expect(onSelecionar).toHaveBeenCalledWith('2026-07')
  })

  it('mostra os valores do mês sob o cursor', async () => {
    render(<GraficoEvolucao serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)
    expect(screen.getByText(/escolha um mês/i)).toBeInTheDocument()
    await userEvent.hover(screen.getByRole('button', { name: /mai/i }))
    // Maio: entradas 3.000,00 e saídas 1.200,00 → sobra 1.800,00
    expect(screen.getByText(/\+3\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/−1\.200,00/)).toBeInTheDocument()
  })

  // O mês que a tela está mostrando precisa se distinguir por algo além da
  // cor do rótulo.
  it('marca o mês ativo com aria-current', () => {
    render(<GraficoEvolucao serie={SERIE} ativo="2026-06" onSelecionar={vi.fn()} />)
    expect(screen.getByRole('button', { name: /jun/i })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /jul/i })).not.toHaveAttribute('aria-current')
  })
})

// NOTA sobre o que NÃO está testado aqui: a invariante de "uma escala só
// para as duas séries" (o `max` compartilhado). Ela é o que impede a barra
// de entrada de junho, de R$ 2.000, de parecer MAIOR que a de saída, de
// R$ 2.500 — o defeito clássico de gráfico de dois eixos.
//
// Não há teste porque as alturas são aplicadas pelo `motion` via animação, e
// em jsdom o valor final não chega ao DOM: qualquer asserção aqui passaria
// com a escala certa E com a errada. Um teste assim é pior que nenhum.
// Verificar isso pede navegador de verdade.
