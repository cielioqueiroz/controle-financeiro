# O "livro-razão" volta, e a navegação vira calha lateral

Em 2026-08-25 o app trocou de direção visual: `f4bd601` levou tudo para
"impresso e terminal" — raio zero, sem cartão nem sombra, Courier Prime na
interface inteira, cor racionada a três lugares. Foi escolha do usuário entre
dez direções.

Em 2026-08-31 ele reverteu, também com as telas na mão. O commit `6500839`
desfaz o `f4bd601` inteiro e o app volta ao "livro-razão": IBM Plex Sans /
Condensed / Mono, a escala de raio do Tailwind, cartão com sombra, e o confete
da `Celebracao` que o redesign havia aposentado.

**Não há achado técnico aqui, e é isso que precisa ficar registrado.** O
"impresso e terminal" media bem — contraste passava nos dois temas, o medidor
de overflow passava nas duas larguras — e era coerente com a tese do produto
(um app que confere ao centavo tem cara de documento). Ele perdeu por gosto do
dono. É o mesmo critério que o fez ganhar seis dias antes, e é critério
suficiente: quem mantém o app é quem olha para ele todo dia.

Na mesma rodada a navegação mudou de forma. Era uma barra horizontal de abas
sob o cabeçalho; virou uma **calha lateral** de 16rem com a marca no topo, as
seis seções com ícone e o bloco da conta no rodapé.

## Consequences

- **Reverter uma direção é barato porque ela cabia num commit.** O `f4bd601`
  concentrava a mudança em `index.css`, `fontes.css` e `index.html`, com
  retoques em 18 componentes: `git revert` resolveu com dois conflitos. Toda
  direção visual futura deve caber assim — se um redesenho se espalhar por
  cinquenta arquivos de componente, ele deixa de ser reversível e vira
  reescrita.
- **Acessibilidade não reverte junto.** Os dois conflitos do revert eram o alvo
  de toque de 44px de `8a4130f`, e os dois foram resolvidos a favor do HEAD.
  Desenho é gosto; contraste e alvo de toque são requisito.
- **A calha só existe a partir de `lg`.** Abaixo disso quem navega continua
  sendo a `NavPrincipal` horizontal — 16rem num viewport de 390px levaria
  metade da tela. As duas leem a mesma `ROTAS`, então nenhuma pode oferecer
  seção que a outra não tem.
- **Os modais de tutorial e de perfil subiram para o `App`.** Moravam no
  `Cabecalho` com uma razão escrita: "só o menu de conta os abre". O menu
  desceu para a calha e agora dois lugares o abrem — estado duplicado seria um
  tutorial aberto por um e fechado pelo outro.
- **O gradiente do botão "Entrar" é o único do sistema**, e é medido: texto
  sobre gradiente precisa passar o contraste nas DUAS pontas, não na média, e
  `medir-contraste.py` ganhou esse par (6.90:1 no claro, 8.22:1 no escuro).
- **A decoração da tela de acesso está em camada `fixed`**, como a regra do
  `AGENTS.md` manda. O brilho desta mesma tela já criou barra de rolagem
  lateral uma vez, por escalar dentro do `scrollWidth`.
