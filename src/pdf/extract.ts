import type { TextItem } from './types'

/** Formato mínimo que consumimos do pdf.js. Declarado aqui para manter
 *  esta função pura e testável sem carregar o pdf.js. */
type PdfTextItem = {
  str: string
  transform: number[]
  width: number
  height: number
}

type PdfTextContent = { items: Array<PdfTextItem | unknown> }

type PdfPage = { getTextContent(): Promise<PdfTextContent> }

type PdfDocument = {
  numPages: number
  getPage(n: number): Promise<PdfPage>
}

/** Converte o text content de uma página em TextItem[].
 *
 *  Pura de propósito: quem carrega o pdf.js é o chamador. No navegador
 *  isso passa por um worker; no Node (script de fixtures) não. Esta
 *  função não precisa saber a diferença. */
export function mapTextContent(
  content: PdfTextContent,
  page: number,
): TextItem[] {
  const items: TextItem[] = []

  for (const raw of content.items) {
    if (typeof raw !== 'object' || raw === null) continue
    if (!('str' in raw) || !('transform' in raw)) continue

    const item = raw as PdfTextItem
    if (item.str.trim() === '') continue

    // transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
    const x = item.transform[4]
    const y = item.transform[5]

    items.push({
      text: item.str,
      x,
      y,
      width: item.width,
      height: item.height,
      page,
    })
  }

  return items
}

/** Percorre todas as páginas de um documento já carregado. */
export async function extractFromDocument(
  doc: PdfDocument,
): Promise<TextItem[]> {
  const items: TextItem[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    items.push(...mapTextContent(content, pageNum))
  }

  return items
}

/** Um PDF digitalizado tem páginas mas nenhum texto extraível. */
export function pareceDigitalizado(items: TextItem[]): boolean {
  return items.length === 0
}
