import type { Dicionario } from './pt'

/** Español. Mismas claves que pt (el tipo lo exige). Traducciones a revisar. */
export const es: Dicionario = {
  'acesso.frase1': 'Tu extracto se vuelve gráfico,',
  'acesso.frase2': 'en menos de un minuto.',
  'acesso.bancos': 'Ya lee los extractos de',

  'auth.entrar': 'Entrar',
  'auth.criar': 'Crear cuenta',
  'auth.subtitulo': 'Tus datos financieros, solo tuyos.',
  'auth.ph.nome': 'nombre y apellido',
  'auth.ph.apelido': '¿cómo quieres que te llamemos? (apodo, opcional)',
  'auth.ajuda.apelido': 'Así te saludaremos. Si lo dejas en blanco, usamos tu primer nombre.',
  'auth.ph.email': 'tu@email.com',
  'auth.ph.senha': 'contraseña (mín. 8 caracteres)',
  'auth.esqueceu': '¿Olvidaste la contraseña?',
  'auth.ou': 'o',
  'auth.google': 'Continuar con Google',
  'auth.trocarParaCriar': '¿No tienes cuenta? Crea una',
  'auth.trocarParaEntrar': '¿Ya tienes cuenta? Entra',
  'auth.toast.criada': 'Cuenta creada. Si pedimos confirmación, revisa tu correo.',
  'auth.toast.semBanco': 'La base de datos no está configurada en este entorno.',
  'auth.toast.googleFalha': 'No se pudo entrar con Google.',
  'auth.toast.authFalha': 'Error de autenticación.',
  'auth.erro.credenciais': 'Correo o contraseña incorrectos.',
  'auth.erro.jaExiste': 'Este correo ya tiene cuenta.',
  'auth.erro.confirme': 'Confirma tu correo antes de entrar.',

  'validacao.emailInvalido': 'Ese correo no parece válido.',
  'validacao.senhaCurta': 'La contraseña debe tener al menos 8 caracteres.',

  'campo.mostrarSenha': 'Mostrar contraseña',
  'campo.ocultarSenha': 'Ocultar contraseña',

  'recuperar.novaSenha.titulo': 'Nueva contraseña',
  'recuperar.novaSenha.ajuda': 'Elige una contraseña y repítela para confirmar.',
  'recuperar.ph.novaSenha': 'nueva contraseña (mín. 8 caracteres)',
  'recuperar.ph.repita': 'repite la nueva contraseña',
  'recuperar.salvar': 'Guardar nueva contraseña',
  'recuperar.voltar': '‹ Volver al inicio',
  'recuperar.titulo': 'Recuperar acceso',
  'recuperar.ajuda.tokenMorto': 'Pide un enlace nuevo para continuar.',
  'recuperar.ajuda.enviado': 'Si hay una cuenta con ese correo, el enlace ya está en camino.',
  'recuperar.ajuda.inicial': 'Escribe tu correo y te enviamos un enlace para restablecer la contraseña.',
  'recuperar.btn.pedirNovo': 'Pedir un enlace nuevo',
  'recuperar.btn.enviarDeNovo': 'Enviar de nuevo',
  'recuperar.btn.enviar': 'Enviar enlace',
  'recuperar.toast.emailVazio': 'Escribe tu correo para recibir el enlace.',
  'recuperar.toast.enviadoDesc': 'Revisa también el spam.',
  'recuperar.toast.senhaAlterada': 'Contraseña cambiada. Entra con la nueva.',

  'rodape.privacidadeSalva': 'Leído en el navegador · solo se guarda la transacción, nunca el PDF',
  'rodape.privacidadeLocal': 'Leído en el navegador · nada sale de este equipo',
  'rodape.criadoPor': 'Creado por',

  seletorIdioma: 'Idioma',
}
