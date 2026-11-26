import type { PermissaoEquipe } from '../api/equipeTipos';
import { semAcento } from './telas';
import { completarPermissoes, desmarcarPermissoes, exigidaPor } from './perfilEquipe';

/**
 * Editor de perfil em matriz (plano `docs/planos/permissoes-em-matriz.md`): o catálogo da API (`GET /permissoes/catalogo`,
 * seção › módulo › descrição) vira seção › recurso (linha) × ação (coluna). A coluna sai do sufixo do código (`_LER`/`_VER`
 * = Ver, `_ALTERAR` = Criar e editar, `_PUBLICAR` = Publicar); o resto vai para "Outras" com o nome à vista (o verbo antes
 * dos dois-pontos da descrição). A descrição inteira vira a dica da caixa. Código novo da API nunca some: sem lugar livre
 * na linha, cai em "Outras". A lista enviada ao servidor continua a mesma `string[]` de códigos.
 */
export type Coluna = 'ver' | 'editar' | 'publicar' | 'outras';
type ColunaFixa = Exclude<Coluna, 'outras'>;

export const COLUNAS: readonly { chave: Coluna; rotulo: string }[] = [
  { chave: 'ver', rotulo: 'Ver' },
  { chave: 'editar', rotulo: 'Criar e editar' },
  { chave: 'publicar', rotulo: 'Publicar' },
  { chave: 'outras', rotulo: 'Outras' },
];
const NOME_DA_COLUNA: Record<ColunaFixa, string> = { ver: 'Ver', editar: 'Criar e editar', publicar: 'Publicar' };
/** Verbos da descrição que só repetem o nome da coluna: a dica não acrescenta nada ("Consultar: cadastro."). */
const VERBOS_DA_COLUNA: Record<ColunaFixa, readonly string[]> = { ver: ['consultar', 'ver'], editar: ['criar e editar'], publicar: ['publicar versoes'] };

/**
 * Onde o catálogo da API não basta. Os ergogênicos dividiriam a linha da Biblioteca (duas caixas em Ver e em Criar e
 * editar); `USUARIO_ALTERAR` e `PERFIL_ALTERAR` dividiriam o Criar e editar da Equipe (a dica de cada um vem da API, que
 * desde 23/11 os distingue: "membros da equipe" e "perfis de acesso").
 */
const AJUSTES: Record<string, { recurso?: string; coluna?: Coluna; nome?: string }> = {
  ERGOGENICO_LER: { recurso: 'Medicação e ergogênicos' },
  ERGOGENICO_ALTERAR: { recurso: 'Medicação e ergogênicos' },
  USUARIO_ALTERAR: { coluna: 'outras', nome: 'Convidar e editar membros' },
  PERFIL_ALTERAR: { coluna: 'outras', nome: 'Criar e editar perfis' },
};

export interface CaixaDaMatriz {
  codigo: string;
  coluna: Coluna;
  /** O que aparece ao lado da caixa em "Outras" e na lista do celular ("Gerar convite", "Ver"). */
  nome: string;
  /** "Treino: criar e editar" (recurso: ação). */
  rotuloAcessivel: string;
  /** A descrição longa do catálogo: dica da caixa, nunca o rótulo. */
  dica: string;
  /** Falso quando a dica só repete o recurso e a coluna ("Consultar: cadastro."): fica só para o leitor de tela. */
  dicaAcrescenta: boolean;
  sensivel: boolean;
}
export interface LinhaDaMatriz {
  recurso: string;
  /** Alguma permissão do recurso é dado sensível. */
  sensivel: boolean;
  /** Selo "Dado sensível" ao lado do nome: sensível e o nome ainda não diz isso ("Dados sensíveis" fica sem). */
  selo: boolean;
  celulas: Record<ColunaFixa, CaixaDaMatriz | null>;
  outras: CaixaDaMatriz[];
}
export interface SecaoDaMatriz {
  secao: string;
  linhas: LinhaDaMatriz[];
  /** Todos os códigos da seção, também com o filtro (a contagem "N de M" é da seção inteira). */
  codigos: string[];
}

const colunaDoCodigo = (codigo: string): Coluna =>
  /_(LER|VER)$/.test(codigo) ? 'ver' : /_ALTERAR$/.test(codigo) ? 'editar' : /_PUBLICAR$/.test(codigo) ? 'publicar' : 'outras';
const verboDe = (descricao: string) => descricao.split(':')[0].trim();
const minuscula = (texto: string) => texto.charAt(0).toLocaleLowerCase('pt-BR') + texto.slice(1);
const semPonto = (texto: string) => semAcento(texto.replace(/\.\s*$/, ''));

