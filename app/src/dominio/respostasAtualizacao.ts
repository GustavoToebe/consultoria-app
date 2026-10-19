import type { CondicaoPergunta, ConteudoQuestionario, PerguntaAtualizacao, RespostaAtualizacao, RespostasAtualizacao } from '../api/tipos';
import { hojeIso } from './formatos';
import { LIMITES_QUESTIONARIO } from './questionario';

const nota = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;

function numeroValido(p: PerguntaAtualizacao, v: unknown) {
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > LIMITES_QUESTIONARIO.numeroAbsoluto) return false;
  const casas = typeof p.casas === 'number' ? p.casas : 0;
  if (Number(v.toFixed(casas)) !== v) return false;
  if (typeof p.min === 'number' && v < p.min) return false;
  return !(typeof p.max === 'number' && v > p.max);
}

function multiplaValida(p: PerguntaAtualizacao, v: unknown) {
  if (!Array.isArray(v)) return false;
  const ids = new Set((p.opcoes ?? []).map((o) => o.id));
  const vistos = new Set<unknown>();
  return v.every((item) => typeof item === 'string' && ids.has(item) && !vistos.has(item) && !!vistos.add(item));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const TELEFONE = /^[0-9()+\-. ]+$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lista de ids (UUID) de fotos já enviadas, sem repetir, até o limite da pergunta. */
function fotosValidas(v: unknown) {
  if (!Array.isArray(v) || v.length > LIMITES_QUESTIONARIO.fotosPorPergunta) return false;
  const vistos = new Set<string>();
  return v.every((id) => typeof id === 'string' && UUID.test(id) && !vistos.has(id.toLowerCase()) && !!vistos.add(id.toLowerCase()));
}

/** AAAA-MM-DD de verdade (sem 30/02), entre 1900 e 2100; com `somentePassado`, até `hoje`. */
function dataValida(p: PerguntaAtualizacao, v: unknown, hoje: string) {
  if (typeof v !== 'string') return false;
  const m = DATA.exec(v);
  if (!m) return false;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return false;
  if (a < LIMITES_QUESTIONARIO.dataAnoMinimo || a > LIMITES_QUESTIONARIO.dataAnoMaximo) return false;
  return !(p.somentePassado === true && v > hoje);
}

/** Só dígitos, espaço, parênteses, +, - e ponto; de 10 a 13 dígitos (DDD + número, com ou sem o 55). */
function telefoneValido(v: unknown) {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  if (t.length > LIMITES_QUESTIONARIO.telefoneTamanho || !TELEFONE.test(t)) return false;
  const digitos = t.replace(/\D/g, '').length;
  return digitos >= LIMITES_QUESTIONARIO.telefoneDigitosMinimo && digitos <= LIMITES_QUESTIONARIO.telefoneDigitosMaximo;
}

const emailValido = (v: unknown) => typeof v === 'string' && v.trim().length <= LIMITES_QUESTIONARIO.emailTamanho && EMAIL.test(v.trim());

/** Objeto linha → coluna, só com linhas e colunas da pergunta (a obrigatória, com todas as linhas, é conferida à parte). */
function gradeValida(p: PerguntaAtualizacao, v: unknown) {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const linhas = new Set((p.linhas ?? []).map((l) => l.id));
  const colunas = new Set((p.colunas ?? []).map((c) => c.id));
  return Object.entries(v).every(([linha, coluna]) => linhas.has(linha) && typeof coluna === 'string' && colunas.has(coluna));
}

/** Tamanho máximo da resposta de texto: o do objetivo do cadastro quando a resposta vai para lá (anamnese). */
export function tamanhoDoTexto(p: Pick<PerguntaAtualizacao, 'tipo' | 'destino'>) {
  if (p.destino === 'OBJETIVO') return LIMITES_QUESTIONARIO.objetivoTamanho;
  return p.tipo === 'TEXTO' ? LIMITES_QUESTIONARIO.textoCurtoCapacidade : LIMITES_QUESTIONARIO.textoLongoCapacidade;
}

/** Uma resposta (já presente) respeita o tipo e os limites da pergunta. Mesmas regras do `ValidadorAtualizacao`. */
export function respostaValida(p: PerguntaAtualizacao, v: unknown, hoje: string = hojeIso()) {
  switch (p.tipo) {
    case 'NOTA': return nota(v);
    case 'PESO': return typeof v === 'number' && Number.isFinite(v) && v >= 20 && v <= 400 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-8;
    case 'TEXTO': return typeof v === 'string' && v.length <= tamanhoDoTexto(p);
    case 'TEXTO_LONGO': return typeof v === 'string' && v.length <= tamanhoDoTexto(p);
    case 'NOTAS_POR_DIA':
      return typeof v === 'object' && v !== null && !Array.isArray(v)
        && Object.entries(v).every(([d, n]) => (p.dias ?? []).some((dia) => String(dia) === d) && (n == null || nota(n)));
    case 'ESCOLHA_UNICA': return typeof v === 'string' && (p.opcoes ?? []).some((o) => o.id === v);
    case 'MULTIPLA_ESCOLHA': return multiplaValida(p, v);
    case 'NUMERO': return numeroValido(p, v);
    case 'SIM_NAO': return typeof v === 'boolean';
    case 'FOTOS': return fotosValidas(v);
    case 'DATA': return dataValida(p, v, hoje);
    case 'TELEFONE': return telefoneValido(v);
    case 'EMAIL': return emailValido(v);
    case 'GRADE': return gradeValida(p, v);
    case 'ACEITE': return v === true;
    default: return false;
  }
}

/** `false` e `0` são respostas; só ausência, texto em branco, lista vazia e objeto vazio (notas por dia, grade) contam como "não respondido". */
export const respondida = (v: unknown) =>
  !(v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));

