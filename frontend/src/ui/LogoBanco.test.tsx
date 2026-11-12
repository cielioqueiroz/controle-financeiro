import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LogoBanco } from './LogoBanco'

const bancos = ['bb', 'bradesco', 'caixa', 'mercadopago', 'nubank', 'sicredi', 'sicoob']

describe('LogoBanco', () => {
  it.each(bancos)('serve a marca local de %s sem repetir o nome acessível', (bank) => {
    const { container } = render(<LogoBanco bank={bank} />)
    expect(container.querySelector(`[data-bank-logo="${bank}"]`)).toBeInTheDocument()
    expect(container.querySelector('img')).toHaveAttribute('src', `/img/bancos/${bank}.svg`)
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('mantém o ponto institucional como fallback para banco desconhecido', () => {
    const { container } = render(<LogoBanco bank="futuro" />)
    expect(container.querySelector('[data-bank-logo="desconhecido"]')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
