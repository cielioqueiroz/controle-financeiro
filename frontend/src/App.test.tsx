import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { guardarEmailReset, marcarTutorialVisto } from './lib/perfil'

// C1: o fluxo de recuperação de senha (aberto via ?token= na URL) tinha que
// terminar. Antes do fix, `tokenReset` nunca era limpo, então `precisaLogin`
// ficava true para sempre e o card de recuperação continuava sendo forçado
// mesmo depois do usuário já estar logado (ou já ter voltado ao login). Estes
// testes sobem o <App/> de verdade — é o único nível onde a "estranha" é
// observável, porque ela mora na interação entre App e Auth.

// Sessão simulada: começa deslogada e vira logada quando o formulário de
// login manual (Auth) chama signIn.email com sucesso — assim tanto o
// checarSessao do App quanto o próprio ContaMenu (que também consulta
// getSession) enxergam o mesmo estado, sem depender de contar chamadas.
const authMocks = vi.hoisted(() => {
  let sessaoAtiva = false
  let emailVerificado: boolean | undefined = undefined
  return {
    setSessaoAtiva: (v: boolean) => {
      sessaoAtiva = v
    },
    /** O `emailVerified` que o getSession devolve. Fixo de propósito: o SDK da
     *  Neon guarda a sessão em memória e responde do cache até o JWT vencer,
     *  então confirmar o e-mail NÃO muda o que este mock (nem o SDK real)
     *  devolve na mesma aba. Ver o teste do aviso, lá embaixo. */
    setEmailVerificado: (v: boolean | undefined) => {
      emailVerificado = v
    },
    getSession: vi.fn(() =>
      Promise.resolve(
        sessaoAtiva
          ? {
              data: {
                session: {},
                user: {
                  name: null,
                  email: 'alguem@exemplo.com',
                  emailVerified: emailVerificado,
                },
              },
            }
          : { data: null },
      ),
    ),
    signInEmail: vi.fn(() => {
      sessaoAtiva = true
      return Promise.resolve({ error: null })
    }),
  }
})

vi.mock('./lib/neon', () => ({
  neon: {
    auth: {
      getSession: authMocks.getSession,
      signIn: { email: authMocks.signInEmail, social: vi.fn() },
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    // Ao logar, o App puxa as regras aprendidas (persist/regras). Sem `from`
    // no mock isso virava rejeição não tratada e sujava a saída da suíte —
    // nada aqui depende das regras, então vazio basta.
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
  neonConfigurado: true,
}))

vi.mock('./lib/recuperar-senha', () => ({
  pedirLink: vi.fn(),
  redefinirSenha: vi.fn(),
}))

// pdfjs-dist (via domain/pdf/load) espera um DOMMatrix que o jsdom não
// fornece, e nada aqui exercita o fluxo de importar PDF — só a recuperação
// de senha. Mockado para o módulo nem chegar a carregar o pdfjs.
vi.mock('./domain/pdf/load', () => ({
  loadTextItems: vi.fn(),
  PdfProtegidoError: class PdfProtegidoError extends Error {},
}))

// O Painel puxa dados reais (persist/puxar etc.) — fora do escopo deste
// teste, que só quer saber qual card aparece por cima. Um marcador simples
// já prova "saiu do card de recuperação e chegou na tela de logado".
vi.mock('./paginas/Painel', () => ({
  Painel: () => <div>DASHBOARD_STUB</div>,
}))

const { redefinirSenha } = await import('./lib/recuperar-senha')

function comTokenNaUrl() {
  window.history.replaceState({}, '', '/?token=tok123')
}

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.setSessaoAtiva(false)
  authMocks.setEmailVerificado(undefined)
  localStorage.clear()
  marcarTutorialVisto()
  window.history.replaceState({}, '', '/')
})

async function preencherEEnviarNovaSenha(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
  await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
  await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
}

