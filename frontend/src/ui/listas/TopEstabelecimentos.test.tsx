import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopEstabelecimentos } from './TopEstabelecimentos'
import type { GrupoEstabelecimento } from '../../domain/agrupar'

const grupo = (over: Partial<GrupoEstabelecimento> = {}): GrupoEstabelecimento => ({
  merchant: 'IFOOD',
  rotulo: 'IFOOD',
  totalCents: 24000,
  contagem: 3,
  ...over,
})

describe('TopEstabelecimentos', () => {
  it('mostra o lugar, o total somado e quantas compras foram', () => {
    render(<TopEstabelecimentos itens={[grupo()]} onAbrir={vi.fn()} />)
    expect(screen.getByText('IFOOD')).toBeInTheDocument()
    expect(screen.getByText('R$ 240,00')).toBeInTheDocument()
    expect(screen.getByText('3 compras')).toBeInTheDocument()
  })

  // Sem a contagem, "R$ 240" é indistinguível de uma compra única de R$ 240 —
  // e é a repetição que faz este ranking existir.
  // WCAG 2.5.3: quem aciona por voz fala o que vê. Um `aria-label` à parte
  // ("IFOOD: R$ 240,00 em 3 compras") trocava o nome inteiro do botão.
  it('o nome do botão é o texto visível, e "Ver lançamentos" vem depois', () => {
    render(<TopEstabelecimentos itens={[grupo()]} onAbrir={vi.fn()} />)
    const botao = screen.getByRole('button')
    expect(botao).not.toHaveAttribute('aria-label')
    expect(botao).toHaveAccessibleName(/^1 IFOOD 3 compras R\$\s240,00 Ver lançamentos\.$/)
  })

  it('usa o singular quando foi uma compra só', () => {
    render(<TopEstabelecimentos itens={[grupo({ contagem: 1 })]} onAbrir={vi.fn()} />)
    expect(screen.getByText('1 compra')).toBeInTheDocument()
  })

  // O clique leva à CHAVE, não ao rótulo: com o rótulo, um grupo renomeado
  // abriria só as compras que receberam aquele nome.
  it('clicar abre os lançamentos pela chave normalizada, não pelo rótulo', async () => {
    const onAbrir = vi.fn()
    const usuario = userEvent.setup()
    render(
      <TopEstabelecimentos
        itens={[grupo({ merchant: 'PAG*IFOOD*RESTAURA', rotulo: 'iFood' })]}
        onAbrir={onAbrir}
      />,
    )
    await usuario.click(screen.getByRole('button'))
    expect(onAbrir).toHaveBeenCalledWith('PAG*IFOOD*RESTAURA')
  })

  it('mantém a ordem recebida (quem ordena é porEstabelecimento)', () => {
    render(
      <TopEstabelecimentos
        itens={[
          grupo({ merchant: 'A', rotulo: 'A', totalCents: 9000 }),
          grupo({ merchant: 'B', rotulo: 'B', totalCents: 100 }),
        ]}
        onAbrir={vi.fn()}
      />,
    )
    const nomes = screen.getAllByRole('button').map((b) => b.textContent)
    expect(nomes[0]).toContain('A')
    expect(nomes[1]).toContain('B')
  })

  it('não renderiza nada quando não há gasto no período', () => {
    const { container } = render(<TopEstabelecimentos itens={[]} onAbrir={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
