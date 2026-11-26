import type {
  Atualizacao, ConteudoQuestionario, ItensDisponiveis, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao, TipoPergunta,
} from '../api/tipos';
import type { RascunhoAtualizacao } from '../offline/repositorioLocal';
import { enderecoDaResposta, enderecoParaLeitura } from './cadastroDoAluno';
import type { AjusteDoArranjo } from './listaDeDados';
import { dataParaTela, numeroParaTela } from './formatos';
import { escalaDaNota, LIMITES_QUESTIONARIO, semResposta, TIPOS_DE_PERGUNTA } from './questionario';
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
    case 'NOTA': return textoDaNota(p, valor);
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
      return (p.dias ?? []).map((d) => `Dia ${d}: ${textoDaNota({ min: 0, max: 10 }, valor[String(d)])}`).join('\n');
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
    case 'ITENS_DO_PLANO': return textoDosItens(valor);
    default: return SEM_DADO;
  }
}

/**
 * ITENS_DO_PLANO na leitura: uma linha por item, "Nome — motivo". O nome vem gravado na resposta do servidor (o rascunho do
 * aluno não o tem, só o `id`: item sem nome não aparece, e sem nenhum é "—").
 */
function textoDosItens(valor: RespostaAtualizacao | undefined): string {
  if (!Array.isArray(valor)) return SEM_DADO;
  const linhas = (valor as unknown[]).flatMap((i) => {
    const { nome, motivo } = (typeof i === 'object' && i !== null ? i : {}) as { nome?: unknown; motivo?: unknown };
    if (typeof nome !== 'string' || nome.trim() === '') return [];
    return [typeof motivo === 'string' && motivo.trim() !== '' ? `${nome.trim()} — ${motivo.trim()}` : nome.trim()];
  });
  return linhas.length ? linhas.join('\n') : SEM_DADO;
}

/** Pergunta que o aluno pulou, na leitura: diz o que houve (o "—" solto não dizia). */
export const NAO_RESPONDEU = 'Não respondeu';

/**
 * Resposta como a leitura mostra (aluno e treinador, `aluno/atualizacao/LeituraDasRespostas`): a forma decide o desenho e
 * `texto` é o que o leitor de tela ouve. Tipo novo = um caso em `respostaLida` e, se pedir desenho próprio, uma forma nova
 * (o `never` do fim obriga os dois).
 */
export type RespostaLida =
  | { forma: 'vazia' }
  | { forma: 'texto'; texto: string; numerico?: boolean }
  /** "4/10" em destaque; `escala` ("Escala de 1 a 5") só quando não é 0 a 10. */
  | { forma: 'nota'; nota: string; escala: string | null; texto: string }
  | { forma: 'simNao'; texto: 'Sim' | 'Não' }
  | { forma: 'notasPorDia'; dias: { dia: number; nota: string }[]; texto: string }
  | { forma: 'grade'; linhas: { id: string; linha: string; resposta: string }[]; texto: string }
  /** Escolha com imagem por opção: as escolhidas em destaque e as outras apagadas. */
  | { forma: 'opcoesComImagem'; texto: string }
  /** Fotos e texto informativo têm desenho próprio (miniaturas que abrem, texto formatado), fora da linha da lista. */
  | { forma: 'fotos' }
  | { forma: 'informativo' }
  /** Tipo que esta versão do app não conhece. */
  | { forma: 'desconhecida' };

/** Escolha com imagem em alguma opção: na resposta e na leitura, as opções viram cartões com a imagem. */
export const temImagemNasOpcoes = (p: Pick<PerguntaAtualizacao, 'tipo' | 'opcoes'>) =>
  (p.tipo === 'ESCOLHA_UNICA' || p.tipo === 'MULTIPLA_ESCOLHA') && (p.opcoes ?? []).some((o) => !!o.imagemId);

/**
 * Como ler a resposta de uma pergunta. Sem resposta (ou com valor que a versão não reconhece, como uma opção que não existe)
 * é `vazia` ("Não respondeu"); `false` e `0` são respostas. A data automática vem da atualização, não da resposta.
 */