describe('App — saída do fluxo de recuperação de senha (C1)', () => {
  it('após redefinir a senha, volta ao login com o e-mail preenchido e nunca autentica sozinho', async () => {
    const usuario = userEvent.setup()
    guardarEmailReset('alguem@exemplo.com')
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    comTokenNaUrl()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
    await preencherEEnviarNovaSenha(usuario)

    // Trocar a senha não entra na conta: quem redefiniu precisa usar a senha
    // nova, o que também confirma que ela funciona.
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD_STUB')).not.toBeInTheDocument()

    // O e-mail guardado serve só para poupar digitação.
    expect(screen.getByPlaceholderText('seu@email.com')).toHaveValue('alguem@exemplo.com')

    // Asserção negativa explícita: o requisito é "não autentica". Conferir
    // apenas que o card de entrar apareceu deixaria passar um login que
    // acontecesse e falhasse por outro motivo.
    expect(authMocks.signInEmail).not.toHaveBeenCalled()
  })

  it('depois de voltar ao login (sem e-mail salvo para login automático), "Esqueceu a senha?" leva ao pedido de link, não a um token gasto (I1)', async () => {
    const usuario = userEvent.setup()
    // Sem guardarEmailReset: RecuperarSenha não tenta login automático e
    // devolve o usuário para o card de entrar.
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    comTokenNaUrl()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
    await preencherEEnviarNovaSenha(usuario)

    // Volta ao card de entrar — a recuperação terminou.
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()

    // Pedir um NOVO link não pode reabrir o formulário de nova senha com o
    // token já gasto — tem que cair no passo de pedir o link.
    await usuario.click(screen.getByRole('button', { name: /esqueceu a senha/i }))

    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar nova senha' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('nova senha (mín. 8 caracteres)')).not.toBeInTheDocument()
  })

  it('token de reset na URL vence uma sessão já ativa (T1)', async () => {
    // Quem clica no link do e-mail está pedindo explicitamente para
    // redefinir a senha — isso vale mesmo se o navegador já tiver uma
    // sessão logada. O Painel não pode aparecer por cima do formulário
    // de nova senha nesse caso.
    authMocks.setSessaoAtiva(true)
    comTokenNaUrl()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD_STUB')).not.toBeInTheDocument()
  })

  it('após "voltar ao login" sem login automático, entrar manualmente leva ao dashboard (T2)', async () => {
    const usuario = userEvent.setup()
    // Sem guardarEmailReset: RecuperarSenha não tenta login automático e
    // devolve o usuário para o card de entrar — a segunda metade do bug de
    // "estranhamento" original: depois de onVoltar, logar manualmente tem
    // que chegar no dashboard, não re-renderizar o card de login.
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    comTokenNaUrl()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
    await preencherEEnviarNovaSenha(usuario)

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'alguem@exemplo.com')
    await usuario.type(screen.getByPlaceholderText('senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('DASHBOARD_STUB')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  it('reset concluído com sessão ativa de OUTRA conta mostra o card de login, não o dashboard dela (F1)', async () => {
    const usuario = userEvent.setup()
    // O navegador já tem uma sessão ativa (conta A) quando o link de reset
    // é aberto — token vence sessão na entrada (T1). Sem e-mail guardado
    // (o link é de outra conta, B), não há login automático: o fluxo cai
    // no onVoltar sem e-mail.
    authMocks.setSessaoAtiva(true)
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    comTokenNaUrl()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
    await preencherEEnviarNovaSenha(usuario)

    // A sessão da conta A continua tecnicamente válida no servidor, mas o
    // app não pode reaproveitá-la silenciosamente: o toast disse "entre com
    // a senha nova" — a tela tem que exigir esse login explícito, nunca
    // mostrar o dashboard de A por cima.
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD_STUB')).not.toBeInTheDocument()
  })
})

// Bug relatado em 2026-08-13, com o app na tela: a pessoa digitou o código,
// recebeu "E-mail confirmado" — e a faixa continuou lá. Só sumiu depois do F5.
//
// Causa: `@neondatabase/auth` guarda a sessão EM MEMÓRIA e o hook `beforeFetch`
// do `getSession` responde do cache sem tocar na rede (TTL = validade do JWT,
// ~1h). Rechecar a sessão logo após confirmar relia, portanto, exatamente o
// mesmo `emailVerified: false` de antes. O F5 zerava a memória do processo e
// só por isso a verdade do servidor aparecia.
//
// Por isso o mock de sessão aqui NÃO muda depois de confirmar: é o que o SDK
// real faz. Um teste que "atualizasse a sessão" passaria com o bug em pé.
describe('App — aviso de confirmação de e-mail', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('some assim que a pessoa confirma, mesmo com a sessão em cache dizendo o contrário', async () => {
    const usuario = userEvent.setup()
    authMocks.setSessaoAtiva(true)
    authMocks.setEmailVerificado(false)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: true }) })),
    )

    render(<App />)

    await usuario.click(await screen.findByRole('button', { name: 'Confirmar agora' }))
    await usuario.type(screen.getByLabelText(/código/i), '008432')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(screen.queryByText(/Confirme seu e-mail/)).not.toBeInTheDocument(),
    )
  })

  it('continua avisando quando o código é recusado', async () => {
    const usuario = userEvent.setup()
    authMocks.setSessaoAtiva(true)
    authMocks.setEmailVerificado(false)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ code: 'INVALID_OTP' }) })),
    )

    render(<App />)

    await usuario.click(await screen.findByRole('button', { name: 'Confirmar agora' }))
    await usuario.type(screen.getByLabelText(/código/i), '000000')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() => expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled())
    expect(screen.getByText(/Confirme seu e-mail/)).toBeInTheDocument()
  })
})

