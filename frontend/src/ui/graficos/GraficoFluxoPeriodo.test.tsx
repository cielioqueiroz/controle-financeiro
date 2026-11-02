import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraficoFluxoPeriodo } from './GraficoFluxoPeriodo'
import { fluxoDoPeriodo, type TxFluxo } from '../../domain/fluxo-periodo'
import { DiscretoProvider } from '../../dados/DiscretoProvider'
import { DiscretoToggle } from '../DiscretoToggle'

function tx(over: Partial<TxFluxo>): TxFluxo {
  return { date: '2026-08-05', competencia: '2026-08', amount_cents: 10000, kind: 'expense', category_slug: 'supermercado', bank: 'nubank', ...over }
}

const SLUGS = ['casa', 'supermercado', 'transporte', 'farmacia', 'educacao', 'lazer', 'restaurante', 'assinaturas', 'vestuario', 'pets']

const FLUXO = fluxoDoPeriodo([
  tx({ kind: 'income', bank: 'bradesco', amount_cents: -600000, category_slug: null }),
  tx({ kind: 'income', bank: 'nubank', amount_cents: -200000, category_slug: null }),
  ...SLUGS.map((slug, i) => tx({ category_slug: slug, amount_cents: (SLUGS.length - i) * 10000 })),
  tx({ category_slug: 'beleza', amount_cents: -15000 }),
])!

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('cf:idioma', 'pt')
})

describe('GraficoFluxoPeriodo', () => {
  it('as duas listas nomeiam cada nó, com valor e percentual do total', () => {
    render(<GraficoFluxoPeriodo fluxo={FLUXO} onAbrir={vi.fn()} />)
    const origens = screen.getByRole('region', { name: 'De onde veio' })
    expect(origens).toHaveTextContent('Bradesco')
    expect(origens).toHaveTextContent('Nubank')
    expect(origens).toHaveTextContent('Estornos')
    const destinos = screen.getByRole('region', { name: 'Para onde foi' })
    expect(destinos).toHaveTextContent('Outras 2 categorias')
    expect(destinos).toHaveTextContent('Sobrou')
    expect(screen.getByText('Cada lado soma R$ 8.150,00.')).toBeInTheDocument()
  })

  it('o nome do botão começa pelo texto visível (WCAG 2.5.3)', () => {
    render(<GraficoFluxoPeriodo fluxo={FLUXO} onAbrir={vi.fn()} />)
    const botao = screen.getByRole('button', { name: /^Casa & Moradia/ })
    expect(botao).toHaveAccessibleName(/Ver lançamentos\.$/)
    expect(botao).not.toHaveAttribute('aria-label')
  })

  it('abre a categoria, as outras juntas e os estornos; banco e sobra não são botão', async () => {
    const onAbrir = vi.fn()
    render(<GraficoFluxoPeriodo fluxo={FLUXO} onAbrir={onAbrir} />)
    await userEvent.click(screen.getByRole('button', { name: /^Supermercado/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Outras 2 categorias/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Estornos/ }))
    expect(onAbrir.mock.calls).toEqual([[['supermercado']], [['vestuario', 'pets']], [['beleza']]])
    expect(screen.queryByRole('button', { name: /^Bradesco/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Sobrou/ })).not.toBeInTheDocument()
  })

  it('cada faixa tem a largura do valor, e os dois lados fecham na mesma altura', () => {
    const { container } = render(<GraficoFluxoPeriodo fluxo={FLUXO} onAbrir={vi.fn()} />)
    const altura = (chave: string) => {
      const d = container.querySelector(`[data-faixa="${chave}"]`)!.getAttribute('d')!
      const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
      return n[9] - n[7] // a reta da ponta de chegada: de y até y + altura
    }
    const bradesco = altura('banco:bradesco')
    const nubank = altura('banco:nubank')
    expect(bradesco / nubank).toBeCloseTo(3, 5)
    const esquerda = FLUXO.origens.reduce((s, o) => s + altura(o.tipo === 'banco' ? `banco:${o.bank}` : o.tipo), 0)
    const direita = FLUXO.destinos.reduce((s, d) => s + altura(d.tipo === 'categoria' ? `cat:${d.cat.slug}` : d.tipo), 0)
    expect(esquerda).toBeCloseTo(direita, 5)
  })

  it('mascara os valores no modo discreto', async () => {
    render(<DiscretoProvider><DiscretoToggle /><GraficoFluxoPeriodo fluxo={FLUXO} onAbrir={vi.fn()} /></DiscretoProvider>)
    expect(screen.getAllByText(/6\.000,00/).length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: /[Ee]sconder/ }))
    expect(screen.queryByText(/6\.000,00/)).not.toBeInTheDocument()
    expect(screen.queryByText(/8\.150,00/)).not.toBeInTheDocument()
  })
})
