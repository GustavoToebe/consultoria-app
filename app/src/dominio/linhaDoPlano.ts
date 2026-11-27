import type { PlanoResumo } from '../api/tipos';
import { dataSemAnoCorrente } from './datasRelativas';
import { hojeIso } from './formatos';
import { rotuloAgendado } from './liberacaoDePlano';

/** O selo único da linha do plano na Folha da pasta; `agendado` leva o ícone do calendário. */
export interface SeloDaLinhaDoPlano {
  texto: string;
  tipo: 'sucesso' | 'neutro';
  agendado: boolean;
}

export interface LinhaDoPlano {
  selo: SeloDaLinhaDoPlano | null;
  /** Segunda linha: a versão publicada e o que o aluno vê. `null` = nada a dizer (rascunho). */
  meta: string | null;
  /** Rascunho nunca publicado: título suave, para não disputar com o que o aluno usa. */
  discreto: boolean;
}

/**
 * Selo e segunda linha do plano na Folha da pasta. Um selo só, pela precedência Agendado > Alterações não publicadas >
 * Rascunho > Em uso: o que pede atenção do treinador vence o fato assentado. "Em uso" é o único verde (situação boa); o
 * resto é neutro (o rascunho não é problema). Publicado, fora de uso e sem alteração não tem selo; a meta diz por quê.
 */
export function linhaDoPlano(p: PlanoResumo, hoje: string = hojeIso()): LinhaDoPlano {
  const versao = `Publicado v${p.versaoPublicada}`;
  // `publicadoEm` é instante: o dia é o do aparelho, como no resto das listas.
  const publicado = p.publicadoEm ? `${versao} em ${dataSemAnoCorrente(hojeIso(new Date(p.publicadoEm)), hoje)}` : versao;
  const linha = (selo: SeloDaLinhaDoPlano | null, meta: string | null): LinhaDoPlano => ({ selo, meta, discreto: false });

  if (p.liberarEm) {
    const liberada = p.versaoLiberada ?? 0;
    return linha(
      { texto: rotuloAgendado(p.liberarEm, hoje), tipo: 'neutro', agendado: true },
      liberada > 0 ? `${versao} · o aluno vê a v${liberada} até lá` : versao,
    );
  }
  if (p.versaoPublicada > 0 && p.rascunhoAlteradoDepoisDePublicar) {
    return linha({ texto: 'Alterações não publicadas', tipo: 'neutro', agendado: false }, p.ativo ? `Em uso pelo aluno · ${publicado}` : publicado);
  }
  if (p.versaoPublicada === 0) return { selo: { texto: 'Rascunho', tipo: 'neutro', agendado: false }, meta: null, discreto: true };
  if (p.ativo) return linha({ texto: 'Em uso pelo aluno', tipo: 'sucesso', agendado: false }, publicado);
  return linha(null, `${publicado} · não está em uso`);
}
