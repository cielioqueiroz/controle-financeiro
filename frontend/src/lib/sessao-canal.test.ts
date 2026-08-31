import { describe, it, expect, vi, afterEach } from 'vitest'
import { avisarSaida, ouvirSaida } from './sessao-canal'

/** Duas abas do app, mesma origem: sair numa tem que derrubar a outra.
 *
 *  A "outra aba" aqui é um `BroadcastChannel` de mesmo nome criado no
 *  teste — é exatamente o que o navegador faz entre documentos. */

const NOME = 'cf:sessao'
const CHAVE_ECO = 'cf:sessao-saida'

const abrir = () => new BroadcastChannel(NOME)
const paraLimpar: Array<() => void> = []

afterEach(() => {
  for (const f of paraLimpar.splice(0)) f()
  localStorage.clear()
})

/** O canal entrega em microtarefa; sem a espera o teste lê antes. */
const proximoCiclo = () => new Promise((r) => setTimeout(r, 0))

describe('sessao-canal', () => {
  it('a aba que escuta é avisada quando OUTRA aba sai', async () => {
    const aoSair = vi.fn()
    paraLimpar.push(ouvirSaida(aoSair))

    const outraAba = abrir()
    outraAba.postMessage('saiu')
    await proximoCiclo()
    outraAba.close()

    expect(aoSair).toHaveBeenCalledTimes(1)
  })

  // O erro clássico: postar num canal recém-criado em vez do que escuta.
  // Ali o navegador entrega a mensagem ao proprio app (sao dois objetos), e
  // a aba que clicou "sair" se avisa sozinha — dois toasts e uma corrida
  // com o `signOut` que ela mesma acabou de fazer.
  it('quem avisa NÃO é avisado', async () => {
    const aoSair = vi.fn()
    paraLimpar.push(ouvirSaida(aoSair))

    avisarSaida()
    await proximoCiclo()

    expect(aoSair).not.toHaveBeenCalled()
  })

  it('mensagem de outro assunto no mesmo canal é ignorada', async () => {
    const aoSair = vi.fn()
    paraLimpar.push(ouvirSaida(aoSair))

    const outraAba = abrir()
    outraAba.postMessage('qualquer-outra-coisa')
    await proximoCiclo()
    outraAba.close()

    expect(aoSair).not.toHaveBeenCalled()
  })

  // A rede de segurança para navegador sem BroadcastChannel. O `storage`
  // nunca dispara na aba que escreveu, então o navegador entrega isto só a
  // quem precisa ouvir.
  it('também ouve pelo localStorage, para quem não tem BroadcastChannel', () => {
    const aoSair = vi.fn()
    paraLimpar.push(ouvirSaida(aoSair))

    window.dispatchEvent(
      new StorageEvent('storage', { key: CHAVE_ECO, newValue: String(Date.now()) }),
    )

    expect(aoSair).toHaveBeenCalledTimes(1)
  })

  it('não confunde outra chave do localStorage com a saída', () => {
    const aoSair = vi.fn()
    paraLimpar.push(ouvirSaida(aoSair))

    window.dispatchEvent(new StorageEvent('storage', { key: 'cf:idioma', newValue: 'en' }))

    expect(aoSair).not.toHaveBeenCalled()
  })

  // Limpar o localStorage dispara `storage` com `newValue` nulo em toda
  // aba. Tratar isso como saída deslogaria todo mundo quando alguém
  // limpasse o armazenamento do navegador por outro motivo.
  it('a limpeza do armazenamento não é uma saída', () => {
    const aoSair = vi.fn()
    paraLimpar.push(ouvirSaida(aoSair))

    window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_ECO, newValue: null }))

    expect(aoSair).not.toHaveBeenCalled()
  })

  it('parar de ouvir para de verdade', async () => {
    const aoSair = vi.fn()
    const parar = ouvirSaida(aoSair)
    parar()

    const outraAba = abrir()
    outraAba.postMessage('saiu')
    await proximoCiclo()
    outraAba.close()
    window.dispatchEvent(
      new StorageEvent('storage', { key: CHAVE_ECO, newValue: String(Date.now()) }),
    )

    expect(aoSair).not.toHaveBeenCalled()
  })

  // O carimbo de tempo não é enfeite: `storage` só dispara quando o VALOR
  // muda, então um valor fixo ("saiu") não acordaria a segunda saída.
  // ⚠️ Relógio FALSO, e não `Date.now()` de verdade: sem ele as duas saídas
  // podem cair no mesmo milissegundo e o teste passa por acaso — verde que
  // depende da velocidade da máquina é o que este projeto já registrou como
  // "suíte verde não é suíte determinística".
  it('cada saída grava um valor diferente', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-08-31T10:00:00Z'))
      avisarSaida()
      const primeira = localStorage.getItem(CHAVE_ECO)

      vi.setSystemTime(new Date('2026-08-31T10:00:01Z'))
      avisarSaida()

      expect(localStorage.getItem(CHAVE_ECO)).not.toBe(primeira)
    } finally {
      vi.useRealTimers()
    }
  })
})
