import type { FaseAtualizacao, SituacaoFiltro } from '../api/tipos';

/**
 * Filtros avançados da lista de alunos (`docs/planos/filtros-da-lista-de-alunos.md`, 31/10): o que a tela guarda, como
 * vai para o endereço (`/treinador/alunos?acesso=SEM&...`), como vai para a API (`GET /alunos`, parâmetros repetidos), os
 * chips do "Filtrado por" e quais filtros cada permissão vê. Funções puras.
 *
 * No endereço, filtro de várias opções vai numa vírgula só (`acesso=SEM,AGUARDANDO`), como o `etapas` dos Interessados;
 * para a API cada opção vira um parâmetro repetido. Valor desconhecido no endereço é ignorado (link velho ou digitado),
 * nunca vai para a API (lá seria 400).
 */
export type AcessoDoFiltro = 'COM' | 'SEM' | 'AGUARDANDO';
export type FaseDoFiltro = FaseAtualizacao | 'SEM_PASTA';
export type PlanoDoFiltro = 'COM' | 'SEM';
export type RegistroDoFiltro = 'NUNCA' | 'HA_MAIS_DE_7' | 'HA_MAIS_DE_14' | 'HA_MAIS_DE_30';

/** "Meus alunos" no seletor de responsável (o usuário da sessão). */
export const MEUS = 'meus';
/** "Sem responsável" no seletor e na API. */
export const SEM_RESPONSAVEL = 'nenhum';

export interface FiltrosDeAlunos {
  situacao: SituacaoFiltro;
  /** `MEUS`, `SEM_RESPONSAVEL` e ids de membros. Vazio = todos. */
  responsaveis: string[];
  acesso: AcessoDoFiltro[];
  atualizacao: FaseDoFiltro[];
  plano: PlanoDoFiltro | null;
  pastaARenovar: boolean;
  registro: RegistroDoFiltro | null;
}

export type ChaveDoFiltro = 'situacao' | 'responsavel' | 'acesso' | 'atualizacao' | 'plano' | 'pasta' | 'registro';

export const SITUACOES: readonly { valor: SituacaoFiltro; rotulo: string }[] = [
  { valor: 'ATIVO', rotulo: 'Ativos' },
  { valor: 'INATIVO', rotulo: 'Inativos' },
  { valor: 'TODOS', rotulo: 'Todos' },
];
export const ACESSOS: readonly { valor: AcessoDoFiltro; rotulo: string }[] = [
  { valor: 'COM', rotulo: 'Com acesso' },
  { valor: 'SEM', rotulo: 'Sem acesso' },
  { valor: 'AGUARDANDO', rotulo: 'Aguardando o primeiro acesso' },
];
/** Na ordem da lista (Para revisar, Atrasados, Em dia, Sem pasta); os nomes seguem os selos da lista. */
export const FASES: readonly { valor: FaseDoFiltro; rotulo: string }[] = [
  { valor: 'ENVIADA', rotulo: 'Para revisar' },
  { valor: 'ATRASADA', rotulo: 'Atrasada' },
  { valor: 'ABERTA', rotulo: 'Liberada ao aluno' },
  { valor: 'AVISO', rotulo: 'Em até 3 dias' },
  { valor: 'NENHUMA', rotulo: 'Daqui a mais de 3 dias' },
  { valor: 'REVISADA', rotulo: 'Revisada' },
  { valor: 'SEM_PASTA', rotulo: 'Sem pasta com período' },
];
export const PLANOS: readonly { valor: PlanoDoFiltro; rotulo: string }[] = [
  { valor: 'COM', rotulo: 'Com plano em uso' },
  { valor: 'SEM', rotulo: 'Sem plano em uso' },
];
/** "Há mais de N dias" não inclui quem nunca registrou (isso é o "Nunca registrou"), igual à API. */
export const REGISTROS: readonly { valor: RegistroDoFiltro; rotulo: string }[] = [
  { valor: 'NUNCA', rotulo: 'Nunca registrou' },
  { valor: 'HA_MAIS_DE_7', rotulo: 'Há mais de 7 dias' },
  { valor: 'HA_MAIS_DE_14', rotulo: 'Há mais de 14 dias' },
  { valor: 'HA_MAIS_DE_30', rotulo: 'Há mais de 30 dias' },
];

