import { passosDasInstrucoes, resumoNutrientes, textoMostrando, gruposDosExercicios } from './catalogo';

const arroz = { baseQuantidade: 100, baseUnidade: 'g', kcal: 128.26, proteina: 2.52, carboidrato: 28.06, gordura: 0.23 };

describe('catálogo: exibição', () => {
  it('mostra o resumo por 100 g', () => {
    expect(resumoNutrientes({ ...arroz, tracos: [] })).toBe('100 g · 128 kcal · P 2,5 · C 28,1 · G 0,2');
  });

  it('nutriente em traço aparece como Tr e não como 0', () => {
    const r = resumoNutrientes({ ...arroz, gordura: 0, carboidrato: 0, tracos: ['gordura'] });
    expect(r).toContain('G Tr');
    expect(r).toContain('C 0 ');
  });

  it('diz "Mostrando N de TOTAL" só quando há mais do que o mostrado', () => {
    expect(textoMostrando(50, 312)).toBe('Mostrando 50 de 312. Refine a busca ou escolha um grupo para ver mais.');
    expect(textoMostrando(12, 12)).toBeNull();
    expect(textoMostrando(0, 0)).toBeNull();
  });

  it('separa as instruções em passos', () => {
    expect(passosDasInstrucoes('Passo 1.\n\n Passo 2. \n')).toEqual(['Passo 1.', 'Passo 2.']);
    expect(passosDasInstrucoes(null)).toEqual([]);
  });
});

it('lista os grupos musculares distintos em ordem alfabética, ignorando vazios', () => {
  const lista = [{ grupoMuscular: 'Costas' }, { grupoMuscular: 'Abdômen' }, { grupoMuscular: null }, { grupoMuscular: ' Costas ' }, { grupoMuscular: '' }];
  expect(gruposDosExercicios(lista)).toEqual(['Abdômen', 'Costas']);
});
