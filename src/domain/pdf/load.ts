import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extractFromDocument } from './extract'
import type { TextItem } from './types'

/** O pdf.js roda o parsing numa worker thread — sem isso a UI congela
 *  enquanto lê uma fatura de 8 páginas. */
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export class PdfProtegidoError extends Error {
  constructor() {
    super('PDF protegido por senha')
    this.name = 'PdfProtegidoError'
  }
}

/** Lê um PDF do disco do usuário. O arquivo NUNCA sai do navegador —
 *  só o resultado estruturado é persistido. Ver spec, decisão #4. */
export async function loadTextItems(file: File): Promise<TextItem[]> {
  const data = new Uint8Array(await file.arrayBuffer())

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
