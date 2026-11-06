# ADR-0024 — Trusted Types sem política de HTML ou código

Data: 2026-11-06. Status: implementado; publicação depende do merge do PR.

## Contexto

A CSP já bloqueava script inline sem hash, `eval` e origem externa, mas strings
ainda podiam chegar a sinks de DOM XSS como `innerHTML`. A diretiva
`require-trusted-types-for 'script'` fecha essa classe de injeção nos navegadores
compatíveis.

O app não usa `dangerouslySetInnerHTML` nem escreve HTML em produção. O pdf.js,
porém, entrega o endereço do worker como `string` e rejeita um
`TrustedScriptURL` no setter de `GlobalWorkerOptions.workerSrc`. Sem uma política
`default`, o navegador barra o worker antes que o pdf.js consiga abrir o PDF.

## Decisão

- A CSP exige `require-trusted-types-for 'script'` e só permite a política
  `trusted-types default`.
- A política `default` implementa **somente** `createScriptURL`. Não existem
  `createHTML` nem `createScript`: HTML cru, `eval`, texto de script e handlers
  inline continuam recusados.
- `createScriptURL` aceita apenas o `pdf.worker.min-<hash>.mjs` da própria origem
  e URLs `blob:` da própria origem. O blob é o invólucro que instala os
  polyfills de `Promise` em navegadores antigos antes de carregar o worker real.
- Outro script da própria origem, worker externo, blob externo, credenciais na
  URL e qualquer política adicional são recusados.
- O módulo da política é o primeiro import de `main.tsx`, antes das dependências
  que podem tocar um sink.

## Verificação

- Testes unitários cobrem a lista permitida e as recusas.
- `medir-csp.py` exige as duas diretivas e tenta HTML cru, política adicional,
  script externo, inline e `eval`.
- `medir-pdf.py` serve o build com a CSP real do `vercel.json` e abre um PDF nos
  quatro pisos de navegador, inclusive os dois caminhos de polyfill no worker.

## Consequências

Uma nova biblioteca que escreva HTML ou carregue código dinamicamente falhará
alto sob a CSP. A saída não é ampliar `default`: deve-se remover o sink ou criar
uma política nomeada, mínima e medida, com nova decisão explícita.
