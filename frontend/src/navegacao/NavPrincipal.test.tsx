import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavPrincipal } from './NavPrincipal'
import { ROTAS } from './rotas'

function montar(rota = '/') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <NavPrincipal />
    </MemoryRouter>,
  )
}

describe('NavPrincipal', () => {
  it('oferece um link para cada rota declarada', () => {
    montar()
    for (const r of ROTAS) {
      expect(screen.getByRole('link', { name: r.rotulo })).toHaveAttribute('href', r.caminho)
    }
  })

  it('não oferece Poupança — o sistema é retrospectivo', () => {
    montar()
    expect(screen.queryByRole('link', { name: /poupan/i })).toBeNull()
  })

  // aria-current é o que um leitor de tela usa para dizer "você está aqui".
  // Sem ele a página ativa se distingue só por cor, o que não serve para
  // quem não enxerga a cor.
  it('marca a rota ativa com aria-current', () => {
    montar('/faturas')
    expect(screen.getByRole('link', { name: 'Faturas' })).toHaveAttribute('aria-current', 'page')
  })

  // `end` no NavLink do '/': sem ele o Painel fica ativo em TODAS as rotas,
  // porque '/' é prefixo de qualquer caminho. Seriam dois "você está aqui"
  // na tela ao mesmo tempo.
  it('não marca o Painel como ativo quando se está em outra rota', () => {
    montar('/categorias')
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Categorias' })).toHaveAttribute('aria-current', 'page')
  })

  it('é uma landmark de navegação com nome acessível', () => {
    montar()
    expect(screen.getByRole('navigation', { name: /seções/i })).toBeInTheDocument()
  })
})
