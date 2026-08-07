import type { Periodo } from '../persist/agrupar'

/** O estado da tela que vale a pena sobreviver a um F5 e caber num link.
 *  Fica na URL, não em useState: recarregar não perde o recorte, e mandar
 *  a tela para alguém é copiar o endereço. */
export type Filtros = {
  periodo: Periodo
  ref: Date
  banco: string
  categoria: string | null
  busca: string
}

const PERIODOS: readonly Periodo[] = ['dia', 'semana', 'mes', 'ano']

/** Lê os filtros da query string. **Tudo tem padrão e nada lança**: a URL é
 *  entrada de fora (editada à mão, link antigo, atalho salvo), então valor
 *  inválido cai no padrão em vez de quebrar a tela.
 *
 *  O caso do período é o que mais importa: `filtrar()` faz um switch sobre
 *  ele, e um valor fora da lista cairia sem caso correspondente devolvendo
 *  undefined — o painel renderizaria vazio sem dizer por quê. */
export function lerFiltros(search: string): Filtros {
  const p = new URLSearchParams(search)
  const periodo = p.get('p')
  return {
    periodo: PERIODOS.includes(periodo as Periodo) ? (periodo as Periodo) : 'mes',
    ref: lerRef(p.get('ref')),
    banco: p.get('banco') || 'geral',
    categoria: p.get('cat') || null,
    busca: p.get('q') || '',
  }
}

/** A competência como AAAA-MM. O mês é validado, não só o formato: '2026-13'
 *  casa o regex e `new Date(2026, 12, 1)` rola para JANEIRO DE 2027 sem
 *  reclamar — a tela mostraria outro ano e ninguém saberia por quê. */
function lerRef(valor: string | null): Date {
  const m = valor?.match(/^(\d{4})-(\d{2})$/)
  if (!m) return new Date()
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return new Date()
  return new Date(Number(m[1]), mes - 1, 1)
}

/** Monta a query string com **só o que difere do padrão**, para o link ficar
 *  curto e legível. A referência é a exceção: vai sempre, porque "o mês que
 *  eu estava vendo" é o que um link precisa carregar — sem ela, abrir o
 *  link em outro dia mostraria outro mês.
 *
 *  `URLSearchParams.toString()` já escapa tudo (&, =, espaço, acento). */
export function escreverFiltros(f: Filtros): string {
  const p = new URLSearchParams()
  if (f.periodo !== 'mes') p.set('p', f.periodo)
  p.set('ref', `${f.ref.getFullYear()}-${String(f.ref.getMonth() + 1).padStart(2, '0')}`)
  if (f.banco !== 'geral') p.set('banco', f.banco)
  if (f.categoria) p.set('cat', f.categoria)
  if (f.busca) p.set('q', f.busca)
  return `?${p.toString()}`
}
