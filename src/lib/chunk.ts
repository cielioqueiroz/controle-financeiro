/** Detecta falha ao baixar um chunk de import dinâmico.
 *
 *  Por que existe: cada build da Vercel gera nomes com hash novo
 *  (`jspdf.es.min-<hash>.js`). Quem estava com a aba aberta ANTES do deploy
 *  continua rodando o JS antigo, que pede um arquivo que não existe mais —
 *  e o import dinâmico rejeita. Sem tratar, isso vira um erro genérico
 *  ("não consegui gerar o PDF") que culpa a funcionalidade quando o
 *  problema é a aba estar velha. A saída certa é recarregar a página.
 *
 *  A mensagem varia por navegador, então casamos por trecho:
 *  - Chrome/Edge: "Failed to fetch dynamically imported module"
 *  - Firefox: "error loading dynamically imported module"
 *  - Safari: "Importing a module script failed" */
export function ehFalhaDeChunk(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro ?? '')
  return /dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)
}
