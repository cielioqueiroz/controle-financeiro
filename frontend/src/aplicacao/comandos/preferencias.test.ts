import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SEM_PREFERENCIAS, aparelhoSincronizado, lerPreferenciasLocais } from '../../lib/preferencias'

const servidor = vi.hoisted(() => ({
  puxar: vi.fn(),
  salvar: vi.fn(),
}))
vi.mock('../../persist/preferencias', () => ({
  puxarPreferencias: servidor.puxar,
  salvarPreferencias: servidor.salvar,
}))

const { sincronizarPreferencias, gravarPreferencias } = await import('./preferencias')

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
})

describe('sincronizarPreferencias', () => {
  it('servidor manda: o aparelho passa a valer o que veio de lá', async () => {
    localStorage.setItem('tema', 'light')
    localStorage.setItem('cf:preferencias-sincronizadas', '1')
    servidor.puxar.mockResolvedValue({ ...SEM_PREFERENCIAS, tema: 'dark', apelido: 'Cel' })
    const valendo = await sincronizarPreferencias()
    expect(valendo).toMatchObject({ tema: 'dark', apelido: 'Cel' })
    expect(localStorage.getItem('tema')).toBe('dark')
    expect(localStorage.getItem('cf:apelido')).toBe('Cel')
    expect(servidor.salvar).not.toHaveBeenCalled()
  })

  /** Quem usava o app antes da 0013: o apelido local sobe sozinho. */
  it('primeira vez: sobe o que só o aparelho sabia e marca sincronizado', async () => {
    localStorage.setItem('cf:apelido', 'Velho')
    servidor.puxar.mockResolvedValue(SEM_PREFERENCIAS)
    servidor.salvar.mockResolvedValue(true)
    await sincronizarPreferencias()
    expect(servidor.salvar).toHaveBeenCalledWith(expect.objectContaining({ apelido: 'Velho' }))
    expect(aparelhoSincronizado()).toBe(true)
  })

  it('envio falhou: não marca, para tentar de novo no próximo login', async () => {
    localStorage.setItem('cf:apelido', 'Velho')
    servidor.puxar.mockResolvedValue(SEM_PREFERENCIAS)
    servidor.salvar.mockResolvedValue(false)
    await sincronizarPreferencias()
    expect(aparelhoSincronizado()).toBe(false)
  })

  /** Migração 0013 ausente ou rede fora: nada muda no aparelho. */
  it('servidor mudo: o aparelho fica como estava', async () => {
    localStorage.setItem('tema', 'light')
    servidor.puxar.mockResolvedValue(null)
    const valendo = await sincronizarPreferencias()
    expect(valendo.tema).toBe('light')
    expect(localStorage.getItem('tema')).toBe('light')
    expect(servidor.salvar).not.toHaveBeenCalled()
    expect(aparelhoSincronizado()).toBe(false)
  })
})

describe('gravarPreferencias', () => {
  it('grava no aparelho mesmo quando o servidor recusa', async () => {
    servidor.salvar.mockResolvedValue(false)
    expect(await gravarPreferencias({ periodoPadrao: 'ano' })).toBe(false)
    expect(lerPreferenciasLocais().periodoPadrao).toBe('ano')
  })

  it('manda a linha inteira, não só o campo mudado', async () => {
    localStorage.setItem('cf:apelido', 'Cel')
    servidor.salvar.mockResolvedValue(true)
    await gravarPreferencias({ corAvatar: 'vinho' })
    expect(servidor.salvar).toHaveBeenCalledWith(expect.objectContaining({ apelido: 'Cel', corAvatar: 'vinho' }))
  })
})
