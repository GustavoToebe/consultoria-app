import type { Atualizacao, ConteudoQuestionario, OpcaoPergunta, PerguntaAtualizacao, SecaoAtualizacao, TipoPergunta } from '../api/tipos';
import { mover, remover, substituir } from './editorTreino';
import { hojeIso } from './formatos';
import { LIMITES_QUESTIONARIO as L, temOpcoes, type ProblemaDoQuestionario } from './questionario';
import { novoUid } from './uid';

/**
 * Operações puras do editor de questionários. As regras de publicação ficam em `questionario.ts` (espelho do
 * `ValidadorQuestionario`); aqui só se monta o conteúdo e se impede, na tela, o que a publicação recusaria.
 */

export const ROTULO_DO_TIPO: Record<TipoPergunta, string> = {
  DATA_AUTOMATICA: 'Data da atualização',
  PESO: 'Peso',
  NOTA: 'Nota de 0 a 10',
  NOTAS_POR_DIA: 'Notas por dia',
  TEXTO: 'Texto curto',
  TEXTO_LONGO: 'Texto longo',
  ESCOLHA_UNICA: 'Escolha única',
  MULTIPLA_ESCOLHA: 'Múltipla escolha',
  NUMERO: 'Número',
  SIM_NAO: 'Sim ou não',
  FOTOS: 'Fotos',
};

/** Tipos do menu "Adicionar pergunta". FOTOS fica de fora (ainda não implementado); a que veio na v1 é preservada. */
export const TIPOS_PARA_ADICIONAR: readonly { tipo: TipoPergunta; descricao: string }[] = [
  { tipo: 'NOTA', descricao: 'O aluno escolhe uma nota de 0 a 10.' },
  { tipo: 'SIM_NAO', descricao: 'Resposta Sim ou Não.' },
  { tipo: 'ESCOLHA_UNICA', descricao: 'Uma opção entre as que você definir.' },
  { tipo: 'MULTIPLA_ESCOLHA', descricao: 'Uma ou mais opções entre as que você definir.' },
  { tipo: 'NUMERO', descricao: 'Um número, com unidade, faixa e casas decimais opcionais.' },
  { tipo: 'TEXTO', descricao: 'Resposta curta em texto.' },
  { tipo: 'TEXTO_LONGO', descricao: 'Resposta longa em texto.' },
  { tipo: 'NOTAS_POR_DIA', descricao: 'Uma nota para cada dia da semana de treino.' },
  { tipo: 'PESO', descricao: 'O peso vai para o registro de peso do aluno. Só uma por questionário.' },
  { tipo: 'DATA_AUTOMATICA', descricao: 'Mostra a data da atualização. Só uma por questionário.' },
];

const COM_DESTAQUE: readonly TipoPergunta[] = ['NOTA', 'NUMERO', 'SIM_NAO', 'ESCOLHA_UNICA'];
const COM_AJUDA_AUTOMATICA: readonly TipoPergunta[] = ['TEXTO', 'NUMERO'];
const SEM_OBRIGATORIA: readonly TipoPergunta[] = ['DATA_AUTOMATICA', 'FOTOS'];
const UNICOS: readonly TipoPergunta[] = ['PESO', 'DATA_AUTOMATICA', 'FOTOS'];

export const aceitaDestaque = (tipo: TipoPergunta) => COM_DESTAQUE.includes(tipo);
export const aceitaAjudaAutomatica = (tipo: TipoPergunta) => COM_AJUDA_AUTOMATICA.includes(tipo);
export const aceitaObrigatoria = (tipo: TipoPergunta) => !SEM_OBRIGATORIA.includes(tipo);

export const novaOpcao = (rotulo = ''): OpcaoPergunta => ({ id: novoUid(), rotulo });
export const novaSecao = (titulo = 'Nova seção'): SecaoAtualizacao => ({ uid: novoUid(), titulo, perguntas: [] });

