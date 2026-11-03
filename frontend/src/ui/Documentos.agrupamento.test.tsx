import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConteudoDocumentos } from './Documentos'
import type { DocumentoSalvo } from '../persist/documentos'

/** A lista de documentos vinha achatada, ordenada por data de importação.
 *
 *  Com sete documentos de três meses ela já atrapalhava quem procurava: o
 *  usuário procura pelo MÊS do documento, não pelo dia em que o subiu — e
 *  importar a fatura de junho depois da de agosto punha junho no topo.
 *
 *  Arquivo separado do `Documentos.test.tsx` porque aquele mocka
 *  `puxarDocumentos` com UM documento fixo, e o agrupamento só se observa
 *  com vários, de meses diferentes. */

function doc(over: Partial<DocumentoSalvo> & { id: string }): DocumentoSalvo {
  return {
    bank: 'nubank',
    doc_type: 'fatura',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    filename: null,
    imported_at: '2026-07-01T00:00:00Z',
    declared_total: null,
    declared_income: null,
    declared_expense: null,
    ...over,
  }
}

const DOCS: DocumentoSalvo[] = [
  // Chega primeiro (importado por último) mas é o mês mais ANTIGO: é este
  // par que a ordenação por importação errava.
  doc({ id: 'jun', period_end: '2026-06-30', imported_at: '2026-08-31T10:00:00Z' }),
  doc({ id: 'ago-mp', bank: 'mercadopago', doc_type: 'extrato', period_end: '2026-08-30', imported_at: '2026-08-31T09:00:00Z' }),
  doc({ id: 'ago-nu', period_end: '2026-08-20', imported_at: '2026-08-31T08:00:00Z' }),
  doc({ id: 'sem', period_end: null, imported_at: '2026-08-31T07:00:00Z' }),
]

vi.mock('../persist/documentos', () => ({
  puxarDocumentos: () => Promise.resolve(DOCS),
  apagarDocumento: vi.fn(),
  apagarTudo: vi.fn(),
}))

function montar(documentoSelecionado: string | null = null) {
  return render(<ConteudoDocumentos onMudou={vi.fn()} documentoSelecionado={documentoSelecionado} contagem={new Map([
    ['ago-mp', { qtd: 3, totalCents: 10000 }],
    ['ago-nu', { qtd: 2, totalCents: 25050 }],
  ])} />)
}

const mes = (nome: RegExp) => screen.getByRole('button', { name: nome })

describe('Documentos — agrupados por competência', () => {
  it('põe um cabeçalho por mês', async () => {
    montar()
    expect(await screen.findByText(/agosto de 2026/i)).toBeInTheDocument()
    expect(screen.getByText(/junho de 2026/i)).toBeInTheDocument()
  })

  // O mês mais recente primeiro, e NÃO a ordem de importação: o documento
  // de junho foi o último a entrar e precisa ficar embaixo.
  it('ordena do mês mais recente para o mais antigo', async () => {
    const { container } = montar()
    await screen.findByText(/agosto de 2026/i)
    const texto = container.textContent ?? ''
    expect(texto.indexOf('agosto de 2026')).toBeLessThan(texto.indexOf('junho de 2026'))
  })

  // Documento sem período não pode inventar um mês nem sumir da lista —
  // ele continua apagável, e é por isso que precisa estar visível.
  it('junta o que não tem período num grupo próprio, no fim', async () => {
    const { container } = montar()
    await screen.findByText(/agosto de 2026/i)
    const texto = container.textContent ?? ''
    expect(texto).toContain('sem período')
    expect(texto.indexOf('junho de 2026')).toBeLessThan(texto.indexOf('sem período'))
  })

  it('mantém todos os documentos — agrupar não é filtrar', async () => {
    montar()
    await screen.findByText(/agosto de 2026/i)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir todos os meses' }))
    // Rótulo EXATO: `/apagar/i` casaria também o "Apagar tudo e recomeçar"
    // do rodapé, e o teste passaria a contar cinco onde há quatro.
    expect(screen.getAllByRole('button', { name: 'Apagar documento' })).toHaveLength(
      DOCS.length,
    )
  })
})

// Pedido do dono em 03/11: com vários meses abertos a lista confundia. Cada
// mês abre e fecha, e só o mais recente começa aberto.
describe('Documentos — meses recolhíveis', () => {
  it('só o mês mais recente começa aberto', async () => {
    montar()
    await screen.findByText(/agosto de 2026/i)
    expect(mes(/^agosto de 2026/i)).toHaveAttribute('aria-expanded', 'true')
    expect(mes(/^junho de 2026/i)).toHaveAttribute('aria-expanded', 'false')
    expect(mes(/^sem período/i)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('button', { name: 'Apagar documento' })).toHaveLength(2)
  })

  it('o cabeçalho fechado diz quantos documentos e quanto gasto real o mês tem', async () => {
    montar()
    await screen.findByText(/agosto de 2026/i)
    expect(mes(/^agosto de 2026/i)).toHaveTextContent(/2 documentos.*Gasto real salvo: R\$\s350,50/)
    expect(mes(/^junho de 2026/i)).toHaveTextContent('1 documento')
  })

  it('clicar no mês abre e fecha', async () => {
    montar()
    await screen.findByText(/agosto de 2026/i)
    await userEvent.click(mes(/^junho de 2026/i))
    expect(mes(/^junho de 2026/i)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('button', { name: 'Apagar documento' })).toHaveLength(3)
    await userEvent.click(mes(/^agosto de 2026/i))
    expect(mes(/^agosto de 2026/i)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByRole('button', { name: 'Apagar documento' })).toHaveLength(1)
  })

  // Quem chega por "Ver documento importado" (Relatórios, Painel) precisa
  // ver o documento, mesmo de um mês antigo.
  it('o mês do documento aberto por link começa aberto', async () => {
    montar('jun')
    await screen.findByText(/agosto de 2026/i)
    expect(mes(/^junho de 2026/i)).toHaveAttribute('aria-expanded', 'true')
  })

  it('fechar todos fecha os meses', async () => {
    montar()
    await screen.findByText(/agosto de 2026/i)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir todos os meses' }))
    await userEvent.click(screen.getByRole('button', { name: 'Fechar todos os meses' }))
    expect(screen.queryByRole('button', { name: 'Apagar documento' })).not.toBeInTheDocument()
  })
})

describe('Documentos — o banco vem do catálogo', () => {
  // O código antigo pintava de vermelho-Bradesco tudo o que não fosse
  // Nubank, e escrevia o slug com `capitalize`. O Mercado Pago entrou em
  // 31/08 e apareceu como "Mercadopago", na cor do concorrente.
  it('escreve o nome do catálogo, não o slug', async () => {
    montar()
    expect(await screen.findByText('Mercado Pago')).toBeInTheDocument()
    expect(screen.queryByText('Mercadopago')).toBeNull()
  })

  it('usa o fundo suave do banco no selo', async () => {
    montar()
    await screen.findByText('Mercado Pago')
    const selo = screen.getByText('Me')
    expect(selo).toHaveStyle({ background: 'rgba(0, 158, 227, 0.12)' })
  })
})
