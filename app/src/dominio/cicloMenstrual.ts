import { hojeEmBrasilia } from './financeiro';
import { somarDias } from './formatos';

/** Estimativa só no app. A API guarda datas e nunca calcula fase. Sem dado, a tela mostra "—". */
export type FaseDoCiclo = 'MENSTRUAL' | 'FOLICULAR' | 'OVULATORIA' | 'LUTEA';

export interface RegistroDeCiclo {
  id?: string;
  inicio: string;
  fim: string | null;
}

export interface ConfigDoCiclo {
  duracaoHabitual: number | null;
  mostrarFases: boolean;
  /** Data de hoje em Brasília, ISO. A menstruação em andamento vai até este dia. */
  hoje: string;
}

export interface LeituraDaFase {
  fase: FaseDoCiclo | null;
  diaDoCiclo: number | null;
  estimada: boolean;
}

export interface FaixaDeFase {
  de: string;
  ate: string;
  fase: FaseDoCiclo;
  estimada: boolean;
}

export interface DiaDeSintomas {
  data: string;
  fluxo?: string | null;
  colica?: string | null;
  sintomas?: string[];
}

export interface ContagemDeSintoma {
  rotulo: string;
  dias: number;
}

export const VERSAO_CONSENTIMENTO = 1;

export const TEXTO_DO_CONSENTIMENTO =
  'O acompanhamento é opcional. Quem vê: seu treinador e a equipe com acesso a dados sensíveis. '
  + 'Para quê: acompanhar seu treino e sua dieta. Você pode desligar e apagar quando quiser.';

export const AJUDA_MOSTRAR_FASES =
  'Se você usa anticoncepcional hormonal ou tem ciclo irregular, as fases estimadas podem não valer para você.';

export const ROTULO_DA_FASE: Record<FaseDoCiclo, string> = {
  MENSTRUAL: 'Menstrual',
  FOLICULAR: 'Folicular',
  OVULATORIA: 'Ovulatória',
  LUTEA: 'Lútea',
};

export const ROTULO_DO_SINTOMA: Record<string, string> = {
  INCHACO: 'Inchaço',
  DOR_DE_CABECA: 'Dor de cabeça',
  SENSIBILIDADE_NAS_MAMAS: 'Sensibilidade nas mamas',
  ACNE: 'Acne',
  ALTERACAO_DE_HUMOR: 'Alteração de humor',
  CANSACO: 'Cansaço',
  ALTERACAO_DO_SONO: 'Alteração do sono',
  MAIS_FOME: 'Mais fome',
  NAUSEA: 'Náusea',
  DOR_LOMBAR: 'Dor lombar',
};

export const ROTULO_DO_FLUXO: Record<string, string> = {
  SANGRAMENTO_LEVE: 'Sangramento leve',
  LEVE: 'Fluxo leve',
  MEDIO: 'Fluxo médio',
  INTENSO: 'Fluxo intenso',
};

export const ROTULO_DA_COLICA: Record<string, string> = {
  NENHUMA: 'Sem cólica',
  LEVE: 'Cólica leve',
  MEDIA: 'Cólica média',
  FORTE: 'Cólica forte',
};

export const SINTOMAS = Object.keys(ROTULO_DO_SINTOMA);

/** Igual à regra da API: o fim da menstruação vai até o início mais 15 dias. */
export const DIAS_MAXIMOS_DA_MENSTRUACAO = 15;

const DIA = 86_400_000;

function ms(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function diferencaEmDias(de: string, ate: string): number {
  return Math.round((ms(ate) - ms(de)) / DIA);
}

function ordenados(registros: readonly RegistroDeCiclo[]): RegistroDeCiclo[] {
  return [...registros].sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0));
}

/** Média das diferenças de 21 a 45 dias entre os últimos inícios. Sem isso, a duração habitual. */
export function duracaoDoCiclo(registros: readonly RegistroDeCiclo[], habitual: number | null): number | null {
  const lista = ordenados(registros);
  const validos: number[] = [];
  for (let i = 1; i < lista.length; i++) {
    const dias = diferencaEmDias(lista[i - 1].inicio, lista[i].inicio);
    if (dias >= 21 && dias <= 45) validos.push(dias);
  }
  const ultimos = validos.slice(-6);
  if (ultimos.length > 0) return Math.round(ultimos.reduce((a, b) => a + b, 0) / ultimos.length);
  return habitual != null && habitual >= 21 && habitual <= 45 ? habitual : null;
}

