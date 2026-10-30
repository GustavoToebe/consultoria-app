import {
  AGUA_MAXIMA_ML,
  coposDe,
  diasDaAgua,
  fundirAgua,
  litrosParaTela,
  maisUmCopo,
  menosUmCopo,
  metaEmMl,
  resumoDosDias,
  textoDaAguaDoDia,
  textoDosCopos,
  ultimosDiasDeAgua,
} from './aguaDoDia';

describe('água do dia', () => {
  it('soma e tira copos de 250 ml sem passar dos limites', () => {
    expect(maisUmCopo(0)).toBe(250);
    expect(maisUmCopo(AGUA_MAXIMA_ML - 100)).toBe(AGUA_MAXIMA_ML);
    expect(menosUmCopo(250)).toBe(0);
    expect(menosUmCopo(100)).toBe(0);
    expect(menosUmCopo(0)).toBe(0);
  });

  it('conta copos cheios e escreve no singular e no plural', () => {
    expect(coposDe(1600)).toBe(6);
    expect(textoDosCopos(0)).toBe('Nenhum copo');
    expect(textoDosCopos(250)).toBe('1 copo');
    expect(textoDosCopos(1500)).toBe('6 copos');
  });

  it('litros com vírgula, uma casa quando basta e duas quando o copo pede', () => {
    expect(litrosParaTela(0)).toBe('0,0 L');
    expect(litrosParaTela(250)).toBe('0,25 L');
    expect(litrosParaTela(500)).toBe('0,5 L');
    expect(litrosParaTela(1500)).toBe('1,5 L');
    expect(litrosParaTela(1750)).toBe('1,75 L');
    expect(litrosParaTela(3000)).toBe('3,0 L');
  });

  it('"1,5 L de 3,0 L"; sem meta só o que tomou; sem registro "—" (nunca zero)', () => {
    expect(textoDaAguaDoDia(1500, 3)).toBe('1,5 L de 3,0 L');
    expect(textoDaAguaDoDia(0, 2.5)).toBe('0,0 L de 2,5 L');
    expect(textoDaAguaDoDia(750, null)).toBe('0,75 L');
    expect(textoDaAguaDoDia(null, 3)).toBe('—');
  });

  it('a meta da dieta em mililitros; sem meta (ou inválida) nada aparece', () => {
    expect(metaEmMl(3)).toBe(3000);
    expect(metaEmMl(2.5)).toBe(2500);
    expect(metaEmMl(null)).toBeNull();
    expect(metaEmMl(undefined)).toBeNull();
    expect(metaEmMl(0)).toBeNull();
    expect(metaEmMl(Number.NaN)).toBeNull();
  });

  it('o aparelho ganha do servidor no mesmo dia; o que falhou não vale', () => {
    const fundida = fundirAgua(
      [
        { data: '2026-10-30', aguaMl: 750, situacao: 'LOCAL' },
        { data: '2026-10-29', aguaMl: 2000, situacao: 'FALHOU' },
        { data: '2026-10-27', aguaMl: 0, situacao: 'ENVIADO' },
      ],
      [
        { data: '2026-10-30', aguaMl: 500 },
        { data: '2026-10-29', aguaMl: 1000 },
        { data: '2026-10-28', aguaMl: 1250 },
      ],
    );
    expect(fundida.get('2026-10-30')).toBe(750);
    expect(fundida.get('2026-10-29')).toBe(1000);
    expect(fundida.get('2026-10-28')).toBe(1250);
    expect(fundida.get('2026-10-27')).toBe(0);
    expect(fundida.has('2026-10-26')).toBe(false);
  });

  it('dias da tela: hoje e os 6 anteriores, do mais antigo ao de hoje (virada de mês)', () => {
    expect(diasDaAgua('2026-11-02')).toEqual([
      '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02',
    ]);
  });

  it('ficha do treinador: do mais novo ao mais antigo, "—" sem registro e o zero conta como registro', () => {
    const dias = ultimosDiasDeAgua(
      [{ data: '2026-10-30', aguaMl: 1500 }, { data: '2026-10-28', aguaMl: 0 }, { data: '2026-10-20', aguaMl: 3000 }],
      '2026-10-30',
    );
    expect(dias.map((d) => d.data)).toEqual([
      '2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27', '2026-10-26', '2026-10-25', '2026-10-24',
    ]);
    expect(dias[0].aguaMl).toBe(1500);
    expect(dias[1].aguaMl).toBeNull();
    expect(dias[2].aguaMl).toBe(0);
    expect(resumoDosDias(dias)).toBe('Registrou 2 de 7 dias');
    expect(resumoDosDias(ultimosDiasDeAgua([], '2026-10-30'))).toBe('Nenhum registro nos últimos 7 dias');
  });
});
