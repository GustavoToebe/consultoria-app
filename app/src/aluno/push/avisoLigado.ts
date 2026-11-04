import AsyncStorage from '@react-native-async-storage/async-storage';

import { chaveDasPreferencias, normalizarPreferencias } from '../../dominio/preferencias';

/**
 * Este aluno ligou o "Avisar no celular" neste aparelho? A escolha mora no aparelho, por usuário
 * (`treinos:<usuarioId>:preferencias`). Quem não ligou nunca precisa falar com o Expo (nem para sair da conta). Erro de
 * leitura conta como desligado.
 */
export async function avisoNoCelularLigado(usuarioId: string): Promise<boolean> {
  try {
    const salvo = await AsyncStorage.getItem(chaveDasPreferencias(usuarioId));
    return salvo !== null && normalizarPreferencias(salvo).avisoNoCelular;
  } catch {
    return false;
  }
}
