import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { Recorrencias } from './Recorrencias'
import type { Recorrencia, Alerta } from '../domain/recorrencias'

const rec = (over: Partial<Recorrencia>): Recorrencia => ({
  chave: 'NETFLIX.COM',
  descricao: 'NETFLIX.COM',
  categoriaSlug: 'assinaturas',
  tipo: 'saida',
  valorTipicoCents: 3990,
  valorAnteriorCents: 3990,
  diaTipico: 5,
  variacao: 'fixo',
  competencias: ['2026-03', '2026-04', '2026-05'],
  ultimoValorCents: 3990,
  ultimaCompetencia: '2026-05',
  ...over,
})

describe('Recorrencias', () => {
  it('não renderiza nada sem recorrências', () => {
    const { container } = render(<Recorrencias recorrencias={[]} alertas={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra descrição, dia típico e valor', () => {
    render(<Recorrencias recorrencias={[rec({})]} alertas={[]} />)
    expect(screen.getByText('NETFLIX.COM')).toBeInTheDocument()
    expect(screen.getByText('dia 5')).toBeInTheDocument()
    expect(screen.getByText(/39,90/)).toBeInTheDocument()
  })

  it('marca as de valor variável', () => {
    render(<Recorrencias recorrencias={[rec({ variacao: 'variavel' })]} alertas={[]} />)
    expect(screen.getByText('valor varia')).toBeInTheDocument()
  })

  it('não marca as de valor fixo', () => {
    render(<Recorrencias recorrencias={[rec({})]} alertas={[]} />)
    expect(screen.queryByText('valor varia')).not.toBeInTheDocument()
  })

  it('mostra o alerta de mudança de valor com os dois valores', () => {
    const a: Alerta = {
      tipo: 'valor-mudou',
      chave: 'NETFLIX.COM',
      origem: 'saida',
      descricao: 'NETFLIX.COM',
      deCents: 3990,
      paraCents: 5590,
    }
    render(<Recorrencias recorrencias={[rec({})]} alertas={[a]} />)
    expect(screen.getByText(/mudou de.*39,90.*para.*55,90/)).toBeInTheDocument()
  })

  it('mostra o alerta de sumiço', () => {
    const a: Alerta = {
      tipo: 'sumiu',
      chave: 'ACADEMIA',
      origem: 'saida',
      descricao: 'ACADEMIA SMART',
      desdeCompetencia: '2026-05',
    }
    render(<Recorrencias recorrencias={[rec({})]} alertas={[a]} />)
    expect(screen.getByText(/ACADEMIA SMART não veio neste mês/)).toBeInTheDocument()
  })

  it('corta em 5 e expande com o botão', async () => {
    const muitas = Array.from({ length: 8 }, (_, i) =>
      rec({ chave: `C${i}`, descricao: `Cobrança ${i}` }),
    )
    render(<Recorrencias recorrencias={muitas} alertas={[]} />)
    expect(screen.queryByText('Cobrança 7')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /ver mais 3/ }))
    expect(screen.getByText('Cobrança 7')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /ver menos/ }))
    expect(screen.queryByText('Cobrança 7')).not.toBeInTheDocument()
  })

  it('sem botão de expandir quando cabe tudo', () => {
    render(<Recorrencias recorrencias={[rec({})]} alertas={[]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
