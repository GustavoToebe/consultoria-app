import { apagarDadosDaSessaoLocal, type MotivoDoEncerramento } from './encerrarSessaoLocal';

function montar(usuarioId: string | undefined, limpezas: ((id: string, motivo: MotivoDoEncerramento) => Promise<void>)[] = [], motivo: MotivoDoEncerramento = 'sair') {
  const ordem: string[] = [];
  const dependencias = {
    usuarioId,
    motivo,
    limparSessaoLocal: jest.fn(async () => {
      ordem.push('sessao');
    }),
    removerPerfilSalvo: jest.fn(async () => {
      ordem.push('perfil');
    }),
    limpezas: new Set(limpezas),
  };
  return { ordem, dependencias };
}

describe('apagarDadosDaSessaoLocal', () => {
  it('apaga credenciais, perfil salvo e roda as limpezas com o id de quem saiu', async () => {
    const { ordem, dependencias } = montar('u1');
    const limpeza = jest.fn(async (id: string) => {
      ordem.push(`limpeza:${id}`);
    });
    dependencias.limpezas.add(limpeza);
    await apagarDadosDaSessaoLocal(dependencias);
    expect(ordem).toEqual(['sessao', 'perfil', 'limpeza:u1']);
  });

  it('diz às limpezas se foi "Sair" ou sessão recusada pelo servidor', async () => {
    const limpeza = jest.fn(async () => undefined);
    await apagarDadosDaSessaoLocal(montar('u1', [limpeza], 'recusada').dependencias);
    await apagarDadosDaSessaoLocal(montar('u1', [limpeza], 'sair').dependencias);
    expect(limpeza.mock.calls).toEqual([['u1', 'recusada'], ['u1', 'sair']]);
  });

  it('uma limpeza que falha não impede as outras nem o resto', async () => {
    const segunda = jest.fn(async () => undefined);
    const { dependencias } = montar('u1', [() => Promise.reject(new Error('falhou')), segunda]);
    await expect(apagarDadosDaSessaoLocal(dependencias)).resolves.toBeUndefined();
    expect(segunda).toHaveBeenCalledWith('u1', 'sair');
  });

  it('falha ao remover o perfil salvo não impede as limpezas', async () => {
    const limpeza = jest.fn(async () => undefined);
    const { dependencias } = montar('u1', [limpeza]);
    dependencias.removerPerfilSalvo.mockRejectedValueOnce(new Error('falhou'));
    await apagarDadosDaSessaoLocal(dependencias);
    expect(limpeza).toHaveBeenCalledWith('u1', 'sair');
  });

  it('sem usuário (sessão que não chegou a abrir) só apaga credenciais e perfil', async () => {
    const limpeza = jest.fn(async () => undefined);
    const { ordem, dependencias } = montar(undefined, [limpeza]);
    await apagarDadosDaSessaoLocal(dependencias);
    expect(ordem).toEqual(['sessao', 'perfil']);
    expect(limpeza).not.toHaveBeenCalled();
  });

  it('falha em limpar as credenciais propaga e não segue adiante', async () => {
    const { dependencias } = montar('u1');
    dependencias.limparSessaoLocal.mockRejectedValueOnce(new Error('falhou'));
    await expect(apagarDadosDaSessaoLocal(dependencias)).rejects.toThrow('falhou');
    expect(dependencias.removerPerfilSalvo).not.toHaveBeenCalled();
  });
});
