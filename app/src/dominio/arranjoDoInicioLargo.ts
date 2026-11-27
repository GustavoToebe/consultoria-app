import type { FaixaDeLargura } from '../tema/tokens';
import { AREA_MINIMA_LADO_A_LADO } from './arranjoPrincipalComApoio';
import type { RegraDaPeca } from './colunasMedidas';

/**
 * Início do aluno no computador (27/11, no padrão do treinador): o contêiner é o da `Tela` (preenche a área; Limitada para
 * em 1800) e o arranjo sai daqui. Abaixo da área em que a `PrincipalComApoio` abre lado a lado, o celular e o tablet de
 * sempre (`arranjoDoInicio.linhasDoInicio`). Pura: a tela só monta.
 *
 * - `duas` (da área lado a lado até a faixa `normal`; 1280 com o menu aberto mede ~1000 e cai aqui): principal com o Hoje,
 *   a Dieta de hoje, os compromissos, Sua semana e Seu nível numa pilha; apoio (380, fixo ao rolar) só com pendências e
 *   Água. Com a semana e o nível também no apoio ele passava da altura da janela (1280x720, 1536x864) e era cortado.
 * - `colunas` (faixas `larga` e `ultralarga`): todos os blocos em colunas da mesma largura, empilhados pela altura MEDIDA
 *   (`aluno/inicio/ColunasMedidas`, regra em `colunasMedidas`): o Hoje abre a primeira, a Dieta de hoje a segunda e as
 *   pendências (sem elas, a Água) a última; Água, semana, nível e compromissos vão para onde as colunas terminam mais perto
 *   (auditoria de 27/11: com o apoio fixo e a principal por peso estimado sobravam 120 a 230 px de vão embaixo do Hoje, da
 *   Dieta e da Água). Sempre três (`COLUNAS_DO_INICIO_LARGO`): em 3440, quatro de ~760 deixavam ~90 px sob o Hoje (o bloco
 *   mais alto e indivisível, sozinho na coluna dele); três de ~1030 terminam juntas (capturas de 27/11).
 *   Com poucos blocos (sem pendências nem compromissos) três não fecham (~100 px): a peça cai para duas, que fecham.
 * Embaixo, nas duas: o ano de treinos e a vitrine. Nenhum bloco remonta quando a API responde (pendências, nível e mapa leem
 * a API ao montar): nas colunas eles só mudam de posição.
 */

export type ArranjoDoInicioLargo = 'comum' | 'duas' | 'colunas';

export function arranjoDoInicioLargo(largura: number, faixa: FaixaDeLargura): ArranjoDoInicioLargo {
  if (!(largura >= AREA_MINIMA_LADO_A_LADO)) return 'comum';
  return faixa === 'larga' || faixa === 'ultralarga' ? 'colunas' : 'duas';
}

export type BlocoDoInicioLargo = 'hoje' | 'dieta' | 'compromissos' | 'pendencias' | 'agua' | 'semana' | 'nivel';

/** `duas`: a principal (pilha, na ordem de leitura) e o apoio (o que pede ação), fixo ao rolar. */
export const PECAS_DE_DUAS: { principal: BlocoDoInicioLargo[]; apoio: BlocoDoInicioLargo[] } = {
  principal: ['hoje', 'dieta', 'compromissos', 'semana', 'nivel'],
  apoio: ['pendencias', 'agua'],
};

/** `colunas`: a ordem de leitura (a do DOM e a de empilhar dentro de cada coluna) e a regra de cada bloco. */
export const PECAS_DAS_COLUNAS: BlocoDoInicioLargo[] = ['hoje', 'dieta', 'pendencias', 'agua', 'semana', 'nivel', 'compromissos'];
export const REGRAS_DAS_COLUNAS: Partial<Record<BlocoDoInicioLargo, RegraDaPeca>> = {
  hoje: { coluna: 0 }, dieta: { coluna: 1 }, pendencias: { abreAUltima: true }, agua: { abreAUltima: true },
};

export const COLUNAS_DO_INICIO_LARGO = 3;

/**
 * O ano de treinos não passa de ~1352 px de cartão (célula de 22 com 2 de folga, a regra do `MapaDeTreinos`). Com a vitrine
 * e espaço para ao menos dois produtos ao lado, ela entra na mesma linha, à direita, em vez de deixar o cartão do mapa com
 * a metade vazia; senão, uma linha cada, o mapa primeiro.
 */
export const LARGURA_DO_MAPA_CHEIO = 1352;
export const CELULA_DA_VITRINE = 240;
export const CELULA_MAXIMA_DA_VITRINE = 320;

export function mapaAoLadoDaVitrine(largura: number, vitrine: boolean, mapa: boolean, vao: number): boolean {
  // 2 produtos + o vão entre eles + o recuo do cartão (2 × 20).
  return vitrine && mapa && largura >= LARGURA_DO_MAPA_CHEIO + vao + 2 * CELULA_DA_VITRINE + vao + 40;
}

/**
 * Fileira da vitrine: quantos produtos cabem numa linha (célula de pelo menos 240), no máximo os que existem; cada um até
 * 320, e a sobra fica no fim da linha (cartão de produto não estica). O resto está em "Ver tudo".
 */
export function fileiraDaVitrine(largura: number, itens: number, vao: number): { quantos: number; celula: number } {
  if (!(largura > 0) || itens <= 0) return { quantos: Math.max(0, Math.min(itens, 1)), celula: CELULA_DA_VITRINE };
  const quantos = Math.max(1, Math.min(itens, Math.floor((largura + vao) / (CELULA_DA_VITRINE + vao))));
  const celula = Math.min(CELULA_MAXIMA_DA_VITRINE, (largura - vao * (quantos - 1)) / quantos);
  return { quantos, celula };
}
