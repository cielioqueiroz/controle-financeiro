import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdiomaProvider, useT } from '../i18n/IdiomaProvider'
import { SeletorIdioma } from './SeletorIdioma'

beforeEach(() => localStorage.setItem('cf:idioma', 'pt'))

function Espia() {
  const { idioma } = useT()
  return <span data-testid="idioma">{idioma}</span>
}

describe('SeletorIdioma', () => {
  it('troca o idioma ao clicar em English', async () => {
    const usuario = userEvent.setup()
    render(
      <IdiomaProvider>
        <SeletorIdioma />
        <Espia />
      </IdiomaProvider>,
    )
    expect(screen.getByTestId('idioma')).toHaveTextContent('pt')
    await usuario.click(screen.getByRole('button', { name: 'English' }))
    expect(screen.getByTestId('idioma')).toHaveTextContent('en')
  })
})
