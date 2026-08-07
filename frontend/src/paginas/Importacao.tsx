import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropzone } from '../ui/Dropzone'
import { ResultadoImport } from '../ui/ResultadoImport'
import type { Regra } from '../domain/categorize/regras'
import type { DocKind } from '../domain/pdf/detect'
import type { ParseResult } from '../domain/parsers/types'

export type EstadoImport =
  | { fase: 'vazio' }
  | { fase: 'lendo' }
  | { fase: 'pronto'; kind: DocKind; result: ParseResult; bytes: ArrayBuffer; nome: string }

type Props = {
  estado: EstadoImport
  regras: Regra[]
  logado: boolean
  salvando: boolean
  /** Ficou true quando um documento acabou de ser gravado. Serve só para
   *  levar de volta ao Painel; é consumido (zerado) ao ser usado. */
  recemSalvo?: boolean
  onArquivo: (f: File) => void
  onSalvar: () => void
  onLimpar: () => void
  onConsumirRecemSalvo?: () => void
}

/** Importar um PDF: soltar o arquivo e conferir a prévia antes de salvar.
 *
 *  O estado da importação continua morando no App, não aqui: ele sobrevive
 *  à navegação (sair para o Painel e voltar não pode perder um PDF já lido
 *  esperando confirmação) e o `salvar` precisa das regras aprendidas, que
 *  são do App. Esta página é a superfície, não a dona. */
export function Importacao({
  estado,
  regras,
  logado,
  salvando,
  recemSalvo,
  onArquivo,
  onSalvar,
  onLimpar,
  onConsumirRecemSalvo,
}: Props) {
  const navigate = useNavigate()

  // Gravou: leva ao Painel, que é onde o dado recém-importado aparece.
  // Quem navega é esta página, não o App: o App cria o BrowserRouter, então
  // está FORA dele e não pode usar useNavigate.
  //
  // O flag é consumido junto com a navegação. Sem isso, voltar depois a
  // /importar para trazer outro extrato remontaria este efeito com o flag
  // ainda ligado e chutaria a pessoa para o Painel de novo.
  useEffect(() => {
    if (!recemSalvo) return
    onConsumirRecemSalvo?.()
    navigate('/', { replace: true })
  }, [recemSalvo, navigate, onConsumirRecemSalvo])

  if (estado.fase === 'pronto') {
    return (
      <div className="mx-auto mt-6 max-w-4xl">
        <ResultadoImport
          kind={estado.kind}
          result={estado.result}
          regras={regras}
          podeSalvar={logado}
          salvando={salvando}
          onSalvar={onSalvar}
          onLimpar={onLimpar}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <Dropzone onArquivo={onArquivo} ocupado={estado.fase === 'lendo'} />
    </div>
  )
}
