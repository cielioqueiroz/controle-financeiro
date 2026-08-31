import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResultadoImport } from './ResultadoImport'
import type { ParseResult, RawTransaction } from '../domain/parsers/types'

/** O halo no botão de salvar.
 *
 *  A prévia é longa — cabeçalho, carimbo, gráfico, lista de lançamentos — e
 *  o botão que conclui o trabalho fica no topo, fora do campo de visão de
 *  quem acabou de rolar até o fim. Quando a conferência FECHA, o botão chama.
 *
 *  E só quando fecha: documento que divergiu não deve ser empurrado para o
 *  histórico com pressa — ali o que a pessoa precisa é olhar a diferença. */

function tx(over: Partial<RawTransaction> = {}): RawTransaction {
  return {
    date: new Date(2026, 5, 10),
    description: 'MERCADO AURORA',
    amountCents: 5000,
    installment: null,
    card: null,
    fx: null,
    kind: 'compra',
    raw: '10/06 MERCADO AURORA 50,00',
    ...over,
  }
}

/** `declaredTotal` igual à soma das compras faz `validar` devolver `confere`;
 *  diferente, `diverge`; ausente, `sem-gabarito`. É o gabarito de verdade,
 *  não um dublê — o teste passa pelo mesmo caminho da tela. */
function resultado(declaredTotal: number | null): ParseResult {
  return {
    transactions: [tx(), tx({ amountCents: 3000 })],
    declaredTotal,
    declaredIncome: null,
    declaredExpense: null,
    period: { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) },
    account: {
      bank: 'nubank',
      type: 'credit_card',
      last4: '1234',
      agency: null,
      number: null,
      holderName: null,
    },
    forward: {
      nextCloseDate: null,
      nextInvoiceBalance: null,
      totalOpenBalance: null,
      futureInstallmentsTotal: null,
    },
  }
}

function montar(declaredTotal: number | null, over: { salvando?: boolean } = {}) {
  // A prévia desenha o donut, que navega para /lancamentos no clique: sem
  // Router ele derruba a árvore inteira na montagem.
  return render(
    <MemoryRouter>
      <ResultadoImport
        kind={{ bank: 'nubank', docType: 'fatura' }}
        result={resultado(declaredTotal)}
        regras={[]}
        podeSalvar
        salvando={over.salvando ?? false}
        onSalvar={vi.fn()}
        onLimpar={vi.fn()}
      />
    </MemoryRouter>,
  )
}

// Enquanto grava, o rótulo do botão vira "Salvando…" — casar só por
// "Salvar no histórico" faria o teste do estado `salvando` procurar um
// botão que não existe naquele momento.
const botaoSalvar = () => screen.getByRole('button', { name: /salvar no hist|salvando/i })

describe('o botão de salvar chama quando a conferência fecha', () => {
  it('confere: o botão ganha o halo', () => {
    montar(8000) // 5000 + 3000
    expect(botaoSalvar()).toHaveClass('chamando')
  })

  // O teste que impede o efeito de virar enfeite permanente.
  it('diverge: o botão NÃO chama', () => {
    montar(9999)
    expect(botaoSalvar()).not.toHaveClass('chamando')
  })

  it('sem gabarito: o botão NÃO chama', () => {
    montar(null)
    expect(botaoSalvar()).not.toHaveClass('chamando')
  })

  // Já clicou: chamar de novo enquanto grava é pedir um segundo clique num
  // botão que já está trabalhando.
  it('enquanto grava, para de chamar', () => {
    montar(8000, { salvando: true })
    expect(botaoSalvar()).not.toHaveClass('chamando')
  })

  // A cor do anel é a do banco, e vem por variável — sem ela o `::after`
  // cairia no `currentColor`, que no botão primário é a cor do TEXTO.
  it('o anel usa a cor do banco', () => {
    montar(8000)
    expect(botaoSalvar().style.getPropertyValue('--halo')).toBe('#820AD1')
  })
})
