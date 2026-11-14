import type { RegistroPeso } from '../api/tipos';
import { tomDaVariacaoDoPeso, type TomDoPeso } from './corDaVariacaoDoPeso';
import { dataCurta, dataParaTela, numeroParaTela } from './formatos';
import { variacaoDoPeso, type SetaDoPeso } from './variacaoDoPeso';

/**
 * Regras do resumo, da escala do gráfico e da linha do histórico do Peso (plano peso-visual, D3 a D6). Só texto e
 * número: sem React, sem I/O. Peso corporal é sempre kg (não muda com a unidade da carga). A cor é de
 * `corDaVariacaoDoPeso` (meta do treinador) e a frase da meta é `linhaDaMeta` (`metaDoPesoNaFicha`): nada daqui opina.
 *
 * Mesmo dia: a API guarda uma medida por data (`registro_peso` único por aluno e data; registrar de novo substitui),
 * então dois registros na mesma data não chegam ao app. Se chegarem, vale o que já existe: a data igual nunca é
 * "anterior" (`variacaoDoPeso`), o ponto fica no mesmo lugar do eixo (`fracaoNoEixo`) e, no empate, o último da lista
 * recebida é o mais recente (a ordenação estável de `CartaoPeso`). Nenhum horário é inventado.
 */

export const ROTULO_ULTIMO_REGISTRO = 'Último registro';
export const ROTULO_DESDE_ANTERIOR = 'Desde o registro anterior';
export const ROTULO_NO_PERIODO = 'No período';
export const SEM_REGISTRO_ANTERIOR = 'Sem registro anterior';

export interface PesoEmData {
  kg: number;
  /** Data ISO do registro. */
  data: string;
}

/** Peso com ao menos uma casa e no máximo duas (o peso tem duas): `51` → `51,0`, `51,25` fica. */
export function pesoParaTela(kg: number): string {
  const t = numeroParaTela(kg);
  return t.includes(',') ? t : `${t},0`;
}

/** Diferença entre dois pesos, com sinal de menos tipográfico: `+0,6 kg`, `−0,6 kg`, `0,0 kg`. */
export function textoDaDiferenca(diferenca: number): string {
  const d = Math.round(diferenca * 100) / 100;
  const sinal = d > 0 ? '+' : d < 0 ? '−' : '';
  return `${sinal}${pesoParaTela(Math.abs(d))} kg`;
}

const valido = (r: RegistroPeso) => Number.isFinite(r.pesoKg) && !!r.data;
const emData = (r: RegistroPeso): PesoEmData => ({ kg: r.pesoKg, data: r.data });

/** O de data mais recente; no empate, o último da lista recebida. */
function maisRecente(registros: readonly RegistroPeso[]): RegistroPeso | null {
  let achado: RegistroPeso | null = null;
  for (const r of registros) if (!achado || r.data >= achado.data) achado = r;
  return achado;
}

/** O de data mais antiga; no empate, o primeiro da lista recebida. */
function maisAntigo(registros: readonly RegistroPeso[]): RegistroPeso | null {
  let achado: RegistroPeso | null = null;
  for (const r of registros) if (!achado || r.data < achado.data) achado = r;
  return achado;
}

/** O de data imediatamente anterior a `data` (mesma regra de `variacaoDoPeso`: data igual não é anterior). */
function anteriorA(data: string, registros: readonly RegistroPeso[]): RegistroPeso | null {
  let achado: RegistroPeso | null = null;
  for (const r of registros) if (r.data < data && (!achado || r.data > achado.data)) achado = r;
  return achado;
}

export interface DesdeAnterior {
  /** Último menos o anterior, arredondado a duas casas (o peso tem duas). */
  diferenca: number;
  seta: SetaDoPeso;
  /** `+0,6 kg`, `−0,6 kg` ou `0,0 kg · sem alteração`. */
  texto: string;
  kgReferencia: number;
  dataReferencia: string;
  /** `51,0 kg em 19/08/2026`. */
  referencia: string;
}

export interface ResumoDoPeso {
  vazio: false;
  rotuloUltimo: typeof ROTULO_ULTIMO_REGISTRO;
  ultimo: PesoEmData & { texto: string; dataTexto: string };
  rotuloDiferenca: typeof ROTULO_DESDE_ANTERIOR;
  /** `null` com um registro só (ou sem data anterior): a tela diz `SEM_REGISTRO_ANTERIOR` e mantém o peso real. */
  desdeAnterior: DesdeAnterior | null;
}

/** Zero registros: estado vazio explícito, nunca "0 kg". */
export interface ResumoVazio {
  vazio: true;
}

