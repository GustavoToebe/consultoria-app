import type {
  Atualizacao, ConteudoQuestionario, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao, TipoPergunta,
} from '../api/tipos';
import { numeroParaTela } from './formatos';
import { LIMITES_QUESTIONARIO } from './questionario';
import { respondida, respostaValida } from './respostasAtualizacao';

const SEM_DADO = '—';
const TIPOS_DE_DESTAQUE: readonly TipoPergunta[] = ['NOTA', 'NUMERO', 'SIM_NAO', 'ESCOLHA_UNICA'];
const ROTULO_MAXIMO = 32;

export const todasAsPerguntas = (modelo: ConteudoQuestionario) => modelo.secoes.flatMap((s) => s.perguntas);

/** No máximo uma pergunta PESO por questionário (regra de publicação); é ela que alimenta o registro de peso. */
export const perguntaPeso = (modelo: ConteudoQuestionario) => todasAsPerguntas(modelo).find((p) => p.tipo === 'PESO');

/** Perguntas do resumo do treinador, na ordem do documento. */
export const perguntasDestaque = (modelo: ConteudoQuestionario) =>
  todasAsPerguntas(modelo).filter((p) => p.destaque && TIPOS_DE_DESTAQUE.includes(p.tipo)).slice(0, LIMITES_QUESTIONARIO.destaquesMaximo);

/** Texto de uma resposta para leitura. Ausência é "—", nunca zero; `false` e `0` são respostas. */
export function textoDaResposta(p: PerguntaAtualizacao, valor: RespostaAtualizacao | undefined): string {
  if (!respondida(valor)) return SEM_DADO;
  switch (p.tipo) {
    case 'PESO': return typeof valor === 'number' ? `${numeroParaTela(valor, 1)} kg` : SEM_DADO;
    case 'NOTA': return typeof valor === 'number' ? numeroParaTela(valor, 0) : SEM_DADO;
    case 'NUMERO':
      return typeof valor === 'number' ? `${numeroParaTela(valor, p.casas ?? 0)}${p.unidade ? ` ${p.unidade}` : ''}` : SEM_DADO;
    case 'SIM_NAO': return typeof valor === 'boolean' ? (valor ? 'Sim' : 'Não') : SEM_DADO;
    case 'ESCOLHA_UNICA': return (p.opcoes ?? []).find((o) => o.id === valor)?.rotulo ?? SEM_DADO;
    case 'MULTIPLA_ESCOLHA': {
      if (!Array.isArray(valor)) return SEM_DADO;
      const escolhidas = (p.opcoes ?? []).filter((o) => valor.includes(o.id)).map((o) => o.rotulo);
      return escolhidas.length ? escolhidas.join(', ') : SEM_DADO;
    }
    case 'NOTAS_POR_DIA':
      if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return SEM_DADO;
      return (p.dias ?? []).map((d) => `Dia ${d}: ${valor[String(d)] ?? SEM_DADO}`).join('\n');
    case 'TEXTO':
    case 'TEXTO_LONGO': return typeof valor === 'string' ? valor : SEM_DADO;
    default: return SEM_DADO;
  }
}

const cortar = (texto: string) => (texto.length > ROTULO_MAXIMO ? `${texto.slice(0, ROTULO_MAXIMO - 1)}…` : texto);

export interface ResumoDoTreinador {
  /** Nulo quando o questionário não tem pergunta PESO; com a pergunta e sem resposta, `valor` é nulo (mostra "—"). */
  peso: { valor: number | null; variacao: number | null } | null;
  destaques: { id: string; rotulo: string; texto: string }[];
  mediaDiasPorSemana: number | null;
  pesoAnterior: number | null;
}

/**
 * O que o treinador vê no alto da atualização: peso (e a variação sobre o último peso registrado antes) quando o
 * questionário tem pergunta PESO, mais as perguntas marcadas como destaque. Nada vem de id fixo.
 */
export function resumoDoTreinador(
  modelo: ConteudoQuestionario, respostas: RespostasAtualizacao | null | undefined, resumo: Atualizacao['resumo'],
): ResumoDoTreinador {
  const respostasDe = respostas ?? {};
  const pesoAnterior = resumo?.pesoAnterior ?? null;
  const perguntaDoPeso = perguntaPeso(modelo);
  const valorDoPeso = perguntaDoPeso ? respostasDe[perguntaDoPeso.id] : null;
  const pesoInformado = typeof valorDoPeso === 'number' ? valorDoPeso : null;
  const peso = !perguntaDoPeso ? null
    : { valor: pesoInformado, variacao: pesoInformado == null || pesoAnterior == null ? null : pesoInformado - pesoAnterior };
  return {
    peso,
    destaques: perguntasDestaque(modelo).map((p) => ({
      id: p.id, rotulo: cortar(p.rotuloCurto?.trim() || p.rotulo), texto: textoDaResposta(p, respostasDe[p.id]),
    })),
    mediaDiasPorSemana: resumo?.mediaDiasPorSemana ?? null,
    pesoAnterior,
  };
}

