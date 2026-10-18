import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeletorEmoji } from './SeletorEmoji'

describe('SeletorEmoji', () => {
  it('busca sem acentos e fecha com Escape devolvendo o foco', async () => {
    const usuario = userEvent.setup()
    render(<SeletorEmoji valor="🏷️" rotulo="Ícone" aoSelecionar={() => {}} />)
    await usuario.click(screen.getByRole('button', { name: 'Ícone' }))
    const busca = screen.getByRole('searchbox')
    expect(busca).toHaveFocus()
    await usuario.type(busca, 'farmacia')
    expect(screen.getByRole('button', { name: 'Ícone: 💊' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ícone: 🏠' })).not.toBeInTheDocument()
    await usuario.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ícone' })).toHaveFocus()
  })

  it('navega pelas opções com setas e fecha ao clicar fora', async () => {
    const usuario = userEvent.setup()
    render(<SeletorEmoji valor="🏷️" rotulo="Ícone" aoSelecionar={() => {}} />)
    await usuario.click(screen.getByRole('button', { name: 'Ícone' }))
    await usuario.tab()
    expect(screen.getByRole('button', { name: 'Ícone: 🛒' })).toHaveFocus()
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Ícone: 🥖' })).toHaveFocus()
    await usuario.click(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
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

  it('mantém o seletor pesquisável sem violações críticas ou graves', async () => {
    const usuario = userEvent.setup()
    render(<SeletorEmoji valor="🏷️" rotulo="Ícone" aoSelecionar={() => {}} />)
    await usuario.click(screen.getByRole('button', { name: 'Ícone' }))
    await usuario.type(screen.getByRole('searchbox'), 'farmacia')

    const resultado = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: {
        // O teste monta só o componente, não o index.html que fornece estes metadados.
        'document-title': { enabled: false },
        'html-has-lang': { enabled: false },
      },
    })
    expect(resultado.violations.filter((violacao) =>
      violacao.impact === 'critical' || violacao.impact === 'serious',
    )).toEqual([])
  })
})
