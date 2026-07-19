import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { neon } from '../lib/neon'
import { pedirLink, redefinirSenha } from '../lib/recuperar-senha'
import { guardarEmailReset, lerEmailReset, esquecerEmailReset } from '../lib/perfil'
import { limparTokenDaUrl } from '../lib/url-token'
import { validarNovaSenha, emailValido } from './auth-validacao'
import { IconeOlho } from './IconeOlho'
import { CAMPO, BOTAO_PRIMARIO } from './estilos-campo'

type Props = {
  /** Com token, mostra o passo de nova senha. Sem, o de pedir o link. */
  token: string | null
  /** Voltar ao card de login, com o e-mail a preencher, se houver. */
  onVoltar: (email?: string) => void
  /** Redefiniu e entrou: o App deve re-checar a sessão. */
  onAutenticado: () => void
}

export function RecuperarSenha({ token, onVoltar, onAutenticado }: Props) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [tokenMorto, setTokenMorto] = useState(false)

  const refEmail = useRef<HTMLInputElement>(null)
  const refSenha = useRef<HTMLInputElement>(null)

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Preencha seu e-mail para receber o link.')
      refEmail.current?.focus()
      return
    }
    if (!emailValido(email)) {
      toast.error('Esse e-mail não parece válido.')
      refEmail.current?.focus()
      return
    }

    setOcupado(true)
    // Guardado ANTES da resposta: é o que permite o login automático quando
    // o link for aberto neste mesmo navegador.
    guardarEmailReset(email)
    const r = await pedirLink(email.trim(), window.location.origin + '/')
    setOcupado(false)

    if (!r.ok) {
      toast.error(r.erro)
      return
    }
    setEnviado(true)
    // O servidor responde 200 mesmo sem conta, de propósito. Afirmar o envio
    // revelaria quem tem cadastro — daí o "se houver".
    toast.success('Se houver conta com esse e-mail, o link já está a caminho.', {
      description: 'Confira também o spam.',
    })
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    const erro = validarNovaSenha(senha, confirmacao)
    if (erro) {
      toast.error(erro)
      refSenha.current?.focus()
      return
    }

    setOcupado(true)
    const r = await redefinirSenha(token, senha)

    if (!r.ok) {
      setOcupado(false)
      toast.error(r.erro)
      if (r.motivo === 'token') {
        setTokenMorto(true)
        // Token morto: fora da URL, senão um F5 volta para este mesmo
        // formulário com um token já sabido inválido.
        limparTokenDaUrl()
        // Limpar o e-mail guardado para não vazar entre usuários (F1).
        esquecerEmailReset()
      }
      return
    }

    // Token gasto: fora da URL antes de qualquer coisa, para um F5 não
    // reenviá-lo e produzir um erro que não é do usuário.
    limparTokenDaUrl()

    const emailSalvo = lerEmailReset()

    if (emailSalvo && neon) {
      try {
        const { error } = await neon.auth.signIn.email({ email: emailSalvo, password: senha })
        if (!error) {
          toast.success('Senha alterada. Bem-vindo de volta.')
          onAutenticado()
          return
        }
        toast.success('Senha alterada. Entre com a senha nova.')
        onVoltar(emailSalvo)
      } catch (err) {
        // A senha JÁ foi trocada no servidor (chegamos aqui só depois do
        // redefinirSenha ter dado ok:true). Só o login automático falhou —
        // isso nunca pode virar "a troca de senha falhou".
        console.error('Auto-login falhou após redefinir senha:', err)
        toast.success('Senha alterada. Entre com a senha nova.')
        onVoltar(emailSalvo)
      } finally {
        esquecerEmailReset()
        setOcupado(false)
      }
      return
    }

    // Sem e-mail guardado (link aberto em outro aparelho) ou sem banco
    // configurado neste ambiente: não dá para fazer login automático — só
    // avisar e mandar ao login.
    esquecerEmailReset()
    setOcupado(false)
    toast.success('Senha alterada. Entre com a senha nova.')
    onVoltar(emailSalvo ?? undefined)
  }

  if (token && !tokenMorto) {
    return (
      <div>
        <h2 className="text-center font-display text-2xl text-tinta">Nova senha</h2>
        <p className="mt-2 text-center text-sm text-tinta-fraca">
          Escolha uma senha e repita para confirmar.
        </p>

        <form onSubmit={salvarSenha} noValidate className="mt-6 space-y-3">
          <CampoSenha
            refCampo={refSenha}
            valor={senha}
            aoMudar={setSenha}
            visivel={verSenha}
            alternar={() => setVerSenha(!verSenha)}
            placeholder="nova senha (mín. 8 caracteres)"
          />
          <CampoSenha
            valor={confirmacao}
            aoMudar={setConfirmacao}
            visivel={verSenha}
            alternar={() => setVerSenha(!verSenha)}
            placeholder="repita a nova senha"
          />
          <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
            {ocupado ? '…' : 'Salvar nova senha'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => onVoltar()}
          className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
        >
          ‹ Voltar ao login
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-center font-display text-2xl text-tinta">Recuperar acesso</h2>
      <p className="mt-2 text-center text-sm text-tinta-fraca">
        {tokenMorto
          ? 'Peça um link novo para continuar.'
          : enviado
            ? 'Se houver conta com esse e-mail, o link já está a caminho.'
            : 'Informe seu e-mail e mandamos um link para redefinir a senha.'}
      </p>

      <form onSubmit={enviarLink} noValidate className="mt-6 space-y-3">
        <input
          type="email"
          ref={refEmail}
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className={CAMPO}
        />
        <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
          {ocupado ? '…' : tokenMorto ? 'Pedir um novo link' : enviado ? 'Enviar de novo' : 'Enviar link'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => onVoltar()}
        className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
      >
        ‹ Voltar ao login
      </button>
    </div>
  )
}

/** Campo de senha com o olho de revelar. O botão é type="button": dentro de
 *  um <form>, o padrão seria submit, e clicar no olho enviaria o formulário. */
function CampoSenha({
  refCampo,
  valor,
  aoMudar,
  visivel,
  alternar,
  placeholder,
}: {
  refCampo?: React.RefObject<HTMLInputElement | null>
  valor: string
  aoMudar: (v: string) => void
  visivel: boolean
  alternar: () => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <input
        ref={refCampo}
        type={visivel ? 'text' : 'password'}
        required
        minLength={8}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={CAMPO + ' pr-11'}
      />
      <button
        type="button"
        onClick={alternar}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tinta-tenue transition-colors hover:text-tinta"
      >
        <IconeOlho aberto={visivel} />
      </button>
    </div>
  )
}
