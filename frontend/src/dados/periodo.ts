import { mesAbrev } from '../domain/normalize/data'
import type { Periodo } from '../persist/agrupar'

/** Move a data de referência um período para trás/frente. */
export function mover(periodo: Periodo, ref: Date, dir: -1 | 1): Date {
  const d = new Date(ref)
  switch (periodo) {
    case 'dia':
      d.setDate(d.getDate() + dir)
      break
    case 'semana':
      d.setDate(d.getDate() + dir * 7)
      break
    case 'mes':
      d.setMonth(d.getMonth() + dir)
      break
    case 'ano':
      d.setFullYear(d.getFullYear() + dir)
      break
  }
  return d
}

/** Como o período aparece escrito no cabeçalho e no nome do PDF. */
export function rotuloPeriodo(periodo: Periodo, ref: Date): string {
  const d = ref
  switch (periodo) {
    case 'dia':
      return `${d.getDate()} ${mesAbrev(d)} ${d.getFullYear()}`
    case 'semana': {
      // Semana começa na segunda: getDay() dá 0 para domingo, e o `+6 % 7`
      // roda a régua para que segunda seja 0.
      const dow = (d.getDay() + 6) % 7
      const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
      const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6)
      return `${ini.getDate()} ${mesAbrev(ini)} – ${fim.getDate()} ${mesAbrev(fim)}`
    }
    case 'mes':
      return `${mesAbrev(d)} ${d.getFullYear()}`
    case 'ano':
      return `${d.getFullYear()}`
  }
}