/**
 * Sem condição, visível. Com ela, a resposta (já aceita e visível) da pergunta de controle precisa ser um dos valores:
 * id da opção (escolha única), algum id marcado (múltipla) ou `sim`/`nao`. Sem resposta = escondida.
 */
export function condicaoAtendida(condicao: CondicaoPergunta | undefined, aceitas: ReadonlyMap<string, RespostaAtualizacao>) {
  if (!condicao) return true;
  const r = aceitas.get(condicao.perguntaId);
  if (r === undefined) return false;
  const valores = new Set(condicao.valores ?? []);
  if (typeof r === 'boolean') return valores.has(r ? 'sim' : 'nao');
  if (typeof r === 'string') return valores.has(r);
  if (Array.isArray(r)) return r.some((item) => valores.has(item));
  return false;
}

/** Tipos que o aluno não responde (ou, com as fotos desligadas, não consegue responder). */
const ignorada = (p: PerguntaAtualizacao, fotosLigadas: boolean) =>
  p.tipo === 'DATA_AUTOMATICA' || p.tipo === 'INFORMATIVO' || (p.tipo === 'FOTOS' && !fotosLigadas);

export interface Avaliacao {
  erros: Record<string, string>;
  /** Respostas que seriam enviadas: só as válidas de perguntas visíveis (as escondidas são descartadas). */
  aceitas: RespostasAtualizacao;
  /** Ids das perguntas escondidas por condição (da pergunta ou da seção). */
  escondidas: Set<string>;
  /** Índices das seções escondidas por condição. */
  secoesEscondidas: Set<number>;
}

/**
 * Passa pelo questionário na ordem, como o `ValidadorAtualizacao` do Java: decide o que está visível (pela resposta
 * aceita das perguntas de controle), o que falta e o que seria enviado. Fotos ainda no aparelho (celular) contam como
 * respondidas e no limite da pergunta.
 */
