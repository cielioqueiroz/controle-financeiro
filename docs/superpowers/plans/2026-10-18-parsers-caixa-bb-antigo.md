# Parsers da Caixa GovConta e BB layout A

> Execução autorizada no chat após inventário de amostras locais com camada de texto.

**Goal:** ler extratos Caixa GovConta e BB layout A confirmado sem misturar
compilações bancárias. **Architecture:** parsers tipados no `ParseResult`, detector
por assinatura, fixture reduzido e migration CHECK. **Tech Stack:** PDF.js, TS,
Postgres. **Spec:** `docs/superpowers/specs/2026-10-18-pendencias-design.md`.

## Revisão

`CAIXA` ou `SALDO` isolados não identificam extrato. O PDF `bb-belem` reúne páginas
de emissores diferentes e nunca entra como um documento inteiro. Revisar gabarito,
duplicatas, continuação, páginas sem movimentos, período ausente e assinatura
desconhecida. Fixtures respeitam a auditoria de anonimização existente.

### Task 1: Caixa GovConta

Arquivos: novo `domain/parsers/caixa-extrato.ts` e teste; detector/dispatcher,
`domain/banks.ts`, migration `0011-caixa.sql`, `frontend/tests/fixtures/`
por `npm run fixtures -- --bancos .amostras-bancos` e `ui/CarrosselBancos.tsx`.

- [x] Identificar apenas as páginas GovConta confirmadas, com cabeçalho, conta,
  período, transação e progressão de saldo coerentes.
- [x] Fazer fixture anonimizado, parser, conferência inicial/final e testes.
- [x] Excluir o banco do carrossel até assinatura e parser ativos.
- [x] Ampliar CHECK em migração e integrar Catálogo, tema, detector e despacho.
- [x] Exibir Caixa no carrossel somente depois da integração completa.

### Task 2: BB layout A

Arquivos: fixture anonimizado e `domain/parsers/bb-extrato.ts`/teste, detector
e atualização de assinatura do BB. Não exige migração: `bb` já é aceito.

- [x] Confirmar a diferença de layout pelas marcas lidas do cabeçalho do PDF;
  manter layout 2023 ativo e não admitir página mista/assinatura ambígua.
- [x] Extrair as páginas A isoladas de uma cópia de referência para fixture mínimo.
- [x] Testar linhas, saldo inicial/final, continuidade e gabarito.
- [x] Avaliar se precisa de atualização de detector, catálogo ou carrossel; não
  criar migration se `bb` já é aceito.

### Task 3: validação

- [x] Atualizar glossário/instruções só após suportes demonstrados.
- [x] Registrar a origem do fixture sem identificadores pessoais e medir
  contraste/layout se as mudanças visuais tornarem isso necessário.

### Resultado local

- **170 testes aprovados em 13 arquivos**: todos os parsers, detector e
  carrossel. Inclui os nove parsers anteriores, BB A, Caixa atual/antiga,
  continuação da mesma conta/período, recusa de compilações, transação ausente,
  ausência de gabarito e valor sem direção.
- `npm run fixtures -- --bancos .amostras-bancos`: aprovado; três JSONs,
  auditoria de identificadores, valores, quantidade, natureza e conferência.
  A extração usa o pdf.js do projeto com fontes padrão locais.
- Lint focado com `--deny-warnings` e `git diff --check`: aprovados.
- Contraste nos dois temas aprovado; tinta/acento da Caixa medidos em 6,11:1.
- Nenhuma migração aplicada à produção. Na integração, CONTEXT/AGENTS,
  typecheck, lint, caminhos, build, suíte completa e contraste passaram. A revisão final também
  corrigiu valor Caixa sem direção, página BB A sem estrutura de continuação,
  mistura com outro emissor e datas impossíveis no movimento/período. O CHECK
  de 0011 foi aplicado e validado numa branch Neon temporária, depois descartada
  sem aplicar mudanças à branch pai. Em 20/10, verificação completa, CSP,
  overflow e axe passaram. O ensaio conjunto de 0009–0011 na branch Neon
  codex-integridade-20261016 comprovou os três fixtures novos pelo parser,
  adaptador e Data API reais: banco, contagem, centavos e conferência preservados.
  [Prova real e limites](../../validacoes/2026-10-20-vinculos-regras-neon.md).

Evidência e limites: [recursos externos](../../validacoes/2026-10-18-recursos-externos.md).