/** Último registro e a diferença desde o anterior, com os registros em qualquer ordem. */
export function resumoDoPeso(registros: readonly RegistroPeso[]): ResumoDoPeso | ResumoVazio {
  const lista = registros.filter(valido);
  const ultimo = maisRecente(lista);
  if (!ultimo) return { vazio: true };
  const ref = anteriorA(ultimo.data, lista);
  const diferenca = ref ? Math.round((ultimo.pesoKg - ref.pesoKg) * 100) / 100 : null;
  return {
    vazio: false,
    rotuloUltimo: ROTULO_ULTIMO_REGISTRO,
    ultimo: { ...emData(ultimo), texto: `${pesoParaTela(ultimo.pesoKg)} kg`, dataTexto: dataParaTela(ultimo.data) },
    rotuloDiferenca: ROTULO_DESDE_ANTERIOR,
    desdeAnterior: ref && diferenca !== null ? {
      diferenca,
      seta: diferenca > 0 ? 'sobe' : diferenca < 0 ? 'desce' : 'igual',
      texto: diferenca === 0 ? `${textoDaDiferenca(0)} · sem alteração` : textoDaDiferenca(diferenca),
      kgReferencia: ref.pesoKg,
      dataReferencia: ref.data,
      referencia: `${pesoParaTela(ref.pesoKg)} kg em ${dataParaTela(ref.data)}`,
    } : null,
  };
}

export interface NoPeriodo {
  rotulo: typeof ROTULO_NO_PERIODO;
  primeiro: PesoEmData;
  ultimo: PesoEmData;
  /** `14/01/2026 a 11/09/2026`. */
  datas: string;
}

/** Primeira e última medição do conjunto recebido (a tela passa o filtro, quando houver). Só com 2 ou mais registros. */
export function noPeriodo(registros: readonly RegistroPeso[]): NoPeriodo | null {
  const lista = registros.filter(valido);
  const primeiro = maisAntigo(lista);
  const ultimo = maisRecente(lista);
  if (lista.length < 2 || !primeiro || !ultimo) return null;
  return { rotulo: ROTULO_NO_PERIODO, primeiro: emData(primeiro), ultimo: emData(ultimo), datas: `${dataParaTela(primeiro.data)} a ${dataParaTela(ultimo.data)}` };
}

export interface LinhaDoHistorico {
  /** `+0,6 kg`, `−0,6 kg`, `0,0 kg` ou `Sem registro anterior`. */
  texto: string;
  /** `null` sem anterior. */
  seta: SetaDoPeso | null;
  /** `desde 19/08` (o registro de comparação precisa estar na lista); `null` sem ele. */
  desde: string | null;
  /** Cor pela meta (`tomDaVariacaoDoPeso`). */
  tom: TomDoPeso;
}

/** Variação de um registro na tabela: o número é o da API (`variacaoDoPeso`), o "desde dd/mm" é do registro anterior por data. */
export function linhaDoHistorico(registro: RegistroPeso, registros: readonly RegistroPeso[]): LinhaDoHistorico {
  const v = variacaoDoPeso(registro, registros);
  if (!v || registro.variacao === null || registro.variacao === undefined) {
    return { texto: SEM_REGISTRO_ANTERIOR, seta: null, desde: null, tom: 'neutro' };
  }
  return {
    texto: textoDaDiferenca(registro.variacao),
    seta: v.seta,
    desde: v.desde ? `desde ${v.desde}` : null,
    tom: tomDaVariacaoDoPeso(registro.variacao, registro.metaDoPeso),
  };
}

/** Pontos do gráfico do mais antigo ao mais novo; o eixo horizontal os distribui pela data (`fracaoNoEixo`). */
export function pontosDoPeso(registros: readonly RegistroPeso[]): { rotulo: string; valor: number; data: string }[] {
  return registros.filter(valido)
    .sort((a, b) => a.data.localeCompare(b.data)) // `filter` já copiou; a ordenação é estável (mesmo dia mantém a ordem recebida)
    .map((r) => ({ rotulo: dataCurta(r.data), valor: r.pesoKg, data: r.data }));
}

/** Passos "redondos" do eixo, em kg. */
const PASSOS = [0.5, 1, 2, 2.5, 5, 10];

/**
 * Escala vertical do gráfico: do menor ao maior peso com margem pequena, pontas em número redondo (`50` a `52,5`).
 * Nunca zero artificial: a margem não leva o mínimo abaixo da metade do menor peso (o arredondamento seguinte, para o passo
 * do eixo, pode descer mais: 30 e 250 kg dão mínimo 10, e abaixo de ~20 kg chega a 0). Pesos iguais dão um intervalo
 * válido (a linha horizontal fica no meio). Sem registro válido, `null`.
 * shortcut: passo máximo de 10 kg e peso abaixo de ~20 kg pode arredondar o mínimo para 0; não é peso de aluno, trocar se virar.
 */
export function escalaDoPeso(registros: readonly RegistroPeso[]): { min: number; max: number } | null {
  const valores = registros.filter(valido).map((r) => r.pesoKg);
  if (valores.length === 0) return null;
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const margem = Math.max((maior - menor) * 0.08, 0.25);
  const baixo = Math.max(menor - margem, menor / 2);
  const alto = maior + margem;
  const passo = PASSOS.find((p) => p >= (alto - baixo) / 6) ?? 10;
  return { min: Math.floor(baixo / passo) * passo, max: Math.ceil(alto / passo) * passo };
}

/** `Escala vertical: 50 a 52,5 kg · pontos = registros`. */
export function legendaDaEscala(escala: { min: number; max: number }): string {
  return `Escala vertical: ${numeroParaTela(escala.min)} a ${numeroParaTela(escala.max)} kg · pontos = registros`;
}
