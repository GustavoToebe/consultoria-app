import type { SituacaoCompromisso } from '../api/agendaTipos';
import { lerSituacoes, OPCOES_SITUACAO, parametroDasSituacoes } from './agendaPresencial';

/**
 * Filtros da Agenda no painel "Filtros da agenda" (`docs/planos/filtros-laterais.md`): o responsável (toda a equipe, só os
 * meus ou um membro, nas três fontes; D19 da agenda) e a situação dos compromissos (várias). No endereço ficam como sempre
 * (`?meus=true`, `?membro=<id>`, `?situacao=AGENDADO,FALTOU`); o rascunho do painel nunca vai para lá.
 */
export interface FiltrosDaAgenda {
  /** `''` = toda a equipe, `'meus'` = só os meus, senão o id do membro. */
  responsavel: string;
  situacoes: SituacaoCompromisso[];
}
export type ChaveDoFiltroDaAgenda = keyof FiltrosDaAgenda;

export const TODA_A_EQUIPE = '';
export const SO_OS_MEUS = 'meus';
export const AGENDA_SEM_FILTRO: FiltrosDaAgenda = { responsavel: TODA_A_EQUIPE, situacoes: [] };

/** As quatro situações marcadas mostram o mesmo que nenhuma (todo compromisso tem ao menos um aluno): sem filtro. */
const situacoesQueFiltram = (s: readonly SituacaoCompromisso[]): SituacaoCompromisso[] => (s.length === OPCOES_SITUACAO.length ? [] : [...s]);

/** Lê o endereço. Membro só com a permissão de ver a equipe; situação só com `AGENDA_LER`. */
export function lerFiltrosDaAgenda(
  p: { meus?: string; membro?: string; situacao?: string | string[] },
  permissoes: { agenda: boolean; equipe: boolean },
): FiltrosDaAgenda {
  const responsavel = p.meus === 'true' ? SO_OS_MEUS : permissoes.equipe && p.membro ? p.membro : TODA_A_EQUIPE;
  return { responsavel, situacoes: permissoes.agenda ? lerSituacoes(p.situacao) : [] };
}

/** O que vai para o endereço (`router.setParams`): ausente = `undefined`, para o parâmetro sair. */
export function enderecoDaAgenda(f: FiltrosDaAgenda): { meus: string | undefined; membro: string | undefined; situacao: string | undefined } {
  return {
    meus: f.responsavel === SO_OS_MEUS ? 'true' : undefined,
    membro: f.responsavel && f.responsavel !== SO_OS_MEUS ? f.responsavel : undefined,
    situacao: parametroDasSituacoes(situacoesQueFiltram(f.situacoes)),
  };
}

/** Etiquetas dos filtros aplicados; o contador do botão é o número delas. Membro sem nome conhecido: "Membro da equipe". */
export function chipsDaAgenda(f: FiltrosDaAgenda, nomeDe: (id: string) => string | undefined): { chave: ChaveDoFiltroDaAgenda; texto: string }[] {
  const situacoes = situacoesQueFiltram(f.situacoes);
  const nomes = OPCOES_SITUACAO.filter((o) => situacoes.includes(o.valor)).map((o) => o.rotulo);
  return [
    ...(f.responsavel ? [{ chave: 'responsavel' as const, texto: `Responsável: ${f.responsavel === SO_OS_MEUS ? 'Só os meus' : nomeDe(f.responsavel) ?? 'Membro da equipe'}` }] : []),
    ...(nomes.length ? [{ chave: 'situacoes' as const, texto: `Compromissos: ${nomes.join(', ')}` }] : []),
  ];
}

export const semOFiltroDaAgenda = (f: FiltrosDaAgenda, chave: ChaveDoFiltroDaAgenda): FiltrosDaAgenda => ({ ...f, [chave]: AGENDA_SEM_FILTRO[chave] });
