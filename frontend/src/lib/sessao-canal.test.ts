import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

/** Duas abas do app, mesma origem: sair numa tem que derrubar a outra.
 *
 *  A "outra aba" aqui é um `BroadcastChannel` de mesmo nome criado no
 *  teste — é exatamente o que o navegador faz entre documentos.
 *
 *  ## Por que o módulo é reimportado a cada teste (2026-09-06)
 *
 *  `sessao-canal.ts` guarda **um** canal em variável de módulo, e o
 *  `BroadcastChannel` do Node é do PROCESSO, não do arquivo de teste. Com o
 *  módulo carregado uma vez só, os oito testes compartilhavam o mesmo objeto
 *  de canal: uma mensagem postada num teste e entregue tarde chegava ao
 *  ouvinte do teste SEGUINTE.
 *
 *  Era isso que fazia a suíte falhar de vez em quando na execução completa
 *  (sob disputa de CPU) e passar 3/3 rodando o arquivo sozinho — o sintoma
 *  que o `AGENTS.md` §4.1 registra como "suíte verde não é suíte
 *  determinística". `resetModules` dá a cada teste um canal próprio, então
 *  mensagem atrasada não tem em quem cair. */

const NOME = 'cf:sessao'
const CHAVE_ECO = 'cf:sessao-saida'

const abrir = () => new BroadcastChannel(NOME)
const paraLimpar: Array<() => void> = []

let avisarSaida: typeof import('./sessao-canal').avisarSaida
let ouvirSaida: typeof import('./sessao-canal').ouvirSaida

beforeEach(async () => {
  vi.resetModules()
  ;({ avisarSaida, ouvirSaida } = await import('./sessao-canal'))
})

afterEach(() => {
  for (const f of paraLimpar.splice(0)) f()
  localStorage.clear()
})

/** ⚠️ NÃO use isto para esperar uma mensagem CHEGAR. O canal entrega em
 *  tarefa própria, e `setTimeout(0)` só garante "um ciclo depois" — sob
 *  carga a entrega vem depois dele, e o teste lê antes. Para o caso
 *  positivo, use `vi.waitFor`, que espera o fato em vez de um relógio.
 *
 *  Aqui ele serve ao caso NEGATIVO: dar chance de a mensagem chegar, para
 *  então afirmar que ela não chegou. */
const proximoCiclo = () => new Promise((r) => setTimeout(r, 0))

describe('sessao-canal', () => {
  it('a aba que escuta é avisada quando OUTRA aba sai', async () => {
    const aoSair = vi.fn()
    paraLimpar.push(ouvirSaida(aoSair))

    const outraAba = abrir()
    outraAba.postMessage('saiu')
    // Espera o FATO, não um tick: com `setTimeout(0)` este teste falha
    // assim que a entrega do canal atrasa um ciclo — conferido em
    // 2026-09-06 trocando a espera por `Promise.resolve()`.
    await vi.waitFor(() => expect(aoSair).toHaveBeenCalledTimes(1))
    outraAba.close()
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