export function montarMatriz(catalogo: readonly PermissaoEquipe[]): SecaoDaMatriz[] {
  const secoes: SecaoDaMatriz[] = [];
  for (const p of catalogo) {
    const ajuste = AJUSTES[p.codigo] ?? {};
    const recurso = ajuste.recurso ?? p.modulo;
    let secao = secoes.find((s) => s.secao === p.secao);
    if (!secao) secoes.push(secao = { secao: p.secao, linhas: [], codigos: [] });
    let linha = secao.linhas.find((l) => l.recurso === recurso);
    if (!linha) secao.linhas.push(linha = { recurso, sensivel: false, selo: false, celulas: { ver: null, editar: null, publicar: null }, outras: [] });
    const pedida = ajuste.coluna ?? colunaDoCodigo(p.codigo);
    const coluna: Coluna = pedida !== 'outras' && linha.celulas[pedida] ? 'outras' : pedida;
    const nome = coluna === 'outras' ? ajuste.nome ?? (verboDe(p.descricao) || p.codigo) : NOME_DA_COLUNA[coluna];
    const dica = p.descricao;
    const verbos = coluna === 'outras' ? [semAcento(nome)] : VERBOS_DA_COLUNA[coluna];
    const repete = verbos.some((v) => semPonto(dica) === `${v}: ${semAcento(recurso)}`);
    const caixa: CaixaDaMatriz = { codigo: p.codigo, coluna, nome, rotuloAcessivel: `${recurso}: ${minuscula(nome)}`, dica, dicaAcrescenta: !repete, sensivel: p.sensivel };
    if (coluna === 'outras') linha.outras.push(caixa); else linha.celulas[coluna] = caixa;
    linha.sensivel ||= p.sensivel;
    linha.selo = linha.sensivel && !/sens[ií]ve/i.test(recurso);
    secao.codigos.push(p.codigo);
  }
  return secoes;
}

/** Nome acessível de cada código ("Treino: publicar"), para o "Necessária para …". */
export function rotulosDaMatriz(secoes: readonly SecaoDaMatriz[]): Map<string, string> {
  const rotulos = new Map<string, string>();
  for (const s of secoes) for (const l of s.linhas) for (const c of [...Object.values(l.celulas), ...l.outras]) if (c) rotulos.set(c.codigo, c.rotuloAcessivel);
  return rotulos;
}

const emLista = (itens: readonly string[]) => itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
export const MOTIVO_DO_TETO = 'Você não tem esta permissão: só quem a tem pode dá-la a um perfil.';

export interface EstadoDaCaixa { marcada: boolean; travada: boolean; motivo: string | null }
/**
 * Travada = não dá para mudar agora: acima do teto de quem edita (a API recusaria) ou marcada porque outra marcada precisa
 * dela ("Necessária para Treino: publicar."). Desmarcar a que depende libera.
 */
export function estadoDaCaixa(codigo: string, marcadas: ReadonlySet<string>, marcavel: boolean, rotulos: ReadonlyMap<string, string>): EstadoDaCaixa {
  const marcada = marcadas.has(codigo);
  if (!marcavel) return { marcada, travada: true, motivo: MOTIVO_DO_TETO };
  // Na ordem do catálogo (a dos rótulos), não na ordem em que foram marcadas.
  const ordem = [...rotulos.keys()];
  const por = marcada ? exigidaPor(codigo, marcadas).sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)) : [];
  return por.length
    ? { marcada, travada: true, motivo: `Necessária para ${emLista(por.map((c) => rotulos.get(c) ?? c))}.` }
    : { marcada, travada: false, motivo: null };
}

export interface EstadoDaSecao { marcadas: number; total: number; valor: boolean | 'misto' }
/** Contagem "N de M" sobre o que quem edita pode atribuir; `valor` é o da caixa "Marcar toda a seção". */
export function estadoDaSecao(codigos: readonly string[], marcadas: ReadonlySet<string>, marcavel: (codigo: string) => boolean): EstadoDaSecao {
  const possiveis = codigos.filter(marcavel);
  const n = possiveis.filter((c) => marcadas.has(c)).length;
  return { marcadas: n, total: possiveis.length, valor: n === 0 ? false : n === possiveis.length ? true : 'misto' };
}

/**
 * "Marcar toda a seção": parcial ou vazia marca tudo o que se pode (e o que isso exige); cheia desmarca, mas o que outra
 * seção ainda exige fica marcado e travado (a seção volta parcial, com o motivo na caixa).
 */
export function alternarSecao(atuais: readonly string[], codigos: readonly string[], marcavel: (codigo: string) => boolean, valor: boolean | 'misto'): string[] {
  const possiveis = codigos.filter(marcavel);
  return valor === true
    ? completarPermissoes(atuais.filter((c) => !possiveis.includes(c)))
    : completarPermissoes([...atuais, ...possiveis]);
}

/** Uma caixa: marcar leva junto o que ela exige; desmarcar só acontece quando nada marcado depende dela. */
export const alternarCaixa = (atuais: readonly string[], codigo: string, valor: boolean) =>
  valor ? completarPermissoes([...atuais, codigo]) : desmarcarPermissoes(atuais, [codigo]);

