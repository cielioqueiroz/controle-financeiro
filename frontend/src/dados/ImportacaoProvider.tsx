import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Celebracao } from '../ui/Celebracao'
import { useT } from '../i18n/IdiomaProvider'
import { chaveDeErro } from '../lib/erro-usuario'
import { loadTextItems, PdfProtegidoError } from '../domain/pdf/load'
import { buildLines } from '../domain/pdf/lines'
import { pareceDigitalizado } from '../domain/pdf/extract'
import { parse, ParserNaoImplementadoError } from '../domain/parsers'
import { validar } from '../domain/validate/checksum'
import { dataLongaDe } from '../domain/normalize/data'
import { salvarDocumento } from '../persist/salvar'
import type { Regra } from '../domain/categorize/regras'
import type { DocKind } from '../domain/pdf/detect'
import type { ParseResult } from '../domain/parsers/types'

export type EstadoImport =
  | { fase: 'vazio' }
  | { fase: 'lendo' }
  | { fase: 'pronto'; kind: DocKind; result: ParseResult; bytes: ArrayBuffer; nome: string }

type FluxoImportacao = {
  estado: EstadoImport
  /** Regras aprendidas, para a prévia já mostrar as correções do usuário. */
  regras: Regra[]
  /** Sem sessão dá para ler o PDF e ver a prévia, mas não para gravar. */
  logado: boolean
  salvando: boolean
  /** Ligado por um instante quando um documento acaba de ser gravado. A
   *  página de importação o consome para levar de volta ao Painel — onde o
   *  dado recém-importado aparece. */
  recemSalvo: boolean
  importar: (f: File) => Promise<void>
  salvar: () => Promise<void>
  limpar: () => void
  consumirRecemSalvo: () => void
}

const Ctx = createContext<FluxoImportacao | null>(null)

/** Dono do fluxo de importação: ler o PDF, mostrar a prévia, gravar.
 *
 *  Precisa ficar ACIMA das rotas, e é essa a razão de existir. O estado
 *  sobrevive à navegação — sair para o Painel e voltar não pode perder um
 *  PDF já lido esperando confirmação —, então mover isto para dentro da
 *  página `Importacao` quebraria o comportamento em silêncio: nenhum teste
 *  cobre a ida e volta.
 *
 *  Envolve os DOIS galhos (logado e "importa e vê"): o segundo não tem
 *  rotas, mas tem a mesma tela de importação. */
export function ImportacaoProvider({
  regras,
  logado,
  children,
}: {
  regras: Regra[]
  logado: boolean
  children: ReactNode
}) {
  const [estado, setEstado] = useState<EstadoImport>({ fase: 'vazio' })
  const [salvando, setSalvando] = useState(false)
  const [recemSalvo, setRecemSalvo] = useState(false)
  const [celebrando, setCelebrando] = useState(false)
  const { t } = useT()

  const importar = useCallback(
    async (file: File) => {
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        toast.error(t('importar.naoPdf'))
        return
      }
      setEstado({ fase: 'lendo' })
      try {
        const bytes = await file.arrayBuffer()
        const items = await loadTextItems(new File([bytes], file.name, { type: file.type }))
        if (pareceDigitalizado(items)) {
          toast.error(t('importar.digitalizado'))
          setEstado({ fase: 'vazio' })
          return
        }
        const lines = buildLines(items)
        const { kind, result } = parse(lines)
        const v = validar(result)
        setEstado({ fase: 'pronto', kind, result, bytes, nome: file.name })

        if (v.status === 'confere') {
          toast.success(t('importar.toastConfere', { n: v.contagem }))
          setCelebrando(true) // bateu ao centavo: momento de confete
        } else if (v.status === 'sem-gabarito') {
          toast.warning(t('importar.toastSemGabarito', { n: v.contagem }))
        } else {
          toast.error(t('importar.toastNaoFechou'))
        }
      } catch (err) {
        setEstado({ fase: 'vazio' })
        if (err instanceof PdfProtegidoError) toast.error(t('importar.protegido'))
        else if (err instanceof ParserNaoImplementadoError)
          toast.warning(t('importar.emBreve', { msg: err.message }))
        else toast.error(t('importar.naoLi'))
      }
    },
    [t],
  )

  const salvar = useCallback(async () => {
    if (estado.fase !== 'pronto') return
    setSalvando(true)
    try {
      const r = await salvarDocumento(estado.result, estado.kind, estado.bytes, estado.nome, regras)
      if (r.status === 'salvo') {
        toast.success(
          r.jaExistiam > 0
            ? t('salvar.okComExistentes', { n: r.inseridas, ja: r.jaExistiam })
            : t('salvar.okNovos', { n: r.inseridas }),
        )
        // Volta ao histórico, que recarrega e mostra o que acabou de entrar.
        setEstado({ fase: 'vazio' })
        setRecemSalvo(true)
      } else if (r.status === 'documento-duplicado') {
        toast.warning(t('salvar.duplicado', { data: dataLongaDe(new Date(r.importadoEm)) }))
      }
    } catch (err) {
      toast.error(t(chaveDeErro(err, 'salvar.falha')))
    } finally {
      setSalvando(false)
    }
  }, [estado, regras, t])

  const limpar = useCallback(() => setEstado({ fase: 'vazio' }), [])
  const consumirRecemSalvo = useCallback(() => setRecemSalvo(false), [])

  const valor = useMemo(
    () => ({
      estado,
      regras,
      logado,
      salvando,
      recemSalvo,
      importar,
      salvar,
      limpar,
      consumirRecemSalvo,
    }),
    [estado, regras, logado, salvando, recemSalvo, importar, salvar, limpar, consumirRecemSalvo],
  )

  return (
    <Ctx.Provider value={valor}>
      {children}
      {/* Mora aqui porque quem dispara o confete é o `importar` acima. Vai
          para um Portal (ver Celebracao.tsx), então a posição na árvore não
          afeta o layout. */}
      <Celebracao ativo={celebrando} onFim={() => setCelebrando(false)} />
    </Ctx.Provider>
  )
}

/** Lança fora do provider, como o `useDados`: é erro de programação, e
 *  falhar alto no teste é melhor que uma tela de importação inerte. */
export function useImportacao(): FluxoImportacao {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useImportacao precisa estar dentro de <ImportacaoProvider>')
  return ctx
}
