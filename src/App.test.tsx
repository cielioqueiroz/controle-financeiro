import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { guardarEmailReset, marcarTutorialVisto } from './lib/perfil'

// C1: o fluxo de recuperação de senha (aberto via ?token= na URL) tinha que
// terminar. Antes do fix, `tokenReset` nunca era limpo, então `precisaLogin`
// ficava true para sempre e o card de recuperação continuava sendo forçado
// mesmo depois do usuário já estar logado (ou já ter voltado ao login). Estes
// testes sobem o <App/> de verdade — é o único nível onde a "estranha" é
// observável, porque ela mora na interação entre App e Auth.

// Sessão simulada: começa deslogada e vira logada quando o auto-login do
// RecuperarSenha chama signIn.email com sucesso — assim tanto o
// checarSessao do App quanto o próprio ContaMenu (que também consulta
// getSession) enxergam o mesmo estado, sem depender de contar chamadas.
const authMocks = vi.hoisted(() => {
  let sessaoAtiva = false
  return {
    setSessaoAtiva: (v: boolean) => {
      sessaoAtiva = v
    },
    getSession: vi.fn(() =>
      Promise.resolve(
        sessaoAtiva
          ? { data: { session: {}, user: { name: null, email: 'alguem@exemplo.com' } } }
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

// O Dashboard puxa dados reais (persist/puxar etc.) — fora do escopo deste
// teste, que só quer saber qual card aparece por cima. Um marcador simples
// já prova "saiu do card de recuperação e chegou na tela de logado".
vi.mock('./ui/Dashboard', () => ({
  Dashboard: () => <div>DASHBOARD_STUB</div>,
}))

const { redefinirSenha } = await import('./lib/recuperar-senha')

function comTokenNaUrl() {
  window.history.replaceState({}, '', '/?token=tok123')
}

beforeEach(() => {
  vi.clearAllMocks()
  authMocks.setSessaoAtiva(false)
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
    // sessão logada. O Dashboard não pode aparecer por cima do formulário
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