/** Resumo vivo do topo: "14 permissões · 3 com dado sensível". Só conta códigos do catálogo. */
export function resumoDasPermissoes(marcadas: ReadonlySet<string>, catalogo: readonly PermissaoEquipe[]) {
  const dentro = catalogo.filter((p) => marcadas.has(p.codigo));
  const total = dentro.length;
  const sensiveis = dentro.filter((p) => p.sensivel).length;
  const unidade = total === 1 ? 'permissão' : 'permissões';
  return { total, sensiveis, unidade, texto: `${total} ${unidade} · ${sensiveis} com dado sensível` };
}

/** Filtro sem acento: seção, recurso, nome da ação ou dica (e "dado sensível" nos recursos sensíveis). A seção que casa pelo nome fica inteira. */
export function filtrarMatriz(secoes: readonly SecaoDaMatriz[], termo: string): SecaoDaMatriz[] {
  const t = semAcento(termo);
  if (!t) return [...secoes];
  const casa = (texto: string) => semAcento(texto).includes(t);
  const linhaCasa = (l: LinhaDaMatriz) => casa(l.recurso) || (l.sensivel && semAcento('dado sensível').includes(t)) || [...Object.values(l.celulas), ...l.outras].some((c) => !!c && (casa(c.nome) || casa(c.dica)));
  return secoes
    .map((s) => (casa(s.secao) ? s : { ...s, linhas: s.linhas.filter(linhaCasa) }))
    .filter((s) => s.linhas.length > 0);
}

/** Mudou alguma coisa desde que a folha abriu (a ordem das permissões não conta). */
export function perfilAlterado(inicial: { nome: string; descricao: string; ativo: boolean; permissoes: readonly string[] }, atual: typeof inicial): boolean {
  const ordenar = (l: readonly string[]) => [...l].sort().join(',');
  return inicial.nome !== atual.nome || inicial.descricao !== atual.descricao || inicial.ativo !== atual.ativo || ordenar(inicial.permissoes) !== ordenar(atual.permissoes);
}

/**
 * Arranjo da matriz pela largura medida do corpo da folha (uma regra só, igual para todas as linhas e seções):
 * - `matriz` (tabela) quando cabem a coluna do recurso com o nome mais longo e o selo lado a lado, as três colunas fixas e
 *   o mínimo de "Outras"; abaixo disso, `blocos` (um bloco por recurso, ações em lista);
 * - o selo "Dado sensível" fica ao lado do nome; vai para baixo do nome, em TODOS os recursos, só quando o bloco não tem
 *   a largura do nome mais longo com o selo. Nunca um ao lado e outro abaixo por acaso.
 * Medido na tela em 23/11 (Geist 15 seminegrito): "Medicação e ergogênicos" ~190 px + vão 8 + selo ~114 = ~312, com folga
 * = `LARGURA_RECURSO_COM_SELO`. No celular de 390 o bloco tem ~298 px: o selo fica abaixo do nome em todos os recursos.
 */
export const LARGURA_RECURSO_COM_SELO = 320;
/** Larguras das colunas fixas (Ver, Criar e editar, Publicar), as mesmas em todas as seções. */
export const LARGURAS_DAS_COLUNAS = { ver: 64, editar: 104, publicar: 72 } as const;
const COLUNAS_FIXAS = LARGURAS_DAS_COLUNAS.ver + LARGURAS_DAS_COLUNAS.editar + LARGURAS_DAS_COLUNAS.publicar;
const VAOS_DA_LINHA = 4 * 12;
/** "Outras" mínimo; com a barra de rolagem da web, a folha de 900 deixa ~200 px para ela. */
const MINIMO_DE_OUTRAS = 160;
/** Recuo do corpo do cartão da seção (20 px de cada lado no PC). */
const RECUO_DO_CARTAO = 2 * 20;
/** Recuo do cartão (16 px de cada lado no celular) + o do bloco (12 px) + a borda do bloco. */
const RECUO_DO_BLOCO = 2 * 16 + 2 * 12 + 2;
export const LARGURA_MINIMA_DA_MATRIZ = LARGURA_RECURSO_COM_SELO + COLUNAS_FIXAS + VAOS_DA_LINHA + MINIMO_DE_OUTRAS + RECUO_DO_CARTAO;

export function arranjoDaMatriz(larguraDoCorpo: number): { forma: 'matriz' | 'blocos'; seloAbaixo: boolean } {
  if (larguraDoCorpo >= LARGURA_MINIMA_DA_MATRIZ) return { forma: 'matriz', seloAbaixo: false };
  return { forma: 'blocos', seloAbaixo: larguraDoCorpo - RECUO_DO_BLOCO < LARGURA_RECURSO_COM_SELO };
}
