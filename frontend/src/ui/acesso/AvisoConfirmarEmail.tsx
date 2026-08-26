import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  confirmarComCodigo,
  enviarCodigo,
  normalizarCodigo,
  TAMANHO_CODIGO,
  type MotivoFalha,
} from '../../lib/confirmar-email'
import { useT } from '../../i18n/IdiomaProvider'

type Props = {
  email: string
  /** Confirmou de verdade: o App recheca a sessão e o aviso some sozinho. */
  onConfirmado: () => void
}

/** Faixa para quem ainda não confirmou o e-mail — com o campo do código
 *  dentro dela.
 *
 *  **O campo é a razão de esta tela ter sido refeita.** A primeira versão
 *  (2026-08-12) só tinha "reenviar link", e o e-mail que a Neon manda traz um
 *  **código de 6 dígitos**: a pessoa recebia um número e não havia lugar
 *  nenhum no app para digitá-lo. Link exigiria provedor de e-mail próprio
 *  (ver `lib/confirmar-email.ts`), então o app se ajusta ao que de fato
 *  chega na caixa de entrada.
 *
 *  **Por que avisar, se o app funciona sem confirmar:** a recuperação de
 *  senha manda o código para esse endereço. Um e-mail digitado errado só
 *  aparece como problema no dia em que a pessoa esquecer a senha — e nesse
 *  dia não há mais como consertar de dentro do app. O aviso é a única chance
 *  de descobrir o erro enquanto ele ainda é barato.
 *
 *  Não bloqueia nada de propósito: quem quer ver os próprios gastos agora vê
 *  agora. É aviso, não portão. */
export function AvisoConfirmarEmail({ email, onConfirmado }: Props) {
  const { t } = useT()
  const [aberto, setAberto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState<'enviando' | 'confirmando' | null>(null)
  const campo = useRef<HTMLInputElement>(null)

  /** Uma mensagem por motivo. `muitas-tentativas` é o limite de 3 por minuto
   *  do servidor: dizer "não consegui" ali mandaria a pessoa procurar defeito
   *  onde o conserto é esperar. */
  function avisarFalha(motivo: MotivoFalha) {
    if (motivo === 'muitas-tentativas') toast.warning(t('aviso.muitasTentativas'))
    else if (motivo === 'codigo-invalido')
      toast.error(t('aviso.codigoInvalido'), { description: t('aviso.codigoInvalidoDesc') })
    else toast.error(t('aviso.falha'))
  }

  function abrir() {
    setAberto(true)
    // O código do cadastro já chegou na caixa de quem acabou de criar a
    // conta: enviar outro aqui invalidaria o que ela está prestes a digitar.
    // Quem chegou depois (o código expira em minutos) pede outro no botão.
    requestAnimationFrame(() => campo.current?.focus())
  }

  async function pedirCodigo() {
    setOcupado('enviando')
    const r = await enviarCodigo(email)
    setOcupado(null)
    // `ok` significa "pedido aceito", não "entregue" — o texto fala em
    // conferir a caixa, e não em "enviado com sucesso".
    if (r.ok) {
      toast.success(t('aviso.enviado'))
      campo.current?.focus()
    } else avisarFalha(r.motivo)
  }

  async function confirmar() {
    if (codigo.length < TAMANHO_CODIGO || ocupado) return
    setOcupado('confirmando')
    const r = await confirmarComCodigo(email, codigo)
    setOcupado(null)
    if (!r.ok) {
      // O campo fica como está, com o que foi digitado: é o que permite
      // conferir dígito a dígito em vez de recomeçar no escuro.
      avisarFalha(r.motivo)
      return
    }
    toast.success(t('aviso.confirmado'), { description: t('aviso.confirmadoDesc') })
    onConfirmado()
  }

  return (
    <div className="screen-only mb-4 rounded-sm border border-ressalva/40 bg-ressalva/10 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Ícone decorativo: o texto já diz tudo, e um alt aqui viraria ruído
            para quem usa leitor de tela. */}
        <span aria-hidden className="text-sm">
          ✉️
        </span>
        <p className="min-w-0 flex-1 text-sm text-tinta">{t('aviso.confirmeEmail', { email })}</p>
        {!aberto && (
          <button
            onClick={abrir}
            className="rounded-sm border border-carvao-700 px-3 py-1 text-xs text-tinta transition-colors hover:bg-carvao-850"
          >
            {t('aviso.confirmarAgora')}
          </button>
        )}
      </div>

      {aberto && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            confirmar()
          }}
          className="mt-3 border-t border-ressalva/25 pt-3"
        >
          <p className="text-[13px] text-tinta-fraca">{t('aviso.instrucao', { email })}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={campo}
              value={codigo}
              // A normalização mora no onChange, e não numa validação no
              // envio: quem cola "008 432" do e-mail vê o campo aceitar, em
              // vez de descobrir no clique que o formato estava errado.
              onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={TAMANHO_CODIGO}
              aria-label={t('aviso.rotuloCodigo')}
              placeholder={'0'.repeat(TAMANHO_CODIGO)}
              className="tabular w-32 rounded-sm border border-campo-borda bg-afundado px-3 py-1.5 text-center text-base tracking-[0.35em] text-tinta placeholder:text-tinta-tenue focus:border-marca focus:outline-none"
            />
            <button
              type="submit"
              disabled={codigo.length < TAMANHO_CODIGO || ocupado !== null}
              className="rounded-sm bg-tinta px-3 py-1.5 text-xs font-medium text-carvao-950 transition-colors hover:bg-tinta-fraca disabled:opacity-40"
            >
              {ocupado === 'confirmando' ? t('aviso.confirmando') : t('aviso.confirmar')}
            </button>
            <button
              type="button"
              onClick={pedirCodigo}
              disabled={ocupado !== null}
              className="rounded-sm border border-carvao-700 px-3 py-1.5 text-xs text-tinta transition-colors hover:bg-carvao-850 disabled:opacity-50"
            >
              {ocupado === 'enviando' ? t('aviso.enviando') : t('aviso.enviarCodigo')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
