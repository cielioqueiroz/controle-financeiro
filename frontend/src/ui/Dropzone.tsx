import { useCallback, useRef, useState } from 'react'
import { useT } from '../i18n/IdiomaProvider'
import { interpolarNos } from '../i18n/interpolarNos'

type Props = {
  onArquivo: (file: File) => void
  ocupado: boolean
}

export function Dropzone({ onArquivo, ocupado }: Props) {
  const { t } = useT()
  const [sobre, setSobre] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const receber = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) onArquivo(file)
    },
    [onArquivo],
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
        // O tracejado FICA e ganha sentido: virou vocabulário da direção
        // (regra 5 do index.css). Saíram a sombra e o levantar — regras 2 e 7.
        className={`group relative w-full overflow-hidden border border-dashed px-8 py-20 text-left transition-colors duration-150 ${
          sobre
            ? 'border-tinta bg-afundado'
            : 'border-regua-forte hover:border-tinta-tenue hover:bg-afundado'
        } ${ocupado ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}
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

        <div className="mt-10 flex items-center gap-3 pl-11">
          <span className="h-px w-8 bg-carvao-600" />
          <span className="tabular text-[11px] uppercase tracking-[0.2em] text-tinta-tenue">
            {ocupado ? t('drop.processando') : t('drop.clique')}
          </span>
        </div>
      </button>

      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => receber(e.target.files)}
      />
    </div>
  )
}
