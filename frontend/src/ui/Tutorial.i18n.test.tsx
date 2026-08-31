import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tutorial } from './Tutorial'
import { IdiomaProvider } from '../i18n/IdiomaProvider'
import { definirLocale } from '../domain/normalize/locale'
import { definirIdiomaCategorias } from '../domain/categorize/categorias'
import { en } from '../i18n/dicionarios/en'
import { pt } from '../i18n/dicionarios/pt'

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
    // ⚠️ Contra o DICIONÁRIO, não contra a frase escrita à mão aqui. Este
    // teste prova que o tutorial está traduzido; a copy dele é reescrita
    // sempre que o app muda (aconteceu em 12/08 e de novo em 31/08), e um
    // literal aqui transforma cada reescrita numa quebra de teste que não
    // achou defeito nenhum.
    expect(screen.getByText('Hi, Ana!')).toBeInTheDocument()
    expect(screen.getByText(en['tutorial.boasVindas'])).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en['tutorial.pular'] })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en['tutorial.boraVer'] }))
    expect(await screen.findByText(en['tutorial.p1t'])).toBeInTheDocument()
    expect(screen.getByText('1/6')).toBeInTheDocument()

    // E a prova de que é TRADUÇÃO, e não o pt vazando: a frase em inglês não
    // pode ser igual à portuguesa.
    expect(en['tutorial.boasVindas']).not.toBe(pt['tutorial.boasVindas'])
  })

  it('sem provider continua em pt (default do contexto)', () => {
    localStorage.removeItem('cf:idioma')
    render(<Tutorial nome="Ana" onFechar={vi.fn()} />)
    expect(screen.getByText('Olá, Ana!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: pt['tutorial.pular'] })).toBeInTheDocument()
  })
})
