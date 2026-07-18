# Ajustes no formulário de acesso — design

> Data: 2026-07-18 · Branch: `feat/ingestao-documentos`
> Arquivo afetado: `src/ui/Auth.tsx`

## Problema

Dois defeitos na tela de login/cadastro, ambos reportados pelo usuário.

**1. O toast de validação acusa os campos errados.** Ao clicar em "Criar conta" com o
formulário vazio, aparece "Preencha o e-mail e a senha para continuar." — sem mencionar o
campo *nome*, que é o primeiro da tela. A mensagem parece desconexa do que o usuário fez.

A causa é a ordem das checagens em `Auth.tsx:27-43`: a validação de e-mail/senha (linha 28)
roda **antes** da checagem de nome (linha 36), então retorna cedo e o nome nunca é avaliado.

**2. Não há como revelar a senha.** O campo é `type="password"` fixo (linha 152). Sem o
"olho", quem erra a digitação de uma senha de 8+ caracteres não tem como conferir.

## Solução

### A. Validação que nomeia exatamente o que falta

Substituir a cascata de `if`s por uma coleta dos campos vazios, emitindo **um único toast**.

Extrair uma função pura, testável fora do React:

```ts
type Modo = 'entrar' | 'criar'
type Campos = { nome: string; email: string; senha: string }

/** Campos vazios, na ordem em que aparecem na tela. */
function camposFaltando(modo: Modo, campos: Campos): Array<'nome' | 'email' | 'senha'>
```

Regras:

- A ordem do retorno segue a ordem visual: `nome` → `email` → `senha`.
- `nome` só entra na lista quando `modo === 'criar'` (o campo nem existe no modo entrar).
- `apelido` é opcional e nunca entra.
- Comparação por `.trim()` para nome e e-mail; senha usa o valor cru (espaço é caractere
  válido em senha).

A mensagem é montada a partir da lista, com o verbo conforme o modo:

| Modo | Faltando | Toast |
|---|---|---|
| criar | nome, email, senha | "Preencha nome, e-mail e senha para criar sua conta." |
| criar | nome | "Preencha seu nome para criar a conta." |
| criar | email, senha | "Preencha e-mail e senha para criar sua conta." |
| entrar | email, senha | "Preencha o e-mail e a senha para entrar." |
| entrar | senha | "Preencha sua senha para entrar." |

Ligação da lista em português: dois itens unidos por "e"; três por vírgula + "e"
("nome, e-mail e senha").

**Ordem das validações** (importa para não haver mensagens competindo):

1. Campos vazios → toast único acima, e **retorna**.
2. Formato de e-mail inválido → "Esse e-mail não parece válido."
3. Senha com menos de 8 caracteres → "A senha precisa ter ao menos 8 caracteres."

Como (1) retorna cedo, as validações de formato só rodam com todos os campos preenchidos —
nunca disputam com o aviso de campo vazio. Isso elimina o caso reportado.

**Foco.** Após o toast de campos vazios, o foco vai para o primeiro campo da lista, via
`ref` em cada input. É o que converte o aviso em ação.

### B. Botão de revelar senha

No campo de senha (`Auth.tsx:151-159`):

- Envolver em `<div className="relative">`.
- `type={verSenha ? 'text' : 'password'}`, com estado `const [verSenha, setVerSenha] = useState(false)`.
- Adicionar `pr-10` ao input para o texto não passar por baixo do botão.
- Botão `absolute right-2 top-1/2 -translate-y-1/2`, **`type="button"`** — sem isso ele
  submete o formulário.
- `aria-label` alternando entre "Mostrar senha" e "Ocultar senha"; `aria-pressed={verSenha}`.
- Ícone SVG inline (olho / olho cortado), seguindo o padrão de `GoogleIcon` no mesmo arquivo.
- Cor `text-tinta-tenue` com `hover:text-tinta`, consistente com os controles secundários
  da tela.

Aplica-se **apenas** ao campo de senha da aplicação. O ícone visível à direita do campo em
alguns navegadores é do gerenciador de senhas nativo e não está sob nosso controle; os dois
vão conviver, o que é comportamento normal.

## Fora de escopo

Não serão alterados: o estilo do cartão, as animações `motion`, o fluxo do Google
(`comGoogle`), a função `traduzErro`, nem qualquer texto fora das mensagens de validação.

## Testes

- **`camposFaltando`** — testes unitários puros, sem render: cobrir os dois modos, cada
  combinação de campos vazios, e que `apelido` jamais aparece.
- **Montagem da mensagem** — verificar a ligação em português para 1, 2 e 3 itens.
- **Ordem das validações** — com todos os campos vazios no modo `criar`, o toast é o de
  campos faltando (não o de e-mail inválido).
- **Olho da senha** — teste de interação se o setup atual permitir; caso contrário,
  verificação manual no navegador.

A suíte atual tem 183 testes verdes; nenhum deles toca `Auth.tsx`, então não há regressão
esperada. Critério de aceite: `npm test`, `npm run build` e `npm run lint` verdes, e os dois
comportamentos conferidos com o app rodando.
