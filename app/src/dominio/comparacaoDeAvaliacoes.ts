import type { AvaliacaoFisica, CampoDaMedida } from '../api/avaliacaoFisicaTipos';
import type { MetaDoPeso } from '../api/tipos';
import {
  COMPARAR_MAXIMO, COMPARAR_MINIMO, cmParaTela, diferenca, diferencaParaTela, MEDIDAS, pesoParaTela, serieDaMedida, valorAnterior, valorDaColuna,
  valorDaMedida, valorParaTabela, VARIACAO_SEM_VALOR, variacaoCurta, type ColunaDoHistorico, type VariacaoCurta,
} from './avaliacaoFisica';
import { dataCurta, dataParaTela } from './formatos';

/**
 * Regras da Avaliação física visual (plano `docs/planos/avaliacao-fisica-visual.md`, D2 e D3): grupos das medidas,
 * comparação de datas, histórico em tabela, resumo da evolução e pares direita × esquerda. Puro, sem React nem I/O. Só
 * números e datas: nada de soma de medidas nem classificação de assimetria; a única cor é a da meta do peso, nas colunas
 * de `COLUNAS_COM_META` (`variacaoCurta`).
 * Datas ISO `AAAA-MM-DD`, formatadas por fatiamento (nunca `new Date(iso)`, que muda o dia com o fuso).
 */

export const TEXTO_NAO_REGISTRADA = 'Não registrada';
export const TEXTO_INDISPONIVEL = 'Indisponível';

// ---------- Grupos ----------

export type IdDoGrupo = 'tronco' | 'bracos' | 'pernas';

/** Ordem fixa da tela e do PDF (D2). Cada medida de `MEDIDAS` está em exatamente um grupo (testado). */
export const GRUPOS_DE_MEDIDAS: readonly { id: IdDoGrupo; titulo: string; campos: readonly CampoDaMedida[] }[] = [
  { id: 'tronco', titulo: 'Tronco', campos: ['peitoral', 'cintura', 'abdomen', 'quadril'] },
  { id: 'bracos', titulo: 'Braços', campos: ['bracoDireito', 'bracoEsquerdo'] },
  { id: 'pernas', titulo: 'Pernas', campos: ['coxaDireita', 'coxaEsquerda', 'panturrilhaDireita', 'panturrilhaEsquerda'] },
];

export interface GrupoDeItens<T> {
  id: IdDoGrupo;
  titulo: string;
  itens: T[];
}

/**
 * Agrupa itens (qualquer coisa com `chave`) na ordem dos grupos e, dentro de cada um, na ordem das medidas do grupo (não a
 * da entrada). Grupo sem item não aparece. Chave que nenhum grupo conhece (ex.: "peso") não some: vai em `semGrupo`, na
 * ordem da entrada, para a tela mostrar num bloco "Outras".
 */
export function agruparMedidas<T extends { chave: string }>(itens: readonly T[]): { grupos: GrupoDeItens<T>[]; semGrupo: T[] } {
  const conhecidas = new Set<string>(GRUPOS_DE_MEDIDAS.flatMap((g) => g.campos));
  const grupos = GRUPOS_DE_MEDIDAS.map((g) => ({ id: g.id, titulo: g.titulo, itens: g.campos.flatMap((c) => itens.filter((i) => i.chave === c)) }))
    .filter((g) => g.itens.length > 0);
  return { grupos, semGrupo: itens.filter((i) => !conhecidas.has(i.chave)) };
}

// ---------- Variação ----------

export type DirecaoDaVariacao = 'aumento' | 'reducao' | 'igual' | 'indisponivel';

export interface VariacaoDaMedida {
  /** Última − primeira, 1 casa; nulo quando falta uma das duas pontas (nunca calculada a partir de zero). */
  valor: number | null;
  /** Só dado, sem juízo de bom ou ruim e sem cor. */
  direcao: DirecaoDaVariacao;
  /** "+0,8 cm", "−0,8 cm", "0,0 cm" ou "Indisponível". */
  texto: string;
}

