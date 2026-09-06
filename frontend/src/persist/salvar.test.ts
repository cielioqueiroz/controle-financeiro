import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso } from './neon-falso'
import { hashDocumento, hashConteudoDocumento } from '../domain/dedupe/hash'
import type { ParseResult, RawTransaction, RawKind } from '../domain/parsers/types'
import type { DocKind } from '../domain/pdf/detect'
import type { Regra } from '../domain/categorize/regras'

/** O dublê precisa existir antes de `salvar.ts` ler `neon` no módulo. */
const dublê = vi.hoisted(() => ({ cliente: null as unknown }))

vi.mock('../lib/neon', () => ({
  get neon() {
    return dublê.cliente
  },
  neonConfigurado: true,
}))

const { salvarDocumento } = await import('./salvar')

// ---------------------------------------------------------------------
// Montagem de um documento de referência
// ---------------------------------------------------------------------

const FATURA: DocKind = { bank: 'nubank', docType: 'fatura' }
const EXTRATO: DocKind = { bank: 'bradesco', docType: 'extrato' }

function tx(
  dia: string,
  description: string,
  amountCents: number,
  kind: RawKind = 'compra',
): RawTransaction {
  return {
    date: new Date(`${dia}T00:00:00.000Z`),
    description,
    amountCents,
    installment: null,
    card: null,
    fx: null,
    kind,
    raw: `linha crua do PDF — ${description}`,
  }
}

function documento(over: Partial<ParseResult> = {}): ParseResult {
  return {
    transactions: [tx('2026-06-10', 'PADARIA DO ZE', 500)],
    declaredTotal: 500,
    declaredIncome: null,
    declaredExpense: null,
    period: { start: new Date('2026-06-01T00:00:00.000Z'), end: new Date('2026-06-30T00:00:00.000Z') },
    account: {
      bank: 'nubank',
      type: 'credit_card',
      last4: '1234',
      agency: null,
      number: null,
      holderName: 'CIELIO QUEIROZ DE SOUZA',
    },
    forward: {
      nextCloseDate: null,
      nextInvoiceBalance: null,
      totalOpenBalance: null,
      futureInstallmentsTotal: null,
    },
    ...over,
  }
}

const BYTES = new TextEncoder().encode('%PDF-1.4 documento de teste').buffer as ArrayBuffer

let falso: ReturnType<typeof criarNeonFalso>

function montar(estado: Parameters<typeof criarNeonFalso>[0] = {}) {
  falso = criarNeonFalso(estado)
  dublê.cliente = falso.cliente
  return falso
}

beforeEach(() => {
  dublê.cliente = null
})

// ---------------------------------------------------------------------

describe('salvarDocumento — o caminho por onde o dinheiro entra', () => {
  it('grava documento, conta e transações quando nada existe ainda', async () => {
    montar()
    const r = await salvarDocumento(documento(), FATURA, BYTES, 'fatura.pdf', [])

    expect(r).toMatchObject({ status: 'salvo', inseridas: 1, jaExistiam: 0 })
    expect(falso.gravadasEm('accounts')).toHaveLength(1)
    expect(falso.gravadasEm('documents')).toHaveLength(1)
    expect(falso.gravadasEm('transactions')).toHaveLength(1)
  })

  it('sem cliente Neon devolve sem-persistencia e não toca em nada', async () => {
    dublê.cliente = null
    const r = await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])
    expect(r).toEqual({ status: 'sem-persistencia' })
  })

  it('sem sessão, recusa antes de gravar', async () => {
    montar({ logado: false })
    await expect(salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])).rejects.toThrow(
      /login/i,
    )
    expect(falso.gravadasEm('documents')).toHaveLength(0)
  })
})

