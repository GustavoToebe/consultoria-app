import type { ErgogenicoDaBiblioteca } from '../api/tipos';
import {
  agruparErgogenicos,
  ergogenicosPreenchidos,
  linhaDeErgogenico,
  categoriasDosErgogenicos,
  detalheDoErgogenico,
  filtrarErgogenicos,
  nomeEPrincipio,
  resumoDoGrupo,
  SEM_CATEGORIA,
  textoOuTraco,
  tituloDoErgogenico,
} from './ergogenicos';

const e = (nome: string, categoria: string | null, extra: Partial<ErgogenicoDaBiblioteca> = {}): ErgogenicoDaBiblioteca => ({
  id: nome, categoria, nome, principioAtivo: null, concentracao: null, apresentacao: null, observacao: null, ...extra,
});

describe('categorias', () => {
  it('são as que o treinador escreveu, sem repetir, em ordem alfabética', () => {
    expect(categoriasDosErgogenicos([e('A', 'Orais'), e('B', 'Injetáveis'), e('C', ' Orais '), e('D', null), e('E', '  ')])).toEqual([
      'Injetáveis',
      'Orais',
    ]);
  });

  it('agrupa por categoria em ordem alfabética, "Sem categoria" por último, mantendo a ordem de dentro', () => {
    const grupos = agruparErgogenicos([e('Item B', 'Outros'), e('Item C', null), e('Item A', 'Outros'), e('Item D', 'Minha categoria')]);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Minha categoria', 'Outros', SEM_CATEGORIA]);
    expect(grupos[1].itens.map((i) => i.nome)).toEqual(['Item B', 'Item A']);
    expect(agruparErgogenicos([])).toEqual([]);
  });

  it('resumo do grupo', () => {
    expect(resumoDoGrupo(1)).toBe('1 item');
    expect(resumoDoGrupo(13)).toBe('13 itens');
  });
});

describe('textos da linha', () => {
  it('escolha da dieta: o que faltar é "—" e o princípio vem depois do nome', () => {
    expect(textoOuTraco('200 mg/ml')).toBe('200 mg/ml');
    expect(textoOuTraco('  ')).toBe('—');
    expect(nomeEPrincipio({ nome: 'Item de teste', principioAtivo: 'Princípio de teste' })).toBe('Item de teste / Princípio de teste');
    expect(nomeEPrincipio({ nome: 'Item de teste', principioAtivo: ' ' })).toBe('Item de teste');
  });

  it('título: o princípio ativo só aparece quando é outro (sem caixa e sem acento)', () => {
    expect(tituloDoErgogenico({ nome: 'Item de teste', principioAtivo: 'Princípio de teste' })).toEqual({ nome: 'Item de teste', principio: 'Princípio de teste' });
    expect(tituloDoErgogenico({ nome: 'Cafeína', principioAtivo: ' CAFEINA ' })).toEqual({ nome: 'Cafeína', principio: null });
    expect(tituloDoErgogenico({ nome: 'Item de teste', principioAtivo: null })).toEqual({ nome: 'Item de teste', principio: null });
    expect(tituloDoErgogenico({ nome: 'Item de teste', principioAtivo: ' ' })).toEqual({ nome: 'Item de teste', principio: null });
  });

  it('detalhe sem rótulos: o vazio some e os dois vazios não dão linha', () => {
    expect(detalheDoErgogenico({ concentracao: '200 mg/ml', apresentacao: '10 ml' })).toBe('200 mg/ml · 10 ml');
    expect(detalheDoErgogenico({ concentracao: ' 200 mg/ml ', apresentacao: null })).toBe('200 mg/ml');
    expect(detalheDoErgogenico({ concentracao: '  ', apresentacao: '50 caps' })).toBe('50 caps');
    expect(detalheDoErgogenico({ concentracao: null, apresentacao: ' ' })).toBeNull();
  });
});

describe('busca', () => {
  const lista = [
    e('Ômega Teste', 'Orais', { principioAtivo: 'Ácido Teste' }),
    e('Peptídeo Teste', 'Peptídeos'),
    e('Outro Teste', null),
  ];
  it('sem acento, no nome e no princípio ativo', () => {
    expect(filtrarErgogenicos(lista, 'omega', '').map((x) => x.nome)).toEqual(['Ômega Teste']);
    expect(filtrarErgogenicos(lista, 'ACIDO', '').map((x) => x.nome)).toEqual(['Ômega Teste']);
    expect(filtrarErgogenicos(lista, '', '')).toHaveLength(3);
  });
  it('filtra por categoria e junta com a busca', () => {
    expect(filtrarErgogenicos(lista, '', 'Peptídeos').map((x) => x.nome)).toEqual(['Peptídeo Teste']);
    expect(filtrarErgogenicos(lista, 'omega', 'Peptídeos')).toEqual([]);
  });
});

describe('linha da dieta', () => {
  it('copia só o que está no rótulo e deixa dose, horário, observação e prescrição vazios', () => {
    expect(linhaDeErgogenico({ nome: 'Item de teste A', principioAtivo: ' Princípio de Teste ', concentracao: '200 mg/ml' }, 'u1')).toEqual({
      uid: 'u1', nome: 'Item de teste A', principioAtivo: 'Princípio de Teste', concentracao: '200 mg/ml',
      dose: '', horario: '', observacao: '', prescricao: '',
    });
  });

  it('rótulo ausente vira texto vazio, nunca valor inventado', () => {
    const l = linhaDeErgogenico({ nome: 'Item de teste B', principioAtivo: null, concentracao: null }, 'u2');
    expect(l.principioAtivo).toBe('');
    expect(l.concentracao).toBe('');
  });
});

describe('linhas preenchidas da dieta', () => {
  const vazia = { uid: 'a', nome: '', principioAtivo: ' ', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '' };
  it('tira só a linha toda em branco', () => {
    expect(ergogenicosPreenchidos([vazia, { ...vazia, uid: 'b', dose: 'Dose de teste' }]).map((e) => e.uid)).toEqual(['b']);
  });
  it('lista nula vira vazia', () => {
    expect(ergogenicosPreenchidos(null)).toEqual([]);
  });
});
