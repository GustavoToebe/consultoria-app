import {
  chipsDoCatalogoDeAlimentos, chipsDoCatalogoDeExercicios, equipamentoDoCatalogo, gruposDosExercicios, naBibliotecaParaApi, passosDasInstrucoes,
  SEM_FILTROS_DO_CATALOGO_DE_ALIMENTOS, SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS, semOFiltroDoCatalogoDeAlimentos, semOFiltroDoCatalogoDeExercicios,
  temTracoNaLinha, textoMostrando,
} from './catalogo';

describe('catálogo: exibição', () => {
  it('diz "Mostrando N de TOTAL" só quando há mais do que o mostrado', () => {
    expect(textoMostrando(50, 312)).toBe('Mostrando 50 de 312. Refine a busca ou escolha um grupo para ver mais.');
    expect(textoMostrando(12, 12)).toBeNull();
    expect(textoMostrando(0, 0)).toBeNull();
  });

  it('separa as instruções em passos', () => {
    expect(passosDasInstrucoes('Passo 1.\n\n Passo 2. \n')).toEqual(['Passo 1.', 'Passo 2.']);
    expect(passosDasInstrucoes(null)).toEqual([]);
  });

  it('o equipamento que só repete a modalidade sai da linha; o resto fica', () => {
    expect(equipamentoDoCatalogo('PESO_CORPORAL', 'Peso corporal')).toBeNull();
    expect(equipamentoDoCatalogo('PESO_CORPORAL', ' peso CORPORAL ')).toBeNull();
    expect(equipamentoDoCatalogo('MAQUINA', 'Polia')).toBe('Polia');
    expect(equipamentoDoCatalogo('LIVRE', null)).toBeNull();
    expect(equipamentoDoCatalogo('LIVRE', '  ')).toBeNull();
  });

  it('a legenda do "Tr" só vale quando um nutriente da linha é traço', () => {
    expect(temTracoNaLinha({ tracos: [] })).toBe(false);
    expect(temTracoNaLinha({ tracos: ['gordura'] })).toBe(true);
    expect(temTracoNaLinha({ tracos: ['fibra'] })).toBe(true);
    // Marca de um nutriente que a linha não mostra não acende a legenda.
    expect(temTracoNaLinha({ tracos: ['sodio'] })).toBe(false);
  });
});

describe('catálogo: filtro "Na biblioteca"', () => {
  it('vai à API só quando não é "Todos"', () => {
    expect(naBibliotecaParaApi('TODOS')).toBeUndefined();
    expect(naBibliotecaParaApi('SIM')).toBe(true);
    expect(naBibliotecaParaApi('NAO')).toBe(false);
  });

  it('exercícios: os chips da aba Exercícios mais o "Na biblioteca"; o ✕ tira só aquele', () => {
    const grupos = [{ valor: 'Peito', rotulo: 'Peito' }];
    const f = { ...SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS, grupos: new Set(['Peito']), modalidades: new Set(['MAQUINA']), imagem: 'SEM' as const, naBiblioteca: 'NAO' as const };
    expect(chipsDoCatalogoDeExercicios(SEM_FILTROS_DO_CATALOGO_DE_EXERCICIOS, grupos)).toEqual([]);
    expect(chipsDoCatalogoDeExercicios(f, grupos).map((c) => [c.chave, c.texto])).toEqual([
      ['grupos', 'Grupo muscular: Peito'], ['modalidades', 'Modalidade: Máquina'], ['imagem', 'Imagem: Sem imagem'], ['naBiblioteca', 'Na biblioteca: Ainda não'],
    ]);
    const semNa = semOFiltroDoCatalogoDeExercicios(f, 'naBiblioteca');
    expect(semNa.naBiblioteca).toBe('TODOS');
    expect(semNa.grupos).toBe(f.grupos);
    const semGrupo = semOFiltroDoCatalogoDeExercicios(f, 'grupos');
    expect(semGrupo.grupos.size).toBe(0);
    expect(semGrupo.naBiblioteca).toBe('NAO');
  });

  it('alimentos: Grupo, Unidade e "Na biblioteca"', () => {
    const grupos = [{ valor: 'Frutas', rotulo: 'Frutas' }];
    const f = { grupos: new Set(['Frutas']), unidades: new Set(['ml']), naBiblioteca: 'SIM' as const };
    expect(chipsDoCatalogoDeAlimentos(SEM_FILTROS_DO_CATALOGO_DE_ALIMENTOS, grupos)).toEqual([]);
    expect(chipsDoCatalogoDeAlimentos(f, grupos).map((c) => [c.chave, c.texto])).toEqual([
      ['grupos', 'Grupo: Frutas'], ['unidades', 'Unidade: Mililitros (ml)'], ['naBiblioteca', 'Na biblioteca: Já tenho'],
    ]);
    expect(semOFiltroDoCatalogoDeAlimentos(f, 'grupos')).toEqual({ ...f, grupos: new Set() });
    expect(semOFiltroDoCatalogoDeAlimentos(f, 'unidades')).toEqual({ ...f, unidades: new Set() });
    expect(semOFiltroDoCatalogoDeAlimentos(f, 'naBiblioteca')).toEqual({ ...f, naBiblioteca: 'TODOS' });
    expect(semOFiltroDoCatalogoDeAlimentos(f, 'outro')).toBe(f);
  });
});

it('lista os grupos musculares distintos em ordem alfabética, ignorando vazios', () => {
  const lista = [{ grupoMuscular: 'Costas' }, { grupoMuscular: 'Abdômen' }, { grupoMuscular: null }, { grupoMuscular: ' Costas ' }, { grupoMuscular: '' }];
  expect(gruposDosExercicios(lista)).toEqual(['Abdômen', 'Costas']);
});
