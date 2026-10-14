import type { Categoria } from '../domain/categorize/categorias'

// A identidade acompanha o slug, nunca a posição no ranking. Cores escolhidas
// pelo usuário continuam sendo dele; só o catálogo recebe tokens por tema.
const CORES: Record<string, string> = {
  supermercado: 'verde', padaria: 'ambar', farmacia: 'coral', combustivel: 'laranja',
  marketplace: 'ambar', assinaturas: 'violeta', beleza: 'rosa', telecom: 'azul',
  viagem: 'petroleo', delivery: 'coral', educacao: 'violeta', papelaria: 'violeta',
  servicos: 'petroleo', taxas: 'azul', rendimentos: 'verde', transferencia: 'neutro',
  agua: 'azul', luz: 'ambar', transporte: 'laranja', restaurante: 'coral', lazer: 'violeta',
  vestuario: 'rosa', pets: 'oliva', casa: 'petroleo', aluguel: 'azul', academia: 'verde',
  investimentos: 'verde', presentes: 'rosa', impostos: 'neutro', outros: 'neutro',
}

export function corCategoria(cat: Categoria): string {
  const token = CORES[cat.slug]
  return token ? `var(--color-categoria-${token})` : cat.cor
}
