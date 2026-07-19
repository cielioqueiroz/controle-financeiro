# Acabamento, confirmações em modal, favicon e card de compartilhamento — design

> Data: 2026-07-19 · Branch: `main`
> Arquivos afetados: novo `src/ui/Confirmacao.tsx`, `src/ui/ContaMenu.tsx`,
> `src/ui/Documentos.tsx`, `src/ui/EditarCompra.tsx`, `src/ui/Dropzone.tsx`,
> `src/ui/Dashboard.tsx`, `src/ui/ResultadoImport.tsx`, `src/ui/Auth.tsx`,
> `src/index.css`, `public/img/favicon.svg`, `scripts/og-card.html`

## Problema

Quatro queixas do usuário, sendo que **três dizem que já foram pedidas antes e não
resolvidas**. Isso é dado sobre o processo, não só sobre o código: pedidos de acabamento
vinham sendo tratados como acessórios e caíam no fim da fila até sumirem.

**1. Não existe confirmação em modal.** Ações destrutivas confirmam de improviso, cada uma
de um jeito: sair da conta abre um bloco dentro do próprio menu (`ContaMenu.tsx:80-89`),
apagar documento vira dois botões minúsculos dentro da linha da lista
(`Documentos.tsx:148-163`). Nenhuma das duas tem foco preso, tecla `Esc`, ou devolve o foco
a quem abriu. `apagar tudo` — a ação irreversível que zera o histórico — não tem peso visual
diferente de apagar um documento só.

**2. O app está chapado.** Auditoria feita nesta sessão, contando o código:

- **Não existe sistema de raio.** Seis valores sem regra: `rounded-full` (23 usos),
  `rounded-lg` (19), `rounded-sm` (14), `rounded-md` (11), `rounded-xl` (5), `rounded-2xl`
  (3). E `--radius-suave` está definido em `index.css:56` e **nunca é usado** — token morto.
- **Sombra existe em 3 arquivos e falta em 3.** Têm: `Auth`, `Documentos`, `EditarCompra`.
  Não têm nenhuma: `Dashboard`, `Dropzone`, `ResultadoImport`.
- **O gesto de "levantar" no hover só existe no `Auth`.** No resto do app o hover troca cor
  de fundo, borda ou texto — nada se move, nada ganha profundidade.

O caso mais grave é o **Dropzone**: é a superfície principal do produto, onde a pessoa solta
o PDF, e é a mais chapada de todas (`rounded-sm`, uma transição, zero sombra).

**3. O favicon é ilegível no tamanho real.** A 16px na aba, o anel interno e o `R$` viram
borrão. O arquivo tem três círculos concêntricos e um texto — detalhe demais para o tamanho
em que ele de fato aparece.

**4. O card de compartilhamento não mostra o produto.** Ele estampa nome e frase sobre um
fundo com brilhos, e nada mais. Quem vê o link no WhatsApp não faz ideia do que o app
entrega.

## Solução

### A. `Confirmacao.tsx` — um diálogo para as quatro ações

Componente único, para as quatro confirmações pararem de ser invenções separadas.

```
Confirmacao({
  aberto: boolean
  titulo: string
  descricao?: ReactNode
  rotuloConfirmar: string        // "Sair", "Apagar", "Apagar tudo", "Salvar"
  severidade: 'perigo' | 'normal'
  ocupado?: boolean              // trava o botão durante a chamada
  onConfirmar: () => void
  onCancelar: () => void
})
```

Requisitos de diálogo, todos ausentes hoje:

- `role="dialog"` com `aria-modal`, e o título ligado por `aria-labelledby`.
- **Foco inicial no Cancelar quando `severidade === 'perigo'`.** Quem aperta Enter por
  reflexo não pode apagar nada.
- `Esc` e clique no fundo cancelam. O foco volta ao elemento que abriu o diálogo.
- Foco preso enquanto aberto (Tab não escapa para trás do overlay).
- Enquanto `ocupado`, o botão de confirmar trava e o diálogo não fecha por `Esc` — a ação já
  está em curso e fechar mentiria sobre isso.

**Modal pergunta antes, toast conta depois.** Os toasts de sucesso e erro continuam
exatamente onde estão; o modal só entra na decisão. Vale declarar porque hoje a fronteira
está embaralhada.

Aplicação:

| Ação | Severidade | Detalhe |
|---|---|---|
| Sair da conta | perigo | substitui o bloco dentro do menu |
| Apagar documento | perigo | o diálogo **nomeia qual** documento |
| Apagar tudo | perigo | mostra **quantos** documentos e lançamentos serão perdidos |
| Salvar edição de compra | normal | — |

O "apagar tudo" recebe o número concreto porque é irreversível, e o número é o que faz a
pessoa parar para ler.

**Ressalva registrada:** confirmar toda gravação de edição é a única das quatro que adiciona
atrito a uma ação **reversível e frequente**. O usuário escolheu incluir depois de a
objeção ser apresentada. Fica registrado que remover é trivial se incomodar no uso.

### B. Sistema de acabamento

Três escalas, aplicadas em vez de decididas caso a caso.

**Raio.** A escala vive nas utilidades do Tailwind, não numa variável CSS própria — é assim
que o resto do projeto já expressa raio, e criar um token paralelo daria dois vocabulários
para a mesma coisa. Portanto **`--radius-suave` é removido de `index.css`**: está morto hoje
e continuaria morto depois.

