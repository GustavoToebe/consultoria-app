import { requisicao } from './cliente';

/**
 * Responsável financeiro do aluno (D15 de `docs/planos/financeiro-em-fases.md`, frente F5, V092). No máximo um por aluno; é
 * dado pessoal de terceiro: nunca em log, `console`, título de aba nem mensagem de erro. Todas as rotas ficam atrás do
 * Financeiro ligado (sem ele, 503 `FINANCEIRO_INDISPONIVEL`).
 *
 * - `GET /alunos/{id}/responsavel-financeiro` (`FINANCEIRO_LER` + `ALUNO_LER`): sem responsável = 200 com tudo nulo e
 *   `versao` nula. `cpf` só vem com `ALUNO_SENSIVEL_LER`; telefone e CPF chegam formatados.
 * - `PUT` (`FINANCEIRO_ALTERAR`): substitui tudo (opcional nulo ou em branco apaga); criar sem `versao`, alterar com a atual;
 *   409 `CONFLITO_EDICAO`; 422 `RESPONSAVEL_INVALIDO` por campo; 409 `ALUNO_ANONIMIZADO`; 404 outro aluno ou consultoria.
 *   Sem `ALUNO_SENSIVEL_LER` o `cpf` do corpo é ignorado (o gravado fica). Responde como o GET.
 * - `DELETE ?versao=` (`FINANCEIRO_ALTERAR`): 204, idempotente; versão informada e diferente = 409 `CONFLITO_EDICAO`.
 */
export interface ResponsavelFinanceiro {
  nome: string | null;
  parentesco: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  /** Nula = o aluno não tem responsável. */
  versao: number | null;
  atualizadoEm: string | null;
}

export interface ResponsavelFinanceiroRequest {
  nome: string;
  parentesco: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  /** Nula só ao criar. */
  versao: number | null;
}

const caminho = (alunoId: string) => `/alunos/${encodeURIComponent(alunoId)}/responsavel-financeiro`;

export const buscarResponsavelFinanceiro = (alunoId: string) => requisicao<ResponsavelFinanceiro>(caminho(alunoId));

export const salvarResponsavelFinanceiro = (alunoId: string, corpo: ResponsavelFinanceiroRequest) =>
  requisicao<ResponsavelFinanceiro>(caminho(alunoId), { metodo: 'PUT', corpo });

/** Leva sempre a versão que a tela viu: é ela que acusa a remoção sobre uma alteração de outra pessoa. */
export const removerResponsavelFinanceiro = (alunoId: string, versao: number) =>
  requisicao<void>(`${caminho(alunoId)}?versao=${versao}`, { metodo: 'DELETE' });
