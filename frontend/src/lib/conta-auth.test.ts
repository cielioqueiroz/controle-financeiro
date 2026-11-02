import { describe, it, expect, vi, beforeEach } from 'vitest'

const auth = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  changePassword: vi.fn(),
  deleteUser: vi.fn(),
}))
vi.mock('./neon', () => ({
  neonConfigurado: true,
  obterNeon: () => Promise.resolve({ auth }),
}))

const { temSenhaPropria, trocarSenha, excluirLogin } = await import('./conta-auth')

beforeEach(() => {
  vi.resetAllMocks()
})

describe('temSenhaPropria', () => {
  it('conta com credencial tem senha', async () => {
    auth.listAccounts.mockResolvedValue({ data: [{ providerId: 'google' }, { providerId: 'credential' }], error: null })
    expect(await temSenhaPropria()).toBe(true)
  })

  it('conta só do Google não tem', async () => {
    auth.listAccounts.mockResolvedValue({ data: [{ providerId: 'google' }], error: null })
    expect(await temSenhaPropria()).toBe(false)
  })

  it('erro é "não sei", não "não tem"', async () => {
    auth.listAccounts.mockResolvedValue({ data: null, error: { status: 500 } })
    expect(await temSenhaPropria()).toBeNull()
  })
})

describe('trocarSenha', () => {
  it('derruba as outras sessões ao trocar', async () => {
    auth.changePassword.mockResolvedValue({ data: {}, error: null })
    expect(await trocarSenha('velha', 'nova-senha')).toEqual({ ok: true })
    expect(auth.changePassword).toHaveBeenCalledWith({
      currentPassword: 'velha',
      newPassword: 'nova-senha',
      revokeOtherSessions: true,
    })
  })

  it.each([
    ['INVALID_PASSWORD', 'perfil.senha.erroAtual'],
    ['CREDENTIAL_ACCOUNT_NOT_FOUND', 'perfil.senha.erroSemSenha'],
    ['PASSWORD_TOO_SHORT', 'perfil.senha.erroCurta'],
    ['OUTRA_COISA', 'perfil.senha.erroServidor'],
  ])('código %s vira %s', async (code, chave) => {
    auth.changePassword.mockResolvedValue({ data: null, error: { code } })
    expect(await trocarSenha('a', 'b')).toEqual({ ok: false, erro: chave })
  })

  it('rede fora não lança', async () => {
    auth.changePassword.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await trocarSenha('a', 'b')).toEqual({ ok: false, erro: 'perfil.senha.erroServidor' })
  })
})

describe('excluirLogin', () => {
  it('servidor aceitou', async () => {
    auth.deleteUser.mockResolvedValue({ data: {}, error: null })
    expect(await excluirLogin()).toBe('excluido')
  })

  /** O better-auth responde 404 quando `deleteUser.enabled` está desligado. */
  it('rota desligada no servidor', async () => {
    auth.deleteUser.mockResolvedValue({ data: null, error: { status: 404 } })
    expect(await excluirLogin()).toBe('desligado')
  })

  it('sessão velha demais', async () => {
    auth.deleteUser.mockResolvedValue({ data: null, error: { status: 400, code: 'SESSION_EXPIRED' } })
    expect(await excluirLogin()).toBe('sessaoVelha')
  })

  it('rede fora', async () => {
    auth.deleteUser.mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await excluirLogin()).toBe('falhou')
  })
})
