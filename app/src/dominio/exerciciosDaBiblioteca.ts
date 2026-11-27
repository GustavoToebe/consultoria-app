import type { Exercicio, Modalidade, TipoDeCardio } from '../api/tipos';
import type { ChaveDeIdentificacao } from '../tema/tokens';
import { TIPOS_DE_CARDIO } from './cardio';
import { chipDeUmaOpcao, chipDeVarias } from './filtrosDaBiblioteca';
import { inteiroComMilhar } from './formatos';
import { MODALIDADES } from './modalidades';
import { filtrarOpcoes } from './selecaoMultiplaSuspensa';
import { semAcento } from './telas';
import { coincideComBuscaExercicio } from './termosExerciciosIngles';

/**
 * Biblioteca › Exercícios: cor da modalidade, o que o exercício tem (vídeo, imagem) e os filtros da aba. Funções puras.
 *
 * Cor por MODALIDADE (24/11): uma das cinco de identificação (categoria, nunca situação), só no marcador; o texto fica
 * neutro. A ordem segue `MODALIDADES`. "Outro" não tem cor própria: usa o neutro. Azul e índigo são os mais parecidos
 * entre si, então o índigo fica com o Elástico (o menos comum) e as mais usadas ficam com as cores mais distantes.
 */
export const COR_DA_MODALIDADE: Readonly<Record<Modalidade, ChaveDeIdentificacao | null>> = {
  LIVRE: 'CIANO',
  MAQUINA: 'AZUL',
  ELASTICO: 'INDIGO',
  PESO_CORPORAL: 'VIOLETA',
  CARDIO: 'MAGENTA',
  OUTRO: null,
};

/** As modalidades na ordem da tela (a de `MODALIDADES`). */
export const ORDEM_DAS_MODALIDADES = Object.keys(COR_DA_MODALIDADE) as Modalidade[];

export const nomeDaModalidade = (m: Modalidade): string => MODALIDADES[m] ?? m;

/** As modalidades que aparecem na lista, sem repetir, na ordem da tela (a legenda nunca mostra uma que não está ali). */
export function modalidadesExistentes(lista: readonly Pick<Exercicio, 'modalidade'>[]): Modalidade[] {
  const presentes = new Set(lista.map((e) => e.modalidade));
  return ORDEM_DAS_MODALIDADES.filter((m) => presentes.has(m));
}

export const temVideo = (e: Pick<Exercicio, 'videoUrl'>): boolean => !!e.videoUrl?.trim();
/** Imagem própria ou foto do catálogo: o que a miniatura da lista mostra. */
export const temImagem = (e: Pick<Exercicio, 'imagemPropriaEm' | 'imagens'>): boolean => e.imagemPropriaEm !== null || e.imagens.length > 0;

/** "Escada" (o rótulo do tipo de cardio da Biblioteca); nulo sem tipo ou com código desconhecido. */
export const rotuloDoTipoDeCardio = (t: TipoDeCardio | null | undefined): string | null => TIPOS_DE_CARDIO.find((x) => x.codigo === t)?.rotulo ?? null;

type ParaODetalhe = Pick<Exercicio, 'grupoMuscular' | 'equipamento'> & Partial<Pick<Exercicio, 'modalidade' | 'tipoDeCardio'>>;

/**
 * Detalhe da linha depois da modalidade: grupo e equipamento, os que existirem ("Abdômen · Colchonete"). Cardio não tem
 * grupo muscular (D13 de docs/planos/cardio-e-hiit.md): mostra o tipo ("Escada") e, no cardio antigo sem tipo, o
 * equipamento gravado ("Esteira"); o grupo "Cardio" do catálogo só repetiria a modalidade.
 */
export function detalheDoExercicio(e: ParaODetalhe): string {
  if (e.modalidade === 'CARDIO') return rotuloDoTipoDeCardio(e.tipoDeCardio) ?? e.equipamento?.trim() ?? '';
  return [e.grupoMuscular?.trim(), e.equipamento?.trim()].filter(Boolean).join(' · ');
}

export type FiltroDeMidia = 'TODOS' | 'COM' | 'SEM';

export interface FiltrosDeExercicios {
  /** Grupos (OU). Vão para a API. */
  grupos: ReadonlySet<string>;
  /** Modalidades (OU); nenhuma = todas. Vão para a API. */
  modalidades: ReadonlySet<string>;
  video: FiltroDeMidia;
  imagem: FiltroDeMidia;
  /** Tipos de cardio (OU; códigos de `TIPOS_DE_CARDIO`). Só a folha "Escolher cardio" os usa; não vão para a API. */
  tiposDeCardio: ReadonlySet<string>;
}

export const SEM_FILTROS_DE_EXERCICIOS: FiltrosDeExercicios = { grupos: new Set(), modalidades: new Set(), video: 'TODOS', imagem: 'TODOS', tiposDeCardio: new Set() };

