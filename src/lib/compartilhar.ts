type NavShare = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
}

/** Compartilha o PDF (celular, via Web Share) ou baixa o arquivo (desktop,
 *  onde share de arquivo quase não existe). Cancelar a folha de compartilhar
 *  (AbortError) não é falha — resolve em silêncio. */
export async function baixarOuCompartilhar(
  blob: Blob,
  nomeArquivo: string,
  meta: { title: string; text: string },
): Promise<'compartilhado' | 'baixado'> {
  const file = new File([blob], nomeArquivo, { type: 'application/pdf' })
  const nav = navigator as NavShare

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: meta.title, text: meta.text })
    } catch (e) {
      // Usuário fechou a folha de compartilhar: não é falha.
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e
    }
    return 'compartilhado'
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'baixado'
}
