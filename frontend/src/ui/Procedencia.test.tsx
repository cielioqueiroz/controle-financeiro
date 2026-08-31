import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Procedencia } from './Procedencia'
import type { TransacaoSalva } from '../persist/puxar'

let seq = 0
function tx(over: Partial<TransacaoSalva> = {}): TransacaoSalva {
  seq += 1
  return {
    id: `t${seq}`,
    date: '2026-06-10',
    competencia: '2026-06',
    description: 'COMPRA',
    label: null,
    amount_cents: 1000,
    kind: 'expense',
    category_slug: 'outros',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'doc-a',
    installment: null,
    ...over,
  }
}

describe('Procedencia', () => {
  // O ponto do componente: os números da tela vieram de N documentos, e o
  // usuário tem como saber quais sem sair do Painel.
  it('conta DOCUMENTOS, não transações', () => {
    render(
      <Procedencia
        txs={[
          tx({ document_id: 'doc-a' }),
          tx({ document_id: 'doc-a' }),
          tx({ document_id: 'doc-a' }),
        ]}
        periodo="junho de 2026"
      />,
    )
    expect(screen.getByText(/1 fatura/)).toBeInTheDocument()
  })

  it('separa fatura de extrato', () => {
    render(
      <Procedencia
        txs={[
          tx({ document_id: 'f1', doc_type: 'fatura' }),
          tx({ document_id: 'f2', doc_type: 'fatura' }),
          tx({ document_id: 'e1', doc_type: 'extrato', bank: 'bradesco' }),
        ]}
        periodo="junho de 2026"
      />,
    )
    expect(screen.getByText(/2 faturas/)).toBeInTheDocument()
    expect(screen.getByText(/1 extrato/)).toBeInTheDocument()
  })

  // "4 documentos" não diz se a fatura do mês entrou — e é a fatura que traz
  // o detalhe das compras. Por isso a contagem é por tipo, não um total só.
  it('some com o tipo que não aparece, em vez de escrever zero', () => {
    render(
      <Procedencia txs={[tx({ doc_type: 'extrato' })]} periodo="junho de 2026" />,
    )
    expect(screen.queryByText(/0 faturas/)).toBeNull()
    expect(screen.getByText(/1 extrato/)).toBeInTheDocument()
  })

  it('lista os bancos do recorte, sem repetir', () => {
    render(
      <Procedencia
        txs={[
          tx({ bank: 'nubank', document_id: 'a' }),
          tx({ bank: 'nubank', document_id: 'b' }),
          tx({ bank: 'bradesco', document_id: 'c' }),
        ]}
        periodo="junho de 2026"
      />,
    )
    expect(screen.getAllByText('Nubank')).toHaveLength(1)
    expect(screen.getByText('Bradesco')).toBeInTheDocument()
  })

  // A ordem sai do catálogo, não da ordem de aparição: senão a fileira se
  // reordena a cada troca de período e a pessoa relê para achar o mesmo
  // banco no mesmo lugar.
  it('mantém a ordem do catálogo, não a de aparição', () => {
    const { container } = render(
      <Procedencia
        txs={[tx({ bank: 'bradesco', document_id: 'a' }), tx({ bank: 'nubank', document_id: 'b' })]}
        periodo="junho de 2026"
      />,
    )
    const texto = container.textContent ?? ''
    expect(texto.indexOf('Nubank')).toBeLessThan(texto.indexOf('Bradesco'))
  })

  it('mostra o período do recorte', () => {
    render(<Procedencia txs={[tx()]} periodo="junho de 2026" />)
    expect(screen.getByText('junho de 2026')).toBeInTheDocument()
  })

  // Recorte vazio já tem tela própria no Painel; uma linha de procedência
  // dizendo "0 documentos" seria o zero que a regra do projeto proíbe.
  it('não desenha nada sem transação', () => {
    const { container } = render(<Procedencia txs={[]} periodo="junho de 2026" />)
    expect(container).toBeEmptyDOMElement()
  })
})
