import { ErroApi } from '@plataforma/web';

/**
 * "Convidar um amigo" na Conta do aluno (passo 3 de `docs/planos/indicacao-de-alunos.md`). O aluno só recebe o link
 * (`GET /aluno/indicacao`): nunca contagem, nome nem situação de quem se inscreveu, e o app não guarda nada no aparelho.
 */

export const TITULO_DO_CONVITE = 'Convidar um amigo';
export const DESCRICAO_DO_CONVITE = 'Mande o seu link de inscrição para quem também quer treinar.';
export const PRIVACIDADE_DO_CONVITE =
  'Quando alguém se inscrever pelo seu link, o seu treinador vê que foi você. Você não vê quem se inscreveu.';

export type SituacaoDoConvite = 'oculto' | 'carregando' | 'erro' | 'pronto';

/**
 * O que o cartão mostra. Some sem internet (como os outros cartões da Conta que dependem da rede), sem link de
 * inscrição aberto na consultoria (404) e na conta anonimizada (409): nenhum desses é falha que "Tentar de novo" resolve.
 */
export function situacaoDoConvite(online: boolean, dados: { link: string } | undefined, erro: unknown): SituacaoDoConvite {
  if (!online) return 'oculto';
  if (erro) {
    if (erro instanceof ErroApi && (erro.semConexao || erro.status === 404 || erro.codigo === 'ALUNO_ANONIMIZADO')) return 'oculto';
    return 'erro';
  }
  return dados ? 'pronto' : 'carregando';
}

/** "Compartilhar" só onde há a folha do sistema: sempre no celular; na web, só com `navigator.share` (senão, só copiar). */
export function podeCompartilhar(plataforma: string, temShareDoNavegador: boolean): boolean {
  return plataforma !== 'web' || temShareDoNavegador;
}

/** Fechar a folha de compartilhar sem escolher (web: `AbortError`) não é erro e não gera aviso. */
export function compartilharFoiCancelado(erro: unknown): boolean {
  return erro instanceof Error && erro.name === 'AbortError';
}
