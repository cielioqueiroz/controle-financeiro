import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaldoConta } from './SaldoConta'
import { IdiomaProvider } from '../i18n/IdiomaProvider'
import { definirLocale } from '../domain/normalize/locale'
import { definirIdiomaCategorias } from '../domain/categorize/categorias'

beforeEach(() => localStorage.setItem('cf:idioma', 'en'))
// Restaura o estado de módulo (locale/idioma) que o provider muda em en.
afterEach(() => {
  definirLocale('pt-BR')
  definirIdiomaCategorias('pt')
})

describe('SaldoConta — i18n', () => {
  it('em inglês mostra "Balance" e o valor em formato en (BRL mantido)', () => {
    render(
      <IdiomaProvider>
        <SaldoConta bank="nubank" balanceCents={123456} date="2026-06-30" />
      </IdiomaProvider>,
    )
    expect(screen.getByText('Balance')).toBeInTheDocument()
    expect(screen.getByText(/1,234\.56/)).toBeInTheDocument() // en-US, mas BRL
    expect(screen.getByText(/as of/i)).toBeInTheDocument()
  })
})
