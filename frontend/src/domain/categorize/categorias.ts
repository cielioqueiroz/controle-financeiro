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

/** Nomes das categorias embutidas em en/es. Dado puro (sem import de i18n).
 *  As categorias criadas pelo usuário NÃO entram aqui — o nome delas é dado
 *  do usuário e nunca se traduz. */
const NOMES_I18N: Record<string, { en: string; es: string }> = {
  supermercado: { en: 'Groceries', es: 'Supermercado' },
  padaria: { en: 'Bakery', es: 'Panadería' },
  farmacia: { en: 'Pharmacy & Health', es: 'Farmacia y Salud' },
  combustivel: { en: 'Fuel & Car', es: 'Combustible y Coche' },
  marketplace: { en: 'Marketplace', es: 'Marketplace' },
  assinaturas: { en: 'Subscriptions', es: 'Suscripciones' },
  beleza: { en: 'Beauty', es: 'Belleza' },
  telecom: { en: 'Telecom', es: 'Telecom' },
  viagem: { en: 'Travel', es: 'Viaje' },
  delivery: { en: 'Delivery', es: 'Delivery' },
  educacao: { en: 'Education', es: 'Educación' },
  papelaria: { en: 'Stationery', es: 'Papelería' },
  servicos: { en: 'Services', es: 'Servicios' },
  taxas: { en: 'Bank fees', es: 'Comisiones bancarias' },
  rendimentos: { en: 'Earnings', es: 'Rendimientos' },
  transferencia: { en: 'Transfers', es: 'Transferencias' },
  agua: { en: 'Water', es: 'Agua' },
  luz: { en: 'Electricity', es: 'Luz' },
  transporte: { en: 'Transport', es: 'Transporte' },
  restaurante: { en: 'Restaurant', es: 'Restaurante' },
  lazer: { en: 'Leisure', es: 'Ocio' },
  vestuario: { en: 'Clothing', es: 'Ropa' },
  pets: { en: 'Pets', es: 'Mascotas' },
  casa: { en: 'Home & Housing', es: 'Casa y Hogar' },
  aluguel: { en: 'Rent', es: 'Alquiler' },
  academia: { en: 'Gym', es: 'Gimnasio' },
  investimentos: { en: 'Investments', es: 'Inversiones' },
  presentes: { en: 'Gifts', es: 'Regalos' },
  impostos: { en: 'Taxes & Fees', es: 'Impuestos y Tasas' },
  outros: { en: 'Other', es: 'Otros' },
}

/** Idioma ativo dos nomes de categoria. Estado de módulo, ajustado pelo
 *  IdiomaProvider — mesmo padrão da locale de moeda/datas. */
let idiomaCat: 'pt' | 'en' | 'es' = 'pt'

export function definirIdiomaCategorias(id: 'pt' | 'en' | 'es'): void {
  idiomaCat = id
}

/** Nome de exibição de uma categoria no idioma ativo. Embutida → traduzido;
 *  categoria do usuário (ou slug sem tradução) → o próprio `nome`. O `slug`
 *  (chave persistida) nunca muda. */
export function nomeCategoria(cat: Categoria): string {
  if (idiomaCat === 'pt') return cat.nome
  return NOMES_I18N[cat.slug]?.[idiomaCat] ?? cat.nome
}

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

/** Todas as categorias para o seletor: embutidas + do usuário, com "Outros"
 *  sempre por último. */
export function todasCategorias(): Categoria[] {
  const semOutros = CATEGORIAS.filter((c) => c.slug !== 'outros')
  const outros = CATEGORIAS.find((c) => c.slug === 'outros')!
  return [...semOutros, ...extras.values(), outros]
}

export const categoria = (slug: string): Categoria =>
  porSlug.get(slug) ?? extras.get(slug) ?? porSlug.get('outros')!
