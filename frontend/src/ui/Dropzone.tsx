import { useCallback, useRef, useState } from 'react'
import { useT } from '../i18n/IdiomaProvider'
import { interpolarNos } from '../i18n/interpolarNos'

type Props = {
  /** Recebe TODOS os arquivos soltos de uma vez. Quem enfileira é o
   *  provider — aqui só se entrega o que a pessoa escolheu. */
  onArquivos: (files: File[]) => void
  ocupado: boolean
}

export function Dropzone({ onArquivos, ocupado }: Props) {
  const { t } = useT()
  const [sobre, setSobre] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const receber = useCallback(
    (files: FileList | null) => {
      const todos = files ? [...files] : []
      if (todos.length > 0) onArquivos(todos)
    },
    [onArquivos],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setSobre(true)
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault()
        setSobre(false)
        receber(e.dataTransfer.files)
      }}
      className="surgir"
    >
      <button
        type="button"
        disabled={ocupado}
        onClick={() => input.current?.click()}
        className={`group relative w-full overflow-hidden rounded-2xl border border-dashed px-8 py-20 text-left shadow-lg shadow-black/20 transition-all duration-300 ${
          sobre
            ? '-translate-y-1 border-tinta bg-carvao-850 shadow-2xl shadow-black/40'
            : 'border-carvao-600 hover:-translate-y-0.5 hover:border-carvao-600/80 hover:bg-carvao-900 hover:shadow-xl hover:shadow-black/30'
        } ${ocupado ? 'cursor-wait opacity-50 hover:translate-y-0' : 'cursor-pointer'}`}
      >
        <div className="flex items-baseline gap-4">
          <span className="tabular text-xs text-tinta-tenue">01</span>
          <div>
            <p className="font-display text-2xl text-tinta">
              {ocupado ? t('drop.tituloLendo') : t('drop.titulo')}
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-tinta-fraca">
              {interpolarNos(t('drop.corpo'), {
                navegador: <span className="text-tinta">{t('drop.navegador')}</span>,
              })}
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 pl-11">
          <span className="h-px w-8 bg-carvao-600" />
          <span className="tabular text-[11px] uppercase tracking-[0.2em] text-tinta-tenue">
            {ocupado ? t('drop.processando') : t('drop.clique')}
          </span>
          {!ocupado && (
            <span className="text-[11px] text-tinta-tenue">· {t('drop.varios')}</span>
          )}
        </div>
      </button>

      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => receber(e.target.files)}
      />
    </div>
  )
}
