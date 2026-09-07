import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { CarrosselBancos } from './CarrosselBancos'
import { BANCOS } from '../domain/banks'
import { buildLines } from '../domain/pdf/lines'
import { parse } from '../domain/parsers'
import type { TextItem } from '../domain/pdf/types'

/** O carrossel é a vitrine: ele diz "já lê os extratos de" e lista nomes.
 *
 *  ⚠️ A lista dele (`SUPORTADOS`) é uma SEGUNDA lista, separada do
 *  `domain/parsers/index.ts` — e o `AGENTS.md` §2.3 é explícito sobre o
 *  risco: *"quem responde o que o app lê é `parsers/index.ts`, não esta
 *  lista"*, e um nome ali sem parser é *"o app mentindo na vitrine"*.
 *
 *  Duas listas que precisam concordar e ninguém compara é uma divergência
 *  esperando a próxima pressa. É isso que este arquivo compara. */

const FIXTURES = [
  'nubank-fatura',
  'nubank-extrato',
  'bradesco-fatura',
  'bradesco-extrato',
  'bb-extrato',
  'sicredi-extrato',
  'sicoob-extrato',
  'mercadopago-fatura',
  'mercadopago-extrato',
]

/** Os bancos que o app PROVADAMENTE lê: os que algum documento de referência
 *  faz o despachante escolher. Não é a lista de ninguém — é o resultado. */
const lidosDeVerdade = new Set(
  FIXTURES.map((nome) => {
    const itens = JSON.parse(
      readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8'),
    ) as TextItem[]
    return parse(buildLines(itens)).kind.bank
  }),
)

/** Os nomes que a vitrine anuncia. NÃO renderiza — quem chama já renderizou.
 *  (Renderizar aqui dentro punha um segundo carrossel no DOM e dobrava toda
 *  contagem.) */
function nomesNaVitrine(): string[] {
  return Object.values(BANCOS)
    .map((b) => b.nome)
    .filter((nome) => screen.queryAllByText(nome).length > 0)
}

describe('a vitrine não mente', () => {
  it('todo banco anunciado tem parser provado por um documento de referência', () => {
    render(<CarrosselBancos />)
    const anunciados = nomesNaVitrine()
    const nomeDoBanco = (b: string) => BANCOS[b as keyof typeof BANCOS]?.nome

    const comParser = [...lidosDeVerdade].map(nomeDoBanco)
    for (const nome of anunciados) {
      expect(comParser, `"${nome}" está na vitrine e nenhum fixture o alcança`).toContain(nome)
    }
  })

  it('todo banco que o app lê aparece na vitrine — nada fica escondido', () => {
    render(<CarrosselBancos />)
    const anunciados = nomesNaVitrine()
    for (const banco of lidosDeVerdade) {
      const nome = BANCOS[banco as keyof typeof BANCOS].nome
      expect(anunciados, `"${nome}" tem parser e não está na vitrine`).toContain(nome)
    }
  })

  it('"desconhecido" nunca é anunciado', () => {
    render(<CarrosselBancos />)
    expect(screen.queryByText(BANCOS.desconhecido.nome)).not.toBeInTheDocument()
    expect(screen.queryByText(/desconhecid/i)).not.toBeInTheDocument()
  })
})

describe('o laço', () => {
  /** A lista aparece DUAS vezes para o laço fechar sem corte (a faixa desliza
   *  exatamente meia largura). A segunda cópia é decoração. */
  it('cada nome aparece duas vezes, e a segunda cópia é escondida do leitor de tela', () => {
    render(<CarrosselBancos />)

    const nubank = screen.getAllByText('Nubank')
    expect(nubank).toHaveLength(2)
    expect(nubank[0]).not.toHaveAttribute('aria-hidden', 'true')
    expect(nubank[1]).toHaveAttribute('aria-hidden', 'true')
  })

  /** Se a cópia decorativa não fosse escondida, um leitor de tela leria a
   *  lista inteira duas vezes seguidas. */
  it('nenhum nome é anunciado em dobro', () => {
    render(<CarrosselBancos />)
    for (const nome of nomesNaVitrine()) {
      const visiveis = screen
        .getAllByText(nome)
        .filter((el) => el.getAttribute('aria-hidden') !== 'true')
      expect(visiveis, nome).toHaveLength(1)
    }
  })
})
