import { aniversariantesDosProximosDias, descricaoDaJanela, OPCOES_DIAS_ANIVERSARIO } from './aniversariosDosAlunos';

const n = (nome: string, mes: number, dia: number) => ({ nome, mes, dia });
const nomes = (lista: ReturnType<typeof n>[], hoje: string, dias: number) => aniversariantesDosProximosDias(lista, hoje, dias).map((a) => a.nome);

describe('aniversariantesDosProximosDias', () => {
  const lista = [n('Zé', 11, 25), n('Bia', 11, 18), n('Ana', 11, 18), n('Caio', 11, 17), n('Dani', 11, 20), n('Edu', 12, 2), n('Fê', 11, 16)];

  it('janelas 0, 3, 7 e 15: do mais próximo ao mais distante, empate por nome; o que já passou fica de fora', () => {
    expect(OPCOES_DIAS_ANIVERSARIO).toEqual([0, 3, 7, 15]);
    expect(nomes(lista, '2026-11-17', 0)).toEqual(['Caio']);
    expect(nomes(lista, '2026-11-17', 3)).toEqual(['Caio', 'Ana', 'Bia', 'Dani']);
    expect(nomes(lista, '2026-11-17', 7)).toEqual(['Caio', 'Ana', 'Bia', 'Dani']);
    expect(nomes(lista, '2026-11-17', 15)).toEqual(['Caio', 'Ana', 'Bia', 'Dani', 'Zé', 'Edu']);
  });

  it('rótulo e data: hoje, amanhã e em N dias; sem ano nem idade no resultado', () => {
    const r = aniversariantesDosProximosDias(lista, '2026-11-17', 3);
    expect(r.map((a) => [a.nome, a.diasAte, a.quando, a.data])).toEqual([
      ['Caio', 0, 'hoje', '17/11'], ['Ana', 1, 'amanhã', '18/11'], ['Bia', 1, 'amanhã', '18/11'], ['Dani', 3, 'em 3 dias', '20/11'],
    ]);
    expect(Object.keys(r[0]).sort()).toEqual(['data', 'dia', 'diasAte', 'mes', 'nome', 'quando']);
  });

  it('virada de ano: 29/12 vê 31/12 e 02/01; o que passou neste ano só volta em 364 dias', () => {
    const virada = [n('Jan 2', 1, 2), n('Hoje', 12, 29), n('Dez 31', 12, 31), n('Jan 20', 1, 20), n('Dez 28', 12, 28)];
    expect(nomes(virada, '2026-12-29', 7)).toEqual(['Hoje', 'Dez 31', 'Jan 2']);
    expect(aniversariantesDosProximosDias(virada, '2026-12-29', 7).find((a) => a.nome === 'Jan 2')).toMatchObject({ diasAte: 4, data: '02/01' });
    expect(nomes(virada, '2026-12-29', 15)).toEqual(['Hoje', 'Dez 31', 'Jan 2']);
    expect(nomes(virada, '2026-12-31', 3)).toEqual(['Dez 31', 'Jan 2']);
  });

  it('29/02 comemora em 28/02 no ano não bissexto e em 29/02 no bissexto', () => {
    const bi = [n('Bissexto', 2, 29)];
    expect(aniversariantesDosProximosDias(bi, '2027-02-28', 0)).toMatchObject([{ diasAte: 0, data: '28/02' }]);
    expect(nomes(bi, '2027-02-25', 3)).toEqual(['Bissexto']);
    expect(nomes(bi, '2027-03-01', 15)).toEqual([]);
    expect(aniversariantesDosProximosDias(bi, '2028-02-29', 0)).toMatchObject([{ diasAte: 0, data: '29/02' }]);
    expect(nomes(bi, '2028-02-28', 0)).toEqual([]);
    expect(nomes(bi, '2028-02-28', 3)).toEqual(['Bissexto']);
    // A 15 dias do 29/02 de um ano bissexto ainda cabe; a 16 não.
    expect(nomes(bi, '2028-02-14', 15)).toEqual(['Bissexto']);
    expect(nomes(bi, '2028-02-13', 15)).toEqual([]);
  });

  it('dia ou mês inválido (31/02, mês 13, não inteiro) não quebra e não aparece', () => {
    expect(nomes([n('Ruim', 2, 31), n('Ruim 2', 13, 1), { nome: 'Ruim 3', mes: 1.5, dia: 1 }, n('Bom', 11, 17)], '2026-11-17', 15)).toEqual(['Bom']);
  });

  it('lista vazia devolve vazio', () => {
    expect(aniversariantesDosProximosDias([], '2026-11-17', 15)).toEqual([]);
  });
});

test('descrição da janela', () => {
  expect(descricaoDaJanela(0)).toBe('Hoje');
  expect(descricaoDaJanela(7)).toBe('Hoje e nos próximos 7 dias');
});
