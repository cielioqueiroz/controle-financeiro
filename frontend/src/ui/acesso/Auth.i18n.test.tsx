import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Auth } from './Auth'
import { IdiomaProvider } from '../../i18n/IdiomaProvider'

vi.mock('../../lib/neon', () => ({ neon: null, neonConfigurado: false }))

beforeEach(() => localStorage.setItem('cf:idioma', 'en'))

describe('Auth — i18n', () => {
  it('renderiza a tela de acesso em inglês quando o idioma é en', () => {
    render(
      <IdiomaProvider>
        <Auth onAutenticado={() => {}} />
      </IdiomaProvider>,
    )
    // Subtítulo é único (não colide com o botão/heading "Sign in").
    expect(screen.getByText('Your financial data, yours alone.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@email.com')).toBeInTheDocument()
  })
})
