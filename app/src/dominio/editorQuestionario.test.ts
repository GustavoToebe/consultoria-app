import type { ConteudoQuestionario, PerguntaAtualizacao, TipoPergunta } from '../api/tipos';
import {
  adicionarPergunta, adicionarSecao, agruparProblemas, alterarPergunta, descricaoDoLocal, duplicarPergunta, duplicarPerguntaNaSecao, localDoProblema,
  moverParaSecao, moverPergunta, moverSecao, normalizarQuestionario, novaOpcao, novaPergunta, novaSecao, paraApi, podeAdicionar,
  podeAdicionarSecao, podeDestacar, podeDuplicar, removerPergunta, removerSecao, TIPOS_PARA_ADICIONAR, tiposParaAdicionar,
  controlesAnteriores, posicaoDaPergunta, textoDaCondicao, alterarCondicaoDaSecao, datasDaPesagem, destinosPossiveis, podeUsarDestino,
  gruposParaAdicionar, alterarDescricaoDaSecao,
} from './editorQuestionario';
import { errosDoQuestionario, escalaDaNota, LIMITES_QUESTIONARIO, maximoDeFotos, validarQuestionario } from './questionario';

let mockContador = 0;
jest.mock('./uid', () => ({ novoUid: () => `uid-${++mockContador}` }));

const TODOS: TipoPergunta[] = ['DATA_AUTOMATICA', 'PESO', 'NOTA', 'TEXTO', 'TEXTO_LONGO', 'NOTAS_POR_DIA', 'FOTOS', 'ESCOLHA_UNICA', 'MULTIPLA_ESCOLHA', 'NUMERO', 'SIM_NAO',
  'DATA', 'TELEFONE', 'EMAIL', 'GRADE', 'ENDERECO', 'ACEITE', 'INFORMATIVO'];
