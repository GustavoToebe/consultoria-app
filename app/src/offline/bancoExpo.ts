import * as SQLite from 'expo-sqlite';

import type { BancoSql, ConexaoSql, FabricaBanco } from './banco';
import { excluirDoBackup } from './excluirDoBackup';

/** `BancoSql` sobre o expo-sqlite. Só no celular: na web o repositório é o chave-valor (`abrirRepositorio.web.ts`). */
function adaptar(db: SQLite.SQLiteDatabase): BancoSql {
  return {
    executar: (sql) => db.execAsync(sql),
    rodar: async (sql, parametros = []) => ({ alteradas: (await db.runAsync(sql, parametros)).changes }),
    todos: (sql, parametros = []) => db.getAllAsync(sql, parametros),
    primeiro: (sql, parametros = []) => db.getFirstAsync(sql, parametros),
    transacao: async (tarefa) => {
      let resultado: Awaited<ReturnType<typeof tarefa>> | undefined;
      // Exclusiva: nenhuma outra consulta entra no meio (a comum deixaria, segundo a documentação do expo-sqlite).
      await db.withExclusiveTransactionAsync(async (txn) => {
        resultado = await tarefa(adaptar(txn));
      });
      return resultado as Awaited<ReturnType<typeof tarefa>>;
    },
  };
}

export const fabricaExpo: FabricaBanco = {
  async abrir(nome): Promise<ConexaoSql> {
    const db = await SQLite.openDatabaseAsync(nome);
    // WAL: a transação exclusiva usa outra conexão; leitura e escrita não se bloqueiam.
    await db.execAsync('pragma journal_mode = wal; pragma busy_timeout = 5000;');
    // iPhone: a pasta dos bancos (`Documents/SQLite`, com o `-wal` e o `-shm`) fica fora do backup do iCloud.
    await excluirDoBackup(SQLite.defaultDatabaseDirectory);
    return { banco: adaptar(db), fechar: () => db.closeAsync() };
  },
  async apagar(nome) {
    try {
      await SQLite.deleteDatabaseAsync(nome);
    } catch {
      // Banco que nunca foi criado: nada a apagar.
    }
  },
};