export function novaPergunta(tipo: TipoPergunta): PerguntaAtualizacao {
  const base: PerguntaAtualizacao = { id: novoUid(), tipo, rotulo: '', obrigatoria: false };
  if (temOpcoes(tipo)) return { ...base, opcoes: [novaOpcao(), novaOpcao()] };
  if (tipo === 'NUMERO') return { ...base, casas: 0 };
  if (tipo === 'NOTAS_POR_DIA') return { ...base, dias: [1, 2, 3, 4, 5, 6, 7] };
  return base;
}

/** Cópia com identificador novo na pergunta e em cada opção, para não colidir com a original. */
export function duplicarPergunta(p: PerguntaAtualizacao): PerguntaAtualizacao {
  return { ...p, id: novoUid(), opcoes: p.opcoes?.map((o) => ({ ...o, id: novoUid() })), dias: p.dias ? [...p.dias] : undefined };
}

/** Completa o que o rascunho incompleto pode trazer: formato 2, listas, uid de seção e `obrigatoria` booleano. */
export function normalizarQuestionario(c: Partial<ConteudoQuestionario> | null | undefined): ConteudoQuestionario {
  return {
    formato: 2,
    instrucoes: [...(c?.instrucoes ?? [])],
    secoes: (c?.secoes ?? []).map((s) => ({
      uid: s.uid ?? novoUid(),
      titulo: s.titulo ?? '',
      perguntas: (s.perguntas ?? []).map((p) => ({ ...p, obrigatoria: p.obrigatoria === true })),
    })),
  };
}

/**
 * O que vai no PUT: tira o que não pertence ao tipo (opções fora de escolha, dias fora de NOTAS_POR_DIA…) e
 * textos opcionais vazios, para o JSON gravado nunca carregar lixo. Não mexe em ids.
 */
export function paraApi(c: ConteudoQuestionario): ConteudoQuestionario {
  const texto = (v: string | undefined) => (v != null && v.trim() !== '' ? v : undefined);
  return {
    formato: 2,
    instrucoes: c.instrucoes,
    secoes: c.secoes.map((s) => ({
      uid: s.uid,
      titulo: s.titulo,
      perguntas: s.perguntas.map((p): PerguntaAtualizacao => {
        const destacada = aceitaDestaque(p.tipo) && p.destaque === true;
        const numerico = p.tipo === 'NUMERO';
        return {
          id: p.id,
          tipo: p.tipo,
          rotulo: p.rotulo,
          obrigatoria: aceitaObrigatoria(p.tipo) && p.obrigatoria === true,
          ajuda: texto(p.ajuda),
          destaque: destacada ? true : undefined,
          rotuloCurto: destacada ? texto(p.rotuloCurto) : undefined,
          ajudaAutomatica: aceitaAjudaAutomatica(p.tipo) ? p.ajudaAutomatica : undefined,
          dias: p.tipo === 'NOTAS_POR_DIA' ? p.dias : undefined,
          opcoes: temOpcoes(p.tipo) ? p.opcoes : undefined,
          unidade: numerico ? texto(p.unidade) : undefined,
          min: numerico ? p.min : undefined,
          max: numerico ? p.max : undefined,
          casas: numerico ? p.casas : undefined,
        };
      }),
    })),
  };
}

export const totalDePerguntas = (c: ConteudoQuestionario) => c.secoes.reduce((n, s) => n + s.perguntas.length, 0);
const todas = (c: ConteudoQuestionario) => c.secoes.flatMap((s) => s.perguntas);

export interface Permissao { pode: boolean; motivo?: string }

