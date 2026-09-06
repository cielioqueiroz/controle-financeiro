import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso } from './neon-falso'

const dublê = vi.hoisted(() => ({ cliente: null as unknown }))

vi.mock('../lib/neon', () => ({
  get neon() {
    return dublê.cliente
  },
  neonConfigurado: true,
}))

const { puxarTudo, RecorteIncompletoError } = await import('./puxar')

/** Uma linha como a Data API a devolve: snake_case, com as relações
 *  aninhadas do `select`. */
function linha(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'tx-1',
    date: '2026-06-10',
    description: 'PADARIA DO ZE',
    label: null,
    amount_cents: 500,
    kind: 'expense',
    category_slug: 'padaria',
    installment: null,
    document_id: 'doc-1',
    accounts: { bank: 'nubank' },
    documents: { doc_type: 'fatura', period_end: '2026-06-30' },
    ...over,
  }
}

let falso: ReturnType<typeof criarNeonFalso>

function montar(estado: Parameters<typeof criarNeonFalso>[0] = {}) {
  falso = criarNeonFalso(estado)
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

describe('puxarTudo — leitura do histórico', () => {
  it('sem cliente Neon devolve lista vazia', async () => {
    dublê.cliente = null
    expect(await puxarTudo()).toEqual([])
  })

  it('converte a linha do banco para TransacaoSalva', async () => {
    montar({ transacoes: [linha()] })
    const [tx] = await puxarTudo()

    expect(tx).toEqual({
      id: 'tx-1',
      date: '2026-06-10',
      competencia: '2026-06',
      description: 'PADARIA DO ZE',
      label: null,
      amount_cents: 500,
      kind: 'expense',
      category_slug: 'padaria',
      bank: 'nubank',
      doc_type: 'fatura',
      document_id: 'doc-1',
      installment: null,
    })
  })

  it('aceita relação ausente sem quebrar, caindo em "desconhecido"', async () => {
    montar({ transacoes: [linha({ accounts: null, documents: null })] })
    const [tx] = await puxarTudo()
    expect(tx.bank).toBe('desconhecido')
    expect(tx.doc_type).toBe('desconhecido')
  })
})

describe('integridade do recorte', () => {
  /** O guarda só funciona se a pergunta for feita: sem `{ count: 'exact' }`
   *  o cliente devolve `count: null` e não há como perceber truncamento. */
  it('pede a contagem exata ao banco', async () => {
    montar({ transacoes: [linha()] })
    await puxarTudo()

    const consulta = falso.chamadas.find((c) => c.tabela === 'transactions' && c.op === 'select')
    expect(consulta?.contagem).toBe('exact')
  })

  /** O modo de falha que este guarda existe para pegar: o servidor diz que
   *  há 3 linhas e manda 1, com `error: null`. Sem o guarda, a tela somaria
   *  R$ 5,00 de um histórico de R$ 15,00 e não avisaria ninguém. */
  it('recusa a leitura quando vieram menos linhas do que o banco declara', async () => {
    montar({
      transacoes: [
        linha({ id: 'tx-1' }),
        linha({ id: 'tx-2' }),
        linha({ id: 'tx-3' }),
      ],
      truncarEm: 1,
    })

    await expect(puxarTudo()).rejects.toThrow(RecorteIncompletoError)
    await expect(puxarTudo()).rejects.toThrow(/3 transações.*trouxe 1/)
  })

  it('não reclama quando a contagem bate', async () => {
    montar({ transacoes: [linha({ id: 'a' }), linha({ id: 'b' })] })
    expect(await puxarTudo()).toHaveLength(2)
  })

  /** A mensagem precisa virar a frase certa na tela — senão o guarda dispara
   *  e a pessoa lê "Falha ao carregar", que não diz que o número está menor. */
  it('a falha vira a chave de tradução do recorte incompleto', async () => {
    const { chaveDeErro } = await import('../lib/erro-usuario')
    const erro = new RecorteIncompletoError('o banco tem 900 e a resposta trouxe 100')
    expect(chaveDeErro(erro, 'erro.carregar')).toBe('erro.recorteIncompleto')
  })
})

describe('conferência da forma da linha', () => {
  it('recusa valor que não é inteiro de centavos', async () => {
    montar({ transacoes: [linha({ amount_cents: '500' })] })
    await expect(puxarTudo()).rejects.toThrow(/amount_cents não é inteiro/)
  })

  it('recusa valor ausente em vez de somar NaN', async () => {
    montar({ transacoes: [linha({ amount_cents: undefined })] })
    await expect(puxarTudo()).rejects.toThrow(/amount_cents/)
  })

  it('recusa float: centavos são inteiros', async () => {
    montar({ transacoes: [linha({ amount_cents: 500.5 })] })
    await expect(puxarTudo()).rejects.toThrow(/amount_cents/)
  })

  it('recusa id ausente', async () => {
    montar({ transacoes: [linha({ id: null })] })
    await expect(puxarTudo()).rejects.toThrow(/id ausente/)
  })

  it('parcela pela metade vira ausente, não 03/undefined', async () => {
    montar({ transacoes: [linha({ installment: { current: 3 } })] })
    const [tx] = await puxarTudo()
    expect(tx.installment).toBeNull()
  })

  it('parcela completa passa', async () => {
    montar({ transacoes: [linha({ installment: { current: 3, total: 10 } })] })
    const [tx] = await puxarTudo()
    expect(tx.installment).toEqual({ current: 3, total: 10 })
  })
})
