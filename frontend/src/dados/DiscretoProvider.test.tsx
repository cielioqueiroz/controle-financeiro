import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DiscretoProvider, useDinheiro, useDiscreto } from './DiscretoProvider'
import { definirDiscreto } from '../domain/normalize/money'

/** O modo discreto tem que mascarar TODO valor da tela, e não alguns.
 *
 *  Em 2026-08-31 ele mascarava três lugares e deixava 74 valores visíveis. A
 *  causa: `formatBRL` lê um estado de MÓDULO, e trocar o valor de um contexto
 *  só repinta quem CONSOME o contexto — três componentes. Todo o resto seguia
 *  mostrando a saída da renderização anterior.
 *
 *  O primeiro teste aqui é de comportamento; o segundo é o que impede a
 *  regressão, e é ele que vale a leitura. */

afterEach(() => definirDiscreto(false))

function Mostra() {
  const dinheiro = useDinheiro()
  return <span data-testid="valor">{dinheiro(123456)}</span>
}

function Interruptor() {
  const { alternar } = useDiscreto()
  return <button onClick={alternar}>alternar</button>
}

describe('useDinheiro', () => {
  it('mascara o valor quando o modo liga, sem o componente ser remontado', async () => {
    const user = userEvent.setup()
    localStorage.removeItem('discreto')
    render(
      <DiscretoProvider>
        <Interruptor />
        <Mostra />
      </DiscretoProvider>,
    )

    expect(screen.getByTestId('valor')).toHaveTextContent('1.234,56')

    await user.click(screen.getByRole('button', { name: 'alternar' }))

    // O defeito: aqui continuava "R$ 1.234,56", porque o componente não
    // assinava o contexto e ninguém mandou React repintá-lo.
    expect(screen.getByTestId('valor')).toHaveTextContent('••••')
    expect(screen.getByTestId('valor')).not.toHaveTextContent('1.234,56')
  })
})

/** Varre a árvore da UI atrás de quem importa o `formatBRL` direto.
 *
 *  Este é o teste que importa. O defeito não foi um componente escrito
 *  errado — foi a AUSÊNCIA de uma regra: `formatBRL` está exportado, formata
 *  igual, e não repinta nunca. Qualquer componente novo cairia no mesmo buraco
 *  em silêncio, e o modo discreto não tem tela vermelha: ele simplesmente
 *  mostra o dinheiro de alguém.
 *
 *  `formatBRLCru` continua livre — é o desvio deliberado do relatório em PDF,
 *  onde exportar é ato consciente e máscara não serve para nada. */
function arquivosDeUi(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivosDeUi(caminho))
    else if (/\.tsx?$/.test(entrada.name) && !entrada.name.includes('.test.')) {
      achados.push(caminho)
    }
  }
  return achados
}

describe('a UI não formata dinheiro por fora do modo discreto', () => {
  it('nenhum componente importa formatBRL direto', () => {
    const arquivos = [...arquivosDeUi('src/ui'), ...arquivosDeUi('src/paginas')]
    const infratores = arquivos.filter((f) => {
      const fonte = readFileSync(f, 'utf-8')
      return /import\s*\{[^}]*\bformatBRL\b[^}]*\}\s*from\s*'[^']*normalize\/money'/.test(fonte)
    })

    expect(
      infratores,
      'Use `useDinheiro()` do DiscretoProvider: ele assina o contexto e faz o ' +
        'componente repintar quando o modo discreto muda. `formatBRL` direto ' +
        'formata igual e NÃO repinta — o valor fica na tela.',
    ).toEqual([])
  })

  // A varredura precisa estar olhando para alguma coisa: um erro de caminho
  // deixaria a lista vazia e o teste verde para sempre.
  it('a varredura encontra os arquivos que deveria', () => {
    const arquivos = [...arquivosDeUi('src/ui'), ...arquivosDeUi('src/paginas')]
    expect(arquivos.length).toBeGreaterThan(30)
    expect(arquivos.some((f) => f.includes('SaldoConta'))).toBe(true)
  })
})
