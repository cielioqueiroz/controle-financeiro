/** Dublê do cliente Neon para os testes de `persist/`.
 *
 *  Existe porque `salvar.ts` era o arquivo mais consequente do sistema — é
 *  por ele que TODO dado entra no banco, e nele se encontram dedupe, vínculo,
 *  categorização e o discriminador de transações idênticas — e não tinha um
 *  único teste. Os três testes que havia em `persist/` cobriam os arquivos
 *  puros, que já eram os fáceis.
 *
 *  Não é um Postgres: é o suficiente do contrato do PostgREST que o
 *  `persist/` usa, com o estado do "banco" declarado pelo teste. O que ele
 *  prova é a ORQUESTRAÇÃO — ordem das operações, o que é perguntado e o que
 *  é gravado. RLS, gatilhos e CHECK são do banco e não têm dublê possível:
 *  ver `docs/adr/0008-o-login-nao-tem-rede-de-testes.md`.
 *
 *  Fica em arquivo próprio (e não dentro do `.test.ts`) porque `salvar`,
 *  `editar` e `documentos` precisam do mesmo dublê. Não é `.test.ts` para o
 *  Vitest não tentar rodá-lo como suíte. */

export type RespostaFalsa = { data: unknown; error: { message: string } | null }

export type Filtro = { tipo: 'eq' | 'in' | 'not' | 'is'; coluna: string; valor: unknown }

/** Uma operação que o código sob teste pediu ao banco. É o que as asserções
 *  leem: não basta o resultado estar certo, a pergunta feita ao banco também
 *  precisa estar. */
export type Chamada = {
  tabela: string
  op: 'select' | 'insert' | 'update' | 'delete'
  colunas: string | null
  filtros: Filtro[]
  linhas: Record<string, unknown>[] | null
  campos: Record<string, unknown> | null
  single: boolean
  limite: number | null
  /** O `count` pedido no `select`. `null` = não pediu, e é justamente o
   *  caso em que uma resposta truncada não tem como ser percebida. */
  contagem: 'exact' | 'planned' | 'estimated' | null
  ordem: { coluna: string; ascendente: boolean } | null
}

export type EstadoFalso = {
  /** Documentos já no banco. Só os campos que a dedup consulta. */
  documentos?: Array<{ imported_at: string; file_hash?: string; content_hash?: string }>
  /** Contas já no banco. */
  contas?: Array<{ id: string; bank: string; type: string; last4: string | null; number: string | null }>
  /** Hashes de transação já gravados. */
  hashes?: string[]
  /** Linhas completas devolvidas pela LEITURA do histórico (`puxarTudo`). */
  transacoes?: Record<string, unknown>[]
  /** Simula resposta truncada: o `count` diz a verdade, o array vem curto.
   *  É exatamente o que um `db_max_rows` faz — e sem nenhum erro. */
  truncarEm?: number
  /** `false` faz `getSession` devolver sessão nenhuma. */
  logado?: boolean
  /** Força um erro na primeira operação que casar com tabela + op. */
  erro?: { tabela: string; op: Chamada['op']; message: string }
}

const casa = (linha: Record<string, unknown>, filtros: Filtro[]): boolean =>
  filtros.every((f) => {
    const v = linha[f.coluna]
    if (f.tipo === 'eq') return v === f.valor
    if (f.tipo === 'in') return (f.valor as unknown[]).includes(v)
    if (f.tipo === 'is') return f.valor === null ? v == null : v === f.valor
    if (f.tipo === 'not') return !(f.valor === null ? v == null : v === f.valor)
    return true
  })

class ConsultaFalsa implements PromiseLike<RespostaFalsa> {
  // Campos explícitos, e não parâmetros-propriedade: o `tsconfig` liga
  // `erasableSyntaxOnly`, que proíbe a forma curta.
  private readonly chamada: Chamada
  private readonly resolver: (c: Chamada) => RespostaFalsa

  constructor(chamada: Chamada, resolver: (c: Chamada) => RespostaFalsa) {
    this.chamada = chamada
    this.resolver = resolver
  }

