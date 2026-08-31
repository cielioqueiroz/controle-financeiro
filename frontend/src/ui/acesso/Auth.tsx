import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { neon } from '../../lib/neon'
import { salvarApelido } from '../../lib/perfil'
import { enviarCodigo } from '../../lib/confirmar-email'
import { chaveDeErro } from '../../lib/erro-usuario'
import { Marca } from '../Marca'
import { MoedaLogo } from '../MoedaLogo'
import { RecuperarSenha } from './RecuperarSenha'
import { camposFaltando, emailValido, type CampoAcesso } from './auth-validacao'
import { juntarCampos } from './mensagem-campos'
import { CampoSenha } from './CampoSenha'
import { CAMPO, BOTAO_PRIMARIO } from './estilos-campo'
import { useT } from '../../i18n/IdiomaProvider'
import { localeAtual } from '../../domain/normalize/locale'

type Props = {
  /** Chamado após login/cadastro bem-sucedido, para o App re-checar a sessão. */
  onAutenticado: () => void
  /** Token vindo do link do e-mail. Presente → abre direto a nova senha. */
  tokenReset?: string | null
  /** Chamado quando o fluxo de recuperação termina — hoje só existe uma
   *  saída (voltou ao login, com a senha já redefinida) — para o App soltar
   *  o token guardado e o card de recuperação não voltar a ser oferecido
   *  depois. */
  onRecuperacaoConcluida?: () => void
}

/** Login e cadastro. E-mail/senha + Google, via Neon Auth (Better Auth).
 *  Mantém a tela grafite/Fraunces; só a engrenagem por baixo mudou de
 *  Supabase para neon-js. */
