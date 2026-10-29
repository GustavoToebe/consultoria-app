import { PERIODOS_DA_LISTA, type PeriodoDaLista } from './listaDeCompras';
import type { Cores } from '../tema/tokens';

/**
 * Preferências visuais de cada pessoa, só neste aparelho e para a conta dela (não vão para a API nem para log). A
 * cor da marca não entra aqui: é do treinador e vale para todos os alunos dele.
 */
export type TemaEscolhido = 'CONSULTORIA' | 'ESCURO' | 'CLARO' | 'SISTEMA';
export type Contraste = 'PADRAO' | 'ALTO';
export type TamanhoTexto = 'PADRAO' | 'MEDIO' | 'GRANDE' | 'EXTRA';
export type Movimento = 'SISTEMA' | 'REDUZIDO';
export type ModoPdfDieta = 'simples' | 'detalhado';

/** Última escolha da folha "PDF da dieta". Fica no aparelho, como as outras preferências. */
export interface PdfDietaPreferida {
  modo: ModoPdfDieta;
  periodo: PeriodoDaLista;
  /** Só mostra as colunas. A conta da lista usa os fatores mesmo com isto desligado. */
  fatores: boolean;
}

export interface Preferencias {
  tema: TemaEscolhido;
  contraste: Contraste;
  tamanhoTexto: TamanhoTexto;
  movimento: Movimento;
  /** Só aparece no celular. */
  vibracao: boolean;
  /** Gráficos de progresso por exercício e de peso; desligado, só as listas. */
  graficos: boolean;
  /** Só na web: barras de rolagem (e demais controles do navegador) no escuro quando o tema em uso é escuro. */
  barrasEscuras: boolean;
  /** Só treinador: "Sem registro há N dias" no Início. Informação, nunca inativa ninguém. */
  diasSemRegistro: number;
  /** Folha do PDF da dieta: Simples ou Detalhado, período e colunas de fator. */
  pdfDieta: PdfDietaPreferida;
  /** Folha "Gerar imagem": incluir a logo da consultoria. Sem logo, a caixinha fica desligada. */
  logoNaComparacao: boolean;
  /** Gráfico de peso do treinador: faixas das fases atrás da linha. Ligado por padrão. */
  mostrarFasesDoCiclo: boolean;
  /** Só aluno, só no celular: notificações locais 1 dia e 2 horas antes de cada compromisso. Desligado por padrão. */
  lembretesCompromisso: boolean;
  /**
   * Só treinador: agendas da Agenda escondidas neste aparelho (D2). Cada item é a chave de uma agenda fixa
   * (`compromissos`, `atualizacoes`) ou o id de uma agenda pessoal; nenhuma oculta é o padrão. O id de uma agenda que não
   * existe mais fica guardado (a leitura da lista pode ter falhado): quem usa filtra com `agendasOcultasValidas`.
   */
  agendasOcultas: string[];
}

/** Teto de itens e de tamanho de cada um em `agendasOcultas` (20 agendas pessoais + 2 fixas cabem com folga). */
export const AGENDAS_OCULTAS_MAXIMO = 64;
export const AGENDA_OCULTA_TAMANHO_MAXIMO = 64;

/** Valores que o cartão "Sem registro" oferece; a API aceita de 1 a 90. */
/** Chave local por usuário. Fica no aparelho depois de sair da conta (ver `SOBREVIVEM_AO_SAIR` no repositório local). */
export const chaveDasPreferencias = (usuarioId: string) => `treinos:${usuarioId}:preferencias`;

export const OPCOES_DIAS_SEM_REGISTRO: readonly number[] = [3, 7, 14, 30];

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: 'CONSULTORIA',
  contraste: 'PADRAO',
  tamanhoTexto: 'PADRAO',
  movimento: 'SISTEMA',
  vibracao: true,
  graficos: true,
  barrasEscuras: true,
  diasSemRegistro: 7,
  pdfDieta: { modo: 'simples', periodo: 'semana', fatores: true },
  logoNaComparacao: true,
  mostrarFasesDoCiclo: true,
  lembretesCompromisso: false,
  agendasOcultas: [],
};

const TEMAS: readonly TemaEscolhido[] = ['CONSULTORIA', 'ESCURO', 'CLARO', 'SISTEMA'];
const CONTRASTES: readonly Contraste[] = ['PADRAO', 'ALTO'];
const TAMANHOS: readonly TamanhoTexto[] = ['PADRAO', 'MEDIO', 'GRANDE', 'EXTRA'];
const MOVIMENTOS: readonly Movimento[] = ['SISTEMA', 'REDUZIDO'];

function entre<T extends string>(valor: unknown, validos: readonly T[], padrao: T): T {
  return typeof valor === 'string' && (validos as readonly string[]).includes(valor) ? (valor as T) : padrao;
}

