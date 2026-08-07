import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Confirmacao } from './Confirmacao'
import { Tutorial } from './Tutorial'

afterEach(cleanup)

/** Sobe o componente dentro de um ancestral com `transform`, que é
 *  exatamente o que o `.surgir` do dashboard faz. Sem portal, o overlay
 *  `fixed inset-0` gruda NESTE div em vez da janela — foi o bug real
 *  (medido no Chromium: 1248×18px em vez de 1280×800). */
function dentroDeUmTransform(ui: React.ReactNode) {
  const ancestral = document.createElement('div')
  ancestral.style.transform = 'translateY(0px)'
  ancestral.setAttribute('data-ancestral', 'sim')
  document.body.appendChild(ancestral)
  return render(ui, { container: ancestral })
}

describe('modais são pendurados no body (portal)', () => {
  it('Confirmacao escapa do ancestral com transform', () => {
    dentroDeUmTransform(
      <Confirmacao
        aberto
        titulo="Apagar?"
        rotuloConfirmar="Apagar"
        severidade="perigo"
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    )
    const dialogo = screen.getByRole('dialog')
    const overlay = dialogo.parentElement!
    expect(overlay.className).toContain('fixed')
    // O overlay é filho direto do body — não do container com transform.
    expect(overlay.parentElement).toBe(document.body)
    expect(overlay.closest('[data-ancestral]')).toBeNull()
  })

  it('Tutorial escapa do ancestral com transform', () => {
    dentroDeUmTransform(<Tutorial nome="Ana" onFechar={vi.fn()} />)
    const overlay = screen.getByText('Olá, Ana!').closest('.fixed')!
    expect(overlay.parentElement).toBe(document.body)
    expect(overlay.closest('[data-ancestral]')).toBeNull()
  })

  it('o véu usa a cor de véu (escura nos dois temas), não a da página', () => {
    dentroDeUmTransform(
      <Confirmacao
        aberto
        titulo="x"
        rotuloConfirmar="ok"
        severidade="normal"
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    )
    const overlay = screen.getByRole('dialog').parentElement!
    // bg-carvao-950 é creme no tema claro: não escureceria nada.
    expect(overlay.className).toContain('bg-veu/')
    expect(overlay.className).not.toContain('bg-carvao-950/')
  })

  it('trava a rolagem do fundo enquanto aberto e devolve ao fechar', () => {
    const { unmount } = dentroDeUmTransform(
      <Confirmacao
        aberto
        titulo="x"
        rotuloConfirmar="ok"
        severidade="normal"
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
