import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MoedaLogo } from './MoedaLogo'

describe('MoedaLogo', () => {
  it('não usa cor fixa em código — todo traço sai de variável de tema', () => {
    const { container } = render(<MoedaLogo />)
    const svg = container.querySelector('svg')!

    // #065f37 era o verde da paleta neon anterior ao rename, fixo em código:
    // a moeda ficava âmbar por fora e verde no contorno, sem responder ao
    // tema. Este teste existe para isso não voltar.
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{6}/i)
  })

  it('gera ids únicos por instância, para duas moedas não colidirem', () => {
    const { container } = render(
      <>
        <MoedaLogo />
        <MoedaLogo />
      </>,
    )
    const clips = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    expect(clips).toHaveLength(2)
    expect(clips[0]).not.toBe(clips[1])
  })
})
