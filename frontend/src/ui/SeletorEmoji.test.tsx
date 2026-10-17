import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeletorEmoji } from './SeletorEmoji'

describe('SeletorEmoji', () => {
  it('abre opções e atualiza o ícone ao escolher um emoji', async () => {
    const usuario = userEvent.setup()
    let selecionado = '🏷️'
    const aoSelecionar = (emoji: string) => { selecionado = emoji }
    const { rerender } = render(<SeletorEmoji valor={selecionado} rotulo="Ícone" aoSelecionar={aoSelecionar} />)

    await usuario.click(screen.getByRole('button', { name: 'Ícone' }))
    expect(screen.getByRole('dialog', { name: 'Ícone' })).toBeVisible()
    await usuario.click(screen.getByRole('button', { name: 'Ícone: 🏠' }))
    expect(selecionado).toBe('🏠')
    expect(screen.getByRole('button', { name: 'Ícone' })).toHaveFocus()
    rerender(<SeletorEmoji valor={selecionado} rotulo="Ícone" aoSelecionar={aoSelecionar} />)
    expect(screen.getByRole('button', { name: 'Ícone' })).toHaveTextContent('🏠')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