/** O que a publicação recusaria, avisado antes: tipos únicos e limites de quantidade. */
export function podeAdicionar(c: ConteudoQuestionario, secao: number, tipo: TipoPergunta): Permissao {
  if (UNICOS.includes(tipo) && todas(c).some((p) => p.tipo === tipo)) {
    return { pode: false, motivo: tipo === 'PESO' ? 'Já existe uma pergunta de peso.' : 'Já existe uma pergunta deste tipo.' };
  }
  if ((c.secoes[secao]?.perguntas.length ?? 0) >= L.perguntasPorSecao) return { pode: false, motivo: `A seção já tem ${L.perguntasPorSecao} perguntas.` };
  if (totalDePerguntas(c) >= L.perguntasTotal) return { pode: false, motivo: `O questionário já tem ${L.perguntasTotal} perguntas.` };
  return { pode: true };
}

/** Duplicar cria uma cópia do mesmo tipo: tipo único não duplica. */
export function podeDuplicar(c: ConteudoQuestionario, secao: number, indice: number): Permissao {
  const p = c.secoes[secao]?.perguntas[indice];
  if (!p) return { pode: false };
  return podeAdicionar(c, secao, p.tipo);
}

export function podeAdicionarSecao(c: ConteudoQuestionario): Permissao {
  return c.secoes.length >= L.secoes ? { pode: false, motivo: `O questionário já tem ${L.secoes} seções.` } : { pode: true };
}

export function podeDestacar(c: ConteudoQuestionario, id: string): Permissao {
  const p = todas(c).find((x) => x.id === id);
  if (!p || !aceitaDestaque(p.tipo)) return { pode: false, motivo: 'Este tipo não vai para o resumo.' };
  if (p.destaque === true) return { pode: true };
  const usados = todas(c).filter((x) => x.destaque === true && aceitaDestaque(x.tipo)).length;
  return usados >= L.destaquesMaximo ? { pode: false, motivo: `O resumo aceita até ${L.destaquesMaximo} perguntas.` } : { pode: true };
}

function comPerguntas(c: ConteudoQuestionario, secao: number, fn: (perguntas: PerguntaAtualizacao[]) => PerguntaAtualizacao[]): ConteudoQuestionario {
  return { ...c, secoes: c.secoes.map((s, i) => (i === secao ? { ...s, perguntas: fn(s.perguntas) } : s)) };
}

export const adicionarPergunta = (c: ConteudoQuestionario, secao: number, p: PerguntaAtualizacao) => comPerguntas(c, secao, (ps) => [...ps, p]);
export const alterarPergunta = (c: ConteudoQuestionario, secao: number, indice: number, parcial: Partial<PerguntaAtualizacao>) =>
  comPerguntas(c, secao, (ps) => substituir(ps, indice, { ...ps[indice], ...parcial }));
export const removerPergunta = (c: ConteudoQuestionario, secao: number, indice: number) => comPerguntas(c, secao, (ps) => remover(ps, indice));
export const moverPergunta = (c: ConteudoQuestionario, secao: number, indice: number, delta: -1 | 1) => comPerguntas(c, secao, (ps) => mover(ps, indice, delta));
export const duplicarPerguntaNaSecao = (c: ConteudoQuestionario, secao: number, indice: number) =>
  comPerguntas(c, secao, (ps) => [...ps.slice(0, indice + 1), duplicarPergunta(ps[indice]), ...ps.slice(indice + 1)]);

/** Leva a pergunta para o fim de outra seção. Seção de destino cheia ou igual à de origem não muda nada. */
export function moverParaSecao(c: ConteudoQuestionario, de: { secao: number; pergunta: number }, para: number): ConteudoQuestionario {
  const p = c.secoes[de.secao]?.perguntas[de.pergunta];
  if (!p || para === de.secao || !c.secoes[para] || c.secoes[para].perguntas.length >= L.perguntasPorSecao) return c;
  return { ...c, secoes: c.secoes.map((s, i) => i === de.secao ? { ...s, perguntas: remover(s.perguntas, de.pergunta) }
    : i === para ? { ...s, perguntas: [...s.perguntas, p] } : s) };
}

