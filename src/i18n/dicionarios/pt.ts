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
  'auth.toast.criada': 'Conta criada. Se pedirmos confirmação, confira seu e-mail.',
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
  'rodape.privacidadeSalva': 'Lido no navegador · só a transação é salva, nunca o PDF',
  'rodape.privacidadeLocal': 'Lido no navegador · nada sai deste computador',
  'rodape.criadoPor': 'Criado por',

  // Dashboard — tiles, período, ações, listas
  'dash.gasto': 'Gasto no período',
  'dash.entradas': 'Entradas',
  'dash.lancamentos': 'Lançamentos',
  'dash.dia': 'Dia',
  'dash.semana': 'Semana',
  'dash.mes': 'Mês',
  'dash.ano': 'Ano',
  'dash.porFatura': 'por fatura',
  'dash.porData': 'por data da compra',
  'dash.totalGeral': 'Total geral',
  'dash.documentos': 'Documentos',
  'dash.baixarPdf': 'Baixar / Compartilhar PDF',
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

  // Seletor de idioma
  seletorIdioma: 'Idioma',
}

export type Dicionario = typeof pt
