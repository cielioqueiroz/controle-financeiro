import { afterEach, describe, expect, it, vi } from 'vitest'

type Regras = {
  createScriptURL?: (entrada: string) => string
}

const trustedTypesOriginal = Object.getOwnPropertyDescriptor(globalThis, 'trustedTypes')

async function instalarFabrica() {
  const criadas: string[] = []
  let regrasDefault: Regras | undefined
  Object.defineProperty(globalThis, 'trustedTypes', {
    configurable: true,
    value: {
      createPolicy(nome: string, regras: Regras) {
        criadas.push(nome)
        if (nome === 'default') regrasDefault = regras
        return {
          createScriptURL(entrada: string) {
            return regras.createScriptURL?.(entrada)
          },
        }
      },
    },
  })
  await import('./trusted-types')
  return { criadas, regras: regrasDefault }
}

afterEach(() => {
  vi.resetModules()
  if (trustedTypesOriginal) Object.defineProperty(globalThis, 'trustedTypes', trustedTypesOriginal)
  else delete (globalThis as { trustedTypes?: unknown }).trustedTypes
})

describe('política Trusted Types do app', () => {
  it('não faz nada em navegador sem suporte', async () => {
    delete (globalThis as { trustedTypes?: unknown }).trustedTypes
    await expect(import('./trusted-types')).resolves.toBeDefined()
  })

  it('cria somente a política default', async () => {
    const { criadas } = await instalarFabrica()
    expect(criadas).toEqual(['default'])
  })

  it('aceita o worker versionado do pdf.js na própria origem', async () => {
    const { regras } = await instalarFabrica()
    const criar = regras?.createScriptURL
    expect(criar?.(`${location.origin}/assets/pdf.worker.min-ab12_CD.mjs`)).toContain(
      '/assets/pdf.worker.min-ab12_CD.mjs',
    )
  })

  it('aceita o blob do polyfill do worker na própria origem', async () => {
    const { regras } = await instalarFabrica()
    const criar = regras?.createScriptURL
    expect(criar?.(`blob:${location.origin}/worker-id`)).toBe(`blob:${location.origin}/worker-id`)
  })

  it.each([
    ['worker de outra origem', 'https://atacante.invalid/pdf.worker.min-x.mjs'],
    ['outro script da própria origem', `${location.origin}/assets/app-x.js`],
    ['blob de outra origem', 'blob:https://atacante.invalid/worker-id'],
  ])('recusa %s', async (_caso, url) => {
    const { regras } = await instalarFabrica()
    const criar = regras?.createScriptURL
    expect(() => criar?.(url)).toThrow('URL de worker não autorizada')
  })
})
