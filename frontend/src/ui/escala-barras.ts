/** Escala de gráfico de barras que sobrevive a um valor discrepante.
 *
 *  **O problema, medido na tela do usuário:** um mês com 39 dias de gasto,
 *  38 deles entre R$ 30 e R$ 2.000, e um pagamento de empréstimo de
 *  R$ 41.653. Com o máximo mandando na escala — o jeito óbvio, e o que estava
 *  no ar — as 38 barras viravam traços de 2px rente ao chão. O gráfico
 *  continuava correto e tinha parado de responder à única pergunta que
 *  justifica sua existência: *quando* o dinheiro saiu.
 *
 *  **A saída não é mentir na altura.** Escala logarítmica ou raiz resolveria
 *  o aperto e cobraria caro: as alturas deixariam de ser comparáveis em
 *  silêncio, e ninguém desconfia de um gráfico bonito. Aqui a escala é linear
 *  até um **teto robusto**, e quem passa dele é desenhado **cortado**, com a
 *  marca do corte à vista — a mesma convenção do eixo quebrado dos gráficos
 *  impressos. A distorção existe, é local, e está declarada.
 *
 *  O teto sai da **cerca de Tukey** (q3 + 1,5·IQR), o critério clássico de
 *  discrepante, e não de um número escolhido a dedo: o que manda é o formato
 *  da própria série. */

export type Escala = {
  /** Valor que corresponde à barra cheia. Nunca zero. */
  teto: number
  /** Quantos valores passam do teto — as barras cortadas. */
  cortados: number
}

/** Altura mínima, em %, de uma barra de valor não-nulo. Abaixo disso a barra
 *  some, e "gastei pouco" fica indistinguível de "não gastei". */
const PISO_PCT = 2

/** Só corta quando o máximo está bem acima da cerca. Sem esta folga, uma
 *  ponta 30% acima da vizinhança viraria corte, a marca apareceria toda hora
 *  e deixaria de significar alguma coisa. */
const FOLGA = 1.5

/** Quanto o teto pode subir para abraçar um valor que passou da cerca sem
 *  ser um espeto.
 *
 *  Com um discrepante muito grande, a cerca de Tukey desce demais: num mês
 *  real, o segundo maior dia (R$ 816, nada de extraordinário) caía fora dela
 *  e ganhava serrilha ao lado do empréstimo de R$ 41.653. Uma barra que
 *  caberia inteira não deve ser cortada — a marca perde o sentido se
 *  aparecer em qualquer ponta. */
const ABSORCAO = 2

/** Quantil por interpolação linear (o mesmo do R tipo 7 e do numpy). */
function quantil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0
  const pos = (ordenados.length - 1) * p
  const base = Math.floor(pos)
  const resto = pos - base
  const atual = ordenados[base]
  const proximo = ordenados[base + 1] ?? atual
  return atual + (proximo - atual) * resto
}

export function escalaRobusta(valores: number[]): Escala {
  const positivos = valores.filter((v) => v > 0)
  if (positivos.length === 0) return { teto: 1, cortados: 0 }

  const ordenados = [...positivos].sort((a, b) => a - b)
  const max = ordenados[ordenados.length - 1]

  const q1 = quantil(ordenados, 0.25)
  const q3 = quantil(ordenados, 0.75)
  const cerca = q3 + 1.5 * (q3 - q1)

  // Sem discrepante que justifique o corte, a escala é a honesta: o máximo.
  if (max <= cerca * FOLGA) return { teto: max, cortados: 0 }

  // O teto começa na maior barra que cabe embaixo da cerca — assim ela chega
  // ao topo e o espaço vertical é todo usado pelo que não é discrepante.
  const dentro = ordenados.filter((v) => v <= cerca)
  let teto = dentro.length > 0 ? dentro[dentro.length - 1] : cerca

  // E então sobe, em ordem crescente, para abraçar quem passou da cerca sem
  // ser espeto. Para no primeiro que não couber — é essa parada que impede a
  // cadeia de subir de degrau em degrau até o discrepante e anular o corte.
  for (const v of ordenados.filter((v) => v > teto)) {
    if (v > teto * ABSORCAO) break
    teto = v
  }

  return { teto: Math.max(teto, 1), cortados: positivos.filter((v) => v > teto).length }
}

/** Altura da barra, de 0 a 100. */
export function alturaPct(valor: number, escala: Escala): number {
  if (valor <= 0) return 0
  return Math.min(Math.max((valor / escala.teto) * 100, PISO_PCT), 100)
}