const OPCOES_DE_TIPO_DE_CARDIO = TIPOS_DE_CARDIO.map((t) => ({ valor: t.codigo as string, rotulo: t.rotulo }));

export const OPCOES_DE_VIDEO: { valor: FiltroDeMidia; rotulo: string }[] = [
  { valor: 'TODOS', rotulo: 'Todos' }, { valor: 'COM', rotulo: 'Com vídeo' }, { valor: 'SEM', rotulo: 'Sem vídeo' },
];
export const OPCOES_DE_IMAGEM: { valor: FiltroDeMidia; rotulo: string }[] = [
  { valor: 'TODOS', rotulo: 'Todos' }, { valor: 'COM', rotulo: 'Com imagem' }, { valor: 'SEM', rotulo: 'Sem imagem' },
];
export const OPCOES_DE_MODALIDADE: { valor: Modalidade; rotulo: string }[] = ORDEM_DAS_MODALIDADES.map((m) => ({ valor: m, rotulo: nomeDaModalidade(m) }));

export type ChaveDoFiltroDeExercicio = keyof FiltrosDeExercicios;

/** Um chip por filtro ligado, com a chave dele (o ✕ tira só aquele), na ordem do painel. */
export function chipsDosExercicios(f: FiltrosDeExercicios, opcoesDeGrupo: readonly { valor: string; rotulo: string }[]): { chave: ChaveDoFiltroDeExercicio; texto: string }[] {
  return [
    ...chipDeVarias('Grupo muscular', f.grupos, opcoesDeGrupo).map((c) => ({ ...c, chave: 'grupos' as const })),
    ...chipDeVarias('Tipo de cardio', f.tiposDeCardio, OPCOES_DE_TIPO_DE_CARDIO).map((c) => ({ ...c, chave: 'tiposDeCardio' as const })),
    ...chipDeVarias('Modalidade', f.modalidades, OPCOES_DE_MODALIDADE).map((c) => ({ ...c, chave: 'modalidades' as const })),
    ...chipDeUmaOpcao('Vídeo', f.video, 'TODOS', OPCOES_DE_VIDEO).map((c) => ({ ...c, chave: 'video' as const })),
    ...chipDeUmaOpcao('Imagem', f.imagem, 'TODOS', OPCOES_DE_IMAGEM).map((c) => ({ ...c, chave: 'imagem' as const })),
  ];
}

/** Tira um filtro só (o ✕ do chip, que devolve a chave como texto); chave desconhecida não muda nada. */
export function semOFiltro(f: FiltrosDeExercicios, chave: string): FiltrosDeExercicios {
  switch (chave) {
    case 'grupos': return { ...f, grupos: new Set() };
    case 'modalidades': return { ...f, modalidades: new Set() };
    case 'video': return { ...f, video: 'TODOS' };
    case 'imagem': return { ...f, imagem: 'TODOS' };
    case 'tiposDeCardio': return { ...f, tiposDeCardio: new Set() };
    default: return f;
  }
}

/** Vídeo e Imagem no painel, em segmento: o nome do grupo ("Vídeo") já está no rótulo acima, o chip continua "Com vídeo". */
export const OPCOES_CURTAS_DE_MIDIA: { valor: FiltroDeMidia; rotulo: string }[] = [
  { valor: 'TODOS', rotulo: 'Todos' }, { valor: 'COM', rotulo: 'Com' }, { valor: 'SEM', rotulo: 'Sem' },
];

const passaNaMidia = (filtro: FiltroDeMidia, tem: boolean): boolean => filtro === 'TODOS' || (filtro === 'COM') === tem;

/**
 * O exercício passa nos filtros do painel: grupos (OU, nome sem espaço nas pontas), modalidades (OU), vídeo e imagem; tudo
 * em E. A mesma regra da API (`BibliotecaService.paginaDeExercicios`), para a folha "Escolher exercício" filtrar a lista
 * que já tem e para o "Mostrar N exercícios" do painel contar sem ir ao servidor.
 */
export function passaNosFiltros(
  e: Pick<Exercicio, 'grupoMuscular' | 'modalidade' | 'videoUrl' | 'imagemPropriaEm' | 'imagens'> & Partial<Pick<Exercicio, 'tipoDeCardio'>>, f: FiltrosDeExercicios,
): boolean {
  return (f.grupos.size === 0 || f.grupos.has(e.grupoMuscular?.trim() ?? ''))
    && (f.tiposDeCardio.size === 0 || f.tiposDeCardio.has(e.tipoDeCardio ?? ''))
    && (f.modalidades.size === 0 || f.modalidades.has(e.modalidade))
    && passaNaMidia(f.video, temVideo(e))
    && passaNaMidia(f.imagem, temImagem(e));
}

