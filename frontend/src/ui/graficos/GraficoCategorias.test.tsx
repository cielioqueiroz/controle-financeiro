import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { GraficoCategorias } from './GraficoCategorias'
import { categoria } from '../../domain/categorize/categorias'

const CATEGORIAS = [
  { cat: categoria('supermercado'), totalCents: 60000, contagem: 8 },
  { cat: categoria('transporte'), totalCents: 40000, contagem: 3 },
]

function Url() {
  const { pathname, search } = useLocation()
  return <span data-testid="url">{pathname + search}</span>
}

function abrir(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <GraficoCategorias categorias={CATEGORIAS} totalCents={100000} />
      <Url />
    </MemoryRouter>,
  )
}

describe('GraficoCategorias — o clique na fatia', () => {
  // WCAG 2.5.3: o nome começa pelo que está escrito no botão. O rótulo à
  // parte ("Supermercado: R$ 600,00, 60% do total") trocava o nome inteiro.
  it('o nome do botão é o texto visível, com o resto da frase depois', () => {
    abrir('/')
    const botao = screen.getByRole('button', { name: /^Supermercado/ })
    expect(botao).not.toHaveAttribute('aria-label')
    expect(botao).toHaveAccessibleName(/^Supermercado R\$\s600,00 60% do total\. Ver lançamentos\.$/)
  })

  it('mantém a identidade das fatias ao inverter o ranking', () => {
    const { container, rerender } = render(<MemoryRouter><GraficoCategorias categorias={CATEGORIAS} totalCents={100000} /></MemoryRouter>)
    const cores = [...container.querySelectorAll('circle')].map((el) => el.getAttribute('stroke'))
    rerender(<MemoryRouter><GraficoCategorias categorias={[...CATEGORIAS].reverse()} totalCents={100000} /></MemoryRouter>)
    expect([...container.querySelectorAll('circle')].map((el) => el.getAttribute('stroke'))).toEqual([...cores].reverse())
  })

  // O clique montava `?cat=…` na mão e ia embora com o resto: quem clicava
  // numa fatia de MAIO, filtrando por um banco, caía em lançamentos de outro
  // mês (a página sem `ref` se ancora na competência mais recente) e com todos
  // os bancos. O gráfico mostrava uma coisa e o clique levava a outra.
  it('leva o recorte inteiro junto — período, mês e banco', async () => {
    abrir('/?p=mes&ref=2026-05&banco=nubank')

    await userEvent.click(screen.getByRole('button', { name: /Supermercado/ }))

    const url = screen.getByTestId('url').textContent ?? ''
    expect(url).toContain('/lancamentos')
    expect(url).toContain('cat=supermercado')
    expect(url).toContain('ref=2026-05')
    expect(url).toContain('banco=nubank')
  })

  it('em Dia, preserva o dia exato do recorte', async () => {
    abrir('/?p=dia&ref=2026-05-17')

    await userEvent.click(screen.getByRole('button', { name: /Transporte/ }))

    const url = screen.getByTestId('url').textContent ?? ''
    expect(url).toContain('p=dia')
    expect(url).toContain('ref=2026-05-17')
  })

  it('o rótulo do botão diz o que o clique faz, não só a cor da fatia', () => {
    // A cor sozinha nunca identifica: quem não distingue as duas cores
    // vizinhas precisa do nome, do valor e do percentual no nome acessível.
    abrir('/?ref=2026-05')
    expect(
      screen.getByRole('button', { name: /Supermercado.*600,00.*60% do total.*Ver lançamentos/ }),
    ).toBeInTheDocument()
  })
})

// U1 da auditoria de 30/10: com um empréstimo de 91% do mês, o donut virava um
// anel de uma cor só e o resto do mês não aparecia. (Aluguel aqui porque a
// categoria `dividas` chega com outro PR; o gráfico não olha o slug.)
describe('GraficoCategorias — uma categoria dominando', () => {
  const DOMINADO = [
    { cat: categoria('aluguel'), totalCents: 4_165_385, contagem: 1 },
    { cat: categoria('supermercado'), totalCents: 109_180, contagem: 9 },
    { cat: categoria('farmacia'), totalCents: 31_680, contagem: 2 },
    { cat: categoria('transporte'), totalCents: 21_670, contagem: 5 },
    { cat: categoria('padaria'), totalCents: 14_520, contagem: 6 },
  ]
  const total = DOMINADO.reduce((a, c) => a + c.totalCents, 0)

  function desenhar(categorias = DOMINADO, totalCents = total) {
    return render(<MemoryRouter><GraficoCategorias categorias={categorias} totalCents={totalCents} /></MemoryRouter>)
  }

  it('troca o donut pelas barras e diz por quê', () => {
    const { container } = desenhar()
    expect(container.querySelector('circle')).toBeNull()
    expect(screen.getByText(/^Aluguel é 96% do gasto/)).toBeInTheDocument()
  })

  it('corta a barra da dominante e declara a escala', () => {
    const { container } = desenhar()
    expect(container.querySelectorAll('[data-cortada]')).toHaveLength(1)
    expect(screen.getByText(/1 categoria acima/)).toBeInTheDocument()
  })

  it('o percentual continua sendo do total', () => {
    desenhar()
    expect(screen.getByRole('button', { name: /Aluguel.*96% do total/ })).toBeInTheDocument()
  })

  it('60/40 continua donut', () => {
    const { container } = desenhar(CATEGORIAS, 100000)
    expect(container.querySelectorAll('circle')).toHaveLength(2)
    expect(container.querySelector('[data-cortada]')).toBeNull()
  })
})
