import type { PerguntaDaRegra, RegraDeAtencao, RegrasDeAtencaoResposta } from '../src/api/tipos';

/**
 * Dados fictícios das regras de atenção (`e2e/regras-de-atencao.spec.ts`): perguntas inventadas de questionários inventados,
 * nenhum dado de pessoa. Uma regra de tipo que o app não conhece (`TIPO_FUTURO`) confere que o lote a devolve intacta.
 */
export const QUESTIONARIO = { id: 'q0000000-0000-4000-8000-000000000001', nome: 'Padrão da consultoria' };
const OUTRO_QUESTIONARIO = { id: 'q0000000-0000-4000-8000-000000000002', nome: 'Check-in mensal' };

export const PERGUNTAS: PerguntaDaRegra[] = [
  { perguntaId: 'sono', tipo: 'NOTA', rotulo: 'Sono', escala: { min: 0, max: 10 }, questionarios: [QUESTIONARIO] },
  { perguntaId: 'energia', tipo: 'NOTA', rotulo: 'Energia nos treinos', escala: { min: 1, max: 5 }, questionarios: [QUESTIONARIO, OUTRO_QUESTIONARIO] },
  { perguntaId: 'dores', tipo: 'SIM_NAO', rotulo: 'Sentiu dores', escala: null, questionarios: [QUESTIONARIO] },
];

export const REGRA_CAIU: RegraDeAtencao = { id: 'r0000000-0000-4000-8000-000000000001', tipo: 'NOTA_CAIU', perguntaId: null, limite: 2, ativa: true };
/** Tipo de uma versão futura da API: o app não mostra, mas tem de devolver no lote (senão apagaria). */
export const REGRA_DESCONHECIDA = {
  id: 'r0000000-0000-4000-8000-000000000009', tipo: 'TIPO_FUTURO', perguntaId: null, limite: 7, ativa: true,
} as unknown as RegraDeAtencao;

export const resposta = (p: Partial<RegrasDeAtencaoResposta> = {}): RegrasDeAtencaoResposta => ({
  versao: 3, teto: 50, regras: [REGRA_CAIU, REGRA_DESCONHECIDA], perguntas: PERGUNTAS, ...p,
});