/**
 * Busca da folha e do painel: nome, grupo e equipamento, sem acento, com os termos em inglês (`coincideComBuscaExercicio`).
 * `comTipo` (só a folha "Escolher exercício", que filtra a lista que já tem) junta o tipo de cardio: "escada" acha o cardio
 * do tipo Escada, que não tem grupo nem equipamento. A Biblioteca não o passa: ali a contagem imita a busca do servidor,
 * que não procura pelo tipo.
 */
export function coincideComABusca(
  e: Pick<Exercicio, 'nome' | 'grupoMuscular' | 'equipamento'> & Partial<Pick<Exercicio, 'tipoDeCardio'>>, busca: string, comTipo = false,
): boolean {
  const termo = semAcento(busca);
  const tipo = comTipo ? rotuloDoTipoDeCardio(e.tipoDeCardio) ?? '' : '';
  return !termo || coincideComBuscaExercicio(semAcento(`${e.nome} ${e.grupoMuscular ?? ''} ${e.equipamento ?? ''} ${tipo}`), termo);
}

export interface OpcaoDeGrupo { valor: string; rotulo: string; contagem: number }

/**
 * Os grupos do painel com quantos exercícios cada um tem ("Peito 18"), em ordem alfabética do português. A contagem é sobre
 * a lista inteira (a biblioteca, ou o que a folha oferece), sem os outros filtros: o número de um chip não pula enquanto se
 * marca outro filtro (o resultado da combinação está no "Mostrar N exercícios"). Sem grupo não vira opção.
 */
export function contagemDosGrupos(lista: readonly Pick<Exercicio, 'grupoMuscular'>[]): OpcaoDeGrupo[] {
  const contagem = new Map<string, number>();
  for (const e of lista) {
    const g = e.grupoMuscular?.trim();
    if (g) contagem.set(g, (contagem.get(g) ?? 0) + 1);
  }
  return [...contagem].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([g, n]) => ({ valor: g, rotulo: g, contagem: n }));
}

/**
 * Os tipos de cardio do painel da folha "Escolher cardio", com quantos cardios cada um tem ("Escada 2"), na ordem de
 * `TIPOS_DE_CARDIO`. Como os grupos: a contagem é sobre a lista inteira e cardio sem tipo não vira opção.
 */
export function contagemDosTipos(lista: readonly Partial<Pick<Exercicio, 'tipoDeCardio'>>[]): OpcaoDeGrupo[] {
  return TIPOS_DE_CARDIO.map((t) => ({ valor: t.codigo as string, rotulo: t.rotulo, contagem: lista.filter((e) => e.tipoDeCardio === t.codigo).length }))
    .filter((o) => o.contagem > 0);
}

/** Acima de tantos grupos o painel ganha a busca "Buscar grupo" no topo dos chips. */
export const GRUPOS_SEM_BUSCA = 12;

/** Os chips de grupo à vista com a busca: os que casam com o texto e, sempre, os marcados (dá para desmarcar sem apagar a busca). */
export function gruposDaBusca(opcoes: readonly OpcaoDeGrupo[], busca: string, marcados: ReadonlySet<string>): OpcaoDeGrupo[] {
  const casam = new Set(filtrarOpcoes(opcoes, busca).map((o) => o.valor));
  return opcoes.filter((o) => casam.has(o.valor) || marcados.has(o.valor));
}

/**
 * O botão principal do painel: "Mostrar 18 exercícios" (`null` = a contagem ainda não chegou ou falhou: sem número). Na
 * folha "Escolher cardio", "Mostrar 3 cardios".
 */
export function rotuloDoMostrar(quantos: number | null, cardio = false): string {
  const [um, varios] = cardio ? ['cardio', 'cardios'] : ['exercício', 'exercícios'];
  if (quantos === null) return `Mostrar ${varios}`;
  return quantos === 1 ? `Mostrar 1 ${um}` : `Mostrar ${inteiroComMilhar(quantos)} ${varios}`;
}

/** Vídeo ou imagem do filtro no formato da API: `COM` = `true`, `SEM` = `false`, `TODOS` = ausente (não filtra). */
export const midiaParaApi = (f: FiltroDeMidia): boolean | undefined => (f === 'TODOS' ? undefined : f === 'COM');

/**
 * Opções do filtro Modalidade: as que a biblioteca tem (`modalidades` da resposta) na ordem da tela, mais as marcadas que
 * sumiram dela, para dar para desmarcar.
 */
export const opcoesDeModalidade = (existentes: readonly string[], marcadas: ReadonlySet<string>): { valor: Modalidade; rotulo: string }[] =>
  OPCOES_DE_MODALIDADE.filter((o) => existentes.includes(o.valor) || marcadas.has(o.valor));
