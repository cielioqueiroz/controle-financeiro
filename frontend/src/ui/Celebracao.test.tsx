import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Celebracao } from './Celebracao'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Celebracao', () => {
  it('não renderiza nada quando inativo', () => {
    render(<Celebracao ativo={false} onFim={vi.fn()} />)
    expect(screen.queryByTestId('celebracao')).not.toBeInTheDocument()
  })

  it('quando ativo, mostra o confete e chama onFim ao terminar', () => {
    const onFim = vi.fn()
    render(<Celebracao ativo onFim={onFim} />)
    const camada = screen.getByTestId('celebracao')
    expect(camada).toBeInTheDocument()
    // Decoração não pode capturar clique nem entrar no fluxo de rolagem.
    expect(camada.className).toContain('pointer-events-none')
    expect(camada.className).toContain('fixed')
    expect(camada.className).toContain('overflow-hidden')

    expect(onFim).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(2200))
    expect(onFim).toHaveBeenCalledTimes(1)
  })
})
