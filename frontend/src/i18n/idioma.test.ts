import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { detectarIdioma, lerIdioma, salvarIdioma } from './idioma'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

function idiomaNavegador(v: string) {
  vi.stubGlobal('navigator', { language: v })
}

describe('idioma', () => {
  it('detecta pt/en/es pelo navegador, senão pt', () => {
    idiomaNavegador('en-US')
    expect(detectarIdioma()).toBe('en')
    idiomaNavegador('es-AR')
    expect(detectarIdioma()).toBe('es')
    idiomaNavegador('pt-BR')
    expect(detectarIdioma()).toBe('pt')
    idiomaNavegador('fr-FR')
    expect(detectarIdioma()).toBe('pt')
  })

  it('lerIdioma usa o storage; salvarIdioma persiste', () => {
    idiomaNavegador('en-US')
    expect(lerIdioma()).toBe('en') // sem storage → detecta
    salvarIdioma('es')
    expect(lerIdioma()).toBe('es')
  })

  it('valor inválido no storage cai na detecção', () => {
    localStorage.setItem('cf:idioma', 'zz')
    idiomaNavegador('en-US')
    expect(lerIdioma()).toBe('en')
  })
})
