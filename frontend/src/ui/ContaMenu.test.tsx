import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContaMenu } from './ContaMenu'

vi.mock('../lib/neon', () => ({
  neon: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: {}, user: { email: 'alguem@exemplo.com' } } }),
      ),
    },
  },
  neonConfigurado: true,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

async function abrirMenu(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: 'Conta' }))
}

describe('ContaMenu', () => {
  // O diálogo de confirmação mora num portal (<body>), fora do `ref` do
  // menu. O fechar-ao-clicar-fora olhava só o `ref`, então o mousedown no
  // próprio botão "Sair" contava como clique fora: o menu (e o diálogo
  // junto) sumiam antes do clique chegar, e não dava para sair da conta.
  it('confirmar no diálogo chama onSair, mesmo ele vivendo num portal', async () => {
    const usuario = userEvent.setup()
    const onSair = vi.fn()
    render(<ContaMenu onSair={onSair} />)

    await abrirMenu(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Sair da conta' }))
    await usuario.click(screen.getByRole('button', { name: 'Sair' }))

    expect(onSair).toHaveBeenCalledTimes(1)
  })

  it('clique fora ainda fecha o menu quando não há diálogo aberto', async () => {
    const usuario = userEvent.setup()
    render(<ContaMenu onSair={vi.fn()} />)

    await abrirMenu(usuario)
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeInTheDocument()

    await usuario.click(document.body)
    // O menu sai com animação (AnimatePresence), então some um tique depois.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Sair da conta' })).not.toBeInTheDocument(),
    )
  })

  it('cancelar volta ao menu sem sair', async () => {
    const usuario = userEvent.setup()
    const onSair = vi.fn()
    render(<ContaMenu onSair={onSair} />)

    await abrirMenu(usuario)
    await usuario.click(screen.getByRole('button', { name: 'Sair da conta' }))
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onSair).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeInTheDocument()
  })
})
