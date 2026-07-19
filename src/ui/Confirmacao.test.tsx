import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Confirmacao } from './Confirmacao'

function montar(over: Partial<Parameters<typeof Confirmacao>[0]> = {}) {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  render(
    <Confirmacao
      aberto
      titulo="Apagar tudo?"
      rotuloConfirmar="Apagar tudo"
      severidade="perigo"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
      {...over}
    />,
  )
  return { onConfirmar, onCancelar }
}

describe('Confirmacao', () => {
  it('fechado não renderiza nada', () => {
    montar({ aberto: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('o foco inicial cai no Cancelar quando a severidade é perigo', () => {
    montar()
    // Quem aperta Enter por reflexo não pode apagar nada.
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('Esc cancela e não confirma', async () => {
    const usuario = userEvent.setup()
    const { onConfirmar, onCancelar } = montar()
    await usuario.keyboard('{Escape}')
    expect(onCancelar).toHaveBeenCalled()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('só o botão de confirmar dispara onConfirmar', async () => {
    const usuario = userEvent.setup()
    const { onConfirmar } = montar()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onConfirmar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Apagar tudo' }))
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })

  it('ocupado trava o botão e Esc não fecha — a ação já está em curso', async () => {
    const usuario = userEvent.setup()
    const { onCancelar } = montar({ ocupado: true })
    expect(screen.getByRole('button', { name: 'Apagar tudo' })).toBeDisabled()
    await usuario.keyboard('{Escape}')
    expect(onCancelar).not.toHaveBeenCalled()
  })

  it('o diálogo é anunciado com o próprio título', () => {
    montar()
    expect(screen.getByRole('dialog', { name: 'Apagar tudo?' })).toBeInTheDocument()
  })
})