function variacaoEntre(primeiro: number | null, ultimo: number | null, unidade: 'cm' | 'kg' = 'cm'): VariacaoDaMedida {
  const valor = diferenca(primeiro, ultimo, unidade === 'cm' ? 1 : 2);
  if (valor === null) return { valor: null, direcao: 'indisponivel', texto: TEXTO_INDISPONIVEL };
  return { valor, direcao: valor > 0 ? 'aumento' : valor < 0 ? 'reducao' : 'igual', texto: diferencaParaTela(valor, unidade) };
}

const emCm = (v: number): string => `${cmParaTela(v)} cm`;

// ---------- Comparação de 2 a 4 datas ----------

export interface ColunaComparada {
  id: string;
  /** ISO. */
  data: string;
  /** "dd/mm" quando todas as datas escolhidas são do mesmo ano; "dd/mm/aaaa" quando abrangem mais de um ano. */
  dataTexto: string;
}

/**
 * Regra única de data (D11): "dd/mm", e "dd/mm/aaaa" só quando as `datas` mostradas (ISO) abrangem mais de um ano (só então o
 * dd/mm sozinho ficaria ambíguo). Tela, gráfico e PDF usam esta função.
 */
export function formatadorDeDatas(datas: readonly string[]): (iso: string) => string {
  return new Set(datas.map((d) => d.slice(0, 4))).size > 1 ? dataParaTela : dataCurta;
}

export interface CelulaComparada {
  /** Nulo = não registrada nessa data. */
  valor: number | null;
  /** "35,2 cm" ou "Não registrada". */
  texto: string;
}

export interface LinhaComparada {
  chave: CampoDaMedida;
  rotulo: string;
  /** Uma célula por coluna, na ordem das colunas (cronológica). */
  celulas: CelulaComparada[];
  /** Última coluna − primeira. */
  variacao: VariacaoDaMedida;
}

export type ComparacaoDeAvaliacoes =
  | { estado: 'invalido'; motivo: 'poucas' | 'muitas'; mensagem: string }
  | {
      estado: 'ok';
      /** Em ordem cronológica, qualquer que tenha sido a ordem da seleção. */
      colunas: ColunaComparada[];
      /** "Variação = 13/11 menos 01/11." (2 datas) ou com "(primeira e última datas selecionadas)" (3 ou 4); com anos diferentes as datas levam o ano. */
      referencia: string;
      /** Só circunferências (o peso fica fora dos grupos), grupos e medidas na ordem fixa. Medida sem valor em nenhuma das datas não aparece. */
      grupos: GrupoDeItens<LinhaComparada>[];
    };

/**
 * Frase da referência da variação; com mais de 2 datas ela diz que usa a primeira e a última (nunca muda em silêncio).
 * Usa o `dataTexto` das colunas, que já é dd/mm ou dd/mm/aaaa conforme os anos das datas escolhidas.
 */
export function fraseDaReferencia(colunas: readonly ColunaComparada[]): string {
  const base = `Variação = ${colunas[colunas.length - 1].dataTexto} menos ${colunas[0].dataTexto}`;
  return colunas.length > COMPARAR_MINIMO ? `${base} (primeira e última datas selecionadas).` : `${base}.`;
}

/**
 * Compara as avaliações de `escolhidas` (ids; id que não está em `todas` e repetido são ignorados). Fora de 2 a 4 devolve
 * `estado: 'invalido'` com a mensagem (nunca lança). A variação é a da ÚLTIMA data menos a da PRIMEIRA.
 */
