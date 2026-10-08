import type { BancoSql, FabricaBanco, ValorSql } from './banco';

/**
 * Só para testes (Jest roda no Node): `BancoSql` sobre o SQLite embutido do Node (`node:sqlite`), para o SQL do
 * repositório rodar num SQLite de verdade. Cada nome é um "arquivo" em memória que sobrevive a fechar e reabrir,
 * como no aparelho. Nunca é importado pelo app.
 */
interface Comando {
  run(...parametros: ValorSql[]): { changes: number | bigint };
  all(...parametros: ValorSql[]): unknown[];
  get(...parametros: ValorSql[]): unknown;
}

interface BancoNode {
  exec(sql: string): void;
  prepare(sql: string): Comando;
  close(): void;
}

function abrirNode(): BancoNode {
  // Módulo nativo do Node 22.5+; o require evita depender dos tipos do @types/node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (caminho: string) => BancoNode };
  return new DatabaseSync(':memory:');
}

function adaptar(db: BancoNode, emTransacao = false): BancoSql {
  return {
    executar: async (sql) => db.exec(sql),
    rodar: async (sql, parametros = []) => ({ alteradas: Number(db.prepare(sql).run(...parametros).changes) }),
    todos: async <T,>(sql: string, parametros: ValorSql[] = []) => db.prepare(sql).all(...parametros) as T[],
    primeiro: async <T,>(sql: string, parametros: ValorSql[] = []) =>
      (db.prepare(sql).get(...parametros) as T | undefined) ?? null,
    transacao: async (tarefa) => {
      if (emTransacao) throw new Error('transação aninhada');
      db.exec('begin immediate');
      try {
        const resultado = await tarefa(adaptar(db, true));
        db.exec('commit');
        return resultado;
      } catch (erro) {
        db.exec('rollback');
        throw erro;
      }
    },
  };
}

export interface FabricaDeTeste extends FabricaBanco {
  /** Bancos que existem no "aparelho". */
  nomes(): string[];
  /** Quantas conexões estão abertas agora. */
  abertas(): number;
  /** Acesso direto, para conferir o que ficou gravado. */
  banco(nome: string): BancoSql;
}

export function fabricaNode(): FabricaDeTeste {
  const arquivos = new Map<string, BancoNode>();
  let abertas = 0;
  const arquivo = (nome: string) => {
    let db = arquivos.get(nome);
    if (!db) {
      db = abrirNode();
      arquivos.set(nome, db);
    }
    return db;
  };
  return {
    async abrir(nome) {
      const db = arquivo(nome);
      abertas++;
      let aberta = true;
      return {
        banco: adaptar(db),
        fechar: async () => {
          if (aberta) abertas--;
          aberta = false;
        },
      };
    },
    async apagar(nome) {
      arquivos.get(nome)?.close();
      arquivos.delete(nome);
    },
    nomes: () => [...arquivos.keys()],
    abertas: () => abertas,
    banco: (nome) => adaptar(arquivo(nome)),
  };
}