/** Nada filtrado: ativos de todos os responsáveis. É o que o "Limpar filtros" deixa. */
export const SEM_FILTROS: FiltrosDeAlunos = {
  situacao: 'ATIVO', responsaveis: [], acesso: [], atualizacao: [], plano: null, pastaARenovar: false, registro: null,
};

/** O que cada permissão libera; sem ela o filtro some (a API daria 403). Situação, responsável e acesso valem para todos. */
export interface PermissoesDosFiltros {
  /** `ATUALIZACAO_LER` + `ALUNO_SENSIVEL_LER`. */
  atualizacao: boolean;
  /** `TREINO_LER`: plano em uso e pasta a renovar. */
  treino: boolean;
  /** `REGISTRO_LER`: último registro. */
  registro: boolean;
}

export function permissoesDosFiltros(pode: (codigo: string) => boolean): PermissoesDosFiltros {
  return {
    atualizacao: pode('ATUALIZACAO_LER') && pode('ALUNO_SENSIVEL_LER'),
    treino: pode('TREINO_LER'),
    registro: pode('REGISTRO_LER'),
  };
}

/** Os filtros do painel, na ordem em que aparecem. */
export function filtrosVisiveis(p: PermissoesDosFiltros): ChaveDoFiltro[] {
  return [
    'situacao', 'responsavel', 'acesso',
    ...(p.atualizacao ? ['atualizacao' as const] : []),
    ...(p.treino ? ['plano' as const, 'pasta' as const] : []),
    ...(p.registro ? ['registro' as const] : []),
  ];
}

/** Tira o que a pessoa não pode filtrar (o endereço pode ter vindo de outra pessoa ou de outro perfil). */
export function semOQueNaoPode(f: FiltrosDeAlunos, p: PermissoesDosFiltros): FiltrosDeAlunos {
  return {
    ...f,
    atualizacao: p.atualizacao ? f.atualizacao : [],
    plano: p.treino ? f.plano : null,
    pastaARenovar: p.treino ? f.pastaARenovar : false,
    registro: p.registro ? f.registro : null,
  };
}

type Parametro = string | string[] | undefined;

function lista(valor: Parametro): string[] {
  const partes = (Array.isArray(valor) ? valor : valor ? [valor] : []).flatMap((v) => v.split(','));
  return partes.map((v) => v.trim()).filter(Boolean);
}

function validos<T extends string>(valor: Parametro, opcoes: readonly { valor: T }[]): T[] {
  const aceitos = new Set<string>(opcoes.map((o) => o.valor));
  return [...new Set(lista(valor).map((v) => v.toUpperCase()).filter((v) => aceitos.has(v)))] as T[];
}

function um<T extends string>(valor: Parametro, opcoes: readonly { valor: T }[]): T | null {
  return validos(valor, opcoes)[0] ?? null;
}

const ehId = (v: string) => /^[0-9a-z-]{8,64}$/i.test(v);

/** Todas as chaves que os filtros usam no endereço (para tirar as que saíram). */
export const CHAVES_DO_ENDERECO = ['situacao', 'meus', 'responsavel', 'acesso', 'atualizacao', 'plano', 'pasta', 'registro'] as const;

export interface ParametrosDoEndereco {
  situacao?: Parametro;
  meus?: Parametro;
  responsavel?: Parametro;
  acesso?: Parametro;
  atualizacao?: Parametro;
  plano?: Parametro;
  pasta?: Parametro;
  registro?: Parametro;
}

/**
 * Lê o endereço. Responsável: `meus=true` = Meus; `meus=false` = todos (o jeito de dizer "todos" a quem começa em Meus);
 * `responsavel=` = as pessoas e/ou `nenhum`; nada disso = o padrão do perfil (`comecaEmMeus`: quem não tem acesso total
 * abre a lista nos seus, como antes).
 */
