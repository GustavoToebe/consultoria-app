import type { ConteudoQuestionario, PerguntaAtualizacao, TipoPergunta } from '../api/tipos';
import {
  adicionarPergunta, adicionarSecao, agruparProblemas, alterarPergunta, descricaoDoLocal, duplicarPergunta, duplicarPerguntaNaSecao, localDoProblema,
  moverParaSecao, moverPergunta, moverSecao, normalizarQuestionario, novaOpcao, novaPergunta, novaSecao, paraApi, podeAdicionar,
  podeAdicionarSecao, podeDestacar, podeDuplicar, previaDeAtualizacao, removerPergunta, removerSecao, TIPOS_PARA_ADICIONAR,
} from './editorQuestionario';
import { errosDoQuestionario, LIMITES_QUESTIONARIO, validarQuestionario } from './questionario';

let mockContador = 0;
jest.mock('./uid', () => ({ novoUid: () => `uid-${++mockContador}` }));

const TODOS: TipoPergunta[] = ['DATA_AUTOMATICA', 'PESO', 'NOTA', 'TEXTO', 'TEXTO_LONGO', 'NOTAS_POR_DIA', 'FOTOS', 'ESCOLHA_UNICA', 'MULTIPLA_ESCOLHA', 'NUMERO', 'SIM_NAO'];
const p = (id: string, tipo: TipoPergunta = 'TEXTO', extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao => ({ id, tipo, rotulo: `Pergunta ${id}`, obrigatoria: false, ...extra });
const base = (): ConteudoQuestionario => ({
  formato: 2, instrucoes: [],
  secoes: [{ uid: 's1', titulo: 'A', perguntas: [p('a'), p('b'), p('c')] }, { uid: 's2', titulo: 'B', perguntas: [p('d')] }],
});

describe('fábricas', () => {
  it('cada tipo da lista de adicionar nasce válido depois de preencher o texto e as opções', () => {
    for (const { tipo } of TIPOS_PARA_ADICIONAR) {
      const nova = novaPergunta(tipo);
      const preenchida = { ...nova, rotulo: 'Texto', opcoes: nova.opcoes?.map((o, k) => ({ ...o, rotulo: `Opção ${k}` })) };
      const c: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 'x', titulo: 'Seção', perguntas: [preenchida] }] };
      expect(errosDoQuestionario(paraApi(c))).toEqual([]);
    }
  });
  it('o menu cobre todos os tipos, inclusive FOTOS', () => {
    const oferecidos = TIPOS_PARA_ADICIONAR.map((t) => t.tipo);
    expect([...oferecidos].sort()).toEqual([...TODOS].sort());
  });
  it('escolhas nascem com duas opções vazias, número sem casas e notas por dia com sete dias', () => {
    expect(novaPergunta('ESCOLHA_UNICA').opcoes).toHaveLength(2);
    expect(novaPergunta('NUMERO').casas).toBe(0);
    expect(novaPergunta('NOTAS_POR_DIA').dias).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(novaPergunta('NOTA').opcoes).toBeUndefined();
  });
  it('duplicar gera ids novos na pergunta e nas opções, com o mesmo texto', () => {
    const original = p('o', 'ESCOLHA_UNICA', { opcoes: [novaOpcao('Sim'), novaOpcao('Não')] });
    const copia = duplicarPergunta(original);
    expect(copia.id).not.toBe(original.id);
    expect(copia.rotulo).toBe(original.rotulo);
    expect(copia.opcoes?.map((o) => o.rotulo)).toEqual(['Sim', 'Não']);
    expect(copia.opcoes?.every((o, k) => o.id !== original.opcoes?.[k].id)).toBe(true);
  });
  it('seção nova nasce vazia, com uid', () => {
    expect(novaSecao()).toMatchObject({ perguntas: [] });
    expect(novaSecao().uid).toMatch(/^uid-/);
  });
});

