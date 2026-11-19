import type { AlunoDetalhe } from '../api/tipos';
import { dataEmBrasilia, horaEmBrasilia } from './agendaPresencial';
import { dataParaTela } from './formatos';

/**
 * Cabeçalho da ficha do aluno (18/11, `docs/planos/ficha-do-aluno-cabecalho.md`): a linha de datas abaixo do nome e o selo
 * da situação. Só aparece o que existe: dado ausente, instante malformado ou tipo desconhecido tira a parte, nunca vira
 * "—" nem data inventada. Datas no fuso de Brasília, qualquer que seja o do aparelho.
 */

type DatasDoAluno = Pick<AlunoDetalhe, 'cadastroAlteradoEm' | 'ultimoAcesso' | 'ultimoPlanoPublicado'>;

/** `DD/MM/AAAA` de Brasília; `null` se o instante não é uma data. */
function dia(instante: string | null | undefined): string | null {
  if (!instante || Number.isNaN(Date.parse(instante))) return null;
  return dataParaTela(dataEmBrasilia(instante));
}

/** `DD/MM/AAAA HH:MM` de Brasília; `null` se o instante não é uma data. */
function diaEHora(instante: string | null | undefined): string | null {
  const d = dia(instante);
  return d && `${d} ${horaEmBrasilia(instante!)}`;
}

/** As partes da linha abaixo do nome, na ordem: cadastro alterado, último acesso (ou login) e último plano publicado. */
export function linhaDeDatas(a: DatasDoAluno): string[] {
  const partes: string[] = [];
  const cadastro = diaEHora(a.cadastroAlteradoEm);
  if (cadastro) partes.push(`Cadastro alterado em ${cadastro}`);
  const acesso = diaEHora(a.ultimoAcesso?.em);
  // Login não é uso do app: cada tipo tem o seu texto, e um tipo que o app não conhece não aparece.
  if (acesso && a.ultimoAcesso?.tipo === 'ACESSO') partes.push(`Último acesso ao app em ${acesso}`);
  if (acesso && a.ultimoAcesso?.tipo === 'LOGIN') partes.push(`Último login em ${acesso}`);
  const plano = dia(a.ultimoPlanoPublicado?.em);
  const autor = a.ultimoPlanoPublicado?.porNome?.trim();
  if (plano) partes.push(`Último plano publicado em ${plano}${autor ? ` por ${autor}` : ''}`);
  return partes;
}

/**
 * Situação do aluno no cabeçalho (tabela 4.5 do `docs/design-e-front.md`): ativo é `sucesso`; inativo e anonimizado são
 * encerrados, `neutro`. Anonimizado vale mais que inativo (a anonimização inativa).
 */
export function seloDaSituacao(a: Pick<AlunoDetalhe, 'ativo' | 'anonimizado'>): { texto: string; tipo: 'sucesso' | 'neutro' } {
  if (a.anonimizado) return { texto: 'Anonimizado', tipo: 'neutro' };
  return a.ativo ? { texto: 'Ativo', tipo: 'sucesso' } : { texto: 'Inativo', tipo: 'neutro' };
}
