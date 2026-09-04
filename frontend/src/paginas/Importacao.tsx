import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropzone } from '../ui/Dropzone'
import { FalhaImportacao } from '../ui/FalhaImportacao'
import { ResultadoImport } from '../ui/ResultadoImport'
import { useImportacao } from '../dados/ImportacaoProvider'
import { useT } from '../i18n/IdiomaProvider'

/** Importar um PDF: soltar o arquivo e conferir a prévia antes de salvar.
 *
 *  O estado da importação NÃO mora aqui, e sim no `ImportacaoProvider`, que
 *  fica acima das rotas: ele sobrevive à navegação (sair para o Painel e
 *  voltar não pode perder um PDF já lido esperando confirmação). Esta
 *  página é a superfície, não a dona. */
export function Importacao() {
  const {
    estado,
    regras,
    logado,
    salvando,
    recemSalvo,
    progresso,
    importar,
    salvar,
    limpar,
    descartarFalha,
    cancelarFila,
    consumirRecemSalvo,
  } = useImportacao()
  const { t } = useT()
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

  if (estado.fase === 'falhou') {
    const restantes = progresso ? progresso.total - progresso.atual : 0
    return (
      <div className="mx-auto mt-6 max-w-2xl">
        <FalhaImportacao falha={estado.falha} restantes={restantes} onTentarOutro={descartarFalha} />
      </div>
    )
  }

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
          progresso={progresso}
          onCancelarFila={cancelarFila}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <Dropzone onArquivos={importar} ocupado={estado.fase === 'lendo'} />
      {/* Enquanto lê o 3º de 5, a pessoa precisa saber que ainda há fila —
          senão a espera parece travamento. */}
      {progresso && estado.fase === 'lendo' && (
        <p className="tabular mt-4 text-center text-xs text-tinta-tenue">
          {t('fila.progresso', { n: progresso.atual, total: progresso.total })}
        </p>
      )}
    </div>
  )
}
