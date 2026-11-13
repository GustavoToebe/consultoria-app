import type { AvaliacaoFisica, CampoDaMedida, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import { MEDIDAS, medidasVazias } from './avaliacaoFisica';
import {
  agruparMedidas, compararAvaliacoes, GRUPOS_DE_MEDIDAS, idDaMaisRecente, idsDasDuasUltimas, limparSelecao,
  PARES_DIREITA_ESQUERDA, resumoDaMedida, seriesDoPar, textoDaSelecao, type ComparacaoDeAvaliacoes, type LinhaComparada,
} from './comparacaoDeAvaliacoes';

function av(id: string, data: string, parcial: Partial<MedidasCorporais>): AvaliacaoFisica {
  return { id, data, medidas: { ...medidasVazias(), ...parcial }, observacao: null, pesoKg: null, versao: 0, criadoEm: '', alteradoEm: '' };
}

function ok(c: ComparacaoDeAvaliacoes) {
  if (c.estado !== 'ok') throw new Error(`esperava ok, veio ${c.motivo}`);
  return c;
}

function linha(c: ComparacaoDeAvaliacoes, chave: CampoDaMedida): LinhaComparada {
  const l = ok(c).grupos.flatMap((g) => g.itens).find((i) => i.chave === chave);
  if (!l) throw new Error(`sem linha ${chave}`);
  return l;
}

describe('grupos', () => {
  it('ordem fixa: Tronco, Braços, Pernas, com as medidas na ordem do grupo (não a da entrada)', () => {
    expect(GRUPOS_DE_MEDIDAS.map((g) => g.titulo)).toEqual(['Tronco', 'Braços', 'Pernas']);
    expect(GRUPOS_DE_MEDIDAS[0].campos).toEqual(['peitoral', 'cintura', 'abdomen', 'quadril']);
    const itens = [...MEDIDAS].reverse().map((m) => ({ chave: m.campo }));
    const { grupos, semGrupo } = agruparMedidas(itens);
    expect(semGrupo).toEqual([]);
    expect(grupos.map((g) => g.id)).toEqual(['tronco', 'bracos', 'pernas']);
    expect(grupos[2].itens.map((i) => i.chave)).toEqual(['coxaDireita', 'coxaEsquerda', 'panturrilhaDireita', 'panturrilhaEsquerda']);
  });

  it('toda medida do código está em exatamente um grupo', () => {
    const todas = GRUPOS_DE_MEDIDAS.flatMap((g) => g.campos);
    expect([...todas].sort()).toEqual(MEDIDAS.map((m) => m.campo).sort());
  });

  it('chave desconhecida não some: vai em semGrupo; grupo vazio não aparece', () => {
    const { grupos, semGrupo } = agruparMedidas([{ chave: 'peso' }, { chave: 'cintura' }, { chave: 'pescoco' }]);
    expect(grupos.map((g) => g.id)).toEqual(['tronco']);
    expect(semGrupo.map((i) => i.chave)).toEqual(['peso', 'pescoco']);
    expect(agruparMedidas([])).toEqual({ grupos: [], semGrupo: [] });
  });
});

describe('comparação de 2 a 4 datas', () => {
  const a = av('a', '2026-11-01', { cintura: 90, peitoral: 100, bracoDireito: 34.4 });
  const b = av('b', '2026-11-05', { cintura: 88, peitoral: 101 });
  const c = av('c', '2026-11-09', { cintura: 89.5, peitoral: 100 });
  const d = av('d', '2026-11-13', { cintura: 87, peitoral: 102, bracoDireito: 35.2 });
  const todas = [c, a, d, b];

  it('2 datas fora de ordem: colunas cronológicas, valores e frase simples', () => {
    const r = ok(compararAvaliacoes(todas, ['d', 'a']));
    expect(r.colunas.map((x) => x.dataTexto)).toEqual(['01/11', '13/11']);
    expect(r.referencia).toBe('Variação = 13/11 menos 01/11.');
    const cintura = linha(r, 'cintura');
    expect(cintura.celulas.map((x) => x.texto)).toEqual(['90,0 cm', '87,0 cm']);
    expect(cintura.variacao).toEqual({ valor: -3, direcao: 'reducao', texto: '−3,0 cm' });
  });

  it('3 e 4 datas fora de ordem: variação usa a primeira e a última, e a frase diz isso', () => {
    const tres = ok(compararAvaliacoes(todas, ['c', 'a', 'b']));
    expect(tres.colunas.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(tres.referencia).toBe('Variação = 09/11 menos 01/11 (primeira e última datas selecionadas).');
    expect(linha(tres, 'cintura').variacao.texto).toBe('−0,5 cm');
    const quatro = ok(compararAvaliacoes(todas, ['d', 'b', 'a', 'c']));
    expect(quatro.colunas.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(quatro.referencia).toBe('Variação = 13/11 menos 01/11 (primeira e última datas selecionadas).');
    expect(linha(quatro, 'cintura')).toMatchObject({ celulas: [{ valor: 90 }, { valor: 88 }, { valor: 89.5 }, { valor: 87 }], variacao: { texto: '−3,0 cm' } });
  });

  it('aumento, redução e igual (sem sinal), só como direção', () => {
    const r = compararAvaliacoes(todas, ['a', 'd']);
    expect(linha(r, 'peitoral').variacao).toEqual({ valor: 2, direcao: 'aumento', texto: '+2,0 cm' });
    expect(linha(compararAvaliacoes(todas, ['a', 'c']), 'peitoral').variacao).toEqual({ valor: 0, direcao: 'igual', texto: '0,0 cm' });
  });

  it('arredondamento: 35,2 − 34,4 = +0,8 (sem 0,7999)', () => {
    const v = linha(compararAvaliacoes(todas, ['a', 'd']), 'bracoDireito').variacao;
    expect(v).toEqual({ valor: 0.8, direcao: 'aumento', texto: '+0,8 cm' });
    expect(linha(compararAvaliacoes(todas, ['d', 'a']), 'bracoDireito').variacao.texto).toBe('+0,8 cm');
    const inverso = compararAvaliacoes([av('x', '2026-01-01', { cintura: 35.2 }), av('y', '2026-02-01', { cintura: 34.4 })], ['x', 'y']);
    expect(linha(inverso, 'cintura').variacao).toEqual({ valor: -0.8, direcao: 'reducao', texto: '−0,8 cm' });
  });

  it('medida ausente na primeira: "Não registrada" e variação "Indisponível" (nunca a partir de zero)', () => {
    const r = compararAvaliacoes([av('1', '2026-01-01', {}), av('2', '2026-02-01', { cintura: 80 })], ['1', '2']);
    expect(linha(r, 'cintura')).toMatchObject({
      celulas: [{ valor: null, texto: 'Não registrada' }, { valor: 80, texto: '80,0 cm' }],
      variacao: { valor: null, direcao: 'indisponivel', texto: 'Indisponível' },
    });
  });

  it('medida ausente na última e no meio', () => {
    const t = [av('1', '2026-01-01', { cintura: 80, quadril: 100 }), av('2', '2026-02-01', { cintura: 81 }), av('3', '2026-03-01', { quadril: 98 })];
    const r = compararAvaliacoes(t, ['1', '2', '3']);
    expect(linha(r, 'cintura')).toMatchObject({ celulas: [{ valor: 80 }, { valor: 81 }, { valor: null, texto: 'Não registrada' }], variacao: { texto: 'Indisponível' } });
    // Ausente só no meio: a variação usa as pontas, que existem.
    const meio = compararAvaliacoes([av('1', '2026-01-01', { quadril: 100 }), av('2', '2026-02-01', {}), av('3', '2026-03-01', { quadril: 98 })], ['1', '2', '3']);
    expect(linha(meio, 'quadril')).toMatchObject({ celulas: [{ valor: 100 }, { valor: null, texto: 'Não registrada' }, { valor: 98 }], variacao: { valor: -2, texto: '−2,0 cm' } });
  });

  it('valores extremos 0,1 e 300', () => {
    const t = [av('1', '2026-01-01', { cintura: 0.1 }), av('2', '2026-02-01', { cintura: 300 })];
    expect(linha(compararAvaliacoes(t, ['1', '2']), 'cintura')).toMatchObject({ celulas: [{ texto: '0,1 cm' }, { texto: '300,0 cm' }], variacao: { texto: '+299,9 cm' } });
    expect(linha(compararAvaliacoes(t, ['2', '1']), 'cintura').variacao.texto).toBe('+299,9 cm');
  });

  it('zero é valor real (0,0 cm), não ausência', () => {
    const t = [av('1', '2026-01-01', { cintura: 0 }), av('2', '2026-02-01', { cintura: 5 })];
    expect(linha(compararAvaliacoes(t, ['1', '2']), 'cintura')).toMatchObject({ celulas: [{ valor: 0, texto: '0,0 cm' }, { valor: 5 }], variacao: { texto: '+5,0 cm' } });
  });

  it('agrupa na ordem fixa, esconde grupo e medida sem valor, e deixa o peso fora', () => {
    const r = ok(compararAvaliacoes([{ ...a, pesoKg: 80 }, { ...d, pesoKg: 79 }], ['a', 'd']));
    expect(r.grupos.map((g) => g.titulo)).toEqual(['Tronco', 'Braços']);
    expect(r.grupos[0].itens.map((i) => i.chave)).toEqual(['peitoral', 'cintura']);
    expect(r.grupos.flatMap((g) => g.itens).some((i) => (i.chave as string) === 'peso')).toBe(false);
  });

  it('uma data só, zero datas, mais de 4 e ids inexistentes ou repetidos: inválido, sem lançar', () => {
    expect(compararAvaliacoes(todas, ['a'])).toMatchObject({ estado: 'invalido', motivo: 'poucas' });
    expect(compararAvaliacoes(todas, [])).toMatchObject({ estado: 'invalido', motivo: 'poucas', mensagem: 'Escolha pelo menos 2 datas para comparar.' });
    expect(compararAvaliacoes([], ['a', 'b'])).toMatchObject({ estado: 'invalido', motivo: 'poucas' });
    expect(compararAvaliacoes(todas, ['a', 'a'])).toMatchObject({ estado: 'invalido', motivo: 'poucas' });
    expect(compararAvaliacoes(todas, ['a', 'zzz'])).toMatchObject({ estado: 'invalido', motivo: 'poucas' });
    const cinco = [...todas, av('e', '2026-11-14', { cintura: 86 })];
    expect(compararAvaliacoes(cinco, ['a', 'b', 'c', 'd', 'e'])).toMatchObject({ estado: 'invalido', motivo: 'muitas', mensagem: 'Compare no máximo 4 datas.' });
  });
});

describe('resumo da evolução de uma medida', () => {
  const lista = [av('c', '2026-11-13', { cintura: 86.5 }), av('x', '2026-11-05', { quadril: 99 }), av('a', '2026-11-01', { cintura: 88 })];

  it('última medida, variação no período e "desde dd/mm", só com as datas que têm a medida', () => {
    expect(resumoDaMedida(lista, 'cintura')).toEqual({
      pontos: 2,
      ultima: { valor: 86.5, data: '2026-11-13', dataTexto: '13/11', texto: '86,5 cm' },
      variacao: { valor: -1.5, direcao: 'reducao', texto: '−1,5 cm' },
      desde: 'desde 01/11',
    });
  });

  it('um ponto: só o valor, sem variação nem "desde"', () => {
    expect(resumoDaMedida(lista, 'quadril')).toEqual({
      pontos: 1, ultima: { valor: 99, data: '2026-11-05', dataTexto: '05/11', texto: '99,0 cm' }, variacao: null, desde: null,
    });
  });

  it('nenhum ponto e lista vazia', () => {
    expect(resumoDaMedida(lista, 'coxaDireita')).toEqual({ pontos: 0, ultima: null, variacao: null, desde: null });
    expect(resumoDaMedida([], 'cintura')).toEqual({ pontos: 0, ultima: null, variacao: null, desde: null });
  });

  it('valores iguais e arredondamento', () => {
    expect(resumoDaMedida([av('1', '2026-01-01', { cintura: 80 }), av('2', '2026-02-01', { cintura: 80 })], 'cintura').variacao).toEqual({ valor: 0, direcao: 'igual', texto: '0,0 cm' });
    expect(resumoDaMedida([av('1', '2026-01-01', { cintura: 34.4 }), av('2', '2026-02-01', { cintura: 35.2 })], 'cintura').variacao?.texto).toBe('+0,8 cm');
  });
});

describe('seleção', () => {
  const lista = [av('b', '2026-11-05', {}), av('d', '2026-11-13', {}), av('a', '2026-11-01', {})];

  it('"Comparar as duas últimas": as 2 mais recentes (mais antiga primeiro); menos de 2, vazio', () => {
    expect(idsDasDuasUltimas(lista)).toEqual(['b', 'd']);
    expect(idsDasDuasUltimas([lista[0]])).toEqual([]);
    expect(idsDasDuasUltimas([])).toEqual([]);
    expect(idsDasDuasUltimas(lista.slice(0, 2))).toEqual(['b', 'd']);
  });

  it('"Mais recente" e limpar seleção', () => {
    expect(idDaMaisRecente(lista)).toBe('d');
    expect(idDaMaisRecente([])).toBeNull();
    expect(limparSelecao()).toEqual([]);
  });

  it('"N de 4 selecionadas"', () => {
    expect(textoDaSelecao(0)).toBe('0 de 4 selecionadas');
    expect(textoDaSelecao(1)).toBe('1 de 4 selecionada');
    expect(textoDaSelecao(2)).toBe('2 de 4 selecionadas');
    expect(textoDaSelecao(4)).toBe('4 de 4 selecionadas');
  });
});

describe('pares direita × esquerda', () => {
  const lista = [
    av('c', '2026-11-13', { bracoDireito: 36, bracoEsquerdo: 35.5, coxaDireita: 60 }),
    av('a', '2026-11-01', { bracoDireito: 35, cintura: 80 }),
    av('b', '2026-11-05', { bracoEsquerdo: 35, bracoDireito: 35.5 }),
  ];

  it('só braço, coxa e panturrilha', () => {
    expect(PARES_DIREITA_ESQUERDA.map((p) => p.id)).toEqual(['braco', 'coxa', 'panturrilha']);
    // @ts-expect-error cintura não é par
    expect(seriesDoPar(lista, 'cintura')).toBeNull();
  });

  it('duas séries com os pontos reais por data; data sem a medida fica fora', () => {
    const r = seriesDoPar(lista, 'braco');
    expect(r?.suficiente).toBe(true);
    expect(r?.direita.pontos).toEqual([{ data: '2026-11-01', valor: 35 }, { data: '2026-11-05', valor: 35.5 }, { data: '2026-11-13', valor: 36 }]);
    expect(r?.esquerda.pontos).toEqual([{ data: '2026-11-05', valor: 35 }, { data: '2026-11-13', valor: 35.5 }]);
    expect(r?.direita.rotulo).toBe('Braço direito');
    expect(r?.esquerda.rotulo).toBe('Braço esquerdo');
  });

  it('um lado ausente: série vazia, par insuficiente; nada some nem é inventado', () => {
    const coxa = seriesDoPar(lista, 'coxa');
    expect(coxa?.direita.pontos).toEqual([{ data: '2026-11-13', valor: 60 }]);
    expect(coxa?.esquerda.pontos).toEqual([]);
    expect(coxa?.suficiente).toBe(false);
    expect(seriesDoPar(lista, 'panturrilha')).toMatchObject({ suficiente: false, direita: { pontos: [] }, esquerda: { pontos: [] } });
    expect(seriesDoPar([], 'braco')?.suficiente).toBe(false);
  });
});
