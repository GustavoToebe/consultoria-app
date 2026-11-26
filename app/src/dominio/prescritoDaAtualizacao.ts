import type { ConteudoDieta, PlanoResumo, Refeicao } from '../api/tipos';
import { descreverSeries } from './agrupamento';
import { normalizarDieta } from './dieta';
import { normalizarTreino } from './editorTreino';
import { ergogenicosPreenchidos } from './ergogenicos';
import { quantidadeParaTela } from './listaDeCompras';
import { secoesDaDieta, textoDosDiasCurtos } from './variacoesDaDieta';

/**
 * "O que está prescrito" na revisão da atualização (bloco D de `docs/planos/atualizacao-pasta-e-questionarios.md`, 2.2 de
 * `orientacoes-de-design-26-11.md`): o treino e a dieta da pasta desta atualização em linhas curtas, só leitura, para o
 * treinador comparar com as respostas sem sair da tela. Pura: escolhe o plano da pasta, decide as abas pela permissão e
 * monta o texto com os mesmos formatadores do editor, do PDF e do aluno (`descreverSeries`, `quantidadeParaTela`).
 */

export type AbaDoPrescrito = 'treino' | 'dieta' | 'suplementos' | 'outros';

export const ROTULO_DA_ABA_DO_PRESCRITO: Record<AbaDoPrescrito, string> = {
  treino: 'Treino', dieta: 'Dieta', suplementos: 'Suplementos', outros: 'Outros',
};

/**
 * As abas que a pessoa pode ver, na ordem da tela. Sem a permissão a aba SOME (não fica desabilitada). Suplementos e Outros
 * moram na dieta (`DIETA_LER`); Outros (medicação e ergogênicos) pede também `ERGOGENICO_LER`, sem a qual a API nem os envia.
 */
export function abasDoPrescrito(pode: (codigo: string) => boolean): AbaDoPrescrito[] {
  const abas: AbaDoPrescrito[] = [];
  if (pode('TREINO_LER')) abas.push('treino');
  if (pode('DIETA_LER')) abas.push('dieta', 'suplementos');
  if (pode('DIETA_LER') && pode('ERGOGENICO_LER')) abas.push('outros');
  return abas;
}

/** A versão a ler: `null` = a pasta não tem plano publicado deste tipo. `agendada` = publicada, mas o aluno ainda não a vê (bloco E). */
export interface VersaoDoPrescrito { planoId: string; numero: number; agendada: boolean }

/**
 * O plano publicado da pasta: entre os do tipo com `pastaId` igual e alguma versão publicada, o em uso pelo aluno (`ativo`) e,
 * sem ele, o de publicação mais recente (a pasta pode ter rascunhos repetidos). A versão é a que o aluno vê (`versaoLiberada`);
 * sem nenhuma liberada ainda (só agendada), a última publicada, marcada como agendada.
 * shortcut: é a versão de HOJE, não a que valia quando o aluno respondeu; trocar se a API passar a guardar a versão na atualização.
 */
export function versaoDoPrescrito(planos: readonly PlanoResumo[], pastaId: string | null): VersaoDoPrescrito | null {
  if (!pastaId) return null;
  const publicados = planos.filter((p) => p.pastaId === pastaId && p.versaoPublicada > 0);
  const plano = publicados.find((p) => p.ativo)
    ?? publicados.reduce<PlanoResumo | null>((m, p) => (!m || (p.publicadoEm ?? '') > (m.publicadoEm ?? '') ? p : m), null);
  if (!plano) return null;
  const liberada = plano.versaoLiberada ?? plano.versaoPublicada;
  return liberada > 0
    ? { planoId: plano.id, numero: liberada, agendada: false }
    : { planoId: plano.id, numero: plano.versaoPublicada, agendada: true };
}

export interface LinhaDoPrescrito { chave: string; nome: string; detalhe: string | null }
export interface SessaoDoPrescrito { chave: string; nome: string; linhas: LinhaDoPrescrito[] }

