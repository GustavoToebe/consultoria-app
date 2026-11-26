import type { CorpoDaLiberacao } from '../api/liberacaoDePlano';
import type { PlanoResumo } from '../api/tipos';
import { faixaDaRegra } from './datasValidas';
import { hojeEmBrasilia } from './financeiro';
import { dataDaTela, dataParaTela } from './formatos';
import { dataSemAnoCorrente } from './periodoCurto';

/**
 * Liberação agendada do plano (bloco E, D1 e D2): regras puras do "Agendar" do editor, do "Publicar tudo" da pasta e das
 * ações "Alterar data" e "Liberar agora". O dia é sempre o de Brasília (`hojeEmBrasilia`), nunca o do aparelho: a API
 * aceita de amanhã até 31/12 de hoje + 5 anos (a faixa `PLANEJAMENTO`) e confere de novo (422 `LIBERACAO_INVALIDA`).
 */

export type ModoDaLiberacao = 'agora' | 'agendar';

export interface EscolhaDaLiberacao {
  modo: ModoDaLiberacao;
  /** `DD/MM/AAAA` como está no campo (só vale com `agendar`). */
  dataTexto: string;
  avisar: boolean;
}

/** Amanhã em Brasília, `AAAA-MM-DD`. */
export function amanhaEmBrasilia(hoje: string = hojeEmBrasilia()): string {
  const [a, m, d] = hoje.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Primeiro e último dia aceitos para liberar. */
export function faixaDaLiberacao(hoje: string = hojeEmBrasilia()): { minimo: string; maximo: string } {
  return { minimo: amanhaEmBrasilia(hoje), maximo: faixaDaRegra('PLANEJAMENTO', hoje).maximo };
}

/** "De 27/11/2026 até 31/12/2031." (ajuda do campo e mensagem de fora da faixa). */
export function textoDaFaixa(hoje: string = hojeEmBrasilia()): string {
  const { minimo, maximo } = faixaDaLiberacao(hoje);
  return `A partir de amanhã (${dataParaTela(minimo)}) até ${dataParaTela(maximo)}.`;
}

export const MENSAGEM_SEM_DATA = 'Informe o dia em que o aluno passa a ver o plano.';
const DATA_INVALIDA = 'Data inválida.';

/** Valida o campo "Liberar em". Vazio é erro (quem escolheu agendar precisa de uma data). */
export function validarDataDeLiberacao(texto: string, hoje: string = hojeEmBrasilia()): { iso: string | null; erro: string | null } {
  const iso = dataDaTela(texto);
  if (iso === null) return { iso: null, erro: MENSAGEM_SEM_DATA };
  if (iso === undefined) return { iso: null, erro: DATA_INVALIDA };
  const { minimo, maximo } = faixaDaLiberacao(hoje);
  if (iso < minimo || iso > maximo) return { iso: null, erro: `Escolha um dia ${textoDaFaixa(hoje).charAt(0).toLowerCase()}${textoDaFaixa(hoje).slice(1)}` };
  return { iso, erro: null };
}

/**
 * Erro que o campo mostra enquanto a pessoa digita: nada com a data incompleta, a menos que já tenha tentado enviar
 * (`tentou`); a regra completa em {@link validarDataDeLiberacao}.
 */
export function erroDoCampo(texto: string, tentou: boolean, hoje: string = hojeEmBrasilia()): string | null {
  if (!tentou && texto.trim().length !== 10) return null;
  return validarDataDeLiberacao(texto, hoje).erro;
}

/**
 * Corpo da liberação. Só vai o que foge do padrão da API (liberar na hora e avisar): publicar agora com aviso manda `{}`,
 * igual à publicação de antes do bloco E. Agendar exige uma data válida; senão devolve o erro do campo.
 */
export function corpoDaLiberacao(e: EscolhaDaLiberacao, hoje: string = hojeEmBrasilia()): { corpo: CorpoDaLiberacao } | { erro: string } {
  // Caixa marcada = campo NÃO enviado (decisão do Gustavo, 26/11): o contrato da API trata `avisarAluno` ausente como true
  // (`PublicarRequest`/`PublicarPastaRequest`); só a caixa desmarcada manda `avisarAluno: false`.
  const aviso: CorpoDaLiberacao = e.avisar ? {} : { avisarAluno: false };
  if (e.modo === 'agora') return { corpo: aviso };
  const { iso, erro } = validarDataDeLiberacao(e.dataTexto, hoje);
  return iso ? { corpo: { liberarEm: iso, ...aviso } } : { erro: erro ?? DATA_INVALIDA };
}

/**
 * Como a escolha nasce: plano já agendado traz a data e o aviso gravados (publicar de novo substitui o agendamento); senão,
 * o `modo` pedido, sem data e com o aviso ligado.
 */
export function escolhaInicial(plano: Pick<PlanoResumo, 'liberarEm' | 'avisarNaLiberacao'>, modo: ModoDaLiberacao): EscolhaDaLiberacao {
  if (plano.liberarEm) return { modo: 'agendar', dataTexto: dataParaTela(plano.liberarEm), avisar: plano.avisarNaLiberacao ?? true };
  return { modo, dataTexto: '', avisar: true };
}

/** "Liberar agora" repete o aviso escolhido ao agendar (ausente = avisa, como a API). */
export const avisarAoLiberarAgora = (plano: Pick<PlanoResumo, 'avisarNaLiberacao'>): boolean => plano.avisarNaLiberacao ?? true;

/** Selo neutro do plano (ou da pasta) agendado: "Agendado para 27/11" (com o ano só se não for o corrente). */
export function rotuloAgendado(liberarEm: string, hoje: string = hojeEmBrasilia()): string {
  return `Agendado para ${dataSemAnoCorrente(liberarEm, hoje)}`;
}

/** O que o aviso faz, sem prometer canal (o push pode estar desligado): o texto fixo só diz que há plano novo. */
export const AJUDA_DO_AVISO = 'O aviso só diz que há um plano novo.';

/** Marcada por padrão nos dois modos (decisão do Gustavo); desmarcada manda `avisarAluno: false`. */
export const rotuloDoAviso = (modo: ModoDaLiberacao): string => (modo === 'agendar' ? 'Avisar o aluno quando liberar' : 'Avisar o aluno');

export const OPCOES_DA_LIBERACAO: readonly { valor: ModoDaLiberacao; rotulo: string }[] = [
  { valor: 'agora', rotulo: 'Liberar agora' },
  { valor: 'agendar', rotulo: 'Agendar para uma data' },
];

/** Aviso depois de publicar um plano: o que o aluno vê e quando. */
export function textoDoPublicado(numero: number, liberarEm: string | null | undefined, hoje: string = hojeEmBrasilia()): string {
  if (!liberarEm) return `Publicado v${numero}. O aluno já vê esta versão.`;
  return `Publicado v${numero}, agendado para ${dataSemAnoCorrente(liberarEm, hoje)}. Até lá, o aluno continua com o que já via.`;
}

/** Corpo do painel "Liberar agora". */
export function textoDoLiberarAgora(liberarEm: string, hoje: string = hojeEmBrasilia()): string {
  return `A liberação marcada para ${dataSemAnoCorrente(liberarEm, hoje)} é antecipada e o aluno passa a ver esta versão já.`;
}

export const TEXTO_DO_ALTERAR_DATA = 'Até a nova data, o aluno continua com o que já via.';
export const TEXTO_JA_LIBERADO = 'Este plano não está mais agendado: já foi liberado ao aluno.';

/** Erro da API reduzido ao que a regra precisa (o `ErroApi` do cliente serve). */
export interface ErroDaLiberacao {
  status: number;
  codigo: string | null;
  campos: readonly { field: string; message: string }[];
}

/**
 * Para onde vai o erro de publicar, alterar a data ou liberar agora: 422 `LIBERACAO_INVALIDA` vai ao campo (a mensagem
 * da API); 409 `PLANO_NAO_AGENDADO` vira aviso e pede recarregar a lista; o resto, `null` (quem chama usa o texto geral).
 */
export function destinoDoErro(e: ErroDaLiberacao): { campo: string } | { aviso: string; recarregar: true } | null {
  if (e.codigo === 'LIBERACAO_INVALIDA') {
    return { campo: e.campos.find((c) => c.field === 'liberarEm')?.message ?? e.campos[0]?.message ?? DATA_INVALIDA };
  }
  if (e.codigo === 'PLANO_NAO_AGENDADO') return { aviso: TEXTO_JA_LIBERADO, recarregar: true };
  return null;
}
