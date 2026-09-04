import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { AberturaTutorial } from './AberturaTutorial'
import { marcarTutorialVisto } from '../lib/perfil'

/** A regra que este arquivo guarda: **o tutorial volta enquanto a conta
 *  estiver vazia**, mesmo para quem já o fechou.
 *
 *  Antes ele aparecia uma vez só, no minuto do cadastro — quando a pessoa
 *  ainda não tem o extrato na mão. Quem voltava dias depois, já com o PDF,
 *  não tinha mais como reencontrar a explicação sem saber que existe um
 *  "ver de novo" escondido no menu da conta. */

const estado = {
  todas: null as unknown[] | null,
  carregando: true,
}

vi.mock('../dados/DadosProvider', () => ({
  useDados: () => estado,
}))

function montar() {
  const abrir = vi.fn()
  const r = render(<AberturaTutorial onAbrir={abrir} />)
  return { abrir, ...r }
}

describe('AberturaTutorial', () => {
  beforeEach(() => {
    localStorage.clear()
    estado.todas = null
    estado.carregando = true
  })

  it('não decide nada enquanto os dados não voltaram', () => {
    const { abrir } = montar()
    expect(abrir).not.toHaveBeenCalled()
  })

  it('abre para quem nunca viu', () => {
    estado.todas = []
    estado.carregando = false
    expect(montar().abrir).toHaveBeenCalledTimes(1)
  })

  // O coração do pedido: já viu, fechou, e a conta continua sem nada.
  it('abre DE NOVO quando a conta está vazia, mesmo já tendo sido visto', () => {
    marcarTutorialVisto()
    estado.todas = []
    estado.carregando = false
    expect(montar().abrir).toHaveBeenCalledTimes(1)
  })

  // E para de aparecer sozinho no instante em que a pessoa começa de fato.
  it('não abre quando já há lançamento e o tutorial já foi visto', () => {
    marcarTutorialVisto()
    estado.todas = [{ id: 'x' }]
    estado.carregando = false
    expect(montar().abrir).not.toHaveBeenCalled()
  })

  // `null` é "ainda não sei", não "conta vazia". Confundir os dois jogaria o
  // tutorial na cara de quem tem três anos de histórico, toda vez.
  it('não confunde "ainda carregando" com "conta vazia"', () => {
    marcarTutorialVisto()
    estado.todas = null
    estado.carregando = false
    expect(montar().abrir).not.toHaveBeenCalled()
  })

  // Fechar o tutorial numa conta vazia não pode reabri-lo no commit
  // seguinte: a condição continua verdadeira, e sem a trava seria um modal
  // que se recusa a fechar.
  it('decide uma vez só por montagem', () => {
    estado.todas = []
    estado.carregando = false
    const { abrir, rerender } = montar()
    rerender(<AberturaTutorial onAbrir={abrir} />)
    rerender(<AberturaTutorial onAbrir={abrir} />)
    expect(abrir).toHaveBeenCalledTimes(1)
  })
})
