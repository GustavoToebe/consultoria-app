import type { AlunoDaAmostra, AmostraDaPlanilha, ConteudoDieta, ExercicioPlano, ItemDieta, PartePuladaDaPlanilha } from '../api/tipos';
import { contarPlano, contarSessao } from './contagemDoTreino';
import { dataParaTela, numeroParaTela, SEM_DADO } from './formatos';

/**
 * Migração assistida, fase 2: os textos da etapa "Amostra" da planilha completa (o que a confirmação gravaria, em rascunho,
 * para 5 alunos por vez). Só formata o que a API mandou: ausente é "—", nada é calculado além de contar o que veio.
 */

/** Quantos alunos a API manda por vez (`AmostraDaPlanilha.ALUNOS_POR_AMOSTRA` da API). */
export const ALUNOS_POR_AMOSTRA = 5;
/** O título da pasta de rascunho, enquanto a amostra não chegou (a API manda o mesmo em `pasta`). */
export const PASTA_DA_IMPORTACAO = 'Importada da planilha (rascunho)';
export const FICA_DE_FORA = 'Fica de fora pelo seu perfil.';
export const NOVO_NA_BIBLIOTECA = 'Novo na biblioteca';

const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;

/** O texto fixo da etapa, com o nome da pasta que a API mandou. */
export function textoDaPasta(pasta: string): string {
  return `Tudo entra em rascunho na pasta “${pasta}”; nada é publicado; aluno que já existe só ganha mais uma pasta.`;
}

/** "Alunos 6 a 10 de 12" · "Aluno 11 de 11" · "Nenhum aluno para mostrar." */
export function faixaDaAmostra(a: Pick<AmostraDaPlanilha, 'total' | 'inicio' | 'alunos'>): string {
  if (a.alunos.length === 0) return 'Nenhum aluno para mostrar.';
  const de = a.inicio + 1;
  const ate = a.inicio + a.alunos.length;
  return de === ate ? `Aluno ${de} de ${a.total}` : `Alunos ${de} a ${ate} de ${a.total}`;
}

/** Quantos vêm no próximo pedido (até 5); 0 = já é o fim. */
export function restantesDaAmostra(a: Pick<AmostraDaPlanilha, 'total' | 'inicio' | 'alunos'>): number {
  return Math.max(0, Math.min(ALUNOS_POR_AMOSTRA, a.total - (a.inicio + a.alunos.length)));
}

export function rotuloDosProximos(quantos: number): string {
  return quantos === 1 ? 'Ver o próximo' : `Ver os próximos ${quantos}`;
}

export function situacaoDoAluno(a: Pick<AlunoDaAmostra, 'situacao'>): string {
  return a.situacao === 'NOVO' ? 'Novo' : 'Já é seu aluno';
}

export function textoDoAtivo(ativo: boolean | null): string {
  return ativo === null ? SEM_DADO : ativo ? 'Ativo' : 'Inativo';
}

export function ficaDeFora(puladas: readonly PartePuladaDaPlanilha[], parte: string): boolean {
  return puladas.some((p) => p.parte === parte);
}

/** Valor de um campo do cadastro: o da planilha, "fica de fora" quando o perfil não grava a parte, senão "—". */
export function valorDoCampo(valor: string | null, pulado = false): string {
  if (valor !== null && valor.trim() !== '') return valor;
  return pulado ? FICA_DE_FORA : SEM_DADO;
}

export interface ContagemDaDieta { refeicoes: number; itens: number; suplementos: number; ergogenicos: number }

/** Itens de todas as opções de cada refeição (cada opção é uma alternativa, e todas entram no rascunho). */
export function contarDieta(d: Pick<ConteudoDieta, 'refeicoes' | 'suplementacao' | 'ergogenicos'>): ContagemDaDieta {
  return {
    refeicoes: d.refeicoes.length,
    itens: d.refeicoes.reduce((s, r) => s + r.opcoes.reduce((t, o) => t + o.itens.length, 0), 0),
    suplementos: d.suplementacao.length,
    ergogenicos: d.ergogenicos?.length ?? 0,
  };
}

