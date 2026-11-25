import type { TagDeAluno } from '../api/tipos';
import { resumoDasTagsNaLinha } from './tagsDeAluno';

/**
 * Selos de exceção da linha da lista de alunos, na ordem em que aparecem (primeiro a situação, depois as tags). O texto diz
 * **o que** está vencido: a única fonte do atraso é `GET /financeiro/alunos-em-atraso` (cobrança aberta vencida), então é
 * "Cobrança vencida"; "Vencida" sozinho podia ser a pasta ou o plano. Pasta e plano não têm selo na lista (a atualização
 * atrasada já tem o seu, na coluna "Atualização").
 */
export interface SeloDeExcecao { texto: string; tipo: 'perigo' | 'neutro' }

export const TEXTO_DA_COBRANCA_VENCIDA = 'Cobrança vencida';

export function selosDeExcecaoDoAluno(a: { ativo: boolean; temAcesso: boolean; emAtraso: boolean }): SeloDeExcecao[] {
  return [
    ...(a.emAtraso ? [{ texto: TEXTO_DA_COBRANCA_VENCIDA, tipo: 'perigo' as const }] : []),
    ...(!a.ativo ? [{ texto: 'Inativo', tipo: 'neutro' as const }] : []),
    ...(a.ativo && !a.temAcesso ? [{ texto: 'Sem acesso', tipo: 'neutro' as const }] : []),
  ];
}

/** As tags que não cabem na linha (as duas primeiras ficam visíveis, o resto vira "+N"). */
export function tagsEscondidasDaLinha(tags: readonly TagDeAluno[]): TagDeAluno[] {
  return tags.slice(resumoDasTagsNaLinha(tags).visiveis.length);
}

/** Nome acessível do "+N": "Mais 2 tags: Presencial, Avançado"; sem tags escondidas, `null`. */
export function rotuloDoMaisTags(tags: readonly TagDeAluno[]): string | null {
  const escondidas = tagsEscondidasDaLinha(tags);
  if (!escondidas.length) return null;
  return `Mais ${escondidas.length} ${escondidas.length === 1 ? 'tag' : 'tags'}: ${escondidas.map((t) => t.nome).join(', ')}`;
}

/** Texto do tooltip do "+N" (`title` na web, reforço do mouse): uma tag por linha. */
export function dicaDoMaisTags(tags: readonly TagDeAluno[]): string | null {
  const escondidas = tagsEscondidasDaLinha(tags);
  return escondidas.length ? escondidas.map((t) => t.nome).join('\n') : null;
}

/** Retângulo em px: `x` e `y` relativos a quem mede (a linha ou a janela). */
export interface Retangulo { x: number; y: number; w: number; h: number }

/**
 * Área de acerto do botão "+N" por cima do desenho (que fica dentro do link da linha): centrada nele, com pelo menos
 * `minimo` (44) de lado e 4 px de folga dos lados do desenho. Desenho sem tamanho (ainda não medido) = `null`.
 */
export function alvoDoMaisTags(desenho: Retangulo, minimo = 44): Retangulo | null {
  if (desenho.w <= 0 || desenho.h <= 0) return null;
  const w = Math.max(minimo, desenho.w + 8);
  const h = Math.max(minimo, desenho.h);
  return { x: Math.round(desenho.x + (desenho.w - w) / 2), y: Math.round(desenho.y + (desenho.h - h) / 2), w: Math.round(w), h: Math.round(h) };
}

/**
 * Onde abre a lista das outras tags: embaixo do "+N", alinhada pela esquerda dele; sem espaço embaixo, em cima; e nunca
 * fora da janela (`folga` das bordas). `altura` 0 (ainda não medida) abre embaixo.
 */
export function lugarDaListaDeTags(ancora: Retangulo, lista: { largura: number; altura: number },
  janela: { largura: number; altura: number }, folga = 16, vao = 4): { esquerda: number; topo: number } {
  const esquerda = Math.max(folga, Math.min(ancora.x, janela.largura - folga - lista.largura));
  const embaixo = ancora.y + ancora.h + vao;
  const emCima = ancora.y - vao - lista.altura;
  const topo = embaixo + lista.altura <= janela.altura - folga ? embaixo
    : emCima >= folga ? emCima
      : Math.max(folga, janela.altura - folga - lista.altura);
  return { esquerda, topo };
}
