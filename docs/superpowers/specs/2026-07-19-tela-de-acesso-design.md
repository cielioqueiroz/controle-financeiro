# Tela de acesso: layout em duas colunas, frases, logo e fim do login automático — design

> Data: 2026-07-19 · Branch: `main`
> Arquivos afetados: `src/App.tsx`, `src/ui/Auth.tsx`, `src/ui/RecuperarSenha.tsx`,
> novo `src/ui/TelaAcesso.tsx`, novo `src/ui/MoedaLogo.tsx`

## Problema

Quatro queixas, todas do usuário, todas na mesma tela.

**1. A página de login é alta demais e exige rolagem.** Num viewport de 1280×800 a página
mede 1044px. O medidor de overflow não pegou porque ele só reprova rolagem **lateral** —
rolagem vertical é legítima em telas de conteúdo, e a de acesso não é uma delas.

A causa é estrutural: o `<header>` de `App.tsx:132` (marca + headline) é compartilhado
entre o estado logado e o deslogado, e o `<Auth>` (`max-w-sm`, centralizado) cai **abaixo**
dele. Duas telas com necessidades opostas herdando o mesmo cabeçalho.

**2. As laterais ficam vazias.** Consequência do mesmo empilhamento: em telas largas sobra
espaço horizontal enquanto falta vertical.

**3. A frase "Veja para onde o dinheiro foi" não tem graça.**

**4. O logo da moeda não tem graça.** E, investigando, está desatualizado: os contornos
usam `stroke="#065f37"` **fixo em código** (`Auth.tsx:277-278`), verde escuro remanescente
da paleta neon anterior ao rename. A moeda é preenchida com `var(--color-marca)` (âmbar) e
contornada de verde, e é a única peça da tela que não responde ao tema.

**5. Descoberto durante o brainstorming, não é bug.** O usuário redefiniu a senha e foi
levado ao dashboard em vez de voltar ao login. O código fez o que a spec anterior mandava
(`RecuperarSenha.tsx:99-106`: com e-mail guardado, faz login automático), e o roteiro do
item 0 diz "deve entrar direto". Mesmo assim é defeito: **num fluxo de autenticação,
surpreender o usuário é o defeito**, mesmo com o código correto. Entrar direto também tira
a única confirmação de que a senha nova funciona.

## Solução

### A. `TelaAcesso.tsx` — a tela de acesso deixa de ser um card sob o header

Novo componente, dono da tela inteira enquanto `precisaLogin` for verdadeiro. Ele passa a
carregar o que hoje está espalhado: a marca (topo-esquerdo), o `ThemeToggle`
(topo-direito), a frase e o `<Auth>`.

Contrato:

```
TelaAcesso(props: { children: ReactNode }) → a coluna direita recebe o <Auth>
```

Layout:

| Faixa | Comportamento |
|---|---|
| `lg` e acima | `grid-cols-2`, `items-center`, altura mínima de uma tela; frase à esquerda, card à direita |
| abaixo de `lg` | empilhado: marca, frase (menor), card |

A altura mínima usa **`dvh`, não `vh`**. Em navegador de celular a barra de endereço
retrátil faz `100vh` ser maior que a área visível, o que reintroduziria exatamente a
rolagem que este trabalho remove.

No modo "Criar conta" a página **pode** crescer e rolar — decisão do usuário. Os dois
campos extras (nome, apelido) tornam o card alto demais para 800px de viewport, e as
alternativas (rolagem interna do card, cadastro em dois passos) foram recusadas.

O `App.tsx` fica com o branch de `precisaLogin` renderizando `TelaAcesso`, e o header atual
serve só ao estado logado — que é o único para o qual ele foi desenhado.

### B. Frases

| Estado | Linha 1 (`tinta`) | Linha 2 (`tinta-fraca`) |
|---|---|---|
| Deslogado | Seu extrato vira gráfico, | em menos de um minuto. |
| Logado | Olá, {nome}! 👋 | Importe a fatura, o resto a gente calcula. |

A quebra em duas linhas com pesos diferentes é o padrão que a tela já usa; só o texto muda.

As duas frases moram em lugares diferentes, e isso é intencional: a **deslogada** vai para
o `TelaAcesso`, a **logada** fica no `<header>` do `App.tsx`, onde já está. O
`AnimatePresence` com `key={logado}` que anima a troca deixa de fazer sentido no header
(que passa a ter um estado só) e some de lá; a entrada da frase deslogada é animada dentro
do `TelaAcesso`.

### C. `MoedaLogo.tsx` — moeda que vira donut

Extraído de dentro do `Auth.tsx` para arquivo próprio, porque deixa de ser um SVG de 15
linhas e passa a ter estados de animação.

Três camadas de movimento:

1. **Entrada** — o giro com mola que já existe, preservado.
2. **Repouso** — a cada ~5s, um reflexo diagonal varre a face da moeda.
3. **Assinatura** — periodicamente o anel externo se abre em 4 arcos (as fatias do donut de
   categorias do dashboard), giram e voltam a fechar.

