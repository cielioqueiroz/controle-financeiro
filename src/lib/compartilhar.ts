/** Web Share nível 2. NÃO estende Navigator de propósito: o lib.dom declara
 *  `share` como sempre presente, e a interseção apagaria a checagem em tempo
 *  de execução que este arquivo inteiro depende (navegadores sem suporte). */
type NavShare = {
  canShare?: (data: { files?: File[] }) => boolean
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
}

/** Baixa o arquivo pelo caminho clássico da âncora. Funciona em qualquer
 *  navegador e não depende de user activation. */
export function baixarArquivo(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** O aparelho compartilha arquivos? True no celular E também no Chrome/Edge
 *  do Windows (a folha de compartilhar do sistema) — por isso baixar e
 *  compartilhar são AÇÕES SEPARADAS, nunca uma decisão automática. */
export function podeCompartilharArquivo(): boolean {
  const nav = navigator as unknown as NavShare
  const arquivoTeste = new File(['x'], 'x.pdf', { type: 'application/pdf' })
  return Boolean(nav.share && nav.canShare?.({ files: [arquivoTeste] }))
}

/** Abre a folha de compartilhar com o arquivo. 'cancelado' quando o usuário
 *  fecha a folha (não é falha). Qualquer outra rejeição — inclusive
 *  NotAllowedError por user activation expirada, que acontece porque a
 *  geração do PDF consome tempo entre o clique e o share — PROPAGA, para o
 *  chamador decidir o fallback (ex.: baixar). */
export async function compartilharArquivo(
  blob: Blob,
  nomeArquivo: string,
  meta: { title: string; text: string },
): Promise<'compartilhado' | 'cancelado'> {
  const nav = navigator as unknown as NavShare
  const file = new File([blob], nomeArquivo, { type: 'application/pdf' })
  if (!nav.share || !nav.canShare?.({ files: [file] })) {
    throw new Error('Compartilhar arquivo não é suportado neste navegador.')
  }
  try {
    await nav.share({ files: [file], title: meta.title, text: meta.text })
    return 'compartilhado'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
    throw e
  }
}
