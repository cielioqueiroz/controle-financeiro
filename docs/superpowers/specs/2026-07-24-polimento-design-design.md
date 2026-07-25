# Polimento de design — passada de refinamento — design

> Spec da rodada. Data: **2026-07-24**. Aprovado em brainstorming.
> Refinamento fino, dentro das decisões de design travadas (ver `ESTADO-ATUAL.md`,
> seção "Decisões de design já tomadas"). **Não reabre** cor/identidade âmbar+confere,
> partículas, nem troca de layout/biblioteca.

## Objetivo

Deixar o **Dashboard** (superfície diária) e os **componentes compartilhados** mais
coesos e caprichados — espaçamento, hierarquia, estados e acessibilidade — sem mexer na
identidade. O login/acesso passou por polimento recente e fica de fora, salvo achado
pontual.

## Restrições (travadas — não tocar)
- Cores: âmbar da marca, verde do "confere", tons por tema, `--color-falha`.
- Fundo de partículas; `prefers-reduced-motion` desliga animações.
- Sem shadcn/nova biblioteca; Tailwind v4 puro.
- **Foco:** a regra base vive em `index.css`. Utilitário do Tailwind (`focus:ring-*`,
  `focus:shadow-*`) **vence** a regra base e a apaga. Regra: estilizar foco **tudo por
  utilitário OU tudo pela base**, nunca misturar (armadilha registrada).

## Refinamentos (cada um isolado e reversível)

### R1 — Estado de erro coeso
Hoje o erro do dashboard é um texto vermelho solto:
`<p className="px-8 py-16 text-center text-sm text-falha">{erro}</p>` ([Dashboard.tsx:368]).
Virar um bloco no capricho do estado `Vazio`: ícone discreto + a mensagem + botão
**"Tentar de novo"** que chama `carregar`. Componente `ErroCarregar({ mensagem, onTentar })`.

### R2 — Escala tipográfica de apoio
Os *eyebrows/captions* (uppercase, tracking largo) aparecem como `text-[10px]` **e**
`text-[11px]` para a mesma função, sem critério. Padronizar em **dois papéis**:
- **eyebrow** (rótulo de seção/tile): `text-[11px] uppercase tracking-widest`.
- **micro** (contadores tabulares minúsculos, ex.: "i/total"): `text-[10px]`.
Aplicar no Dashboard e nos cards/menus compartilhados (não varrer o app inteiro).

### R3 — Alvos de toque no mobile
Botões redondos de 32px (`h-8 w-8`): navegação de período (`‹ ›`) e afins. Subir para
**`h-9 w-9`** (36px) — mais confortável no toque, diferença visual mínima no desktop.
Conferir o avatar do `ContaMenu` (hoje `h-9 w-9`, já OK) e o botão de fechar dos modais.

### R4 — Foco visível uniforme
Garantir que **todo** interativo tenha foco visível claro. Seguindo a armadilha: conferir
a regra base de `:focus-visible` no `index.css` e **não** introduzir utilitários que
briguem com ela. Se algum interativo hoje escapa do foco (ex.: por ter `outline-none` sem
substituto), corrigir pela mesma via da base. Sem misturar as duas abordagens.

### R5 — Ritmo de espaçamento e raios
Conferir coerência entre os cards: raios (`rounded-lg` / `xl` / `2xl`) e margens
(`mb-4` / `mb-6`). Alinhar o card **SaldoConta** (novo, `rounded-xl`) ao sistema dos
vizinhos e garantir que a fileira de saldo, o filtro de banco e a navegação de período
tenham o mesmo ritmo vertical. Ajustes pequenos, sem re-layout.

### R6 — Densidade e ordem dos blocos do topo
No topo do Dashboard hoje: fileira de saldo → filtro de banco → navegação de período.
Conferir que a sequência lê bem e que os espaços entre eles são consistentes (não um
`mb-4` colado num `mb-6`). Ajuste só de espaçamento/ordem se necessário.

## Fora de escopo
- Qualquer mudança de cor, identidade, partículas, ou layout estrutural.
- Login/acesso (já polido) — salvo se um R2/R4 tocar um componente compartilhado que ele usa.
- Gráficos (donut/evolução) — comportamento e cores mantidos.

## Testes / verificação
- A suíte atual (350) tem que continuar verde — os testes de componente (Auth,
  Documentos, etc.) pegam regressões de marcação/rótulo.
- `ErroCarregar` (R1): teste de componente — renderiza a mensagem e o botão chama `onTentar`.
- Verificação visual: **login e estados** eu confiro rodando o app; **dashboard com dados**
  depende do usuário logado — mando antes/depois e ele confirma.
- Cada R é um commit isolado, fácil de reverter se não agradar.

## Ordem de implementação (para o plano)
R1 (erro) → R2 (tipografia) → R3 (toque) → R4 (foco) → R5 (raios/espaço) → R6 (topo)
→ verificação (`npm test && build && lint && tsc`) + README/ESTADO se algo relevante mudar.
