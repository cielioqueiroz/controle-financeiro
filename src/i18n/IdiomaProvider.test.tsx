import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdiomaProvider, useT } from './IdiomaProvider'

beforeEach(() => localStorage.clear())

function Sonda() {
  const { t, setIdioma, idioma } = useT()
  return (
    <div>
      <p>{t('auth.entrar')}</p>
      <span data-testid="idioma">{idioma}</span>
      <button onClick={() => setIdioma('en')}>trocar</button>
    </div>
  )
}

describe('useT', () => {
  it('sem provider, cai no default pt', () => {
    render(<Sonda />)
    expect(screen.getByText('Entrar')).toBeInTheDocument()
  })

  it('troca de idioma reflete no t', async () => {
    // jsdom reporta navigator.language 'en-US'; fixamos pt para começar nele.
    localStorage.setItem('cf:idioma', 'pt')
    const usuario = userEvent.setup()
    render(
      <IdiomaProvider>
        <Sonda />
      </IdiomaProvider>,
    )
    expect(screen.getByText('Entrar')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'trocar' }))
    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByTestId('idioma')).toHaveTextContent('en')
  })
})
