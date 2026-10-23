import type { CombinacaoDaMetodologia, TecnicaDaMetodologia, TipoDeSerie, TipoDeTecnica } from '../api/tipos';
import { rotuloDoPapel } from './metodologia';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';

/**
 * Catálogo do que uma consultoria pode acrescentar à metodologia. A padrão continua com 5 tipos, 6 técnicas e 7
 * combinações (`metodologiaPadrao.ts`); daqui só se copia. Os cinco tipos e as seis técnicas de hoje são os mesmos
 * objetos da padrão. As onze técnicas novas são descritivas (sem padrão). Nenhuma combinação nova.
 */

const copia = <T>(valor: T): T => structuredClone(valor);

function tipoNovo(codigo: string, nome: string, papel: TipoDeSerie['papel'], explicacao: string): TipoDeSerie {
  return { codigo, nome, papel, repeticoes: null, cargaPadrao: null, esforcoPadrao: null, porModalidade: null, regraPercentuais: null, explicacao };
}

/** Os onze tipos: os cinco da padrão e os seis novos, sem faixa, sem carga, sem esforço e sem variação por modalidade. */
export const CATALOGO_DE_TIPOS: readonly TipoDeSerie[] = [
  ...CONFIGURACAO_PADRAO.tipos.map(copia),
  tipoNovo('ATIVACAO', 'Ativação', 'AQUECIMENTO', 'Série bem leve para ativar o músculo antes do exercício. Não é para cansar.'),
  tipoNovo('RECONHECIMENTO', 'Reconhecimento', 'PREPARACAO', 'Série leve para sentir a carga e ajustar o aparelho antes das séries de trabalho.'),
  tipoNovo('TESTE', 'Série de teste', 'TRABALHO', 'Série para descobrir sua carga ou quantas repetições você consegue com boa execução. O treinador usa o resultado para ajustar o treino.'),
  tipoNovo('FINALIZADORA', 'Finalizadora', 'POS_TRABALHO', 'Série extra no fim do exercício, com carga leve a moderada.'),
  tipoNovo('SERIE_TECNICA', 'Série técnica', 'OUTRO', 'Série leve só para treinar o movimento. Capriche na execução.'),
  tipoNovo('DESCARGA', 'Descarga', 'OUTRO', 'Série com carga e volume menores de propósito, para recuperar.'),
];

export interface TecnicaDoCatalogo {
  tipo: TipoDeTecnica;
  grupo: string;
  item: TecnicaDaMetodologia;
}

const descritiva = (tipo: TipoDeTecnica, nome: string, grupo: string, explicacao: string): TecnicaDoCatalogo => ({
  tipo,
  grupo,
  item: { tipo, nome, explicacao, padrao: null },
});

const doPadrao = (tipo: TipoDeTecnica, grupo: string): TecnicaDoCatalogo => {
  const item = CONFIGURACAO_PADRAO.tecnicas.find((t) => t.tipo === tipo);
  if (!item) throw new Error(`Técnica ${tipo} ausente da metodologia padrão.`);
  return { tipo, grupo, item: copia(item) };
};

/** As dezessete técnicas, na ordem do catálogo, já com o grupo da folha. */
export const CATALOGO_DE_TECNICAS: readonly TecnicaDoCatalogo[] = [
  doPadrao('REST_PAUSE', 'Intensificação'),
  doPadrao('CLUSTER', 'Intensificação'),
  doPadrao('DROP_SET', 'Intensificação'),
  doPadrao('MYO_REPS', 'Intensificação'),
  doPadrao('PARTIAL_REPS', 'Intensificação'),
  doPadrao('FORCED_REPS', 'Intensificação'),
  descritiva('NEGATIVA', 'Negativa', 'Execução', 'Desça a carga devagar e controlando, em cerca de 3 a 5 segundos, e suba normalmente. Use uma carga que você consegue subir sozinho.'),
  descritiva('SUPER_SLOW', 'Super-slow', 'Execução', 'Todas as fases do movimento bem lentas, na cadência indicada. Use uma carga menor que a de costume.'),
  descritiva('VINTE_E_UM', '21s', 'Execução', '7 repetições na metade de baixo do movimento, 7 na metade de cima e 7 completas, sem descanso entre as partes.'),
  descritiva('PIRAMIDE_CRESCENTE', 'Pirâmide crescente', 'Pirâmides e progressão', 'A cada série a carga sobe e as repetições diminuem. Não precisa levar todas as séries à falha.'),
  descritiva('PIRAMIDE_DECRESCENTE', 'Pirâmide decrescente', 'Pirâmides e progressão', 'Comece pela série mais pesada (depois do aquecimento) e, a cada série, reduza a carga e faça mais repetições.'),
  descritiva('PIRAMIDE_TRUNCADA', 'Pirâmide truncada', 'Pirâmides e progressão', 'Só a parte que sobe: a carga aumenta aos poucos a cada série, sem descer depois.'),
  descritiva('DUPLA_PROGRESSAO', 'Dupla progressão', 'Pirâmides e progressão', 'Trabalhe dentro da faixa de repetições. Quando fizer o topo da faixa em todas as séries com boa execução, aumente a carga no próximo treino.'),
  descritiva('GVT', 'GVT (10×10)', 'Estrutura e especialização', '10 séries de 10 repetições com a mesma carga e o mesmo descanso entre as séries. Mantenha a execução do começo ao fim.'),
  descritiva('FST7', 'FST-7', 'Estrutura e especialização', 'No fim do treino do músculo, 7 séries do mesmo exercício com descanso curto entre elas.'),
  descritiva('ESPECIALIZACAO', 'Especialização', 'Estrutura e especialização', 'Este músculo recebe mais séries que os outros por um período. Siga a ordem e o descanso indicados.'),
  descritiva('EMOM', 'EMOM', 'Condicionamento', 'No começo de cada minuto faça as repetições indicadas e descanse o resto do minuto. Repita pelo número de minutos da prescrição.'),
];

/** As sete combinações de hoje, com o nome e a explicação da padrão. Nenhuma nova. */
export const CATALOGO_DE_COMBINACOES: readonly CombinacaoDaMetodologia[] = CONFIGURACAO_PADRAO.combinacoes.map(copia);

/** Explicação do catálogo, para o aluno ler quando a metodologia do plano não tem a técnica (é o caso da receita). */
export function explicacaoDoCatalogo(tipo: string | null | undefined): string | null {
  return CATALOGO_DE_TECNICAS.find((t) => t.tipo === tipo)?.item.explicacao ?? null;
}

/** Primeira linha da explicação: até a primeira quebra ou o fim da primeira frase. */
export function primeiraLinha(texto: string | null | undefined): string {
  const linha = (texto ?? '').split('\n')[0]?.trim() ?? '';
  const corte = linha.search(/\.(\s|$)/);
  return corte >= 0 ? linha.slice(0, corte + 1) : linha;
}

export function papelDoTipo(tipo: TipoDeSerie): string {
  return rotuloDoPapel(tipo.papel);
}