describe('duplicata de Documento', () => {
  it('reconhece o mesmo CONTEÚDO já importado', async () => {
    const doc = documento()
    const contentHash = await hashConteudoDocumento(doc, FATURA)
    montar({ documentos: [{ imported_at: '2026-08-01T10:00:00Z', content_hash: contentHash }] })

    const r = await salvarDocumento(doc, FATURA, BYTES, 'f.pdf', [])

    expect(r).toEqual({ status: 'documento-duplicado', importadoEm: '2026-08-01T10:00:00Z' })
    expect(falso.gravadasEm('transactions')).toHaveLength(0)
  })

  /** REGRESSÃO. Até 2026-09-06 o `select` da dedup não trazia a coluna
   *  `file_hash`, então `doc.file_hash` era sempre `undefined` e o lado
   *  file_hash do `||` nunca era verdadeiro. Ficava mascarado porque o mesmo
   *  arquivo produz o mesmo `content_hash` — o que este teste faz é separar
   *  os dois, dando ao documento existente SÓ o file_hash. Antes da
   *  correção, isto devolvia `salvo`: o mesmo PDF entrava duas vezes. */
  it('reconhece o mesmo ARQUIVO mesmo quando o content_hash não bate', async () => {
    const fileHash = await hashDocumento(BYTES)
    montar({ documentos: [{ imported_at: '2026-07-15T09:00:00Z', file_hash: fileHash }] })

    const r = await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])

    expect(r).toEqual({ status: 'documento-duplicado', importadoEm: '2026-07-15T09:00:00Z' })
    expect(falso.gravadasEm('transactions')).toHaveLength(0)
  })

  it('documento diferente com o mesmo banco entra normalmente', async () => {
    const outro = documento()
    const contentHash = await hashConteudoDocumento(outro, FATURA)
    montar({ documentos: [{ imported_at: '2026-08-01T10:00:00Z', content_hash: contentHash }] })

    const novo = documento({
      transactions: [tx('2026-07-10', 'FARMACIA CENTRAL', 3200)],
      declaredTotal: 3200,
    })
    const r = await salvarDocumento(novo, FATURA, BYTES, 'f.pdf', [])

    expect(r).toMatchObject({ status: 'salvo' })
  })

  /** O `.or()` do PostgREST recebe o filtro como STRING: o valor ia
   *  interpolado DENTRO do predicado. Hoje os dois valores são hashes que
   *  nós calculamos, mas o padrão é o errado. Este teste guarda a forma da
   *  pergunta, não só a resposta. */
  it('pergunta pelos hashes como VALOR, nunca interpolados num filtro', async () => {
    const fileHash = await hashDocumento(BYTES)
    montar()
    await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])

    const consultas = falso.chamadas.filter((c) => c.tabela === 'documents' && c.op === 'select')
    expect(consultas.length).toBeGreaterThan(0)
    for (const c of consultas) {
      for (const f of c.filtros) {
        expect(f.tipo).toBe('eq')
        // O hash é o VALOR do filtro — não pedaço do nome da coluna.
        expect(f.coluna).not.toContain(fileHash)
      }
    }
    expect(consultas.some((c) => c.filtros.some((f) => f.valor === fileHash))).toBe(true)
  })

  /** Até 2026-09-06 a dedup trazia todo Documento de content_hash nulo COM
   *  as transações aninhadas de cada um, em toda importação. */
  it('não puxa as transações aninhadas dos documentos existentes', async () => {
    montar()
    await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])

    const consultas = falso.chamadas.filter((c) => c.tabela === 'documents' && c.op === 'select')
    for (const c of consultas) {
      expect(c.colunas).not.toContain('transactions(')
      expect(c.colunas).not.toContain('accounts(')
    }
  })
})

describe('transações idênticas no mesmo documento', () => {
  /** Dois pães de R$5 no mesmo dia geram a mesma chave de dedup. As duas são
   *  reais: perder uma faria o total salvo divergir do gabarito do banco. */
  it('mantém as duas, com sufixo de ocorrência na segunda', async () => {
    montar()
    const doc = documento({
      transactions: [
        tx('2026-06-10', 'PADARIA DO ZE', 500),
        tx('2026-06-10', 'PADARIA DO ZE', 500),
      ],
      declaredTotal: 1000,
    })

    const r = await salvarDocumento(doc, FATURA, BYTES, 'f.pdf', [])

    expect(r).toMatchObject({ status: 'salvo', inseridas: 2 })
    const hashes = falso.gravadasEm('transactions').map((l) => l.hash as string)
    expect(new Set(hashes).size).toBe(2)
    expect(hashes.filter((h) => h.endsWith('#2'))).toHaveLength(1)
  })
})

describe('dedupe contra o que já está no banco', () => {
  it('não reinsere transação de hash já gravado', async () => {
    montar()
    const doc = documento({
      transactions: [tx('2026-06-10', 'PADARIA DO ZE', 500), tx('2026-06-11', 'FARMACIA SAO JOAO', 2500)],
      declaredTotal: 3000,
    })
    // Primeira importação grava as duas; o dublê guarda os hashes.
    await salvarDocumento(doc, FATURA, BYTES, 'f.pdf', [])
    const gravadasAntes = falso.gravadasEm('transactions').length

    // Segundo documento, arquivo e conteúdo diferentes, mesmas transações.
    const outrosBytes = new TextEncoder().encode('%PDF-1.4 outro arquivo').buffer as ArrayBuffer
    const r = await salvarDocumento(
      documento({ transactions: doc.transactions, declaredTotal: 2999 }),
      FATURA,
      outrosBytes,
      'f2.pdf',
      [],
    )

    expect(r).toMatchObject({ status: 'salvo', inseridas: 0, jaExistiam: 2 })
    expect(falso.gravadasEm('transactions')).toHaveLength(gravadasAntes)
  })
})

