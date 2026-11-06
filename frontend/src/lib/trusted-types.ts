type PoliticaTrustedTypes = {
  createScriptURL(entrada: string): unknown
}

type FabricaTrustedTypes = {
  createPolicy(
    nome: string,
    regras: { createScriptURL(entrada: string): string },
  ): PoliticaTrustedTypes
}

type GlobalComTrustedTypes = typeof globalThis & {
  trustedTypes?: FabricaTrustedTypes
}

const fabrica = (globalThis as GlobalComTrustedTypes).trustedTypes

if (fabrica) {
  fabrica.createPolicy('default', {
    createScriptURL(entrada) {
      const url = new URL(entrada, location.href)
      const semCredenciais = !url.username && !url.password
      const workerPdf =
        url.origin === location.origin &&
        /^\/.*\/pdf\.worker\.min(?:-[A-Za-z0-9_-]+)?\.mjs$/.test(url.pathname)
      const blobProprio = url.protocol === 'blob:' && url.origin === location.origin

      if (!semCredenciais || (!workerPdf && !blobProprio)) {
        throw new TypeError('URL de worker não autorizada')
      }
      return entrada
    },
  })
}
