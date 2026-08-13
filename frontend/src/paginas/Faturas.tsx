import { useMemo } from 'react'
import { ConteudoDocumentos } from '../ui/Documentos'
import { useDados } from '../dados/DadosProvider'

/** Faturas e extratos importados. Era o modal "Documentos", aberto por um
 *  botão no topo do painel; virou seção própria em 2026-08-07.
 *
 *  A contagem por documento morava no Dashboard, que a passava ao modal.
 *  Veio para cá porque é esta a única tela que a usa — ficar no painel
 *  significava recalculá-la em toda troca de período sem ninguém olhar.
 *
 *  O selo de quitada/em aberto saiu em 2026-08-09, a pedido do usuário. Com
 *  ele saíram o cálculo de pagamentos daqui e `domain/quitacao.ts` inteiro —
 *  código que ninguém mais alcançava. Está no histórico do git se voltar. */
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

  return (
    <div className="mt-6 mx-auto max-w-3xl">
      <ConteudoDocumentos contagem={contagem} onMudou={recarregar} />
    </div>
  )
}
