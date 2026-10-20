import { avisoAoSairComPendencias, descreverNaoEnviados, diasDeMobilidadeNaoEnviados, treinosNaoEnviados } from './treinosNaoEnviados';

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
