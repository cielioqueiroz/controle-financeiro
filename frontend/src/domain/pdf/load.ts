import { extractFromDocument } from './extract'
import type { TextItem } from './types'

/** ## Por que existem SETE erros aqui, e não um só
 *
 *  Até 2026-09-04 tudo o que dava errado na leitura virava a mesma frase na
 *  tela: "Não consegui ler este arquivo." Ela cobria coisas sem nada em
 *  comum — o arquivo que o Android não entregou, o PDF de zero byte, o
 *  documento com senha, o leitor que não baixou — e, das quatro, três têm
 *  saída do lado de quem lê. Foi assim que uma importação que falhava num
 *  celular ficou sem diagnóstico possível: a mensagem não distinguia
 *  "escolha o arquivo de novo" de "esse banco eu ainda não sei ler".
 *
 *  Cada classe abaixo é uma causa que leva a uma frase e a uma ação
 *  DIFERENTES. Quem traduz isso para o usuário é `lib/falha-importacao.ts`. */

export class PdfProtegidoError extends Error {
  constructor() {
    super('PDF protegido por senha')
    this.name = 'PdfProtegidoError'
  }
}

export const MAX_PDF_BYTES = 25 * 1024 * 1024

export class PdfGrandeError extends Error {
  constructor() {
    super('PDF maior que o limite permitido')
    this.name = 'PdfGrandeError'
  }
}

/** O navegador não conseguiu entregar os bytes do arquivo.
 *
 *  É a falha típica do CELULAR, e não acontece no desktop: no Android, o
 *  seletor devolve um arquivo que ainda mora no Google Drive, no OneDrive ou
 *  no WhatsApp, e o `arrayBuffer()` estoura com `NotReadableError` quando o
 *  provedor não materializa o conteúdo. O arquivo existe, tem nome e
 *  tamanho — só não há bytes. A saída é baixar para o aparelho antes. */
export class ArquivoIlegivelError extends Error {
  readonly causa: unknown

  constructor(causa?: unknown) {
    super('O navegador não conseguiu ler os bytes do arquivo')
    this.name = 'ArquivoIlegivelError'
    this.causa = causa
  }
}

export class ArquivoVazioError extends Error {
  constructor() {
    super('Arquivo sem conteúdo (0 byte)')
    this.name = 'ArquivoVazioError'
  }
}

/** Tem nome de PDF, mas os bytes dizem outra coisa.
 *
 *  Vale mais que o `type` do `File`: no celular ele vem vazio ou
 *  `application/octet-stream` com frequência, e o nome pode não ter extensão
 *  nenhuma quando o arquivo chega de um app de mensagens. */
export class NaoEhPdfError extends Error {
  constructor() {
    super('O conteúdo do arquivo não é um PDF')
    this.name = 'NaoEhPdfError'
  }
}

/** Páginas sem uma única letra extraível: foto de papel salva como PDF, ou
 *  o print da tela do app do banco. Não é defeito nosso nem do arquivo — é
 *  o limite de ler texto em vez de enxergar imagem. */
export class PdfDigitalizadoError extends Error {
  constructor() {
    super('PDF sem texto extraível (digitalizado)')
    this.name = 'PdfDigitalizadoError'
  }
}

export class PdfCorrompidoError extends Error {
  readonly causa: unknown

  constructor(causa?: unknown) {
    super('PDF danificado ou incompleto')
    this.name = 'PdfCorrompidoError'
    this.causa = causa
  }
}

/** O pdf.js não chegou. São ~400 kB por import dinâmico: numa rede móvel
 *  ruim o download falha, e falhar aqui não é culpa do documento. */
export class LeitorIndisponivelError extends Error {
  readonly causa: unknown

  constructor(causa?: unknown) {
    super('Não foi possível carregar o leitor de PDF')
    this.name = 'LeitorIndisponivelError'
    this.causa = causa
  }
}

export function validarArquivoPdf(file: File): void {
  if (file.size > MAX_PDF_BYTES) throw new PdfGrandeError()
  if (file.size === 0) throw new ArquivoVazioError()
}

/** `%PDF-` nos primeiros 1024 bytes.
 *
 *  A janela não é capricho: a especificação exige o cabeçalho no começo, mas
 *  o próprio pdf.js aceita lixo antes dele (assinatura digital, cabeçalho de
 *  e-mail), e recusar aqui o que o leitor abriria seria trocar um documento
 *  bom por uma mensagem de erro. */
