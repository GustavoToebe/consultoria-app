import { agruparGruposParecidos, chaveDoGrupo, gruposParaUnir, nomeDoGrupoNoServidor, textoDasVariacoes } from './gruposMusculares';

describe('chaveDoGrupo', () => {
  test('ignora acento, caixa, espaços e o plural simples', () => {
    expect(chaveDoGrupo('Panturrilhas')).toBe(chaveDoGrupo('panturrilha'));
    expect(chaveDoGrupo('  Glúteos ')).toBe(chaveDoGrupo('Gluteo'));
    expect(chaveDoGrupo('Ombros')).toBe(chaveDoGrupo('Ombro'));
  });
  test('não junta nomes diferentes', () => {
    expect(chaveDoGrupo('Abdômen / Core')).not.toBe(chaveDoGrupo('Abdômen'));
    expect(chaveDoGrupo('Posterior de Coxa')).not.toBe(chaveDoGrupo('Posterior'));
  });
});

describe('agruparGruposParecidos', () => {
  const grupos = [
    { nome: 'Panturrilhas', contagem: 5 }, { nome: 'Panturrilha', contagem: 1 }, { nome: 'Peito', contagem: 84 },
    { nome: 'Abdômen / Core', contagem: 3 }, { nome: 'Posterior de Coxa', contagem: 2 }, { nome: 'Ombro', contagem: 4 }, { nome: 'Ombros', contagem: 125 },
  ];
  test('junta as variações, soma o total e mostra o nome mais curto', () => {
    const r = agruparGruposParecidos(grupos);
    const pant = r.find((g) => g.rotulo === 'Panturrilha');
    expect(pant).toMatchObject({ total: 6, nomes: ['Panturrilha', 'Panturrilhas'] });
    expect(textoDasVariacoes(pant!)).toBe('Panturrilha 1 · Panturrilhas 5');
    expect(r.find((g) => g.rotulo === 'Ombro')?.total).toBe(129);
  });
  test('deixa separados os que só parecem', () => {
    const rotulos = agruparGruposParecidos(grupos).map((g) => g.rotulo);
    expect(rotulos).toEqual(expect.arrayContaining(['Abdômen / Core', 'Posterior de Coxa', 'Peito']));
    expect(rotulos).toHaveLength(5);
  });
  test('ordem alfabética, grupo sem nome fora e nome repetido soma', () => {
    const r = agruparGruposParecidos([{ nome: 'Costas', contagem: 1 }, { nome: ' ', contagem: 9 }, { nome: 'Bíceps', contagem: 2 }, { nome: 'Costas', contagem: 3 }]);
    expect(r.map((g) => [g.rotulo, g.total])).toEqual([['Bíceps', 2], ['Costas', 4]]);
  });
  test('sem variações a linha não tem texto de ⓘ', () => {
    expect(textoDasVariacoes(agruparGruposParecidos([{ nome: 'Peito', contagem: 1 }])[0])).toBe('');
  });
  test('NBSP na ponta: mesma linha, mas o nome exato fica para casar com o gravado (o trim do banco não o tira)', () => {
    const r = agruparGruposParecidos([{ nome: 'Ombro', contagem: 2 }, { nome: 'Ombro ', contagem: 1 }, { nome: ' Ombro ', contagem: 1 }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ rotulo: 'Ombro', total: 4, nomes: ['Ombro', 'Ombro '] });
  });
});

describe('nomes como o servidor compara', () => {
  test('só o espaço comum sai das pontas', () => {
    expect(nomeDoGrupoNoServidor('  Ombro  ')).toBe('Ombro');
    expect(nomeDoGrupoNoServidor('Ombro ')).toBe('Ombro ');
    expect(nomeDoGrupoNoServidor('\tOmbro')).toBe('\tOmbro');
  });
  test('gruposParaUnir conta pelo nome do servidor e deixa de fora o vazio', () => {
    expect(gruposParaUnir([{ grupoMuscular: 'Ombro ' }, { grupoMuscular: 'Ombro' }, { grupoMuscular: 'Ombro ' }, { grupoMuscular: '   ' }, { grupoMuscular: null }, {}]))
      .toEqual([{ nome: 'Ombro', contagem: 2 }, { nome: 'Ombro ', contagem: 1 }]);
  });
});