/** "3 sessões · 18 exercícios · 54 séries". */
export function textoDoTreino(t: Parameters<typeof contarPlano>[0]): string {
  const c = contarPlano(t);
  return `${n(c.sessoes, 'sessão', 'sessões')} · ${n(c.exercicios, 'exercício', 'exercícios')} · ${n(c.series, 'série', 'séries')}`;
}

/** "5 exercícios · 18 séries". */
export function textoDaSessao(s: Parameters<typeof contarSessao>[0]): string {
  const c = contarSessao(s);
  return `${n(c.exercicios, 'exercício', 'exercícios')} · ${n(c.series, 'série', 'séries')}`;
}

/** "4 refeições · 12 itens · 2 suplementos", e a medicação só quando há. */
export function textoDaDieta(c: ContagemDaDieta): string {
  const partes = [n(c.refeicoes, 'refeição', 'refeições'), n(c.itens, 'item', 'itens'), n(c.suplementos, 'suplemento', 'suplementos')];
  if (c.ergogenicos > 0) partes.push(n(c.ergogenicos, 'medicação ou ergogênico', 'medicações ou ergogênicos'));
  return partes.join(' · ');
}

/** "Supino reto · 4 séries". */
export function textoDoExercicio(e: Pick<ExercicioPlano, 'nome' | 'series'>): string {
  return `${e.nome.trim() || SEM_DADO} · ${n(e.series?.length ?? 0, 'série', 'séries')}`;
}

/** Sem `exercicioId` o exercício ainda não está na biblioteca (a confirmação o cria ou o deixa com o nome da planilha). */
export const foraDaBiblioteca = (e: Pick<ExercicioPlano, 'exercicioId'>) => !e.exercicioId;

/** "Arroz branco · 100 g"; sem quantidade, "—". */
export function textoDoItem(i: Pick<ItemDieta, 'nome' | 'quantidade' | 'unidade'>): string {
  const q = i.quantidade === null ? SEM_DADO : `${numeroParaTela(i.quantidade)} ${i.unidade}`;
  return `${i.nome.trim() || SEM_DADO} · ${q}`;
}

/** "Café da manhã · 07:00"; sem horário, só o nome. */
export function textoDaRefeicao(r: { nome: string; horario: string | null }): string {
  const nome = r.nome.trim() || SEM_DADO;
  return r.horario ? `${nome} · ${r.horario}` : nome;
}

/** "Creatina · 5 g"; dose em branco, "—". */
export function textoDoSuplemento(s: { nome: string; dose: string }): string {
  return `${s.nome.trim() || SEM_DADO} · ${s.dose.trim() || SEM_DADO}`;
}

/** "12/10/2026 · 72,4 kg". */
export function textoDoPeso(p: { data: string; kg: number }): string {
  return `${dataParaTela(p.data) || SEM_DADO} · ${numeroParaTela(p.kg)} kg`;
}

/** Os últimos pesos, do mais recente ao mais antigo (a API manda do mais antigo ao mais novo). */
export function pesosDoMaisRecente(a: Pick<AlunoDaAmostra, 'ultimosPesos'>): { data: string; kg: number }[] {
  return [...a.ultimosPesos].sort((x, y) => y.data.localeCompare(x.data));
}

/** "12 pesos para gravar; os 10 mais recentes:" · "2 pesos para gravar:" */
export function textoDosPesos(a: Pick<AlunoDaAmostra, 'pesos' | 'ultimosPesos'>): string {
  const total = `${n(a.pesos, 'peso', 'pesos')} para gravar`;
  return a.ultimosPesos.length < a.pesos ? `${total}; os ${a.ultimosPesos.length} mais recentes:` : `${total}:`;
}

/** A linha do cabeçalho do aluno: "Nº 3 no arquivo · 12 pesos · treino · dieta". */
export function resumoDoAluno(a: AlunoDaAmostra): string {
  const partes = [`Nº ${a.numero} no arquivo`];
  if (a.pesos > 0) partes.push(n(a.pesos, 'peso', 'pesos'));
  if (a.treino) partes.push(`treino com ${n(contarPlano(a.treino).sessoes, 'sessão', 'sessões')}`);
  if (a.dieta) partes.push(`dieta com ${n(a.dieta.refeicoes.length, 'refeição', 'refeições')}`);
  return partes.join(' · ');
}
