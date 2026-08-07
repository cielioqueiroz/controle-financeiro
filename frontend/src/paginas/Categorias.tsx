import { useMemo } from 'react'
import { ConteudoCategorias } from '../ui/Categorias'
import { useDados } from '../dados/DadosProvider'

type Props = {
  /** Uma regra apagada ou categoria renomeada muda o que a próxima
   *  importação vai categorizar — quem guarda as regras (o App) precisa
   *  recarregá-las. */
  onAprendeu?: () => void
}

/** Categorias do usuário e regras aprendidas. Era o modal "Categorias".
 *
 *  A segunda seção é a que faltava no app até 2026-07-29: corrigir a
 *  categoria de uma compra ensina o app (grava em `merchant_rules`), mas
 *  não havia como ver nem desfazer o que ele aprendeu — uma correção errada
 *  era permanente e invisível. */
export function Categorias({ onAprendeu }: Props) {
  const { todas, recarregar } = useDados()

  // Quantas transações usam cada slug. A confirmação de apagar usa isto
  // para dizer o tamanho do estrago ("N lançamentos vão exibir Outros")
  // antes de a pessoa confirmar.
  const usoPorSlug = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of todas ?? []) {
      const s = t.category_slug ?? 'outros'
      m.set(s, (m.get(s) ?? 0) + 1)
    }
    return m
  }, [todas])

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <ConteudoCategorias
        usoPorSlug={usoPorSlug}
        onMudou={() => {
          recarregar()
          onAprendeu?.()
        }}
      />
    </div>
  )
}
