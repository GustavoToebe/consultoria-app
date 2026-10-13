/**
 * O mínimo de SQL que o repositório offline usa. No celular é o expo-sqlite (`bancoExpo.ts`); nos testes, o SQLite
 * do próprio Node: o mesmo SQL roda nos dois, então o teste confere o banco de verdade e não um simulado.
 */
export type ValorSql = string | number | null;

export interface BancoSql {
  executar(sql: string): Promise<void>;
  rodar(sql: string, parametros?: ValorSql[]): Promise<{ alteradas: number }>;
  todos<T>(sql: string, parametros?: ValorSql[]): Promise<T[]>;
  primeiro<T>(sql: string, parametros?: ValorSql[]): Promise<T | null>;
  /** Tudo ou nada. Não aninhar: dentro da transação, usar o banco recebido. */
  transacao<T>(tarefa: (banco: BancoSql) => Promise<T>): Promise<T>;
}

export interface ConexaoSql {
  banco: BancoSql;
  fechar(): Promise<void>;
}

/** Abre e apaga bancos pelo nome (um arquivo por usuário no aparelho). */
export interface FabricaBanco {
  abrir(nome: string): Promise<ConexaoSql>;
  apagar(nome: string): Promise<void>;
}

/** Um banco por usuário: trocar de conta não mistura dados, e sair apaga o arquivo inteiro. */
export const nomeDoBanco = (usuarioId: string) => `treinos-${usuarioId}.db`;

const VERSAO_ESQUEMA = 1;

/**
 * Esquema local. `kv` guarda documentos que só são lidos inteiros (pacote do plano, dieta);
 * `registro` é a fila de envio, com a mesma chave única do servidor (versão, série, dia).
 */
const ESQUEMA = `
  create table if not exists kv (
    chave text primary key,
    valor text not null
  );
  create table if not exists registro (
    id text primary key,
    plano_versao_id text not null,
    sessao_uid text not null,
    exercicio_uid text not null,
    serie_uid text not null,
    exercicio_id text,
    trabalho integer not null,
    data text not null,
    carga real,
    repeticoes integer,
    concluida integer not null,
    observacao text,
    alterado_em text not null,
    situacao text not null check (situacao in ('LOCAL', 'ENVIADO', 'FALHOU')),
    motivo text,
    unique (plano_versao_id, serie_uid, data)
  );
  create index if not exists ix_registro_situacao on registro (situacao, alterado_em);
  create table if not exists carga_trabalho (
    exercicio_uid text not null,
    data text not null,
    carga real not null,
    primary key (exercicio_uid, data)
  );
`;

/** Cria o esquema na primeira abertura (marcado no `user_version` do SQLite). */
export async function prepararEsquema(banco: BancoSql): Promise<void> {
  const linha = await banco.primeiro<{ user_version: number }>('pragma user_version');
  if ((linha?.user_version ?? 0) >= VERSAO_ESQUEMA) return;
  await banco.transacao(async (t) => {
    await t.executar(ESQUEMA);
    await t.executar(`pragma user_version = ${VERSAO_ESQUEMA}`);
  });
}
