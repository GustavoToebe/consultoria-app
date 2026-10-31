import { PERIODOS_DA_LISTA, type PeriodoDaLista } from './listaDeCompras';
import { BLOCOS_DO_PAINEL, ehBlocoDoPainel, PAINEL_DO_INICIO_PADRAO, type PainelDoInicioPreferido } from './painelBlocos';
import { BORDA_BLOCO, BORDA_ITEM, type Cores } from '../tema/tokens';

/**
 * Preferências visuais de cada pessoa, só neste aparelho e para a conta dela (não vão para a API nem para log). A
 * cor da marca não entra aqui: é do treinador e vale para todos os alunos dele.
 */
export type TemaEscolhido = 'CONSULTORIA' | 'ESCURO' | 'CLARO' | 'AREIA' | 'SISTEMA';
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
  /** Bordas mais escuras e blocos com borda de 3 px, para quem quer separar melhor as partes da tela (30/10). */
  bordasReforcadas: boolean;
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
  /**
   * Só treinador: painel do Início (D7). `ordem` traz sempre todos os blocos (os que a pessoa não pode ver guardam o
   * lugar), `escondidos` os que ela desligou no "Editar" e `meus` o Todos/Meus escolhido em cada bloco (o "Voltar ao
   * padrão" do Editar limpa os três). Os Primeiros passos não entram.
   */
  painelDoInicio: PainelDoInicioPreferido;
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
  bordasReforcadas: false,
  barrasEscuras: true,
  diasSemRegistro: 7,
  pdfDieta: { modo: 'simples', periodo: 'semana', fatores: true },
  logoNaComparacao: true,
  mostrarFasesDoCiclo: true,
  lembretesCompromisso: false,
  agendasOcultas: [],
  painelDoInicio: PAINEL_DO_INICIO_PADRAO,
};

const TEMAS: readonly TemaEscolhido[] = ['CONSULTORIA', 'ESCURO', 'CLARO', 'AREIA', 'SISTEMA'];
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
      return normalizarPreferencias({});
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
    bordasReforcadas: typeof o.bordasReforcadas === 'boolean' ? o.bordasReforcadas : PREFERENCIAS_PADRAO.bordasReforcadas,
    barrasEscuras: typeof o.barrasEscuras === 'boolean' ? o.barrasEscuras : PREFERENCIAS_PADRAO.barrasEscuras,
    diasSemRegistro: typeof o.diasSemRegistro === 'number' && OPCOES_DIAS_SEM_REGISTRO.includes(o.diasSemRegistro) ? o.diasSemRegistro : PREFERENCIAS_PADRAO.diasSemRegistro,
    pdfDieta: pdfDietaDe(o.pdfDieta),
    logoNaComparacao: typeof o.logoNaComparacao === 'boolean' ? o.logoNaComparacao : PREFERENCIAS_PADRAO.logoNaComparacao,
    mostrarFasesDoCiclo: typeof o.mostrarFasesDoCiclo === 'boolean' ? o.mostrarFasesDoCiclo : PREFERENCIAS_PADRAO.mostrarFasesDoCiclo,
    lembretesCompromisso: typeof o.lembretesCompromisso === 'boolean' ? o.lembretesCompromisso : PREFERENCIAS_PADRAO.lembretesCompromisso,
    agendasOcultas: agendasOcultasDe(o.agendasOcultas),
    painelDoInicio: painelDoInicioDe(o.painelDoInicio),
  };
}

/**
 * Ordem salva: ids conhecidos, sem repetir, na ordem salva; os que faltam (bloco novo numa versão futura) entram no fim, na
 * ordem padrão. Escondidos: só ids conhecidos, sem repetir. Meus: só ids conhecidos com valor booleano. Qualquer outra
 * coisa volta ao padrão.
 */
function painelDoInicioDe(valor: unknown): PainelDoInicioPreferido {
  const o = valor && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
  const conhecidos = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter(ehBlocoDoPainel))] : []);
  const salva = conhecidos(o.ordem);
  const meus: PainelDoInicioPreferido['meus'] = {};
  if (o.meus && typeof o.meus === 'object' && !Array.isArray(o.meus)) {
    for (const [id, v] of Object.entries(o.meus)) if (ehBlocoDoPainel(id) && typeof v === 'boolean') meus[id] = v;
  }
  return {
    ordem: [...salva, ...BLOCOS_DO_PAINEL.filter((id) => !salva.includes(id))],
    escondidos: conhecidos(o.escondidos),
    meus,
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

/**
 * "Bordas reforçadas" (Perfil › Preferências): a borda dos blocos passa a usar `bordaCampo` (a mais escura do tema) e
 * o divisor, a `borda`; a espessura do bloco sobe de 2 para 3 px (`espessurasDasBordas`). Texto e status não mudam.
 */
export function coresComBordasReforcadas(cores: Cores, reforcadas: boolean): Cores {
  if (!reforcadas) return cores;
  return { ...cores, borda: cores.bordaCampo, divisor: cores.borda };
}

/** Espessura da borda do bloco (cartão, sessão, exercício, tabela) e do item com cabeçalho próprio (grupo de séries). */
export function espessurasDasBordas(reforcadas: boolean): { bloco: number; item: number } {
  return reforcadas ? { bloco: BORDA_BLOCO + 1, item: BORDA_ITEM } : { bloco: BORDA_BLOCO, item: BORDA_ITEM };
}