  select(colunas?: string, opcoes?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    // `insert(...).select('id')` mantém a operação como insert: o `select`
    // ali só diz o que volta.
    if (this.chamada.op === 'select') {
      this.chamada.colunas = colunas ?? '*'
      this.chamada.contagem = opcoes?.count ?? null
    }
    return this
  }
  order(coluna: string, opcoes?: { ascending?: boolean }): this {
    this.chamada.ordem = { coluna, ascendente: opcoes?.ascending ?? true }
    return this
  }
  insert(linhas: Record<string, unknown> | Record<string, unknown>[]): this {
    this.chamada.op = 'insert'
    this.chamada.linhas = Array.isArray(linhas) ? linhas : [linhas]
    return this
  }
  update(campos: Record<string, unknown>): this {
    this.chamada.op = 'update'
    this.chamada.campos = campos
    return this
  }
  delete(): this {
    this.chamada.op = 'delete'
    return this
  }
  eq(coluna: string, valor: unknown): this {
    this.chamada.filtros.push({ tipo: 'eq', coluna, valor })
    return this
  }
  in(coluna: string, valor: unknown[]): this {
    this.chamada.filtros.push({ tipo: 'in', coluna, valor })
    return this
  }
  is(coluna: string, valor: unknown): this {
    this.chamada.filtros.push({ tipo: 'is', coluna, valor })
    return this
  }
  not(coluna: string, _op: string, valor: unknown): this {
    this.chamada.filtros.push({ tipo: 'not', coluna, valor })
    return this
  }
  limit(n: number): this {
    this.chamada.limite = n
    return this
  }
  single(): this {
    this.chamada.single = true
    return this
  }
  /** ⚠️ Deliberadamente ausente: `or()`. O filtro do `.or()` é uma string, e
   *  interpolar valor ali é injeção de predicado — se alguém reintroduzir o
   *  padrão em `persist/`, o teste quebra aqui, com nome. */

  then<A = RespostaFalsa, B = never>(
    aoResolver?: ((v: RespostaFalsa) => A | PromiseLike<A>) | null,
    aoRejeitar?: ((r: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.resolver(this.chamada)).then(aoResolver, aoRejeitar)
  }
}

export function criarNeonFalso(estado: EstadoFalso = {}) {
  // Linhas soltas, como o Postgres devolveria: o dublê não impõe schema.
  const documentos: Record<string, unknown>[] = [...(estado.documentos ?? [])]
  const contas: Record<string, unknown>[] = [...(estado.contas ?? [])]
  const hashes = new Set(estado.hashes ?? [])
  const transacoes: Record<string, unknown>[] = [...(estado.transacoes ?? [])]
  const chamadas: Chamada[] = []
  let erroPendente = estado.erro

  const resolver = (c: Chamada): RespostaFalsa => {
    chamadas.push(c)

    if (erroPendente && erroPendente.tabela === c.tabela && erroPendente.op === c.op) {
      const message = erroPendente.message
      erroPendente = undefined
      return { data: null, error: { message } }
    }

    const envelope = (todas: Record<string, unknown>[]): RespostaFalsa => {
      // O truncamento imita o `db_max_rows`: o `count` continua dizendo
      // quantas linhas existem, e o array vem curto, SEM erro.
      const cortadas =
        estado.truncarEm != null ? todas.slice(0, estado.truncarEm) : todas
      const linhas = c.single ? cortadas : c.limite ? cortadas.slice(0, c.limite) : cortadas
      return {
        data: c.single ? (linhas[0] ?? null) : linhas,
        error: c.single && linhas.length === 0 ? { message: 'no rows' } : null,
        // Só devolve `count` se tiver sido pedido — é o comportamento real
        // do cliente, e a razão de uma resposta truncada passar despercebida.
        ...(c.contagem ? { count: todas.length } : {}),
      }
    }

    if (c.op === 'select') {
      if (c.tabela === 'documents') return envelope(documentos.filter((d) => casa(d, c.filtros)))
      if (c.tabela === 'accounts') return envelope(contas.filter((a) => casa(a, c.filtros)))
      if (c.tabela === 'transactions') {
        // Dedup de importação pergunta por hash; a leitura do histórico não.
        const porHash = c.filtros.some((f) => f.coluna === 'hash')
        if (porHash) {
          return envelope([...hashes].map((h) => ({ hash: h })).filter((r) => casa(r, c.filtros)))
        }
        return envelope(transacoes.filter((t) => casa(t, c.filtros)))
      }
      return envelope([])
    }

    if (c.op === 'insert') {
      const linhas = c.linhas ?? []
      if (c.tabela === 'documents') {
        const id = `doc-${documentos.length + 1}`
        documentos.push({ imported_at: '2026-09-06T00:00:00Z', ...linhas[0], id })
        return envelope([{ id }])
      }
      if (c.tabela === 'accounts') {
        const id = `acc-${contas.length + 1}`
        contas.push({ ...linhas[0], id })
        return envelope([{ id }])
      }
      if (c.tabela === 'transactions') {
        for (const l of linhas) hashes.add(l.hash as string)
        return { data: null, error: null }
      }
    }

    return { data: null, error: null }
  }

  const cliente = {
    auth: {
      getSession: async () => ({
        data: estado.logado === false ? {} : { session: { user: { id: 'u1' } } },
      }),
    },
    from: (tabela: string) =>
      new ConsultaFalsa(
        {
          tabela,
          op: 'select',
          colunas: null,
          filtros: [],
          linhas: null,
          campos: null,
          single: false,
          limite: null,
          contagem: null,
          ordem: null,
        },
        resolver,
      ),
  }

  return {
    cliente,
    chamadas,
    /** As linhas efetivamente gravadas numa tabela. */
    gravadasEm: (tabela: string): Record<string, unknown>[] =>
      chamadas.filter((c) => c.tabela === tabela && c.op === 'insert').flatMap((c) => c.linhas ?? []),
  }
}
