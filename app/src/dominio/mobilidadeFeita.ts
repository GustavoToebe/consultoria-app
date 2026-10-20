import type { ConteudoMobilidadeApi } from '../api/tipos';
import { somarDias } from './formatos';
import { podeRegistrarEm } from './semana';

/** Uma marca de item: o que importa para contar, venha do aparelho ou do servidor. */
export interface MarcaDeMobilidade {
  planoVersaoId: string;
  itemUid: string;
  data: string;
  feito: boolean;
}

/** Marca do aparelho: a que falhou (recusada pelo servidor) não vale como feita na tela. */
export interface MarcaLocalDeMobilidade extends MarcaDeMobilidade {
  secaoUid: string;
  situacao: 'LOCAL' | 'ENVIADO' | 'FALHOU';
}

const chave = (m: Pick<MarcaDeMobilidade, 'planoVersaoId' | 'itemUid' | 'data'>) =>
  `${m.planoVersaoId}|${m.itemUid}|${m.data}`;

/**
 * Marcas que a tela usa: as do aparelho e as que o servidor já tem. Na mesma versão, item e dia, a do aparelho ganha
 * (é a mais recente, ainda pode estar na fila); a que falhou não conta e deixa valer a do servidor, se houver.
 */
export function fundirMarcas<L extends MarcaLocalDeMobilidade>(
  locais: readonly L[],
  doServidor: readonly MarcaDeMobilidade[],
): MarcaDeMobilidade[] {
  const porChave = new Map<string, MarcaDeMobilidade>();
  for (const m of doServidor) porChave.set(chave(m), m);
  for (const m of locais) if (m.situacao !== 'FALHOU') porChave.set(chave(m), m);
  return [...porChave.values()];
}

/** Itens (uids) marcados como feitos naquela versão e dia. */
export function feitosDoDia(marcas: readonly MarcaDeMobilidade[], planoVersaoId: string, data: string): Set<string> {
  const feitos = new Set<string>();
  for (const m of marcas) if (m.feito && m.planoVersaoId === planoVersaoId && m.data === data) feitos.add(m.itemUid);
  return feitos;
}

/** Itens da versão exibida, na ordem das seções. */
export function itensDaMobilidade(conteudo: ConteudoMobilidadeApi): string[] {
  return conteudo.secoes.flatMap((s) => s.itens.map((i) => i.uid));
}

/** "N de M": só conta marca de item que existe na versão (o que sobrou de outra versão não entra). */
export function contagemDoDia(conteudo: ConteudoMobilidadeApi, feitos: ReadonlySet<string>): { feitos: number; total: number } {
  const itens = itensDaMobilidade(conteudo);
  return { feitos: itens.filter((uid) => feitos.has(uid)).length, total: itens.length };
}

/** "Hoje: 2 de 5 feitos" ou, em outra data, "Em 14/10: 2 de 5 feitos" (`dataTexto` já formatada). */
export function textoDaContagem(c: { feitos: number; total: number }, ehHoje: boolean, dataTexto: string): string {
  const quanto = `${c.feitos} de ${c.total} ${c.feitos === 1 && c.total === 1 ? 'feito' : 'feitos'}`;
  return ehHoje ? `Hoje: ${quanto}` : `Em ${dataTexto}: ${quanto}`;
}

/**
 * Datas que o aluno pode marcar: hoje e os 6 dias anteriores,
 * dentro do período da mobilidade e da janela de 60 dias que o servidor aceita. Passado o `fim`, mostra os últimos
 * dias do período. Da mais antiga para a mais nova, como os chips das divisões do treino.
 */
export function datasDaMobilidade(
  periodo: { inicio: string | null; fim: string | null },
  hoje: string,
  quantas = 7,
): string[] {
  const ultima = periodo.fim && periodo.fim < hoje ? periodo.fim : hoje;
  const datas: string[] = [];
  for (let i = quantas - 1; i >= 0; i--) {
    const d = somarDias(ultima, -i);
    if (periodo.inicio && d < periodo.inicio) continue;
    if (!podeRegistrarEm(d, hoje)) continue;
    datas.push(d);
  }
  return datas;
}

/** A data que a tela abre: hoje, se estiver entre as opções, senão a mais recente; nenhuma opção = `null`. */
export function dataInicialDaMobilidade(datas: readonly string[], hoje: string): string | null {
  if (datas.includes(hoje)) return hoje;
  return datas.length ? datas[datas.length - 1] : null;
}

/** Dias distintos com ao menos um item feito dentro do período (inclusive nas pontas). */
export function diasComAlgoFeito(marcas: readonly Pick<MarcaDeMobilidade, 'data' | 'feito'>[], inicio: string, fim: string): number {
  const dias = new Set<string>();
  for (const m of marcas) if (m.feito && m.data >= inicio && m.data <= fim) dias.add(m.data);
  return dias.size;
}

export interface ContagemDaMobilidade {
  naSemana: number;
  naPasta: number;
}

/**
 * Cartão da ficha: dias com algo feito na semana corrida e no período da pasta. `null` = sem mobilidade na pasta (a tela
 * mostra "—"); sem período na pasta só a semana tem sentido, e a pasta fica em zero.
 */
export function contagemDaMobilidadeNoTreinador(
  marcas: readonly MarcaDeMobilidade[],
  semana: { inicio: string; fim: string },
  pasta: { inicio: string | null; fim: string | null } | null,
  temMobilidade: boolean,
): ContagemDaMobilidade | null {
  if (!temMobilidade) return null;
  return {
    naSemana: diasComAlgoFeito(marcas, semana.inicio, semana.fim),
    naPasta: pasta?.inicio && pasta.fim ? diasComAlgoFeito(marcas, pasta.inicio, pasta.fim) : 0,
  };
}

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

/** "—" sem mobilidade, "Nenhum registro" com zero nos dois, senão "N dias com algo feito nesta semana · N na pasta". */
export function textoDaMobilidade(c: ContagemDaMobilidade | null): string {
  if (!c) return '—';
  if (c.naSemana === 0 && c.naPasta === 0) return 'Nenhum registro';
  return `${dias(c.naSemana)} com algo feito nesta semana · ${c.naPasta} na pasta`;
}
