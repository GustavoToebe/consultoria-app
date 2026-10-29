import type {
  AgendaPessoal, AgendaPessoalRequest, AlvoDoEvento, CorDaAgenda, DiaDaSemana, EscopoDaSerie, EventoDetalhe, EventoRequest,
  OcorrenciaDeEvento, RepeticaoDeEvento, TipoDeRepeticaoDeEvento,
} from '../api/agendaTipos';
import { CHAVES_DA_AGENDA } from '../tema/tokens';
import { DIAS_DA_SEMANA, diaDaSemanaDaData, horaValida, instanteDeBrasilia } from './agendaPresencial';
import type { Intervalo } from './agendaPresencial';
import { dataSemAnoCorrente } from './datasRelativas';
import { dataDaTela, dataParaTela, diaDaSemanaIso, somarDias } from './formatos';

export { AJUDA_DIAS_UTEIS, OPCOES_DE_DIA_DA_SEMANA, OPCOES_DE_REPETICAO, alternarDiaDaRepeticao, mascaraHora, horaValida } from './agendaPresencial';

/**
 * Regras do formulário do evento pessoal (sem aluno) e das agendas pessoais, espelho de `EventoAgendaService`,
 * `RecorrenciaDeEvento` e `AgendaPessoalService` da API (a regra é a mesma; quem decide é a API, e
 * `agendaCalendarioParidade.test.ts` confere as constantes). Nada aqui expande a repetição: isso é da API.
 */

// ---- Limites ----

export const LIMITES_DO_EVENTO = {
  titulo: 120, local: 120, descricao: 1000, duracaoMinima: 5, duracaoMaxima: 1440, vezesMinimo: 2, vezesMaximo: 999,
  eventos: 1000, anoMinimo: 2000, anoMaximo: 2100,
} as const;
export const LIMITES_DA_AGENDA = { nome: 40, agendas: 20 } as const;

/** Duração sugerida num evento novo com horário. */
export const DURACAO_PADRAO_DO_EVENTO = 60;

/** Aviso fixo do formulário (P6): só orienta, nunca bloqueia nem confere o texto. */
export const PRIVACIDADE_DO_EVENTO = 'O evento é só seu e não faz parte do cadastro do aluno. Evite nome de aluno e dado de saúde no título e na descrição: a anonimização do aluno não apaga o que você escrever aqui.';

/** A agenda que o app cria quando a pessoa ainda não tem nenhuma. */
export const NOME_DA_AGENDA_PADRAO = 'Pessoal';
export const COR_DA_AGENDA_PADRAO: CorDaAgenda = 'AZUL';

// ---- Repetição ----

/** A repetição como o formulário a guarda (texto digitado). O fim é opcional: `NUNCA` não manda `ate` nem `vezes`. */
export interface FormularioDaRepeticaoDoEvento {
  tipo: TipoDeRepeticaoDeEvento;
  /** Só no semanal. */
  dias: DiaDaSemana[];
  fim: 'NUNCA' | 'DATA' | 'VEZES';
  /** DD/MM/AAAA, quando `fim` é `DATA`. */
  ate: string;
  /** Quando `fim` é `VEZES`. */
  vezes: string;
}

export const SEM_REPETICAO_DO_EVENTO: FormularioDaRepeticaoDoEvento = { tipo: 'NENHUMA', dias: [], fim: 'NUNCA', ate: '', vezes: '' };

export const OPCOES_DE_FIM_DA_REPETICAO: readonly { valor: FormularioDaRepeticaoDoEvento['fim']; rotulo: string }[] = [
  { valor: 'NUNCA', rotulo: 'Nunca' },
  { valor: 'DATA', rotulo: 'Numa data' },
  { valor: 'VEZES', rotulo: 'Depois de' },
];

