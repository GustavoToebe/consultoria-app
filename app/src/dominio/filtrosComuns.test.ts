import {
  dataIso, lista, naOrdem, paraBusca, paraSetParams, periodoDigitado, periodoDoEndereco, periodoParaEndereco, rotulos, textoDoPeriodo,
  um, umId, validos,
} from './filtrosComuns';

const OPCOES = [{ valor: 'ATIVO', rotulo: 'Ativos' }, { valor: 'INATIVO', rotulo: 'Inativos' }] as const;

describe('filtros comuns', () => {
  test('lista aceita repetido e vírgula, sem vazios', () => {
    expect(lista(undefined)).toEqual([]);
    expect(lista('a, b,,')).toEqual(['a', 'b']);
    expect(lista(['a', 'b,c'])).toEqual(['a', 'b', 'c']);
  });

  test('validos e um ignoram o desconhecido e a caixa', () => {
    expect(validos('inativo,XYZ,ATIVO,inativo', OPCOES)).toEqual(['INATIVO', 'ATIVO']);
    expect(um('xyz', OPCOES)).toBeNull();
    expect(um('ativo', OPCOES)).toBe('ATIVO');
  });

  test('umId só aceita cara de id', () => {
    expect(umId('../x')).toBeNull();
    expect(umId('u0000000-0000-4000-8000-000000000007')).toBe('u0000000-0000-4000-8000-000000000007');
  });

  test('dataIso recusa data impossível e formato errado', () => {
    expect(dataIso('2026-02-31')).toBeNull();
    expect(dataIso('31/10/2026')).toBeNull();
    expect(dataIso('2026-10-31')).toBe('2026-10-31');
  });

  test('período do endereço: fim antes do início some; com osDois, só o par', () => {
    expect(periodoDoEndereco('2026-10-31', '2026-10-01')).toEqual({ de: null, ate: null });
    expect(periodoDoEndereco('2026-10-01', undefined)).toEqual({ de: '2026-10-01', ate: null });
    expect(periodoDoEndereco('2026-10-01', undefined, true)).toEqual({ de: null, ate: null });
    expect(periodoDoEndereco('2026-10-01', '2026-10-31', true)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(periodoDoEndereco('2024-12-31', '2026-01-01', true, 366)).toEqual({ de: null, ate: null });
  });

  test('texto e endereço do período', () => {
    expect(textoDoPeriodo({ de: '2026-10-01', ate: '2026-10-31' })).toBe('01/10/2026 a 31/10/2026');
    expect(textoDoPeriodo({ de: '2026-10-01', ate: '2026-10-01' })).toBe('01/10/2026');
    expect(textoDoPeriodo({ de: '2026-10-01', ate: null })).toBe('a partir de 01/10/2026');
    expect(textoDoPeriodo({ de: null, ate: '2026-10-31' })).toBe('até 31/10/2026');
    expect(periodoParaEndereco({ de: null, ate: '2026-10-31' })).toEqual({ ate: '2026-10-31' });
  });

  test('período digitado: só aplica quando faz sentido', () => {
    expect(periodoDigitado(undefined, null)).toEqual({ problema: 'data' });
    expect(periodoDigitado('2026-10-31', '2026-10-01')).toEqual({ problema: 'ordem' });
    expect(periodoDigitado('2026-10-01', null, true)).toEqual({ problema: 'par' });
    expect(periodoDigitado(null, null, true)).toEqual({ periodo: { de: null, ate: null } });
    expect(periodoDigitado('2026-10-01', null)).toEqual({ periodo: { de: '2026-10-01', ate: null } });
    expect(periodoDigitado('2024-12-31', '2026-01-01', true, 366)).toEqual({ problema: 'longo' });
    expect(periodoDigitado('2025-01-01', '2026-01-01', true, 366)).toEqual({ periodo: { de: '2025-01-01', ate: '2026-01-01' } });
  });

  test('rótulos, ordem, busca e setParams', () => {
    expect(rotulos(['INATIVO', 'ATIVO'], OPCOES)).toBe('Ativos, Inativos');
    expect(naOrdem(new Set(['INATIVO', 'X', 'ATIVO']), OPCOES)).toEqual(['ATIVO', 'INATIVO']);
    expect(paraBusca('  Ação ')).toBe('acao');
    expect(paraSetParams(['a', 'b'], { a: '1' })).toEqual({ a: '1', b: undefined });
  });
});
