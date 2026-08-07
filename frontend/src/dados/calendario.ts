import type { Recorrencia } from '../domain/recorrencias'

export type DiaDoMes = {
  dia: number
  itens: Recorrencia[]
  entradasCents: number
  saidasCents: number
}

/** O calendário do mês, montado a partir das recorrências detectadas.
 *
 *  Nada aqui é digitado: o `diaTipico` (mediana do dia do mês em que a
 *  série cai) **já é** o calendário — 05 aluguel, 15 salário. É o que
 *  mantém a página dentro da regra do projeto de ser 100% retrospectivo.
 *
 *  Devolve o mês inteiro, inclusive dias vazios, para a grade não precisar
 *  saber quantos dias o mês tem.
 *
 *  @param mes 1–12 (não o 0–11 do Date).
 */
export function diasDoMes(recorrencias: Recorrencia[], ano: number, mes: number): DiaDoMes[] {
  // Dia 0 do mês seguinte = último dia deste. Resolve fevereiro e os meses
  // de 30 sem tabela nem regra de bissexto escrita à mão.
  const ultimoDia = new Date(ano, mes, 0).getDate()

  const dias: DiaDoMes[] = Array.from({ length: ultimoDia }, (_, i) => ({
    dia: i + 1,
    itens: [],
    entradasCents: 0,
    saidasCents: 0,
  }))

  for (const r of recorrencias) {
    // Uma série que cai no dia 30 não some em fevereiro: encaixa no último
    // dia do mês, que é quando a cobrança de fato acontece. Sem isto o
    // índice cairia fora do array e a série desapareceria da tela.
    const dia = Math.min(Math.max(r.diaTipico, 1), ultimoDia)
    const alvo = dias[dia - 1]
    alvo.itens.push(r)
    if (r.tipo === 'entrada') alvo.entradasCents += r.valorTipicoCents
    else alvo.saidasCents += r.valorTipicoCents
  }

  return dias
}