export function lerDoEndereco(q: ParametrosDoEndereco, comecaEmMeus: boolean): FiltrosDeAlunos {
  const meus = lista(q.meus)[0];
  const pessoas = lista(q.responsavel).filter((v) => v.toLowerCase() === SEM_RESPONSAVEL || v.toLowerCase() === MEUS || ehId(v))
    .map((v) => (v.toLowerCase() === SEM_RESPONSAVEL || v.toLowerCase() === MEUS ? v.toLowerCase() : v));
  const responsaveis = meus === 'true' ? [MEUS] : meus === 'false' ? [] : pessoas.length ? [...new Set(pessoas)] : comecaEmMeus ? [MEUS] : [];
  return {
    situacao: um(q.situacao, SITUACOES) ?? 'ATIVO',
    responsaveis,
    acesso: validos(q.acesso, ACESSOS),
    atualizacao: validos(q.atualizacao, FASES),
    plano: um(q.plano, PLANOS),
    pastaARenovar: lista(q.pasta).some((v) => v.toUpperCase() === 'A_RENOVAR'),
    registro: um(q.registro, REGISTROS),
  };
}

/**
 * Os parâmetros do endereço (para `router.replace`). Só o que muda do padrão; o responsável segue a regra de
 * {@link lerDoEndereco} (só Meus = `meus=true`; todos, para quem começa em Meus = `meus=false`).
 */
export function paraEndereco(f: FiltrosDeAlunos, comecaEmMeus: boolean): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.situacao !== 'ATIVO') q.situacao = f.situacao;
  const soMeus = f.responsaveis.length === 1 && f.responsaveis[0] === MEUS;
  if (soMeus) {
    if (!comecaEmMeus) q.meus = 'true';
  } else if (f.responsaveis.length) {
    q.responsavel = f.responsaveis.join(',');
  } else if (comecaEmMeus) {
    q.meus = 'false';
  }
  if (f.acesso.length) q.acesso = f.acesso.join(',');
  if (f.atualizacao.length) q.atualizacao = f.atualizacao.join(',');
  if (f.plano) q.plano = f.plano;
  if (f.pastaARenovar) q.pasta = 'A_RENOVAR';
  if (f.registro) q.registro = f.registro;
  return q;
}

/**
 * Parâmetros de `GET /alunos` (sem busca nem página). Só Meus vai como `meus=true`; Meus junto de outras pessoas vira o
 * id do usuário em `responsavel` (a API recusa `meus` com `responsavel`). Sem o id do usuário, "Meus" é ignorado.
 */
export function pedidoDaApi(f: FiltrosDeAlunos, usuarioId: string | null | undefined): [string, string][] {
  const q: [string, string][] = [['situacao', f.situacao]];
  const soMeus = f.responsaveis.length === 1 && f.responsaveis[0] === MEUS;
  if (soMeus) {
    q.push(['meus', 'true']);
  } else {
    q.push(['meus', 'false']);
    for (const r of f.responsaveis) {
      if (r === MEUS) {
        if (usuarioId) q.push(['responsavel', usuarioId]);
      } else {
        q.push(['responsavel', r]);
      }
    }
  }
  for (const a of f.acesso) q.push(['acesso', a]);
  for (const a of f.atualizacao) q.push(['atualizacao', a]);
  if (f.plano) q.push(['plano', f.plano]);
  if (f.pastaARenovar) q.push(['pasta', 'A_RENOVAR']);
  if (f.registro) q.push(['registro', f.registro]);
  return q;
}

/** Chave estável dos filtros (para recarregar a lista quando mudam). */
export function chaveDosFiltros(f: FiltrosDeAlunos): string {
  return JSON.stringify([f.situacao, [...f.responsaveis].sort(), [...f.acesso].sort(), [...f.atualizacao].sort(), f.plano, f.pastaARenovar, f.registro]);
}

