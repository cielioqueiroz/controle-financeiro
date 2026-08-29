/** Consultas de leitura do caso de uso do histórico.
 *
 * A tela conhece esta interface de consulta, não o adaptador do Neon. O
 * adaptador atual continua em persist/ enquanto a migração é incremental.
 */
export { puxarTudo, type TransacaoSalva } from '../../persist/puxar'
export { puxarCategoriasUsuario, type CategoriaUsuario } from '../../persist/categoriasUsuario'
export { puxarSaldos, type DocDoPainel } from '../../persist/documentos'
