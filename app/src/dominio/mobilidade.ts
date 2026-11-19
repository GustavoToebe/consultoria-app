import type { ConteudoMobilidadeApi, VersaoDetalhe } from '../api/tipos';
import { moverPara } from './reordenar';
import { novoUid } from './uid';
import { videoValido } from './video';

/** Modelo de mobilidade e alongamento: seções com itens (nome, prescrição em texto e link do vídeo). */
export interface ItemMobilidade { uid: string; nome: string; prescricao: string; videoUrl: string }
export interface SecaoMobilidade { uid: string; titulo: string; itens: ItemMobilidade[] }
export interface ConteudoMobilidade { orientacoes: string; secoes: SecaoMobilidade[] }

export const novoItemMobilidade = (): ItemMobilidade => ({ uid: novoUid(), nome: '', prescricao: '', videoUrl: '' });
export const novaSecaoMobilidade = (titulo = ''): SecaoMobilidade => ({ uid: novoUid(), titulo, itens: [novoItemMobilidade()] });

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

interface SecaoApi { uid?: unknown; titulo?: unknown; itens?: unknown }
interface ItemApi { uid?: unknown; nome?: unknown; prescricao?: unknown; videoUrl?: unknown }

/** Conteúdo vindo da API (campos nulos) para o formato do editor. */
export function normalizarMobilidade(conteudo: unknown): ConteudoMobilidade {
  const c = (conteudo ?? {}) as { orientacoes?: unknown; secoes?: unknown };
  const secoes = Array.isArray(c.secoes) ? (c.secoes as SecaoApi[]) : [];
  return {
    orientacoes: texto(c.orientacoes),
    secoes: secoes.length
      ? secoes.map((s) => ({
          uid: texto(s.uid) || novoUid(),
          titulo: texto(s.titulo),
          itens: (Array.isArray(s.itens) ? (s.itens as ItemApi[]) : []).map((i) => ({
            uid: texto(i.uid) || novoUid(),
            nome: texto(i.nome),
            prescricao: texto(i.prescricao),
            videoUrl: texto(i.videoUrl),
          })),
        }))
      : [novaSecaoMobilidade()],
  };
}

/**
 * "Usar modelo de mobilidade" no plano do aluno: troca as seções pelas do modelo, com uids novos (como a semana de treino e o
 * modelo de dieta); as orientações do plano ficam.
 */
export function aplicarModeloDeMobilidade(atual: ConteudoMobilidade, modelo: unknown): ConteudoMobilidade {
  const secoes = normalizarMobilidade(modelo).secoes.map((s) => ({ ...s, uid: novoUid(), itens: s.itens.map((i) => ({ ...i, uid: novoUid() })) }));
  return { ...atual, secoes };
}

/** Pronto para a API: texto aparado e vazio vira nulo. */
export function mobilidadeParaApi(c: ConteudoMobilidade) {
  const ou = (v: string) => v.trim() || null;
  return {
    orientacoes: ou(c.orientacoes),
    secoes: c.secoes.map((s) => ({
      uid: s.uid,
      titulo: ou(s.titulo),
      itens: s.itens.map((i) => ({ uid: i.uid, nome: i.nome.trim(), prescricao: ou(i.prescricao), videoUrl: ou(i.videoUrl) })),
    })),
  };
}

/** Pode salvar: toda seção tem item, todo item tem nome e o link (se houver) é do YouTube. */
export function mobilidadeValida(c: ConteudoMobilidade): boolean {
  return c.secoes.length > 0 && c.secoes.every(secaoValida);
}

/** A parte de `mobilidadeValida` de uma seção (o selo "Corrigir" da lista de seções em duas colunas). */
export function secaoValida(s: SecaoMobilidade): boolean {
  return s.itens.length > 0 && s.itens.every((i) => !!i.nome.trim() && (!i.videoUrl.trim() || videoValido(i.videoUrl)));
}

/** "3 itens: Gato-vaca, Lunge…" na lista de seções; sem item, "Nenhum item". */
export function resumoDaSecao(sec: SecaoMobilidade): string {
  if (sec.itens.length === 0) return 'Nenhum item';
  const nomes = sec.itens.map((i) => i.nome.trim()).filter(Boolean).join(', ');
  return `${sec.itens.length} ${sec.itens.length === 1 ? 'item' : 'itens'}${nomes ? `: ${nomes}` : ''}`;
}