describe('normalizar e paraApi', () => {
  it('completa formato, listas, uid da seção e obrigatoria', () => {
    const n = normalizarQuestionario({ secoes: [{ titulo: 'X', perguntas: [{ id: 'a', tipo: 'NOTA', rotulo: 'R' } as PerguntaAtualizacao] }] });
    expect(n.formato).toBe(2);
    expect(n.instrucoes).toEqual([]);
    expect(n.secoes[0].uid).toMatch(/^uid-/);
    expect(n.secoes[0].perguntas[0].obrigatoria).toBe(false);
    expect(normalizarQuestionario(null).secoes).toEqual([]);
  });
  it('tira o que não é do tipo, textos vazios e destaque onde não vale, sem mexer nos ids', () => {
    const sujo: ConteudoQuestionario = { instrucoes: ['x'], secoes: [{ uid: 's', titulo: 'T', perguntas: [
      p('t', 'TEXTO', { opcoes: [novaOpcao('a')], dias: [1], unidade: 'kg', min: 1, max: 2, casas: 1, destaque: true, rotuloCurto: 'x', ajuda: '  ', obrigatoria: true }),
      p('d', 'DATA_AUTOMATICA', { obrigatoria: true }),
      p('n', 'NUMERO', { unidade: ' ', min: 0, max: 5, casas: 1, destaque: true, rotuloCurto: '', ajudaAutomatica: 'MEDIA_DIAS_TREINO' }),
    ] }] };
    const [t, d, n] = paraApi(sujo).secoes[0].perguntas;
    expect(t).toMatchObject({ id: 't', obrigatoria: true, opcoes: undefined, dias: undefined, unidade: undefined, min: undefined, casas: undefined, destaque: undefined, rotuloCurto: undefined, ajuda: undefined });
    expect(d.obrigatoria).toBe(false);
    expect(n).toMatchObject({ id: 'n', unidade: undefined, min: 0, max: 5, casas: 1, destaque: true, rotuloCurto: undefined, ajudaAutomatica: 'MEDIA_DIAS_TREINO' });
  });
});

describe('limites avisados antes de publicar', () => {
  it('PESO e Data só uma vez', () => {
    const c = adicionarPergunta(base(), 0, p('peso', 'PESO'));
    expect(podeAdicionar(c, 0, 'PESO')).toEqual({ pode: false, motivo: 'Já existe uma pergunta de peso.' });
    expect(podeAdicionar(c, 0, 'DATA_AUTOMATICA').pode).toBe(true);
    expect(podeDuplicar(c, 0, 3).pode).toBe(false);
    expect(podeDuplicar(c, 0, 0).pode).toBe(true);
  });
  it('40 por seção, 80 no total e 15 seções', () => {
    const cheia: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 's', titulo: 'x', perguntas: Array.from({ length: LIMITES_QUESTIONARIO.perguntasPorSecao }, (_, i) => p(`q${i}`)) }] };
    expect(podeAdicionar(cheia, 0, 'TEXTO').pode).toBe(false);
    const duas: ConteudoQuestionario = { instrucoes: [], secoes: [0, 1, 2].map((s) => ({ uid: `s${s}`, titulo: 'x', perguntas: Array.from({ length: 30 }, (_, i) => p(`${s}-${i}`)) })) };
    expect(podeAdicionar(duas, 0, 'TEXTO').pode).toBe(false);
    expect(podeAdicionar({ ...duas, secoes: duas.secoes.slice(0, 2) }, 0, 'TEXTO').pode).toBe(true);
    const muitas: ConteudoQuestionario = { instrucoes: [], secoes: Array.from({ length: LIMITES_QUESTIONARIO.secoes }, (_, i) => novaSecao(`S${i}`)) };
    expect(podeAdicionarSecao(muitas).pode).toBe(false);
    expect(podeAdicionarSecao(base()).pode).toBe(true);
  });
  it('destaque: só nos tipos que aceitam e até quatro', () => {
    let c: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 's', titulo: 'x', perguntas: [
      ...['1', '2', '3', '4'].map((id) => p(id, 'NOTA', { destaque: true })), p('5', 'NOTA'), p('t', 'TEXTO')] }] };
    expect(podeDestacar(c, '5').pode).toBe(false);
    expect(podeDestacar(c, '1').pode).toBe(true);
    expect(podeDestacar(c, 't').pode).toBe(false);
    c = alterarPergunta(c, 0, 0, { destaque: false });
    expect(podeDestacar(c, '5').pode).toBe(true);
  });
});

