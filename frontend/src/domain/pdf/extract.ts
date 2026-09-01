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

type PdfPage = {
  getTextContent(): Promise<PdfTextContent>
  getOperatorList?(): Promise<{ fnArray: number[]; argsArray: unknown[] }>
}

export type PdfOperators = {
  setFillRGBColor: number
  setTextMatrix: number
  showText: number
}

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
  operators?: PdfOperators,
): Promise<TextItem[]> {
  const items: TextItem[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    const pageItems = mapTextContent(content, pageNum)
    if (operators && page.getOperatorList) {
      const operatorList = await page.getOperatorList()
      const colors = colorsFromOperators(operatorList, operators, pageItems)
      items.push(...pageItems.map((item, index) => ({ ...item, color: colors[index] })))
    } else {
      items.push(...pageItems)
    }
  }

  return items
}

function colorsFromOperators(
  list: { fnArray: number[]; argsArray: unknown[] },
  operators: PdfOperators,
  items: TextItem[],
): Array<string | undefined> {
  let color = '#000000'
  let x = 0
  let y = 0
  const emitted: Array<{ text: string; x: number; y: number; color: string }> = []

  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i]
    const args = list.argsArray[i]
    if (fn === operators.setFillRGBColor && Array.isArray(args) && typeof args[0] === 'string') {
      color = args[0]
    } else if (fn === operators.setTextMatrix && Array.isArray(args)) {
      const matrix = args[0]
      if (typeof matrix === 'object' && matrix !== null && '4' in matrix && '5' in matrix) {
        const values = matrix as { 4: unknown; 5: unknown }
        if (typeof values[4] === 'number' && typeof values[5] === 'number') {
          x = values[4]
          y = values[5]
        }
      }
    } else if (fn === operators.showText && Array.isArray(args) && Array.isArray(args[0])) {
      const text = args[0]
        .map((glyph: unknown) => {
          if (typeof glyph === 'string') return glyph
          if (typeof glyph === 'object' && glyph !== null && 'unicode' in glyph) {
            const unicode = (glyph as { unicode: unknown }).unicode
            return typeof unicode === 'string' ? unicode : ''
          }
          return ''
        })
        .join('')
      if (text.trim()) emitted.push({ text, x, y, color })
    }
  }

  const used = new Set<number>()
  return items.map((item) => {
    let best = -1
    let distance = Number.POSITIVE_INFINITY
    for (let i = 0; i < emitted.length; i++) {
      if (used.has(i) || emitted[i].text !== item.text) continue
      const candidate = emitted[i]
      const d = Math.abs(candidate.x - item.x) + Math.abs(candidate.y - item.y)
      if (d < distance) {
        best = i
        distance = d
      }
    }
    if (best < 0 || distance > 3) return undefined
    used.add(best)
    return emitted[best].color
  })
}

/** Um PDF digitalizado tem páginas mas nenhum texto extraível. */
export function pareceDigitalizado(items: TextItem[]): boolean {
  return items.length === 0
}
