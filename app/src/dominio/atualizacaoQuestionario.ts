import type {
  Atualizacao, ConteudoQuestionario, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao, TipoPergunta,
} from '../api/tipos';
import type { RascunhoAtualizacao } from '../offline/repositorioLocal';
import { enderecoDaResposta, enderecoParaLeitura } from './cadastroDoAluno';
import { dataParaTela, numeroParaTela } from './formatos';
import { escalaDaNota, LIMITES_QUESTIONARIO, semResposta } from './questionario';
import { avaliarRespostas, respondida, respondidaNaPergunta, respostaValida } from './respostasAtualizacao';

const SEM_DADO = '—';
/** Pergunta escondida por condição (na leitura): diferente de "não respondida" e de "não". */
export const NAO_SE_APLICA = 'Não se aplica';
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
    case 'TEXTO_LONGO':
    case 'TELEFONE':
    case 'EMAIL': return typeof valor === 'string' ? valor : SEM_DADO;
    case 'DATA': return typeof valor === 'string' ? dataParaTela(valor) || valor : SEM_DADO;
    case 'ACEITE': return valor === true ? `Aceito: “${p.declaracao ?? ''}”` : SEM_DADO;
    case 'GRADE': {
      if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return SEM_DADO;
      const marcadas = valor as Record<string, unknown>;
      return (p.linhas ?? []).map((l) => `${l.rotulo}: ${(p.colunas ?? []).find((c) => c.id === marcadas[l.id])?.rotulo ?? SEM_DADO}`).join('\n');
    }
    case 'ENDERECO': return enderecoParaLeitura(enderecoDaResposta(valor)) ?? SEM_DADO;
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
 * Data automática nunca guarda resposta; fotos guardam só os ids das já enviadas.
 */
export function respostasCompativeis(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao) {
  const perguntas = new Map(todasAsPerguntas(modelo)
    .filter((p) => !semResposta(p.tipo)).map((p) => [p.id, p]));
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

/**
 * Respostas com que o formulário abre. Rascunho da mesma versão fica como está. Rascunho de outra versão (o treinador
 * publicou uma nova, ou trocou o questionário da pasta) passa por `respostasCompativeis` e `mudou` liga o aviso
 * "seu treinador atualizou o questionário".
 */
export function rascunhoVigente(rascunho: RascunhoAtualizacao | null, atualizacao: Pick<Atualizacao, 'modelo' | 'questionarioVersaoId'>) {
  if (!rascunho) return { respostas: {} as RespostasAtualizacao, mudou: false, adaptado: false };
  if (rascunho.questionarioVersaoId === atualizacao.questionarioVersaoId || !atualizacao.modelo) {
    return { respostas: rascunho.respostas, mudou: false, adaptado: false };
  }
  const { respostas } = respostasCompativeis(atualizacao.modelo, rascunho.respostas);
  return { respostas, mudou: true, adaptado: true };
}

/** Por seção visível: quantas perguntas respondíveis estão respondidas (para o "3 de 5" e a barra do formulário). */
export function progressoDasSecoes(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao, fotosLigadas = false) {
  const { escondidas, secoesEscondidas } = avaliarRespostas(modelo, respostas, fotosLigadas);
  return modelo.secoes.map((secao, i) => {
    if (secoesEscondidas.has(i)) return null;
    const contam = secao.perguntas.filter((p) => !semResposta(p.tipo) && !escondidas.has(p.id) && (p.tipo !== 'FOTOS' || fotosLigadas));
    return { respondidas: contam.filter((p) => respondidaNaPergunta(p, respostas[p.id]) && gradeCompleta(p, respostas[p.id])).length, total: contam.length };
  });
}

/** GRADE obrigatória só conta como respondida com todas as linhas (como a conferência do envio); as outras, sempre. */
function gradeCompleta(p: PerguntaAtualizacao, valor: RespostaAtualizacao | undefined) {
  if (p.tipo !== 'GRADE' || !p.obrigatoria) return true;
  const marcadas = typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
  return (p.linhas ?? []).every((l) => marcadas[l.id] != null);
}

/** "2 de 4 respondidas"; sem pergunta para responder, vazio. */
export const textoDoProgresso = (p: { respondidas: number; total: number } | null) =>
  !p || p.total === 0 ? '' : `${p.respondidas} de ${p.total} ${p.total === 1 ? 'respondida' : 'respondidas'}`;

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

/** "7 de 10": a nota na leitura, com a ponta de cima (uma escala de 1 a 5 não se confunde com uma de 0 a 10). */
export function textoDaNota(p: Pick<PerguntaAtualizacao, 'min' | 'max'>, valor: RespostaAtualizacao | undefined): string {
  return typeof valor === 'number' ? `${numeroParaTela(valor, 0)} de ${escalaDaNota(p).max}` : SEM_DADO;
}

/** GRADE na leitura: uma linha por item, com a coluna escolhida ou "—". */
export function respostasDaGrade(p: Pick<PerguntaAtualizacao, 'linhas' | 'colunas'>, valor: RespostaAtualizacao | undefined) {
  const marcadas = typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
  return (p.linhas ?? []).map((l) => ({
    id: l.id,
    linha: l.rotulo,
    resposta: (p.colunas ?? []).find((c) => c.id === marcadas[l.id])?.rotulo ?? SEM_DADO,
  }));
}

/** Opções com imagem por linha, pela largura da área: 2 no celular, 3 numa coluna média, 4 numa larga. */
export const colunasDasOpcoes = (largura: number) => (largura < 480 ? 2 : largura < 760 ? 3 : 4);
