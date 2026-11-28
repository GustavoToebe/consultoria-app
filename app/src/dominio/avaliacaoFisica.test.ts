import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import {
  cmParaTela, corpoDaAvaliacao, diferenca, diferencaParaTela, graficoDaMedida, MEDIDAS,
  medidaEscolhida, medidasPreenchidas, medidasVazias, opcoesDeMedida, pesoParaTela, podeBaixarComparativo,
  problemasDaAvaliacao, serieDaMedida, valorAnterior, valorParaTabela, variacaoCurta,
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
    expect(diferencaParaTela(diferenca(82, 80, 2), 'kg')).toBe('−2,0 kg'); // as casas do Peso: nunca "−2 kg"
    expect(diferencaParaTela(diferenca(80, 81, 2), 'kg')).toBe('+1,0 kg');
    expect(diferencaParaTela(diferenca(80, 80, 2), 'kg')).toBe('0,0 kg');
  });

  it('corpo: observação sem pontas e versão só na edição', () => {
    expect(corpoDaAvaliacao(HOJE, medidas({ cintura: 80 }), '  ')).toEqual({ data: HOJE, medidas: medidas({ cintura: 80 }), observacao: null });
    expect(corpoDaAvaliacao(HOJE, medidas({}), ' obs ', 3)).toEqual({ data: HOJE, medidas: medidasVazias(), observacao: 'obs', versao: 3 });
    expect(medidasPreenchidas(medidas({ cintura: 80, quadril: 90 }))).toBe(2);
    expect(MEDIDAS).toHaveLength(10);
  });
});

describe('comparação', () => {
  it('"Baixar comparativo": a equipe sempre; o aluno só com internet e com a marca da sessão', () => {
    expect(podeBaixarComparativo({ daEquipe: true, online: false, temMarca: true })).toBe(true);
    expect(podeBaixarComparativo({ daEquipe: false, online: true, temMarca: true })).toBe(true);
    expect(podeBaixarComparativo({ daEquipe: false, online: false, temMarca: true })).toBe(false);
    expect(podeBaixarComparativo({ daEquipe: false, online: true, temMarca: false })).toBe(false);
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

describe('variação desde a anterior (histórico e folha)', () => {
  it('seta, vírgula e 1 casa no cm; zero é "0,0" sem seta, sem anterior é "Primeira" e só sem valor é "—"', () => {
    expect(variacaoCurta('bracoDireito', 39.5, 40, null)).toEqual({ tipo: 'mudou', texto: '▲ 0,5', tom: 'neutro', falado: 'subiu 0,5 cm' });
    expect(variacaoCurta('bracoDireito', 41, 40, null).texto).toBe('▼ 1,0');
    // Zero na cintura com meta: neutro (nada a favor nem contra).
    expect(variacaoCurta('cintura', 40, 40, 'REDUZIR')).toEqual({ tipo: 'igual', texto: '0,0', tom: 'neutro', falado: 'sem variação' });
    expect(variacaoCurta('peso', 80, 80, 'REDUZIR')).toMatchObject({ tipo: 'igual', texto: '0,0' });
    expect(variacaoCurta('cintura', null, 80, 'REDUZIR')).toEqual({ tipo: 'primeira', texto: 'Primeira', tom: 'neutro', falado: 'primeira medida' });
    expect(variacaoCurta('cintura', 80, null, 'REDUZIR')).toEqual({ tipo: 'semValor', texto: '—', tom: 'neutro', falado: '' });
    expect(variacaoCurta('cintura', null, null, 'REDUZIR').tipo).toBe('semValor');
    // 0,1 + 0,2 não vira 0,30000000000000004.
    expect(variacaoCurta('peitoral', 100.1, 100.4, null).texto).toBe('▲ 0,3');
  });

  it('só peso, cintura, abdômen e quadril seguem a meta; reduzir: descer é verde, aumentar: o contrário', () => {
    for (const c of ['cintura', 'abdomen', 'quadril', 'peso'] as const) {
      expect(variacaoCurta(c, 90, 89, 'REDUZIR').tom).toBe('positivo');
      expect(variacaoCurta(c, 90, 91, 'REDUZIR').tom).toBe('problema');
      expect(variacaoCurta(c, 90, 91, 'AUMENTAR').tom).toBe('positivo');
      expect(variacaoCurta(c, 90, 89, 'AUMENTAR').tom).toBe('problema');
    }
    for (const c of ['bracoDireito', 'peitoral', 'coxaEsquerda', 'panturrilhaDireita'] as const) expect(variacaoCurta(c, 90, 89, 'REDUZIR').tom).toBe('neutro');
    expect(variacaoCurta('cintura', 90, 89, 'SEM_META').tom).toBe('neutro');
    expect(variacaoCurta('cintura', 90, 89, undefined).tom).toBe('neutro');
    expect(variacaoCurta('cintura', 90, 89, 'REDUZIR').falado).toBe('desceu 1,0 cm, a favor da meta');
  });

  it('peso em kg com as casas do Peso', () => {
    expect(variacaoCurta('peso', 90, 89.25, 'REDUZIR')).toMatchObject({ texto: '▼ 0,75', falado: 'desceu 0,75 kg, a favor da meta' });
    expect(variacaoCurta('peso', 90, 91, null).texto).toBe('▲ 1,0');
    expect(valorParaTabela('peso', 90)).toBe('90,0');
    expect(valorParaTabela('cintura', 80.25)).toBe('80,3');
    expect(valorParaTabela('cintura', null)).toBe('—');
  });

  it('anterior = a última avaliação antes da data que mediu (pula a que não mediu e a que está em edição)', () => {
    const lista = [
      avaliacao('a3', '2026-10-01', { cintura: 85 }),
      avaliacao('a2', '2026-09-01', { bracoDireito: 35 }),
      avaliacao('a1', '2026-08-01', { cintura: 88, bracoDireito: 34 }, 90),
    ];
    expect(valorAnterior(lista, 'cintura', '2026-10-01')).toBe(88);
    expect(valorAnterior(lista, 'bracoDireito', '2026-10-01')).toBe(35);
    expect(valorAnterior(lista, 'cintura', '2026-08-01')).toBeNull();
    expect(valorAnterior(lista, 'peso', '2026-12-01')).toBe(90);
    // Editando a3 com a data nova depois de todas: a própria a3 não conta como anterior.
    expect(valorAnterior(lista, 'cintura', '2026-12-01', 'a3')).toBe(88);
  });
});