export function compararAvaliacoes(todas: readonly AvaliacaoFisica[], escolhidas: readonly string[]): ComparacaoDeAvaliacoes {
  const ids = new Set(escolhidas);
  const avaliacoes = todas.filter((a) => ids.has(a.id)).sort((a, b) => a.data.localeCompare(b.data));
  if (avaliacoes.length < COMPARAR_MINIMO) return { estado: 'invalido', motivo: 'poucas', mensagem: `Escolha pelo menos ${COMPARAR_MINIMO} datas para comparar.` };
  if (avaliacoes.length > COMPARAR_MAXIMO) return { estado: 'invalido', motivo: 'muitas', mensagem: `Compare no máximo ${COMPARAR_MAXIMO} datas.` };
  const formatar = formatadorDeDatas(avaliacoes.map((a) => a.data));
  const colunas = avaliacoes.map((a) => ({ id: a.id, data: a.data, dataTexto: formatar(a.data) }));
  const linhas = MEDIDAS.flatMap(({ campo, rotulo }): LinhaComparada[] => {
    const valores = avaliacoes.map((a) => valorDaMedida(a, campo));
    if (valores.every((v) => v === null)) return [];
    return [{
      chave: campo,
      rotulo,
      celulas: valores.map((valor) => ({ valor, texto: valor === null ? TEXTO_NAO_REGISTRADA : emCm(valor) })),
      variacao: variacaoEntre(valores[0], valores[valores.length - 1]),
    }];
  });
  return { estado: 'ok', colunas, referencia: fraseDaReferencia(colunas), grupos: agruparMedidas(linhas).grupos };
}

export interface LinhaDoPeso {
  /** Uma célula por coluna: o peso do registro da mesma data ("82 kg") ou "—" (valor nulo). */
  celulas: { valor: number | null; texto: string }[];
  /** Última − primeira em kg; só com as duas pontas, senão "Indisponível". */
  variacao: VariacaoDaMedida;
}

/** Peso do dia das `colunas` (informativo, fora dos grupos; tela e PDF). Nulo quando nenhuma das datas tem peso. */
export function linhaDoPeso(avaliacoes: readonly AvaliacaoFisica[], colunas: readonly ColunaComparada[]): LinhaDoPeso | null {
  const pesos = colunas.map((col) => avaliacoes.find((a) => a.id === col.id)?.pesoKg ?? null);
  if (pesos.every((p) => p === null)) return null;
  return {
    celulas: pesos.map((valor) => ({ valor, texto: pesoParaTela(valor) })),
    variacao: variacaoEntre(pesos[0], pesos[pesos.length - 1], 'kg'),
  };
}

// ---------- Resumo da evolução de uma medida ----------

export interface ResumoDaMedida {
  /** Pontos da série (datas que têm a medida). */
  pontos: number;
  /** Medida mais recente; nulo sem nenhum ponto. */
  ultima: { valor: number; data: string; dataTexto: string; dataCompleta: string; texto: string } | null;
  /** Último − primeiro ponto; nulo com menos de 2 pontos (um ponto só mostra só o valor, sem variação inventada). */
  variacao: VariacaoDaMedida | null;
  /** "desde 01/11" (data do primeiro ponto; "desde 01/11/2025" se for de ano diferente da última); nulo com menos de 2 pontos. */
  desde: string | null;
}

/** Resumo da Evolução: usa só as datas que têm a medida, ordenadas por data (a ausente não vira zero nem ponto). */
export function resumoDaMedida(avaliacoes: readonly AvaliacaoFisica[], campo: CampoDaMedida): ResumoDaMedida {
  const { pontos } = serieDaMedida(avaliacoes, campo);
  if (!pontos.length) return { pontos: 0, ultima: null, variacao: null, desde: null };
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  // `dataTexto` segue dd/mm (a tela e o PDF dependem dele); `dataCompleta` é sempre dd/mm/aaaa.
  const ultima = { valor: ultimo.valor, data: ultimo.data, dataTexto: dataCurta(ultimo.data), dataCompleta: dataParaTela(ultimo.data), texto: emCm(ultimo.valor) };
  if (pontos.length < 2) return { pontos: 1, ultima, variacao: null, desde: null };
  const formatar = formatadorDeDatas(pontos.map((p) => p.data));
  return { pontos: pontos.length, ultima, variacao: variacaoEntre(primeiro.valor, ultimo.valor), desde: `desde ${formatar(primeiro.data)}` };
}

// ---------- Seleção do Comparar ----------

/** Da data mais nova à mais antiga (o histórico e o selo "Mais recente" não dependem da ordem em que a API devolve). */
export function maisRecentesPrimeiro(avaliacoes: readonly AvaliacaoFisica[]): AvaliacaoFisica[] {
  return [...avaliacoes].sort((a, b) => b.data.localeCompare(a.data));
}

