import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import {
  alternarEscolha, cmParaTela, comparar, corpoDaAvaliacao, diferenca, diferencaParaTela, graficoDaMedida, MEDIDAS,
  medidaEscolhida, medidasPreenchidas, medidasVazias, opcoesDeMedida, pesoParaTela, podeBaixarComparativo, podeComparar,
  problemasDaAvaliacao, serieDaMedida,
} from './avaliacaoFisica';

const HOJE = '2026-10-28';

function medidas(parcial: Partial<MedidasCorporais>): MedidasCorporais {
  return { ...medidasVazias(), ...parcial };
}

function avaliacao(id: string, data: string, parcial: Partial<MedidasCorporais>, pesoKg: number | null = null): AvaliacaoFisica {
  return { id, data, medidas: medidas(parcial), observacao: null, pesoKg, versao: 0, criadoEm: '', alteradoEm: '' };
}

describe('validação (espelho de ValidacaoDaAvaliacao)', () => {
  it('aceita uma medida com uma casa e a data de hoje', () => {
    expect(problemasDaAvaliacao({ data: HOJE, medidas: medidas({ cintura: 80.5 }), observacao: null }, HOJE)).toEqual({});
    expect(problemasDaAvaliacao({ data: HOJE, medidas: medidas({ cintura: 5, quadril: 300 }), observacao: null }, HOJE)).toEqual({});
  });

  it('data obrigatória, não futura nem antes de 1900', () => {
    expect(Object.keys(problemasDaAvaliacao({ data: null, medidas: medidas({ cintura: 80 }), observacao: null }, HOJE))).toEqual(['data']);
    expect(problemasDaAvaliacao({ data: '2026-10-29', medidas: medidas({ cintura: 80 }), observacao: null }, HOJE).data).toBe('Data da avaliação: use uma data entre 01/01/1900 e hoje');
    expect(Object.keys(problemasDaAvaliacao({ data: '1899-12-31', medidas: medidas({ cintura: 80 }), observacao: null }, HOJE))).toEqual(['data']);
  });

  it('ao menos uma medida, na faixa e com uma casa; a mensagem não repete o valor', () => {
    expect(Object.keys(problemasDaAvaliacao({ data: HOJE, medidas: medidasVazias(), observacao: null }, HOJE))).toEqual(['medidas']);
    const faixa = problemasDaAvaliacao({ data: HOJE, medidas: medidas({ cintura: 4.9, quadril: 300.1, peitoral: 0 }), observacao: null }, HOJE);
    expect(Object.keys(faixa).sort()).toEqual(['medidas.cintura', 'medidas.peitoral', 'medidas.quadril']);
    expect(JSON.stringify(faixa)).not.toContain('4.9');
    expect(problemasDaAvaliacao({ data: HOJE, medidas: medidas({ peitoral: 100.25 }), observacao: null }, HOJE)).toEqual({
      'medidas.peitoral': 'Use no máximo uma casa decimal.',
    });
  });

  it('observação até 1000 depois de tirar os espaços das pontas', () => {
    expect(problemasDaAvaliacao({ data: HOJE, medidas: medidas({ cintura: 80 }), observacao: ` ${'x'.repeat(1000)} ` }, HOJE)).toEqual({});
    expect(Object.keys(problemasDaAvaliacao({ data: HOJE, medidas: medidas({ cintura: 80 }), observacao: 'x'.repeat(1001) }, HOJE))).toEqual(['observacao']);
  });
});