/**
 * Editor no padrão do treino e da dieta (19/11): o vídeo do item é um campo vazio, uma linha compacta "Vídeo adicionado"
 * (link do YouTube) ou o campo com o aviso de link inválido. A regra do link é a de sempre (`videoValido`).
 */
export type EstadoDoVideo = 'vazio' | 'valido' | 'invalido';
export const estadoDoVideo = (url: string): EstadoDoVideo => (!url.trim() ? 'vazio' : videoValido(url) ? 'valido' : 'invalido');
export const TEXTO_DO_VIDEO_ADICIONADO = 'Vídeo adicionado';
export const AVISO_DO_LINK_INVALIDO = 'Link do YouTube inválido';

/** Excluir seção pede confirmação só quando leva itens junto (a vazia sai direto, com Desfazer). */
export const excluirSecaoPedeConfirmacao = (s: SecaoMobilidade): boolean => s.itens.length > 0;

/** Orientações recolhidas: "(vazio)" ou o começo do texto numa linha (até `limite` caracteres, com reticências). */
export function resumoDasOrientacoes(texto: string, limite = 80): string {
  const linha = texto.replace(/\s+/g, ' ').trim();
  if (!linha) return '(vazio)';
  return linha.length > limite ? `${linha.slice(0, limite - 1).trimEnd()}…` : linha;
}

/** Leva a seção de `de` para `para` (arrastar pela alça e "Mover para cima/baixo" do ⋯). */
export const moverSecao = (c: ConteudoMobilidade, de: number, para: number): ConteudoMobilidade => ({ ...c, secoes: moverPara(c.secoes, de, para) });

/** O mesmo para o item dentro da seção `si`. */
export function moverItem(c: ConteudoMobilidade, si: number, de: number, para: number): ConteudoMobilidade {
  return { ...c, secoes: c.secoes.map((s, i) => (i === si ? { ...s, itens: moverPara(s.itens, de, para) } : s)) };
}

/** Tira o item `ii` da seção `si`. */
export function removerItem(c: ConteudoMobilidade, si: number, ii: number): ConteudoMobilidade {
  return { ...c, secoes: c.secoes.map((s, i) => (i === si ? { ...s, itens: s.itens.filter((_, j) => j !== ii) } : s)) };
}

/** Item vazio no fim da seção `si`; devolve o uid dele para a tela levar o foco ao Nome. */
export function adicionarItem(c: ConteudoMobilidade, si: number): { conteudo: ConteudoMobilidade; uid: string } {
  const novo = novoItemMobilidade();
  return { conteudo: { ...c, secoes: c.secoes.map((s, i) => (i === si ? { ...s, itens: [...s.itens, novo] } : s)) }, uid: novo.uid };
}

type VersaoMobilidade = VersaoDetalhe<ConteudoMobilidadeApi>;

/** O que a tela mostra: com pasta escolhida, a mobilidade dela (ou nada); senão, a vigente do aparelho. */
export function mobilidadeParaExibir(vigente: VersaoMobilidade | null, escolhida: { mobilidade?: VersaoMobilidade | null } | null): VersaoMobilidade | null {
  return escolhida ? escolhida.mobilidade ?? null : vigente;
}

/** Recurso que não existe não aparece: a aba só entra quando há mobilidade publicada para mostrar. */
export function temAbaMobilidade(vigente: VersaoMobilidade | null, escolhida: { mobilidade?: VersaoMobilidade | null } | null): boolean {
  return !!vigente || !!escolhida?.mobilidade;
}

/** Item como a tela mostra: prescrição ausente é "—" e o vídeo só existe se o link for do YouTube. */
export function itemParaTela(i: ConteudoMobilidadeApi['secoes'][number]['itens'][number]): { nome: string; prescricao: string; video: string | null } {
  return { nome: i.nome, prescricao: i.prescricao?.trim() || '—', video: videoValido(i.videoUrl) ? i.videoUrl!.trim() : null };
}