/** O "Comparar" abre nas duas últimas: ids das 2 avaliações mais recentes (mais antiga primeiro); com menos de 2, vazio. */
export function idsDasDuasUltimas(avaliacoes: readonly AvaliacaoFisica[]): string[] {
  if (avaliacoes.length < COMPARAR_MINIMO) return [];
  return maisRecentesPrimeiro(avaliacoes).slice(0, 2).map((a) => a.id).reverse();
}


// ---------- Pares direita × esquerda (2ª entrega) ----------

export type IdDoPar = 'braco' | 'coxa' | 'panturrilha';

/** Só estes pares fazem sentido (lados do mesmo segmento); peitoral, cintura, abdômen e quadril não têm par. */
export const PARES_DIREITA_ESQUERDA: readonly { id: IdDoPar; rotulo: string; direita: CampoDaMedida; esquerda: CampoDaMedida }[] = [
  { id: 'braco', rotulo: 'Braço', direita: 'bracoDireito', esquerda: 'bracoEsquerdo' },
  { id: 'coxa', rotulo: 'Coxa', direita: 'coxaDireita', esquerda: 'coxaEsquerda' },
  { id: 'panturrilha', rotulo: 'Panturrilha', direita: 'panturrilhaDireita', esquerda: 'panturrilhaEsquerda' },
];

export interface SerieDoLado {
  campo: CampoDaMedida;
  /** Rótulo da medida ("Braço direito"), para a legenda em texto. */
  rotulo: string;
  /** Só as datas que têm a medida, da mais antiga à mais nova; nunca interpolada. */
  pontos: { data: string; valor: number }[];
}

export interface SeriesDoPar {
  id: IdDoPar;
  rotulo: string;
  /** Sempre duas séries, no máximo (D5). */
  direita: SerieDoLado;
  esquerda: SerieDoLado;
  /** Os dois lados têm ao menos um ponto. Falta um lado: a tela mostra a série que existe e diz que o outro lado não foi registrado. */
  suficiente: boolean;
}

/** Séries direita e esquerda de um par (cada lado com os próprios pontos reais). Par que não existe devolve nulo. */
export function seriesDoPar(avaliacoes: readonly AvaliacaoFisica[], id: IdDoPar): SeriesDoPar | null {
  const par = PARES_DIREITA_ESQUERDA.find((p) => p.id === id);
  if (!par) return null;
  const lado = (campo: CampoDaMedida): SerieDoLado => ({
    campo,
    rotulo: MEDIDAS.find((m) => m.campo === campo)?.rotulo ?? '',
    pontos: serieDaMedida(avaliacoes, campo).pontos,
  });
  const direita = lado(par.direita);
  const esquerda = lado(par.esquerda);
  return { id: par.id, rotulo: par.rotulo, direita, esquerda, suficiente: direita.pontos.length > 0 && esquerda.pontos.length > 0 };
}

// ---------- Histórico em tabela (27/11) ----------

export interface ColunaDoGrupo {
  chave: ColunaDoHistorico;
  /** Nome completo ("Braço direito"), para o leitor de tela. */
  nome: string;
  /** Segundo nível do cabeçalho ("D", "Cintura", "kg"). */
  curto: string;
  /** Rótulo no cartão do celular ("Braço D", "Cintura", "Peso"). */
  etiqueta: string;
}

export interface GrupoDoHistorico {
  /** Primeiro nível do cabeçalho, já com a unidade ("Tronco (cm)"): as células não repetem "cm". */
  titulo: string;
  colunas: ColunaDoGrupo[];
}

const coluna = (chave: CampoDaMedida, curto: string, etiqueta = curto): ColunaDoGrupo => ({
  chave, nome: MEDIDAS.find((m) => m.campo === chave)?.rotulo ?? '', curto, etiqueta,
});

/**
 * Colunas do histórico na ordem do pedido (Data | Peso | Braço D E | Peitoral … Quadril | Coxa D E | Panturrilha D E) em
 * dois níveis: o tronco num grupo e cada membro no seu, com D e E embaixo (um grupo "Membros" só não caberia nessa ordem,
 * com o braço antes do tronco).
 */
