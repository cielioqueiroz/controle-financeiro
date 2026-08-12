import { describe, it, expect } from 'vitest'
import { lerFiltros, escreverFiltros } from './filtros'
import { mover } from './periodo'

/** A data como a tela a compara: `pertence()` casa `tx.date` com a ref
 *  formatada em fuso LOCAL. Usar toISOString aqui daria o dia anterior no
 *  Brasil e mascararia justamente o que estes testes medem. */
const local = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('lerFiltros', () => {
  it('cai nos padrões quando a URL está vazia', () => {
    const f = lerFiltros('')
    expect(f.periodo).toBe('mes')
    expect(f.banco).toBe('geral')
    expect(f.categoria).toBeNull()
    expect(f.busca).toBe('')
  })

  it('lê período, banco, categoria e busca', () => {
    const f = lerFiltros('?p=ano&banco=nubank&cat=mercado&q=posto')
    expect(f.periodo).toBe('ano')
    expect(f.banco).toBe('nubank')
    expect(f.categoria).toBe('mercado')
    expect(f.busca).toBe('posto')
  })

  // Período inválido vindo de URL editada à mão ou de link velho não pode
  // quebrar a tela: `filtrar()` faria um switch sem caso correspondente e
  // devolveria undefined, e o painel renderizaria vazio sem dizer por quê.
  it('ignora período que não existe e usa o padrão', () => {
    expect(lerFiltros('?p=decada').periodo).toBe('mes')
    expect(lerFiltros('?p=').periodo).toBe('mes')
  })

  it('lê a referência como AAAA-MM', () => {
    const f = lerFiltros('?ref=2026-09')
    expect(f.ref.getFullYear()).toBe(2026)
    expect(f.ref.getMonth()).toBe(8) // setembro = 8
  })

  it('ignora referência malformada em vez de gerar Invalid Date', () => {
    const f = lerFiltros('?ref=banana')
    expect(f.ref).toBeInstanceOf(Date)
    expect(Number.isNaN(f.ref.getTime())).toBe(false)
  })

  // '2026-13' casa o formato mas não existe. Sem esta trava o Date rolaria
  // para janeiro de 2027 em silêncio — a tela mostraria outro ano.
  it('rejeita mês fora de 1–12', () => {
    const f = lerFiltros('?ref=2026-13')
    expect(f.ref.getFullYear()).toBe(new Date().getFullYear())
  })
})

describe('escreverFiltros', () => {
  it('omite o que está no padrão, para a URL ficar curta', () => {
    const s = escreverFiltros(lerFiltros(''))
    expect(s).not.toContain('banco=')
    expect(s).not.toContain('cat=')
    expect(s).not.toContain('q=')
    expect(s).not.toContain('p=')
  })

  it('faz a volta completa sem perder nada', () => {
    const original = lerFiltros('?p=dia&banco=bradesco&cat=lanches&q=café&ref=2025-03-14')
    const volta = lerFiltros(escreverFiltros(original))
    expect(volta.periodo).toBe('dia')
    expect(volta.banco).toBe('bradesco')
    expect(volta.categoria).toBe('lanches')
    expect(volta.busca).toBe('café')
    // O DIA faz parte de "sem perder nada". A versão anterior deste teste
    // conferia só ano e mês — e passava com o defeito que os testes abaixo
    // pegam, porque `?ref=2025-03` volta como 1º de março de qualquer jeito.
    expect(local(volta.ref)).toBe('2025-03-14')
  })

  it('escapa busca com caracteres especiais', () => {
    const f = { ...lerFiltros(''), busca: 'a&b=c d' }
    expect(lerFiltros(escreverFiltros(f)).busca).toBe('a&b=c d')
  })
})

// ---------------------------------------------------------------------------
// A navegação de Dia e Semana passa POR AQUI a cada clique: a seta chama
// `mover`, o resultado vira URL e a tela lê a URL de volta. Só o trio junto
// mostra o defeito — `mover` sozinho anda certo, `escreverFiltros` sozinho
// escreve o que lhe pedem, e `pertence()` compara o dia exato (`tx.date ===
// ref`) contra uma ref que já perdeu o dia no caminho.
// ---------------------------------------------------------------------------

describe('navegar de verdade — mover → URL → ler', () => {
  /** Um clique na seta, ida e volta pela barra de endereços. */
  const clicar = (busca: string, dir: -1 | 1) => {
    const f = lerFiltros(busca)
    return lerFiltros(escreverFiltros({ ...f, ref: mover(f.periodo, f.ref, dir) }))
  }

  it('em Dia, avançar anda UM dia (e não fica parado no dia 1)', () => {
    expect(local(clicar('?p=dia&ref=2026-06-17', 1).ref)).toBe('2026-06-18')
  })

  it('em Dia, voltar anda um dia para trás, inclusive cruzando o mês', () => {
    expect(local(clicar('?p=dia&ref=2026-06-01', -1).ref)).toBe('2026-05-31')
  })

  it('em Semana, avançar anda sete dias', () => {
    expect(local(clicar('?p=semana&ref=2026-06-17', 1).ref)).toBe('2026-06-24')
  })

  it('em Mês, avançar anda um mês', () => {
    const f = clicar('?ref=2026-06', 1)
    expect(f.ref.getFullYear()).toBe(2026)
    expect(f.ref.getMonth()).toBe(6) // julho
  })

  // 31 de janeiro + 1 mês, em JavaScript puro, dá 3 de MARÇO: o dia 31 não
  // existe em fevereiro e o Date rola para frente calado. Fevereiro sumiria
  // da navegação. Só vira alcançável quando a URL passa a guardar o dia.
  it('em Mês, avançar a partir de um dia 31 cai em fevereiro, não em março', () => {
    expect(clicar('?p=mes&ref=2026-01-31', 1).ref.getMonth()).toBe(1)
  })

  it('em Ano, avançar anda um ano', () => {
    expect(clicar('?p=ano&ref=2026-06', 1).ref.getFullYear()).toBe(2027)
  })
})
