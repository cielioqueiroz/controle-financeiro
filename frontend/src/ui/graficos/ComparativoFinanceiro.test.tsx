import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComparativoFinanceiro } from './ComparativoFinanceiro'

describe('ComparativoFinanceiro', () => {
  it('mostra receitas, despesas, consumo e resultado', () => {
    render(<ComparativoFinanceiro gastoCents={250000} entradasCents={500000} saldoCents={250000} />)

    expect(screen.getByText('Receitas × despesas')).toBeInTheDocument()
    expect(screen.getByText('50% da renda consumida')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 2.500,00')).toHaveLength(2)
    expect(screen.getByText('50,0%')).toBeInTheDocument()
  })

  it('não inventa consumo quando o recorte não tem receita', () => {
    render(<ComparativoFinanceiro gastoCents={250000} entradasCents={0} saldoCents={-250000} />)

    expect(screen.getByText('sem receita no recorte')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
