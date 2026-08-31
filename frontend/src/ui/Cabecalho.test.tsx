import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Cabecalho } from './Cabecalho'

// O SDK inteiro, como o resto da suíte. O ContaMenu pede a sessão na
// montagem, e isto é um teste sobre o TÍTULO da página.
vi.mock('../lib/neon', () => ({
  neon: { auth: { getSession: () => Promise.resolve({ data: null }) } },
  neonConfigurado: true,
}))

const usuario = { nome: 'Ciélio Queiroz', email: 'celio@exemplo.com' }

function montar(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Cabecalho
        logado
        usuario={usuario}
        onSair={vi.fn()}
        onVerTutorial={vi.fn()}
        onEditarPerfil={vi.fn()}
        onAbrirAjuda={vi.fn()}
      />
    </MemoryRouter>,
  )
}

describe('Cabecalho — o título é da seção, a saudação é do Painel', () => {
  it('no Painel, saúda', () => {
    montar('/')
    expect(screen.getByText(/Olá, Ciélio/)).toBeInTheDocument()
    expect(screen.getByText(/Importe a fatura/)).toBeInTheDocument()
  })

  // Boas-vindas se dá UMA vez. Repetida em cada seção vira moldura, e o
  // "Importe a fatura, o resto a gente calcula" fica pedindo importação a
  // quem está no meio de outra tarefa.
  it('fora do Painel, NÃO saúda', () => {
    montar('/faturas')
    expect(screen.queryByText(/Olá, Ciélio/)).toBeNull()
    expect(screen.queryByText(/Importe a fatura/)).toBeNull()
  })

  it('fora do Painel, o título é o nome da seção', () => {
    montar('/faturas')
    expect(screen.getByRole('heading', { name: 'Faturas' })).toBeInTheDocument()
  })

  it('cada rota traz o próprio nome', () => {
    for (const [rota, nome] of [
      ['/lancamentos', 'Lançamentos'],
      ['/importar', 'Importação'],
      ['/categorias', 'Categorias'],
      ['/recorrencias', 'Recorrências'],
    ] as const) {
      const { unmount } = montar(rota)
      expect(screen.getByRole('heading', { name: nome })).toBeInTheDocument()
      unmount()
    }
  })

  // O nome vem do dicionário, não de string fixa na rota: era português
  // cravado em `rotas.ts`, e virou o maior texto de cinco das seis telas.
  it('o nome da seção é traduzível', () => {
    montar('/faturas')
    // Em pt o rótulo é "Faturas"; o que se garante aqui é que ele saiu de
    // `t()`, e não do slug — "faturas" minúsculo seria o slug vazando.
    expect(screen.queryByRole('heading', { name: 'faturas' })).toBeNull()
  })
})