describe('formatação', () => {
  it('cm com uma casa e vírgula; ausente é "—", nunca zero', () => {
    expect(cmParaTela(80)).toBe('80,0');
    expect(cmParaTela(35.5)).toBe('35,5');
    expect(cmParaTela(null)).toBe('—');
    expect(pesoParaTela(80.5)).toBe('80,5 kg');
    expect(pesoParaTela(null)).toBe('—');
  });

  it('diferença com sinal, sem palavra de avaliação; zero sem sinal', () => {
    expect(diferenca(80, 81.5)).toBe(1.5);
    expect(diferenca(80.3, 80.1)).toBe(-0.2);
    expect(diferenca(null, 80)).toBeNull();
    expect(diferenca(80, null)).toBeNull();
    expect(diferencaParaTela(1.5)).toBe('+1,5 cm');
    expect(diferencaParaTela(-2)).toBe('−2,0 cm');
    expect(diferencaParaTela(diferenca(80, 80))).toBe('0,0 cm');
    expect(diferencaParaTela(null)).toBe('—');
    expect(diferencaParaTela(diferenca(80.5, 79.25, 2), 'kg')).toBe('−1,25 kg');
  });

  it('corpo: observação sem pontas e versão só na edição', () => {
    expect(corpoDaAvaliacao(HOJE, medidas({ cintura: 80 }), '  ')).toEqual({ data: HOJE, medidas: medidas({ cintura: 80 }), observacao: null });
    expect(corpoDaAvaliacao(HOJE, medidas({}), ' obs ', 3)).toEqual({ data: HOJE, medidas: medidasVazias(), observacao: 'obs', versao: 3 });
    expect(medidasPreenchidas(medidas({ cintura: 80, quadril: 90 }))).toBe(2);
    expect(MEDIDAS).toHaveLength(10);
  });
});

describe('comparação', () => {
  const todas = [
    avaliacao('c', '2026-09-01', { cintura: 85, quadril: 100 }, 80),
    avaliacao('a', '2026-07-01', { cintura: 90, bracoDireito: 34 }, null),
    avaliacao('b', '2026-08-01', { cintura: 88 }, 81.5),
  ];

  it('escolhe de 2 a 4; o quinto não entra', () => {
    let e: string[] = [];
    for (const id of ['1', '2', '3', '4', '5']) e = alternarEscolha(e, id);
    expect(e).toEqual(['1', '2', '3', '4']);
    expect(alternarEscolha(e, '2')).toEqual(['1', '3', '4']);
    expect(podeComparar(['1'])).toBe(false);
    expect(podeComparar(['1', '2'])).toBe(true);
    expect(podeComparar(['1', '2', '3', '4', '5'])).toBe(false);
  });

  it('"Baixar comparativo": a equipe sempre; o aluno só com internet e com a marca da sessão', () => {
    expect(podeBaixarComparativo({ daEquipe: true, online: false, temMarca: true })).toBe(true);
    expect(podeBaixarComparativo({ daEquipe: false, online: true, temMarca: true })).toBe(true);
    expect(podeBaixarComparativo({ daEquipe: false, online: false, temMarca: true })).toBe(false);
    expect(podeBaixarComparativo({ daEquipe: false, online: true, temMarca: false })).toBe(false);
  });

  it('colunas em ordem cronológica e diferença entre a primeira e a última escolhida', () => {
    const c = comparar(todas, ['c', 'a']);
    expect(c.colunas.map((x) => x.data)).toEqual(['2026-07-01', '2026-09-01']);
    const cintura = c.linhas.find((l) => l.chave === 'cintura');
    expect(cintura).toMatchObject({ valores: [90, 85], diferenca: -5, unidade: 'cm' });
    // Só um dos dois valores: aparece, mas sem diferença.
    expect(c.linhas.find((l) => l.chave === 'quadril')).toMatchObject({ valores: [null, 100], diferenca: null });
    expect(c.linhas.find((l) => l.chave === 'bracoDireito')).toMatchObject({ valores: [34, null], diferenca: null });
    // Peso só numa das datas: sem diferença.
    expect(c.linhas.find((l) => l.chave === 'peso')).toMatchObject({ valores: [null, 80], diferenca: null, unidade: 'kg' });
    // Medida que nenhuma das datas tem não aparece.
    expect(c.linhas.some((l) => l.chave === 'coxaDireita')).toBe(false);
  });

  it('com três datas a diferença ignora a do meio; peso com as duas pontas', () => {
    const c = comparar(todas, ['a', 'b', 'c']);
    expect(c.linhas.find((l) => l.chave === 'cintura')).toMatchObject({ valores: [90, 88, 85], diferenca: -5 });
    const d = comparar(todas, ['b', 'c']);
    expect(d.linhas.find((l) => l.chave === 'peso')).toMatchObject({ valores: [81.5, 80], diferenca: -1.5 });
  });
});

