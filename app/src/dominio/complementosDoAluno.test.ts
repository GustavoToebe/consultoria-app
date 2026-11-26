import { agruparPorHorario, espacarUnidades, partesDaDose, SEM_HORARIO_DEFINIDO } from './complementosDoAluno';

const item = (nome: string, horario?: string | null) => ({ nome, horario });
const resumo = (grupos: ReturnType<typeof agruparPorHorario<{ nome: string; horario?: string | null }>>) =>
  grupos.map((g) => [g.rotulo, g.itens.map((i) => i.nome)]);

describe('agruparPorHorario', () => {
  it('texto do treinador: na ordem da primeira aparição, mesmo horário junto, sem horário por último', () => {
    expect(resumo(agruparPorHorario([
      item('a', 'Primeira refeição'), item('b', ''), item('c', 'Última refeição'), item('d', 'primeira  refeição '), item('e', null), item('f'),
    ]))).toEqual([
      ['Primeira refeição', ['a', 'd']],
      ['Última refeição', ['c']],
      [SEM_HORARIO_DEFINIDO, ['b', 'e', 'f']],
    ]);
  });

  it('só horas "HH:MM": em ordem cronológica, "8:00" e "08:00" no mesmo grupo', () => {
    expect(resumo(agruparPorHorario([item('a', '22:00'), item('b', '08:00'), item('c', '12:30'), item('d', '8:00')]))).toEqual([
      ['08:00', ['b', 'd']],
      ['12:30', ['c']],
      ['22:00', ['a']],
    ]);
  });

  it('hora misturada com texto: ordem da primeira aparição', () => {
    expect(resumo(agruparPorHorario([item('a', '22:00'), item('b', 'Ao acordar'), item('c', '08:00')]))).toEqual([
      ['22:00', ['a']], ['Ao acordar', ['b']], ['08:00', ['c']],
    ]);
  });

  it('lista vazia e só sem horário', () => {
    expect(agruparPorHorario([])).toEqual([]);
    expect(resumo(agruparPorHorario([item('a', '  ')]))).toEqual([[SEM_HORARIO_DEFINIDO, ['a']]]);
  });
});

describe('espacarUnidades', () => {
  it('põe espaço entre o número e a unidade', () => {
    expect(espacarUnidades('5mg')).toBe('5 mg');
    expect(espacarUnidades('10.000UI')).toBe('10.000 UI');
    expect(espacarUnidades('1,2g')).toBe('1,2 g');
    expect(espacarUnidades('2caps')).toBe('2 caps');
    expect(espacarUnidades('500µg')).toBe('500 µg');
    expect(espacarUnidades('Vitamina D3 2000UI, 1 cápsula (30g)')).toBe('Vitamina D3 2000 UI, 1 cápsula (30 g)');
    expect(espacarUnidades('5mg/kg')).toBe('5 mg/kg');
  });

  it('não muda o que já está espaçado, palavras sem número nem siglas com número', () => {
    for (const t of ['5 mg', '10.000 UI', 'Meia cápsula', 'D3', 'B12', 'D3K2', 'Ômega-3', '2x ao dia', '3x12', '14h', '14h30', '5%', '']) {
      expect(espacarUnidades(t)).toBe(t);
    }
  });
});

describe('partesDaDose', () => {
  it('número do começo em destaque e o resto ao lado, já espaçado', () => {
    expect(partesDaDose('5mg')).toEqual({ numero: '5', resto: 'mg' });
    expect(partesDaDose(' 10.000UI ')).toEqual({ numero: '10.000', resto: 'UI' });
    expect(partesDaDose('1/2 cápsula')).toEqual({ numero: '1/2', resto: 'cápsula' });
    expect(partesDaDose('1 scoop (30g)')).toEqual({ numero: '1', resto: 'scoop (30 g)' });
    expect(partesDaDose('5')).toEqual({ numero: '5', resto: null });
  });

  it('sem número no começo vai tudo no resto; vazia é nula', () => {
    expect(partesDaDose('Meia cápsula')).toEqual({ numero: null, resto: 'Meia cápsula' });
    expect(partesDaDose('')).toEqual({ numero: null, resto: null });
    expect(partesDaDose(null)).toEqual({ numero: null, resto: null });
    expect(partesDaDose(undefined)).toEqual({ numero: null, resto: null });
  });
});
