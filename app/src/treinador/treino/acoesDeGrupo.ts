import type { Configuracao, ExercicioPlano, TecnicaDeGrupo } from '../../api/tipos';
import {
  alterarGrupoDaSessao,
  criarGrupo,
  grupoEmSequencia,
  juntarAoGrupo,
  MAXIMO_DE_VOLTAS,
  MAXIMO_POR_GRUPO,
  MINIMO_POR_GRUPO,
  type ExerciciosEGrupos,
} from '../../dominio/combinacoes';
import { explicacaoDaCombinacao, nomeDaCombinacao, TIPOS_DE_GRUPO } from '../../dominio/metodologia';
import { novoUid } from '../../dominio/uid';

/**
 * O que a tela dos grupos da sessão decide, sem componente: quais exercícios podem formar um grupo, por que o botão
 * "Criar grupo" está travado, quem pode entrar num grupo e as opções dos sete tipos. As operações em si são as de
 * `dominio/combinacoes`; aqui só entram os textos e as conferências que a tela precisa antes de chamá-las.
 */

/** Exercício que não pertence a nenhum grupo da sessão (marca de grupo que não existe mais conta como solto). */
export function exercicioSolto(s: ExerciciosEGrupos, indice: number): boolean {
  const e = s.exercicios[indice];
  if (!e) return false;
  return !e.grupoUid || !(s.grupos ?? []).some((g) => g.uid === e.grupoUid);
}

/** Os sete tipos de grupo com o nome da metodologia, a explicação e quantos exercícios pedem. */
export interface OpcaoDeGrupo {
  valor: TecnicaDeGrupo;
  rotulo: string;
  explicacao: string | null;
  exigencia: string;
}

/** "de 3 a 6 exercícios" ou "exatamente 2 exercícios" (pré e pós-exaustão). */
export function exigenciaDoGrupo(tecnica: TecnicaDeGrupo): string {
  return grupoEmSequencia(tecnica) ? 'exatamente 2 exercícios' : `de ${MINIMO_POR_GRUPO[tecnica]} a ${MAXIMO_POR_GRUPO} exercícios`;
}

export function opcoesDeGrupo(config: Configuracao | null | undefined): OpcaoDeGrupo[] {
  return TIPOS_DE_GRUPO.map((t) => ({ valor: t, rotulo: nomeDaCombinacao(config, t), explicacao: explicacaoDaCombinacao(config, t), exigencia: exigenciaDoGrupo(t) }));
}

/** Há dois exercícios soltos, um ao lado do outro? Sem isso o botão "Criar grupo" fica travado, com o motivo. */
export function motivoSemCandidatos(s: ExerciciosEGrupos): string | null {
  for (let i = 0; i + 1 < s.exercicios.length; i++) if (exercicioSolto(s, i) && exercicioSolto(s, i + 1)) return null;
  return s.exercicios.length < 2
    ? 'Adicione pelo menos 2 exercícios para fazer um grupo.'
    : 'Um grupo precisa de exercícios soltos, um ao lado do outro. Desfaça um grupo ou mude a ordem.';
}

/**
 * Por que os exercícios marcados não formam o grupo `tecnica`; `null` quando formam. `voltas` só conta no circuito.
 * O grupo pode até nascer abaixo do mínimo (o domínio deixa), mas a tela não: assim nenhum grupo nasce já com erro.
 */
export function motivoParaCriarGrupo(
  s: ExerciciosEGrupos,
  indices: readonly number[],
  tecnica: TecnicaDeGrupo,
  voltas: number | null,
  config?: Configuracao | null,
): string | null {
  const nome = nomeDaCombinacao(config, tecnica);
  const marcados = [...indices].sort((a, b) => a - b);
  if (marcados.length === 0) return 'Marque os exercícios do grupo.';
  if (marcados.some((i) => !exercicioSolto(s, i))) return 'Um dos exercícios já está em outro grupo.';
  if (marcados.some((i, k) => k > 0 && i !== marcados[k - 1] + 1)) return 'Os exercícios marcados precisam estar um ao lado do outro na sessão.';
  if (grupoEmSequencia(tecnica)) {
    if (marcados.length !== 2) return `${nome} tem exatamente 2 exercícios.`;
  } else if (marcados.length < MINIMO_POR_GRUPO[tecnica]) {
    return `${nome} precisa de pelo menos ${MINIMO_POR_GRUPO[tecnica]} exercícios.`;
  } else if (marcados.length > MAXIMO_POR_GRUPO) {
    return `Um grupo vai até ${MAXIMO_POR_GRUPO} exercícios.`;
  }
  if (tecnica === 'CIRCUITO' && (voltas == null || !Number.isInteger(voltas) || voltas < 1 || voltas > MAXIMO_DE_VOLTAS)) {
    return `Informe as voltas do circuito, de 1 a ${MAXIMO_DE_VOLTAS}.`;
  }
  return criarGrupo(s, marcados, tecnica) === s ? 'Não foi possível formar o grupo com esses exercícios.' : null;
}

/** Cria o grupo com os exercícios marcados; no circuito, já com as voltas. Devolve o mesmo objeto se não for possível. */
export function criarGrupoPronto(
  s: ExerciciosEGrupos,
  indices: readonly number[],
  tecnica: TecnicaDeGrupo,
  voltas: number | null,
  uid: string = novoUid(),
): ExerciciosEGrupos {
  const criado = criarGrupo(s, indices, tecnica, uid);
  if (criado === s || tecnica !== 'CIRCUITO') return criado;
  return alterarGrupoDaSessao(criado, uid, { voltas });
}

/** Exercício solto, ao lado do grupo, que pode entrar nele: antes do primeiro membro ou depois do último. */
export interface Vizinho {
  indice: number;
  nome: string;
  lado: 'antes' | 'depois';
}

export function vizinhosQuePodemEntrar(s: ExerciciosEGrupos, grupoUid: string): Vizinho[] {
  const posicoes = s.exercicios.flatMap((e, i) => (e.grupoUid === grupoUid ? [i] : []));
  if (posicoes.length === 0) return [];
  const candidatos: Vizinho[] = [];
  const tentar = (indice: number, lado: Vizinho['lado']) => {
    const e: ExercicioPlano | undefined = s.exercicios[indice];
    if (e && juntarAoGrupo(s, indice, grupoUid) !== s) candidatos.push({ indice, nome: e.nome.trim() || 'Exercício sem nome', lado });
  };
  tentar(posicoes[0] - 1, 'antes');
  tentar(posicoes[posicoes.length - 1] + 1, 'depois');
  return candidatos;
}

/** O que o grupo não deixa fazer, para o aviso sob os botões; `null` sem restrição que valha avisar. */
export function dicaDoGrupo(s: ExerciciosEGrupos, grupoUid: string, tecnica: TecnicaDeGrupo): string | null {
  const membros = s.exercicios.filter((e) => e.grupoUid === grupoUid).length;
  if (grupoEmSequencia(tecnica)) return membros === 2 ? 'Pré e pós-exaustão têm exatamente 2 exercícios.' : null;
  return membros >= MAXIMO_POR_GRUPO ? `O grupo já tem ${MAXIMO_POR_GRUPO} exercícios, o máximo.` : null;
}
