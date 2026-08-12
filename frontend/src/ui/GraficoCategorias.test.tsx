import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { GraficoCategorias } from './GraficoCategorias'
import { categoria } from '../domain/categorize/categorias'

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