export type CampoDaRepeticaoDoEvento = 'tipo' | 'dias' | 'fim' | 'ate' | 'vezes';
export type ErrosDaRepeticaoDoEvento = Partial<Record<CampoDaRepeticaoDoEvento, string>>;

const ehFimDeSemana = (iso: string) => diaDaSemanaIso(iso) >= 6;
const dataNoIntervalo = (iso: string) => {
  const ano = Number(iso.slice(0, 4));
  return ano >= LIMITES_DO_EVENTO.anoMinimo && ano <= LIMITES_DO_EVENTO.anoMaximo;
};
const FORA_DO_INTERVALO = `Use datas entre ${LIMITES_DO_EVENTO.anoMinimo} e ${LIMITES_DO_EVENTO.anoMaximo}.`;

/** Trocar o tipo: "Toda semana" já nasce com o dia da semana da data marcado; os outros tipos não guardam dias. */
export function trocarTipoDaRepeticaoDoEvento(r: FormularioDaRepeticaoDoEvento, tipo: TipoDeRepeticaoDeEvento, dataDoFormulario: string):
  FormularioDaRepeticaoDoEvento {
  if (tipo !== 'SEMANAL') return { ...r, tipo, dias: [] };
  const data = dataDaTela(dataDoFormulario);
  return { ...r, tipo, dias: r.dias.length ? r.dias : data ? [diaDaSemanaDaData(data)] : [] };
}

/**
 * O primeiro dia da regra a partir da data do evento (espelho de `RecorrenciaDeEvento.primeira`): o próprio dia, salvo no
 * semanal (o primeiro dos dias escolhidos, a partir dela) e nos dias úteis (sábado e domingo começam na segunda).
 */
export function primeiroDiaDaRegra(data: string, tipo: TipoDeRepeticaoDeEvento, dias: readonly DiaDaSemana[]): string {
  if (tipo === 'SEMANAL' && dias.length > 0 && !dias.includes(diaDaSemanaDaData(data))) {
    let proximo = somarDias(data, 1);
    while (!dias.includes(diaDaSemanaDaData(proximo))) proximo = somarDias(proximo, 1);
    return proximo;
  }
  if (tipo === 'DIAS_UTEIS' && ehFimDeSemana(data)) {
    let proximo = somarDias(data, 1);
    while (ehFimDeSemana(proximo)) proximo = somarDias(proximo, 1);
    return proximo;
  }
  return data;
}

/** "O primeiro evento será em 02/11." quando a regra começa depois da data escolhida; senão `null`. */
export function avisoDoPrimeiroDia(data: string, tipo: TipoDeRepeticaoDeEvento, dias: readonly DiaDaSemana[], hoje: string): string | null {
  const primeiro = primeiroDiaDaRegra(data, tipo, dias);
  return primeiro === data ? null : `O primeiro evento será em ${dataSemAnoCorrente(primeiro, hoje)}.`;
}

/**
 * A repetição do formulário em `RepeticaoDeEvento`, conferida como a API (`RecorrenciaDeEvento.validar`). `primeira` é a data
 * do evento (AAAA-MM-DD); sem ela só confere o que dá. `NENHUMA` devolve `repeticao: null`.
 */
