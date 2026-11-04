import AsyncStorage from '@react-native-async-storage/async-storage';

import { chaveDasPreferencias } from '../../dominio/preferencias';
import { avisoNoCelularLigado } from './avisoLigado';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => AsyncStorage.clear());

describe('avisoNoCelularLigado', () => {
  it('lê a preferência do usuário neste aparelho', async () => {
    await AsyncStorage.setItem(chaveDasPreferencias('ana'), JSON.stringify({ avisoNoCelular: true }));
    await AsyncStorage.setItem(chaveDasPreferencias('bia'), JSON.stringify({ avisoNoCelular: false }));
    expect(await avisoNoCelularLigado('ana')).toBe(true);
    expect(await avisoNoCelularLigado('bia')).toBe(false);
  });

  it('sem preferência salva, texto ilegível ou erro de leitura vale desligado', async () => {
    expect(await avisoNoCelularLigado('ninguem')).toBe(false);
    await AsyncStorage.setItem(chaveDasPreferencias('ana'), '{quebrado');
    expect(await avisoNoCelularLigado('ana')).toBe(false);
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disco'));
    expect(await avisoNoCelularLigado('ana')).toBe(false);
  });
});
