import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Nome do módulo nativo local `modules/excluir-do-backup` (só iOS). */
export const NOME_DO_MODULO = 'ExcluirDoBackup';

interface ModuloExcluirDoBackup {
  excluir(caminho: string): Promise<boolean>;
}

/**
 * iPhone: tira a pasta (e tudo o que estiver dentro dela) do backup do iCloud, pelo módulo nativo local
 * `modules/excluir-do-backup`. Chamado depois de abrir o banco SQLite do aluno (`Documents/SQLite`) e de criar a pasta das
 * fotos pendentes (`Documents/fotos`), porque o iOS manda `Documents` para o backup e ali há dado sensível (LGPD).
 * Android (`allowBackup: false` no `app.json`), web e app sem o módulo (Expo Go): não faz nada.
 *
 * Nunca lança: devolve se conseguiu marcar. Falha não pode derrubar o app nem o registro do treino.
 */
export async function excluirDoBackup(caminho: string | null | undefined): Promise<boolean> {
  if (Platform.OS !== 'ios' || typeof caminho !== 'string' || caminho.length === 0) {
    return false;
  }
  try {
    const modulo = requireOptionalNativeModule<ModuloExcluirDoBackup>(NOME_DO_MODULO);
    if (!modulo) return false;
    return (await modulo.excluir(caminho)) === true;
  } catch {
    return false;
  }
}
