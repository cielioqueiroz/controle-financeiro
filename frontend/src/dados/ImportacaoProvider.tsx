import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Celebracao } from '../ui/Celebracao'
import { useT } from '../i18n/IdiomaProvider'
import { chaveDeErro } from '../lib/erro-usuario'
import { classificarFalha, type FalhaImportacao } from '../lib/falha-importacao'
import { lerBytes, loadTextItems, PdfDigitalizadoError } from '../domain/pdf/load'
import { buildLines } from '../domain/pdf/lines'
import { pareceDigitalizado } from '../domain/pdf/extract'
import { parse } from '../domain/parsers'
import { validar } from '../domain/validate/checksum'
import { dataLongaDe } from '../domain/normalize/data'
import { salvarDocumento } from '../aplicacao/comandos/importacao'
import type { Regra } from '../domain/categorize/regras'
import type { DocKind } from '../domain/pdf/detect'
import type { ParseResult } from '../domain/parsers/types'

export type EstadoImport =
  | { fase: 'vazio' }
  | { fase: 'lendo'; nome: string }
  | { fase: 'pronto'; kind: DocKind; result: ParseResult; bytes: ArrayBuffer; nome: string }
  /** O documento não entrou, e a tela precisa dizer POR QUÊ.
   *
   *  É fase, e não toast, porque a pessoa precisa da explicação depois de
   *  ela aparecer — para reler, para decidir o que fazer, para fotografar.
   *  Ver `lib/falha-importacao.ts`. */
  | { fase: 'falhou'; falha: FalhaImportacao }

