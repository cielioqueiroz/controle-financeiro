import { useCallback, useRef, useState } from 'react'

type Props = {
  onArquivo: (file: File) => void
  ocupado: boolean
}

export function Dropzone({ onArquivo, ocupado }: Props) {
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
              {ocupado ? 'Lendo o documento…' : 'Solte a fatura ou o extrato aqui'}
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-tinta-fraca">
              PDF do banco, do jeito que ele te mandou. O arquivo é lido{' '}
              <span className="text-tinta">no seu navegador</span> e não sai
              deste computador.
            </p>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-3 pl-11">
          <span className="h-px w-8 bg-carvao-600" />
          <span className="tabular text-[11px] uppercase tracking-[0.2em] text-tinta-tenue">
            {ocupado ? 'processando' : 'ou clique para escolher'}
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
