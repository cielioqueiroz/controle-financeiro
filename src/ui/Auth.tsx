import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { neon } from '../lib/neon'
import { salvarApelido } from '../lib/perfil'
import { camposFaltando, mensagemCamposFaltando, type CampoAcesso } from './auth-validacao'

type Props = {
  /** Chamado após login/cadastro bem-sucedido, para o App re-checar a sessão. */
  onAutenticado: () => void
}

/** Login e cadastro. E-mail/senha + Google, via Neon Auth (Better Auth).
 *  Mantém a tela grafite/Fraunces; só a engrenagem por baixo mudou de
 *  Supabase para neon-js. */
export function Auth({ onAutenticado }: Props) {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [nome, setNome] = useState('')
  const [apelido, setApelido] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [verSenha, setVerSenha] = useState(false)

  // Uma ref por campo obrigatório, para focar o primeiro que estiver vazio.
  const refs: Record<CampoAcesso, React.RefObject<HTMLInputElement | null>> = {
    nome: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    senha: useRef<HTMLInputElement>(null),
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault()

    // Validação primeiro: campo vazio sempre vence formato inválido, para
    // as duas mensagens nunca competirem.
    const faltando = camposFaltando(modo, { nome, email, senha })
    if (faltando.length > 0) {
      toast.error(mensagemCamposFaltando(modo, faltando))
      refs[faltando[0]].current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Esse e-mail não parece válido.')
      refs.email.current?.focus()
      return
    }
    if (senha.length < 8) {
      toast.warning('A senha precisa ter ao menos 8 caracteres.')
      refs.senha.current?.focus()
      return
    }

    // Só agora o Neon importa. Antes ficava no topo da função e engolia a
    // validação em silêncio quando o banco não estava configurado.
    if (!neon) {
      toast.error('O banco de dados não está configurado neste ambiente.')
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
        toast.success('Conta criada. Se pedirmos confirmação, confira seu e-mail.')
        onAutenticado()
      } else {
        const { error } = await neon.auth.signIn.email({ email, password: senha })
        if (error) throw new Error(error.message)
        onAutenticado()
      }
    } catch (err) {
      toast.error(err instanceof Error ? traduzErro(err.message) : 'Falha na autenticação.')
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
    if (error) toast.error('Falha ao entrar com o Google.')
  }

  return (
    <div className="relative mx-auto mt-6 max-w-sm sm:mt-12">
      {/* Brilho animado atrás do cartão (contido, não é o fundo todo) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-12 -z-10 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(40% 40% at 25% 30%, color-mix(in oklab, var(--color-confere) 60%, transparent), transparent 70%), radial-gradient(45% 45% at 80% 75%, color-mix(in oklab, #7c5cff 45%, transparent), transparent 70%), radial-gradient(40% 40% at 60% 20%, color-mix(in oklab, #ff5da2 35%, transparent), transparent 70%)',
        }}
        animate={{ scale: [0.9, 1.25, 0.9], rotate: [0, 40, -15, 0], opacity: [0.45, 0.95, 0.45] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="rounded-2xl border border-carvao-700 bg-carvao-900/90 p-8 shadow-2xl shadow-black/30 backdrop-blur-sm"
      >
        <motion.div
          className="mb-5 flex justify-center"
          initial={{ rotate: -180, scale: 0 }}
          animate={{ rotate: 0, scale: 1, y: [0, -7, 0] }}
          transition={{
            rotate: { type: 'spring', stiffness: 160, damping: 14 },
            scale: { type: 'spring', stiffness: 160, damping: 14 },
            y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 },
          }}
        >
          <MoedaLogo />
        </motion.div>

        <h2 className="text-center font-display text-2xl text-tinta">
          {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </h2>
        <p className="mt-2 text-center text-sm text-tinta-fraca">Seus dados financeiros, só seus.</p>

      <form onSubmit={submeter} noValidate className="mt-6 space-y-3">
        {modo === 'criar' && (
          <>
            <input
              type="text"
              ref={refs.nome}
              required
              placeholder="nome e sobrenome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-sm border border-carvao-700 bg-carvao-950 px-3 py-2 text-sm text-tinta outline-none focus:border-tinta-tenue"
            />
            <div>
              <input
                type="text"
                placeholder="como quer ser chamado? (apelido, opcional)"
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                className="w-full rounded-sm border border-carvao-700 bg-carvao-950 px-3 py-2 text-sm text-tinta outline-none focus:border-tinta-tenue"
              />
              <p className="mt-1 px-1 text-[11px] text-tinta-tenue">
                É assim que vamos te saudar. Se deixar em branco, usamos seu primeiro nome.
              </p>
            </div>
          </>
        )}
        <input
          type="email"
          ref={refs.email}
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-sm border border-carvao-700 bg-carvao-950 px-3 py-2 text-sm text-tinta outline-none focus:border-tinta-tenue"
        />
        <div className="relative">
          <input
            ref={refs.senha}
            type={verSenha ? 'text' : 'password'}
            required
            minLength={8}
            placeholder="senha (mín. 8 caracteres)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-sm border border-carvao-700 bg-carvao-950 px-3 py-2 pr-10 text-sm text-tinta outline-none focus:border-tinta-tenue"
          />
          <button
            type="button"
            onClick={() => setVerSenha(!verSenha)}
            aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={verSenha}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tinta-tenue transition-colors hover:text-tinta"
          >
            <IconeOlho aberto={verSenha} />
          </button>
        </div>
        <button
          type="submit"
          disabled={ocupado}
          className="w-full rounded-sm bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {ocupado ? '…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-carvao-800" />
        <span className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">ou</span>
        <span className="h-px flex-1 bg-carvao-800" />
      </div>

      <button
        onClick={comGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-sm border border-carvao-700 px-4 py-2 text-sm text-tinta transition-colors hover:bg-carvao-850"
      >
        <GoogleIcon /> Continuar com o Google
      </button>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-tinta-tenue">
        Recomendamos criar conta com{' '}
        <span className="text-tinta-fraca">e-mail e senha</span> — é o jeito mais
        simples e direto.
      </p>

      <button
        onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}
        className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
      >
        {modo === 'entrar' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
      </button>
      </motion.div>
    </div>
  )
}

/** Moeda R$ animada — mesma marca do favicon, em SVG inline. */
function MoedaLogo() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" className="drop-shadow-lg" aria-hidden>
      <circle cx="32" cy="32" r="23" fill="var(--color-confere)" />
      <circle cx="32" cy="32" r="23" fill="none" stroke="#065f37" strokeWidth="2.5" opacity="0.55" />
      <circle cx="32" cy="32" r="18.5" fill="none" stroke="#065f37" strokeWidth="1.6" opacity="0.4" />
      <text
        x="32"
        y="41.5"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="800"
        fontSize="24"
        fill="#0d0c0b"
      >
        R$
      </text>
    </svg>
  )
}

function traduzErro(msg: string): string {
  if (/invalid|credencial|password|senha/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/exist|already|registered/i.test(msg)) return 'Este e-mail já tem conta.'
  if (/verif|confirm/i.test(msg)) return 'Confirme seu e-mail antes de entrar.'
  return msg
}

/** Olho aberto/cortado para revelar a senha. */
function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
      {!aberto && <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" strokeLinecap="round" />}
    </svg>
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