export const GRUPOS_DO_HISTORICO: readonly GrupoDoHistorico[] = [
  { titulo: 'Peso', colunas: [{ chave: 'peso', nome: 'Peso', curto: 'kg', etiqueta: 'Peso' }] },
  { titulo: 'Braço (cm)', colunas: [coluna('bracoDireito', 'D', 'Braço D'), coluna('bracoEsquerdo', 'E', 'Braço E')] },
  { titulo: 'Tronco (cm)', colunas: [coluna('peitoral', 'Peitoral'), coluna('cintura', 'Cintura'), coluna('abdomen', 'Abdômen'), coluna('quadril', 'Quadril')] },
  { titulo: 'Coxa (cm)', colunas: [coluna('coxaDireita', 'D', 'Coxa D'), coluna('coxaEsquerda', 'E', 'Coxa E')] },
  { titulo: 'Panturrilha (cm)', colunas: [coluna('panturrilhaDireita', 'D', 'Panturrilha D'), coluna('panturrilhaEsquerda', 'E', 'Panturrilha E')] },
];

export interface CelulaDoHistorico {
  /** "39,5", "90,0" ou "—". */
  texto: string;
  /** Desde a avaliação anterior que tem a coluna. */
  variacao: VariacaoCurta;
}

/** As células de uma avaliação do histórico: valor e variação desde a anterior que mediu (a ausente não vira zero). */
export function linhaDoHistorico(avaliacoes: readonly AvaliacaoFisica[], a: AvaliacaoFisica, meta: MetaDoPeso | null | undefined): Record<ColunaDoHistorico, CelulaDoHistorico> {
  const celulas = {} as Record<ColunaDoHistorico, CelulaDoHistorico>;
  for (const g of GRUPOS_DO_HISTORICO) for (const { chave } of g.colunas) {
    const atual = valorDaColuna(a, chave);
    celulas[chave] = { texto: valorParaTabela(chave, atual), variacao: variacaoCurta(chave, valorAnterior(avaliacoes, chave, a.data, a.id), atual, meta) };
  }
  return celulas;
}

export interface LinhaDaDiferenca {
  chave: ColunaDoHistorico;
  nome: string;
  /** "87,0 → 85,5" ("—" no lado que não mediu). */
  valores: string;
  /** "▼ 1,5 cm"/"▲ 0,4 kg" ou "—"; com a cor da meta só nas colunas que a têm. */
  variacao: VariacaoCurta;
}

/**
 * Comparar duas datas (o botão do histórico): a diferença da mais nova menos a mais antiga, qualquer que seja a ordem
 * escolhida. Fica de fora a coluna sem valor nas duas datas. Vazio com menos de duas avaliações distintas.
 */
export function diferencaEntre(avaliacoes: readonly AvaliacaoFisica[], idA: string, idB: string, meta: MetaDoPeso | null | undefined): LinhaDaDiferenca[] {
  const [antiga, nova] = avaliacoes.filter((a) => a.id === idA || a.id === idB).sort((x, y) => x.data.localeCompare(y.data));
  if (!antiga || !nova || idA === idB) return [];
  return GRUPOS_DO_HISTORICO.flatMap((g) => g.colunas).flatMap(({ chave, nome }): LinhaDaDiferenca[] => {
    const de = valorDaColuna(antiga, chave);
    const ate = valorDaColuna(nova, chave);
    if (de === null && ate === null) return [];
    // Aqui um lado vazio é a medida não preenchida numa das datas escolhidas (não a "Primeira"): "—".
    const v = de === null ? VARIACAO_SEM_VALOR : variacaoCurta(chave, de, ate, meta);
    const unidade = chave === 'peso' ? 'kg' : 'cm';
    return [{ chave, nome, valores: `${valorParaTabela(chave, de)} → ${valorParaTabela(chave, ate)}`, variacao: v.tipo === 'mudou' || v.tipo === 'igual' ? { ...v, texto: `${v.texto} ${unidade}` } : v }];
  });
}
