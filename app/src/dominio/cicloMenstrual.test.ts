import {
  contarSintomas, DIAS_MAXIMOS_DA_MENSTRUACAO, diaTemMarca, diasDeMenstruacaoRegistrada, duracaoDoCiclo, faixasSobrePontos, faseNaData,
  fasesNoPeriodo, hojeDoCiclo, menstruacaoPrevista, podeTerminarHoje, proximaMenstruacaoPrevista, segmentosDoPeriodo,
  semRegistroRecente, temInicioRecente, textoDaContagem, textoDaLeitura, type ConfigDoCiclo, type RegistroDeCiclo,
} from './cicloMenstrual';
import { hojeIso } from './formatos';

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

  it('menstruação em andamento vai até hoje, no máximo 15 dias depois do início', () => {
    const registros = [{ inicio: '2026-02-08', fim: null }];
    expect(DIAS_MAXIMOS_DA_MENSTRUACAO).toBe(15);
    expect(faseNaData(registros, config({ duracaoHabitual: 28 }), '2026-02-10').fase).toBe('MENSTRUAL');
    expect(faseNaData(registros, config({ duracaoHabitual: 28 }), '2026-02-11').fase).not.toBe('MENSTRUAL');
    // Esquecida aberta: hoje está 40 dias depois e a menstruação não vale para sempre.
    const tarde = config({ duracaoHabitual: 28, hoje: '2026-03-20' });
    expect(faseNaData(registros, tarde, '2026-02-23').fase).toBe('MENSTRUAL');
    expect(faseNaData(registros, tarde, '2026-02-24').fase).not.toBe('MENSTRUAL');
    expect(faseNaData(registros, config({ mostrarFases: false, hoje: '2026-03-20' }), '2026-02-24').fase).toBeNull();
  });

  it('o calendário pinta a menstruação em andamento só até o limite', () => {
    const dias = diasDeMenstruacaoRegistrada([{ inicio: '2026-02-08', fim: null }], '2026-03-20');
    expect(dias.size).toBe(16);
    expect(dias.has('2026-02-23')).toBe(true);
    expect(dias.has('2026-02-24')).toBe(false);
    expect(diasDeMenstruacaoRegistrada([{ inicio: '2026-02-08', fim: null }], '2026-02-10').size).toBe(3);
    expect(diasDeMenstruacaoRegistrada([{ inicio: '2026-02-08', fim: '2026-02-12' }], '2026-03-20').size).toBe(5);
  });

  it('"terminou hoje" só vale enquanto o fim de hoje é aceito pela API', () => {
    const aberto = { id: 'r', inicio: '2026-02-08', fim: null };
    expect(podeTerminarHoje(aberto, '2026-02-08')).toBe(true);
    expect(podeTerminarHoje(aberto, '2026-02-23')).toBe(true);
    expect(podeTerminarHoje(aberto, '2026-02-24')).toBe(false);
    expect(podeTerminarHoje({ ...aberto, fim: '2026-02-12' }, '2026-02-10')).toBe(false);
  });

  it('sem registro recente apaga só a previsão: ciclos passados já fechados mantêm as fases', () => {
    const antigos = [{ inicio: '2025-11-01', fim: '2025-11-05' }, { inicio: '2025-11-29', fim: '2025-12-03' }];
    const hoje = config({ hoje: '2026-03-01' });
    expect(semRegistroRecente(antigos, hoje.hoje)).toBe(true);
    expect(faseNaData(antigos, hoje, '2025-11-03')).toMatchObject({ fase: 'MENSTRUAL', diaDoCiclo: 3 });
    expect(faseNaData(antigos, hoje, '2025-11-10')).toMatchObject({ fase: 'FOLICULAR', estimada: true });
    expect(faseNaData(antigos, hoje, '2025-11-15').fase).toBe('OVULATORIA');
    expect(faseNaData(antigos, hoje, '2025-11-20').fase).toBe('LUTEA');
    expect(fasesNoPeriodo(antigos, hoje, '2025-11-01', '2025-11-28').map((f) => f.fase)).toEqual(['MENSTRUAL', 'FOLICULAR', 'OVULATORIA', 'LUTEA']);
    // O ciclo seguinte ao último registro é previsão: não aparece.
    expect(faseNaData(antigos, hoje, '2025-12-20').fase).toBeNull();
    expect(faseNaData(antigos, hoje, '2025-12-02').fase).toBe('MENSTRUAL');
  });

  it('sem registro recente não mostra "Dia N" do ciclo que não tem como ter acabado', () => {
    const registros = [{ inicio: '2025-12-01', fim: '2025-12-05' }];
    const hoje = config({ hoje: '2026-03-07' });
    const leitura = faseNaData(registros, hoje, hoje.hoje);
    expect(leitura.diaDoCiclo).toBeNull();
    expect(textoDaLeitura(leitura)).toBe('—');
    expect(faseNaData(registros, config({ hoje: '2026-03-07', mostrarFases: false }), '2026-03-07').diaDoCiclo).toBeNull();
    // Os dias da janela de 60 dias seguem contados, e o limite é o mesmo de `semRegistroRecente`.
    expect(faseNaData(registros, hoje, '2025-12-20').diaDoCiclo).toBe(20);
    expect(faseNaData(registros, hoje, '2026-01-30').diaDoCiclo).toBe(61);
    expect(faseNaData(registros, hoje, '2026-01-31').diaDoCiclo).toBeNull();
    // Ciclo passado fechado por um início real continua com o dia.
    const fechado = [{ inicio: '2025-12-01', fim: null }, { inicio: '2026-01-05', fim: null }];
    expect(faseNaData(fechado, hoje, '2025-12-20').diaDoCiclo).toBe(20);
  });

  it('faixa do período: dias sem fase ocupam o lugar deles, e cada fase fica na data certa', () => {
    const faixas = fasesNoPeriodo(regular, config(), '2025-12-25', '2026-01-08');
    expect(segmentosDoPeriodo(faixas, '2025-12-25', '2026-01-08')).toEqual([
      { de: '2025-12-25', ate: '2025-12-31', fase: null, estimada: false, dias: 7 },
      { de: '2026-01-01', ate: '2026-01-05', fase: 'MENSTRUAL', estimada: false, dias: 5 },
      { de: '2026-01-06', ate: '2026-01-08', fase: 'FOLICULAR', estimada: true, dias: 3 },
    ]);
    const meio = [
      { de: '2026-01-03', ate: '2026-01-05', fase: 'MENSTRUAL' as const, estimada: false },
      { de: '2026-01-10', ate: '2026-01-12', fase: 'FOLICULAR' as const, estimada: true },
    ];
    const segmentos = segmentosDoPeriodo(meio, '2026-01-01', '2026-01-14');
    expect(segmentos.map((s) => [s.fase, s.dias])).toEqual([[null, 2], ['MENSTRUAL', 3], [null, 4], ['FOLICULAR', 3], [null, 2]]);
    expect(segmentos.reduce((soma, s) => soma + s.dias, 0)).toBe(14);
    expect(segmentosDoPeriodo([], '2026-01-01', '2026-01-04')).toEqual([{ de: '2026-01-01', ate: '2026-01-04', fase: null, estimada: false, dias: 4 }]);
  });

  describe('"hoje" do ciclo é o de Brasília, não o do aparelho', () => {
    // O `TZ` do processo não vale no Windows, então o aparelho em outro fuso é simulado: um `Date` do mesmo instante cujas
    // leituras "locais" (as que `hojeIso` usa) respondem como num fuso de `deslocamentoHoras` em relação ao UTC.
    class DateNoFuso extends Date {
      constructor(instante: string, private readonly deslocamentoHoras: number) { super(instante); }
      private local(): Date { return new Date(this.getTime() + this.deslocamentoHoras * 3_600_000); }
      getFullYear() { return this.local().getUTCFullYear(); }
      getMonth() { return this.local().getUTCMonth(); }
      getDate() { return this.local().getUTCDate(); }
    }

    it('aparelho em Tóquio (UTC+9), 01:00 UTC: lá já é dia 10, em Brasília ainda é dia 9', () => {
      const aparelho = new DateNoFuso('2026-06-10T01:00:00Z', 9);
      expect(aparelho.getDate()).toBe(10);
      expect(hojeIso(aparelho)).toBe('2026-06-10');
      expect(hojeDoCiclo(aparelho)).toBe('2026-06-09');
    });

    it('aparelho em Los Angeles (UTC−7), 03:00 UTC: lá é dia 9, em Brasília já é dia 10', () => {
      const aparelho = new DateNoFuso('2026-06-10T03:00:00Z', -7);
      expect(aparelho.getDate()).toBe(9);
      expect(hojeIso(aparelho)).toBe('2026-06-09');
      expect(hojeDoCiclo(aparelho)).toBe('2026-06-10');
    });

    it('sem argumento usa o relógio do sistema', () => {
      jest.useFakeTimers({ now: new Date('2026-06-10T02:30:00Z') });
      try {
        expect(hojeDoCiclo()).toBe('2026-06-09');
      } finally {
        jest.useRealTimers();
      }
    });
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

  it('"Sem cólica" não é sintoma: não entra na contagem nem marca o dia', () => {
    const contas = contarSintomas([
      { data: '2026-01-02', colica: 'NENHUMA' },
      { data: '2026-01-03', colica: 'NENHUMA', sintomas: ['INCHACO'] },
      { data: '2026-01-04', colica: 'LEVE' },
    ], '2026-01-01', '2026-01-31');
    expect(textoDaContagem(contas)).toBe('Cólica leve: 1 dia · Inchaço: 1 dia');
    expect(textoDaContagem(contarSintomas([{ data: '2026-01-02', colica: 'NENHUMA' }], '2026-01-01', '2026-01-31'))).toBe('Nenhum sintoma registrado');
    expect(diaTemMarca({ colica: 'NENHUMA' })).toBe(false);
    expect(diaTemMarca({ colica: 'NENHUMA', sintomas: [] })).toBe(false);
    expect(diaTemMarca({ colica: 'NENHUMA', fluxo: 'LEVE' })).toBe(true);
    expect(diaTemMarca({ colica: 'LEVE' })).toBe(true);
    expect(diaTemMarca({ sintomas: ['CANSACO'] })).toBe(true);
    expect(diaTemMarca({ observacao: 'x' })).toBe(true);
    expect(diaTemMarca(undefined)).toBe(false);
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
