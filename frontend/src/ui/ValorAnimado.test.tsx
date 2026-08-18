import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ValorAnimado } from './ValorAnimado'
import { DiscretoProvider, useDiscreto } from '../dados/DiscretoProvider'
import { definirDiscreto } from '../domain/normalize/money'

/** O vazamento que este arquivo existe para impedir, e ele é sutil:
 *
 *  `ValorAnimado` desenha por `useTransform` sobre um motion value, que só
 *  recalcula quando o VALOR muda — fora do ciclo de render do React. Montar
 *  a tela com o modo já ligado funciona sem curto-circuito nenhum, porque o
 *  funil (`formatBRL`) mascara na primeira passada. O que quebra é
 *  ALTERNAR com a tela aberta: o valor não mudou, o motion value não
 *  recalcula, e os três tiles do painel seguem exibindo o número real.
 *
 *  ⚠️ A primeira versão deste teste montava com o modo já ligado e passava
 *  com o defeito em pé. Um teste que não reproduz a sequência do defeito é
 *  um teste verde que não protege nada. */

afterEach(() => {
  definirDiscreto(false)
  localStorage.clear()
})

function Interruptor() {
  const { alternar } = useDiscreto()
  return <button onClick={alternar}>alternar</button>
}

function montar() {
  render(
    <DiscretoProvider>
      <Interruptor />
      <ValorAnimado valor={123456} />
    </DiscretoProvider>,
  )
}

describe('ValorAnimado no modo discreto', () => {
  it('mascara ao ALTERNAR com a animação JÁ PARADA', async () => {
    // ⚠️ Esperar o valor final é o que dá validade ao teste. Alternando
    // enquanto a animação de 0,9s ainda corre, o motion value recalcula
    // sozinho e a máscara aparece mesmo com o componente sem assinar o
    // contexto — o teste vencia por corrida e passava com o defeito em pé.
    // No app real a animação terminou há muito e o valor está parado.
    const u = userEvent.setup()
    montar()
    await screen.findByText('R$ 1.234,56', undefined, { timeout: 3000 })

    await u.click(screen.getByRole('button', { name: 'alternar' }))
    expect(screen.getByText(/•/)).toBeInTheDocument()
    expect(screen.queryByText(/1\.234/)).not.toBeInTheDocument()
  })

  it('mascara também quando a página abre com o modo já ligado', () => {
    localStorage.setItem('discreto', '1')
    montar()
    expect(screen.getByText(/•/)).toBeInTheDocument()
  })

  it('alternar de volta devolve o número', async () => {
    const u = userEvent.setup()
    localStorage.setItem('discreto', '1')
    montar()
    await u.click(screen.getByRole('button', { name: 'alternar' }))
    expect(screen.queryByText(/•/)).not.toBeInTheDocument()
  })

  it('contagem de lançamentos não é dinheiro e não se esconde', async () => {
    const u = userEvent.setup()
    render(
      <DiscretoProvider>
        <Interruptor />
        <ValorAnimado valor={42} moeda={false} />
      </DiscretoProvider>,
    )
    await u.click(screen.getByRole('button', { name: 'alternar' }))
    expect(screen.queryByText(/•/)).not.toBeInTheDocument()
  })
})