export function repeticaoDoEvento(f: FormularioDaRepeticaoDoEvento, primeira: string | null):
  { erros: ErrosDaRepeticaoDoEvento; repeticao: RepeticaoDeEvento | null } {
  if (f.tipo === 'NENHUMA') return { erros: {}, repeticao: null };
  const erros: ErrosDaRepeticaoDoEvento = {};
  const dias = DIAS_DA_SEMANA.filter((d) => f.dias.includes(d));
  if (f.tipo === 'SEMANAL' && dias.length === 0) erros.dias = 'Escolha os dias da semana.';
  const repeticao: RepeticaoDeEvento = { tipo: f.tipo };
  if (f.tipo === 'SEMANAL') repeticao.diasDaSemana = dias;
  let ate: string | null = null;
  if (f.fim === 'DATA') {
    const data = dataDaTela(f.ate);
    if (data === null) erros.ate = 'Informe a data final.';
    else if (data === undefined) erros.ate = 'Data final inválida.';
    else if (!dataNoIntervalo(data)) erros.ate = FORA_DO_INTERVALO;
    else { ate = data; repeticao.ate = data; }
  } else if (f.fim === 'VEZES') {
    const texto = f.vezes.trim();
    const vezes = /^\d+$/.test(texto) ? Number(texto) : NaN;
    if (!texto) erros.vezes = 'Informe quantas vezes.';
    else if (!Number.isInteger(vezes)) erros.vezes = 'Use só números.';
    else if (vezes < LIMITES_DO_EVENTO.vezesMinimo || vezes > LIMITES_DO_EVENTO.vezesMaximo) {
      erros.vezes = `O número de vezes precisa ser de ${LIMITES_DO_EVENTO.vezesMinimo} a ${LIMITES_DO_EVENTO.vezesMaximo}.`;
    } else repeticao.vezes = vezes;
  }
  if (ate && primeira && ate < primeiroDiaDaRegra(primeira, f.tipo, dias)) erros.ate = 'A data final não pode ser antes do primeiro dia do evento.';
  return Object.keys(erros).length ? { erros, repeticao: null } : { erros, repeticao };
}

// ---- Escopo de série ----

export const ROTULOS_DO_ESCOPO_DO_EVENTO: Record<EscopoDaSerie, string> = {
  ESTA: 'Somente este evento',
  SEGUINTES: 'Este e os seguintes',
  TODAS: 'Todos os eventos da série',
};

interface RestricoesDoEscopoDoEvento {
  /** A data do formulário é outra que a da ocorrência: só vale em `ESTA` (400 `DATA_SO_NESTA_OCORRENCIA`). */
  mudouData?: boolean;
  /** A agenda do formulário é outra: só vale para a série toda (400 `AGENDA_SO_NA_SERIE_TODA`). */
  mudouAgenda?: boolean;
}

/**
 * Os escopos que a API aceita para alterar: evento avulso, só `ESTA` (senão `EVENTO_SEM_SERIE`); numa série, os três, menos
 * as restrições acima. Lista vazia = mudou a data e a agenda de uma vez numa série: a tela pede uma mudança por vez.
 */
export function escoposDoEvento(serie: boolean, restricoes: RestricoesDoEscopoDoEvento = {}): EscopoDaSerie[] {
  if (!serie) return ['ESTA'];
  if (restricoes.mudouData && restricoes.mudouAgenda) return [];
  if (restricoes.mudouData) return ['ESTA'];
  if (restricoes.mudouAgenda) return ['TODAS'];
  return ['ESTA', 'SEGUINTES', 'TODAS'];
}

/** Os escopos de excluir: todos numa série; só `ESTA` no avulso. */
export const escoposParaExcluirEvento = (serie: boolean): EscopoDaSerie[] => (serie ? ['ESTA', 'SEGUINTES', 'TODAS'] : ['ESTA']);

/** O que cada escopo alcança, para a pergunta "só este, os seguintes ou todos". `data` é a da ocorrência aberta. */
export function explicacaoDoEscopoDoEvento(escopo: EscopoDaSerie, data: string, hoje: string): string {
  if (escopo === 'ESTA') return `Só o evento de ${dataSemAnoCorrente(data, hoje)}.`;
  if (escopo === 'SEGUINTES') return `O de ${dataSemAnoCorrente(data, hoje)} e todos os seguintes. Os anteriores não mudam.`;
  return 'Todos os eventos da série, inclusive os que já passaram.';
}

