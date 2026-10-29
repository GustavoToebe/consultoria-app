import { cancelarLembretesAtualizacao } from '../aluno/atualizacao/lembretes';
import { encerrarLembretesDeCompromisso } from '../aluno/compromissos/lembretes';
import { limparDadosDoAluno } from './limparDadosDoAluno';
import type { RepositorioLocal } from './repositorioLocal';

/** "Sair" e sessão recusada: os lembretes locais (atualização e compromisso) são cancelados, o resto vem das outras camadas. */
jest.mock('../aluno/atualizacao/lembretes', () => ({ cancelarLembretesAtualizacao: jest.fn(() => Promise.resolve()) }));
jest.mock('../aluno/compromissos/lembretes', () => ({ encerrarLembretesDeCompromisso: jest.fn(() => Promise.resolve()) }));
jest.mock('../aluno/atualizacao/fotos/fotosLocais', () => ({ apagarTodasAsFotosLocais: jest.fn(() => Promise.resolve()) }));
jest.mock('../aluno/atualizacao/fotos/configuracaoSalva', () => ({ esquecerConfiguracaoDeFotos: jest.fn(() => Promise.resolve()) }));
jest.mock('./filasRetidas', () => ({ registrarFilaRetida: jest.fn(() => Promise.resolve()) }));
jest.mock('./abrirRepositorio', () => ({ abrirRepositorio: jest.fn() }));

function repositorioFalso() {
  return { apagarTudo: jest.fn(() => Promise.resolve()), reterSoAFila: jest.fn(() => Promise.resolve()), fechar: jest.fn(() => Promise.resolve()) };
}

beforeEach(() => jest.clearAllMocks());

describe('limparDadosDoAluno', () => {
  it.each(['sair', 'recusada'] as const)('cancela os lembretes de compromisso do usuário (%s)', async (motivo) => {
    const repo = repositorioFalso();
    await limparDadosDoAluno('u1', motivo, repo as unknown as RepositorioLocal);
    expect(cancelarLembretesAtualizacao).toHaveBeenCalledWith('u1');
    expect(encerrarLembretesDeCompromisso).toHaveBeenCalledWith('u1');
    expect(motivo === 'sair' ? repo.apagarTudo : repo.reterSoAFila).toHaveBeenCalledTimes(1);
  });

  it('falha ao cancelar os lembretes não impede de apagar o resto', async () => {
    jest.mocked(encerrarLembretesDeCompromisso).mockRejectedValueOnce(new Error('sem notificações'));
    const repo = repositorioFalso();
    await expect(limparDadosDoAluno('u1', 'sair', repo as unknown as RepositorioLocal)).resolves.toBeUndefined();
    expect(repo.apagarTudo).toHaveBeenCalledTimes(1);
  });
});
