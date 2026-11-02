import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { chaveDeErro } from '../../lib/erro-usuario'
import { obterNeon } from '../../lib/neon'
import { guardarEmailReset, primeiroNome } from '../../lib/perfil'
import { CORES_AVATAR, lerCorAvatar, type CorAvatar } from '../../lib/preferencias'
import { temSenhaPropria, trocarSenha } from '../../lib/conta-auth'
import { pedirLink } from '../../lib/recuperar-senha'
import { gravarPreferencias } from '../../aplicacao/comandos/preferencias'
import { validarNovaSenha } from '../acesso/auth-validacao'
import { useT } from '../../i18n/IdiomaProvider'
import type { Dicionario } from '../../i18n/dicionarios/pt'
import { Avatar } from '../Avatar'
import { CAMPO_PERFIL, ROTULO_PERFIL } from './estilos'

type Props = {
  nomeAtual: string
  emailAtual: string | null
  apelidoAtual: string
  onOcupado: (ocupado: boolean) => void
  onCancelar: () => void
  onSalvo: () => void
}

/** Quem você é (apelido, nome, cor do avatar) e como entra (e-mail, senha).
 *
 *  O apelido e a cor vão com as preferências — no aparelho sempre, na conta
 *  quando a 0013 estiver aplicada. O nome completo vai para o Neon Auth. A
 *  senha é um formulário À PARTE, com botão próprio: misturá-la no "Salvar"
 *  faria um erro de senha atual impedir de salvar um apelido. */