export function Auth({ onAutenticado, tokenReset, onRecuperacaoConcluida }: Props) {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'recuperar'>(
    tokenReset ? 'recuperar' : 'entrar',
  )
  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verSenha, setVerSenha] = useState(false)
  const { t } = useT()

  // Uma ref por campo obrigatório, para focar o primeiro que estiver vazio.
  const refs: Record<CampoAcesso, React.RefObject<HTMLInputElement | null>> = {
    nome: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    senha: useRef<HTMLInputElement>(null),
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault()

    // submeter só roda a partir do <form>, que não existe no modo recuperar.
    // Esse estado é inalcançável hoje; a guarda só documenta a invariante e
    // recusa em silêncio (não há form para reagir) caso a JSX algum dia deixe
    // o form escapar do seu branch.
    if (modo === 'recuperar') return

    // Validação primeiro: campo vazio sempre vence formato inválido, para
    // as duas mensagens nunca competirem.
    const faltando = camposFaltando(modo, { nome, email, senha })
    if (faltando.length > 0) {
      const campos =
        faltando.length === 1
          ? t(`campo.pos.${faltando[0]}`)
          : juntarCampos(
              faltando.map((f) => t(`campo.${f}`)),
              localeAtual(),
            )
      toast.error(
        t(modo === 'criar' ? 'validacao.preenchaCriar' : 'validacao.preenchaEntrar', { campos }),
      )
      refs[faltando[0]].current?.focus()
      return
    }
    if (!emailValido(email)) {
      toast.error(t('validacao.emailInvalido'))
      refs.email.current?.focus()
      return
    }
    if (senha.length < 8) {
      // `error`, não `warning`: a MESMA frase saía amarela aqui e vermelha na
      // recuperação de senha (que valida pela mesma `validarNovaSenha`). Cor
      // diferente para o mesmo texto no mesmo card sugere gravidade diferente
      // onde não há. Vermelho nos dois, porque nos dois o envio foi barrado.
      toast.error(t('validacao.senhaCurta'))
      refs.senha.current?.focus()
      return
    }

    // Só agora o Neon importa. Antes ficava no topo da função e engolia a
    // validação em silêncio quando o banco não estava configurado.
    if (!neon) {
      toast.error(t('auth.toast.semBanco'))
      return
    }

    setOcupado(true)
    try {
      if (modo === 'criar') {
        const nomeCompleto = nome.trim() || email.split('@')[0] || email
        const { error } = await neon.auth.signUp.email({
          email,
          password: senha,
          name: nomeCompleto,
        })
        if (error) throw new Error(error.message)
        // Apelido é preferência local (como quer ser chamado na saudação).
        salvarApelido(apelido || nome.trim().split(/\s+/)[0])

        // O código de confirmação é pedido AQUI, pelo cliente, porque o envio
        // automático no cadastro é uma chave do servidor de auth (do lado da
        // Neon) que este app não controla. Pedindo explicitamente, o código
        // chega independentemente de como aquela chave estiver.
        //
        // Falha aqui NÃO desfaz o cadastro nem interrompe a entrada: a conta
        // existe, e outro código pode ser pedido depois pelo aviso no topo.
        // Por isso o toast conta o que de fato aconteceu em cada caso, em vez
        // de prometer um e-mail que pode não ter saído.
        const envio = await enviarCodigo(email)
        toast.success(t('auth.toast.criada'), {
          description: envio.ok
            ? t('auth.toast.criadaConfirme', { email })
            : t('auth.toast.criadaSemEmail'),
          duration: 8000,
        })
        onAutenticado()
      } else {
        const { error } = await neon.auth.signIn.email({ email, password: senha })
        if (error) throw new Error(error.message)
        onAutenticado()
      }
    } catch (err) {
      // Os três casos daqui são de AUTENTICAÇÃO e vêm antes do classificador
      // geral de propósito: "invalid email or password" casaria com o padrão
      // de sessão dele e viraria "sua sessão expirou" — conselho errado para
      // quem só errou a senha.
      //
      // O que mudou em 13/08: o último ramo era `: m`, a mensagem crua do
      // servidor, em inglês. Agora cai no `chaveDeErro`, que reconhece rede
      // fora e afins e, sem reconhecer, usa o genérico traduzido.
      const m = err instanceof Error ? err.message : ''
      toast.error(
        /invalid|credencial|password|senha/i.test(m)
          ? t('auth.erro.credenciais')
          : /exist|already|registered/i.test(m)
            ? t('auth.erro.jaExiste')
            : /verif|confirm/i.test(m)
              ? t('auth.erro.confirme')
              : t(chaveDeErro(err, 'auth.toast.authFalha')),
      )
    } finally {
      setOcupado(false)
    }
  }

  async function comGoogle() {
    if (!neon) return
    const { error } = await neon.auth.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
    })
    if (error) toast.error(t('auth.toast.googleFalha'))
  }

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        // Hover floresce a sombra e esquenta a borda, mas NÃO levanta o card:
        // ele não é clicável (os cliques estão nos campos e botões dentro),
        // e subir prometeria um clique que não existe. Os internos é que sobem.
        className="rounded-2xl border border-carvao-700 bg-carvao-900/90 px-6 py-5 shadow-2xl shadow-black/30 backdrop-blur-sm transition-all duration-300 hover:border-carvao-600 hover:shadow-black/50"
      >
        <motion.div
          className="mb-2 flex justify-center"
          initial={{ rotate: -180, scale: 0 }}
          animate={{ rotate: 0, scale: 1, y: [0, -7, 0] }}
          transition={{
            rotate: { type: 'spring', stiffness: 160, damping: 14 },
            scale: { type: 'spring', stiffness: 160, damping: 14 },
            y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 },
          }}
        >
          <MoedaLogo size={44} />
        </motion.div>

        <div className="mb-3 flex justify-center">
          <Marca variante="destaque" />
        </div>

        {modo === 'recuperar' ? (
          <RecuperarSenha
            token={tokenReset ?? null}
            onVoltar={(emailVolta) => {
              if (emailVolta) setEmail(emailVolta)
              setModo('entrar')
              onRecuperacaoConcluida?.()
            }}
          />
        ) : (
          <>
            <h2 className="text-center font-display text-2xl text-tinta">
              {modo === 'criar' ? t('auth.criar') : t('auth.entrar')}
            </h2>
            <p className="mt-1.5 text-center text-sm text-tinta-fraca">{t('auth.subtitulo')}</p>

            <form onSubmit={submeter} noValidate className="mt-4 space-y-3">
              {modo === 'criar' && (
                <>
                  {/* aria-label, e não <label> visível: o card é enxuto de
                      propósito. Mas placeholder não é nome acessível — some
                      ao digitar e leitores de tela o anunciam de forma
                      inconsistente. */}
                  <input
                    type="text"
                    ref={refs.nome}
                    required
                    aria-label={t('campo.rotulo.nome')}
                    autoComplete="name"
                    placeholder={t('auth.ph.nome')}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={CAMPO}
                  />
                  <div>
                    <input
                      type="text"
                      aria-label={t('campo.rotulo.apelido')}
                      autoComplete="nickname"
                      placeholder={t('auth.ph.apelido')}
                      value={apelido}
                      onChange={(e) => setApelido(e.target.value)}
                      className={CAMPO}
                    />
                    <p className="mt-1 px-1 text-[11px] text-tinta-tenue">
                      {t('auth.ajuda.apelido')}
                    </p>
                  </div>
                </>
              )}
              <input
                type="email"
                ref={refs.email}
                required
                aria-label={t('campo.rotulo.email')}
                autoComplete="email"
                placeholder={t('auth.ph.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={CAMPO}
              />
              <CampoSenha
                refCampo={refs.senha}
                valor={senha}
                aoMudar={setSenha}
                visivel={verSenha}
                alternar={() => setVerSenha(!verSenha)}
                placeholder={t('auth.ph.senha')}
                autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              />
              <button
                type="submit"
                disabled={ocupado}
                className={BOTAO_PRIMARIO}
              >
                {ocupado ? '…' : modo === 'criar' ? t('auth.criar') : t('auth.entrar')}
              </button>
            </form>

          {modo === 'entrar' && (
            <button
              type="button"
              onClick={() => setModo('recuperar')}
              className="mt-3 flex min-h-11 w-full items-center justify-center text-center text-xs text-tinta-tenue hover:text-tinta"
            >
              {t('auth.esqueceu')}
            </button>
          )}

          <div className="my-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-carvao-800" />
            <span className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">{t('auth.ou')}</span>
            <span className="h-px flex-1 bg-carvao-800" />
          </div>

          <button
            onClick={comGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-carvao-700 px-4 py-3 text-sm text-tinta transition-all hover:-translate-y-0.5 hover:border-carvao-600 hover:bg-carvao-850 hover:shadow-lg hover:shadow-black/20 active:translate-y-0"
          >
            <GoogleIcon /> {t('auth.google')}
          </button>

          <button
            onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}
            className="mt-5 flex min-h-11 w-full items-center justify-center text-center text-xs text-tinta-tenue hover:text-tinta"
          >
            {modo === 'entrar' ? t('auth.trocarParaCriar') : t('auth.trocarParaEntrar')}
          </button>
          </>
        )}
      </motion.div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
    </svg>
  )
}