/** Texto do painel de confirmar a exclusão. */
export function textoDeExcluirEvento(escopo: EscopoDaSerie, serie: boolean): string {
  if (!serie) return 'Excluir este evento? Não dá para desfazer.';
  if (escopo === 'ESTA') return 'Excluir só este evento? Os outros da série continuam.';
  if (escopo === 'SEGUINTES') return 'Excluir este evento e os seguintes? Os anteriores continuam.';
  return 'Excluir a série inteira? Não dá para desfazer.';
}

/**
 * O `escopo` e a `ocorrencia` dos pedidos de alterar e excluir. Avulso: nada (a API assume `ESTA`). Série: `ESTA` e
 * `SEGUINTES` levam o `dataOriginal` da ocorrência aberta; `TODAS` não precisa dela (usa o primeiro dia da regra).
 */
export function alvoDoEvento(serie: boolean, escopo: EscopoDaSerie, ocorrencia: string | null): AlvoDoEvento {
  if (!serie) return {};
  if (escopo === 'TODAS') return { escopo };
  return { escopo, ocorrencia };
}

// ---- Formulário ----

export interface FormularioDoEvento {
  agendaId: string;
  titulo: string;
  local: string;
  descricao: string;
  /** DD/MM/AAAA, como no `CampoData`. */
  data: string;
  diaInteiro: boolean;
  /** HH:MM digitado. */
  hora: string;
  duracao: string;
  repeticao: FormularioDaRepeticaoDoEvento;
}

export type ErrosDoEvento = Partial<Record<keyof FormularioDoEvento, string>>;

/** Evento novo; `hora` já preenchida quando a pessoa tocou num horário da grade. */
export function formularioDeEventoNovo(agendaId: string, data: string, hora = ''): FormularioDoEvento {
  return {
    agendaId, titulo: '', local: '', descricao: '', data: dataParaTela(data), diaInteiro: false, hora, duracao: String(DURACAO_PADRAO_DO_EVENTO),
    repeticao: { ...SEM_REPETICAO_DO_EVENTO, dias: [] },
  };
}

const minutosEntre = (inicio: string, fim: string) => Math.round((Date.parse(fim) - Date.parse(inicio)) / 60_000);

/**
 * O formulário de um evento já gravado. Mostra a ocorrência aberta (com a exceção aplicada: data, hora, título) e a regra de
 * repetição; sem ocorrência (a aberta foi cancelada), a regra.
 */
export function formularioDoEvento(e: EventoDetalhe, ocorrencia: OcorrenciaDeEvento | null = e.ocorrencia): FormularioDoEvento {
  const o = ocorrencia;
  const r = e.repeticao;
  const duracao = o && !o.diaInteiro ? minutosEntre(o.inicio, o.fim) : e.duracaoMinutos;
  return {
    agendaId: o?.agendaId ?? e.agendaId,
    titulo: o?.titulo ?? e.titulo,
    local: (o ? o.local : e.local) ?? '',
    descricao: (o ? o.descricao : e.descricao) ?? '',
    data: dataParaTela(o?.data ?? e.data),
    diaInteiro: o?.diaInteiro ?? e.diaInteiro,
    hora: o?.hora ?? e.hora ?? '',
    duracao: duracao != null ? String(duracao) : String(DURACAO_PADRAO_DO_EVENTO),
    repeticao: !r || r.tipo === 'NENHUMA' ? { ...SEM_REPETICAO_DO_EVENTO, dias: [] } : {
      tipo: r.tipo,
      dias: DIAS_DA_SEMANA.filter((d) => r.diasDaSemana?.includes(d)),
      fim: r.ate ? 'DATA' : r.vezes != null ? 'VEZES' : 'NUNCA',
      ate: dataParaTela(r.ate ?? null),
      vezes: r.vezes != null ? String(r.vezes) : '',
    },
  };
}

/** O evento tem regra de repetição? (O detalhe traz `repeticao` nula no avulso.) */
export const ehSerieDeEventos = (e: Pick<EventoDetalhe, 'repeticao'>): boolean => !!e.repeticao && e.repeticao.tipo !== 'NENHUMA';

