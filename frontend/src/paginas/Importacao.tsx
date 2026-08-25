import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropzone } from '../ui/Dropzone'
import { ResultadoImport } from '../ui/ResultadoImport'
import { useImportacao } from '../dados/ImportacaoProvider'

/** Importar um PDF: soltar o arquivo e conferir a prévia antes de salvar.
 *
 *  O estado da importação NÃO mora aqui, e sim no `ImportacaoProvider`, que
 *  fica acima das rotas: ele sobrevive à navegação (sair para o Painel e
 *  voltar não pode perder um PDF já lido esperando confirmação). Esta
 *  página é a superfície, não a dona. */
export function Importacao() {
  const { estado, regras, logado, salvando, recemSalvo, importar, salvar, limpar, consumirRecemSalvo } =
    useImportacao()
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
    consumirRecemSalvo()
    navigate('/', { replace: true })
  }, [recemSalvo, navigate, consumirRecemSalvo])

  if (estado.fase === 'pronto') {
    return (
      <div className="mx-auto mt-6 max-w-4xl">
        <ResultadoImport
          kind={estado.kind}
          result={estado.result}
          regras={regras}
          podeSalvar={logado}
          salvando={salvando}
          onSalvar={salvar}
          onLimpar={limpar}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <Dropzone onArquivo={importar} ocupado={estado.fase === 'lendo'} />
    </div>
  )
}