export function avaliarRespostas(
  modelo: ConteudoQuestionario,
  respostas: RespostasAtualizacao,
  fotosLigadas = false,
  fotosNoAparelho: Readonly<Record<string, number>> = {},
  hoje: string = hojeIso(),
): Avaliacao {
  const erros: Record<string, string> = {};
  const aceitasMapa = new Map<string, RespostaAtualizacao>();
  const escondidas = new Set<string>();
  const secoesEscondidas = new Set<number>();
  modelo.secoes.forEach((secao, si) => {
    const secaoVisivel = condicaoAtendida(secao.mostrarSe, aceitasMapa);
    if (!secaoVisivel) secoesEscondidas.add(si);
    for (const p of secao.perguntas) {
      if (!secaoVisivel || !condicaoAtendida(p.mostrarSe, aceitasMapa)) { escondidas.add(p.id); continue; }
      if (ignorada(p, fotosLigadas)) continue;
      const v = respostas[p.id];
      const noAparelho = p.tipo === 'FOTOS' ? (fotosNoAparelho[p.id] ?? 0) : 0;
      if (noAparelho > 0) {
        const enviadas = Array.isArray(v) ? v.length : 0;
        if (respondida(v) && !respostaValida(p, v, hoje)) erros[p.id] = 'Confira o formato e os limites deste campo.';
        else if (enviadas + noAparelho > LIMITES_QUESTIONARIO.fotosPorPergunta) erros[p.id] = 'Há fotos demais nesta pergunta.';
        else if (respondida(v)) aceitasMapa.set(p.id, v as RespostaAtualizacao);
        continue;
      }
      if (!respondida(v)) {
        if (p.obrigatoria) erros[p.id] = 'Preencha este campo.';
        continue;
      }
      if (p.tipo === 'GRADE' && p.obrigatoria && gradeValida(p, v) && Object.keys(v as object).length < (p.linhas ?? []).length) {
        erros[p.id] = 'Responda todas as linhas.';
        continue;
      }
      if (!respostaValida(p, v, hoje)) { erros[p.id] = 'Confira o formato e os limites deste campo.'; continue; }
      aceitasMapa.set(p.id, v);
    }
  });
  return { erros, aceitas: Object.fromEntries(aceitasMapa), escondidas, secoesEscondidas };
}

function excedeBytes(respostas: RespostasAtualizacao) {
  const bytes = Array.from(JSON.stringify(respostas)).reduce((total, c) => {
    const codigo = c.codePointAt(0) ?? 0;
    return total + (codigo < 128 ? 1 : codigo < 2048 ? 2 : codigo < 65536 ? 3 : 4);
  }, 0);
  return bytes > LIMITES_QUESTIONARIO.respostasBytes;
}

/**
 * Validação para marcar o campo; o servidor sempre valida novamente contra sua versão. Mesmas regras do
 * `ValidadorAtualizacao` do Java (o teste de paridade confere os campos com erro). Lista vazia, texto em branco e
 * objeto vazio contam como "não respondido"; pergunta escondida por condição não é obrigatória. Com as fotos desligadas
 * (padrão do servidor) a pergunta FOTOS é ignorada; ligadas, a resposta é a lista de ids das fotos já enviadas.
 */
export function errosRespostasAtualizacao(
  modelo: ConteudoQuestionario,
  respostas: RespostasAtualizacao,
  fotosLigadas = false,
  /** Fotos ainda no aparelho (celular), por pergunta: vão subir no envio, então já contam como respondidas e no limite. */
  fotosNoAparelho: Readonly<Record<string, number>> = {},
  hoje: string = hojeIso(),
) {
  const { erros } = avaliarRespostas(modelo, respostas, fotosLigadas, fotosNoAparelho, hoje);
  if (excedeBytes(respostas)) return { respostas: 'As respostas ultrapassam o limite de 256 KiB.', ...erros };
  return erros;
}

/**
 * O que vai no envio: as respostas que o aluno vê, sem as das perguntas escondidas por condição (que nunca viram "não").
 * Fotos e respostas ainda não válidas seguem como estão: o servidor confere e aponta o campo.
 */
export function respostasParaEnviar(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao, fotosLigadas = false): RespostasAtualizacao {
  const { escondidas } = avaliarRespostas(modelo, respostas, fotosLigadas);
  return Object.fromEntries(Object.entries(respostas).filter(([id]) => !escondidas.has(id)));
}
