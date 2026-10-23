import type { Configuracao, Esforco, ModoDeCarga, Problema, Serie, TecnicaDeGrupo, TipoDeTecnica } from '../../api/tipos';
import { metaDaSerie } from '../../dominio/cargas';
import { textoTecnicaPorExtenso } from '../../dominio/agrupamento';
import {
  nomeDaCombinacao,
  nomeDaSerieDeTrabalho,
  nomeDaTecnica,
  nomeDoTipo,
  TIPOS_DE_GRUPO,
  tipoPorCodigo,
} from '../../dominio/metodologia';
import { serieDeTrabalho } from '../../dominio/validacaoDoTreino';
import { esforcoVazio, type Problemas } from '../../dominio/validacaoDeSerie';

/**
 * Decisões do editor de séries que não dependem de tela: opções dos seletores, o que aparece em exercício de cardio, a
 * prévia "Para o aluno" e a divisão dos problemas da validação por série. As telas só desenham o que sai daqui, então a
 * regra fica testável sem renderizar nada.
 */

// ---- Esforço ----

export type FormaDeEsforco = 'NENHUM' | 'RIR' | 'RPE';

/** Qual das formas o esforço usa (RIR ou RPE, nunca os dois); vazio = nenhum. */
export function formaDoEsforco(e: Esforco | null | undefined): FormaDeEsforco {
  if (esforcoVazio(e)) return 'NENHUM';
  return e?.rir != null ? 'RIR' : 'RPE';
}

export const FORMAS_DE_ESFORCO: { valor: FormaDeEsforco; rotulo: string }[] = [
  { valor: 'NENHUM', rotulo: 'Sem esforço' },
  { valor: 'RIR', rotulo: 'RIR (repetições na reserva)' },
  { valor: 'RPE', rotulo: 'RPE (esforço percebido)' },
];

/** RIR de 0 a 5; o 0 diz o que significa. */
export const OPCOES_DE_RIR: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: '0 · até a falha técnica' },
  ...[1, 2, 3, 4, 5].map((valor) => ({ valor, rotulo: String(valor) })),
];

// ---- Tipo, técnica e combinação ----

export interface OpcaoDeTipo {
  /** Código do tipo (é o que a série grava). */
  valor: string;
  /** Nome exibido; um tipo que não está na metodologia aparece pelo código. */
  rotulo: string;
  foraDaMetodologia: boolean;
}

/**
 * Tipos para escolher: os da metodologia na ordem dela, mostrando o NOME, e depois os códigos que as séries já usam e a
 * metodologia não tem (a publicação só avisa).
 */
export function opcoesDeTipo(config: Configuracao | null | undefined, series: readonly Pick<Serie, 'tipo'>[]): OpcaoDeTipo[] {
  const daMetodologia = (config?.tipos ?? []).map((t) => ({ valor: t.codigo, rotulo: t.nome.trim() || t.codigo, foraDaMetodologia: false }));
  const conhecidos = new Set(daMetodologia.map((o) => o.valor));
  const fora: OpcaoDeTipo[] = [];
  for (const s of series) {
    const codigo = s.tipo?.trim();
    if (codigo && !conhecidos.has(codigo)) {
      conhecidos.add(codigo);
      fora.push({ valor: codigo, rotulo: codigo, foraDaMetodologia: true });
    }
  }
  return [...daMetodologia, ...fora];
}

export type EscolhaDeTecnica = 'NENHUMA' | TipoDeTecnica;

export interface OpcaoDeTecnica {
  valor: EscolhaDeTecnica;
  rotulo: string;
  detalhe?: string;
}

/** "Nenhuma" e só as técnicas da metodologia do plano, pelo nome configurado. A já gravada fora da metodologia fica marcada. */
export function opcoesDeTecnica(config: Configuracao | null | undefined, atual?: TipoDeTecnica | null): OpcaoDeTecnica[] {
  const daMetodologia = (config?.tecnicas ?? []).map((t) => ({ valor: t.tipo, rotulo: t.nome.trim() || nomeDaTecnica(config, t.tipo) }));
  const opcoes: OpcaoDeTecnica[] = [{ valor: 'NENHUMA', rotulo: 'Nenhuma' }, ...daMetodologia];
  if (atual && !daMetodologia.some((o) => o.valor === atual)) {
    opcoes.push({ valor: atual, rotulo: nomeDaTecnica(config, atual), detalhe: 'Fora da metodologia' });
  }
  return opcoes;
}

/** Combinações da metodologia, com o nome configurado. Sem metodologia, as sete. */
export function opcoesDeCombinacao(config: Configuracao | null | undefined): { valor: TecnicaDeGrupo; rotulo: string }[] {
  const tipos = config ? (config.combinacoes ?? []).map((k) => k.tipo) : [...TIPOS_DE_GRUPO];
  return tipos.map((t) => ({ valor: t, rotulo: nomeDaCombinacao(config, t) }));
}

