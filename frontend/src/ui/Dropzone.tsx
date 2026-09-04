import { useCallback, useRef, useState } from 'react'
import { useT } from '../i18n/IdiomaProvider'
import { interpolarNos } from '../i18n/interpolarNos'

type Props = {
  /** Recebe TODOS os arquivos soltos de uma vez. Quem enfileira é o
   *  provider — aqui só se entrega o que a pessoa escolheu. */
  onArquivos: (files: File[]) => void
  ocupado: boolean
}

/** A porta de entrada do app: é aqui que o documento do banco vira dado.
 *
 *  ## Por que o cartão inteiro é UM botão
 *
 *  Porque no celular não existe arrastar. A tela era escrita para o mouse —
 *  "solte o arquivo aqui", com um "ou clique para escolher" em cinza claro,
 *  minúsculo, no canto — e num celular isso descreve uma ação impossível e
 *  esconde a única que funciona. Hoje o alvo de toque é o cartão todo, o
 *  chamado para agir aparece como botão de verdade, e o texto sobre arrastar
 *  só existe onde arrastar existe (`sm:` para cima).
 *
 *  O `<span>` com cara de botão dentro do `<button>` é de propósito: botão
 *  dentro de botão é HTML inválido, e dois controles empilhados dariam dois
 *  alvos de toque para a mesma ação. */
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
        className={`group relative w-full overflow-hidden rounded-2xl border border-dashed px-5 py-10 text-left shadow-lg shadow-black/20 transition-all duration-300 sm:px-8 sm:py-16 ${
          sobre
            ? '-translate-y-1 border-tinta bg-carvao-850 shadow-2xl shadow-black/40'
            : 'border-carvao-600 hover:-translate-y-0.5 hover:border-carvao-600/80 hover:bg-carvao-900 hover:shadow-xl hover:shadow-black/30'
        } ${ocupado ? 'cursor-wait opacity-50 hover:translate-y-0' : 'cursor-pointer'}`}
      >
        <div className="flex items-baseline gap-3 sm:gap-4">
          <span className="tabular text-xs text-tinta-tenue">01</span>
          <div className="min-w-0">
            <p className="font-display text-xl text-tinta sm:text-2xl">
              {ocupado ? t('drop.tituloLendo') : t('drop.titulo')}
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-tinta-fraca">
              {interpolarNos(t('drop.corpo'), {
                navegador: <span className="text-tinta">{t('drop.navegador')}</span>,
              })}
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 sm:pl-11">
          {/* Alvo de 48px de altura: dedo, não ponteiro. */}
          <span
            className={`inline-flex min-h-12 items-center rounded-xl px-5 text-sm font-medium transition-opacity ${
              ocupado
                ? 'bg-carvao-800 text-tinta-fraca'
                : 'bg-tinta text-carvao-950 group-hover:opacity-90'
            }`}
          >
            {ocupado ? t('drop.processando') : t('drop.escolher')}
          </span>
          {/* Arrastar só é dica onde arrastar existe. */}
          {!ocupado && (
            <span className="tabular hidden text-[11px] uppercase tracking-[0.2em] text-tinta-tenue sm:inline">
              {t('drop.ouArraste')}
            </span>
          )}
        </div>

        {!ocupado && (
          <p className="mt-4 text-xs text-tinta-tenue sm:pl-11">{t('drop.varios')}</p>
        )}
      </button>

      <input
        ref={input}
        type="file"
        multiple
        // `application/pdf` primeiro e a extensão depois: no Android alguns
        // gerenciadores de arquivos filtram só pelo tipo MIME e outros só
        // pela extensão, e um PDF vindo do WhatsApp pode não ter nenhum dos
        // dois. Quem decide de verdade é o `lerBytes`, que olha o conteúdo.
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          receber(e.target.files)
          // Zera o input: escolher O MESMO arquivo duas vezes seguidas (o
          // caso de "falhou, baixei de novo, tentei outra vez") não dispara
          // `change` se o valor não mudou.
          e.target.value = ''
        }}
      />
    </div>
  )
}