type FluxoImportacao = {
  estado: EstadoImport
  /** Regras aprendidas, para a prévia já mostrar as correções do usuário. */
  regras: Regra[]
  /** Sem sessão dá para ler o PDF e ver a prévia, mas não para gravar. */
  logado: boolean
  salvando: boolean
  /** Ligado por um instante quando um documento acaba de ser gravado. A
   *  página de importação o consome para levar de volta ao Painel. */
  recemSalvo: boolean
  /** Quantos documentos foram gravados nesta sessão. É o sinal que o
   *  `DadosProvider` escuta para reler o histórico.
   *
   *  CONTADOR, e não o `recemSalvo` acima, de propósito: aquele é
   *  CONSUMIDO pela página de importação assim que ela navega, e dois
   *  efeitos disparando no mesmo commit correriam entre si — quem lesse
   *  depois acharia `false` e não releria nada. Um contador que só cresce
   *  não tem corrida: cada valor novo é um evento. */
  salvos: number
  /** Onde a fila está: `{ atual: 2, total: 5 }`. `null` fora de uma leva.
   *
   *  Existe porque importar cinco documentos e não saber em qual deles se
   *  está é pior que importar um por um — a pessoa perde a conta do que já
   *  conferiu. */
  progresso: { atual: number; total: number } | null
  /** Aceita um arquivo ou vários. Vários viram FILA: o app lê um, mostra a
   *  prévia, espera a decisão, e só então começa o próximo. */
  importar: (entrada: File | File[]) => Promise<void>
  salvar: () => Promise<void>
  /** Descarta o documento na tela e passa ao próximo da fila. */
  limpar: () => void
  /** Sai de uma falha de leitura sem sair da tela de importação. */
  descartarFalha: () => void
  /** Abandona a leva inteira, incluindo o que está na tela. */
  cancelarFila: () => void
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
  const [salvos, setSalvos] = useState(0)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)
  /** Os arquivos que ainda não foram lidos.
   *
   *  ⚠️ **`ref`, e não `state`.** Avançar a fila é "tira o próximo E começa a
   *  ler", e pôr o "começa a ler" dentro de um atualizador de estado seria
   *  efeito colateral num lugar que o React pode chamar duas vezes (é o que
   *  o StrictMode faz). O `ref` guarda a fila; o `progresso` acima é a cópia
   *  que a tela lê. */
  const filaRef = useRef<File[]>([])
  const [celebrando, setCelebrando] = useState(false)
  const { t } = useT()

  /** Lê UM arquivo e para na prévia. Não mexe na fila.
   *
   *  ⚠️ **Um `catch` só, e nenhum toast de erro.** Antes eram dois blocos
   *  com seis ramos entre eles, e o ramo final — `toast.error('não consegui
   *  ler')` — engolia todo erro que ninguém tinha previsto. Hoje qualquer
   *  falha vai para o mesmo lugar: `classificarFalha`, que sabe distinguir
   *  as causas, e a fase `falhou`, que fica na tela. */
  const ler = useCallback(async (file: File) => {
    setEstado({ fase: 'lendo', nome: file.name })
    try {
      const bytes = await lerBytes(file)
      const items = await loadTextItems(bytes)
      if (pareceDigitalizado(items)) throw new PdfDigitalizadoError()

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
      setEstado({ fase: 'falhou', falha: classificarFalha(err, file.name) })
    }
    // `t` fora das dependências de propósito: as frases de falha são
    // resolvidas na TELA, a partir das chaves guardadas no estado, então
    // trocar de idioma retraduz a falha que já está lá sem reler o PDF.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** No celular, `type` chega vazio ou `application/octet-stream` com
   *  frequência (arquivo vindo do WhatsApp, do Drive, de um gerenciador de
   *  arquivos), e o nome nem sempre traz a extensão. Recusar por aí barrava
   *  PDF legítimo com a frase errada — "isso não parece um PDF" sobre um
   *  extrato que era, sim, um PDF.
   *
   *  Quem decide de verdade são os BYTES, em `lerBytes`. Aqui só se
   *  descarta o que é declaradamente outra coisa (a foto que veio junto na
   *  seleção múltipla). */
  const ehPdf = (f: File) =>
    /\.pdf$/i.test(f.name) ||
    f.type === 'application/pdf' ||
    f.type === '' ||
    f.type === 'application/octet-stream'

  const importar = useCallback(
    async (entrada: File | File[]) => {
      const todos = Array.isArray(entrada) ? entrada : [entrada]
      const pdfs = todos.filter(ehPdf)
      // Avisa sobre o que ficou de fora em vez de ignorar em silêncio: quem
      // arrasta uma pasta inteira precisa saber que o .jpg não entrou.
      if (pdfs.length < todos.length) {
        toast.error(
          pdfs.length === 0
            ? t('importar.naoPdf')
            : t('importar.ignorados', { n: todos.length - pdfs.length }),
        )
      }
      if (pdfs.length === 0) return

      const [primeiro, ...resto] = pdfs
      filaRef.current = resto
      setProgresso({ atual: 1, total: pdfs.length })
      await ler(primeiro)
    },
    [ler, t],
  )

  /** Resolveu o documento da tela (gravado ou descartado): puxa o próximo.
   *
   *  Quando a fila esvazia é que `recemSalvo` liga — é ele que leva ao
   *  Painel. Navegar a cada documento tiraria a pessoa da fila no meio dela. */
  const avancar = useCallback(async () => {
    const proximo = filaRef.current.shift()
    if (proximo) {
      setProgresso((p) => (p ? { ...p, atual: p.atual + 1 } : p))
      await ler(proximo)
      return
    }
    setProgresso(null)
    setEstado({ fase: 'vazio' })
    setRecemSalvo(true)
  }, [ler])

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
        // `salvos` faz o Painel reler o banco. Até 2026-08-31 ele não
        // existia, e um comentário aqui afirmava que voltar ao Painel
        // "recarrega e mostra o que acabou de entrar" — não recarregava.
        // Voltar é navegar, e o DadosProvider fica ACIMA das rotas.
        setSalvos((n) => n + 1)
        await avancar()
      } else if (r.status === 'documento-duplicado') {
        toast.warning(t('salvar.duplicado', { data: dataLongaDe(new Date(r.importadoEm)) }))
        // Duplicado NÃO trava a fila: é um documento resolvido como outro
        // qualquer. Quem soltou cinco arquivos de uma vez provavelmente
        // repetiu algum, e parar ali obrigaria a recomeçar a leva.
        await avancar()
      }
    } catch (err) {
      toast.error(t(chaveDeErro(err, 'salvar.falha')))
    } finally {
      setSalvando(false)
    }
  }, [estado, regras, t, avancar])

  const limpar = useCallback(() => {
    void avancar()
  }, [avancar])

  /** Sair de uma falha. Puxa o próximo da fila se houver; senão volta à
   *  tela de escolher arquivo.
   *
   *  ⚠️ Não é o `limpar`. Aquele passa pelo `avancar`, que com a fila vazia
   *  liga o `recemSalvo` — e o `recemSalvo` NAVEGA para o Painel. Um botão
   *  "tentar outro arquivo" que tira a pessoa da tela de importação seria a
   *  segunda armadilha do mesmo fluxo. */
  const descartarFalha = useCallback(() => {
    const proximo = filaRef.current.shift()
    if (proximo) {
      setProgresso((p) => (p ? { ...p, atual: p.atual + 1 } : p))
      void ler(proximo)
      return
    }
    setProgresso(null)
    setEstado({ fase: 'vazio' })
  }, [ler])

  const cancelarFila = useCallback(() => {
    const restantes = filaRef.current.length
    filaRef.current = []
    setProgresso(null)
    setEstado({ fase: 'vazio' })
    if (restantes > 0) toast.warning(t('fila.cancelada', { n: restantes }))
  }, [t])
  const consumirRecemSalvo = useCallback(() => setRecemSalvo(false), [])

  const valor = useMemo(
    () => ({
      estado,
      regras,
      logado,
      salvando,
      recemSalvo,
      salvos,
      progresso,
      importar,
      salvar,
      limpar,
      descartarFalha,
      cancelarFila,
      consumirRecemSalvo,
    }),
    [
      estado,
      regras,
      logado,
      salvando,
      recemSalvo,
      salvos,
      progresso,
      importar,
      salvar,
      limpar,
      descartarFalha,
      cancelarFila,
      consumirRecemSalvo,
    ],
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

/** A variante que NÃO lança, para quem só quer saber se houve importação.
 *
 *  É a mesma distinção que o projeto já faz entre `useDados` (lança: uma
 *  página fora da árvore é erro) e `useDiscreto` (padrão seguro: um
 *  componente isolado num teste não deve quebrar por causa de um modo de
 *  exibição). Aqui a ausência é legítima e prevista: o `DadosProvider` é
 *  montado sem o de importação na folha de provas e em vários testes de
 *  página, e ali simplesmente não há importação para escutar. */
export function useImportacaoOpcional(): FluxoImportacao | null {
  return useContext(Ctx)
}
