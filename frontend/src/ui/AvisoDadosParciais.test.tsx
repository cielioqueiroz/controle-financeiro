import '@testing-library/jest-dom/vitest'
import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AvisoDadosParciais } from './AvisoDadosParciais'

it('explica qual parte falhou e permite tentar novamente', () => {
  const tentar = vi.fn()
  render(<AvisoDadosParciais falhas={{ saldos: 'erro.semConexao', categorias: 'dados.categoriasIndisponiveis' }} onTentar={tentar} />)
  expect(screen.getByRole('status')).toHaveTextContent('Não consegui carregar os saldos')
  expect(screen.getByRole('status')).toHaveTextContent('Não consegui carregar suas categorias')
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(tentar).toHaveBeenCalledOnce()
})

it('não apresenta aviso quando todas as consultas funcionaram', () => {
  render(<AvisoDadosParciais falhas={{}} onTentar={vi.fn()} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