/** Séries ANTES da posição `ate`, para a série de referência do "abaixo da referência": "Série 2 · Top set". */
export function opcoesDeReferencia(series: readonly Serie[], ate: number, config: Configuracao | null | undefined): { valor: string; rotulo: string }[] {
  return series.slice(0, Math.max(0, ate)).map((s, i) => ({ valor: s.uid, rotulo: `Série ${i + 1} · ${nomeDoTipo(config, s.tipo) || 'sem tipo'}` }));
}

// ---- Carga ----

export interface RotulosDaFaixa {
  minimo: string;
  maximo: string;
  ajuda: string;
}

/** Rótulos dos campos de percentual de cada forma de carga; `null` nas que não têm percentual. */
export function rotulosDaFaixa(modo: ModoDeCarga | null | undefined, config: Configuracao | null | undefined): RotulosDaFaixa | null {
  const ws = nomeDaSerieDeTrabalho(config);
  switch (modo) {
    case 'PERCENTUAL_WS':
      return { minimo: `% da ${ws} mín.`, maximo: `% da ${ws} máx. (opcional)`, ajuda: `Sempre da carga da ${ws}, nunca do 1RM. Máximo vazio = percentual único.` };
    case 'ACIMA_DA_ANTERIOR':
      return { minimo: 'Acima da anterior mín.', maximo: 'Acima da anterior máx. (opcional)', ajuda: 'Quanto a carga sobe em relação à série imediatamente anterior (de 1 a 100%).' };
    case 'ABAIXO_DA_REFERENCIA':
      return { minimo: 'Redução mín.', maximo: 'Redução máx. (opcional)', ajuda: 'Quanto a carga cai em relação à série de referência (de 1 a 50%).' };
    default:
      return null;
  }
}

/** Ajuda curta de cada forma de carga, dita com o nome da série de trabalho da metodologia. */
export function ajudaDaCarga(modo: ModoDeCarga | null | undefined, config: Configuracao | null | undefined): string | null {
  const ws = nomeDaSerieDeTrabalho(config);
  switch (modo) {
    case 'CARGA_TRABALHO':
      return `A carga que o aluno informa para o dia: é a referência da ${ws} e dos percentuais.`;
    case 'MESMA_CARGA':
      return `A carga da última série de trabalho feita antes, no mesmo exercício.`;
    case 'NENHUMA':
      return 'O aluno não recebe sugestão de carga.';
    default:
      return null;
  }
}

// ---- Seções do editor ----

export interface SecoesDaSerie {
  tipo: boolean;
  prescricao: boolean;
  carga: boolean;
  esforco: boolean;
  tecnica: boolean;
  alvoExtra: boolean;
  cardio: boolean;
}

/** Exercício de cardio mostra só a prescrição de cardio; os demais mostram tudo menos ela. */
export function secoesDaSerie(modalidade: string | null | undefined): SecoesDaSerie {
  const cardio = modalidade === 'CARDIO';
  return { tipo: !cardio, prescricao: !cardio, carga: !cardio, esforco: !cardio, tecnica: !cardio, alvoExtra: !cardio, cardio };
}

// ---- Prévia "Para o aluno" ----

export interface PreviaDaSerie {
  /** "3 a 6 reps · 50% da WS · 1 RIR · Rest pause 20 s". */
  meta: string;
  /** De onde vem a carga de referência, quando a forma de carga depende de outra série. */
  referencia: string | null;
}

function rotuloDaSerie(series: readonly Serie[], indice: number, config: Configuracao | null | undefined): string {
  const nome = nomeDoTipo(config, series[indice]?.tipo);
  return `série ${indice + 1}${nome ? ` (${nome})` : ''}`;
}

/** De onde sai a carga de uma série que depende de outra; `null` quando não depende ou não há de onde sair. */
export function referenciaDaCarga(series: readonly Serie[], indice: number, config: Configuracao | null | undefined): string | null {
  const s = series[indice];
  const modo = s?.carga?.modo;
  if (modo === 'PERCENTUAL_WS' || modo === 'MESMA_CARGA') {
    for (let i = indice - 1; i >= 0; i--) {
      if (serieDeTrabalho(series[i])) return `Referência: a carga registrada na ${rotuloDaSerie(series, i, config)}.`;
    }
    return `Referência: a carga de trabalho do dia, que o aluno informa.`;
  }
  if (modo === 'ACIMA_DA_ANTERIOR') {
    return indice > 0 ? `Referência: a carga registrada na ${rotuloDaSerie(series, indice - 1, config)}.` : 'Sem série anterior: o aluno não terá carga de referência.';
  }
  if (modo === 'ABAIXO_DA_REFERENCIA') {
    const posicao = s.carga?.referenciaUid ? series.findIndex((x) => x.uid === s.carga?.referenciaUid) : -1;
    return posicao >= 0 && posicao < indice ? `Referência: a carga registrada na ${rotuloDaSerie(series, posicao, config)}.` : 'Escolha a série de referência.';
  }
  return null;
}

