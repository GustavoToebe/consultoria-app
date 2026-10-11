import type { CategoriaErgogenico, ErgogenicoDaBiblioteca } from '../api/tipos';
import {
  agruparErgogenicos,
  CATEGORIAS_ERGOGENICO,
  filtrarErgogenicos,
  nomeEPrincipio,
  resumoDoGrupo,
  rotuloDaCategoria,
  textoOuTraco,
} from './ergogenicos';

const e = (nome: string, categoria: CategoriaErgogenico, extra: Partial<ErgogenicoDaBiblioteca> = {}): ErgogenicoDaBiblioteca => ({
  id: nome, categoria, nome, principioAtivo: null, concentracao: null, apresentacao: null, observacao: null, ...extra,
});

describe('categorias', () => {
  it('ordem da lista: injetáveis, orais, peptídeos, medicamentos, outros', () => {
    expect(CATEGORIAS_ERGOGENICO.map((c) => c.rotulo)).toEqual(['Injetáveis', 'Orais', 'Peptídeos', 'Medicamentos', 'Outros']);
    expect(rotuloDaCategoria('PEPTIDEO')).toBe('Peptídeos');
  });

  it('agrupa na ordem fixa, sem grupo vazio, mantendo a ordem de dentro', () => {
    const grupos = agruparErgogenicos([e('Item B', 'OUTRO'), e('Item C', 'INJETAVEL'), e('Item A', 'OUTRO'), e('Item D', 'ORAL')]);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Injetáveis', 'Orais', 'Outros']);
    expect(grupos[2].itens.map((i) => i.nome)).toEqual(['Item B', 'Item A']);
    expect(agruparErgogenicos([])).toEqual([]);
  });

  it('resumo do grupo', () => {
    expect(resumoDoGrupo(1)).toBe('1 item');
    expect(resumoDoGrupo(13)).toBe('13 itens');
  });
});

describe('textos da linha', () => {
  it('o que faltar é "—"', () => {
    expect(textoOuTraco('200 mg/ml')).toBe('200 mg/ml');
    expect(textoOuTraco(null)).toBe('—');
    expect(textoOuTraco('  ')).toBe('—');
  });

  it('nome com princípio ativo', () => {
    expect(nomeEPrincipio({ nome: 'Item de teste', principioAtivo: 'Princípio de teste' })).toBe('Item de teste / Princípio de teste');
    expect(nomeEPrincipio({ nome: 'Item de teste', principioAtivo: null })).toBe('Item de teste');
    expect(nomeEPrincipio({ nome: 'Item de teste', principioAtivo: ' ' })).toBe('Item de teste');
  });
});

describe('busca', () => {
  const lista = [
    e('Ômega Teste', 'ORAL', { principioAtivo: 'Ácido Teste' }),
    e('Peptídeo Teste', 'PEPTIDEO'),
    e('Outro Teste', 'OUTRO'),
  ];
  it('sem acento, no nome e no princípio ativo', () => {
    expect(filtrarErgogenicos(lista, 'omega', '').map((x) => x.nome)).toEqual(['Ômega Teste']);
    expect(filtrarErgogenicos(lista, 'ACIDO', '').map((x) => x.nome)).toEqual(['Ômega Teste']);
    expect(filtrarErgogenicos(lista, '', '')).toHaveLength(3);
  });
  it('filtra por categoria e junta com a busca', () => {
    expect(filtrarErgogenicos(lista, '', 'PEPTIDEO').map((x) => x.nome)).toEqual(['Peptídeo Teste']);
    expect(filtrarErgogenicos(lista, 'omega', 'PEPTIDEO')).toEqual([]);
  });
});
