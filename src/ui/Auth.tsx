import { useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

/** Login e cadastro. E-mail/senha com confirmação por e-mail + Google.
 *  Sem porta dos fundos: todo cadastro passa por e-mail verificado (ver
 *  spec, decisão #6). */
export function Auth() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function submeter(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setOcupado(true)
    try {
      if (modo === 'criar') {
        const { error } = await supabase.auth.signUp({ email, password: senha })
        if (error) throw error
        toast.success('Enviamos um e-mail de confirmação. Confira sua caixa de entrada.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      }
    } catch (err) {
      toast.error(err instanceof Error ? traduzErro(err.message) : 'Falha na autenticação.')
    } finally {
      setOcupado(false)
    }
  }

  async function comGoogle() {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) toast.error('Falha ao entrar com o Google.')
  }

  return (
    <div className="surgir mx-auto max-w-sm rounded-sm border border-carvao-700 bg-carvao-900 p-8">
      <h2 className="font-display text-2xl text-tinta">
        {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
      </h2>
      <p className="mt-2 text-sm text-tinta-fraca">
        Seus dados financeiros, só seus. {modo === 'criar' && 'Confirmamos por e-mail.'}
      </p>

      <form onSubmit={submeter} className="mt-6 space-y-3">
        <input
          type="email"
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-sm border border-carvao-700 bg-carvao-950 px-3 py-2 text-sm text-tinta outline-none focus:border-tinta-tenue"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="senha (mín. 6 caracteres)"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-sm border border-carvao-700 bg-carvao-950 px-3 py-2 text-sm text-tinta outline-none focus:border-tinta-tenue"
        />
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

      <button
        onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}
        className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
      >
        {modo === 'entrar' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
      </button>
    </div>
  )
}

function traduzErro(msg: string): string {
  if (/Invalid login/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/already registered/i.test(msg)) return 'Este e-mail já tem conta.'
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.'
  return msg
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
