import type { ConteudoQuestionario, PerguntaAtualizacao, RespostasAtualizacao } from '../api/tipos';
import { LIMITES_QUESTIONARIO } from './questionario';

const nota = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10;

function numeroValido(p: PerguntaAtualizacao, v: unknown) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
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

/** Uma resposta (já presente) respeita o tipo e os limites da pergunta. Mesmas regras do `ValidadorAtualizacao`. */
export function respostaValida(p: PerguntaAtualizacao, v: unknown) {
  switch (p.tipo) {
    case 'NOTA': return nota(v);
    case 'PESO': return typeof v === 'number' && Number.isFinite(v) && v >= 20 && v <= 400 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-8;
    case 'TEXTO': return typeof v === 'string' && v.length <= LIMITES_QUESTIONARIO.textoCurtoCapacidade;
    case 'TEXTO_LONGO': return typeof v === 'string' && v.length <= LIMITES_QUESTIONARIO.textoLongoCapacidade;
    case 'NOTAS_POR_DIA':
      return typeof v === 'object' && v !== null && !Array.isArray(v)
        && Object.entries(v).every(([d, n]) => (p.dias ?? []).some((dia) => String(dia) === d) && (n == null || nota(n)));
    case 'ESCOLHA_UNICA': return typeof v === 'string' && (p.opcoes ?? []).some((o) => o.id === v);
    case 'MULTIPLA_ESCOLHA': return multiplaValida(p, v);
    case 'NUMERO': return numeroValido(p, v);
    case 'SIM_NAO': return typeof v === 'boolean';
    default: return false;
  }
}

/** `false` e `0` são respostas; só ausência, texto em branco e lista vazia contam como "não respondido". */
export const respondida = (v: unknown) => !(v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0));

/**
 * Validação para marcar o campo; o servidor sempre valida novamente contra sua versão. Mesmas regras do
 * `ValidadorAtualizacao` do Java (o teste de paridade confere os campos com erro). Lista vazia e texto em branco
 * contam como "não respondido".
 */
export function errosRespostasAtualizacao(modelo: ConteudoQuestionario, respostas: RespostasAtualizacao) {
  const erros: Record<string, string> = {};
  const bytes = Array.from(JSON.stringify(respostas)).reduce((total, c) => {
    const codigo = c.codePointAt(0) ?? 0;
    return total + (codigo < 128 ? 1 : codigo < 2048 ? 2 : codigo < 65536 ? 3 : 4);
  }, 0);
  if (bytes > LIMITES_QUESTIONARIO.respostasBytes) erros.respostas = 'As respostas ultrapassam o limite de 256 KiB.';
  for (const p of modelo.secoes.flatMap((s) => s.perguntas)) {
    if (p.tipo === 'FOTOS' || p.tipo === 'DATA_AUTOMATICA') continue;
    const v = respostas[p.id];
    if (!respondida(v)) {
      if (p.obrigatoria) erros[p.id] = 'Preencha este campo.';
      continue;
    }
    if (!respostaValida(p, v)) erros[p.id] = 'Confira o formato e os limites deste campo.';
  }
  return erros;
}
