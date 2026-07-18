import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Auth } from './Auth'

// O componente importa o cliente do Neon no topo; no teste ele não existe.
vi.mock('../lib/neon', () => ({ neon: null, neonConfigurado: false }))

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
})