/** Aceita o texto salvo ou o objeto; valor desconhecido ou faltando volta ao padrão, sem derrubar o app. */
export function normalizarPreferencias(qualquer: unknown): Preferencias {
  let bruto: unknown = qualquer;
  if (typeof bruto === 'string') {
    try {
      bruto = JSON.parse(bruto);
    } catch {
      return { ...PREFERENCIAS_PADRAO };
    }
  }
  const o = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {};
  return {
    tema: entre(o.tema, TEMAS, PREFERENCIAS_PADRAO.tema),
    contraste: entre(o.contraste, CONTRASTES, PREFERENCIAS_PADRAO.contraste),
    tamanhoTexto: entre(o.tamanhoTexto, TAMANHOS, PREFERENCIAS_PADRAO.tamanhoTexto),
    movimento: entre(o.movimento, MOVIMENTOS, PREFERENCIAS_PADRAO.movimento),
    vibracao: typeof o.vibracao === 'boolean' ? o.vibracao : PREFERENCIAS_PADRAO.vibracao,
    graficos: typeof o.graficos === 'boolean' ? o.graficos : PREFERENCIAS_PADRAO.graficos,
    barrasEscuras: typeof o.barrasEscuras === 'boolean' ? o.barrasEscuras : PREFERENCIAS_PADRAO.barrasEscuras,
    diasSemRegistro: typeof o.diasSemRegistro === 'number' && OPCOES_DIAS_SEM_REGISTRO.includes(o.diasSemRegistro) ? o.diasSemRegistro : PREFERENCIAS_PADRAO.diasSemRegistro,
    pdfDieta: pdfDietaDe(o.pdfDieta),
    logoNaComparacao: typeof o.logoNaComparacao === 'boolean' ? o.logoNaComparacao : PREFERENCIAS_PADRAO.logoNaComparacao,
    mostrarFasesDoCiclo: typeof o.mostrarFasesDoCiclo === 'boolean' ? o.mostrarFasesDoCiclo : PREFERENCIAS_PADRAO.mostrarFasesDoCiclo,
    lembretesCompromisso: typeof o.lembretesCompromisso === 'boolean' ? o.lembretesCompromisso : PREFERENCIAS_PADRAO.lembretesCompromisso,
    agendasOcultas: agendasOcultasDe(o.agendasOcultas),
  };
}

/** Lista de textos sem repetir, sem vazio nem texto enorme, até o teto; qualquer outra coisa vira "nenhuma oculta". */
function agendasOcultasDe(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const itens = valor.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= AGENDA_OCULTA_TAMANHO_MAXIMO);
  return [...new Set(itens)].slice(0, AGENDAS_OCULTAS_MAXIMO);
}

const MODOS_PDF: readonly ModoPdfDieta[] = ['simples', 'detalhado'];

function pdfDietaDe(valor: unknown): PdfDietaPreferida {
  const o = valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
  return {
    modo: entre(o.modo, MODOS_PDF, PREFERENCIAS_PADRAO.pdfDieta.modo),
    periodo: entre(o.periodo, PERIODOS_DA_LISTA, PREFERENCIAS_PADRAO.pdfDieta.periodo),
    fatores: typeof o.fatores === 'boolean' ? o.fatores : PREFERENCIAS_PADRAO.pdfDieta.fatores,
  };
}

/** Aplica as escolhas na ordem em que foram feitas sobre uma base (a última de cada campo vence). */
export function aplicarEscolhas(base: Preferencias, escolhas: readonly Partial<Preferencias>[]): Preferencias {
  return escolhas.reduce<Preferencias>((atual, parcial) => ({ ...atual, ...parcial }), base);
}

const FATORES: Record<TamanhoTexto, number> = { PADRAO: 1, MEDIO: 1.12, GRANDE: 1.25, EXTRA: 1.4 };

export function fatorDoTexto(tamanho: TamanhoTexto): number {
  return FATORES[tamanho];
}

/** Tamanho de fonte (ou altura de linha) com o fator aplicado, em número inteiro. */
export function escalar(valor: number, fator: number): number {
  return Math.round(valor * fator);
}

/**
 * Contraste alto: borda de cartão e divisão ficam tão nítidas quanto a borda de campo, e o texto secundário fica mais
 * forte (≥ 7:1 sobre todas as superfícies).
 */
export function coresComContraste(cores: Cores, contraste: Contraste, escuro: boolean): Cores {
  if (contraste === 'PADRAO') return cores;
  return {
    ...cores,
    borda: cores.bordaCampo,
    divisor: cores.borda,
    textoSuave: escuro ? '#C4C4CC' : '#3F3F46',
  };
}