export function pareceMesmoPdf(bytes: ArrayBuffer): boolean {
  const janela = new Uint8Array(bytes, 0, Math.min(1024, bytes.byteLength))
  // "%PDF-"
  const alvo = [0x25, 0x50, 0x44, 0x46, 0x2d]
  for (let i = 0; i + alvo.length <= janela.length; i++) {
    let bate = true
    for (let j = 0; j < alvo.length; j++) {
      if (janela[i + j] !== alvo[j]) {
        bate = false
        break
      }
    }
    if (bate) return true
  }
  return false
}

/** Tira os bytes do arquivo UMA vez e diz, com precisão, o que deu errado.
 *
 *  Uma vez só de propósito. O provider lia o arquivo, montava um `File` novo
 *  com o resultado e mandava para cá, que lia de novo — três cópias do
 *  documento vivas ao mesmo tempo. Num desktop isso passa despercebido; num
 *  celular de 3 GB com o navegador cheio de abas, é o tipo de desperdício
 *  que termina em aba recarregada no meio da importação.
 *
 *  A volta é `ArrayBuffer` e não `File` porque é isso que o pdf.js quer e é
 *  isso que o provider guarda para gravar depois. */
export async function lerBytes(file: File): Promise<ArrayBuffer> {
  validarArquivoPdf(file)

  let bytes: ArrayBuffer
  try {
    bytes = await file.arrayBuffer()
  } catch (err) {
    throw new ArquivoIlegivelError(err)
  }

  if (bytes.byteLength === 0) throw new ArquivoVazioError()
  if (!pareceMesmoPdf(bytes)) throw new NaoEhPdfError()
  return bytes
}

/** O pdf.js entra por import dinâmico: são ~400 kB que só quem importa um
 *  PDF paga — fora do bundle inicial, como o three.js e o jsPDF. A promise
 *  é memoizada para o download acontecer uma vez só. */
let pdfjsPronto: Promise<typeof import('pdfjs-dist')> | null = null

function carregarPdfjs() {
  if (!pdfjsPronto) {
    pdfjsPronto = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
      .then(([pdfjs, worker]) => {
        // O pdf.js roda o parsing numa worker thread — sem isso a UI congela
        // enquanto lê uma fatura de 8 páginas.
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default
        return pdfjs
      })
      .catch((err) => {
        // Zera a memoização: uma falha de rede não pode condenar a aba
        // inteira a nunca mais conseguir importar. A próxima tentativa
        // baixa de novo.
        pdfjsPronto = null
        throw new LeitorIndisponivelError(err)
      })
  }
  return pdfjsPronto
}

/** Lê um PDF já carregado em memória. O arquivo NUNCA sai do navegador —
 *  só o resultado estruturado é persistido. Ver ADR-0003.
 *
 *  ⚠️ **Recebe uma CÓPIA dos bytes.** O pdf.js transfere o buffer para a
 *  worker thread, e um `ArrayBuffer` transferido fica DETACHED do lado de
 *  cá: quem tentasse gravar o documento depois encontraria zero byte. */
export async function loadTextItems(bytes: ArrayBuffer): Promise<TextItem[]> {
  const pdfjs = await carregarPdfjs()
  const copia = bytes.slice(0)
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(copia) }).promise
    return await extractFromDocument(doc, {
      setFillRGBColor: pdfjs.OPS.setFillRGBColor,
      setTextMatrix: pdfjs.OPS.setTextMatrix,
      showText: pdfjs.OPS.showText,
    })
  } catch (err) {
    throw traduzirErroDoPdfjs(err)
  }
}

/** O pdf.js tem taxonomia própria de exceções, e ela chega aqui pelo `name`.
 *
 *  O `name` vem antes da mensagem porque a mensagem muda entre versões e
 *  pode ser localizada; `PasswordException` e `InvalidPDFException` são
 *  parte da API pública dele. O teste por texto fica como rede de segurança
 *  para o dia em que a classe vier embrulhada por outra camada. */
function traduzirErroDoPdfjs(err: unknown): Error {
  const nome = err instanceof Error ? err.name : ''
  const msg = err instanceof Error ? err.message : String(err ?? '')

  if (nome === 'PasswordException' || /password/i.test(msg)) return new PdfProtegidoError()
  if (nome === 'InvalidPDFException' || /invalid pdf|structure/i.test(msg))
    return new PdfCorrompidoError(err)
  if (nome === 'MissingPDFException' || /missing pdf|unexpected server response/i.test(msg))
    return new ArquivoIlegivelError(err)
  return err instanceof Error ? err : new Error(String(err))
}
