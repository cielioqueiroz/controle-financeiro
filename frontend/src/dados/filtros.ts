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

/** A referência, em `AAAA-MM` (dia 1) ou `AAAA-MM-DD`.
 *
 *  As duas formas existem porque as duas fazem sentido: Mês e Ano só olham
 *  ano/mês, e um link curto é melhor; Dia e Semana comparam o **dia exato**
 *  (`pertence()` faz `tx.date === ref`), então sem o dia a navegação não sai
 *  do lugar. Ler as duas mantém de pé todo link antigo, que só tem AAAA-MM.
 *
 *  Nada é aceito só pelo formato. '2026-13' casa o regex e
 *  `new Date(2026, 12, 1)` rola para JANEIRO DE 2027 sem reclamar; '2026-02-31'
 *  rola para março. Em ambos a tela mostraria outra data e ninguém saberia
 *  por quê — por isso o resultado é conferido contra o que foi pedido. */
function lerRef(valor: string | null): Date {
  const m = valor?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!m) return new Date()
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 1]
  const d = new Date(ano, mes - 1, dia)
  // A prova de que a data existe: se o Date tivesse rolado, algum campo teria
  // mudado. Cobre mês fora de 1–12 e dia fora do mês de uma vez só.
  const existe = d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia
  return existe ? d : new Date()
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
  p.set('ref', refParaTexto(f.periodo, f.ref))
  if (f.banco !== 'geral') p.set('banco', f.banco)
  if (f.categoria) p.set('cat', f.categoria)
  if (f.busca) p.set('q', f.busca)
  return `?${p.toString()}`
}

/** Grava o dia só quando ele significa alguma coisa.
 *
 *  Em Dia e Semana o dia É o recorte. Em Mês e Ano ele não seria só ruído no
 *  link: um dia 31 guardado atravessaria a troca de período e faria a seta de
 *  mês pular fevereiro (`setMonth` rola para março quando o dia não existe no
 *  destino). Escrever ancorado no dia 1 mantém essa classe de erro inalcançável
 *  pela URL — e `mover` fecha a mesma porta pelo lado do estado em memória. */
function refParaTexto(periodo: Periodo, ref: Date): string {
  const ano = ref.getFullYear()
  const mes = String(ref.getMonth() + 1).padStart(2, '0')
  if (periodo === 'mes' || periodo === 'ano') return `${ano}-${mes}`
  return `${ano}-${mes}-${String(ref.getDate()).padStart(2, '0')}`
}
