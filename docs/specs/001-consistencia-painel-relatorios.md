# Consistência do Painel e dos Relatórios

Status: implementado e validado localmente em 2026-10-13; incluído no push para `main` de 2026-10-14.

## Problemas observados

Relatórios retornava `null` durante a consulta e ignorava o erro do provider.
A seleção de 3/6/12 meses vivia apenas no estado local. Os cards repetiam
classes de superfície e o esqueleto do Painel ainda imitava três colunas
sem espaçamento, apesar dos quatro indicadores atuais.

## Critérios de aceite

1. Cards compartilham superfície e preenchimento, com separação entre blocos.
2. Carregamento tem status acessível e não exibe totais fictícios.
3. Falha em Relatórios apresenta erro e permite tentar de novo.
4. Histórico vazio oferece acesso à importação.
5. `janela=3`, `6` ou `12` determina a seleção no relatório; entrada inválida
   usa 12. Selecionar preserva banco e demais parâmetros da URL.
6. Inicializar a competência ou selecionar um mês não apaga a janela.
7. A procedência usa exatamente as transações que compõem o relatório.
8. Os três idiomas, modo discreto e movimento reduzido permanecem suportados.

## Limites desta etapa

Não altera parsers, agregações financeiras, tabelas, RLS ou autenticação.
Não adiciona serviços de IA. A comparação de janelas e meses ausentes precisa
de uma especificação própria antes de mudar seu significado financeiro.

## Próximas etapas propostas

- Conferência: mapear a tela Documentos e diagnósticos existentes, definir
  quais divergências podem ser revisitadas com os dados já persistidos.
- Comparação: implementada na [spec 002](./002-comparacao-por-competencia.md),
  com meses ausentes explícitos e intervalos de mesma duração.
- Dados: testar isolamento entre usuários e migrações em banco descartável;
  registrar resultado sem usar dados pessoais.
- UI: adotar os componentes compartilhados nas demais páginas gradualmente.

Esses itens são fila de trabalho, não funcionalidades concluídas nesta etapa.

## Validação da etapa

- `npm run verificar`: passou em typecheck, testes, lint, caminhos, build e CSP.
- Cinco novos testes de Relatórios cobrem carregamento, falha/recuperação,
  vazio, preservação da janela e leitura de URL copiada/inválida.
- Medidor de contraste: passou nos temas claro e escuro.
- Overflow: nove jornadas em 1280×800 e 390×844 passaram. A folha de provas
  tinha cards sem `min-width: 0`; adotar `Cartao` eliminou o estouro de 1 px.
- Acessibilidade: onze jornadas em ambas as larguras, incluindo Painel e
  Relatórios nos dois temas, sem violações critical/serious.
- Inspeção visual do relatório em desktop claro e celular escuro; espaçamento
  vertical calculado de 24 px no desktop. Nenhuma dependência foi adicionada.

Os medidores usam dados fictícios locais; não validam a disponibilidade do Neon,
o conteúdo de uma conta real ou um deploy em produção.
