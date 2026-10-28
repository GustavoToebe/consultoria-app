import type { AvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import {
  alternarEscolha, cmParaTela, comparar, corpoDaAvaliacao, diferenca, diferencaParaTela, MEDIDAS, medidasPreenchidas,
  medidasVazias, pesoParaTela, podeComparar, problemasDaAvaliacao,
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
    expect(problemasDaAvaliacao({ data: '2026-10-29', medidas: medidas({ cintura: 80 }), observacao: null }, HOJE).data).toBe('A data não pode ser no futuro.');
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