/** A data do formulário é outra que a da ocorrência aberta (numa série, só vale para `ESTA`). */
export const mudouADataDoEvento = (f: Pick<FormularioDoEvento, 'data'>, o: Pick<OcorrenciaDeEvento, 'data'>): boolean => dataDaTela(f.data) !== o.data;

export const mudouAAgendaDoEvento = (f: Pick<FormularioDoEvento, 'agendaId'>, e: Pick<EventoDetalhe, 'agendaId'>): boolean => f.agendaId !== e.agendaId;

export interface OpcoesDoPedidoDoEvento {
  /** Presente = alterar (PUT); ausente = criar. */
  versao?: number;
  /**
   * Alterar numa série. `ocorrencia` é o `dataOriginal` da aberta e `primeiroDia` o primeiro dia da regra. A `data` do corpo
   * não é a do formulário em `SEGUINTES` (vale a ocorrência) nem em `TODAS` (vale o primeiro dia): a API exige. Em `ESTA` a
   * repetição não vai (a API a ignora). Ausente = evento novo ou avulso.
   */
  serie?: { escopo: EscopoDaSerie; ocorrencia: string | null; primeiroDia: string };
}

/** Confere o formulário e monta o pedido. Hora e duração só no evento com horário; título, local e descrição aparados. */
export function pedidoDoEvento(f: FormularioDoEvento, opcoes: OpcoesDoPedidoDoEvento = {}):
  { erros: ErrosDoEvento; errosDaRepeticao: ErrosDaRepeticaoDoEvento; pedido: EventoRequest | null } {
  const erros: ErrosDoEvento = {};
  if (!f.agendaId) erros.agendaId = 'Escolha a agenda.';
  const titulo = f.titulo.trim();
  if (!titulo) erros.titulo = 'Informe o título.';
  else if (titulo.length > LIMITES_DO_EVENTO.titulo) erros.titulo = `Use até ${LIMITES_DO_EVENTO.titulo} caracteres.`;
  const local = f.local.trim();
  if (local.length > LIMITES_DO_EVENTO.local) erros.local = `Use até ${LIMITES_DO_EVENTO.local} caracteres.`;
  const descricao = f.descricao.trim();
  if (descricao.length > LIMITES_DO_EVENTO.descricao) erros.descricao = `Use até ${LIMITES_DO_EVENTO.descricao} caracteres.`;
  const dataDoFormulario = dataDaTela(f.data);
  if (!dataDoFormulario) erros.data = dataDoFormulario === null ? 'Informe a data.' : 'Data inválida.';
  else if (!dataNoIntervalo(dataDoFormulario)) erros.data = FORA_DO_INTERVALO;
  let hora: string | null = null;
  let duracaoMinutos: number | null = null;
  if (!f.diaInteiro) {
    hora = f.hora.trim();
    if (!hora) erros.hora = 'Informe a hora.';
    else if (!horaValida(hora)) erros.hora = 'Use HH:MM, de 00:00 a 23:59.';
    const duracao = /^\d+$/.test(f.duracao.trim()) ? Number(f.duracao.trim()) : NaN;
    if (!Number.isInteger(duracao) || duracao < LIMITES_DO_EVENTO.duracaoMinima || duracao > LIMITES_DO_EVENTO.duracaoMaxima) {
      erros.duracao = `De ${LIMITES_DO_EVENTO.duracaoMinima} a ${LIMITES_DO_EVENTO.duracaoMaxima} minutos.`;
    } else duracaoMinutos = duracao;
  }
  const serie = opcoes.serie;
  let data = dataDoFormulario || null;
  if (serie?.escopo === 'SEGUINTES') {
    data = serie.ocorrencia;
    if (!data) erros.data = 'Abra o evento pela agenda para alterar este e os seguintes.';
  } else if (serie?.escopo === 'TODAS') data = serie.primeiroDia;
  const semRepeticao = serie?.escopo === 'ESTA';
  const rep = semRepeticao ? { erros: {} as ErrosDaRepeticaoDoEvento, repeticao: null } : repeticaoDoEvento(f.repeticao, data);
  if (Object.keys(rep.erros).length) erros.repeticao = 'Confira a repetição.';
  if (Object.keys(erros).length || !data) return { erros, errosDaRepeticao: rep.erros, pedido: null };
  return {
    erros,
    errosDaRepeticao: rep.erros,
    pedido: {
      agendaId: f.agendaId, titulo, local: local || null, descricao: descricao || null, data, diaInteiro: f.diaInteiro, hora, duracaoMinutos,
      repeticao: rep.repeticao, ...(opcoes.versao !== undefined ? { versao: opcoes.versao } : {}),
    },
  };
}