/** Treino: uma sessão por divisão e uma linha por exercício ("Supino reto" · "3x6 a 8 - WS · 80 kg"). */
export function treinoDoPrescrito(conteudo: unknown): SessaoDoPrescrito[] {
  const treino = normalizarTreino(conteudo);
  const config = treino.metodologia?.configuracao ?? null;
  return treino.sessoes.map((s, i) => ({
    chave: s.uid || `sessao-${i}`,
    nome: s.nome.trim() || `Sessão ${i + 1}`,
    linhas: s.exercicios.map((e, j) => {
      const series = descreverSeries(e.series, config).join(' · ');
      return { chave: e.uid || `${i}-${j}`, nome: e.nome.trim() || 'Exercício', detalhe: series || null };
    }),
  }));
}

export interface RefeicaoDoPrescrito {
  chave: string;
  nome: string;
  horario: string | null;
  /** Itens da primeira opção ("Arroz branco" · "100 g"); a quantidade ausente fica `null`, nunca inventada. */
  itens: LinhaDoPrescrito[];
  /** Quantas opções além da primeira (o aluno escolhe uma; o total soma só a primeira). */
  outrasOpcoes: number;
}
export interface SecaoDoPrescrito {
  chave: string;
  /** Variação por dia da semana ("Dia de treino · Seg, Qua e Sex"); `null` sem variação. */
  rotulo: string | null;
  refeicoes: RefeicaoDoPrescrito[];
  /** Para o total do dia (`totalDoDia`), calculado na tela com a peça dos valores. */
  paraOTotal: Refeicao[];
}

/** Dieta: uma seção por variação (ou uma só), refeições com os itens da primeira opção. */
export function dietaDoPrescrito(c: ConteudoDieta): SecaoDoPrescrito[] {
  return secoesDaDieta(c).map((s, i) => ({
    chave: s.uid ?? `secao-${i}`,
    rotulo: s.rotulo === null ? null : `${s.rotulo.trim() || `Variação ${i + 1}`} · ${textoDosDiasCurtos(s.dias)}`,
    paraOTotal: s.refeicoes,
    refeicoes: s.refeicoes.map((r, j) => ({
      chave: r.uid || `${i}-${j}`,
      nome: r.nome.trim() || `Refeição ${j + 1}`,
      horario: r.horario?.trim() || null,
      outrasOpcoes: Math.max(0, r.opcoes.length - 1),
      itens: (r.opcoes[0]?.itens ?? []).map((it, k) => ({
        chave: it.uid || `${i}-${j}-${k}`,
        nome: it.nome.trim() || 'Item',
        detalhe: it.quantidade == null ? null : quantidadeParaTela(it.quantidade, it.unidade),
      })),
    })),
  }));
}

const juntar = (partes: (string | null | undefined)[]) => partes.map((p) => (p ?? '').trim()).filter(Boolean).join(' · ') || null;

/** Suplementos: nome, dose e horário, como o treinador escreveu. */
export const suplementosDoPrescrito = (c: ConteudoDieta): LinhaDoPrescrito[] =>
  c.suplementacao.filter((s) => s.nome.trim()).map((s, i) => ({ chave: s.uid || `sup-${i}`, nome: s.nome.trim(), detalhe: juntar([s.dose, s.horario]) }));

/** Outros (medicação e ergogênicos, dado sensível): só as linhas preenchidas; nome, concentração, dose e horário. */
export const outrosDoPrescrito = (c: ConteudoDieta): LinhaDoPrescrito[] =>
  ergogenicosPreenchidos(c.ergogenicos).map((e, i) => ({
    chave: e.uid || `erg-${i}`,
    nome: e.nome.trim() || e.principioAtivo.trim() || 'Item',
    detalhe: juntar([e.concentracao, e.dose, e.horario]),
  }));

/** O conteúdo da versão da dieta como as regras acima o leem (versão antiga sem campos novos fica completa). */
export const dietaLida = (conteudo: unknown): ConteudoDieta => normalizarDieta(conteudo);
