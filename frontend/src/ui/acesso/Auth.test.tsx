import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Auth } from './Auth'
import { Notificacoes } from '../Notificacoes'

// O componente importa o cliente do Neon no topo; no teste ele não existe.
vi.mock('../../lib/neon', () => ({ neon: null, neonConfigurado: false }))

// O <Toaster /> normalmente é montado em App.tsx, fora do Auth. Para os
// toasts do sonner aparecerem no DOM do teste, montamos os dois juntos.
function renderComToaster() {
  return render(
    <>
      <Notificacoes />
      <Auth onAutenticado={() => {}} />
    </>,
  )
}

describe('Auth — revelar senha', () => {
  it('começa oculta e alterna para texto ao clicar no olho', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    const senha = screen.getByPlaceholderText(/senha/i)
    expect(senha).toHaveAttribute('type', 'password')

    await usuario.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha).toHaveAttribute('type', 'text')

    await usuario.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(senha).toHaveAttribute('type', 'password')
  })

  // Requisito de verdade do botão do olho: ele é type="button" e NÃO
  // submete o formulário. Alternar o type (password/text) sozinho não prova
  // isso — se o botão virasse type="submit", o clique submeteria o form e o
  // toggle continuaria funcionando do mesmo jeito. Com os campos vazios, uma
  // submissão real dispararia o toast de "Preencha...", então a ausência
  // desse toast é o que de fato comprova que não houve submit.
  it('clicar no olho com campos vazios não submete o formulário (nenhum toast de validação aparece)', async () => {
    const usuario = userEvent.setup()
    renderComToaster()

    await usuario.click(screen.getByRole('button', { name: 'Mostrar senha' }))

    // Dá tempo para o toast aparecer, caso o clique tivesse submetido o form.
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(screen.queryByText(/preencha/i)).not.toBeInTheDocument()
  })
})

describe('Auth — ordem das validações', () => {
  it('no modo criar, com todos os campos vazios, mostra o toast de campos faltando (não o de e-mail inválido)', async () => {
    const usuario = userEvent.setup()
    renderComToaster()

    await usuario.click(screen.getByRole('button', { name: 'Não tem conta? Criar uma' }))
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))

    expect(
      await screen.findByText('Preencha nome, e-mail e senha para criar sua conta.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/não parece válido/i)).not.toBeInTheDocument()
  })

  it('no modo criar, com todos os campos vazios, foca o primeiro campo vazio (nome)', async () => {
    const usuario = userEvent.setup()
    renderComToaster()

    await usuario.click(screen.getByRole('button', { name: 'Não tem conta? Criar uma' }))
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('nome e sobrenome')).toHaveFocus()
    })
  })
})

describe('Auth — porta de entrada da recuperação', () => {
  it('o link "Esqueceu a senha?" troca o card para o pedido de link', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    await usuario.click(screen.getByRole('button', { name: /esqueceu a senha/i }))

    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  it('voltar ao login restaura o formulário de entrar', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    await usuario.click(screen.getByRole('button', { name: /esqueceu a senha/i }))
    await usuario.click(screen.getByRole('button', { name: /voltar ao login/i }))

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('com tokenReset, abre direto no formulário de nova senha', () => {
    render(<Auth onAutenticado={() => {}} tokenReset="tok123" />)

    expect(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)')).toBeInTheDocument()
  })

  // No modo criar, oferecer "esqueceu a senha?" não faz sentido: ainda não
  // existe senha para esquecer.
  it('o link não aparece no modo criar', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    await usuario.click(screen.getByRole('button', { name: 'Não tem conta? Criar uma' }))

    expect(screen.queryByRole('button', { name: /esqueceu a senha/i })).not.toBeInTheDocument()
  })
})
