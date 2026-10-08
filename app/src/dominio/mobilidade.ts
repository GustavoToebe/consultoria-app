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
  return c.secoes.length > 0 && c.secoes.every((s) => s.itens.every((i) => i.nome.trim() && (!i.videoUrl.trim() || videoValido(i.videoUrl))));
}