A escala:

| Degrau | Uso |
|---|---|
| `md` | chips, badges, botõezinhos de linha |
| `xl` | campos, botões, controles |
| `2xl` | cards e painéis |
| `full` | só pílulas e avatares |

O `rounded-sm` sai de circulação — é o canto quase reto que faz o app parecer sem
acabamento.

**Elevação.** Duas paradas, não uma escala longa: uma sombra de repouso e uma de hover, com
a borda esquentando junto. O `Auth` já pratica esse par (`shadow-lg` → `shadow-xl` nos
botões); a rodada o estende às superfícies que hoje não têm sombra nenhuma, em vez de
inventar valores novos.

**Gesto de hover.** `-translate-y-0.5` somado à sombra maior. Isso já existe no `Auth` — a
mudança é promovê-lo de exceção a padrão.

Onde aplica:

| Superfície | Ganha |
|---|---|
| **Dropzone** | raio de card, sombra em repouso, borda que esquenta e leve subida quando um arquivo é arrastado por cima |
| **Tiles do Dashboard** | sombra em repouso + subida no hover |
| **Linhas de Documentos** | elevação sutil no hover, em vez de só trocar o fundo |
| **Cards do ResultadoImport** | raio e sombra do sistema |
| **Card de login** | ver abaixo |

### C. O card de login ganha hover — sem subir

O card recebe **sombra que floresce e borda que esquenta** no hover, e **não** recebe
`-translate-y`.

O motivo é semântico: um card que sobe ao passar o mouse promete que é clicável, e este não
é — os cliques estão nos campos e botões dentro dele. Levantar o container inteiro ensinaria
a coisa errada. Os elementos internos continuam subindo, porque esses são de fato clicáveis.

Se na prática o usuário preferir o card subindo junto, é uma classe de diferença.

### D. Favicon — moeda simplificada

Sai o anel interno; o `R$` cresce e engorda. Continua a mesma moeda, legível a 16px.

**O `MoedaLogo` do app não muda.** A divergência entre os dois é proposital e vale declarar:
o favicon é um sinal de 16px, o logo é uma peça de 44px animada. Otimizar os dois pela mesma
régua estraga um dos dois.

O arquivo é estático, fora do React, então não pode usar variável CSS de tema — usa o
literal do tema escuro, como já faz hoje.

### E. Card de compartilhamento — mostrar o produto

Redesenho em `scripts/og-card.html`: um **donut de categorias** grande, em tons de âmbar,
com a frase ao lado.

A direção foi escolhida entre três porque é a única que faz alguém entender o produto sem
abrir o link — o card passa a dizer o que o app entrega, não só como ele se chama. Ecoa
também a animação do logo, que abre em fatias de donut.

O `public/og.png` precisa ser **regerado** por `scripts/gerar-og.py` — editar o HTML não
muda a imagem servida.

## Testes

O que é testável em jsdom, e portanto obrigatório:

- **`Confirmacao`**: abre e fecha; `Esc` cancela; clique no fundo cancela; `onConfirmar` só
  dispara pelo botão de confirmar; **o foco inicial cai no Cancelar quando a severidade é
  perigo**; com `ocupado`, o botão trava e `Esc` não fecha.
- **Integração nas quatro ações**: a ação destrutiva **não acontece** sem a confirmação.
  Asserção negativa explícita — o requisito é "não apaga sem perguntar", e neste projeto já
  houve teste que conviveu com o bug por só conferir a presença de algo positivo.
- **`apagar tudo`** mostra a contagem real no diálogo.

O que **não** é testável e vai para verificação humana: sombras, raios, gestos de hover, o
favicon a 16px e o card OG renderizado. jsdom não faz layout nem pinta. Nenhum teste deve
fingir cobrir isso.

## Fora de escopo

- A duplicação de `CampoSenha` entre `Auth.tsx` e `RecuperarSenha.tsx` (dívida conhecida,
  adiada de propósito).
- Os itens 1-5 da fila do `ESTADO-ATUAL.md`.
- Substituir os toasts existentes: eles continuam sendo o retorno **depois** da ação.

## Verificação

Automatizável:

- `npm test`, `npm run build`, `npm run lint`.
- `python scripts/medir-overflow.py`. **Obrigatório nesta rodada**: o overlay do modal é
  decoração em `position: fixed`, e a regra registrada do projeto é que decoração nunca pode
  entrar no layout de rolagem — um brilho mal ancorado já criou barra lateral pulsante aqui.
- A altura da tela de acesso continua **≤ 800px em 1280×800**. A rodada anterior terminou
  nesse teto exato, sem folga; qualquer mudança de raio ou padding no card pode estourá-lo.

Só com olho humano:

- Os gestos de hover em cada superfície da tabela da seção B.
- O card de login: se a sombra florescendo lê como "vivo" sem parecer clicável.
- O favicon **na aba do navegador**, não ampliado — é o único tamanho que importa.
- O card OG renderizado, e o preview real do link (WhatsApp ou Telegram).
- Os quatro diálogos, com teclado: `Tab` não escapa, `Esc` cancela, Enter no foco inicial
  não destrói nada.