describe('App — frase do header por estado', () => {
  it('deslogado, mostra a frase da tela de acesso; logado, a de importar', async () => {
    const { unmount } = render(<App />)
    // O nome filtra o heading certo: sem ele, findByRole aceita o primeiro
    // <h1> que existir e resolve antes do checarSessao (assíncrono) trocar
    // de tela — daí ficar esperando pelo texto que ainda vai aparecer.
    expect(
      await screen.findByRole('heading', { level: 1, name: /Seu extrato vira gráfico/ }),
    ).toHaveTextContent('Seu extrato vira gráfico, em menos de um minuto.')
    unmount()

    authMocks.setSessaoAtiva(true)
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: /Importe a fatura/ }),
    ).toHaveTextContent('Importe a fatura, o resto a gente calcula.')
  })
})

describe('sair numa aba derruba as outras', () => {
  /** A "outra aba": mesmo canal, outro objeto — e o navegador faz
   *  exatamente isto entre dois documentos da mesma origem. */
  function outraAbaSai() {
    const c = new BroadcastChannel('cf:sessao')
    c.postMessage('saiu')
    c.close()
  }

  // O defeito relatado: duas abas logadas, sai de uma, a outra continua
  // mostrando dado financeiro de uma conta que ja nao tem sessao. So o F5
  // derrubava.
  it('a aba logada volta ao login quando outra aba sai', async () => {
    authMocks.setSessaoAtiva(true)
    render(<App />)
    expect(await screen.findByText('DASHBOARD_STUB')).toBeInTheDocument()

    outraAbaSai()

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD_STUB')).not.toBeInTheDocument()
  })

  // ⚠️ O que garante que a correcao NAO depende do SDK: o mock continua
  // devolvendo sessao ativa o tempo todo (`setSessaoAtiva(true)` nunca e
  // desfeito aqui), como o cache em memoria do neon-js faria de verdade. Se
  // o App reconsultasse a sessao em vez de derrubar direto, ouviria "ainda
  // logado" e este teste ficaria vermelho.
  it('derruba mesmo com o SDK ainda respondendo "logado"', async () => {
    authMocks.setSessaoAtiva(true)
    render(<App />)
    await screen.findByText('DASHBOARD_STUB')

    outraAbaSai()
    await screen.findByRole('button', { name: 'Entrar' })

    const { data } = await authMocks.getSession()
    expect(data?.session).toBeDefined()
  })

  it('tambem cai pelo localStorage, para quem nao tem BroadcastChannel', async () => {
    authMocks.setSessaoAtiva(true)
    render(<App />)
    await screen.findByText('DASHBOARD_STUB')

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'cf:sessao-saida', newValue: String(Date.now()) }),
    )

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  // Aviso de outro assunto no mesmo canal nao pode derrubar ninguem.
  it('nao cai por mensagem alheia no canal', async () => {
    authMocks.setSessaoAtiva(true)
    render(<App />)
    await screen.findByText('DASHBOARD_STUB')

    const c = new BroadcastChannel('cf:sessao')
    c.postMessage('outra-coisa')
    c.close()
    await new Promise((r) => setTimeout(r, 20))

    expect(screen.getByText('DASHBOARD_STUB')).toBeInTheDocument()
  })
})