describe('categorização na gravação', () => {
  /** O padrão é comparado com `includes` SENSÍVEL A CAIXA contra o merchant
   *  normalizado, que é maiúsculo — daí os padrões em maiúsculas. Asseverar
   *  o slug exato, e não só "algum slug": `categoriaDe` devolve `'outros'`
   *  quando nada casa, e `'outros'` também passaria num `toBeTruthy`. */
  it('aplica as regras globais', async () => {
    montar()
    await salvarDocumento(
      documento({ transactions: [tx('2026-06-10', 'FARMACIA SAO JOAO', 4500)], declaredTotal: 4500 }),
      FATURA,
      BYTES,
      'f.pdf',
      [],
    )
    expect(falso.gravadasEm('transactions')[0].category_slug).toBe('farmacia')
  })

  it('a regra do usuário vence a global sobre a MESMA descrição', async () => {
    montar()
    const minha: Regra[] = [
      { padrao: 'FARMACIA', tipo: 'contains', categoria: 'inventada', prioridade: 100000 },
    ]
    await salvarDocumento(
      documento({ transactions: [tx('2026-06-10', 'FARMACIA SAO JOAO', 4500)], declaredTotal: 4500 }),
      FATURA,
      BYTES,
      'f.pdf',
      minha,
    )
    expect(falso.gravadasEm('transactions')[0].category_slug).toBe('inventada')
  })

  it('sem regra do usuário, a mesma descrição volta para a global', async () => {
    montar()
    await salvarDocumento(
      documento({ transactions: [tx('2026-06-10', 'FARMACIA SAO JOAO', 4500)], declaredTotal: 4500 }),
      FATURA,
      BYTES,
      'f.pdf',
      [],
    )
    expect(falso.gravadasEm('transactions')[0].category_slug).toBe('farmacia')
  })
})

describe('vínculo — o que não conta como gasto', () => {
  it('pagamento de fatura é gravado como card_payment, não despesa', async () => {
    montar()
    const extrato = documento({
      transactions: [tx('2026-06-20', 'Pagamento de fatura', 15000, 'pagamento')],
      declaredTotal: 15000,
      account: {
        bank: 'bradesco',
        type: 'checking',
        last4: null,
        agency: '1234',
        number: '56789',
        holderName: 'CIELIO QUEIROZ DE SOUZA',
      },
    })
    await salvarDocumento(extrato, EXTRATO, BYTES, 'e.pdf', [])

    expect(falso.gravadasEm('transactions')[0].kind).toBe('card_payment')
  })

  it('entrada vira income e sai com direction in', async () => {
    montar()
    const extrato = documento({
      transactions: [tx('2026-06-05', 'Pix recebido', -20000, 'entrada')],
      declaredTotal: null,
      declaredIncome: 20000,
    })
    await salvarDocumento(extrato, EXTRATO, BYTES, 'e.pdf', [])

    const linha = falso.gravadasEm('transactions')[0]
    expect(linha.kind).toBe('income')
    expect(linha.direction).toBe('in')
  })
})

describe('minimização de dado', () => {
  /** `raw` guardava a linha crua do extrato em toda transação e não era
   *  lida por nenhum código do app: texto livre do banco sem consumidor. */
  it('não grava a linha crua do PDF', async () => {
    montar()
    await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])
    for (const linha of falso.gravadasEm('transactions')) {
      expect(linha).not.toHaveProperty('raw')
    }
  })

  /** `holder_name` guardava o nome completo do titular e também nunca era
   *  lido de volta — o vínculo usa o valor em memória, vindo do parse. */
  it('não grava o nome do titular na conta', async () => {
    montar()
    await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])
    for (const linha of falso.gravadasEm('accounts')) {
      expect(linha).not.toHaveProperty('holder_name')
    }
  })

  it('mas segue gravando a descrição, que é o que permite auditar', async () => {
    montar()
    await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])
    expect(falso.gravadasEm('transactions')[0].description).toBe('PADARIA DO ZE')
  })
})

describe('conta bancária', () => {
  it('reaproveita a conta existente em vez de criar outra', async () => {
    montar({
      contas: [{ id: 'acc-ja-existe', bank: 'nubank', type: 'credit_card', last4: '1234', number: null }],
    })
    await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])

    expect(falso.gravadasEm('accounts')).toHaveLength(0)
    expect(falso.gravadasEm('transactions')[0].account_id).toBe('acc-ja-existe')
  })

  it('não manda user_id: quem preenche é o default do banco a partir do JWT', async () => {
    montar()
    await salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])
    for (const tabela of ['accounts', 'documents', 'transactions']) {
      for (const linha of falso.gravadasEm(tabela)) {
        expect(linha).not.toHaveProperty('user_id')
      }
    }
  })
})

describe('erro do banco', () => {
  it('falha alto quando o insert das transações erra', async () => {
    montar({ erro: { tabela: 'transactions', op: 'insert', message: 'violação de RLS' } })
    await expect(salvarDocumento(documento(), FATURA, BYTES, 'f.pdf', [])).rejects.toThrow(
      /RLS/,
    )
  })
})
