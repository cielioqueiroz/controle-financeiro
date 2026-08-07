import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tutorial } from './Tutorial'
import { IdiomaProvider } from '../i18n/IdiomaProvider'
import { definirLocale } from '../domain/normalize/locale'
import { definirIdiomaCategorias } from '../domain/categorize/categorias'

beforeEach(() => localStorage.setItem('cf:idioma', 'en'))
// Restaura o estado de módulo (locale/idioma) que o provider muda em en.
afterEach(() => {
  definirLocale('pt-BR')
  definirIdiomaCategorias('pt')
})

describe('Tutorial — i18n', () => {
  it('em inglês: saudação, boas-vindas e navegação para o 1º passo', async () => {
    const user = userEvent.setup()
    render(
      <IdiomaProvider>
        <Tutorial nome="Ana" onFechar={vi.fn()} />
      </IdiomaProvider>,
    )
    expect(screen.getByText('Hi, Ana!')).toBeInTheDocument()
    expect(screen.getByText(/Welcome to your finances/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "Let's go" }))
    expect(await screen.findByText('Import a PDF')).toBeInTheDocument()
    expect(screen.getByText('1/6')).toBeInTheDocument()
  })

  it('sem provider continua em pt (default do contexto)', () => {
    localStorage.removeItem('cf:idioma')
    render(<Tutorial nome="Ana" onFechar={vi.fn()} />)
    expect(screen.getByText('Olá, Ana!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pular' })).toBeInTheDocument()
  })
})
