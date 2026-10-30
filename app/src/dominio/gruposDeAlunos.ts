import type { FaseAtualizacao } from '../api/tipos';
import { comMaiuscula, dataRelativa } from './datasRelativas';
import { hojeIso, SEM_DADO } from './formatos';

/**
 * Lista de alunos em grupos (decisão D1 de `docs/planos/telas-do-aluno-visual.md`): Para revisar, Atrasados, Em dia e
 * Sem pasta com período, nessa ordem, só os que têm alunos. Agrupa só a página que veio da API, sem reordenar os itens.
 * Quem não vê atualização (a API manda `atualizacao` nula para todos) recebe um grupo único, sem tom.
 */
export type TomDoGrupo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';
export type ChaveDoGrupo = 'PARA_REVISAR' | 'ATRASADOS' | 'EM_DIA' | 'SEM_PASTA' | 'TODOS';

export interface GrupoDeAlunos<T> {
  chave: ChaveDoGrupo;
  titulo: string;
  /** Nulo no grupo único "Alunos". */
  tom: TomDoGrupo | null;
  /** "1 aluno · o que significa"; no grupo "Alunos", só "N alunos". */
  resumo: string;
  itens: T[];
}

interface Definicao {
  chave: Exclude<ChaveDoGrupo, 'TODOS'>;
  titulo: string;
  tom: TomDoGrupo;
  significado: string;
}

const DEFINICOES: readonly Definicao[] = [
  { chave: 'PARA_REVISAR', titulo: 'Para revisar', tom: 'atencao', significado: 'A atualização chegou e espera o seu feedback.' },
  { chave: 'ATRASADOS', titulo: 'Atrasados', tom: 'perigo', significado: 'Passou da data e o aluno ainda não enviou.' },
  { chave: 'EM_DIA', titulo: 'Em dia', tom: 'sucesso', significado: 'Atualização ainda por vir ou já revisada.' },
  { chave: 'SEM_PASTA', titulo: 'Sem pasta com período', tom: 'neutro', significado: 'Sem atualização para acompanhar ainda.' },
];

const quantosAlunos = (n: number) => `${n} ${n === 1 ? 'aluno' : 'alunos'}`;

function chaveDoAluno(fase: FaseAtualizacao | undefined): Definicao['chave'] {
  if (!fase) return 'SEM_PASTA';
  if (fase === 'ENVIADA') return 'PARA_REVISAR';
  if (fase === 'ATRASADA') return 'ATRASADOS';
  return 'EM_DIA';
}

export function agruparAlunos<T extends { atualizacao?: { fase: FaseAtualizacao } | null }>(
  itens: readonly T[],
  veAtualizacao: boolean,
): GrupoDeAlunos<T>[] {
  if (itens.length === 0) return [];
  if (!veAtualizacao) return [{ chave: 'TODOS', titulo: 'Alunos', tom: null, resumo: quantosAlunos(itens.length), itens: [...itens] }];
  const grupos = DEFINICOES.map((d) => ({ d, itens: [] as T[] }));
  for (const item of itens) {
    const chave = chaveDoAluno(item.atualizacao?.fase);
    grupos.find((g) => g.d.chave === chave)?.itens.push(item);
  }
  return grupos
    .filter((g) => g.itens.length > 0)
    .map(({ d, itens: lista }) => ({ chave: d.chave, titulo: d.titulo, tom: d.tom, resumo: `${quantosAlunos(lista.length)} · ${d.significado}`, itens: lista }));
}

/** Primeira palavra do nome, sem espaços; vazio vira "—". */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || SEM_DADO;
}

const DIAS_ULTIMO_REGISTRO_SUAVE = 7;

/**
 * Último registro na linha do aluno: "Hoje", "Ontem", "Há 3 dias" ou a data curta; sem registro, "Nunca registrou".
 * `suave` (texto esmaecido) quando faz mais de 7 dias, ou nunca. `ultimoRegistro` pode vir com hora; vale o dia.
 */
export function ultimoRegistroDaLinha(ultimoRegistro: string | null, hoje: string = hojeIso()): { texto: string; suave: boolean } {
  if (!ultimoRegistro) return { texto: 'Nunca registrou', suave: true };
  const dias = Math.round((Date.parse(hoje.slice(0, 10)) - Date.parse(ultimoRegistro.slice(0, 10))) / 86_400_000);
  return { texto: comMaiuscula(dataRelativa(ultimoRegistro, hoje)), suave: dias > DIAS_ULTIMO_REGISTRO_SUAVE };
}