describe('gráfico por medida', () => {
  // Fora de ordem de propósito: a série segue a data, não a ordem da API.
  const lista = [
    avaliacao('c', '2026-09-01', { cintura: 86, quadril: 99 }),
    avaliacao('a', '2026-07-01', { cintura: 90 }),
    avaliacao('b', '2026-08-01', { cintura: 88.5, quadril: 100 }),
  ];

  it('opções: só as medidas com algum valor, na ordem da tela, com quantas datas', () => {
    expect(opcoesDeMedida(lista)).toEqual([
      { valor: 'cintura', rotulo: 'Cintura', detalhe: '3 datas' },
      { valor: 'quadril', rotulo: 'Quadril', detalhe: '2 datas' },
    ]);
    expect(opcoesDeMedida([avaliacao('x', '2026-07-01', { peitoral: 100 })])).toEqual([{ valor: 'peitoral', rotulo: 'Peitoral', detalhe: '1 data' }]);
    expect(opcoesDeMedida([])).toEqual([]);
  });

  it('a escolhida vale enquanto for opção; senão a primeira; sem opção, nula', () => {
    const opcoes = opcoesDeMedida(lista);
    expect(medidaEscolhida(opcoes, 'quadril')).toBe('quadril');
    expect(medidaEscolhida(opcoes, 'peitoral')).toBe('cintura');
    expect(medidaEscolhida(opcoes, null)).toBe('cintura');
    expect(medidaEscolhida([], 'cintura')).toBeNull();
  });

  it('pontos em ordem de data e só onde a medida existe (sem zero, sem repetir, sem interpolar)', () => {
    expect(serieDaMedida(lista, 'cintura').pontos).toEqual([
      { data: '2026-07-01', valor: 90 }, { data: '2026-08-01', valor: 88.5 }, { data: '2026-09-01', valor: 86 },
    ]);
    // Quadril ausente na primeira data: ela não vira ponto.
    expect(serieDaMedida(lista, 'quadril').pontos).toEqual([{ data: '2026-08-01', valor: 100 }, { data: '2026-09-01', valor: 99 }]);
    // Ausente no meio: o ponto some, os vizinhos ficam como estão.
    const meio = [avaliacao('1', '2026-01-01', { coxaDireita: 55 }), avaliacao('2', '2026-02-01', { cintura: 80 }), avaliacao('3', '2026-03-01', { coxaDireita: 57 })];
    expect(serieDaMedida(meio, 'coxaDireita').pontos).toEqual([{ data: '2026-01-01', valor: 55 }, { data: '2026-03-01', valor: 57 }]);
    expect(serieDaMedida(meio, 'panturrilhaEsquerda').pontos).toEqual([]);
  });

  it('a lista traz todas as datas, da mais nova à mais antiga, com nulo onde não mediu', () => {
    expect(serieDaMedida(lista, 'quadril').linhas).toEqual([
      { id: 'c', data: '2026-09-01', valor: 99 }, { id: 'b', data: '2026-08-01', valor: 100 }, { id: 'a', data: '2026-07-01', valor: null },
    ]);
  });

  it('0 pontos = nada; 1 = só o ponto; 2 ou mais = linha; gráficos desligados = só a lista', () => {
    expect(graficoDaMedida(0, true)).toBe('nada');
    expect(graficoDaMedida(0, false)).toBe('nada');
    expect(graficoDaMedida(1, true)).toBe('ponto');
    expect(graficoDaMedida(2, true)).toBe('linha');
    expect(graficoDaMedida(5, true)).toBe('linha');
    expect(graficoDaMedida(3, false)).toBe('desligado');
  });
});
