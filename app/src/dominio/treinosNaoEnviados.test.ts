import { avisoAoSairComPendencias, descreverNaoEnviados, diasDeAguaNaoEnviados, diasDeMobilidadeNaoEnviados, treinosNaoEnviados } from './treinosNaoEnviados';

const r = (situacao: 'LOCAL' | 'ENVIADO' | 'FALHOU', data: string, sessaoUid: string) => ({ situacao, data, sessaoUid });

describe('treinosNaoEnviados', () => {
  it('conta treinos (dia + sessão), não séries, e ignora o que já foi enviado', () => {
    expect(
      treinosNaoEnviados([
        r('LOCAL', '2026-10-07', 'a'),
        r('LOCAL', '2026-10-07', 'a'),
        r('FALHOU', '2026-10-07', 'a'),
        r('LOCAL', '2026-10-07', 'b'),
        r('LOCAL', '2026-10-08', 'a'),
        r('ENVIADO', '2026-10-09', 'a'),
      ]),
    ).toBe(3);
  });

  it('conclusão não enviada de um dia e sessão sem série pendente também é um treino não enviado', () => {
    expect(treinosNaoEnviados([r('ENVIADO', '2026-10-07', 'a')], [r('LOCAL', '2026-10-07', 'a')])).toBe(1);
    expect(treinosNaoEnviados([], [r('FALHOU', '2026-10-08', 'b')])).toBe(1);
  });

  it('conclusão e série pendentes do mesmo dia e sessão contam um treino só', () => {
    expect(treinosNaoEnviados([r('LOCAL', '2026-10-07', 'a')], [r('LOCAL', '2026-10-07', 'a'), r('LOCAL', '2026-10-07', 'b')])).toBe(2);
  });

  it('conclusão já enviada não conta', () => {
    expect(treinosNaoEnviados([], [r('ENVIADO', '2026-10-07', 'a')])).toBe(0);
  });

  it('sem registros pendentes é zero', () => {
    expect(treinosNaoEnviados([])).toBe(0);
    expect(treinosNaoEnviados([r('ENVIADO', '2026-10-07', 'a')])).toBe(0);
  });
});

describe('avisoAoSairComPendencias', () => {
  it('sem treino pendente não avisa', () => {
    expect(avisoAoSairComPendencias(0)).toBeNull();
  });

  it('concorda no singular e no plural', () => {
    expect(avisoAoSairComPendencias(1)).toBe(
      'Você tem 1 treino ainda não enviado. Sair apaga esse registro. Conecte-se e sincronize antes, se puder.',
    );
    expect(avisoAoSairComPendencias(3)).toBe(
      'Você tem 3 treinos ainda não enviados. Sair apaga esses registros. Conecte-se e sincronize antes, se puder.',
    );
  });
});

describe('mobilidade não enviada', () => {
  const m = (situacao: 'LOCAL' | 'ENVIADO' | 'FALHOU', data: string) => ({ situacao, data });

  it('conta dias, não itens, e ignora o que já foi enviado', () => {
    expect(
      diasDeMobilidadeNaoEnviados([m('LOCAL', '2026-10-07'), m('FALHOU', '2026-10-07'), m('LOCAL', '2026-10-08'), m('ENVIADO', '2026-10-09')]),
    ).toBe(2);
    expect(diasDeMobilidadeNaoEnviados([])).toBe(0);
    expect(diasDeMobilidadeNaoEnviados([m('ENVIADO', '2026-10-07')])).toBe(0);
  });

  it('o aviso fala da mobilidade sozinha e junto com os treinos', () => {
    expect(avisoAoSairComPendencias(0, 1)).toBe(
      'Você tem mobilidade de 1 dia ainda não enviada. Sair apaga esse registro. Conecte-se e sincronize antes, se puder.',
    );
    expect(avisoAoSairComPendencias(0, 3)).toBe(
      'Você tem mobilidade de 3 dias ainda não enviada. Sair apaga esses registros. Conecte-se e sincronize antes, se puder.',
    );
    expect(avisoAoSairComPendencias(2, 1)).toBe(
      'Você tem 2 treinos e mobilidade de 1 dia ainda não enviados. Sair apaga esses registros. Conecte-se e sincronize antes, se puder.',
    );
  });

  it('sem nada pendente não há o que descrever', () => {
    expect(descreverNaoEnviados(0, 0)).toBeNull();
    expect(avisoAoSairComPendencias(0, 0)).toBeNull();
  });
});

describe('água ainda não enviada', () => {
  it('conta dias com água LOCAL ou FALHOU', () => {
    expect(
      diasDeAguaNaoEnviados([
        { situacao: 'LOCAL', data: '2026-10-30' },
        { situacao: 'FALHOU', data: '2026-10-29' },
        { situacao: 'ENVIADO', data: '2026-10-28' },
      ]),
    ).toBe(2);
  });

  it('entra no aviso de sair com a concordância certa', () => {
    expect(avisoAoSairComPendencias(0, 0, 1)).toBe(
      'Você tem água de 1 dia ainda não enviada. Sair apaga esse registro. Conecte-se e sincronize antes, se puder.',
    );
    expect(descreverNaoEnviados(0, 1, 2)).toMatchObject({ texto: 'mobilidade de 1 dia e água de 2 dias', enviado: 'enviadas', ele: 'elas', sera: 'serão apagadas' });
    expect(descreverNaoEnviados(2, 1, 1)).toMatchObject({ texto: '2 treinos, mobilidade de 1 dia e água de 1 dia', enviado: 'enviados' });
    expect(descreverNaoEnviados(1, 0, 1)).toMatchObject({ texto: '1 treino e água de 1 dia', enviado: 'enviados', ele: 'eles' });
  });
});
