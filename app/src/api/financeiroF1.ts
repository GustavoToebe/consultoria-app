import { requisicao } from './cliente';
import type { ContratacaoResponse, ContratarRequest, FormasDeRecebimento } from './financeiroTipos';

/**
 * Tipos e chamadas da Fase 1.1 do financeiro (D10 e D12 de `docs/planos/financeiro-em-fases.md`, contrato de 18/11). Moram
 * aqui, e não em `financeiroTipos.ts`/`rotas.ts`, para não disputar arquivo com outra frente; podem ir para lá depois.
 */

/**
 * Corpo do contratar com a escolha dos meses anteriores. `gerarMesesAnteriores` vai sempre (desligado ou sem o interruptor
 * na tela = `false`): `false` grava a data de início e as cobranças começam na competência do mês corrente.
 */
export interface ContratarComGeracaoRequest extends ContratarRequest {
  gerarMesesAnteriores: boolean;
}

/**
 * `POST /contratacoes/previa-de-geracao` (só leitura, `FINANCEIRO_ALTERAR`): quantas mensalidades nasceriam em aberto e o
 * total. O app só formata; nunca calcula. Quantidade 0 e total 0 = nada nasce além do que já existe. Competências `AAAA-MM`.
 */
export interface PreviaDeGeracao {
  quantidade: number;
  totalCentavos: number;
  primeiraCompetencia: string | null;
  ultimaCompetencia: string | null;
}

const seg = (valor: string) => encodeURIComponent(valor);

/** Substitui o `contratarPlano` de `rotas.ts`, que não manda `gerarMesesAnteriores`. */
export const contratarPlano = (alunoId: string, corpo: ContratarComGeracaoRequest) =>
  requisicao<ContratacaoResponse>(`/alunos/${seg(alunoId)}/contratacoes`, { metodo: 'POST', corpo });

/** O mesmo corpo do contratar, mais o `alunoId` (a rota não o tem no caminho). */
export const previaDeGeracao = (corpo: ContratarComGeracaoRequest & { alunoId: string }) =>
  requisicao<PreviaDeGeracao>('/contratacoes/previa-de-geracao', { metodo: 'POST', corpo });

/**
 * `POST /financeiro/formas-de-recebimento/pix/apagar` com `{versao}` (`FINANCEIRO_ALTERAR`): zera chave, nome e cidade e desliga
 * o Pix. Responde o mesmo corpo do `GET` (Pix desligado, sem chave); versão velha = 409 `CONFLITO_EDICAO`.
 */
export const apagarDadosDoPix = (versao: number) =>
  requisicao<FormasDeRecebimento>('/financeiro/formas-de-recebimento/pix/apagar', { metodo: 'POST', corpo: { versao } });
