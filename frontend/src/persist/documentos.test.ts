import { describe, it, expect, vi, beforeEach } from 'vitest'
import { criarNeonFalso } from './neon-falso'

const dublê = vi.hoisted(() => ({ cliente: null as unknown }))
vi.mock('../lib/neon', () => {
  // `obterNeon` devolve o MESMO cliente que `neon`: o SDK passou a
  // entrar por import dinamico, e quem consome espera uma promessa.
  const mod = {
  get neon() {
    return dublê.cliente
  },
  neonConfigurado: true,
}
  // `Object.assign`, e não spread: o spread LÊ o getter na hora, e vários
  // destes mocks usam getter justamente para ser preguiçosos — ler cedo
  // estoura em "Cannot access X before initialization".
  return Object.assign(mod, { obterNeon: () => Promise.resolve(mod.neon) })
})

const { puxarDocumentos, puxarSaldos, apagarDocumento, apagarTudo } = await import('./documentos')

let falso: ReturnType<typeof criarNeonFalso>
const montar = (estado: Parameters<typeof criarNeonFalso>[0] = {}) => {
  falso = criarNeonFalso(estado)
  dublê.cliente = falso.cliente
  return falso
}

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'doc-1',
  bank: 'nubank',
  doc_type: 'fatura',
  period_start: '2026-06-01',
  period_end: '2026-06-30',
  filename: 'fatura.pdf',
  imported_at: '2026-09-01T10:00:00Z',
  declared_total: 832424,
  ...over,
})

beforeEach(() => {
  dublê.cliente = null
})

describe('puxarDocumentos', () => {
  it('devolve os documentos do usuário, mais recentes primeiro', async () => {
    montar({ documentos: [doc(), doc({ id: 'doc-2' })] })
    const r = await puxarDocumentos()

    expect(r).toHaveLength(2)
    expect(falso.chamadas[0].ordem).toEqual({ coluna: 'imported_at', ascendente: false })
  })

  it('não pede colunas que a tela não usa', async () => {
    montar({ documentos: [doc()] })
    await puxarDocumentos()
    const colunas = falso.chamadas[0].colunas ?? ''
    expect(colunas).not.toContain('file_hash')
    expect(colunas).not.toContain('content_hash')
  })

  /** Contraste deliberado com `puxarSaldos` logo abaixo: aqui a falha SOBE,
   *  porque a lista de documentos é o conteúdo da tela — mostrá-la vazia
   *  diria "você não importou nada", que é mentira. */
  it('falha do banco sobe', async () => {
    montar({ erro: { tabela: 'documents', op: 'select', message: 'timeout' } })
    await expect(puxarDocumentos()).rejects.toThrow(/timeout/)
  })

  it('sem cliente Neon devolve lista vazia', async () => {
    dublê.cliente = null
    expect(await puxarDocumentos()).toEqual([])
  })
})

describe('puxarSaldos', () => {
  /** Falha para o lado seguro DE PROPÓSITO: perder a fileira de saldo é
   *  muito melhor que não mostrar o histórico. A coluna `end_balance_cents`
   *  só existe depois da migração `0002`, e antes dela o select erra. */
  it('devolve lista vazia quando o select erra, em vez de derrubar o painel', async () => {
    montar({ erro: { tabela: 'documents', op: 'select', message: 'column end_balance_cents does not exist' } })
    await expect(puxarSaldos()).resolves.toEqual([])
  })

  it('sem cliente Neon devolve lista vazia', async () => {
    dublê.cliente = null
    expect(await puxarSaldos()).toEqual([])
  })

  it('pede as colunas de saldo e de fatura em aberto', async () => {
    montar({ documentos: [doc()] })
    await puxarSaldos()
    const colunas = falso.chamadas[0].colunas ?? ''
    for (const c of ['end_balance_cents', 'total_open_balance', 'next_invoice_balance']) {
      expect(colunas).toContain(c)
    }
  })
})

describe('apagarDocumento', () => {
  it('apaga pelo id — as transações caem por ON DELETE CASCADE', async () => {
    montar()
    await apagarDocumento('doc-1')

    const [c] = falso.chamadas
    expect(c.op).toBe('delete')
    expect(c.tabela).toBe('documents')
    expect(c.filtros).toEqual([{ tipo: 'eq', coluna: 'id', valor: 'doc-1' }])
  })

  it('falha do banco sobe', async () => {
    montar({ erro: { tabela: 'documents', op: 'delete', message: 'nao pode' } })
    await expect(apagarDocumento('doc-1')).rejects.toThrow(/nao pode/)
  })
})

describe('apagarTudo', () => {
  /** A ordem importa: documentos primeiro (cascateia as transações), contas
   *  depois. Invertido, a conta ainda estaria referenciada. */
  it('apaga documentos ANTES de contas', async () => {
    montar()
    await apagarTudo()

    const deletes = falso.chamadas.filter((c) => c.op === 'delete')
    expect(deletes.map((c) => c.tabela)).toEqual(['documents', 'accounts'])
  })

  /** O PostgREST exige um filtro para não apagar sem querer; o RLS já
   *  escopa ao usuário. `id não é nulo` = todas as linhas visíveis. */
  it('usa filtro explícito em vez de delete sem cláusula', async () => {
    montar()
    await apagarTudo()
    for (const c of falso.chamadas.filter((x) => x.op === 'delete')) {
      expect(c.filtros.length).toBeGreaterThan(0)
    }
  })

  it('falha ao apagar documentos NÃO tenta apagar as contas', async () => {
    montar({ erro: { tabela: 'documents', op: 'delete', message: 'falhou' } })
    await expect(apagarTudo()).rejects.toThrow(/falhou/)
    expect(falso.chamadas.some((c) => c.tabela === 'accounts')).toBe(false)
  })

  it('sem cliente Neon não apaga nada', async () => {
    dublê.cliente = null
    await expect(apagarTudo()).resolves.toBeUndefined()
  })
})
