import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FalhaImportacao } from './FalhaImportacao'
import type { FalhaImportacao as Falha } from '../lib/falha-importacao'

/** Esta tela nasceu do incidente de 2026-09-04 — o app quebrou no celular de
 *  outra pessoa e o erro era um toast que sumia em 4,5s. Ela substituiu o
 *  toast justamente porque um aviso que some é o formato errado para um
 *  problema que a pessoa ainda precisa RESOLVER.
 *
 *  E até 2026-09-06 ela mesma não tinha teste. */

const falha = (over: Partial<Falha> = {}): Falha => ({
  titulo: 'falha.digitalizado',
  saida: 'falha.digitalizadoSaida',
  arquivo: 'extrato-junho.pdf',
  detalhe: 'PdfDigitalizadoError: nenhum item de texto em 4 páginas',
  ...over,
})

describe('FalhaImportacao', () => {
  it('diz o que houve, o que fazer, e em qual arquivo', () => {
    render(<FalhaImportacao falha={falha()} restantes={0} onTentarOutro={() => {}} />)

    expect(screen.getByText('Este PDF é uma imagem, não texto.')).toBeInTheDocument()
    expect(screen.getByText('extrato-junho.pdf')).toBeInTheDocument()
    // A saída é a metade acionável: sem ela a tela só informa a derrota.
    // Texto exato — "texto" sozinho casa também com o título, e um matcher
    // que encontra dois elementos não prova qual dos dois está na tela.
    expect(screen.getByText(/Preciso do arquivo original do banco/)).toBeInTheDocument()
  })

  /** `role="alert"` é o que faz um leitor de tela ANUNCIAR a falha. Sem ele,
   *  quem navega por leitor fica com o foco onde estava e não sabe que a
   *  importação parou — exatamente o buraco que o toast já tinha. */
  it('é anunciada por leitor de tela', () => {
    render(<FalhaImportacao falha={falha()} restantes={0} onTentarOutro={() => {}} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('o nome do arquivo aparece na tela — é o que amarra a falha ao documento certo', () => {
    render(
      <FalhaImportacao
        falha={falha({ arquivo: 'Extrato_Conta_Corrente_06-2026.pdf' })}
        restantes={2}
        onTentarOutro={() => {}}
      />,
    )
    expect(screen.getByText('Extrato_Conta_Corrente_06-2026.pdf')).toBeInTheDocument()
  })
})

describe('o botão muda com a fila', () => {
  it('sem fila, convida a tentar outro arquivo', () => {
    render(<FalhaImportacao falha={falha()} restantes={0} onTentarOutro={() => {}} />)
    expect(screen.getByRole('button', { name: 'Escolher outro arquivo' })).toBeInTheDocument()
  })

  /** Com cinco arquivos soltos de uma vez, "escolher outro" seria mentira:
   *  os outros já estão na fila. */
  it('com fila, convida a seguir para o próximo', () => {
    render(<FalhaImportacao falha={falha()} restantes={3} onTentarOutro={() => {}} />)
    expect(screen.getByRole('button', { name: 'Seguir para o próximo' })).toBeInTheDocument()
  })

  it('clicar chama quem cuida da fila', async () => {
    const onTentarOutro = vi.fn()
    render(<FalhaImportacao falha={falha()} restantes={1} onTentarOutro={onTentarOutro} />)

    await userEvent.click(screen.getByRole('button', { name: 'Seguir para o próximo' }))
    expect(onTentarOutro).toHaveBeenCalledTimes(1)
  })
})

describe('detalhe técnico', () => {
  /** Fechado por padrão: a linha técnica é para quem for AJUDAR, e mostrá-la
   *  de cara transformaria um recado em despejo de stack. */
  it('começa oculto', () => {
    render(<FalhaImportacao falha={falha()} restantes={0} onTentarOutro={() => {}} />)

    expect(screen.queryByText(/PdfDigitalizadoError/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver detalhe técnico' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('abre, mostra a linha crua e o botão inverte', async () => {
    render(<FalhaImportacao falha={falha()} restantes={0} onTentarOutro={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver detalhe técnico' }))

    expect(
      screen.getByText('PdfDigitalizadoError: nenhum item de texto em 4 páginas'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar detalhe' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('fecha de novo', async () => {
    render(<FalhaImportacao falha={falha()} restantes={0} onTentarOutro={() => {}} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ver detalhe técnico' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar detalhe' }))

    expect(screen.queryByText(/PdfDigitalizadoError/)).not.toBeInTheDocument()
  })
})

describe('as nove causas rendem nove telas diferentes', () => {
  /** O `naoLi` original cobria nove causas com uma frase só, e nenhuma
   *  tinha como ser distinguida — nem por quem usa, nem por quem mantém. */
  const causas: Array<[Falha['titulo'], Falha['saida'], RegExp]> = [
    ['falha.vazio', 'falha.vazioSaida', /vazio/i],
    ['falha.naoEhPdf', 'falha.naoEhPdfSaida', /não é um PDF/i],
    ['falha.protegido', 'falha.protegidoSaida', /senha/i],
    ['falha.corrompido', 'falha.corrompidoSaida', /danificado|incompleto/i],
    ['falha.navegador', 'falha.navegadorSaida', /antigo/i],
    ['falha.semParser', 'falha.semParserSaida', /ainda não sei ler/i],
  ]

  for (const [titulo, saida, esperado] of causas) {
    it(`${titulo} tem título próprio`, () => {
      render(
        <FalhaImportacao
          falha={falha({ titulo, saida })}
          restantes={0}
          onTentarOutro={() => {}}
        />,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(esperado)
    })
  }
})
