import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Confirmacao } from './Confirmacao'

function montar(over: Partial<Parameters<typeof Confirmacao>[0]> = {}) {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  const base = {
    aberto: true,
    titulo: 'Apagar tudo?',
    rotuloConfirmar: 'Apagar tudo',
    severidade: 'perigo' as const,
    onConfirmar,
    onCancelar,
  }
  const { rerender } = render(<Confirmacao {...base} {...over} />)
  return {
    onConfirmar,
    onCancelar,
    // Para simular aberto → fechado num mesmo componente montado, em vez
    // de desmontar e montar de novo (o que perderia a distinção entre
    // "abriu depois" e "abriu na montagem" que o foco devolvido depende).
    rerender: (novo: Partial<Parameters<typeof Confirmacao>[0]>) =>
      rerender(<Confirmacao {...base} {...over} {...novo} />),
  }
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

  it('clique no fundo cancela; clique dentro do card não', async () => {
    const usuario = userEvent.setup()
    const { onCancelar } = montar()

    // O título mora dentro do card: clicar nele não pode fechar o diálogo.
    await usuario.click(screen.getByText('Apagar tudo?'))
    expect(onCancelar).not.toHaveBeenCalled()

    // O pai do card é o próprio overlay — clicar nele é clicar no fundo.
    const overlay = screen.getByRole('dialog').parentElement as HTMLElement
    await usuario.click(overlay)
    expect(onCancelar).toHaveBeenCalledTimes(1)
  })

  it('ocupado trava o fundo e o Cancelar, não só o Esc', async () => {
    const usuario = userEvent.setup()
    const { onCancelar } = montar({ ocupado: true })

    // Cancelar fica desabilitado: um clique nele não dispara nada.
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).not.toHaveBeenCalled()

    // O clique no fundo também não pode fechar com a ação em voo — senão
    // o diálogo "fecharia com sucesso" enquanto o apagar tudo ainda roda.
    const overlay = screen.getByRole('dialog').parentElement as HTMLElement
    await usuario.click(overlay)
    expect(onCancelar).not.toHaveBeenCalled()
  })

  it('o foco volta a quem abriu o diálogo, quando ele fecha', async () => {
    render(<button>Abrir diálogo</button>)
    const botaoAbrir = screen.getByRole('button', { name: 'Abrir diálogo' })
    botaoAbrir.focus()
    expect(botaoAbrir).toHaveFocus()

    // Abre com o botão externo focado — é ele que deve ser guardado como
    // "focoAnterior", capturado na transição para aberto, não na montagem.
    const { rerender } = montar({ aberto: false })
    rerender({ aberto: true })
    expect(botaoAbrir).not.toHaveFocus() // o foco entrou no diálogo

    rerender({ aberto: false })
    expect(botaoAbrir).toHaveFocus()
  })
})
