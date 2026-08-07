import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErroCarregar } from './ErroCarregar'

describe('ErroCarregar', () => {
  it('mostra a mensagem e um botão de tentar de novo', () => {
    render(<ErroCarregar mensagem="Falha ao carregar" onTentar={() => {}} />)
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument()
  })

  it('o botão chama onTentar', async () => {
    const onTentar = vi.fn()
    const usuario = userEvent.setup()
    render(<ErroCarregar mensagem="x" onTentar={onTentar} />)
    await usuario.click(screen.getByRole('button', { name: /tentar de novo/i }))
    expect(onTentar).toHaveBeenCalledOnce()
  })
})