/**
 * Respostas que continuam valendo num questionário novo: o id existe, o valor é do tipo e da faixa da pergunta nova.
 * Fotos e data automática nunca guardam resposta.
 */
export function respostasCompativeis(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao) {
  const perguntas = new Map(todasAsPerguntas(modelo)
    .filter((p) => p.tipo !== 'FOTOS' && p.tipo !== 'DATA_AUTOMATICA').map((p) => [p.id, p]));
  const mantidas: RespostasAtualizacao = {};
  const descartadas: string[] = [];
  for (const [id, valor] of Object.entries(respostas)) {
    if (!respondida(valor)) continue; // vazio não tem o que manter nem o que perder
    const pergunta = perguntas.get(id);
    if (pergunta && respostaValida(pergunta, valor)) mantidas[id] = valor;
    else descartadas.push(id);
  }
  return { respostas: mantidas, descartadas };
}

export interface RascunhoDaAtualizacao { questionarioVersaoId?: string | null; modeloVersao?: number | null; respostas: RespostasAtualizacao }

/**
 * Respostas com que o formulário abre. Rascunho da mesma versão fica como está. Rascunho de outra versão (ou legado, que
 * só guardava o número) passa por `respostasCompativeis`. `mudou` liga o aviso "seu treinador atualizou o questionário":
 * só quando as duas versões são conhecidas e diferentes ou quando alguma resposta teve de ser descartada. Um rascunho
 * legado que não perde nada é adaptado em silêncio. `questionarioVersaoId` da atualização pode faltar (cópia antiga no aparelho).
 */
export function rascunhoVigente(rascunho: RascunhoDaAtualizacao | null, atualizacao: Pick<Atualizacao, 'modelo' | 'questionarioVersaoId'>) {
  if (!rascunho) return { respostas: {} as RespostasAtualizacao, mudou: false, adaptado: false };
  const atual = atualizacao.questionarioVersaoId ?? null;
  const salvo = rascunho.questionarioVersaoId ?? null;
  if (salvo && atual && salvo === atual) return { respostas: rascunho.respostas, mudou: false, adaptado: false };
  if (!atualizacao.modelo) return { respostas: rascunho.respostas, mudou: false, adaptado: false };
  const { respostas, descartadas } = respostasCompativeis(atualizacao.modelo, rascunho.respostas);
  return { respostas, mudou: (!!salvo && !!atual && salvo !== atual) || descartadas.length > 0, adaptado: true };
}

// ---- Apoio dos controles do formulário ----
export type SimNao = 'sim' | 'nao';
export const simNaoParaEscolha = (valor: RespostaAtualizacao | undefined): SimNao | null =>
  valor === true ? 'sim' : valor === false ? 'nao' : null;
export const escolhaParaSimNao = (escolha: SimNao | null): boolean | null => (escolha === 'sim' ? true : escolha === 'nao' ? false : null);

/** Marca ou desmarca uma opção e devolve a lista na ordem das opções (a resposta não depende da ordem dos toques). */
export function alternarMarcado(lista: readonly string[], opcoes: readonly { id: string }[], id: string): string[] {
  const marcados = new Set(lista);
  if (marcados.has(id)) marcados.delete(id); else marcados.add(id);
  return opcoes.filter((o) => marcados.has(o.id)).map((o) => o.id);
}

/** "De 0 a 10, até 1 casa decimal." — só o que a pergunta define. */
export function ajudaDoNumero(p: PerguntaAtualizacao): string {
  const casas = p.casas ?? 0;
  const faixa = typeof p.min === 'number' && typeof p.max === 'number' ? `De ${numeroParaTela(p.min, casas)} a ${numeroParaTela(p.max, casas)}`
    : typeof p.min === 'number' ? `A partir de ${numeroParaTela(p.min, casas)}`
    : typeof p.max === 'number' ? `Até ${numeroParaTela(p.max, casas)}` : '';
  const decimais = casas === 0 ? 'número inteiro' : `até ${casas} ${casas === 1 ? 'casa decimal' : 'casas decimais'}`;
  return faixa ? `${faixa}, ${decimais}.` : `${decimais[0].toUpperCase()}${decimais.slice(1)}.`;
}