const p = (id: string, tipo: TipoPergunta = 'TEXTO', extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao => ({ id, tipo, rotulo: `Pergunta ${id}`, obrigatoria: false, ...extra });
const base = (): ConteudoQuestionario => ({
  formato: 2, instrucoes: [],
  secoes: [{ uid: 's1', titulo: 'A', perguntas: [p('a'), p('b'), p('c')] }, { uid: 's2', titulo: 'B', perguntas: [p('d')] }],
});

describe('fábricas', () => {
  it('cada tipo da lista de adicionar nasce válido depois de preencher o texto e as opções', () => {
    for (const { tipo } of TIPOS_PARA_ADICIONAR) {
      const nova = novaPergunta(tipo);
      const rotular = (l?: { id: string; rotulo: string }[]) => l?.map((o, k) => ({ ...o, rotulo: `Item ${k}` }));
      const preenchida = { ...nova, rotulo: 'Texto', opcoes: rotular(nova.opcoes), linhas: rotular(nova.linhas), colunas: rotular(nova.colunas),
        texto: tipo === 'ACEITE' ? 'Regras fictícias.' : nova.texto };
      const c: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 'x', titulo: 'Seção', perguntas: [preenchida] }] };
      // O endereço só existe na anamnese; os demais valem na atualização.
      const finalidade = tipo === 'ENDERECO' ? 'ANAMNESE' : 'ATUALIZACAO';
      expect(errosDoQuestionario(paraApi(c, finalidade), finalidade)).toEqual([]);
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

describe('descrição da seção, escala da nota e fotos por pergunta', () => {
  it('paraApi leva a descrição da seção e tira a vazia; normalizar mantém', () => {
    const c = alterarDescricaoDaSecao(base(), 0, '**Leia** antes\n__com calma__');
    expect(paraApi(c).secoes[0].descricao).toBe('**Leia** antes\n__com calma__');
    expect(normalizarQuestionario(c).secoes[0].descricao).toBe('**Leia** antes\n__com calma__');
    expect(paraApi(alterarDescricaoDaSecao(base(), 0, '   ')).secoes[0].descricao).toBeUndefined();
    expect('descricao' in normalizarQuestionario(base()).secoes[0]).toBe(false);
  });
  it('paraApi leva min, max e os textos das pontas da NOTA, e só o max da FOTOS', () => {
    const c: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 's', titulo: 'x', perguntas: [
      p('n', 'NOTA', { min: 1, max: 5, rotuloMin: 'Nada', rotuloMax: ' ', casas: 1, unidade: 'x' }),
      p('f', 'FOTOS', { min: 1, max: 3, rotuloMin: 'a' }),
      p('t', 'TEXTO', { rotuloMin: 'a', rotuloMax: 'b' }),
    ] }] };
    const [n, f, t] = paraApi(c).secoes[0].perguntas;
    expect(n).toMatchObject({ min: 1, max: 5, rotuloMin: 'Nada', rotuloMax: undefined, casas: undefined, unidade: undefined });
    expect(f).toMatchObject({ min: undefined, max: 3, rotuloMin: undefined });
    expect(t).toMatchObject({ rotuloMin: undefined, rotuloMax: undefined });
    expect(errosDoQuestionario(paraApi(c))).toEqual([]);
  });
  it('nota nova é de 0 a 10; a escala e as fotos usam o padrão quando o valor falta ou está fora da regra', () => {
    expect(escalaDaNota(novaPergunta('NOTA'))).toEqual({ min: 0, max: 10 });
    expect(escalaDaNota({ min: 1, max: 5 })).toEqual({ min: 1, max: 5 });
    expect(escalaDaNota({ min: 2, max: 11 })).toEqual({ min: 0, max: 10 });
    expect(maximoDeFotos(novaPergunta('FOTOS'))).toBe(LIMITES_QUESTIONARIO.fotosPorPergunta);
    expect(maximoDeFotos({ max: 2 })).toBe(2);
    expect(maximoDeFotos({ max: 0 })).toBe(LIMITES_QUESTIONARIO.fotosPorPergunta);
  });
  it('FOTOS pode repetir até seis perguntas; a sétima é recusada antes de publicar', () => {
    let c = base();
    for (let i = 0; i < LIMITES_QUESTIONARIO.perguntasFotos; i++) {
      expect(podeAdicionar(c, 0, 'FOTOS').pode).toBe(true);
      c = adicionarPergunta(c, 0, p(`f${i}`, 'FOTOS'));
    }
    expect(podeAdicionar(c, 0, 'FOTOS')).toEqual({ pode: false, motivo: 'O questionário já tem 6 perguntas de fotos.' });
    expect(podeDuplicar(c, 0, 3).pode).toBe(false);
    expect(errosDoQuestionario(adicionarPergunta(c, 1, p('f9', 'FOTOS'))).map((e) => e.caminho)).toEqual(['secoes[1].perguntas[1].tipo']);
    expect(TIPOS_PARA_ADICIONAR.find((t) => t.tipo === 'FOTOS')?.descricao).not.toMatch(/Só uma/);
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

describe('anamnese', () => {
  it('a anamnese não oferece a data da atualização; a atualização oferece tudo, menos o endereço', () => {
    expect(tiposParaAdicionar('ANAMNESE').map((t) => t.tipo)).not.toContain('DATA_AUTOMATICA');
    expect(tiposParaAdicionar('ATUALIZACAO')).toHaveLength(TODOS.length - 1);
    expect(tiposParaAdicionar('ANAMNESE')).toHaveLength(TODOS.length - 1);
  });
  it('grade nasce com uma linha e duas colunas; aceite obrigatório com a frase pronta', () => {
    const g = novaPergunta('GRADE');
    expect(g.linhas).toHaveLength(1);
    expect(g.colunas).toHaveLength(2);
    const a = novaPergunta('ACEITE');
    expect(a.obrigatoria).toBe(true);
    expect(a.declaracao).toBeTruthy();
  });
  it('paraApi tira o que não é do tipo e as imagens vazias; mantém imagem da opção e a condição', () => {
    const c: ConteudoQuestionario = { instrucoes: [], secoes: [{ uid: 's', titulo: 'A', mostrarSe: undefined, perguntas: [
      p('s', 'SIM_NAO'),
      p('t', 'TEXTO', { somentePassado: true, linhas: [novaOpcao('x')], texto: 'x', declaracao: 'y', imagemId: '  ', mostrarSe: { perguntaId: 's', valores: ['sim'] } }),
      p('e', 'ESCOLHA_UNICA', { opcoes: [{ id: 'a', rotulo: 'A', imagemId: '0b6f9a1e-5c3d-4e2a-9f7b-1a2b3c4d5e6f' }, { id: 'b', rotulo: 'B', imagemId: '' }] }),
      p('g', 'GRADE', { linhas: [{ id: 'l', rotulo: 'L', imagemId: 'x' }], colunas: [novaOpcao('c1'), novaOpcao('c2')] }),
    ] }] };
    const [s, t, e, g] = paraApi(c, 'ANAMNESE').secoes[0].perguntas;
    expect(s.mostrarSe).toBeUndefined();
    expect(t).toMatchObject({ mostrarSe: { perguntaId: 's', valores: ['sim'] } });
    expect(t.somentePassado ?? t.linhas ?? t.texto ?? t.declaracao ?? t.imagemId).toBeUndefined();
    expect(e.opcoes?.[0].imagemId).toBe('0b6f9a1e-5c3d-4e2a-9f7b-1a2b3c4d5e6f');
    expect(e.opcoes?.[1].imagemId).toBeUndefined();
    expect(g.linhas?.[0].imagemId).toBeUndefined();
  });
  it('duplicar a grade gera ids novos em linhas e colunas', () => {
    const g = novaPergunta('GRADE');
    const copia = duplicarPergunta(g);
    expect(copia.linhas?.[0].id).not.toBe(g.linhas?.[0].id);
    expect(copia.colunas?.[0].id).not.toBe(g.colunas?.[0].id);
  });
});

describe('condição', () => {
  const c = (): ConteudoQuestionario => ({ instrucoes: [], secoes: [
    { uid: 's1', titulo: 'A', perguntas: [p('n', 'NOTA'), p('s', 'SIM_NAO', { rotulo: 'Pratica?' }), p('e', 'ESCOLHA_UNICA', { opcoes: [novaOpcao('X'), novaOpcao('Y')] }), p('t')] },
    { uid: 's2', titulo: 'B', perguntas: [p('u')] },
  ] });
  it('só perguntas de escolha anteriores controlam', () => {
    expect(controlesAnteriores(c(), 0, 3).map((x) => x.id)).toEqual(['s', 'e']);
    expect(controlesAnteriores(c(), 0, 2).map((x) => x.id)).toEqual(['s']);
    expect(controlesAnteriores(c(), 1, -1).map((x) => x.id)).toEqual(['s', 'e']);
    expect(controlesAnteriores(c(), 0, -1)).toEqual([]);
    expect(controlesAnteriores(c(), 0, 3)[0].valores.map((v) => v.valor)).toEqual(['sim', 'nao']);
  });
  it('acha a posição e descreve a condição', () => {
    expect(posicaoDaPergunta(c(), 'u')).toEqual({ secao: 1, pergunta: 0 });
    expect(posicaoDaPergunta(c(), 'zz')).toBeNull();
    expect(textoDaCondicao(c(), { perguntaId: 's', valores: ['sim'] })).toBe('Aparece se “Pratica?” for Sim');
    expect(textoDaCondicao(c(), undefined)).toBe('');
    expect(textoDaCondicao(c(), { perguntaId: 'zz', valores: [] })).toBe('Condição sem pergunta');
  });
  it('a condição da seção passa na validação quando aponta para escolha anterior', () => {
    const x = alterarCondicaoDaSecao(c(), 1, { perguntaId: 's', valores: ['nao'] });
    expect(validarQuestionario(paraApi(x)).erros.filter((e) => e.caminho.includes('mostrarSe'))).toEqual([]);
    const y = alterarCondicaoDaSecao(c(), 0, { perguntaId: 's', valores: ['nao'] });
    expect(validarQuestionario(paraApi(y)).erros.map((e) => e.caminho)).toContain('secoes[0].mostrarSe.perguntaId');
  });
});

describe('destino no cadastro (anamnese)', () => {
  const P = (id: string, tipo: TipoPergunta, extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao => ({ id, tipo, rotulo: `Pergunta ${id}`, obrigatoria: false, ...extra });
  const c = (...perguntas: PerguntaAtualizacao[]): ConteudoQuestionario => ({ formato: 2, instrucoes: [], secoes: [{ uid: 's1', titulo: 'A', perguntas }] });
  it('só na anamnese: peso → registro de peso, texto curto → objetivo ou CPF, telefone, endereço', () => {
    expect(destinosPossiveis('PESO', 'ANAMNESE')).toEqual(['PESO']);
    expect(destinosPossiveis('TEXTO', 'ANAMNESE')).toEqual(['OBJETIVO', 'CPF']);
    expect(destinosPossiveis('TELEFONE', 'ANAMNESE')).toEqual(['TELEFONE']);
    expect(destinosPossiveis('ENDERECO', 'ANAMNESE')).toEqual(['ENDERECO']);
    expect(destinosPossiveis('TEXTO_LONGO', 'ANAMNESE')).toEqual([]);
    expect(destinosPossiveis('PESO', 'ATUALIZACAO')).toEqual([]);
    expect(destinosPossiveis('ENDERECO', 'ATUALIZACAO')).toEqual([]);
  });
  it('um campo por questionário', () => {
    const x = c(P('a', 'TEXTO', { destino: 'OBJETIVO' }), P('b', 'TEXTO'), P('n', 'NOTA'));
    expect(podeUsarDestino(x, 'a', 'OBJETIVO', 'ANAMNESE').pode).toBe(true);
    expect(podeUsarDestino(x, 'b', 'OBJETIVO', 'ANAMNESE')).toEqual({ pode: false, motivo: 'Outra pergunta já alimenta este campo do cadastro.' });
    expect(podeUsarDestino(x, 'b', 'CPF', 'ANAMNESE').pode).toBe(true);
    expect(podeUsarDestino(x, 'b', 'ENDERECO', 'ANAMNESE').pode).toBe(false);
    expect(podeUsarDestino(x, 'n', 'OBJETIVO', 'ANAMNESE').pode).toBe(false);
  });
  it('o endereço só entra no menu da anamnese e só na anamnese', () => {
    expect(tiposParaAdicionar('ANAMNESE').map((t) => t.tipo)).toContain('ENDERECO');
    expect(tiposParaAdicionar('ATUALIZACAO').map((t) => t.tipo)).not.toContain('ENDERECO');
    const x = c(P('e', 'ENDERECO'));
    expect(validarQuestionario(x, 'ANAMNESE').erros).toEqual([]);
    expect(validarQuestionario(x, 'ATUALIZACAO').erros.map((e) => e.caminho)).toEqual(['secoes[0].perguntas[0].tipo']);
  });
  it('a data da pesagem é uma DATA só no passado', () => {
    const x = c(P('d1', 'DATA', { somentePassado: true, rotulo: 'Pesagem' }), P('d2', 'DATA'));
    expect(datasDaPesagem(x)).toEqual([{ id: 'd1', rotulo: 'Pesagem' }]);
  });
  it('paraApi mantém o destino válido e tira o que não cabe; duplicar não leva o destino', () => {
    const x = c(P('d', 'DATA', { somentePassado: true }), P('peso', 'PESO', { destino: 'PESO', destinoData: 'd' }),
      P('t', 'TEXTO_LONGO', { destino: 'OBJETIVO' }), P('o', 'TEXTO', { destino: 'OBJETIVO', destinoData: 'd' }));
    const [, peso, t, o] = paraApi(x, 'ANAMNESE').secoes[0].perguntas;
    expect([peso.destino, peso.destinoData]).toEqual(['PESO', 'd']);
    expect(t.destino).toBeUndefined();
    expect([o.destino, o.destinoData]).toEqual(['OBJETIVO', undefined]);
    expect(validarQuestionario(paraApi(x, 'ANAMNESE'), 'ANAMNESE').erros).toEqual([]);
    expect(paraApi(x, 'ATUALIZACAO').secoes[0].perguntas[1].destino).toBeUndefined();
    expect(duplicarPergunta(peso).destino).toBeUndefined();
  });
  it('paraApi leva o sexo da opção só com destino SEXO', () => {
    const opcoes = [
      { id: 'm', rotulo: 'Masculino', valorNoCadastro: 'MASCULINO' },
      { id: 'n', rotulo: 'Prefiro não dizer', valorNoCadastro: 'TALVEZ' },
    ];
    const comDestino = paraApi(c(P('s', 'ESCOLHA_UNICA', { destino: 'SEXO', opcoes })), 'ANAMNESE').secoes[0].perguntas[0];
    expect(comDestino.destino).toBe('SEXO');
    expect(comDestino.opcoes?.map((o) => o.valorNoCadastro)).toEqual(['MASCULINO', undefined]);
    const semDestino = paraApi(c(P('s', 'ESCOLHA_UNICA', { opcoes })), 'ANAMNESE').secoes[0].perguntas[0];
    expect(semDestino.opcoes?.every((o) => o.valorNoCadastro == null)).toBe(true);
    expect(validarQuestionario(paraApi(c(P('s', 'ESCOLHA_UNICA', { destino: 'SEXO', opcoes: [
      { id: 'm', rotulo: 'Masculino', valorNoCadastro: 'MASCULINO' },
      { id: 'f', rotulo: 'Feminino', valorNoCadastro: 'FEMININO' },
    ] })), 'ANAMNESE'), 'ANAMNESE').erros).toEqual([]);
  });
});

describe('grupos da folha "Adicionar pergunta"', () => {
  it('cada tipo da finalidade aparece uma vez, em grupos', () => {
    for (const finalidade of ['ATUALIZACAO', 'ANAMNESE'] as const) {
      const grupos = gruposParaAdicionar(finalidade);
      const tipos = grupos.flatMap((g) => g.itens.map((i) => i.tipo));
      expect(new Set(tipos).size).toBe(tipos.length);
      expect([...tipos].sort()).toEqual(tiposParaAdicionar(finalidade).map((t) => t.tipo).sort());
    }
    expect(gruposParaAdicionar('ATUALIZACAO').map((g) => g.rotulo)).toEqual(['Escolha', 'Texto', 'Número e data', 'Especiais']);
    expect(gruposParaAdicionar('ANAMNESE').flatMap((g) => g.itens.map((i) => i.tipo))).not.toContain('DATA_AUTOMATICA');
  });
});