export function respostaLida(p: PerguntaAtualizacao, valor: RespostaAtualizacao | undefined, dataAtualizacao?: string | null): RespostaLida {
  if (!TIPOS_DE_PERGUNTA.includes(p.tipo)) return { forma: 'desconhecida' };
  const tipo = p.tipo;
  // Data automática, informativo e fotos não leem o valor aqui; as outras, sem resposta, são "Não respondeu".
  if (!semResposta(tipo) && tipo !== 'FOTOS' && !respondidaNaPergunta(p, valor)) return { forma: 'vazia' };
  switch (tipo) {
    case 'INFORMATIVO': return { forma: 'informativo' };
    case 'FOTOS': return { forma: 'fotos' };
    case 'DATA_AUTOMATICA': return { forma: 'texto', texto: dataParaTela(dataAtualizacao ?? null) || SEM_DADO, numerico: true };
    case 'NOTA': {
      if (typeof valor !== 'number') return { forma: 'vazia' };
      const { min, max } = escalaDaNota(p);
      return { forma: 'nota', nota: `${numeroParaTela(valor, 0)}/${max}`, escala: min === 0 && max === 10 ? null : `Escala de ${min} a ${max}`, texto: textoDaNota(p, valor) };
    }
    case 'SIM_NAO': return typeof valor === 'boolean' ? { forma: 'simNao', texto: valor ? 'Sim' : 'Não' } : { forma: 'vazia' };
    case 'NOTAS_POR_DIA': {
      if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return { forma: 'vazia' };
      const dias = (p.dias ?? []).map((d) => {
        const nota = valor[String(d)];
        return { dia: d, nota: typeof nota === 'number' ? numeroParaTela(nota, 0) : SEM_DADO };
      });
      return { forma: 'notasPorDia', dias, texto: `${dias.map((d) => `Dia ${d.dia}: ${d.nota}`).join(', ')} (notas de 0 a 10)` };
    }
    case 'GRADE': {
      const linhas = respostasDaGrade(p, valor);
      return { forma: 'grade', linhas, texto: linhas.map((l) => `${l.linha}: ${l.resposta}`).join('; ') };
    }
    case 'ESCOLHA_UNICA':
    case 'MULTIPLA_ESCOLHA': {
      const texto = textoDaResposta(p, valor);
      if (texto === SEM_DADO) return { forma: 'vazia' };
      return temImagemNasOpcoes(p) ? { forma: 'opcoesComImagem', texto } : { forma: 'texto', texto };
    }
    case 'PESO':
    case 'NUMERO':
    case 'DATA':
    case 'TELEFONE':
    case 'TEXTO':
    case 'TEXTO_LONGO':
    case 'EMAIL':
    case 'ACEITE':
    case 'ITENS_DO_PLANO':
    case 'ENDERECO': {
      const texto = textoDaResposta(p, valor);
      if (texto === SEM_DADO) return { forma: 'vazia' };
      return { forma: 'texto', texto, numerico: tipo === 'PESO' || tipo === 'NUMERO' || tipo === 'DATA' || tipo === 'TELEFONE' };
    }
    default: {
      const semCaso: never = tipo;
      return semCaso;
    }
  }
}

/** Cartão a partir do qual pergunta e resposta ficam lado a lado (orientações de 26/11, 2.1). */
export const CARTAO_LARGO_DA_LEITURA = 760;
/** Coluna da pergunta no cartão largo: 40% da largura útil, até 320. */
export const ROTULO_MAXIMO_DA_LEITURA = 320;
/** Respiro de cada linha até o fio. */
export const RESPIRO_DA_LEITURA = 12;

/**
 * Arranjo da `ui/ListaDeDados` na leitura: a lista mede a largura útil do cartão (o cartão menos o recuo dos dois lados),
 * então o limite de 760 de cartão vira 760 menos os recuos; a pergunta fica em 40% da lista, até 320; 12 até o fio.
 */
export function arranjoDaLeitura(recuo: number): AjusteDoArranjo & { respiro: number } {
  return {
    empilharAbaixoDe: CARTAO_LARGO_DA_LEITURA - 2 * recuo,
    rotulo: { fracao: 0.4, maximo: ROTULO_MAXIMO_DA_LEITURA },
    respiro: RESPIRO_DA_LEITURA,
  };
}

