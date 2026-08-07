import { neon } from '../lib/neon'
import type { Categoria } from '../domain/categorize/categorias'

export type CategoriaUsuario = Categoria & { id: string }

/** Lê as categorias personalizadas do usuário (RLS escopa às dele). */
export async function puxarCategoriasUsuario(): Promise<CategoriaUsuario[]> {
  if (!neon) return []
  const { data, error } = await neon
    .from('categories')
    .select('id, slug, nome, icone, cor')
    .order('sort_order')
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    slug: r.slug as string,
    nome: r.nome as string,
    icone: r.icone as string,
    cor: r.cor as string,
  }))
}

function gerarSlug(nome: string): string {
  const base = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `u-${base || 'cat'}-${Math.random().toString(36).slice(2, 6)}`
}

/** Cria uma categoria do usuário. O slug "u-…" nunca colide com embutidas. */
export async function criarCategoria(c: {
  nome: string
  icone: string
  cor: string
}): Promise<CategoriaUsuario> {
  if (!neon) throw new Error('Sem conexão.')
  const slug = gerarSlug(c.nome)
  const { data, error } = await neon
    .from('categories')
    .insert({ slug, nome: c.nome.trim(), icone: c.icone, cor: c.cor })
    .select('id, slug, nome, icone, cor')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Falha ao criar a categoria.')
  return {
    id: data.id as string,
    slug: data.slug as string,
    nome: data.nome as string,
    icone: data.icone as string,
    cor: data.cor as string,
  }
}

/** Renomeia / troca ícone e cor de uma categoria do usuário. O `slug` NUNCA
 *  muda: é ele que as transações guardam, e mexer nele órfãozaria todas as
 *  compras já classificadas. */
export async function editarCategoria(
  id: string,
  campos: { nome: string; icone: string; cor: string },
): Promise<void> {
  if (!neon) throw new Error('Sem conexão.')
  const { error } = await neon
    .from('categories')
    .update({ nome: campos.nome.trim(), icone: campos.icone, cor: campos.cor })
    .eq('id', id)
  if (error) throw error
}

export async function apagarCategoria(id: string): Promise<void> {
  if (!neon) return
  const { error } = await neon.from('categories').delete().eq('id', id)
  if (error) throw error
}
