import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

function montar() {
  return render(<ConteudoDocumentos onMudou={vi.fn()} contagem={new Map()} />)
}

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
    // Rótulo EXATO: `/apagar/i` casaria também o "Apagar tudo e recomeçar"
    // do rodapé, e o teste passaria a contar cinco onde há quatro.
    expect(screen.getAllByRole('button', { name: 'Apagar documento' })).toHaveLength(
      DOCS.length,
    )
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

  it('usa a cor institucional do banco no selo', async () => {
    montar()
    await screen.findByText('Mercado Pago')
    const selo = screen.getByText('Me')
    expect(selo).toHaveStyle({ color: '#009EE3' })
  })
})
