import { useState } from 'react'
import { toast } from 'sonner'
import { enviarConfirmacao, urlDeRetorno } from '../lib/confirmar-email'
import { useT } from '../i18n/IdiomaProvider'

type Props = {
  email: string
}

/** Faixa discreta para quem ainda não confirmou o e-mail, com o botão de
 *  reenviar o link.
 *
 *  **Por que avisar, se o app funciona sem confirmar:** a recuperação de
 *  senha manda um link para esse endereço. Um e-mail digitado errado só
 *  aparece como problema no dia em que a pessoa esquecer a senha — e nesse
 *  dia não há mais como consertar de dentro do app. O aviso é a única chance
 *  de descobrir o erro enquanto ele ainda é barato.
 *
 *  Não bloqueia nada de propósito: quem quer ver os próprios gastos agora vê
 *  agora. É aviso, não portão. */
export function AvisoConfirmarEmail({ email }: Props) {
  const { t } = useT()
  const [enviando, setEnviando] = useState(false)

  async function reenviar() {
    setEnviando(true)
    const r = await enviarConfirmacao(email, urlDeRetorno(window.location.origin))
    setEnviando(false)
    // `ok` significa "pedido aceito", não "entregue" (o servidor responde 200
    // até para endereço sem conta) — por isso o texto fala em conferir a
    // caixa, e não em "enviado com sucesso".
    if (r.ok) toast.success(t('aviso.reenviado'))
    else toast.error(t('aviso.reenvioFalhou'))
  }

  return (
    <div className="screen-only mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border border-ressalva/40 bg-ressalva/10 px-4 py-2.5">
      {/* O ícone é decorativo: o texto já diz tudo, e um alt aqui viraria
          ruído para quem usa leitor de tela. */}
      <span aria-hidden className="text-sm">
        ✉️
      </span>
      <p className="min-w-0 flex-1 text-sm text-tinta">{t('aviso.confirmeEmail', { email })}</p>
      <button
        onClick={reenviar}
        disabled={enviando}
        className="rounded-sm border border-carvao-700 px-3 py-1 text-xs text-tinta transition-colors hover:bg-carvao-850 disabled:opacity-50"
      >
        {enviando ? t('aviso.reenviando') : t('aviso.reenviar')}
      </button>
    </div>
  )
}
