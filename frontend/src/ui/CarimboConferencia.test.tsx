import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CarimboConferencia } from './CarimboConferencia'
import type { Validacao } from '../domain/validate/checksum'

const confere: Validacao = {
  status: 'confere',
  contagem: 21,
  somaExtraida: 4101225,
  diferenca: 0,
}
const diverge: Validacao = {
  status: 'diverge',
  contagem: 18,
  somaExtraida: 4098385,
  diferenca: -12840,
}
const semGabarito: Validacao = {
  status: 'sem-gabarito',
  contagem: 9,
  somaExtraida: 62134,
  diferenca: null,
}

const DATA = new Date(2026, 5, 30) // 30/06/2026

describe('CarimboConferencia', () => {
  it('confere: carimba a data e o valor que bateu', () => {
    render(<CarimboConferencia conf={confere} data={DATA} />)
    expect(screen.getByText(/confere/i)).toBeInTheDocument()
    expect(screen.getByText(/30\/06\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/41\.012,25/)).toBeInTheDocument()
  })

  // Dizer só "não fechou" manda procurar sem bússola: o que a pessoa vai
  // caçar é a diferença, e é ela que o carimbo carrega.
  it('diverge: carimba a diferença e a contagem, não o total', () => {
    render(<CarimboConferencia conf={diverge} data={DATA} />)
    expect(screen.getByText(/diverge/i)).toBeInTheDocument()
    expect(screen.getByText(/128,40/)).toBeInTheDocument()
    expect(screen.getByText(/18 lançamentos/)).toBeInTheDocument()
  })

  // A diferença é exibida em magnitude: `diferenca` é extraído − declarado,
  // e um "-R$ 128,40" no carimbo faria pensar em dinheiro negativo em vez
  // de em distância entre dois números.
  it('diverge: mostra a diferença sem sinal', () => {
    render(<CarimboConferencia conf={diverge} data={DATA} />)
    expect(screen.queryByText(/-\s*R\$\s*128,40/)).toBeNull()
  })

  it('sem gabarito: diz que o documento não declarou total', () => {
    render(<CarimboConferencia conf={semGabarito} data={DATA} />)
    expect(screen.getByText(/sem gabarito/i)).toBeInTheDocument()
    expect(screen.getByText(/não declara total/i)).toBeInTheDocument()
  })

  // Cor não é informação para quem não a distingue, e a inclinação também
  // não. Nos três estados a palavra tem que estar escrita.
  it('nos três estados o veredito está por extenso, não só na cor', () => {
    for (const conf of [confere, diverge, semGabarito]) {
      const { unmount } = render(<CarimboConferencia conf={conf} data={DATA} />)
      expect(screen.getByRole('status')).toHaveTextContent(/\w{5,}/)
      unmount()
    }
  })

  // `role="status"` faz o leitor de tela anunciar o veredito quando ele
  // aparece — o carimbo surge depois da leitura do PDF, não com a página.
  it('é anunciado como status', () => {
    render(<CarimboConferencia conf={confere} data={DATA} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  // Extrato do BB não declara período em toda amostra; o carimbo continua
  // válido sem a data, e não pode escrever "Invalid Date".
  it('sem data, carimba só o valor', () => {
    render(<CarimboConferencia conf={confere} data={null} />)
    expect(screen.getByText(/41\.012,25/)).toBeInTheDocument()
    expect(screen.queryByText(/Invalid/i)).toBeNull()
  })
})
