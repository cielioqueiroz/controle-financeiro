import { extractFromDocument } from './extract'
import type { TextItem } from './types'

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

export function validarArquivoPdf(file: File): void {
  if (file.size > MAX_PDF_BYTES) throw new PdfGrandeError()
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
    ]).then(([pdfjs, worker]) => {
      // O pdf.js roda o parsing numa worker thread — sem isso a UI congela
      // enquanto lê uma fatura de 8 páginas.
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPronto
}

/** Lê um PDF do disco do usuário. O arquivo NUNCA sai do navegador —
 *  só o resultado estruturado é persistido. Ver spec, decisão #4. */
export async function loadTextItems(file: File): Promise<TextItem[]> {
  validarArquivoPdf(file)
  const data = new Uint8Array(await file.arrayBuffer())

  const pdfjs = await carregarPdfjs()
  try {
    const doc = await pdfjs.getDocument({ data }).promise
    return await extractFromDocument(doc)
  } catch (err) {
    if (
      err instanceof Error &&
      /password/i.test(err.message)
    ) {
      throw new PdfProtegidoError()
    }
    throw err
  }
}