/** Notas por dia em chips que quebram linha até 6 dias; com 7 ou mais, uma tabelinha de uma linha que rola na horizontal. */
export const notasPorDiaEmTabela = (dias: number) => dias >= 7;

/** Perguntas da seção na leitura ("6 perguntas"): data automática e texto informativo não contam. */
export function textoDasPerguntas(perguntas: readonly Pick<PerguntaAtualizacao, 'tipo'>[]): string {
  const n = perguntas.filter((p) => !semResposta(p.tipo)).length;
  return `${n} ${n === 1 ? 'pergunta' : 'perguntas'}`;
}

/** "0 dias", "1,5 dia", "2 dias": o número que aparece (uma casa) decide o plural; singular só de 1 até antes de 2. */
export function diasNaSemana(media: number): string {
  const mostrado = Math.round(media * 10) / 10;
  return `${numeroParaTela(media, 1)} ${mostrado >= 1 && mostrado < 2 ? 'dia' : 'dias'}`;
}

/** Ajuda automática da média de treinos do app: na resposta fala com o aluno; na leitura serve aos dois. */
export function fraseDaMediaDeTreino(media: number, leitura: boolean): string {
  return leitura
    ? `Pelo app: média de ${diasNaSemana(media)} de treino por semana no período.`
    : `Pelo app, você treinou em média ${diasNaSemana(media)} por semana neste período.`;
}

const cortar = (texto: string) => (texto.length > ROTULO_MAXIMO ? `${texto.slice(0, ROTULO_MAXIMO - 1)}…` : texto);

export interface ResumoDoTreinador {
  /** Nulo quando o questionário não tem pergunta PESO; com a pergunta e sem resposta, `valor` é nulo (mostra "—"). */
  peso: { valor: number | null; variacao: number | null } | null;
  /** `nota`: só nas NOTA respondidas; o cartão mostra `valor` grande e `escala` pequena (a frase inteira não cabe no bloco). */
  destaques: { id: string; rotulo: string; texto: string; nota?: { valor: string; escala: string } }[];
  diasComTreino: number | null;
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
      ...(p.tipo === 'NOTA' && typeof respostasDe[p.id] === 'number' ? { nota: notaEmDuasPartes(p, respostasDe[p.id] as number) } : {}),
    })),
    diasComTreino: resumo?.diasComTreino ?? null,
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
export function progressoDasSecoes(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao, fotosLigadas = false, itens: ItensDisponiveis = {}) {
  // `erros` também guarda a resposta fora do formato (data de nascimento inválida): ela não conta como respondida (N16).
  const { erros, escondidas, secoesEscondidas } = avaliarRespostas(modelo, respostas, fotosLigadas, {}, undefined, itens);
  return modelo.secoes.map((secao, i) => {
    if (secoesEscondidas.has(i)) return null;
    const contam = secao.perguntas.filter((p) => !semResposta(p.tipo) && !escondidas.has(p.id) && (p.tipo !== 'FOTOS' || fotosLigadas));
    return { respondidas: contam.filter((p) => respondidaNaPergunta(p, respostas[p.id]) && gradeCompleta(p, respostas[p.id]) && !erros[p.id]).length, total: contam.length };
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

/** N27: a nota nunca vai sem a escala. "7/10" quando ela começa em 1; "7 de 0 a 10" quando começa em 0 (o zero não se confunde com falta de resposta). */
export function textoDaNota(p: Pick<PerguntaAtualizacao, 'min' | 'max'>, valor: RespostaAtualizacao | undefined): string {
  if (typeof valor !== 'number') return SEM_DADO;
  const { min, max } = escalaDaNota(p);
  const nota = numeroParaTela(valor, 0);
  return min === 0 ? `${nota} de 0 a ${max}` : `${nota}/${max}`;
}

/** A nota separada da escala ("0" e "de 0 a 10"), para blocos estreitos; `textoDaNota` segue sendo o texto inteiro. */
export function notaEmDuasPartes(p: Pick<PerguntaAtualizacao, 'min' | 'max'>, valor: number) {
  const { min, max } = escalaDaNota(p);
  return { valor: numeroParaTela(valor, 0), escala: `de ${min} a ${max}` };
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