/** Como a série chega ao aluno, com o nome do tipo da metodologia (nunca o código). */
export function previaDaSerie(series: readonly Serie[], indice: number, config: Configuracao | null | undefined, semCarga = false): PreviaDaSerie {
  const s = series[indice];
  const meta = metaDaSerie(s, nomeDaSerieDeTrabalho(config), semCarga, config ?? undefined, series).replace(/^Meta: /, '');
  const nome = nomeDoTipo(config, s.tipo);
  return { meta: nome ? `${nome} · ${meta}` : meta, referencia: s.cardio || semCarga ? null : referenciaDaCarga(series, indice, config) };
}

/** A técnica como o aluno lê (por extenso), ou `null` sem técnica. */
export const tecnicaParaOAluno = (s: Serie, config: Configuracao | null | undefined): string | null => textoTecnicaPorExtenso(s.tecnica, config) || null;

/** O tipo da série está na metodologia? (sem metodologia, não há o que comparar.) */
export const tipoDaMetodologia = (config: Configuracao | null | undefined, s: Pick<Serie, 'tipo'>): boolean => !config || !s.tipo || !!tipoPorCodigo(config, s.tipo);

// ---- Problemas da validação por série ----

export interface ProblemasDaSerie {
  erros: Problemas;
  avisos: Problemas;
}

const SERIE = /^series\[(\d+)\]\.(.+)$/;

/** Divide a validação de um exercício (`validarExercicio`) por série: chaves relativas à série (`carga.percentualMin`). */
export function problemasPorSerie(erros: readonly Problema[], avisos: readonly Problema[], quantidade: number): ProblemasDaSerie[] {
  const resultado: ProblemasDaSerie[] = Array.from({ length: quantidade }, () => ({ erros: {}, avisos: {} }));
  const distribuir = (lista: readonly Problema[], destino: 'erros' | 'avisos') => {
    for (const p of lista) {
      const m = SERIE.exec(p.caminho);
      if (!m) continue;
      const alvo = resultado[Number(m[1])];
      if (alvo && !(m[2] in alvo[destino])) alvo[destino][m[2]] = p.mensagem;
    }
  };
  distribuir(erros, 'erros');
  distribuir(avisos, 'avisos');
  return resultado;
}

/** Problemas do exercício que não são de uma série (`series`, `progressao`, `nome`...): chave relativa ao exercício. */
export function problemasDoExercicioSemSeries(lista: readonly Problema[]): Problemas {
  const resultado: Problemas = {};
  for (const p of lista) if (!SERIE.test(p.caminho) && !(p.caminho in resultado)) resultado[p.caminho] = p.mensagem;
  return resultado;
}

/** Junta os problemas das séries de um grupo (as iguais): a primeira mensagem de cada campo. */
export function problemasDoGrupoDeSeries(porSerie: readonly ProblemasDaSerie[], inicio: number, quantidade: number): ProblemasDaSerie {
  const junto: ProblemasDaSerie = { erros: {}, avisos: {} };
  for (let i = inicio; i < inicio + quantidade; i++) {
    for (const destino of ['erros', 'avisos'] as const) {
      for (const [campo, mensagem] of Object.entries(porSerie[i]?.[destino] ?? {})) if (!(campo in junto[destino])) junto[destino][campo] = mensagem;
    }
  }
  return junto;
}

/** Os campos de um prefixo (`tecnica`, `carga`, `esforco`, `cardio`) sem o prefixo: `tecnica.blocos` vira `blocos`. */
export function subProblemas(problemas: Problemas | undefined, prefixo: string): Problemas {
  const resultado: Problemas = {};
  const inicio = `${prefixo}.`;
  for (const [campo, mensagem] of Object.entries(problemas ?? {})) if (campo.startsWith(inicio)) resultado[campo.slice(inicio.length)] = mensagem;
  return resultado;
}

/** Texto do primeiro problema de uma lista de séries: "Série 2: Percentual da WS entre 1 e 200." (para o motivo do botão). */
export function primeiroProblemaDeSerie(porSerie: readonly ProblemasDaSerie[]): string | null {
  for (let i = 0; i < porSerie.length; i++) {
    const primeiro = Object.values(porSerie[i].erros)[0];
    if (primeiro) return `Série ${i + 1}: ${primeiro}`;
  }
  return null;
}
