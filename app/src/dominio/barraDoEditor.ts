import { horaDoSalvamento, textoDoSalvo } from './estadoDoRascunho';

/**
 * Textos da barra fixa dos editores (plano do aluno, modelo e questionário; revisão de telas de 19/10): **um** selo de
 * estado e uma linha curta de informação. Antes o topo empilhava "Rascunho salvo", "Ativo", "Publicado v1", período e
 * um parágrafo; o selo agora diz só a coisa que importa naquele momento.
 */

export type SituacaoDoEditor = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito' | 'dataInvalida';
export type TipoDoSeloDoEditor = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

export interface Publicacao {
  /** 0 = nunca publicado. */
  versao: number;
  /** O rascunho mudou desde a última publicação. */
  alterado: boolean;
}

const FORA_DO_SALVO: Record<Exclude<SituacaoDoEditor, 'salvo'>, { texto: string; tipo: TipoDoSeloDoEditor }> = {
  pendente: { texto: 'Alterações não salvas', tipo: 'atencao' },
  salvando: { texto: 'Salvando…', tipo: 'neutro' },
  erro: { texto: 'Falha ao salvar', tipo: 'perigo' },
  conflito: { texto: 'Alterado em outra aba', tipo: 'perigo' },
  dataInvalida: { texto: 'Data inválida: não salvo', tipo: 'perigo' },
};

/**
 * Selo único do editor. Ordem: o que está acontecendo agora (não salvo, salvando, erro); depois, com tudo salvo, a
 * relação com o que o aluno vê. `publicacao` nulo = modelo (não tem publicação): só "Salvo"/"Salvo às HH:MM".
 */
export function seloDoEditor(situacao: SituacaoDoEditor, salvoAs: Date | null, publicacao: Publicacao | null): { texto: string; tipo: TipoDoSeloDoEditor } {
  if (situacao !== 'salvo') return FORA_DO_SALVO[situacao];
  if (!publicacao) return { texto: textoDoSalvo(salvoAs), tipo: 'sucesso' };
  const falta = publicacao.versao === 0 || publicacao.alterado;
  if (falta && salvoAs) return { texto: `Salvo às ${horaDoSalvamento(salvoAs)}`, tipo: 'neutro' };
  if (publicacao.versao === 0) return { texto: 'Ainda não publicado', tipo: 'atencao' };
  if (publicacao.alterado) return { texto: 'Rascunho diferente do publicado', tipo: 'atencao' };
  return { texto: `Publicado v${publicacao.versao}`, tipo: 'sucesso' };
}

/** `19/10/2026` → `19/10` quando o ano é o corrente (textos curtos omitem o ano de agora). */
export function dataSemAnoCorrente(tela: string, agora: Date = new Date()): string {
  const ano = String(agora.getFullYear());
  return tela.endsWith(`/${ano}`) ? tela.slice(0, -5) : tela;
}

/** `2026-10-19T18:32:00Z` → `19/10 às 18:32` (ano só se não for o corrente), no fuso do aparelho. */
export function quandoPublicado(instante: string, agora: Date = new Date()): string {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return '—';
  const dois = (n: number) => String(n).padStart(2, '0');
  const ano = d.getFullYear() === agora.getFullYear() ? '' : `/${d.getFullYear()}`;
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}${ano} às ${horaDoSalvamento(d)}`;
}

/**
 * Linha de informação do plano na barra: "19/10 a 03/11 (da pasta) · publicado em 19/10 às 18:32". Sem período, só a
 * publicação; nunca publicado, "o aluno ainda não vê".
 */
export function infoDoPlano(p: { inicio: string; fim: string; daPasta: boolean; publicadoEm: string | null }, agora: Date = new Date()): string {
  const partes: string[] = [];
  if (p.inicio || p.fim) {
    partes.push(`${p.inicio ? dataSemAnoCorrente(p.inicio, agora) : '—'} a ${p.fim ? dataSemAnoCorrente(p.fim, agora) : '—'}${p.daPasta ? ' (da pasta)' : ''}`);
  }
  partes.push(p.publicadoEm ? `publicado em ${quandoPublicado(p.publicadoEm, agora)}` : 'o aluno ainda não vê');
  const texto = partes.join(' · ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
