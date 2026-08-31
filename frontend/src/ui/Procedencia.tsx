import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { useT } from '../i18n/IdiomaProvider'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  /** As transações do recorte na tela — as mesmas que somam os tiles. */
  txs: TransacaoSalva[]
  /** O rótulo do recorte, já formatado pela página ("Junho de 2026"). */
  periodo: string
}

/** De onde vêm os números que estão na tela.
 *
 *  O app é retrospectivo: **todo número veio de um documento do banco**, e
 *  essa é a promessa que o separa de um app onde se digita valor. Até
 *  2026-08-31 a promessa não aparecia em lugar nenhum da tela — os totais
 *  simplesmente estavam lá, do mesmo jeito que estariam se tivessem sido
 *  digitados.
 *
 *  Esta linha é a procedência: quantos documentos, de que tipo e de quais
 *  contas sustentam o recorte. Não repete a barra de filtros (que diz o que
 *  foi ESCOLHIDO); diz o que foi ENCONTRADO — e as duas divergem sempre que
 *  o recorte pega um mês sem fatura importada.
 *
 *  Derivada das próprias transações da tela, nunca de uma segunda consulta:
 *  um número de documentos que viesse de outra fonte poderia discordar dos
 *  totais ao lado, e duas contagens que discordam é pior que uma só. */
export function Procedencia({ txs, periodo }: Props) {
  const { t } = useT()
  if (txs.length === 0) return null

  const documentos = new Set(txs.map((x) => x.document_id))
  const faturas = new Set(
    txs.filter((x) => x.doc_type === 'fatura').map((x) => x.document_id),
  ).size
  const extratos = documentos.size - faturas

  // Ordem estável: a do catálogo, não a de aparição. Sem isso a fileira se
  // reordena a cada troca de período, e a pessoa relê para achar o mesmo
  // banco no mesmo lugar.
  const bancos = (Object.keys(BANCOS) as Bank[]).filter((b) =>
    txs.some((x) => x.bank === b),
  )

  const partes = [
    faturas > 0 ? t(faturas === 1 ? 'proc.fatura1' : 'proc.faturaN', { n: faturas }) : null,
    extratos > 0 ? t(extratos === 1 ? 'proc.extrato1' : 'proc.extratoN', { n: extratos }) : null,
  ].filter(Boolean)

  return (
    <p className="tabular mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tinta-tenue">
      {/* `first-letter:uppercase`, e nao `capitalize`: aquele maiusculiza
          TODA palavra ("Julho De 2026"). Hoje `rotuloPeriodo` devolve uma
          palavra so ("jul 2026") e os dois dariam no mesmo — este componente
          recebe um rotulo pronto de fora, e nao manda no formato dele. */}
      <span className="text-tinta-fraca first-letter:uppercase">{periodo}</span>
      <span aria-hidden>·</span>
      <span className="flex flex-wrap items-center gap-x-2">
        {bancos.map((b) => (
          <span key={b} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: BANCOS[b].accent }}
            />
            {BANCOS[b].nome}
          </span>
        ))}
      </span>
      <span aria-hidden>·</span>
      {/* A contagem por extenso, e não só o total: "4 documentos" não diz se
          a fatura do mês entrou, e é justamente a fatura que traz o detalhe
          das compras. */}
      <span>{partes.join(` ${t('proc.e')} `)}</span>
    </p>
  )
}
