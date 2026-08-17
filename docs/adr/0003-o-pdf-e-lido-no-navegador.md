# O PDF é lido no navegador e nunca sobe

O documento importado é o dado mais sensível que este app toca: traz CPF, agência,
conta, nomes de terceiros e o consumo inteiro de uma pessoa. A extração acontece no
cliente, com `pdfjs-dist` num worker, e **o arquivo não é enviado a servidor
nenhum** — só as transações já extraídas vão para o banco.

## Considered Options

- **Extrair no servidor** (Edge/Vercel Function). Mais robusto: nada depende do
  navegador do usuário, e daria para tratar PDF escaneado com OCR. Recusada pela
  LGPD e pela promessa que a tela faz — subir o arquivo cria uma cópia do documento
  fora do controle do usuário, com retenção, log e backup para justificar.

## Consequences

- **A superfície de ataque é o parser, e ele roda com os privilégios da página.**
  Foi por isso que `pdfjs-dist` 5.7.284 → 6.2.108 (GHSA-hq66-cqwq-w95j, execução de
  JavaScript ao abrir PDF malicioso) foi tratada como falha alta e corrigida na
  hora.
- **PDF escaneado não tem como funcionar** sem OCR no cliente. O app detecta e
  avisa, em vez de produzir lixo silencioso. É por isso que o extrato da Caixa,
  que chegou como imagem, segue sem suporte.
- Nenhum teste da suíte exercita o pdf.js de verdade (os fixtures são JSON já
  extraído, e `domain/pdf/load.ts` é mockado em jsdom, que não tem `DOMMatrix`).
  Upgrade do pdf.js precisa ser provado à parte.
