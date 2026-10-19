import { Platform } from 'react-native';

import { excluirDoBackup, NOME_DO_MODULO } from './excluirDoBackup';

const mockRequerer = jest.fn();

// A fábrica lê `mockRequerer` só na chamada: o jest.mock sobe acima da constante.
jest.mock('expo', () => ({ requireOptionalNativeModule: (nome: string) => mockRequerer(nome) }));

const naPlataforma = (os: typeof Platform.OS) => jest.replaceProperty(Platform, 'OS', os);

const CAMINHO_DO_BANCO = '/var/mobile/Containers/Data/Application/ABC/Documents/SQLite';

describe('excluirDoBackup', () => {
  let excluir: jest.Mock;

  beforeEach(() => {
    naPlataforma('ios');
    excluir = jest.fn().mockResolvedValue(true);
    mockRequerer.mockReset().mockReturnValue({ excluir });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no iPhone, chama o módulo nativo com o caminho certo e devolve o resultado', async () => {
    await expect(excluirDoBackup(CAMINHO_DO_BANCO)).resolves.toBe(true);
    expect(mockRequerer).toHaveBeenCalledWith(NOME_DO_MODULO);
    expect(excluir).toHaveBeenCalledTimes(1);
    expect(excluir).toHaveBeenCalledWith(CAMINHO_DO_BANCO);
  });

  it('devolve false quando o sistema não marcou a pasta', async () => {
    excluir.mockResolvedValue(false);
    await expect(excluirDoBackup(CAMINHO_DO_BANCO)).resolves.toBe(false);
  });

  it.each(['android', 'web'] as const)('em %s não procura nem chama o módulo', async (plataforma) => {
    naPlataforma(plataforma);
    await expect(excluirDoBackup(CAMINHO_DO_BANCO)).resolves.toBe(false);
    expect(mockRequerer).not.toHaveBeenCalled();
    expect(excluir).not.toHaveBeenCalled();
  });

  it('sem o módulo no app (Expo Go, build antiga) não faz nada', async () => {
    mockRequerer.mockReturnValue(null);
    await expect(excluirDoBackup(CAMINHO_DO_BANCO)).resolves.toBe(false);
  });

  it('caminho ausente ou vazio não chega ao módulo', async () => {
    await expect(excluirDoBackup(undefined)).resolves.toBe(false);
    await expect(excluirDoBackup(null)).resolves.toBe(false);
    await expect(excluirDoBackup('')).resolves.toBe(false);
    expect(excluir).not.toHaveBeenCalled();
  });

  it('erro do módulo nunca derruba quem chamou', async () => {
    excluir.mockRejectedValue(new Error('falhou'));
    await expect(excluirDoBackup(CAMINHO_DO_BANCO)).resolves.toBe(false);
    mockRequerer.mockImplementation(() => {
      throw new Error('sem módulo');
    });
    await expect(excluirDoBackup(CAMINHO_DO_BANCO)).resolves.toBe(false);
  });
});
