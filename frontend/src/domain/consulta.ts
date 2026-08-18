/** Consulta de busca com operadores.
 *
 *  A ideia vem do Firefly III, onde a MESMA tabela de operadores alimenta a
 *  caixa de busca e os gatilhos das regras (`config/search.php`). Aqui a
 *  busca era substring pura e a regra sabia só `contains`/`cnpj`: nenhuma
 *  das duas conseguia dizer "acima de R$ 100" ou "só no Nubank".
 *
 *  Este módulo é o vocabulário único. Hoje só a busca o usa; ele é puro e
 *  não sabe de onde vem a transação, então é o mesmo avaliador que uma
 *  regra poderá usar quando houver onde guardar uma — o que hoje exigiria
 *  migração de `merchant_rules`, que guarda um padrão de texto e nada mais.
 *
 *  **Compatibilidade é regra, não gentileza:** consulta sem operador nenhum
 *  se comporta EXATAMENTE como a busca de antes. */

export type TxConsultavel = {
  description: string
  label: string | null
  category_slug: string | null
  amount_cents: number
  bank: string
  kind: string
}

export type Filtro =
  | { tipo: 'valor-min'; cents: number }
  | { tipo: 'valor-max'; cents: number }
  | { tipo: 'banco'; valor: string }
  | { tipo: 'categoria'; slug: string }
  | { tipo: 'sem-categoria' }

export type Consulta = {
  /** O que sobrou depois de tirar os operadores, normalizado. */
  texto: string
  filtros: Filtro[]
}

/** Caixa baixa, sem acento, sem espaço sobrando. Aplicado dos dois lados
 *  da comparação. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** As três línguas da interface escrevem o operador na sua palavra. A
 *  tabela é fixa e pequena de propósito: ler o dicionário de i18n aqui
 *  amarraria o domínio à camada de tradução por quatro palavras. */
const CHAVES_BANCO = ['banco', 'bank']
const CHAVES_CATEGORIA = ['cat', 'categoria', 'category']
const CHAVES_SEM = ['sem', 'no', 'sin']
const ALVO_CATEGORIA = ['categoria', 'category', 'categorias']

/** Reais para centavos, tolerante ao que a pessoa digita: `100`, `1.234,56`
 *  e `1234.56` valem. Devolve null quando não há número — e aí o pedaço
 *  volta a ser texto. */
function paraCents(bruto: string): number | null {
  const limpo = bruto.trim()
  if (!/^\d[\d.,]*$/.test(limpo)) return null
  // A ÚLTIMA vírgula ou ponto separa o decimal SE deixar 1 ou 2 dígitos
  // atrás; qualquer outra ocorrência é separador de milhar.
  const m = limpo.match(/^(.*)[.,](\d{1,2})$/)
  const inteiro = (m ? m[1] : limpo).replace(/[.,]/g, '')
  const decimal = m ? m[2].padEnd(2, '0') : '00'
  if (!inteiro && !m) return null
  const cents = Number(inteiro || '0') * 100 + Number(decimal)
  return Number.isFinite(cents) ? cents : null
}

/** Quebra a consulta em filtros e texto livre.
 *
 *  ⚠️ Pedaço que PARECE operador mas não é reconhecido volta para o texto,
 *  nunca é descartado. Descartar em silêncio esconderia resultados sem o
 *  usuário saber por quê, e "PIX: Joao" é busca legítima. */
export function analisarConsulta(bruto: string): Consulta {
  const filtros: Filtro[] = []
  const sobra: string[] = []

  for (const pedaco of bruto.split(/\s+/)) {
    if (!pedaco) continue

    const comparacao = pedaco.match(/^([<>])(.+)$/)
    if (comparacao) {
      const cents = paraCents(comparacao[2])
      if (cents !== null) {
        filtros.push(
          comparacao[1] === '>'
            ? { tipo: 'valor-min', cents }
            : { tipo: 'valor-max', cents },
        )
        continue
      }
      sobra.push(pedaco)
      continue
    }

    const chaveado = pedaco.match(/^([^\s:]+):(.+)$/)
    if (chaveado) {
      const chave = normalizar(chaveado[1])
      const valor = normalizar(chaveado[2])
      if (CHAVES_BANCO.includes(chave)) {
        filtros.push({ tipo: 'banco', valor })
        continue
      }
      if (CHAVES_CATEGORIA.includes(chave)) {
        filtros.push({ tipo: 'categoria', slug: valor })
        continue
      }
      if (CHAVES_SEM.includes(chave) && ALVO_CATEGORIA.includes(valor)) {
        filtros.push({ tipo: 'sem-categoria' })
        continue
      }
    }

    sobra.push(pedaco)
  }

  return { texto: normalizar(sobra.join(' ')), filtros }
}

/** O texto procura no rótulo do usuário E na descrição do banco: quem
 *  renomeou "PAG*JOAO" para "Pedreiro" pode procurar por qualquer um. */
function casaTexto(tx: TxConsultavel, texto: string): boolean {
  if (!texto) return true
  return normalizar(`${tx.label ?? ''} ${tx.description}`).includes(texto)
}

function casaFiltro(tx: TxConsultavel, f: Filtro): boolean {
  switch (f.tipo) {
    // Valor ABSOLUTO: uma entrada de R$ 500 também é um lançamento de
    // quinhentos reais, e quem procura ">100" quer tamanho, não sinal.
    case 'valor-min':
      return Math.abs(tx.amount_cents) > f.cents
    case 'valor-max':
      return Math.abs(tx.amount_cents) < f.cents
    case 'banco':
      return normalizar(tx.bank) === f.valor
    case 'categoria':
      return (tx.category_slug ?? 'outros') === f.slug
    // Nulo e 'outros' são a mesma coisa em toda a base (ver `agrupar`), e
    // este filtro é o par de tela do diagnóstico "X% está sem categoria".
    case 'sem-categoria':
      return (tx.category_slug ?? 'outros') === 'outros'
  }
}

/** Todos os filtros valem juntos (E), e o texto também. */
export function casaConsulta(tx: TxConsultavel, c: Consulta): boolean {
  return casaTexto(tx, c.texto) && c.filtros.every((f) => casaFiltro(tx, f))
}
