import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

/** Este componente **recarrega a página sozinho**, e recarregar no meio de
 *  uma importação joga fora o PDF já lido e conferido — o estado que o
 *  `ImportacaoProvider` existe para proteger. Era a peça de maior alcance
 *  sem um único teste.
 *
 *  O que se guarda aqui é a decisão: recarregar calado só quando não há
 *  nada em andamento; caso contrário, avisar e deixar quem tem o extrato
 *  aberto decidir. */

const versao = vi.hoisted(() => ({ velha: false }))
const importacao = vi.hoisted(() => ({ fase: 'ocioso' as string | null }))

vi.mock('../lib/versao', () => ({
  abaEstaVelha: async () => versao.velha,
}))

vi.mock('../dados/ImportacaoProvider', () => ({
  useImportacaoOpcional: () =>
    importacao.fase === null ? undefined : { estado: { fase: importacao.fase } },
}))

const toastInfo = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { info: toastInfo } }))

const { AvisoVersaoNova } = await import('./AvisoVersaoNova')

let recarregou: ReturnType<typeof vi.fn>

beforeEach(() => {
  versao.velha = false
  importacao.fase = 'ocioso'
  toastInfo.mockClear()
  sessionStorage.clear()

  recarregou = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: recarregou },
  })
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const voltarParaAba = () => document.dispatchEvent(new Event('visibilitychange'))

describe('quando não há nada em andamento', () => {
  /** Na montagem NÃO confere: a aba acabou de carregar o que o servidor
   *  tinha. O caso é a aba que ficou aberta e volta depois de um deploy. */
  it('não confere nada ao montar', async () => {
    versao.velha = true
    render(<AvisoVersaoNova />)

    await new Promise((r) => setTimeout(r, 10))
    expect(recarregou).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('ao voltar para a aba com versão nova, recarrega sozinho', async () => {
    versao.velha = true
    render(<AvisoVersaoNova />)

    voltarParaAba()

    await waitFor(() => expect(recarregou).toHaveBeenCalledTimes(1))
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('sem versão nova, não faz nada', async () => {
    versao.velha = false
    render(<AvisoVersaoNova />)

    voltarParaAba()

    await new Promise((r) => setTimeout(r, 10))
    expect(recarregou).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })
})

describe('quando há documento na tela', () => {
  /** A regra que este arquivo existe para proteger. */
  for (const fase of ['lendo', 'pronto']) {
    it(`fase "${fase}" NÃO recarrega — avisa e deixa a pessoa decidir`, async () => {
      versao.velha = true
      importacao.fase = fase
      render(<AvisoVersaoNova />)

      voltarParaAba()

      await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1))
      expect(recarregou).not.toHaveBeenCalled()
    })
  }

  it('o aviso não some sozinho e traz o botão de atualizar', async () => {
    versao.velha = true
    importacao.fase = 'lendo'
    render(<AvisoVersaoNova />)

    voltarParaAba()

    await waitFor(() => expect(toastInfo).toHaveBeenCalled())
    const [, opcoes] = toastInfo.mock.calls[0]
    expect(opcoes.duration).toBe(Infinity)
    expect(opcoes.id).toBe('versao-nova')
    expect(opcoes.action.label).toBeTruthy()
  })

  it('o botão do aviso recarrega', async () => {
    versao.velha = true
    importacao.fase = 'pronto'
    render(<AvisoVersaoNova />)

    voltarParaAba()

    await waitFor(() => expect(toastInfo).toHaveBeenCalled())
    toastInfo.mock.calls[0][1].action.onClick()
    expect(recarregou).toHaveBeenCalledTimes(1)
  })
})

describe('guarda contra laço', () => {
  /** Se a detecção errasse — um HTML servido por cache intermediário, um
   *  deploy no meio da checagem —, a aba recarregaria sem parar. Uma vez
   *  por aba; da segunda em diante quem decide é a pessoa. */
  it('já tendo recarregado uma vez, passa a só avisar', async () => {
    versao.velha = true
    sessionStorage.setItem('cf:recarregou-por-versao', '1')
    render(<AvisoVersaoNova />)

    voltarParaAba()

    await waitFor(() => expect(toastInfo).toHaveBeenCalledTimes(1))
    expect(recarregou).not.toHaveBeenCalled()
  })

  it('marca a recarga antes de recarregar, para a marca sobreviver ao reload', async () => {
    versao.velha = true
    render(<AvisoVersaoNova />)

    voltarParaAba()

    await waitFor(() => expect(recarregou).toHaveBeenCalled())
    expect(sessionStorage.getItem('cf:recarregou-por-versao')).toBe('1')
  })
})

describe('não confere a cada alt-tab', () => {
  /** `visibilitychange` dispara a cada troca de foco; sem o intervalo, quem
   *  trabalha com duas janelas geraria uma requisição por alternância. */
  it('duas voltas seguidas rendem uma checagem só', async () => {
    versao.velha = true
    importacao.fase = 'lendo' // fica no toast, que é contável
    render(<AvisoVersaoNova />)

    voltarParaAba()
    voltarParaAba()
    voltarParaAba()

    await waitFor(() => expect(toastInfo).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(toastInfo).toHaveBeenCalledTimes(1)
  })
})

describe('aba em segundo plano', () => {
  it('não confere quando a aba não está visível', async () => {
    versao.velha = true
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    render(<AvisoVersaoNova />)

    voltarParaAba()

    await new Promise((r) => setTimeout(r, 10))
    expect(recarregou).not.toHaveBeenCalled()
    expect(toastInfo).not.toHaveBeenCalled()
  })
})
