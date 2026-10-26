import {
  contarSintomas, duracaoDoCiclo, faixasSobrePontos, faseNaData, fasesNoPeriodo, menstruacaoPrevista, proximaMenstruacaoPrevista,
  semRegistroRecente, temInicioRecente, textoDaContagem, type ConfigDoCiclo, type RegistroDeCiclo,
} from './cicloMenstrual';

const config = (parcial: Partial<ConfigDoCiclo> = {}): ConfigDoCiclo => ({
  duracaoHabitual: null, mostrarFases: true, hoje: '2026-02-10', ...parcial,
});

const regular: RegistroDeCiclo[] = [
  { inicio: '2026-01-01', fim: '2026-01-05' },
  { inicio: '2026-01-29', fim: '2026-02-02' },
];

describe('fase do ciclo', () => {
  it('ciclo regular de 28 dias', () => {
    expect(duracaoDoCiclo(regular, null)).toBe(28);
    expect(faseNaData(regular, config(), '2026-01-03')).toEqual({ fase: 'MENSTRUAL', diaDoCiclo: 3, estimada: false });
    expect(faseNaData(regular, config(), '2026-01-10')).toEqual({ fase: 'FOLICULAR', diaDoCiclo: 10, estimada: true });
    expect(faseNaData(regular, config(), '2026-01-15')).toEqual({ fase: 'OVULATORIA', diaDoCiclo: 15, estimada: true });
    expect(faseNaData(regular, config(), '2026-01-20')).toEqual({ fase: 'LUTEA', diaDoCiclo: 20, estimada: true });
    expect(proximaMenstruacaoPrevista(regular, config({ hoje: '2026-02-10' }))).toBe('2026-02-26');
  });

  it('ciclo de 35 dias', () => {
    const registros = [{ inicio: '2026-01-01', fim: '2026-01-04' }, { inicio: '2026-02-05', fim: '2026-02-08' }];
    expect(duracaoDoCiclo(registros, null)).toBe(35);
    expect(faseNaData(registros, config({ hoje: '2026-02-10' }), '2026-01-22').fase).toBe('OVULATORIA');
  });

  it('ciclo curto inválido de 18 dias fica só com a menstrual', () => {
    const registros = [{ inicio: '2026-01-01', fim: '2026-01-03' }, { inicio: '2026-01-19', fim: '2026-01-21' }];
    expect(faseNaData(registros, config({ hoje: '2026-01-25' }), '2026-01-10')).toEqual({ fase: null, diaDoCiclo: 10, estimada: false });
    expect(faseNaData(registros, config({ hoje: '2026-01-25' }), '2026-01-02').fase).toBe('MENSTRUAL');
  });

  it('menstruação em andamento vai até hoje', () => {
    const registros = [{ inicio: '2026-02-08', fim: null }];
    expect(faseNaData(registros, config({ duracaoHabitual: 28 }), '2026-02-10').fase).toBe('MENSTRUAL');
    expect(faseNaData(registros, config({ duracaoHabitual: 28 }), '2026-02-11').fase).not.toBe('MENSTRUAL');
  });

  it('um só registro, com e sem duração habitual', () => {
    const registros = [{ inicio: '2026-01-01', fim: '2026-01-04' }];
    expect(faseNaData(registros, config({ hoje: '2026-01-20' }), '2026-01-20')).toEqual({ fase: null, diaDoCiclo: 20, estimada: false });
    expect(proximaMenstruacaoPrevista(registros, config({ hoje: '2026-01-20' }))).toBeNull();
    expect(faseNaData(registros, config({ hoje: '2026-01-20', duracaoHabitual: 28 }), '2026-01-20').fase).toBe('LUTEA');
    expect(proximaMenstruacaoPrevista(registros, config({ hoje: '2026-01-20', duracaoHabitual: 28 }))).toBe('2026-01-29');
  });

  it('sem registro recente não prevê', () => {
    const registros = [{ inicio: '2025-12-01', fim: '2025-12-05' }];
    expect(semRegistroRecente(registros, '2026-03-01')).toBe(true);
    expect(proximaMenstruacaoPrevista(registros, config({ hoje: '2026-03-01', duracaoHabitual: 28 }))).toBeNull();
  });

  it('mostrar fases desligado deixa só a menstruação e o dia', () => {
    expect(faseNaData(regular, config({ mostrarFases: false }), '2026-01-20')).toEqual({ fase: null, diaDoCiclo: 20, estimada: false });
    expect(faseNaData(regular, config({ mostrarFases: false }), '2026-01-03').fase).toBe('MENSTRUAL');
  });

  it('vira o ano', () => {
    const registros = [{ inicio: '2025-12-20', fim: '2025-12-24' }, { inicio: '2026-01-17', fim: '2026-01-21' }];
    expect(faseNaData(registros, config({ hoje: '2026-01-22' }), '2026-01-05').fase).toBe('LUTEA');
  });

  it('período que corta o meio de um ciclo', () => {
    const faixas = fasesNoPeriodo(regular, config(), '2026-01-10', '2026-01-20');
    expect(faixas.map((f) => f.fase)).toEqual(['FOLICULAR', 'OVULATORIA', 'LUTEA']);
    expect(faixas[0]).toMatchObject({ de: '2026-01-10', ate: '2026-01-14' });
    expect(faixas[2]).toMatchObject({ de: '2026-01-16', ate: '2026-01-20' });
  });

  it('conta sintomas do período e a previsão da menstruação', () => {
    const contas = contarSintomas([
      { data: '2026-01-02', colica: 'FORTE', sintomas: ['INCHACO'] },
      { data: '2026-01-03', colica: 'FORTE', sintomas: ['INCHACO', 'CANSACO'] },
      { data: '2026-02-01', sintomas: ['CANSACO'] },
    ], '2026-01-01', '2026-01-31');
    expect(textoDaContagem(contas)).toBe('Cólica forte: 2 dias · Inchaço: 2 dias · Cansaço: 1 dia');
    expect(textoDaContagem([])).toBe('Nenhum sintoma registrado');
    expect(menstruacaoPrevista(regular, config())).toEqual({ inicio: '2026-02-26', fim: '2026-03-02' });
    expect(temInicioRecente(regular, '2026-02-10')).toBe(true);
    expect(temInicioRecente(regular, '2026-04-01')).toBe(false);
  });

  it('as faixas do gráfico acompanham a data de cada ponto', () => {
    const pontos = [{ data: '2026-01-03' }, { data: '2026-01-10' }, { data: '2026-01-20' }];
    const definidas = [
      { de: '2026-01-01', ate: '2026-01-05', rotulo: 'Menstrual', tom: '#111111' },
      { de: '2026-01-16', ate: '2026-01-28', rotulo: 'Lútea (estimativa)', tom: '#222222' },
    ];
    expect(faixasSobrePontos(pontos, definidas)).toEqual([
      { de: 0, ate: 0, rotulo: 'Menstrual', tom: '#111111' },
      { de: 2, ate: 2, rotulo: 'Lútea (estimativa)', tom: '#222222' },
    ]);
    expect(faixasSobrePontos([{}], definidas)).toEqual([]);
  });
});
