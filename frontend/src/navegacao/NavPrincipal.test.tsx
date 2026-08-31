import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavPrincipal } from './NavPrincipal'
import { ROTAS } from './rotas'
// O rótulo saiu de `rotas.ts` e virou chave de dicionário: o teste lê a
// mesma fonte da verdade que a tela, em vez de repetir as seis palavras.
import { pt } from './../i18n/dicionarios/pt'

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
      expect(screen.getByRole('link', { name: pt[r.chave] })).toHaveAttribute('href', r.caminho)
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

  // As sete páginas são vistas DIFERENTES DO MESMO recorte — é o motivo de
  // `useRecorte` existir. Navegar para o caminho pelado jogava o recorte
  // fora: quem estava em maio filtrando o Nubank clicava em "Lançamentos" e
  // caía na competência mais recente, com todos os bancos, sem nada na tela
  // explicando a troca.
  it('leva o recorte da URL junto ao trocar de página', () => {
    montar('/?p=dia&ref=2026-05-17&banco=nubank')
    for (const r of ROTAS) {
      expect(screen.getByRole('link', { name: pt[r.chave] })).toHaveAttribute(
        'href',
        `${r.caminho}?p=dia&ref=2026-05-17&banco=nubank`,
      )
    }
  })

  it('sem recorte na URL, o link continua limpo', () => {
    montar('/')
    expect(screen.getByRole('link', { name: 'Faturas' })).toHaveAttribute('href', '/faturas')
  })
})