describe('operações no conteúdo', () => {
  const ids = (c: ConteudoQuestionario, s: number) => c.secoes[s].perguntas.map((x) => x.id);
  it('mover, remover e duplicar dentro da seção', () => {
    expect(ids(moverPergunta(base(), 0, 0, 1), 0)).toEqual(['b', 'a', 'c']);
    expect(ids(moverPergunta(base(), 0, 0, -1), 0)).toEqual(['a', 'b', 'c']);
    expect(ids(removerPergunta(base(), 0, 1), 0)).toEqual(['a', 'c']);
    const dup = duplicarPerguntaNaSecao(base(), 0, 0);
    expect(ids(dup, 0)).toHaveLength(4);
    expect(ids(dup, 0)[0]).toBe('a');
    expect(ids(dup, 0)[1]).not.toBe('a');
  });
  it('mover para outra seção vai para o fim e não faz nada na mesma seção ou em seção inexistente', () => {
    const c = moverParaSecao(base(), { secao: 0, pergunta: 1 }, 1);
    expect(ids(c, 0)).toEqual(['a', 'c']);
    expect(ids(c, 1)).toEqual(['d', 'b']);
    expect(moverParaSecao(base(), { secao: 0, pergunta: 1 }, 0)).toEqual(base());
    expect(moverParaSecao(base(), { secao: 0, pergunta: 1 }, 5)).toEqual(base());
  });
  it('seções: adicionar, mover e remover', () => {
    expect(adicionarSecao(base()).secoes).toHaveLength(3);
    expect(moverSecao(base(), 0, 1).secoes.map((s) => s.uid)).toEqual(['s2', 's1']);
    expect(removerSecao(base(), 0).secoes.map((s) => s.uid)).toEqual(['s2']);
  });
});

describe('problemas da publicação', () => {
  it('lê seção e pergunta do caminho', () => {
    expect(localDoProblema('secoes[2].perguntas[1].opcoes[0].rotulo')).toEqual({ secao: 2, pergunta: 1 });
    expect(localDoProblema('secoes[0].titulo')).toEqual({ secao: 0, pergunta: undefined });
    expect(localDoProblema('instrucoes[3]')).toEqual({ secao: undefined, pergunta: undefined });
  });
  it('agrupa por pergunta, por seção e gerais, a partir do validador', () => {
    const c: ConteudoQuestionario = { instrucoes: [' '], secoes: [
      { uid: 's1', titulo: '', perguntas: [p('a', 'ESCOLHA_UNICA', { rotulo: '' , opcoes: [novaOpcao('x')] })] },
      { uid: 's2', titulo: 'Vazia', perguntas: [] },
    ] };
    const g = agruparProblemas(c, validarQuestionario(c).erros);
    expect(g.porPergunta.get('a')?.length).toBe(2);
    expect(g.porSecao.get(0)).toEqual(['Seção sem título.']);
    expect(g.porSecao.get(1)).toEqual(['Seção sem pergunta.']);
    expect(g.gerais.map((x) => x.caminho)).toEqual(['instrucoes[0]']);
  });
});

describe('descrição do local', () => {
  it('diz seção e pergunta, ou só as instruções, ou nada', () => {
    const c = base();
    expect(descricaoDoLocal(c, 'secoes[0].perguntas[1].rotulo')).toBe('Seção 1 “A” › Pergunta b');
    expect(descricaoDoLocal(c, 'secoes[1].titulo')).toBe('Seção 2 “B”');
    expect(descricaoDoLocal(c, 'instrucoes[0]')).toBe('Instruções');
    expect(descricaoDoLocal(c, 'secoes')).toBe('');
    expect(descricaoDoLocal(c, 'secoes[9].titulo')).toBe('');
  });
});

describe('prévia', () => {
  it('não inventa número: sem resumo, sem respostas e com o conteúdo como modelo', () => {
    const c = base();
    const a = previaDeAtualizacao(c);
    expect(a.resumo).toBeNull();
    expect(a.respostas).toBeNull();
    expect(a.modelo).toBe(c);
    expect(a.modelo?.secoes).toHaveLength(2);
    expect(a.dataAtualizacao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
