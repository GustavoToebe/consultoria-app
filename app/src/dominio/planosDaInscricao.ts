import type { Periodicidade, PlanoDaPagina } from '../api/inscricoesTipos';
import type { ConteudoQuestionario, PerguntaAtualizacao, RespostasAtualizacao } from '../api/tipos';
import { centavosParaTela } from './formatos';
import { ID_DA_PERGUNTA_DO_PLANO, PERIODICIDADES } from './inscricoes';

export { ID_DA_PERGUNTA_DO_PLANO };

/**
 * Sugestão de planos comerciais na página pública (link completo e Ficha rápida, 27/11). A API manda os planos ativos da
 * consultoria (`planos`) e, só com "Mostrar o preço dos planos" ligado no link, o `valorCentavos` de cada um; o app nunca
 * mostra preço sem valor. A pessoa escolhe um cartão ou "Outro / ainda não sei"; o id vai em `planoComercialId` e o texto
 * de "Outro" é a resposta da pergunta do plano (Ficha rápida) ou o `planoOutroTexto` (página completa).
 */

/** Valor do cartão "Outro / ainda não sei" na escolha (nunca vai à API). */
export const PLANO_OUTRO = 'OUTRO';
/** Rótulo da escolha quando o link não tem a pergunta do plano (página completa): o mesmo da Ficha rápida, como no pedido de 27/11. */
export const ROTULO_DA_ESCOLHA_SEM_PERGUNTA = 'Qual plano combinou?';
export const ROTULO_DO_OUTRO = 'Outro / ainda não sei';
/**
 * "Outro" na página completa (sem a pergunta do plano, que só a Ficha rápida tem; V116): campo próprio, obrigatório com
 * "Outro" e até 120 caracteres, que vai em `planoOutroTexto`. Na Ficha rápida o texto continua sendo a resposta da pergunta.
 */
export const ROTULO_DO_TEXTO_DO_OUTRO = 'Qual plano?';
export const LIMITE_DO_TEXTO_DO_OUTRO = 120;
export const ERRO_DO_OUTRO_VAZIO = 'Escreva qual plano combinou ou escolha um da lista.';

const PERIODO: Record<Periodicidade, string> = {
  MENSAL: 'todo mês',
  TRIMESTRAL: 'a cada 3 meses',
  SEMESTRAL: 'a cada 6 meses',
  ANUAL: 'a cada 12 meses',
  PARCELA_UNICA: 'pagamento único',
};
const POR: Record<Periodicidade, string> = {
  MENSAL: 'por mês',
  TRIMESTRAL: 'por trimestre',
  SEMESTRAL: 'por semestre',
  ANUAL: 'por ano',
  PARCELA_UNICA: 'à vista',
};

/** "Trimestral · a cada 3 meses" (parcela única: "Parcela única · pagamento único"). */
export const textoDoPeriodo = (p: Periodicidade): string => `${PERIODICIDADES[p]} · ${PERIODO[p]}`;

/** "R$ 997,00 por trimestre" / "R$ 1.200,00 à vista"; `null` com a opção desligada ou sem valor (nunca "—" nem zero). */
export function precoDoPlano(plano: Pick<PlanoDaPagina, 'valorCentavos' | 'periodicidade'>, mostrar: boolean): string | null {
  if (!mostrar || plano.valorCentavos === null || !Number.isFinite(plano.valorCentavos)) return null;
  return `${centavosParaTela(plano.valorCentavos)} ${POR[plano.periodicidade]}`;
}

/** A pergunta do plano no modelo publicado (só a Ficha rápida tem), ou `null`. */
export function perguntaDoPlano(modelo: ConteudoQuestionario | null | undefined): { pergunta: PerguntaAtualizacao; secao: string } | null {
  for (const s of modelo?.secoes ?? []) {
    const pergunta = s.perguntas.find((p) => p.id === ID_DA_PERGUNTA_DO_PLANO);
    if (pergunta) return { pergunta, secao: s.titulo };
  }
  return null;
}

/** O modelo sem a pergunta do plano (a página a desenha à parte); seção que fica vazia sai. `null` se não sobra nada. */
export function semAPerguntaDoPlano(modelo: ConteudoQuestionario | null | undefined): ConteudoQuestionario | null {
  if (!modelo) return null;
  const secoes = modelo.secoes
    .map((s) => ({ ...s, perguntas: s.perguntas.filter((p) => p.id !== ID_DA_PERGUNTA_DO_PLANO) }))
    .filter((s) => s.perguntas.length > 0);
  return secoes.length ? { ...modelo, secoes } : null;
}

/**
 * A escolha que vale: a que a pessoa fez (se o plano ainda está na lista; depois de recarregar ele pode ter saído), senão,
 * com um plano só, ele já vem marcado. `null` = nada escolhido. A tela guarda só a escolha explícita e calcula esta.
 */
export function escolhaEfetiva(escolha: string | null, planos: readonly Pick<PlanoDaPagina, 'id'>[]): string | null {
  if (escolha === PLANO_OUTRO) return planos.length ? PLANO_OUTRO : null;
  if (escolha && planos.some((p) => p.id === escolha)) return escolha;
  return planos.length === 1 ? planos[0].id : null;
}

/** O que vai em `planoComercialId`: o id do plano escolhido; "Outro" ou nada = `null`. */
export const planoDoEnvio = (efetiva: string | null): string | null => (efetiva && efetiva !== PLANO_OUTRO ? efetiva : null);

/** Com um plano escolhido o texto de "Outro" não vai (a API também o descarta): tira a resposta da pergunta do plano. */
export function respostasComPlano(respostas: RespostasAtualizacao, efetiva: string | null): RespostasAtualizacao {
  if (!planoDoEnvio(efetiva) || !(ID_DA_PERGUNTA_DO_PLANO in respostas)) return respostas;
  const resto = { ...respostas };
  delete resto[ID_DA_PERGUNTA_DO_PLANO];
  return resto;
}

/**
 * O `planoOutroTexto` do envio (página completa, sem a pergunta do plano): o texto sem espaços nas pontas só com "Outro"
 * marcado; com plano da lista, nada marcado ou na Ficha rápida (`comPergunta`), `null`.
 */
export function textoDoOutroDoEnvio(efetiva: string | null, texto: string, comPergunta: boolean): string | null {
  if (comPergunta || efetiva !== PLANO_OUTRO) return null;
  return texto.trim() || null;
}

/** Erro do campo "Qual plano?": com "Outro" marcado na página completa o texto é obrigatório (a API não sabe do "Outro"). */
export function errosDoOutro(efetiva: string | null, texto: string, comPergunta: boolean): Record<string, string> {
  if (comPergunta || efetiva !== PLANO_OUTRO) return {};
  const t = texto.trim();
  if (!t) return { planoOutroTexto: ERRO_DO_OUTRO_VAZIO };
  if (t.length > LIMITE_DO_TEXTO_DO_OUTRO) return { planoOutroTexto: `Use até ${LIMITE_DO_TEXTO_DO_OUTRO} caracteres.` };
  return {};
}

/** O plano escolhido na página, para a equipe: o nome do plano da lista, senão "Outro: <texto>"; `null` sem nenhum. */
export function planoEscolhidoNaPagina(d: { planoComercialNome: string | null; planoOutroTexto?: string | null }): string | null {
  if (d.planoComercialNome) return d.planoComercialNome;
  return d.planoOutroTexto ? `Outro: ${d.planoOutroTexto}` : null;
}