function mediaDaMenstruacao(registros: readonly RegistroDeCiclo[]): number | null {
  const dias = registros.filter((r) => r.fim).map((r) => diferencaEmDias(r.inicio, r.fim!) + 1);
  if (dias.length === 0) return null;
  return Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
}

export function semRegistroRecente(registros: readonly RegistroDeCiclo[], hoje: string): boolean {
  const lista = ordenados(registros);
  const ultimo = lista[lista.length - 1];
  return !ultimo || diferencaEmDias(ultimo.inicio, hoje) > 60;
}

export function proximaMenstruacaoPrevista(registros: readonly RegistroDeCiclo[], config: ConfigDoCiclo): string | null {
  if (semRegistroRecente(registros, config.hoje)) return null;
  const duracao = duracaoDoCiclo(registros, config.duracaoHabitual);
  const ultimo = ordenados(registros).at(-1);
  if (!duracao || !ultimo) return null;
  return somarDias(ultimo.inicio, duracao);
}

/** Início e fim previstos da próxima menstruação. O fim usa a média dos registros que já têm fim. */
export function menstruacaoPrevista(registros: readonly RegistroDeCiclo[], config: ConfigDoCiclo): { inicio: string; fim: string | null } | null {
  const inicio = proximaMenstruacaoPrevista(registros, config);
  if (!inicio) return null;
  const media = mediaDaMenstruacao(registros);
  return { inicio, fim: media ? somarDias(inicio, media - 1) : null };
}

export function faseNaData(registros: readonly RegistroDeCiclo[], config: ConfigDoCiclo, data: string): LeituraDaFase {
  const lista = ordenados(registros);
  const anteriores = lista.filter((r) => r.inicio <= data);
  const atual = anteriores[anteriores.length - 1];
  if (!atual) return { fase: null, diaDoCiclo: null, estimada: false };
  const indice = lista.findIndex((r) => r.inicio === atual.inicio);
  const seguinte = lista[indice + 1];
  const real = seguinte != null;
  // O último ciclo, sem próximo início registrado e já além da janela de registro recente, não tem como dizer em que dia está.
  const diaDoCiclo = !real && semRegistroRecente(registros, data) ? null : diferencaEmDias(atual.inicio, data) + 1;
  const fimMenstrual = atual.fim ?? fimDaMenstruacaoEmAndamento(atual.inicio, config.hoje);
  const naMenstrual = fimMenstrual != null && data >= atual.inicio && data <= fimMenstrual;
  if (!config.mostrarFases) {
    return { fase: naMenstrual ? 'MENSTRUAL' : null, diaDoCiclo, estimada: false };
  }
  // Sem registro recente só a previsão (o ciclo depois do último início) some; ciclos fechados por um início real ficam.
  if (!real && semRegistroRecente(registros, config.hoje) && data > (fimMenstrual ?? atual.inicio)) {
    return { fase: naMenstrual ? 'MENSTRUAL' : null, diaDoCiclo, estimada: false };
  }
  const duracao = duracaoDoCiclo(registros, config.duracaoHabitual);
  const proximo = real ? seguinte.inicio : duracao ? somarDias(atual.inicio, duracao) : null;
  if (!proximo || data >= proximo) {
    return { fase: naMenstrual ? 'MENSTRUAL' : null, diaDoCiclo, estimada: false };
  }
  const comprimento = diferencaEmDias(atual.inicio, proximo);
  if (comprimento < 21 || comprimento > 45) {
    return { fase: naMenstrual ? 'MENSTRUAL' : null, diaDoCiclo, estimada: false };
  }
  if (naMenstrual) return { fase: 'MENSTRUAL', diaDoCiclo, estimada: false };
  const ovulatoria = somarDias(proximo, -14);
  if (data === ovulatoria) return { fase: 'OVULATORIA', diaDoCiclo, estimada: true };
  if (fimMenstrual && data > fimMenstrual && data < ovulatoria) return { fase: 'FOLICULAR', diaDoCiclo, estimada: true };
  if (data > ovulatoria) return { fase: 'LUTEA', diaDoCiclo, estimada: true };
  return { fase: null, diaDoCiclo, estimada: false };
}

