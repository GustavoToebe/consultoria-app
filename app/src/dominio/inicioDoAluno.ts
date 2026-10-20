import type { ConteudoDieta, ConteudoTreino, Sessao } from '../api/tipos';
import { contagem } from './contagens';
import { normalizarDieta } from './dieta';
import { DIAS_SEMANA } from './editorTreino';
import { diaDaSemanaIso, somarDias } from './formatos';
import { rotuloDoTipo, sessoesDaSemana } from './semana';

/**
 * Regras do Início do aluno (a tela só desenha). Nada aqui inventa dado: dia, água e contagens vêm do plano publicado
 * pelo treinador, e o que falta fica ausente.
 */

const DIAS_POR_EXTENSO = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "Segunda-feira · 19 de outubro" para uma data ISO (a de hoje no aparelho). */
export function dataPorExtenso(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${DIAS_POR_EXTENSO[diaDaSemanaIso(iso) - 1]} · ${d} de ${MESES[m - 1]}`;
}

/** Primeiro nome do perfil; sem nome, `null` (a saudação fica só "Olá."). */
export function primeiroNome(nome: string | null | undefined): string | null {
  const primeiro = nome?.trim().split(/\s+/)[0];
  return primeiro ? primeiro : null;
}

// ---- Dieta ----

export type DietaNoInicio =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'sem-dieta' }
  | { tipo: 'ok'; refeicoes: string; agua: string | null };

/** "3,0 L": o número que o treinador escreveu, sempre com uma casa. Sem valor, `null` e a coluna da água some. */
export function aguaDoInicio(litros: number | null | undefined): string | null {
  if (litros == null || Number.isNaN(litros)) return null;
  return `${litros.toFixed(1).replace('.', ',')} L`;
}

/**
 * Cartão da Dieta. `conteudo` nulo = o treinador ainda não publicou. Falha de busca nunca vira "não publicada": é
 * `erro` (a tela oferece "Tentar de novo").
 */
export function dietaNoInicio(entrada: { conteudo: ConteudoDieta | null | undefined; erro: boolean }): DietaNoInicio {
  const { conteudo, erro } = entrada;
  if (conteudo === undefined) return erro ? { tipo: 'erro' } : { tipo: 'carregando' };
  if (conteudo === null) return { tipo: 'sem-dieta' };
  const c = normalizarDieta(conteudo);
  return {
    tipo: 'ok',
    refeicoes: `${contagem(c.refeicoes.length, 'refeição', 'refeições')} no seu plano`,
    agua: aguaDoInicio(c.aguaLitros),
  };
}

// ---- Hoje ----

export type EstadoDoHoje =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'preparando' }
  | { tipo: 'sem-dia-fixo' }
  /** `sessao` é a de hoje quando é descanso programado (pode trazer o cardio); nula = nenhuma sessão marcada hoje. */
  | { tipo: 'descanso'; sessao: Sessao | null }
  | { tipo: 'sem-exercicios'; sessao: Sessao }
  | { tipo: 'treino'; sessao: Sessao; rotulo: string };

/** Letra da divisão pela ordem da semana ("A", "B"...). Só para rotular; não existe no plano. */
export function letraDaDivisao(conteudo: ConteudoTreino, sessao: Sessao): string {
  const i = sessoesDaSemana(conteudo).findIndex((s) => s.uid === sessao.uid);
  return String.fromCharCode(65 + (i < 0 ? 0 : i % 26));
}

/** Rótulo pequeno do cartão: "TREINO A", "ACESSÓRIOS B". */
export function rotuloDaDivisao(conteudo: ConteudoTreino, sessao: Sessao): string {
  return `${rotuloDoTipo(sessao)} ${letraDaDivisao(conteudo, sessao)}`.toUpperCase();
}

/**
 * O que o cartão "Hoje" mostra. `conteudo` nulo: falha (`erro`) ganha de tudo e nunca vira "não publicado"; ainda
 * lendo é `carregando`; senão o treinador não publicou o treino. Com plano: sem nenhum dia fixo = escolher a divisão; dia
 * sem sessão, ou sessão de descanso sem exercício, = descanso programado.
 */
export function estadoDoHoje(entrada: { conteudo: ConteudoTreino | null; dia: number; carregando: boolean; erro: boolean }): EstadoDoHoje {
  const { conteudo, dia, carregando, erro } = entrada;
  if (!conteudo) {
    if (erro) return { tipo: 'erro' };
    return carregando ? { tipo: 'carregando' } : { tipo: 'preparando' };
  }
  if (conteudo.sessoes.length === 0) return { tipo: 'preparando' };
  if (conteudo.sessoes.every((s) => !s.diaSemana)) return { tipo: 'sem-dia-fixo' };
  const sessao = conteudo.sessoes.find((s) => s.diaSemana === dia) ?? null;
  if (!sessao) return { tipo: 'descanso', sessao: null };
  if (sessao.tipo === 'DESCANSO' || (sessao.tipo === 'DESCANSO_ATIVO' && sessao.exercicios.length === 0)) {
    return { tipo: 'descanso', sessao };
  }
  if (sessao.exercicios.length === 0) return { tipo: 'sem-exercicios', sessao };
  return { tipo: 'treino', sessao, rotulo: rotuloDaDivisao(conteudo, sessao) };
}

// ---- Divisões ----

/** "Segunda · 5 exercícios" ou "Sem dia fixo · 5 exercícios"; sem exercício, o tipo da sessão ("Descanso"). */
export function detalheDaDivisao(sessao: Sessao): string {
  const dia = sessao.diaSemana ? DIAS_SEMANA[sessao.diaSemana - 1] : 'Sem dia fixo';
  const quantos = sessao.exercicios.length ? contagem(sessao.exercicios.length, 'exercício', 'exercícios') : rotuloDoTipo(sessao);
  return `${dia} · ${quantos}`;
}

/**
 * Data que o toque numa divisão abre (`sessao/[uid]?data=`): hoje se for o dia dela ou se não tem dia fixo; senão a
 * próxima vez dela, e a última se a próxima passa do fim do período. Nunca fora do período do plano quando ele existe.
 */
export function dataParaAbrir(sessao: Sessao, inicio: string | null, fim: string | null, hoje: string): string {
  if (!sessao.diaSemana) return hoje;
  const proxima = somarDias(hoje, (sessao.diaSemana - diaDaSemanaIso(hoje) + 7) % 7);
  if (fim && proxima > fim) {
    const anterior = somarDias(proxima, -7);
    return inicio && anterior < inicio ? hoje : anterior;
  }
  return proxima;
}

/** A divisão cai hoje (ganha o selo "Hoje" na lista)? Sem dia fixo, nunca. */
export function ehDeHoje(sessao: Sessao, dia: number): boolean {
  return sessao.diaSemana === dia;
}
