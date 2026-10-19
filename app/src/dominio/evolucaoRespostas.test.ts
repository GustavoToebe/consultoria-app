import type { SerieDeResposta } from '../api/tipos';
import {
  linhasDaLista, mostraGrafico, nomeDaSerie, opcoesDasSeries, pontosDoGrafico, serieEscolhida, textoDoAlcance, textoDoValor,
  unidadeDoGrafico,
} from './evolucaoRespostas';

const ponto = (data: string, valor: number) => ({ atualizacaoId: `a-${data}`, data, valor });
const serie = (dados: Partial<SerieDeResposta> = {}): SerieDeResposta => ({
  perguntaId: 'sono', tipo: 'NOTA', rotulo: 'Qualidade do sono', rotuloCurto: null, unidade: null, casas: null, pontos: [], ...dados,
});

describe('nomeDaSerie e opcoesDasSeries', () => {
  it('usa o rótulo curto e mostra o completo e a contagem no detalhe', () => {
    const s = serie({ rotuloCurto: ' Sono ', pontos: [ponto('2026-01-31', 6), ponto('2026-03-02', 0)] });
    expect(nomeDaSerie(s)).toBe('Sono');
    expect(opcoesDasSeries([s])).toEqual([{ valor: 'sono', rotulo: 'Sono', detalhe: 'Qualidade do sono · 2 respostas' }]);
  });
  it('sem rótulo curto: o rótulo cortado em 32 caracteres; uma resposta no singular', () => {
    const longo = 'Como foi a sua energia nos treinos desta semana?';
    const [opcao] = opcoesDasSeries([serie({ rotulo: longo, pontos: [ponto('2026-01-31', 7)] })]);
    expect(opcao.rotulo).toHaveLength(32);
    expect(opcao.rotulo.endsWith('…')).toBe(true);
    expect(opcao.detalhe).toBe(`${longo} · 1 resposta`);
  });
  it('rótulo curto igual ao completo não se repete no detalhe', () => {
    expect(opcoesDasSeries([serie({ rotulo: 'Sono', pontos: [ponto('2026-01-31', 7)] })])[0].detalhe).toBe('1 resposta');
  });
});

describe('serieEscolhida', () => {
  const a = serie({ perguntaId: 'a' });
  const b = serie({ perguntaId: 'b' });
  it('acha pelo id e cai na primeira quando o id sumiu ou é nulo', () => {
    expect(serieEscolhida([a, b], 'b')).toBe(b);
    expect(serieEscolhida([a, b], 'x')).toBe(a);
    expect(serieEscolhida([a, b], null)).toBe(a);
    expect(serieEscolhida([], 'a')).toBeNull();
  });
});

describe('textoDoValor e unidadeDoGrafico', () => {
  it('nota é inteira e sem unidade; zero é resposta', () => {
    expect(textoDoValor(serie(), 0)).toBe('0');
    expect(textoDoValor(serie(), 8)).toBe('8');
    expect(unidadeDoGrafico(serie({ unidade: 'cm' }))).toBe('');
  });
  it('número usa as casas e a unidade da pergunta', () => {
    const cintura = serie({ tipo: 'NUMERO', unidade: 'cm', casas: 1 });
    expect(textoDoValor(cintura, 88.5)).toBe('88,5 cm');
    expect(textoDoValor(cintura, 90)).toBe('90 cm');
    expect(textoDoValor(serie({ tipo: 'NUMERO', unidade: '  ', casas: null }), 3)).toBe('3');
    expect(unidadeDoGrafico(cintura)).toBe('cm');
    expect(unidadeDoGrafico(serie({ tipo: 'NUMERO' }))).toBe('');
  });
});

describe('gráfico e lista', () => {
  const s = serie({ pontos: [ponto('2026-04-01', 8), ponto('2026-01-31', 6), ponto('2026-03-02', 0)] });
  it('gráfico do mais antigo ao mais novo, com a data curta', () => {
    expect(pontosDoGrafico(s)).toEqual([{ rotulo: '31/01', valor: 6 }, { rotulo: '02/03', valor: 0 }, { rotulo: '01/04', valor: 8 }]);
  });
  it('lista da mais recente para a mais antiga; o limite guarda as mais recentes', () => {
    expect(linhasDaLista(s, null).map((p) => p.data)).toEqual(['2026-04-01', '2026-03-02', '2026-01-31']);
    expect(linhasDaLista(s, 2).map((p) => p.data)).toEqual(['2026-04-01', '2026-03-02']);
  });
  it('gráfico só com a preferência ligada e 2 pontos ou mais', () => {
    expect(mostraGrafico(s, true)).toBe(true);
    expect(mostraGrafico(s, false)).toBe(false);
    expect(mostraGrafico(serie({ pontos: [ponto('2026-01-31', 6)] }), true)).toBe(false);
    expect(mostraGrafico(null, true)).toBe(false);
  });
});

describe('textoDoAlcance', () => {
  it('diz quantas atualizações entraram', () => {
    expect(textoDoAlcance({ limite: 24, atualizacoes: 0 })).toBe('Nenhuma atualização enviada ainda.');
    expect(textoDoAlcance({ limite: 24, atualizacoes: 1 })).toBe('1 atualização enviada.');
    expect(textoDoAlcance({ limite: 24, atualizacoes: 3 })).toBe('3 atualizações enviadas.');
    expect(textoDoAlcance({ limite: 24, atualizacoes: 24 })).toBe('Últimas 24 atualizações enviadas.');
  });
});
