import type { TextItem } from './types'

export type Cell = {
  text: string
  /** Borda esquerda. Use para texto alinhado à esquerda (descrições). */
  x: number
  width: number
  /** Borda direita (x + width). Use para números.
   *
   *  Valores monetários são alinhados à DIREITA: "0,00" e "10.000,00" na
   *  mesma coluna têm bordas esquerdas a 20pt de distância e bordas
   *  direitas idênticas. Casar por X esquerdo classifica valor curto e
   *  longo como colunas diferentes — no extrato Bradesco isso faria
   *  crédito virar débito conforme o tamanho do número. */
  right: number
}

export type Line = { cells: Cell[]; text: string; y: number; page: number }

/** Items na mesma linha visual raramente têm Y idêntico. */
const TOLERANCIA_Y = 2

/** Tolerância padrão para casar borda direita de coluna. As bordas
 *  observadas no extrato Bradesco variam ~0,1pt dentro da mesma coluna
 *  e ~64pt entre colunas — 3pt separa com folga. */
const TOLERANCIA_COLUNA = 3

/** Agrupa items por linha visual e ordena as células por X.
 *
 *  A ordem de extração do pdf.js não acompanha a ordem visual. */
export function buildLines(
  items: TextItem[],
  tolerancia: number = TOLERANCIA_Y,
): Line[] {
  const grupos: TextItem[][] = []

  const ordenados = [...items].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    return b.y - a.y // Y do PDF cresce para cima
  })

  for (const item of ordenados) {
    const grupo = grupos.find((g) => {
      const ref = g[0]
      return ref.page === item.page && Math.abs(ref.y - item.y) <= tolerancia
    })
    if (grupo) grupo.push(item)
    else grupos.push([item])
  }

  return grupos.map((grupo) => {
    const cells: Cell[] = grupo
      .sort((a, b) => a.x - b.x)
      .map((i) => ({
        text: i.text,
        x: i.x,
        width: i.width,
        right: i.x + i.width,
      }))

    return {
      cells,
      text: cells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim(),
      y: grupo[0].y,
      page: grupo[0].page,
    }
  })
}

/** Lê uma coluna de texto alinhado à esquerda, por faixa de borda esquerda. */
export function cellAt(line: Line, xMin: number, xMax: number): string | null {
  const dentro = line.cells.filter((c) => c.x >= xMin && c.x <= xMax)
  if (dentro.length === 0) return null
  return dentro.map((c) => c.text).join(' ').trim()
}

/** Lê uma coluna de números, por borda DIREITA.
 *
 *  cellAtRight(linha, 490.5) lê a coluna Débito do extrato Bradesco,
 *  independente de o valor ser "9,21" ou "10.000,00". */
export function cellAtRight(
  line: Line,
  right: number,
  tolerancia: number = TOLERANCIA_COLUNA,
): string | null {
  const dentro = line.cells.filter(
    (c) => Math.abs(c.right - right) <= tolerancia,
  )
  if (dentro.length === 0) return null
  return dentro.map((c) => c.text).join(' ').trim()
}
