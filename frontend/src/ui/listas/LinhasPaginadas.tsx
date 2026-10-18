import { useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { LinhaTransacao } from './LinhaTransacao'
import type { TransacaoSalva } from '../../aplicacao/consultas/historico'
import { useT } from '../../i18n/IdiomaProvider'

type Props = Omit<ComponentProps<typeof LinhaTransacao>, 't'> & { itens: TransacaoSalva[]; className?: string }
const TAMANHO = 50

export function LinhasPaginadas({ itens, className, ...props }: Props) {
  const { t } = useT()
  const [selecao, setSelecao] = useState({ itens, pagina: 0 })
  const resumo = useRef<HTMLParagraphElement>(null)
  const paginas = Math.ceil(itens.length / TAMANHO)
  const pagina = selecao.itens === itens ? Math.min(selecao.pagina, paginas - 1) : 0
  const inicio = Math.max(0, pagina) * TAMANHO
  const mudar = (alvo: number) => { setSelecao({ itens, pagina: alvo }); resumo.current?.focus() }
  return <>
    <ul className={className}>
      {itens.slice(inicio, inicio + TAMANHO).map((item) => <LinhaTransacao key={item.id} t={item} {...props} />)}
    </ul>
    {paginas > 1 && <nav aria-label={t('lista.paginacao')} className="flex flex-wrap items-center justify-between gap-3 border-t border-borda p-4">
      <p ref={resumo} tabIndex={-1} role="status" className="text-xs text-tinta-fraca">
        {t('lista.intervalo', { inicio: inicio + 1, fim: Math.min(inicio + TAMANHO, itens.length), total: itens.length })}
      </p>
      <div className="flex gap-2">
        <button type="button" className="acao-painel" disabled={pagina === 0} onClick={() => mudar(pagina - 1)}>{t('lista.anterior')}</button>
        <button type="button" className="acao-painel" disabled={pagina >= paginas - 1} onClick={() => mudar(pagina + 1)}>{t('lista.proxima')}</button>
      </div>
    </nav>}
  </>
}
