/** Dicionário-fonte (pt). Os valores são IDÊNTICOS aos literais atuais das
 *  telas — é o que mantém os testes de componente verdes ao trocar por t().
 *
 *  Sem `as const` de propósito: com ele, os valores virariam tipos literais e
 *  `Dicionario` exigiria de en/es os mesmos textos, impedindo a tradução. Aqui
 *  os valores são `string`, então en/es só precisam ter as MESMAS CHAVES. */
export const pt = {
  // Tela de acesso
  'acesso.frase1': 'Seu extrato vira gráfico,',
  'acesso.frase2': 'em menos de um minuto.',
  'acesso.bancos': 'Já lê os extratos de',

  // Login / cadastro
  'auth.entrar': 'Entrar',
  'auth.criar': 'Criar conta',
  'auth.subtitulo': 'Seus dados financeiros, só seus.',
  'auth.ph.nome': 'nome e sobrenome',
  'auth.ph.apelido': 'como quer ser chamado? (apelido, opcional)',
  'auth.ajuda.apelido': 'É assim que vamos te saudar. Se deixar em branco, usamos seu primeiro nome.',
  'auth.ph.email': 'seu@email.com',
  'auth.ph.senha': 'senha (mín. 8 caracteres)',
  'auth.esqueceu': 'Esqueceu a senha?',
  'auth.ou': 'ou',
  'auth.google': 'Continuar com o Google',
  'auth.trocarParaCriar': 'Não tem conta? Criar uma',
  'auth.trocarParaEntrar': 'Já tem conta? Entrar',
  'auth.toast.criada': 'Conta criada.',
  'auth.toast.criadaConfirme': 'Enviamos um código de 6 dígitos para {email}. Digite-o no aviso do topo — confira também o spam.',
  'auth.toast.criadaSemEmail': 'Não consegui enviar o código de confirmação agora — dá para pedir outro pelo aviso no topo.',
  'aviso.confirmeEmail': 'Confirme seu e-mail ({email}) para garantir a recuperação de senha.',
  'aviso.confirmarAgora': 'Confirmar agora',
  'aviso.instrucao': 'Digite o código de 6 dígitos que enviamos para {email}. Ele vale por poucos minutos.',
  'aviso.rotuloCodigo': 'Código de confirmação',
  'aviso.confirmar': 'Confirmar',
  'aviso.confirmando': 'Confirmando…',
  'aviso.enviarCodigo': 'Enviar outro código',
  'aviso.enviando': 'Enviando…',
  'aviso.enviado': 'Código enviado. Confira sua caixa de entrada e o spam.',
  'aviso.confirmado': 'E-mail confirmado.',
  'aviso.confirmadoDesc': 'A recuperação de senha agora chega nesse endereço.',
  'aviso.codigoInvalido': 'Código inválido ou expirado.',
  'aviso.codigoInvalidoDesc': 'Confira os dígitos ou peça outro código.',
  'aviso.muitasTentativas': 'Muitas tentativas seguidas. Espere um minuto e tente de novo.',
  'aviso.falha': 'Não consegui falar com o servidor agora. Tente daqui a pouco.',
  'auth.toast.semBanco': 'O banco de dados não está configurado neste ambiente.',
  'auth.toast.googleFalha': 'Falha ao entrar com o Google.',
  'auth.toast.authFalha': 'Falha na autenticação.',
  'auth.erro.credenciais': 'E-mail ou senha incorretos.',
  'auth.erro.jaExiste': 'Este e-mail já tem conta.',
  'auth.erro.confirme': 'Confirme seu e-mail antes de entrar.',

  // Validação (mensagens de string única)
  'validacao.emailInvalido': 'Esse e-mail não parece válido.',
  'validacao.senhaCurta': 'A senha precisa ter ao menos 8 caracteres.',

  // Campo de senha (aria)
  'campo.rotulo.nome': 'Nome completo',
  'campo.rotulo.apelido': 'Apelido',
  'campo.rotulo.email': 'E-mail',
  'campo.rotulo.senha': 'Senha',
  'campo.mostrarSenha': 'Mostrar senha',
  'campo.ocultarSenha': 'Ocultar senha',

  // Recuperação de senha
  'recuperar.novaSenha.titulo': 'Nova senha',
  'recuperar.novaSenha.ajuda': 'Escolha uma senha e repita para confirmar.',
  'recuperar.ph.novaSenha': 'nova senha (mín. 8 caracteres)',
  'recuperar.ph.repita': 'repita a nova senha',
  'recuperar.salvar': 'Salvar nova senha',
  'recuperar.voltar': '‹ Voltar ao login',
  'recuperar.titulo': 'Recuperar acesso',
  'recuperar.ajuda.tokenMorto': 'Peça um link novo para continuar.',
  'recuperar.ajuda.enviado': 'Se houver conta com esse e-mail, o link já está a caminho.',
  'recuperar.ajuda.inicial': 'Informe seu e-mail e mandamos um link para redefinir a senha.',
  'recuperar.btn.pedirNovo': 'Pedir um novo link',
  'recuperar.btn.enviarDeNovo': 'Enviar de novo',
  'recuperar.btn.enviar': 'Enviar link',
  'recuperar.toast.emailVazio': 'Preencha seu e-mail para receber o link.',
  'recuperar.toast.enviadoDesc': 'Confira também o spam.',
  'recuperar.toast.senhaAlterada': 'Senha alterada. Entre com a senha nova.',

  // Rodapé
  'rodape.lema': 'Do extrato ao gráfico · cada centavo no lugar certo',
  'rodape.criadoPor': 'Criado por',

  // Dashboard — tiles, período, ações, listas
  'dash.gasto': 'Gasto no período',
  'dash.entradas': 'Entradas',
  'dash.saldoMes': 'Saldo do período',
  'dash.lancamentos': 'Lançamentos',
  'dash.dia': 'Dia',
  'dash.semana': 'Semana',
  'dash.mes': 'Mês',
  'dash.ano': 'Ano',
  'dash.porFatura': 'por fatura',
  'dash.porData': 'por data da compra',
  'dash.totalGeral': 'Total geral',
  'dash.documentos': 'Documentos',
  'dash.baixarPdf': 'Baixar PDF',
  'dash.compartilharPdf': 'Compartilhar',
  'dash.baixarTooltip': 'Salva o relatório do período no seu computador',
  'dash.compartilharTooltip': 'Abre o compartilhamento do sistema com o relatório',
  'dash.gerando': 'Gerando…',
  'dash.importar': '+ Importar PDF',
  'dash.periodoAnterior': 'Período anterior',
  'dash.proximoPeriodo': 'Próximo período',
  'dash.porCategoria': 'Por categoria',
  'dash.porDia': 'Por dia',
  'dash.gastoReal': 'gasto real',
  'dash.menu': 'Menu',
  'dash.docTooltip': 'Ver e apagar documentos importados',
  'dash.pdfTooltip': 'Gera um PDF do período e abre o compartilhamento (ou baixa)',

  // Estados (vazio / erro)
  'estado.vazioTitulo': 'Nada por aqui ainda',
  'estado.vazioCorpo':
    'Não há lançamentos salvos neste período. Importe uma fatura ou extrato para começar a ver para onde o dinheiro foi.',
  'estado.erroTitulo': 'Não consegui carregar',
  'estado.tentarDeNovo': 'Tentar de novo',

  // Saldo por conta
  'saldo.rotulo': 'Saldo',
  'saldo.em': 'em {data}',

  // Saldo em aberto do cartão (declarado pela fatura)
  'aberto.rotulo': 'Próximas faturas',
  'aberto.fecha': 'fecha em {data}',
  'aberto.ciclo': 'ciclo em aberto',
  'aberto.parcelas': 'parcelas a vencer',
  'compGrafico.titulo': 'Parcelas por mês · quem cobra',
  'compGrafico.rotuloBarra': '{mes}: {total} a vencer ({detalhe}). Ver este mês.',
  'evolucao.titulo': 'Entradas × saídas · 12 meses',
  'evolucao.entradas': 'Entradas',
  'evolucao.saidas': 'Saídas',
  'evolucao.escolha': 'Escolha um mês para ver os valores',
  'evolucao.rotuloBarra': '{mes}: entradas {entradas}, saídas {saidas}. Ver este mês.',
  // Donut de categorias: os dois rótulos que só existem para leitor de tela —
  // a última dívida de i18n do projeto, fechada em 13/08.
  'donut.rotulo': 'Gasto por categoria, total {total}',
  'donut.rotuloFatia': '{categoria}: {valor}, {pct}% do total. Ver lançamentos.',
  'evolucao.rotuloBarraCortada': '{mes}: entradas {entradas}, saídas {saidas} — acima da escala. Ver este mês.',
  'evolucao.acima1': '{n} barra acima',
  'evolucao.acima': '{n} barras acima',
  'diario.titulo': 'Saídas por dia',
  'diario.resumo': '{dias} dias com gasto · média {media}',
  'diario.lancamento1': '{n} lançamento',
  'diario.lancamentos': '{n} lançamentos',
  'diario.rotuloBarra': '{dia}: {valor} em saídas. Ver este dia.',
  'diario.rotuloBarraCortada': '{dia}: {valor} em saídas — acima da escala. Ver este dia.',
  'diario.media': 'média',
  'diario.escala': 'escala até {teto}',
  'diario.acima1': '{n} dia acima',
  'diario.acima': '{n} dias acima',
  'diario.semRitmo': 'Ainda não há saídas suficientes para desenhar um ritmo.',

  // Maiores saídas do período
  'maiores.titulo': 'Maiores saídas do período',

  // Ranking por estabelecimento. Título diferente de "maiores saídas" de
  // propósito: os dois convivem lado a lado e respondem perguntas distintas
  // ("qual foi a maior compra" × "que lugar mais consumiu").
  'estab.titulo': 'Onde mais saiu dinheiro',
  'estab.compra1': '1 compra',
  'estab.compras': '{n} compras',
  'estab.rotulo': '{nome}: {valor} em {n} compras. Ver lançamentos.',

  // Variação contra o período anterior (tiles do resumo).
  'variacao.subiu': '{pct}% acima do período anterior',
  'variacao.caiu': '{pct}% abaixo do período anterior',
  'variacao.igual': 'igual ao período anterior',

  // Recorrências detectadas
  'rec.titulo': 'Recorrências',
  'rec.contagem': '{n} detectadas no histórico',
  'rec.contagem1': '{n} detectada no histórico',
  'rec.dia': 'dia {d}',
  'rec.variavel': 'valor varia',
  'rec.verTodas': 'ver mais {n}',
  'rec.verMenos': 'ver menos',
  'rec.alertaValor': '{nome} mudou de {de} para {para}',
  'rec.alertaSumiu': '{nome} não veio neste mês',

  // Busca de lançamentos
  'dash.todos': 'Todos',
  'busca.placeholder': 'Procurar por estabelecimento…',
  'busca.rotulo': 'Procurar lançamento',
  'busca.dicas': 'Também aceita: >100 · <50 · banco:nubank · cat:farmacia · sem:categoria',
  'busca.categoria': 'Filtrar por categoria',
  'busca.todasCategorias': 'Todas as categorias',
  'busca.resultados': '{n} lançamentos',
  'busca.resultado1': '{n} lançamento',
  'busca.vazio': 'Nada encontrado com esses filtros.',

  // Painel de categorias e regras aprendidas
  'dash.categorias': 'Categorias',
  'dash.catTooltip': 'Suas categorias e o que o app aprendeu',
  'cats.titulo': 'Categorias',
  'cats.subtitulo': 'Suas categorias e o que o app aprendeu com suas correções',
  'cats.suas': 'Suas categorias',
  'cats.semSuas': 'Você ainda não criou nenhuma categoria.',
  'cats.carregando': 'Carregando…',
  'cats.usoN': '{n} lançamentos',
  'cats.editar': 'Editar',
  'cats.apagar': 'Apagar',
  'cats.editarNome': 'Editar a categoria {nome}',
  'cats.apagarNome': 'Apagar a categoria {nome}',
  'cats.esquecerNome': 'Esquecer a regra de {padrao}',
  'cats.nome': 'Nome da categoria',
  'cats.icone': 'Ícone',
  'cats.regras': 'Aprendizado',
  'cats.regrasAjuda':
    'Quando você corrige a categoria de uma compra, o app passa a usar a mesma categoria nas próximas. Aqui dá para desfazer.',
  'cats.semRegras': 'O app ainda não aprendeu nenhuma regra.',
  'cats.esquecer': 'Esquecer',
  'cats.confApagarTitulo': 'Apagar esta categoria?',
  'cats.confApagarUsada':
    'A categoria "{nome}" está em {n} lançamentos. Eles não serão apagados, mas passam a aparecer como Outros.',
  'cats.confApagarLivre': 'A categoria "{nome}" não está em nenhum lançamento.',
  'cats.toastSalva': 'Categoria atualizada.',
  'cats.toastApagada': 'Categoria apagada.',
  'cats.toastRegraEsquecida': 'Regra esquecida.',
  'cats.toastFalha': 'Não consegui carregar as categorias.',
  'cats.toastSalvarFalha': 'Não consegui salvar a categoria.',
  'cats.toastApagarFalha': 'Não consegui apagar a categoria.',
  'cats.toastRegraFalha': 'Não consegui esquecer a regra.',

  // Compromissos futuros
  'comp.titulo': 'Compromissos futuros',
  'comp.aVencerSing': '{n} parcela a vencer',
  'comp.aVencerPlur': '{n} parcelas a vencer',
  'comp.somaVencer': 'soma a vencer',

  // Cabeçalho logado
  'header.ola': 'Olá, {nome}!',
  'header.sub': 'Importe a fatura, o resto a gente calcula.',
  'header.voltar': '‹ Voltar ao histórico',
  'header.ateLogo': 'Até logo, {quem}!',
  'header.sessaoEncerrada': 'Sua sessão foi encerrada neste navegador.',

  // Menu da conta
  'conta.aria': 'Conta',
  'conta.conectadoComo': 'Conectado como',
  'conta.editarPerfil': 'Editar perfil',
  'conta.verTutorial': 'Ver tutorial',
  'conta.sair': 'Sair da conta',
  'conta.sairTitulo': 'Sair da conta?',
  'conta.sairDescricao': 'Você precisará entrar de novo para ver seus dados.',
  'conta.sairConfirmar': 'Sair',

  // Validação de acesso (campos faltando + recuperação)
  'campo.nome': 'nome',
  'campo.email': 'e-mail',
  'campo.senha': 'senha',
  'campo.pos.nome': 'seu nome',
  'campo.pos.email': 'seu e-mail',
  'campo.pos.senha': 'sua senha',
  'validacao.preenchaCriar': 'Preencha {campos} para criar sua conta.',
  'validacao.preenchaEntrar': 'Preencha {campos} para entrar.',
  'recuperar.erro.digite': 'Digite a nova senha.',
  'recuperar.erro.repita': 'Repita a nova senha para confirmar.',
  'recuperar.erro.naoCoincidem': 'As senhas não coincidem.',
  'recuperar.erro.rede': 'Não consegui falar com o servidor. Tente de novo.',
  'recuperar.erro.token': 'Este link expirou ou já foi usado.',

  // Genéricos
  'geral.cancelar': 'Cancelar',
  'geral.salvar': 'Salvar',
  'geral.salvando': 'Salvando…',
  'geral.fechar': 'Fechar',
  'doc.fatura': 'Fatura',
  'doc.extrato': 'Extrato',

  // Falhas com conserto do lado de quem lê (lib/erro-usuario.ts). Cada uma
  // diz O QUE FAZER: sem isso seriam sinônimos de "deu errado", e aí o
  // genérico de cada tela já bastaria.
  'erro.semSessao': 'Sua sessão expirou. Entre de novo para continuar.',
  'erro.semConexao': 'Sem conexão com o servidor. Tente de novo em instantes.',
  'erro.semPermissao': 'Esses dados não são desta conta.',
  'erro.duplicado': 'Isso já existe por aqui.',
  'erro.sair': 'Não consegui encerrar a sessão.',
  'erro.carregar': 'Falha ao carregar.',

  // Editar perfil
  'perfil.subtitulo': 'Como você quer ser chamado por aqui.',
  'perfil.apelidoLabel': 'Apelido — como aparece na saudação',
  'perfil.apelidoPh': 'como quer ser chamado?',
  'perfil.apelidoAjuda': 'Deixe em branco para usar seu primeiro nome.',
  'perfil.nomeLabel': 'Nome completo',
  'perfil.previaPrefixo': 'Vai aparecer assim:',
  'perfil.toastOk': 'Perfil atualizado.',
  'perfil.toastFalha': 'Não consegui salvar o perfil.',

  // Editar compra
  'editar.titulo': 'Editar compra',
  'editar.nomeEstab': 'Nome do estabelecimento',
  'editar.nomeAjuda': 'Deixe em branco para usar o texto original do banco.',
  'editar.categoria': 'Categoria',
  'editar.nova': 'Nova',
  'editar.novaCatPh': 'Nome da nova categoria',
  'editar.emojiAria': 'Emoji da categoria',
  'editar.criarCat': 'Criar categoria',
  'editar.criando': 'Criando…',
  'editar.toastNomeCat': 'Dê um nome para a categoria.',
  'editar.toastCatCriada': 'Categoria "{nome}" criada.',
  'editar.toastCatFalha': 'Falha ao criar a categoria.',
  'editar.toastOk': 'Compra atualizada.',
  'editar.toastFalha': 'Falha ao salvar.',
  'editar.toastAprendeu': 'Compra atualizada — e vou lembrar desta categoria.',
  'editar.toastNaoAprendeu': 'Compra atualizada, mas não consegui memorizar a categoria.',
  'editar.tambemHistorico': 'Corrigir também as outras {n} compras deste estabelecimento',
  'editar.tambemHistoricoUm': 'Corrigir também a outra compra deste estabelecimento',
  'editar.tambemHistoricoAjuda': 'Já estão gravadas em outra categoria e casam com esta mesma regra.',
  'editar.toastAprendeuEHistorico': 'Compra atualizada — e mais {n} iguais foram corrigidas.',
  'editar.toastAprendeuEHistoricoUm': 'Compra atualizada — e mais uma igual foi corrigida.',
  'editar.toastHistoricoFalhou': 'Salvei esta compra, mas não consegui corrigir as anteriores.',
  'editar.confirmaTitulo': 'Salvar alterações?',
  'editar.confirmaDesc': 'A compra passa a valer com o nome e a categoria que você escolheu.',
  'editar.confirmaDescHistorico': 'Além desta, outras {n} compras do mesmo estabelecimento passam para a categoria escolhida.',
  'editar.confirmaDescHistoricoUm': 'Além desta, outra compra do mesmo estabelecimento passa para a categoria escolhida.',
  'discreto.esconder': 'Esconder os valores',
  'discreto.mostrar': 'Mostrar os valores',
  'diag.outros': '{pct}% do gasto ({valor}) está sem categoria — corrigir uma compra agora conserta as iguais.',
  'diag.concentracao': '{rotulo} concentra {pct}% do gasto do período ({valor}).',
  'diag.taxas': 'Taxas e encargos levaram {pct}% do gasto ({valor}).',
  'editar.vinculo': 'Não contar como gasto — o dinheiro só mudou de lugar',
  'editar.vinculoAjuda': 'Transferência entre suas contas, quitação de fatura ou aplicação. Sai do gasto real, dos rankings e dos gráficos.',
  'editar.confirmaVinculoOn': 'Este lançamento deixa de contar no gasto real e nos rankings.',
  'editar.confirmaVinculoOff': 'Este lançamento volta a entrar nas contas.',

  // Documentos
  'docs.titulo': 'Documentos importados',
  'docs.subtitulo': 'Apague uma fatura/extrato ou recomece do zero.',
  'docs.carregando': 'Carregando…',
  'docs.vazio': 'Nenhum documento importado ainda.',
  'docs.nLancamentos': '{n} lançamentos',
  'docs.importadoEm': 'importado em {data}',
  'docs.apagarDoc': 'Apagar documento',
  'docs.apagarDocTitle': 'Apagar este documento',
  'docs.apagarTudo': 'Apagar tudo e recomeçar',
  'docs.apagar': 'Apagar',
  'docs.toastListaFalha': 'Falha ao listar documentos.',
  'docs.toastApagado': 'Documento apagado.',
  'docs.toastApagarFalha': 'Falha ao apagar.',
  'docs.toastTudoApagado': 'Tudo apagado. Você começa do zero.',
  'docs.toastApagarTudoFalha': 'Falha ao apagar tudo.',
  'docs.confApagarTitulo': 'Apagar este documento?',
  'docs.confApagarDesc': '{tipo} · {banco} · {periodo}. Os lançamentos dele saem do histórico.',
  'docs.confTudoTitulo': 'Apagar tudo e recomeçar?',
  'docs.confTudoDesc': 'Isto apaga {docs} e {lanc}. Não dá para desfazer.',
  'docs.contDocs': '{n} documentos',
  'docs.contDoc1': '{n} documento',
  'docs.contLanc': '{n} lançamentos',
  'docs.contLanc1': '{n} lançamento',
  'docs.apagarTudoCurto': 'Apagar tudo',

  // Tutorial
  'tutorial.pular': 'Pular',
  'tutorial.voltar': 'Voltar',
  'tutorial.proximo': 'Próximo',
  'tutorial.boraVer': 'Bora ver',
  'tutorial.comecar': 'Começar!',
  'tutorial.boasVindas':
    'Bem-vindo(a) ao seu controle financeiro. Importe faturas e extratos em PDF e veja, com clareza, para onde o seu dinheiro foi — sem digitar nada. Em 30 segundos eu te mostro como.',
  'tutorial.p1t':
    'Importe um PDF',
  'tutorial.p1c':
    'Na página Importação, solte a fatura ou o extrato — leio Nubank, Bradesco, Banco do Brasil, Sicredi e Sicoob. A leitura acontece no seu navegador (o PDF nunca sai do computador) e eu confiro a soma contra o total que o próprio banco declara, ao centavo.',
  'tutorial.p2t':
    'O painel responde três perguntas',
  'tutorial.p2c':
    'Quanto saiu, quanto entrou e o que sobrou no período. Abaixo, o donut mostra EM QUE o dinheiro foi e o gráfico de dias mostra QUANDO. Os dois são clicáveis: a fatia abre os lançamentos daquela categoria, a barra leva ao dia.',
  'tutorial.p3t':
    'Escolha o período',
  'tutorial.p3c':
    'Dia, Semana, Mês e Ano. Mês e Ano agrupam pela competência da fatura — batem com o que você paga naquele mês, não com a data da compra. O recorte fica no endereço: recarregar não perde nada, e o link leva outra pessoa à mesma tela.',
  'tutorial.p4t':
    'Ache e corrija',
  'tutorial.p4c':
    'Em Lançamentos, a vista "Todos" tem busca por nome e filtro por categoria. Clique no lápis de uma linha para renomear o estabelecimento ou trocar a categoria — e eu aprendo: na próxima importação, aquela loja já vem certa.',
  'tutorial.p5t':
    'Faturas e Categorias',
  'tutorial.p5c':
    'Em Faturas está tudo que você importou, com a opção de apagar um documento ou recomeçar do zero. Em Categorias você renomeia as suas, escolhe cor e ícone, e vê (ou desfaz) cada regra que eu aprendi com as suas correções.',
  'tutorial.p6t':
    'Recorrências e relatório',
  'tutorial.p6c':
    'Em Recorrências eu mostro o que se repete todo mês — assinaturas, contas — detectado sozinho, sem você cadastrar nada, e aviso quando um valor muda ou uma cobrança some. E o botão "Baixar PDF" do painel gera um relatório do período para guardar ou compartilhar.',

  // Importação — dropzone
  'drop.tituloLendo': 'Lendo o documento…',
  'drop.titulo': 'Solte a fatura ou o extrato aqui',
  'drop.corpo': 'PDF do banco, do jeito que ele te mandou. O arquivo é lido {navegador} e não sai deste computador.',
  'drop.navegador': 'no seu navegador',
  'drop.processando': 'processando',
  'drop.clique': 'ou clique para escolher',

  // Importação — toasts do fluxo
  'importar.naoPdf': 'Isso não parece um PDF.',
  'importar.digitalizado': 'PDF digitalizado — ainda não sei ler imagem, só texto.',
  'importar.toastConfere': '{n} lançamentos — bate com o banco ao centavo.',
  'importar.toastSemGabarito': '{n} lançamentos lidos, sem total para conferir.',
  'importar.toastNaoFechou': 'O total lido não fechou com o do banco. Confira antes de salvar.',
  'importar.protegido': 'PDF protegido por senha.',
  'importar.naoLi': 'Não consegui ler este arquivo.',
  'importar.emBreve': '{msg}. Em breve.',
  'salvar.okNovos': 'Salvo: {n} novos lançamentos.',
  'salvar.okComExistentes': 'Salvo: {n} novos lançamentos, {ja} já existiam.',
  'salvar.duplicado': 'Este documento já foi importado em {data}.',
  'salvar.falha': 'Falha ao salvar.',

  // Importação — cartão de resultado
  'tipo.fatura': 'Fatura de cartão',
  'tipo.extrato': 'Extrato de conta',
  'tipo.desconhecido': 'Desconhecido',
  'import.salvarHistorico': 'Salvar no histórico',
  'import.limpar': 'Limpar',
  'import.final': 'final {n}',
  'import.dupla':
    'Removi {removido} de pagamentos de fatura e transferências entre suas contas — dinheiro que apareceria contado duas vezes. O gasto real é {real}.',
  'import.confereTitulo': 'Confere com o banco',
  'import.semGabaritoTitulo': 'Lido, sem total para conferir',
  'import.naoFechouTitulo': 'O total não fechou',
  'import.faltam': 'faltam {v}',
  'import.totalDeclarado': 'Total declarado',
  'import.renomear': 'Clique para renomear',

  // Linha de transação (histórico) e tema
  'linha.renomearTitle': 'Renomear / trocar categoria',
  'tema.paraEscuro': 'Mudar para tema escuro',
  'tema.paraClaro': 'Mudar para tema claro',
  'tema.escuro': 'Tema escuro',
  'tema.claro': 'Tema claro',

  // Relatório em PDF (e cabeçalho de impressão)
  'pdf.relatorio': 'Relatório',
  'pdf.geradoEm': 'gerado em {data}',
  'pdf.saidas': 'Saídas',
  'pdf.saldoPeriodo': 'Saldo do período',
  'pdf.saldoPorConta': 'Saldo por conta',
  'pdf.categoria': 'Categoria',
  'pdf.valor': 'Valor',
  'pdf.geradoPor': 'Gerado por',
  'pdf.baixado': 'Relatório baixado.',
  'pdf.erroGerar': 'Não consegui gerar o PDF.',
  'pdf.textoCompartilhar': 'Meu relatório de {periodo} — Capital Financeiro.',

  // Aba desatualizada depois de um deploy
  'app.versaoNova': 'Saiu uma versão nova. Recarregue para continuar.',
  'app.recarregar': 'Recarregar',

  // Seletor de idioma
  seletorIdioma: 'Idioma',
}

export type Dicionario = typeof pt