export function AbaConta({ nomeAtual, emailAtual, apelidoAtual, onOcupado, onCancelar, onSalvo }: Props) {
  const [nome, setNome] = useState(nomeAtual)
  const [apelido, setApelido] = useState(apelidoAtual)
  const [cor, setCor] = useState<CorAvatar | null>(lerCorAvatar)
  const [salvando, setSalvando] = useState(false)
  const { t } = useT()

  // Prévia de como a saudação vai ficar: apelido vence; sem ele, o 1º nome.
  const saudacaoPrevia = apelido.trim() || primeiroNome(nome) || 'você'

  async function salvar() {
    const apelidoLimpo = apelido.trim()
    const nomeLimpo = nome.trim()

    setSalvando(true)
    onOcupado(true)
    try {
      // Nome completo só vai ao servidor se mudou e não está vazio — não
      // apagamos o nome do cadastro com um campo em branco.
      if (nomeLimpo && nomeLimpo !== nomeAtual.trim()) {
        const neon = await obterNeon()
        if (!neon) throw new Error(t('auth.toast.semBanco'))
        const { error } = await neon.auth.updateUser({ name: nomeLimpo })
        if (error) throw new Error(error.message)
      }
      // Apelido vazio limpa e volta a saudação para o 1º nome.
      const naConta = await gravarPreferencias({ apelido: apelidoLimpo || null, corAvatar: cor })
      toast.success(t('perfil.toastOk'), naConta ? undefined : { description: t('perfil.soNesteAparelho') })
      onSalvo()
    } catch (e) {
      toast.error(t(chaveDeErro(e, 'perfil.toastFalha')))
    } finally {
      setSalvando(false)
      onOcupado(false)
    }
  }

  return (
    <>
      <div className="space-y-5 px-6 py-5">
        <div className="flex items-center gap-4">
          <Avatar nome={nome} email={emailAtual} cor={cor} className="h-14 w-14 text-lg" />
          <fieldset className="min-w-0 flex-1">
            <legend className={ROTULO_PERFIL}>{t('perfil.corLabel')}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <BotaoCor ativo={cor === null} rotulo={t('perfil.corNenhuma')} onClick={() => setCor(null)} />
              {CORES_AVATAR.map((c) => (
                <BotaoCor
                  key={c}
                  cor={c}
                  ativo={cor === c}
                  rotulo={t(`perfil.cor.${c}` as keyof Dicionario)}
                  onClick={() => setCor(c)}
                />
              ))}
            </div>
          </fieldset>
        </div>

        <label className="block">
          <span className={ROTULO_PERFIL}>{t('perfil.apelidoLabel')}</span>
          <input
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder={primeiroNome(nome) ?? t('perfil.apelidoPh')}
            autoFocus
            maxLength={40}
            className={CAMPO_PERFIL}
          />
          <span className="mt-1 block text-xs text-tinta-tenue">{t('perfil.apelidoAjuda')}</span>
        </label>

        <label className="block">
          <span className={ROTULO_PERFIL}>{t('perfil.nomeLabel')}</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={t('auth.ph.nome')}
            maxLength={120}
            className={CAMPO_PERFIL}
          />
        </label>

        <p className="rounded-lg border border-carvao-800 bg-carvao-850/60 px-3 py-2 text-sm text-tinta-fraca">
          {t('perfil.previaPrefixo')}{' '}
          <span className="text-tinta">{t('header.ola', { nome: saudacaoPrevia })}</span>
        </p>

        {emailAtual && (
          <label className="block">
            <span className={ROTULO_PERFIL}>{t('perfil.emailLabel')}</span>
            <input value={emailAtual} readOnly className={`${CAMPO_PERFIL} text-tinta-fraca`} />
            <span className="mt-1 block text-xs text-tinta-tenue">{t('perfil.emailAjuda')}</span>
          </label>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-carvao-800 px-6 py-4">
        <button
          onClick={onCancelar}
          disabled={salvando}
          className="min-h-11 rounded-lg px-4 py-2 text-sm text-tinta-fraca transition-colors hover:text-tinta disabled:opacity-50"
        >
          {t('geral.cancelar')}
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="min-h-11 rounded-lg bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? t('geral.salvando') : t('geral.salvar')}
        </button>
      </footer>

      <SecaoSenha email={emailAtual} onOcupado={onOcupado} />
    </>
  )
}

function BotaoCor({
  cor,
  ativo,
  rotulo,
  onClick,
}: {
  cor?: CorAvatar
  ativo: boolean
  rotulo: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      aria-pressed={ativo}
      title={rotulo}
      // 44px de alvo (o círculo é menor, o botão não): é o mínimo de toque.
      className="grid h-11 w-11 place-items-center rounded-full"
    >
      <span
        aria-hidden
        style={cor ? { backgroundColor: `var(--color-avatar-${cor})` } : undefined}
        className={`block h-7 w-7 rounded-full border ${
          cor ? 'border-carvao-600' : 'border-dashed border-campo-borda bg-carvao-850'
        } ${ativo ? 'ring-2 ring-marca ring-offset-2 ring-offset-carvao-900' : ''}`}
      />
    </button>
  )
}

/** Trocar a senha sabendo a atual — ou, para quem só entra pelo Google,
 *  pedir o link que CRIA uma senha (o mesmo da recuperação: o better-auth
 *  cria a credencial na redefinição quando ela não existe). */
function SecaoSenha({ email, onOcupado }: { email: string | null; onOcupado: (o: boolean) => void }) {
  const { t } = useT()
  const [temSenha, setTemSenha] = useState<boolean | null>(null)
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [repetida, setRepetida] = useState('')
  const [erro, setErro] = useState<keyof Dicionario | null>(null)
  const [trocando, setTrocando] = useState(false)
  const [linkPedido, setLinkPedido] = useState(false)

  useEffect(() => {
    let vivo = true
    void temSenhaPropria().then((r) => {
      if (vivo) setTemSenha(r)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function trocar(e: React.FormEvent) {
    e.preventDefault()
    if (!atual) return setErro('perfil.senha.digiteAtual')
    const invalida = validarNovaSenha(nova, repetida)
    if (invalida) return setErro(invalida)
    setErro(null)
    setTrocando(true)
    onOcupado(true)
    const r = await trocarSenha(atual, nova)
    setTrocando(false)
    onOcupado(false)
    if (!r.ok) {
      setErro(r.erro)
      if (r.erro === 'perfil.senha.erroSemSenha') setTemSenha(false)
      return
    }
    setAtual('')
    setNova('')
    setRepetida('')
    toast.success(t('perfil.senha.ok'))
  }

  async function pedirCriacao() {
    if (!email) return
    setTrocando(true)
    guardarEmailReset(email)
    const r = await pedirLink(email, window.location.origin + '/')
    setTrocando(false)
    if (r.ok) setLinkPedido(true)
    else toast.error(t(r.erro))
  }

  // `null` ("não sei") desenha o formulário: se não houver senha, o próprio
  // servidor diz, e a seção troca para o link.
  if (temSenha === false) {
    return (
      <section className="space-y-3 border-t border-carvao-800 px-6 py-5">
        <h3 className={ROTULO_PERFIL}>{t('perfil.senha.titulo')}</h3>
        <p className="text-sm text-tinta-fraca">{t('perfil.senha.google')}</p>
        {linkPedido ? (
          <p role="status" className="text-sm text-tinta">
            {t('perfil.senha.linkEnviado')}
          </p>
        ) : (
          <button
            onClick={pedirCriacao}
            disabled={trocando || !email}
            className="min-h-11 rounded-lg border border-carvao-700 px-4 py-2 text-sm text-tinta transition-colors hover:border-carvao-600 disabled:opacity-50"
          >
            {t('perfil.senha.enviarLink')}
          </button>
        )}
      </section>
    )
  }

  return (
    <form onSubmit={trocar} className="space-y-3 border-t border-carvao-800 px-6 py-5" noValidate>
      <h3 className={ROTULO_PERFIL}>{t('perfil.senha.titulo')}</h3>
      {/* O e-mail escondido é para o gerenciador de senhas saber DE QUAL
          conta é a senha nova que ele vai oferecer guardar. */}
      {email && <input type="email" value={email} autoComplete="username" readOnly hidden />}
      <CampoSenhaPerfil rotulo={t('perfil.senha.atual')} valor={atual} aoMudar={setAtual} auto="current-password" />
      <CampoSenhaPerfil rotulo={t('perfil.senha.nova')} valor={nova} aoMudar={setNova} auto="new-password" />
      <CampoSenhaPerfil rotulo={t('perfil.senha.repetir')} valor={repetida} aoMudar={setRepetida} auto="new-password" />
      {erro && (
        <p role="alert" className="text-sm text-debito">
          {t(erro)}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={trocando}
          className="min-h-11 rounded-lg border border-carvao-700 px-4 py-2 text-sm text-tinta transition-colors hover:border-carvao-600 disabled:opacity-50"
        >
          {trocando ? t('perfil.senha.trocando') : t('perfil.senha.trocar')}
        </button>
      </div>
    </form>
  )
}

function CampoSenhaPerfil({
  rotulo,
  valor,
  aoMudar,
  auto,
}: {
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  auto: 'current-password' | 'new-password'
}) {
  return (
    <label className="block">
      <span className="text-sm text-tinta-fraca">{rotulo}</span>
      <input
        type="password"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        autoComplete={auto}
        className={CAMPO_PERFIL}
      />
    </label>
  )
}
