import { ErroApi } from '@plataforma/web';

import type { ContratoDoAlunoResumo } from '../api/contratos';

/**
 * Trava do acesso por contrato pendente vencido (`docs/planos/contrato-digital.md`, D3, D5, D8, D19, D21 e S7): a API barra
 * com 403 `CONTRATO_PENDENTE` quem tem contrato `PENDENTE` com o prazo passado, fora da lista fechada de rotas, e o `GET /eu`
 * traz `aluno.contratoPendenteVencido` para o app mostrar a tela certa também sem internet.
 */

/** Código que a API devolve (403) em qualquer rota do aluno fora da lista quando há contrato pendente vencido. */
export const CODIGO_CONTRATO_PENDENTE = 'CONTRATO_PENDENTE';

/** O erro é a trava do contrato (403 `CONTRATO_PENDENTE`)? Quem pega recarrega o perfil para a tela de assinar aparecer. */
export function ehContratoPendente(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 403 && erro.codigo === CODIGO_CONTRATO_PENDENTE;
}

type Resumo = Pick<ContratoDoAlunoResumo, 'id' | 'signatario' | 'situacao' | 'prazoAte' | 'vencido' | 'geradoEm'>;

const pendentesVencidos = <T extends Resumo>(lista: readonly T[]) => lista.filter((c) => c.situacao === 'PENDENTE' && c.vencido);

/**
 * O contrato que o aluno assina para sair da trava: pendente, vencido e dele (`ALUNO`; o do responsável só o responsável
 * assina, pelo link). Mais urgente: o prazo mais antigo e, empatado, o gerado antes. Sem nenhum, `null`.
 */
export function contratoQueTrava<T extends Resumo>(contratos: readonly T[] | null | undefined): T | null {
  const doAluno = pendentesVencidos(contratos ?? []).filter((c) => c.signatario === 'ALUNO');
  return [...doAluno].sort((a, b) =>
    (a.prazoAte ?? '').localeCompare(b.prazoAte ?? '') || a.geradoEm.localeCompare(b.geradoEm))[0] ?? null;
}

/**
 * Qual tela o aluno vê. A do contrato vem antes da pausa por atraso (D21: com as duas, a do contrato com a frase da pausa
 * abaixo; assinado, cai na pausa). Na do contrato:
 * - `assinar`: há contrato vencido dele, o botão leva a `contratoId`;
 * - `aguardaResponsavel`: todos os vencidos são do responsável (D8), o aluno não tem o que assinar;
 * - `semLista`: a lista ainda não chegou (carregando, sem internet ou erro);
 * - `semVencido`: a lista chegou sem nenhum vencido, ou seja, a marca do perfil está velha (alguém assinou, cancelou ou
 *   prorrogou): a tela recarrega o perfil.
 */
export type SituacaoDaTrava =
  | { tela: 'nenhuma' }
  | { tela: 'pausa' }
  | { tela: 'contrato'; comPausa: boolean; variante: 'assinar'; contratoId: string }
  | { tela: 'contrato'; comPausa: boolean; variante: 'aguardaResponsavel' | 'semLista' | 'semVencido' };

export function situacaoDaTrava({ contratoPendenteVencido, acessoPausado, contratos }: {
  contratoPendenteVencido: boolean;
  acessoPausado: boolean;
  contratos?: readonly Resumo[] | null;
}): SituacaoDaTrava {
  if (!contratoPendenteVencido) return acessoPausado ? { tela: 'pausa' } : { tela: 'nenhuma' };
  const comPausa = acessoPausado;
  if (!contratos) return { tela: 'contrato', comPausa, variante: 'semLista' };
  const trava = contratoQueTrava(contratos);
  if (trava) return { tela: 'contrato', comPausa, variante: 'assinar', contratoId: trava.id };
  return { tela: 'contrato', comPausa, variante: pendentesVencidos(contratos).length > 0 ? 'aguardaResponsavel' : 'semVencido' };
}

// ---- prazo da consultoria (S6) ----

export const PRAZO_MINIMO_DIAS = 1;
export const PRAZO_MAXIMO_DIAS = 60;
export const ERRO_DO_PRAZO = `Informe um número inteiro de ${PRAZO_MINIMO_DIAS} a ${PRAZO_MAXIMO_DIAS} dias.`;

/**
 * Lê os dias digitados (tolerante a espaço e ao "dias" escrito junto): inteiro de 1 a 60, senão o erro do campo. A API
 * confere de novo (422 no campo `prazoDias`).
 */
export function lerPrazoDias(texto: string): { valor: number; erro: null } | { valor: null; erro: string } {
  const limpo = texto.trim().replace(/\s*dias?$/i, '');
  if (!/^\d{1,3}$/.test(limpo)) return { valor: null, erro: ERRO_DO_PRAZO };
  const n = Number(limpo);
  return n >= PRAZO_MINIMO_DIAS && n <= PRAZO_MAXIMO_DIAS ? { valor: n, erro: null } : { valor: null, erro: ERRO_DO_PRAZO };
}

/** Como o prazo gravado aparece só para leitura (sem `CONTRATO_ALTERAR`). */
export function textoDoPrazo(prazoDias: number | null): string {
  if (prazoDias === null) return 'Não trava o acesso';
  return `Trava o acesso depois de ${prazoDias === 1 ? '1 dia' : `${prazoDias} dias`}`;
}
