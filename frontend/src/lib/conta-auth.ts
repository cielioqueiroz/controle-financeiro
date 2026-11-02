import { obterNeon } from './neon'

/** Operações sobre o LOGIN da pessoa, no Neon Auth (better-auth).
 *
 *  Nenhuma lança: cada uma devolve uma chave de tradução para a tela só
 *  exibir, como `recuperar-senha.ts` faz. Os códigos são os do better-auth
 *  1.6, que o servidor gerenciado do Neon repassa no corpo do erro. */

type ErroAuth = { code?: string; status?: number; message?: string } | null | undefined

/** A conta tem senha própria, ou só entra pelo Google?
 *
 *  `null` é "não sei" (rede, SDK). A tela trata como "tem senha", porque o
 *  formulário de troca diz o que deu errado se não tiver, e esconder a troca
 *  de quem tem senha seria o erro pior. */
export async function temSenhaPropria(): Promise<boolean | null> {
  try {
    const neon = await obterNeon()
    if (!neon) return null
    const { data, error } = await neon.auth.listAccounts()
    if (error || !Array.isArray(data)) return null
    return data.some((c: { providerId?: string }) => c.providerId === 'credential')
  } catch {
    return null
  }
}

export type ResultadoTrocaSenha =
  | { ok: true }
  | { ok: false; erro: 'perfil.senha.erroAtual' | 'perfil.senha.erroSemSenha' | 'perfil.senha.erroCurta' | 'perfil.senha.erroServidor' }

/** Troca a senha sabendo a atual. As OUTRAS sessões caem: quem troca a senha
 *  porque desconfia de alguém quer esse alguém fora, não só a senha nova. */
export async function trocarSenha(atual: string, nova: string): Promise<ResultadoTrocaSenha> {
  try {
    const neon = await obterNeon()
    if (!neon) return { ok: false, erro: 'perfil.senha.erroServidor' }
    const { error } = await neon.auth.changePassword({
      currentPassword: atual,
      newPassword: nova,
      revokeOtherSessions: true,
    })
    if (!error) return { ok: true }
    const code = (error as ErroAuth)?.code
    if (code === 'INVALID_PASSWORD') return { ok: false, erro: 'perfil.senha.erroAtual' }
    if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') return { ok: false, erro: 'perfil.senha.erroSemSenha' }
    if (code === 'PASSWORD_TOO_SHORT') return { ok: false, erro: 'perfil.senha.erroCurta' }
    return { ok: false, erro: 'perfil.senha.erroServidor' }
  } catch {
    return { ok: false, erro: 'perfil.senha.erroServidor' }
  }
}

/** O que aconteceu com o LOGIN depois que os dados já foram apagados.
 *
 *  - `excluido`: o servidor apagou o usuário.
 *  - `desligado`: o servidor não oferece exclusão. O better-auth só abre a
 *    rota com `user.deleteUser.enabled`, e o Auth do Neon é gerenciado — não
 *    temos como ligar isso daqui (ver ADR-0023).
 *  - `sessaoVelha`: a rota existe mas exige login recente.
 *  - `falhou`: rede ou erro sem código. */
export type ResultadoExclusaoLogin = 'excluido' | 'desligado' | 'sessaoVelha' | 'falhou'

export async function excluirLogin(): Promise<ResultadoExclusaoLogin> {
  try {
    const neon = await obterNeon()
    if (!neon) return 'falhou'
    const { error } = await neon.auth.deleteUser({})
    if (!error) return 'excluido'
    const e = error as ErroAuth
    if (e?.code === 'SESSION_EXPIRED') return 'sessaoVelha'
    if (e?.status === 404 || e?.code === 'NOT_FOUND') return 'desligado'
    return 'falhou'
  } catch {
    return 'falhou'
  }
}
