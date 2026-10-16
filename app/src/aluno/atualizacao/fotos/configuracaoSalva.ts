import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ConfiguracaoDeFotos } from '../../../api/tipos';
import { configuracaoDeFotos } from '../../../api/rotas';

/**
 * Última configuração de fotos que o servidor informou (ligado ou não, limites). Só serve para saber, sem internet, se a
 * pergunta de fotos pode ser respondida; não tem dado pessoal e sai do aparelho junto com o resto ao sair da conta.
 */
const chave = (usuarioId: string) => `treinos:${usuarioId}:fotosConfiguracao`;

async function lerSalva(usuarioId: string): Promise<ConfiguracaoDeFotos | null> {
  try {
    const texto = await AsyncStorage.getItem(chave(usuarioId));
    if (!texto) return null;
    const c = JSON.parse(texto) as Partial<ConfiguracaoDeFotos>;
    return typeof c.habilitado === 'boolean' && typeof c.maximoPorPergunta === 'number' ? (c as ConfiguracaoDeFotos) : null;
  } catch {
    return null;
  }
}

/** Com internet pergunta ao servidor (e guarda); sem ela, ou se a pergunta falhar, usa a última guardada (ou `null`). */
export async function buscarConfiguracaoDeFotos(usuarioId: string, online: boolean): Promise<ConfiguracaoDeFotos | null> {
  if (online) {
    try {
      const c = await configuracaoDeFotos();
      await AsyncStorage.setItem(chave(usuarioId), JSON.stringify(c)).catch(() => undefined);
      return c;
    } catch {
      // Cai na última conhecida.
    }
  }
  return lerSalva(usuarioId);
}

export async function esquecerConfiguracaoDeFotos(usuarioId: string): Promise<void> {
  await AsyncStorage.removeItem(chave(usuarioId)).catch(() => undefined);
}