export interface ChipDeFiltro {
  chave: ChaveDoFiltro;
  /** "Acesso: Sem acesso, Aguardando o primeiro acesso". */
  texto: string;
}

const rotulos = <T extends string>(valores: readonly T[], opcoes: readonly { valor: T; rotulo: string }[]) =>
  opcoes.filter((o) => valores.includes(o.valor)).map((o) => o.rotulo).join(', ');

/** Rótulo de um responsável marcado: "Meus alunos", "Sem responsável" ou o nome (sem nome conhecido, "Outro membro"). */
export function rotuloDoResponsavel(valor: string, nomeDe: (id: string) => string | null): string {
  if (valor === MEUS) return 'Meus alunos';
  if (valor === SEM_RESPONSAVEL) return 'Sem responsável';
  return nomeDe(valor) ?? 'Outro membro';
}

/** Um chip por filtro ligado, na ordem do painel. A busca fica de fora (tem o próprio campo). */
export function chipsDosFiltros(f: FiltrosDeAlunos, nomeDe: (id: string) => string | null = () => null): ChipDeFiltro[] {
  const chips: ChipDeFiltro[] = [];
  if (f.situacao !== 'ATIVO') chips.push({ chave: 'situacao', texto: `Situação: ${rotulos([f.situacao], SITUACOES)}` });
  if (f.responsaveis.length) {
    const ordem = [MEUS, ...f.responsaveis.filter((r) => r !== MEUS && r !== SEM_RESPONSAVEL), SEM_RESPONSAVEL].filter((r) => f.responsaveis.includes(r));
    chips.push({ chave: 'responsavel', texto: `Responsável: ${ordem.map((r) => rotuloDoResponsavel(r, nomeDe)).join(', ')}` });
  }
  if (f.acesso.length) chips.push({ chave: 'acesso', texto: `Acesso: ${rotulos(f.acesso, ACESSOS)}` });
  if (f.atualizacao.length) chips.push({ chave: 'atualizacao', texto: `Atualização: ${rotulos(f.atualizacao, FASES)}` });
  if (f.plano) chips.push({ chave: 'plano', texto: `Plano: ${rotulos([f.plano], PLANOS)}` });
  if (f.pastaARenovar) chips.push({ chave: 'pasta', texto: 'Pasta a renovar' });
  if (f.registro) chips.push({ chave: 'registro', texto: `Último registro: ${rotulos([f.registro], REGISTROS)}` });
  return chips;
}

/** Quantos filtros estão ligados (o número do botão "Filtros"). */
export function quantosFiltros(f: FiltrosDeAlunos): number {
  return chipsDosFiltros(f).length;
}

/** Tira um filtro (o ✕ do chip): volta ao valor de "nada filtrado". */
export function semOFiltro(f: FiltrosDeAlunos, chave: ChaveDoFiltro): FiltrosDeAlunos {
  switch (chave) {
    case 'situacao': return { ...f, situacao: SEM_FILTROS.situacao };
    case 'responsavel': return { ...f, responsaveis: [] };
    case 'acesso': return { ...f, acesso: [] };
    case 'atualizacao': return { ...f, atualizacao: [] };
    case 'plano': return { ...f, plano: null };
    case 'pasta': return { ...f, pastaARenovar: false };
    case 'registro': return { ...f, registro: null };
  }
}

/** Opções do seletor de responsável: Meus alunos, as outras pessoas da equipe (por nome) e Sem responsável. */
export function opcoesDeResponsavel(pessoas: readonly { id: string; nome: string }[], usuarioId: string | null | undefined) {
  const outras = pessoas.filter((p) => p.id !== usuarioId).map((p) => ({ valor: p.id, rotulo: p.nome }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return [{ valor: MEUS, rotulo: 'Meus alunos' }, ...outras, { valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }];
}

/** Há filtro ligado além da busca? (texto do estado vazio). */
export const temFiltro = (f: FiltrosDeAlunos) => quantosFiltros(f) > 0;
