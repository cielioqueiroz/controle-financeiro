import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdiomaProvider } from '../i18n/IdiomaProvider'
import { ThemeToggle } from './ThemeToggle'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('cf:idioma', 'pt')
  // O jsdom não roda o script inline do `index.html`, então a árvore chega
  // aqui SEM `data-theme` — que é exatamente a condição de que este arquivo
  // precisa para provar quem estampa o quê.
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  vi.restoreAllMocks()
})

function montar() {
  return render(
    <IdiomaProvider>
      <ThemeToggle />
    </IdiomaProvider>,
  )
}

describe('ThemeToggle', () => {
  it('nasce com a escolha salva', () => {
    localStorage.setItem('tema', 'light')
    montar()
    expect(screen.getByRole('button', { name: 'Mudar para tema escuro' })).toBeInTheDocument()
  })

  // "Escolha salva > escuro. O sistema não opina" — sem escolha, escuro,
  // mesmo que o navegador do teste prefira claro.
  it('sem escolha salva, nasce escuro', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Mudar para tema claro' })).toBeInTheDocument()
  })

  /** Quem estampa o `data-theme` na montagem é o script inline do
   *  `index.html`, antes da primeira pintura. Este componente não reescreve o
   *  que já está lá: reescrever custava uma segunda renderização a cada
   *  montagem, e era o `setState` em efeito que o oxlint 1.81 recusa. */
  it('não estampa data-theme ao montar: quem faz isso é o index.html', () => {
    localStorage.setItem('tema', 'light')
    montar()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  // Estampar no clique continua sendo daqui, e síncrono: é o que faz as
  // variáveis de cor inverterem sem esperar o próximo quadro.
  it('alternar grava a escolha e estampa o data-theme', async () => {
    const usuario = userEvent.setup()
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Mudar para tema claro' }))
    expect(localStorage.getItem('tema')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Mudar para tema escuro' })).toBeInTheDocument()
  })

  /** A leitura do `localStorage` saiu de um efeito e foi para a PINTURA. Num
   *  navegador com armazenamento bloqueado, sem a guarda, isso deixa de
   *  derrubar só o botão e passa a derrubar a árvore inteira — a tela de
   *  acesso e o cabeçalho, que são os dois lugares onde ele aparece. */
  it('armazenamento bloqueado não derruba a pintura', () => {
    const real = localStorage.getItem.bind(localStorage)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((chave: string) => {
      if (chave === 'tema') throw new Error('armazenamento bloqueado')
      return real(chave)
    })
    montar()
    expect(screen.getByRole('button', { name: 'Mudar para tema claro' })).toBeInTheDocument()
  })
})