Cores: os 4 arcos usam **tons de âmbar**, nunca `--color-confere` nem `--color-ressalva`.
Essas duas carregam semântica declarada nas decisões de design do projeto ("o total bate" /
"atenção"); gastá-las como enfeite no logo enfraqueceria as duas. O `#065f37` fixo sai e dá
lugar a variáveis por tema, como o resto da tela.

Sob `prefers-reduced-motion`, a moeda fica estática. O projeto já respeita essa preferência
no fundo animado, e a regra registrada é que quem desliga o loop precisa de repintura
manual — aqui isso não se aplica porque o SVG não é canvas, mas a preferência vale igual.

### D. Fim do login automático depois do reset

`RecuperarSenha.salvarSenha` deixa de chamar `neon.auth.signIn.email`. Depois de
`redefinirSenha` retornar ok, o fluxo é sempre o mesmo, sem ramificar por e-mail guardado:

1. Tira o token da URL (comportamento atual, mantido).
2. Toast "Senha alterada. Entre com a senha nova."
3. `onVoltar(emailGuardado)` — card de entrar, com o e-mail já preenchido.

Some com isso o `try/catch` que existia só para o auto-login.

**A prop `onAutenticado` do `RecuperarSenha` é removida**, não apenas deixada sem uso: o
auto-login era seu único chamador. Com ela vai embora o callback correspondente no
`Auth.tsx` (`RecuperarSenha.tsx:17`, `Auth.tsx:147-156`), incluindo o `setModo('entrar')`
defensivo que existia para o caso de o `checarSessao` não achar a sessão a tempo — uma
corrida que deixa de ser possível quando ninguém mais loga por aqui. O `onVoltar` passa a
ser a única saída do fluxo, o que é o ponto: um caminho de saída em vez de dois.

**O `cf:email-reset` continua existindo, rebaixado a preenchimento de campo.** Esta é a
parte que mais importa. Hoje ele é *entrada de uma chamada de autenticação sem
verificação*, e foi essa propriedade que produziu o bug F4 (duas contas da casa com a mesma
senha → o auto-login entrava na conta errada, e como a saudação usa o apelido local, nem o
cabeçalho denunciava). Contido hoje por um carimbo de tempo de 1h.

Usado apenas para preencher um campo de texto, o pior caso vira "sugeriu o e-mail errado,
visível e editável pelo usuário". A classe de vulnerabilidade deixa de precisar de
contenção porque deixa de existir.

O carimbo de 1h pode ficar — não custa nada e limita sugestão obsoleta.

## Testes

A mudança D inverte uma expectativa existente. Registrar isso é metade do trabalho:

- **`App.test.tsx`, teste 1** hoje afirma que o `DASHBOARD_STUB` aparece após o reset com
  e-mail guardado. Passa a afirmar o **oposto**: card de entrar, sem dashboard. A inversão
  é o registro da decisão.
- **`RecuperarSenha`**: saem os testes do caminho de `signIn.email` (sucesso, `error`
  retornado e exceção lançada). Entra um teste de que **nenhuma chamada de autenticação
  acontece** após o reset — asserção negativa explícita, não a ausência de uma positiva.
- **`TelaAcesso`**: as duas frases, por estado.
- **Prefill**: o e-mail guardado chega ao campo de entrar sem passar por chamada de auth.

Nota de armadilha que vale para os testes novos: **asserção positiva não guarda promessa
negativa**. O teste "não afirma que o e-mail existe" da rodada anterior conviveu com o bug
porque só conferia a presença de uma frase condicional. Onde o requisito é "não faz X",
o teste precisa dizer "não faz X".

## Fora de escopo

- Rolagem interna do card e cadastro em dois passos (recusados explicitamente).
- Os itens 1-5 da fila do `ESTADO-ATUAL.md` (nome no e-mail, PDF real, i18n, saldo, as
  verificações contra o banco).
- A duplicação de `CampoSenha` entre `Auth.tsx` e `RecuperarSenha.tsx`, já mapeada como
  melhoria futura. Este trabalho não a piora nem a resolve.

## Verificação

Automatizável:

- `npm test`, `npm run build`, `npm run lint`.
- `python scripts/medir-overflow.py` — sem rolagem lateral. **Não basta**: ele não vê
  rolagem vertical, que é o defeito principal aqui. A altura da página em 1280×800 precisa
  ser conferida à mão contra o viewport.

Só no navegador, com olhos humanos:

- O logo animado. Em jsdom nada disso é observável, e headless roda em DPR 1 — o mesmo
  ponto cego que já escondeu o bug do canvas neste projeto.
- O layout em duas colunas em tela larga e empilhado no celular.
- **Reverificar o item 0 do `ESTADO-ATUAL.md`**: os passos 3-6 foram exercitados pelo
  usuário em 2026-07-19 e funcionaram, mas o passo 7 (F1) e o comportamento pós-reset
  mudam com a alteração D. A verificação anterior fica vencida.