/** Intervalo do pedido, para o aviso de evento no mesmo horário; dia inteiro não entra (D5): `null`. */
export function intervaloDoEvento(p: Pick<EventoRequest, 'data' | 'hora' | 'duracaoMinutos' | 'diaInteiro'>): Intervalo | null {
  if (p.diaInteiro || !p.hora || p.duracaoMinutos == null) return null;
  const inicio = instanteDeBrasilia(p.data, p.hora);
  return { inicio, fim: new Date(Date.parse(inicio) + p.duracaoMinutos * 60_000).toISOString() };
}

// ---- Agendas pessoais ----

const chaveDoNome = (nome: string) => nome.trim().toLowerCase();

/** A agenda que o formulário traz marcada: a escolhida (se ainda existe), senão "Pessoal", senão a primeira; sem agenda, nenhuma. */
export function agendaDoFormulario(agendas: readonly AgendaPessoal[], escolhida?: string | null): AgendaPessoal | null {
  return agendas.find((a) => a.id === escolhida) ?? agendas.find((a) => chaveDoNome(a.nome) === chaveDoNome(NOME_DA_AGENDA_PADRAO)) ?? agendas[0] ?? null;
}

interface ApiDeAgendas {
  criar(corpo: AgendaPessoalRequest): Promise<AgendaPessoal>;
  listar(): Promise<AgendaPessoal[]>;
}

/**
 * Quem ainda não tem agenda ganha a "Pessoal" (azul) ao salvar o primeiro evento: a API não cria sozinha. Se a criação
 * responde 409 `AGENDA_NOME_EM_USO` (outra aba criou), usa a que já existe; qualquer outro erro sobe.
 */
export async function garantirAgendaPadrao(api: ApiDeAgendas): Promise<AgendaPessoal> {
  try {
    return await api.criar({ nome: NOME_DA_AGENDA_PADRAO, cor: COR_DA_AGENDA_PADRAO });
  } catch (erro) {
    if ((erro as { codigo?: unknown } | null)?.codigo !== 'AGENDA_NOME_EM_USO') throw erro;
    const existente = (await api.listar()).find((a) => chaveDoNome(a.nome) === chaveDoNome(NOME_DA_AGENDA_PADRAO));
    if (!existente) throw erro;
    return existente;
  }
}

export interface ErrosDaAgenda { nome?: string; cor?: string; geral?: string }

/**
 * Confere nome e cor da agenda pessoal (nome de 1 a 40 caracteres, único ignorando maiúsculas, uma das 8 cores, no máximo
 * 20 agendas) e monta o pedido. `id` e `versao` presentes = renomear ou recolorir; ausentes = criar.
 */