export const adicionarSecao = (c: ConteudoQuestionario) => ({ ...c, secoes: [...c.secoes, novaSecao()] });
export const alterarSecao = (c: ConteudoQuestionario, secao: number, titulo: string) =>
  ({ ...c, secoes: c.secoes.map((s, i) => (i === secao ? { ...s, titulo } : s)) });
export const removerSecao = (c: ConteudoQuestionario, secao: number) => ({ ...c, secoes: remover(c.secoes, secao) });
export const moverSecao = (c: ConteudoQuestionario, secao: number, delta: -1 | 1) => ({ ...c, secoes: mover(c.secoes, secao, delta) });

/** Instruções do topo do formulário. */
export const alterarInstrucoes = (c: ConteudoQuestionario, instrucoes: string[]): ConteudoQuestionario => ({ ...c, instrucoes });

/** Lê `secoes[i].perguntas[j]…` do caminho de um problema; sem número, `undefined`. */
export function localDoProblema(caminho: string): { secao?: number; pergunta?: number } {
  const s = /^secoes\[(\d+)\]/.exec(caminho);
  const p = /\.perguntas\[(\d+)\]/.exec(caminho);
  return { secao: s ? Number(s[1]) : undefined, pergunta: p ? Number(p[1]) : undefined };
}

/** "Seção 2 › Como foi o sono?" para a lista de problemas; vazio quando o caminho não aponta para uma seção. */
export function descricaoDoLocal(c: ConteudoQuestionario, caminho: string): string {
  const { secao, pergunta } = localDoProblema(caminho);
  if (secao == null) return caminho.startsWith('instrucoes') ? 'Instruções' : '';
  const s = c.secoes[secao];
  if (!s) return '';
  const nomeDaSecao = `Seção ${secao + 1}${s.titulo.trim() ? ` “${s.titulo.trim()}”` : ''}`;
  if (pergunta == null) return nomeDaSecao;
  const p = s.perguntas[pergunta];
  return p ? `${nomeDaSecao} › ${p.rotulo.trim() || `Pergunta ${pergunta + 1}`}` : nomeDaSecao;
}

export interface ProblemasAgrupados {
  /** Por id da pergunta. */
  porPergunta: Map<string, string[]>;
  /** Por posição da seção (problemas da seção em si). */
  porSecao: Map<number, string[]>;
  /** Instruções e totais: sem seção nem pergunta. */
  gerais: ProblemaDoQuestionario[];
}

export function agruparProblemas(c: ConteudoQuestionario, problemas: readonly ProblemaDoQuestionario[]): ProblemasAgrupados {
  const r: ProblemasAgrupados = { porPergunta: new Map(), porSecao: new Map(), gerais: [] };
  const somar = <K,>(m: Map<K, string[]>, k: K, msg: string) => m.set(k, [...(m.get(k) ?? []), msg]);
  for (const pr of problemas) {
    const { secao, pergunta } = localDoProblema(pr.caminho);
    const alvo = secao != null && pergunta != null ? c.secoes[secao]?.perguntas[pergunta] : undefined;
    if (alvo) somar(r.porPergunta, alvo.id, pr.mensagem);
    else if (secao != null && c.secoes[secao]) somar(r.porSecao, secao, pr.mensagem);
    else r.gerais.push(pr);
  }
  return r;
}

/** Atualização fictícia só para a prévia do editor: data de hoje e nenhum número inventado (sem resumo). */
export function previaDeAtualizacao(conteudo: ConteudoQuestionario): Atualizacao {
  return {
    id: null, pastaId: null, alunoId: '', nomeAluno: null, dataAtualizacao: hojeIso(), fase: 'ABERTA',
    diasParaData: 0, diasDeAtraso: 0, atrasoAte: null, atrasoMotivo: null, questionarioVersaoNumero: 0,
    questionarioVersaoId: null, questionarioNome: null, modelo: conteudo, respostas: null,
    enviadaEm: null, feedback: null, versao: null, resumo: null,
  };
}
