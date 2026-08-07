import { useMemo } from 'react'
import { ConteudoDocumentos } from '../ui/Documentos'
import { useDados } from '../dados/DadosProvider'
import type { PagamentoParaQuitacao } from '../domain/quitacao'

/** Faturas e extratos importados. Era o modal "Documentos", aberto por um
 *  botão no topo do painel; virou seção própria em 2026-08-07.
 *
 *  Os dois agregados abaixo moravam no Dashboard, que os passava ao modal.
 *  Vieram para cá porque é esta a única tela que os usa — ficar no painel
 *  significava recalculá-los em toda troca de período sem ninguém olhar. */
export function Faturas() {
  const { todas, recarregar } = useDados()

  const contagem = useMemo(() => {
    const m = new Map<string, { qtd: number; totalCents: number }>()
    for (const t of todas ?? []) {
      const cur = m.get(t.document_id) ?? { qtd: 0, totalCents: 0 }
      cur.qtd += 1
      if (t.kind === 'expense') cur.totalCents += t.amount_cents
      m.set(t.document_id, cur)
    }
    return m
  }, [todas])

  // Pagamentos de fatura de TODO o histórico, não só do período visível: a
  // quitação cruza fatura e extrato que podem ter sido importados com meses
  // de diferença — foi justamente esse o buraco que `vincular()` deixava,
  // por só cruzar documentos do mesmo lote de importação.
  const pagamentos: PagamentoParaQuitacao[] = useMemo(
    () =>
      (todas ?? [])
        .filter((t) => t.kind === 'card_payment')
        .map((t) => ({ id: t.id, date: t.date, amount_cents: t.amount_cents, kind: t.kind })),
    [todas],
  )

  return (
    <div className="mt-6 mx-auto max-w-3xl">
      <ConteudoDocumentos contagem={contagem} pagamentos={pagamentos} onMudou={recarregar} />
    </div>
  )
}