export function pedidoDaAgenda(nome: string, cor: string, existentes: readonly AgendaPessoal[], editando?: { id: string; versao: number }):
  { erros: ErrosDaAgenda; pedido: AgendaPessoalRequest | null } {
  const erros: ErrosDaAgenda = {};
  const limpo = nome.trim();
  if (!limpo) erros.nome = 'Informe o nome da agenda.';
  else if (limpo.length > LIMITES_DA_AGENDA.nome) erros.nome = `Use até ${LIMITES_DA_AGENDA.nome} caracteres.`;
  else if (existentes.some((a) => a.id !== editando?.id && chaveDoNome(a.nome) === chaveDoNome(limpo))) erros.nome = 'Você já tem uma agenda com esse nome.';
  if (!(CHAVES_DA_AGENDA as readonly string[]).includes(cor)) erros.cor = 'Escolha uma das cores da lista.';
  if (!editando && existentes.length >= LIMITES_DA_AGENDA.agendas) {
    erros.geral = `Você já tem ${LIMITES_DA_AGENDA.agendas} agendas. Apague uma para criar outra.`;
  }
  if (Object.keys(erros).length) return { erros, pedido: null };
  return { erros, pedido: { nome: limpo, cor: cor as CorDaAgenda, ...(editando ? { versao: editando.versao } : {}) } };
}

/** Dá para criar mais uma agenda? */
export const podeCriarAgenda = (quantas: number): boolean => quantas < LIMITES_DA_AGENDA.agendas;

/** Texto do painel de apagar a agenda: diz quantos eventos (séries, não ocorrências) vão junto. */
export function textoDeApagarAgenda(eventos: number): string {
  if (eventos <= 0) return 'Apagar esta agenda? Ela não tem eventos. Não dá para desfazer.';
  const quantos = eventos === 1 ? '1 evento' : `${eventos} eventos`;
  return `Apagar esta agenda e ${quantos} dela? Não dá para desfazer.`;
}

// ---- Erros da API ----

/**
 * Texto próprio do calendário para um erro da API ao salvar ou apagar uma agenda ou um evento; `null` = mostrar a mensagem
 * da API. `contexto` só muda a frase do `CONFLITO_EDICAO`.
 */
export function textoDoErroDoCalendario(erro: unknown, contexto: 'agenda' | 'evento' = 'evento'): string | null {
  const codigo = (erro as { codigo?: unknown } | null)?.codigo;
  switch (codigo) {
    case 'LIMITE_DE_AGENDAS': return `Você já tem ${LIMITES_DA_AGENDA.agendas} agendas. Apague uma para criar outra.`;
    case 'AGENDA_NOME_EM_USO': return 'Você já tem uma agenda com esse nome.';
    case 'AGENDA_INVALIDA': return `O nome da agenda precisa ter de 1 a ${LIMITES_DA_AGENDA.nome} caracteres.`;
    case 'COR_INVALIDA': return 'Escolha uma das cores da lista.';
    case 'LIMITE_DE_EVENTOS': return `Você já tem ${LIMITES_DO_EVENTO.eventos} eventos. Exclua algum para criar outro.`;
    case 'REPETICAO_INVALIDA': return 'Confira a repetição do evento.';
    case 'EVENTO_INVALIDO': return 'Confira o título, a hora e a duração do evento.';
    case 'EVENTO_SEM_SERIE': return 'Este evento não se repete mais. Feche e abra de novo para ver a versão atual.';
    case 'OCORRENCIA_OBRIGATORIA': return 'Abra o evento pela agenda para alterar só este ou os seguintes.';
    case 'DATA_SO_NESTA_OCORRENCIA': return 'A data só muda em "Somente este evento".';
    case 'AGENDA_SO_NA_SERIE_TODA': return 'A agenda só muda para a série toda.';
    case 'PERIODO_INVALIDO': return 'O período escolhido é inválido. Volte e tente de novo.';
    case 'FILTRO_INVALIDO': return 'O filtro escolhido é inválido. Tente de novo.';
    case 'CONFLITO_EDICAO':
      return `Outra pessoa ou aba alterou ${contexto === 'agenda' ? 'esta agenda' : 'este evento'}. Feche e abra de novo para ver a versão atual.`;
    default: return null;
  }
}
