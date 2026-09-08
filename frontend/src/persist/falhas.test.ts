import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso } from './neon-falso'

const dublê = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../lib/neon', () => {
  // `obterNeon` devolve o MESMO cliente que `neon`: o SDK passou a
  // entrar por import dinamico, e quem consome espera uma promessa.
  const mod = {
  get neon() {
    return dublê.cliente
  },
  neonConfigurado: true,
}
  // `Object.assign`, e não spread: o spread LÊ o getter na hora, e vários
  // destes mocks usam getter justamente para ser preguiçosos — ler cedo
  // estoura em "Cannot access X before initialization".
  return Object.assign(mod, { obterNeon: () => Promise.resolve(mod.neon) })
})

vi.mock('../lib/versao', () => ({
  moduloDaAba: () => '/assets/index-ABC123.js',
}))

const { registrarFalha, navegadorReduzido, esquecerFalhasRegistradas } =
  await import('./falhas')

let falso: ReturnType<typeof criarNeonFalso>
const montar = () => {
  falso = criarNeonFalso()
  dublê.cliente = falso.cliente
  return falso
}

const gravadas = () => falso.gravadasEm('client_errors')

beforeEach(() => {
  dublê.cliente = null
  esquecerFalhasRegistradas()
  window.history.replaceState({}, '', '/lancamentos')
})

describe('o que é registrado', () => {
  it('grava classe, contexto, rota, versão e navegador', async () => {
    montar()
    registrarFalha(new TypeError('qualquer coisa'), 'historico')
    await Promise.resolve()

    expect(gravadas()[0]).toEqual({
      classe: 'TypeError',
      contexto: 'historico',
      rota: '/lancamentos',
      versao: '/assets/index-ABC123.js',
      navegador: expect.any(String),
    })
  })

  /** Erro tipado do app: a classe SOZINHA já nomeia o defeito, e é por isso
   *  que dá para não guardar mensagem nenhuma. */
  it('a classe de um erro tipado do app chega inteira', async () => {
    montar()
    class PdfProtegidoError extends Error {
      constructor() {
        super('senha')
        this.name = 'PdfProtegidoError'
      }
    }
    registrarFalha(new PdfProtegidoError(), 'importacao')
    await Promise.resolve()

    expect(gravadas()[0].classe).toBe('PdfProtegidoError')
  })

  it('aguenta o que não é Error', async () => {
    montar()
    registrarFalha('string solta', 'desconhecido')
    registrarFalha(null, 'edicao')
    await Promise.resolve()

    expect(gravadas().map((l) => l.classe)).toEqual(['string', 'object'])
  })
})

describe('o que NUNCA é registrado', () => {
  /** A promessa do produto é "seus dados financeiros, só seus". Um registro
   *  de falha com descrição, valor ou nome de arquivo dentro criaria um lugar
   *  novo onde o dado sensível mora — pior que não registrar. */
  it('não grava a mensagem do erro', async () => {
    montar()
    registrarFalha(new Error('PADARIA DO ZE — R$ 5,00 — extrato-JOAO.pdf'), 'importacao')
    await Promise.resolve()

    const linha = JSON.stringify(gravadas()[0])
    expect(linha).not.toMatch(/PADARIA/)
    expect(linha).not.toMatch(/JOAO/)
    expect(linha).not.toMatch(/5,00/)
  })

  it('não grava a pilha', async () => {
    montar()
    registrarFalha(new Error('x'), 'historico')
    await Promise.resolve()

    expect(gravadas()[0]).not.toHaveProperty('stack')
    expect(JSON.stringify(gravadas()[0])).not.toMatch(/at \w+/)
  })

  /** A query string carrega os FILTROS, e o filtro de busca é texto que a
   *  pessoa digitou — nome de estabelecimento, de gente, de remédio. */
  it('grava o pathname sem a query string', async () => {
    montar()
    window.history.replaceState({}, '', '/lancamentos?busca=psiquiatra&banco=nubank')

    registrarFalha(new Error('x'), 'historico')
    await Promise.resolve()

    expect(gravadas()[0].rota).toBe('/lancamentos')
    expect(JSON.stringify(gravadas()[0])).not.toMatch(/psiquiatra/)
  })

  it('não manda user_id — quem preenche é o default do banco', async () => {
    montar()
    registrarFalha(new Error('x'), 'historico')
    await Promise.resolve()

    expect(gravadas()[0]).not.toHaveProperty('user_id')
  })
})

describe('navegadorReduzido', () => {
  /** Nunca o user agent cru: ele é longo e identifica o aparelho com
   *  precisão desnecessária. O que responde "por que quebrou nela e não em
   *  mim" é o motor e a versão maior. */
  const casos: Array<[string, string]> = [
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Safari 16 · iOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 13; SM-A125M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36',
      'Chrome 118 · Android',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'Edge 130 · Windows',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0', 'Firefox 121 · Linux'],
  ]

  for (const [ua, esperado] of casos) {
    it(esperado, () => expect(navegadorReduzido(ua)).toBe(esperado))
  }

  it('não devolve o UA cru nem pedaço dele', () => {
    const ua = casos[0][0]
    expect(navegadorReduzido(ua)).not.toContain('AppleWebKit')
    expect(navegadorReduzido(ua)).not.toContain('15E148')
  })

  it('navegador desconhecido não quebra', () => {
    expect(navegadorReduzido('Robô/1.0')).toMatch(/desconhecido/)
  })
})

describe('não vira a própria falha', () => {
  /** Um erro dentro de um `render` vira laço. Sem teto, o registro escreveria
   *  milhares de linhas iguais. */
  it('a mesma falha na mesma rota é gravada UMA vez', async () => {
    montar()
    for (let i = 0; i < 5; i++) registrarFalha(new TypeError('x'), 'historico')
    await Promise.resolve()

    expect(gravadas()).toHaveLength(1)
  })

  it('falhas diferentes no mesmo contexto são gravadas separadamente', async () => {
    montar()
    registrarFalha(new TypeError('x'), 'historico')
    registrarFalha(new RangeError('y'), 'historico')
    await Promise.resolve()

    expect(gravadas().map((l) => l.classe)).toEqual(['TypeError', 'RangeError'])
  })

  it('respeita o teto por aba', async () => {
    montar()
    for (let i = 0; i < 40; i++) {
      const e = new Error('x')
      e.name = `Erro${i}`
      registrarFalha(e, 'historico')
    }
    await Promise.resolve()

    expect(gravadas()).toHaveLength(20)
  })

  /** É chamada de dentro de tratadores de erro: falhar aqui empilharia um
   *  segundo defeito por cima do primeiro, na hora em que a pessoa já está
   *  vendo um problema. */
  it('erro do banco ao registrar morre calado', async () => {
    falso = criarNeonFalso({
      erro: { tabela: 'client_errors', op: 'insert', message: 'RLS negou' },
    })
    dublê.cliente = falso.cliente

    expect(() => registrarFalha(new Error('x'), 'historico')).not.toThrow()
    await Promise.resolve()
  })

  it('sem cliente Neon não faz nada e não quebra', () => {
    dublê.cliente = null
    expect(() => registrarFalha(new Error('x'), 'historico')).not.toThrow()
  })
})

describe('não bloqueia quem chama', () => {
  /** A tela de erro aparece na hora; o registro segue por fora. Uma ida ao
   *  banco entre o erro e o aviso seria uma tela travada em cima de uma
   *  falha. */
  it('devolve sem esperar o banco', () => {
    montar()
    const r = registrarFalha(new Error('x'), 'historico')
    expect(r).toBeUndefined()
  })
})
