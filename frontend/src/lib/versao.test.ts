import { describe, expect, it, vi, afterEach } from 'vitest'
import { abaEstaVelha, moduloDaAba } from './versao'

/** A regra que este arquivo guarda: **"não sei" nunca vira "há versão
 *  nova"**. Quem detecta versão nova recarrega a página, e recarregar por
 *  engano é jogar fora o que a pessoa estava fazendo. */

function comScriptNaPagina(src: string | null) {
  document.head.innerHTML = ''
  if (src) {
    const s = document.createElement('script')
    s.type = 'module'
    s.src = src
    document.head.appendChild(s)
  }
}

function servidorRespondendo(html: string, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok, text: () => Promise.resolve(html) })),
  )
}

const htmlCom = (src: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${src}"></script></head></html>`

afterEach(() => {
  vi.unstubAllGlobals()
  document.head.innerHTML = ''
})

describe('detectar que a aba ficou para trás de um deploy', () => {
  it('lê o módulo de entrada que esta aba carregou', () => {
    comScriptNaPagina('/assets/index-AAA111.js')
    expect(moduloDaAba()).toBe('/assets/index-AAA111.js')
  })

  it('acusa quando o servidor publica outro bundle', async () => {
    comScriptNaPagina('/assets/index-VELHO.js')
    servidorRespondendo(htmlCom('/assets/index-NOVO.js'))
    await expect(abaEstaVelha()).resolves.toBe(true)
  })

  it('não acusa quando é o mesmo bundle', async () => {
    comScriptNaPagina('/assets/index-IGUAL.js')
    servidorRespondendo(htmlCom('/assets/index-IGUAL.js'))
    await expect(abaEstaVelha()).resolves.toBe(false)
  })

  // Offline é o caso mais comum de tudo isto rodar num celular. "Não
  // consegui perguntar" tem que ser silêncio, nunca um recarregamento.
  it('sem rede, não acusa nada', async () => {
    comScriptNaPagina('/assets/index-AAA.js')
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Failed to fetch'))))
    await expect(abaEstaVelha()).resolves.toBe(false)
  })

  it('resposta de erro do servidor não acusa nada', async () => {
    comScriptNaPagina('/assets/index-AAA.js')
    servidorRespondendo(htmlCom('/assets/index-BBB.js'), false)
    await expect(abaEstaVelha()).resolves.toBe(false)
  })

  // Um proxy, uma página de captive portal, um HTML de erro: nada disso é
  // um deploy novo.
  it('HTML sem módulo de entrada não acusa nada', async () => {
    comScriptNaPagina('/assets/index-AAA.js')
    servidorRespondendo('<html><body>erro do provedor</body></html>')
    await expect(abaEstaVelha()).resolves.toBe(false)
  })

  it('sem script na página, não há o que comparar', async () => {
    comScriptNaPagina(null)
    servidorRespondendo(htmlCom('/assets/index-NOVO.js'))
    await expect(abaEstaVelha()).resolves.toBe(false)
  })
})
