import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'

/** "2026-07-20" → "20/jul" (mês na locale ativa). Constrói a data local para
 *  não escorregar de fuso (a data já é local, da fatura). */
function dataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${mesAbrev(new Date(y, (m ?? 1) - 1, d))}`
}

type Props = {
  bank: string
  /** Saldo em aberto declarado. `null` em banco que não declara. */
  abertoCents: number | null
  /** Total comprometido em parcelas futuras, declarado. */
  futurasCents: number | null
  proximoFechamento: string | null
}

/** Card compacto do que a fatura declara olhando para a FRENTE.
 *
 *  **Um rótulo só para a fileira inteira: "Próximas faturas".** Os dois
 *  bancos declaram números diferentes — o Nubank, o gasto do ciclo que ainda
 *  não fechou ("Saldo em aberto total"); o Bradesco, o que já está parcelado
 *  e ainda vai ser cobrado ("Total para as próximas faturas") — e a primeira
 *  versão deu um rótulo a cada um. O resultado, na tela, foi "Em aberto
 *  Nubank" ao lado de "Próximas faturas Bradesco": cards irmãos com cara de
 *  coisas diferentes, numa fileira que se lê de relance.
 *
 *  O rótulo comum é verdadeiro para os dois — ambos respondem *o que ainda
 *  vem* — e a diferença não some: ela desce para a linha de detalhe, que é
 *  onde cabe sem atrapalhar a leitura da fileira.
 *
 *  Irmão de `SaldoConta` (saldo do extrato) e mora na mesma grade. Banco fora
 *  do catálogo cai no tema "desconhecido" sem quebrar. */
export function SaldoAberto({ bank, abertoCents, futurasCents, proximoFechamento }: Props) {
  const tema = BANCOS[bank as Bank] ?? BANCOS.desconhecido
  const { t } = useT()

  // O ciclo em aberto vence quando existe: é o número mais próximo do "quanto
  // já devo agora". Só na falta dele o card fala das parcelas futuras.
  const emAberto = abertoCents != null
  const valor = emAberto ? abertoCents : futurasCents
  if (valor == null) return null

  return (
    <div className="rounded-xl border border-carvao-700 bg-carvao-900/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tema.accent }} aria-hidden />
        <span className="text-[10px] uppercase tracking-widest text-tinta-tenue">
          {t('aberto.rotulo')}
        </span>
        <span className="truncate text-sm text-tinta">{tema.nome}</span>
      </div>
      <p className="tabular mt-1 text-lg text-tinta">{formatBRL(valor)}</p>
      <p className="text-[11px] text-tinta-tenue">
        {/* A data de fechamento só vale para o ciclo em aberto. Parcelas a
            vencer se espalham por vários meses, e carimbar uma data ali diria
            que tudo cai de uma vez. */}
        {emAberto
          ? proximoFechamento
            ? `${t('aberto.ciclo')} · ${t('aberto.fecha', { data: dataCurta(proximoFechamento) })}`
            : t('aberto.ciclo')
          : t('aberto.parcelas')}
      </p>
    </div>
  )
}
