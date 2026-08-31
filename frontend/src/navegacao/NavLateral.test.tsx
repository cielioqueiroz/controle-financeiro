import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavLateral } from './NavLateral'
import { ROTAS } from './rotas'

// O SDK inteiro, como o resto da suíte faz. O ContaMenu do rodapé da calha
// pede a sessão na montagem; sem o dublê isso seria uma ida à rede dentro
// de um teste de navegação.
vi.mock('../lib/neon', () => ({
  neon: { auth: { getSession: () => Promise.resolve({ data: null }) } },
  neonConfigurado: true,
}))

const USUARIO = { nome: 'Célio Queiroz', email: 'celio@exemplo.com' }

function montar(
  rota = '/',
  usuario: { nome: string | null; email: string | null } | null = USUARIO,
) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <NavLateral
        usuario={usuario}
        onSair={vi.fn()}
        onVerTutorial={vi.fn()}
        onEditarPerfil={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe('NavLateral', () => {
  it('oferece um link para cada rota declarada', () => {
    montar()
    for (const r of ROTAS) {
      expect(screen.getByRole('link', { name: r.rotulo })).toHaveAttribute('href', r.caminho)
    }
  })

  // aria-current é o que um leitor de tela usa para dizer "você está aqui".
  // A calha de 3px e a cor da marca não servem para quem não enxerga a cor.
  it('marca a rota ativa com aria-current', () => {
    montar('/faturas')
    expect(screen.getByRole('link', { name: 'Faturas' })).toHaveAttribute('aria-current', 'page')
  })

  // `end` no NavLink do '/': sem ele o Painel fica ativo em TODAS as rotas,
  // porque '/' é prefixo de qualquer caminho.
  it('não marca o Painel como ativo quando se está em outra rota', () => {
    montar('/recorrencias')
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current')
  })

  // Mesmo contrato da NavPrincipal, e pelo mesmo motivo: as páginas são
  // vistas diferentes do MESMO recorte. Uma calha que perdesse a query
  // devolveria o bug que a barra horizontal já não tem.
  it('leva o recorte da URL junto ao trocar de página', () => {
    montar('/?p=dia&ref=2026-05-17&banco=nubank')
    for (const r of ROTAS) {
      expect(screen.getByRole('link', { name: r.rotulo })).toHaveAttribute(
        'href',
        `${r.caminho}?p=dia&ref=2026-05-17&banco=nubank`,
      )
    }
  })

  it('mostra o nome da pessoa e as iniciais dele no rodapé', () => {
    montar()
    expect(screen.getByText('Célio Queiroz')).toBeInTheDocument()
    expect(screen.getByText('CQ')).toBeInTheDocument()
  })

  // Sem nome (conta recém-criada, ou login por Google que não devolveu o
  // nome) o avatar não pode sair vazio nem escrever "null".
  it('sem nome, não escreve nome nenhum no avatar', () => {
    montar('/', { nome: null, email: 'celio@exemplo.com' })
    expect(screen.queryByText('null')).toBeNull()
    expect(screen.queryByText('CQ')).toBeNull()
  })

  it('é uma landmark de navegação com nome acessível', () => {
    montar()
    expect(screen.getByRole('navigation', { name: /seções/i })).toBeInTheDocument()
  })
})
