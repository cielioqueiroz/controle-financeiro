# i18n — modais + tutorial + toasts deferidos (fecha o i18n) — plano

> Fatia final do i18n. Mecanismo já pronto (useT, dicionários, locale/categoria).
> Aprovado em brainstorming 2026-07-24. Fecha todas as superfícies e os toasts.

**Constraints:** pt = fonte da verdade (valores idênticos aos literais atuais → testes de
componente seguem verdes); en/es a revisar; `t()` com default pt; testes que mudam estado
de módulo restauram no `afterEach`. Após cada task `npm test`; fim `build && lint && tsc`.
Commits diretos na main; co-author padrão.

---

### Task 1: Toasts deferidos → chaves + Intl.ListFormat

**Files:** `src/ui/auth-validacao.ts` (+ test), `src/lib/recuperar-senha.ts` (+ test),
`src/ui/Auth.tsx`, `src/ui/RecuperarSenha.tsx`, dicionários.

- `camposFaltando` continua puro. Remover `mensagemCamposFaltando`/`ROTULO`/`POSSESSIVO`/
  `ligar`. Nova helper pura `src/ui/mensagem-campos.ts`:
  ```ts
  // recebe os rótulos já traduzidos + locale, junta com Intl.ListFormat
  export function juntarCampos(rotulos: string[], locale: string): string {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(rotulos)
  }
  ```
  No `Auth`, compor: `faltando.length === 1 ? t('campo.pos.'+f) : juntarCampos(faltando.map(f=>t('campo.'+f)), localeAtual())`, e `t(modo==='criar'?'validacao.preenchaCriar':'validacao.preenchaEntrar', { campos })`.
- `validarNovaSenha` devolve **chave** (`'recuperar.erro.digite' | 'validacao.senhaCurta' | 'recuperar.erro.repita' | 'recuperar.erro.naoCoincidem'`) ou null; `RecuperarSenha` faz `t(chave)`.
- `lib/recuperar-senha.ts`: `ResultadoReset.erro` vira **chave** (`'recuperar.erro.rede' | 'recuperar.erro.token'`); `RecuperarSenha` faz `t(r.erro)`.
- Chaves: `campo.nome/email/senha`, `campo.pos.nome/email/senha`, `validacao.preenchaCriar/Entrar`, `recuperar.erro.digite/repita/naoCoincidem/rede/token`.
- Testes: `auth-validacao.test` (remover os de `mensagemCamposFaltando`; `validarNovaSenha` afirma chaves), `recuperar-senha.test` (afirma chaves), `juntarCampos` (pt→"a, b e c"; en→"a, b, and c"). Componentes seguem verdes em pt (pt reproduz o texto atual).

### Task 2: Confirmacao + EditarPerfil

- `Confirmacao`: rótulos padrão (Cancelar/Confirmar) → `t()` se houver default no componente; senão só o que é literal.
- `EditarPerfil`: títulos, labels, placeholders, ajuda, prévia "Olá, {saudacao}!", botões, toast "Perfil atualizado." → `t()`. Chaves `perfil.*`, reusar `header.ola`/`conta.*` onde couber.

### Task 3: EditarCompra

- Títulos, "Nome do estabelecimento", ajuda, "Categoria", grade (nome via `nomeCategoria`), "Nova", criar categoria (nome/emoji/cor, Cancelar/Criar), Cancelar/Salvar, toasts, e a `Confirmacao` de salvar. Chaves `editar.*`.

### Task 4: Documentos

- Título, cabeçalhos, contagens, botões (apagar documento/tudo), estados vazio, confirmações. Chaves `docs.*`. Ler o componente para extrair.

### Task 5: Tutorial

- Boas-vindas ("Olá, {nome}!", corpo — a frase "Bem-vindo(a) ao seu controle financeiro" é traduzida), os 5 passos (titulo+corpo), botões (Pular/Voltar/Próximo/Bora ver/Começar!), "{i}/{total}". Chaves `tutorial.*`. Os `PASSOS` viram chaves (não literais).

### Task 6: Verificação final + docs + push

- `npm test && npm run build && npm run lint && npx tsc -b --force`.
- README/ESTADO: i18n **completo** (todas as superfícies + toasts); atualizar contagem de testes.
- Um teste renderiza um modal (ex.: EditarPerfil ou Tutorial) em en.
- `git push`.

## Nota
en/es a revisar pelo usuário. Após esta fatia, o roadmap acionável acaba (só "mais bancos"
fica, bloqueada por amostra externa).
