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
  it('após redefinir a senha com login automático, o app para de mostrar o formulário de nova senha', async () => {
    const usuario = userEvent.setup()
    guardarEmailReset('alguem@exemplo.com')
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    comTokenNaUrl()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
    await preencherEEnviarNovaSenha(usuario)

    // O login automático teve sucesso: a tela de logado (aqui, o Dashboard
    // dublado) precisa assumir — e o formulário de nova senha não pode
    // continuar por baixo do toast de boas-vindas.
    expect(await screen.findByText('DASHBOARD_STUB')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar nova senha' })).not.toBeInTheDocument()
    expect(screen.queryByText('Nova senha')).not.toBeInTheDocument()
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
})