export function fasesNoPeriodo(registros: readonly RegistroDeCiclo[], config: ConfigDoCiclo, de: string, ate: string): FaixaDeFase[] {
  const faixas: FaixaDeFase[] = [];
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
    const leitura = faseNaData(registros, config, dia);
    if (!leitura.fase) continue;
    const ultima = faixas[faixas.length - 1];
    if (ultima && ultima.fase === leitura.fase && ultima.estimada === leitura.estimada && somarDias(ultima.ate, 1) === dia) {
      ultima.ate = dia;
    } else {
      faixas.push({ de: dia, ate: dia, fase: leitura.fase, estimada: leitura.estimada });
    }
  }
  return faixas;
}

export function contarSintomas(dias: readonly DiaDeSintomas[], de: string, ate: string): ContagemDeSintoma[] {
  const contas = new Map<string, number>();
  const somar = (rotulo: string | undefined) => {
    if (!rotulo) return;
    contas.set(rotulo, (contas.get(rotulo) ?? 0) + 1);
  };
  for (const dia of dias) {
    if (dia.data < de || dia.data > ate) continue;
    somar(dia.fluxo ? ROTULO_DO_FLUXO[dia.fluxo] : undefined);
    somar(colicaConta(dia.colica) ? ROTULO_DA_COLICA[dia.colica] : undefined);
    for (const sintoma of dia.sintomas ?? []) somar(ROTULO_DO_SINTOMA[sintoma]);
  }
  return [...contas.entries()]
    .map(([rotulo, n]) => ({ rotulo, dias: n }))
    .sort((a, b) => b.dias - a.dias || a.rotulo.localeCompare(b.rotulo, 'pt'));
}

export function textoDaContagem(contagens: readonly ContagemDeSintoma[]): string {
  if (contagens.length === 0) return 'Nenhum sintoma registrado';
  return contagens.map((c) => `${c.rotulo}: ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}`).join(' · ');
}

/** Há início nos últimos 35 dias? O atalho da atualização só aparece quando não há. */
export function temInicioRecente(registros: readonly RegistroDeCiclo[], hoje: string): boolean {
  return ordenados(registros).some((r) => diferencaEmDias(r.inicio, hoje) <= 35 && r.inicio <= hoje);
}

export function registroEmAndamento(registros: readonly RegistroDeCiclo[]): RegistroDeCiclo | null {
  return ordenados(registros).find((r) => r.fim == null) ?? null;
}

/** "Dia 9 do ciclo · Folicular (estimativa)". Sem dia, "—". */
export function textoDaLeitura(leitura: LeituraDaFase, curto = false): string {
  if (leitura.diaDoCiclo == null) return '—';
  const dia = curto ? `Dia ${leitura.diaDoCiclo}` : `Dia ${leitura.diaDoCiclo} do ciclo`;
  if (!leitura.fase) return dia;
  const nome = ROTULO_DA_FASE[leitura.fase];
  return `${dia} · ${nome}${leitura.estimada ? ' (estimativa)' : ''}`;
}

export function textoDaPrevisao(registros: readonly RegistroDeCiclo[], config: ConfigDoCiclo, dataParaTela: (iso: string) => string): string {
  if (semRegistroRecente(registros, config.hoje)) return 'Sem registro recente';
  const prevista = menstruacaoPrevista(registros, config);
  if (!prevista) return '—';
  const inicio = dataParaTela(prevista.inicio);
  return prevista.fim
    ? `Próxima menstruação prevista: ${inicio} a ${dataParaTela(prevista.fim)} (estimativa)`
    : `Próxima menstruação prevista: ${inicio} (estimativa)`;
}

export interface FaixaDoGrafico {
  de: string;
  ate: string;
  rotulo: string;
  tom: string;
}

