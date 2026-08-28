import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { pedirLink, redefinirSenha } from '../../lib/recuperar-senha'
import { guardarEmailReset, lerEmailReset, esquecerEmailReset } from '../../lib/perfil'
import { limparTokenDaUrl } from '../../lib/url-token'
import { validarNovaSenha, emailValido } from './auth-validacao'
import { CampoSenha } from './CampoSenha'
import { CAMPO, BOTAO_PRIMARIO } from './estilos-campo'
import { useT } from '../../i18n/IdiomaProvider'

type Props = {
  /** Com token, mostra o passo de nova senha. Sem, o de pedir o link. */
  token: string | null
  /** Voltar ao card de login, com o e-mail a preencher, se houver. */
  onVoltar: (email?: string) => void
}

export function RecuperarSenha({ token, onVoltar }: Props) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [tokenMorto, setTokenMorto] = useState(false)

  const refEmail = useRef<HTMLInputElement>(null)
  const refSenha = useRef<HTMLInputElement>(null)
  const { t } = useT()

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error(t('recuperar.toast.emailVazio'))
      refEmail.current?.focus()
      return
    }
    if (!emailValido(email)) {
      toast.error(t('validacao.emailInvalido'))
      refEmail.current?.focus()
      return
    }

    setOcupado(true)
    // Guardado ANTES da resposta: é o que permite preencher o campo de
    // e-mail do login depois de redefinir a senha, se o link for aberto
    // neste mesmo navegador.
    guardarEmailReset(email)
    const r = await pedirLink(email.trim(), window.location.origin + '/')
    setOcupado(false)

    if (!r.ok) {
      toast.error(t(r.erro))
      return
    }
    setEnviado(true)
    // O servidor responde 200 mesmo sem conta, de propósito. Afirmar o envio
    // revelaria quem tem cadastro — daí o "se houver".
    toast.success(t('recuperar.ajuda.enviado'), {
      description: t('recuperar.toast.enviadoDesc'),
    })
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    const erro = validarNovaSenha(senha, confirmacao)
    if (erro) {
      toast.error(t(erro))
      refSenha.current?.focus()
      return
    }

    setOcupado(true)
    const r = await redefinirSenha(token, senha)

    if (!r.ok) {
      setOcupado(false)
      toast.error(t(r.erro))
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

    // O e-mail guardado preenche o campo do login e NADA MAIS. Ele já foi
    // entrada de um signIn.email automático, e era essa propriedade — uma
    // entrada não verificada alimentando autenticação — que produzia o F4:
    // com duas contas da casa usando a mesma senha, o auto-login entrava na
    // conta errada, e como a saudação usa o apelido local, nem o cabeçalho
    // denunciava. Preenchendo um campo de texto, o pior caso é sugerir o
    // e-mail errado, visível e editável.
    const emailSalvo = lerEmailReset()
    esquecerEmailReset()
    setOcupado(false)
    toast.success(t('recuperar.toast.senhaAlterada'))
    onVoltar(emailSalvo ?? undefined)
  }

  if (token && !tokenMorto) {
    return (
      <div>
        <h2 className="text-center font-display text-2xl text-tinta">{t('recuperar.novaSenha.titulo')}</h2>
        <p className="mt-2 text-center text-sm text-tinta-fraca">
          {t('recuperar.novaSenha.ajuda')}
        </p>

        <form onSubmit={salvarSenha} noValidate className="mt-6 space-y-3">
          <CampoSenha
            refCampo={refSenha}
            valor={senha}
            aoMudar={setSenha}
            visivel={verSenha}
            alternar={() => setVerSenha(!verSenha)}
            placeholder={t('recuperar.ph.novaSenha')}
            autoComplete="new-password"
          />
          <CampoSenha
            valor={confirmacao}
            aoMudar={setConfirmacao}
            visivel={verSenha}
            alternar={() => setVerSenha(!verSenha)}
            placeholder={t('recuperar.ph.repita')}
            autoComplete="new-password"
          />
          <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
            {ocupado ? '…' : t('recuperar.salvar')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            // F6: sem isto, o token sobrevive na barra de endereços e no
            // histórico quando o usuário desiste — mesmo risco que o F5
            // depois de um token gasto, só que sem nem precisar de F5.
            limparTokenDaUrl()
            onVoltar()
          }}
          className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
        >
          {t('recuperar.voltar')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-center font-display text-2xl text-tinta">{t('recuperar.titulo')}</h2>
      <p className="mt-2 text-center text-sm text-tinta-fraca">
        {tokenMorto
          ? t('recuperar.ajuda.tokenMorto')
          : enviado
            ? t('recuperar.ajuda.enviado')
            : t('recuperar.ajuda.inicial')}
      </p>

      <form onSubmit={enviarLink} noValidate className="mt-6 space-y-3">
        <input
          type="email"
          ref={refEmail}
          required
          aria-label={t('campo.rotulo.email')}
          placeholder={t('auth.ph.email')}
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className={CAMPO}
        />
        <button type="submit" disabled={ocupado} className={BOTAO_PRIMARIO}>
          {ocupado
            ? '…'
            : tokenMorto
              ? t('recuperar.btn.pedirNovo')
              : enviado
                ? t('recuperar.btn.enviarDeNovo')
                : t('recuperar.btn.enviar')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => onVoltar()}
        className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
      >
        {t('recuperar.voltar')}
      </button>
    </div>
  )
}
