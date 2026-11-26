import { requisicao } from './cliente';
import type { PlanoResumo, TipoPlano } from './tipos';

/**
 * Liberação agendada do plano (bloco E de `docs/planos/atualizacao-pasta-e-questionarios.md`). Publicar com data cria a
 * versão normalmente, mas o aluno continua vendo a anterior até o dia (Brasília). "Alterar data" e "Liberar agora" sobem a
 * `versao` do plano: quem chama recarrega a lista (senão o próximo salvar ou "Publicar tudo" dá 409).
 */

/**
 * O que a publicação (de um plano ou da pasta) leva além de `versao`/`confirmarAvisos`. `{}` = libera na hora e avisa
 * (padrão da API); o app só manda o que foge disso (`dominio/liberacaoDePlano.corpoDaLiberacao`).
 */
export interface CorpoDaLiberacao {
  /** `AAAA-MM-DD`, de amanhã (Brasília) até 31/12 de hoje + 5 anos; fora disso 422 `LIBERACAO_INVALIDA` no campo `liberarEm`. */
  liberarEm?: string;
  /** Ausente = avisa. */
  avisarAluno?: boolean;
}

const PREFIXOS: Record<TipoPlano, string> = { treino: 'planos-treino', dieta: 'planos-dieta', mobilidade: 'planos-mobilidade' };
const caminho = (tipo: TipoPlano, id: string, acao: string) => `/${PREFIXOS[tipo]}/${encodeURIComponent(id)}/${acao}`;

/** Troca o dia da liberação do plano agendado. 422 `LIBERACAO_INVALIDA`; 409 `PLANO_NAO_AGENDADO` (já liberado); 404. */
export const alterarLiberacao = (tipo: TipoPlano, id: string, liberarEm: string) =>
  requisicao<PlanoResumo>(caminho(tipo, id, 'liberacao'), { metodo: 'PUT', corpo: { liberarEm } });

/** Antecipa a liberação: o aluno passa a ver a versão agendada já. 409 `PLANO_NAO_AGENDADO`; 404. */
export const liberarAgora = (tipo: TipoPlano, id: string, avisarAluno: boolean) =>
  requisicao<PlanoResumo>(caminho(tipo, id, 'liberar-agora'), { metodo: 'POST', corpo: { avisarAluno } });