/** Índices dos pontos cuja data cai na faixa, para o gráfico desenhar atrás da linha. Sem data no ponto, nada. */
export function faixasSobrePontos(
  pontos: readonly { data?: string }[],
  faixas: readonly FaixaDoGrafico[],
): { de: number; ate: number; rotulo: string; tom: string }[] {
  if (pontos.length === 0 || pontos.some((p) => !p.data)) return [];
  const saida: { de: number; ate: number; rotulo: string; tom: string }[] = [];
  for (const faixa of faixas) {
    let de = -1;
    let ate = -1;
    pontos.forEach((p, i) => {
      if (p.data! >= faixa.de && p.data! <= faixa.ate) {
        if (de < 0) de = i;
        ate = i;
      }
    });
    if (de >= 0) saida.push({ de, ate, rotulo: faixa.rotulo, tom: faixa.tom });
  }
  return saida;
}

/** "Hoje" das telas do ciclo: data de Brasília (UTC−3), nunca a do fuso do aparelho. A API também confere por ela. */
export function hojeDoCiclo(agora: Date = new Date()): string {
  return hojeEmBrasilia(agora);
}

/** A cólica "nenhuma" é uma resposta registrada, não um sintoma. */
const COLICA_NENHUMA = 'NENHUMA';

function colicaConta(colica: string | null | undefined): colica is string {
  return !!colica && colica !== COLICA_NENHUMA;
}

/** O dia tem algo registrado como sintoma (fluxo, cólica, observação ou sintoma)? "Sem cólica" não conta. */
export function diaTemMarca(dia: { fluxo?: string | null; colica?: string | null; observacao?: string | null; sintomas?: readonly string[] | null } | undefined): boolean {
  return !!dia && !!(dia.fluxo || colicaConta(dia.colica) || dia.observacao || (dia.sintomas && dia.sintomas.length > 0));
}

/** Fim da menstruação em andamento: hoje, no máximo `DIAS_MAXIMOS_DA_MENSTRUACAO` depois do início. Nulo se começa depois de hoje. */
export function fimDaMenstruacaoEmAndamento(inicio: string, hoje: string): string | null {
  if (inicio > hoje) return null;
  const limite = somarDias(inicio, DIAS_MAXIMOS_DA_MENSTRUACAO);
  return hoje < limite ? hoje : limite;
}

/** Dias de menstruação registrada. Em andamento vai até hoje, no máximo 15 dias depois do início. */
export function diasDeMenstruacaoRegistrada(registros: readonly RegistroDeCiclo[], hoje: string): Set<string> {
  const dias = new Set<string>();
  for (const r of registros) {
    const fim = r.fim ?? fimDaMenstruacaoEmAndamento(r.inicio, hoje) ?? r.inicio;
    for (let dia = r.inicio; dia <= fim; dia = somarDias(dia, 1)) dias.add(dia);
  }
  return dias;
}

/** "Terminou hoje" só vale se a API aceita o fim de hoje: até o início mais 15 dias (e nunca antes do início). */
export function podeTerminarHoje(registro: RegistroDeCiclo, hoje: string): boolean {
  return registro.fim == null && hoje >= registro.inicio && hoje <= somarDias(registro.inicio, DIAS_MAXIMOS_DA_MENSTRUACAO);
}

export interface SegmentoDaFaixa {
  de: string;
  ate: string;
  /** Nulo = trecho sem fase (espaçador). */
  fase: FaseDoCiclo | null;
  estimada: boolean;
  dias: number;
}

/**
 * Segmentos do período `de`..`ate` na ordem das datas: cada fase e, entre elas, os dias sem fase (espaçadores), para que a
 * faixa desenhe cada fase na data certa. As faixas vêm de `fasesNoPeriodo` (ordenadas e dentro do período).
 */
export function segmentosDoPeriodo(faixas: readonly FaixaDeFase[], de: string, ate: string): SegmentoDaFaixa[] {
  const segmentos: SegmentoDaFaixa[] = [];
  const vazio = (inicio: string, fim: string) => {
    if (inicio <= fim) segmentos.push({ de: inicio, ate: fim, fase: null, estimada: false, dias: diferencaEmDias(inicio, fim) + 1 });
  };
  let cursor = de;
  for (const f of faixas) {
    vazio(cursor, somarDias(f.de, -1));
    segmentos.push({ ...f, dias: diferencaEmDias(f.de, f.ate) + 1 });
    cursor = somarDias(f.ate, 1);
  }
  vazio(cursor, ate);
  return segmentos;
}
