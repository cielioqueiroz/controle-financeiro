/** Catálogo de categorias, derivado dos estabelecimentos que de fato
 *  aparecem nos documentos do usuário (ver spec, decisão #9). Uber, Água
 *  e Luz existem mas sem regras — prontas se aparecerem, sem poluir a UI. */

export type Categoria = {
  slug: string
  nome: string
  /** Emoji como ícone — zero dependência, reconhecível na hora. */
  icone: string
  cor: string
}

export const CATEGORIAS: Categoria[] = [
  { slug: 'supermercado', nome: 'Supermercado', icone: '🛒', cor: '#4ade80' },
  { slug: 'padaria', nome: 'Padaria', icone: '🥖', cor: '#fbbf24' },
  { slug: 'farmacia', nome: 'Farmácia & Saúde', icone: '💊', cor: '#f87171' },
  { slug: 'combustivel', nome: 'Combustível & Carro', icone: '⛽', cor: '#fb923c' },
  { slug: 'marketplace', nome: 'Marketplace', icone: '📦', cor: '#facc15' },
  { slug: 'assinaturas', nome: 'Assinaturas', icone: '🔄', cor: '#a78bfa' },
  { slug: 'beleza', nome: 'Beleza', icone: '💄', cor: '#f472b6' },
  { slug: 'telecom', nome: 'Telecom', icone: '📱', cor: '#38bdf8' },
  { slug: 'viagem', nome: 'Viagem', icone: '✈️', cor: '#22d3ee' },
  { slug: 'delivery', nome: 'Delivery', icone: '🍔', cor: '#fb7185' },
  { slug: 'educacao', nome: 'Educação', icone: '📚', cor: '#818cf8' },
  { slug: 'papelaria', nome: 'Papelaria', icone: '✏️', cor: '#c084fc' },
  { slug: 'servicos', nome: 'Serviços', icone: '🔧', cor: '#94a3b8' },
  { slug: 'taxas', nome: 'Taxas bancárias', icone: '🏦', cor: '#64748b' },
  { slug: 'rendimentos', nome: 'Rendimentos', icone: '📈', cor: '#34d399' },
  { slug: 'transferencia', nome: 'Transferências', icone: '↔️', cor: '#9ca3af' },
  { slug: 'agua', nome: 'Água', icone: '💧', cor: '#60a5fa' },
  { slug: 'luz', nome: 'Luz', icone: '💡', cor: '#fde047' },
  { slug: 'transporte', nome: 'Transporte', icone: '🚗', cor: '#f59e0b' },
  { slug: 'restaurante', nome: 'Restaurante', icone: '🍽️', cor: '#fb923c' },
  { slug: 'lazer', nome: 'Lazer', icone: '🎬', cor: '#c084fc' },
  { slug: 'vestuario', nome: 'Vestuário', icone: '👕', cor: '#f472b6' },
  { slug: 'pets', nome: 'Pets', icone: '🐾', cor: '#a3e635' },
  { slug: 'casa', nome: 'Casa & Moradia', icone: '🏠', cor: '#38bdf8' },
  { slug: 'aluguel', nome: 'Aluguel', icone: '🔑', cor: '#facc15' },
  { slug: 'academia', nome: 'Academia', icone: '🏋️', cor: '#4ade80' },
  { slug: 'investimentos', nome: 'Investimentos', icone: '💰', cor: '#34d399' },
  { slug: 'presentes', nome: 'Presentes', icone: '🎁', cor: '#fb7185' },
  { slug: 'impostos', nome: 'Impostos & Taxas', icone: '🧾', cor: '#94a3b8' },
  { slug: 'outros', nome: 'Outros', icone: '❓', cor: '#6b7280' },
]

const porSlug = new Map(CATEGORIAS.map((c) => [c.slug, c]))

/** Categorias criadas pelo usuário (vêm do banco em tempo de execução).
 *  Slugs começam com "u-" para nunca colidir com as embutidas. */
const extras = new Map<string, Categoria>()

export function registrarCategoriasUsuario(cats: Categoria[]): void {
  extras.clear()
  for (const c of cats) extras.set(c.slug, c)
}

export function adicionarCategoriaExtra(cat: Categoria): void {
  extras.set(cat.slug, cat)
}

export function removerCategoriaExtra(slug: string): void {
  extras.delete(slug)
}

/** Todas as categorias para o seletor: embutidas + do usuário, com "Outros"
 *  sempre por último. */
export function todasCategorias(): Categoria[] {
  const semOutros = CATEGORIAS.filter((c) => c.slug !== 'outros')
  const outros = CATEGORIAS.find((c) => c.slug === 'outros')!
  return [...semOutros, ...extras.values(), outros]
}

export const categoria = (slug: string): Categoria =>
  porSlug.get(slug) ?? extras.get(slug) ?? porSlug.get('outros')!
