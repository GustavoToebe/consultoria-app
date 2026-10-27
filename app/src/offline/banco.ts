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

/**
 * 2: tabela `registro_mobilidade` (item de mobilidade marcado, na mesma fila de envio das séries).
 * 3: colunas `etapas`, `referencia_carga` e `referencia_origem` em `registro` (registro por etapa do Cluster e do
 *    Rest-pause, docs/series-etapas.md).
 */
export const VERSAO_ESQUEMA = 3;

/**
 * Esquema local. `kv` guarda documentos que só são lidos inteiros (pacote do plano, dieta);
 * `registro` é a fila de envio, com a mesma chave única do servidor (versão, série, dia);
 * `registro_mobilidade` é a mesma fila para a mobilidade (versão, item, dia), em tabela própria.
 * Tudo é `create ... if not exists`: subir a versão do esquema é só acrescentar o que falta (banco antigo ganha a
 * tabela nova na próxima abertura, sem perder o que já tinha).
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
    etapas text,
    referencia_carga real,
    referencia_origem text,
    unique (plano_versao_id, serie_uid, data)
  );
  create index if not exists ix_registro_situacao on registro (situacao, alterado_em);
  create table if not exists registro_mobilidade (
    id text primary key,
    plano_versao_id text not null,
    secao_uid text not null,
    item_uid text not null,
    data text not null,
    feito integer not null,
    alterado_em text not null,
    situacao text not null check (situacao in ('LOCAL', 'ENVIADO', 'FALHOU')),
    motivo text,
    unique (plano_versao_id, item_uid, data)
  );
  create index if not exists ix_registro_mobilidade_situacao on registro_mobilidade (situacao, alterado_em);
  create table if not exists carga_trabalho (
    exercicio_uid text not null,
    data text not null,
    carga real not null,
    primary key (exercicio_uid, data)
  );
`;

/** Colunas que entraram depois da criação da tabela: banco antigo as ganha por `alter table`, sem perder linhas. */
const COLUNAS_NOVAS: readonly { tabela: string; coluna: string; tipo: string }[] = [
  { tabela: 'registro', coluna: 'etapas', tipo: 'text' },
  { tabela: 'registro', coluna: 'referencia_carga', tipo: 'real' },
  { tabela: 'registro', coluna: 'referencia_origem', tipo: 'text' },
];

/**
 * Cria o esquema na primeira abertura e acrescenta o que falta num banco antigo (marcado no `user_version` do SQLite).
 * `create ... if not exists` não muda uma tabela que já existe: coluna nova entra por `alter table`, conferida antes.
 */
export async function prepararEsquema(banco: BancoSql): Promise<void> {
  const linha = await banco.primeiro<{ user_version: number }>('pragma user_version');
  if ((linha?.user_version ?? 0) >= VERSAO_ESQUEMA) return;
  await banco.transacao(async (t) => {
    await t.executar(ESQUEMA);
    for (const { tabela, coluna, tipo } of COLUNAS_NOVAS) {
      const existentes = await t.todos<{ name: string }>(`pragma table_info(${tabela})`);
      if (!existentes.some((c) => c.name === coluna)) await t.executar(`alter table ${tabela} add column ${coluna} ${tipo}`);
    }
    await t.executar(`pragma user_version = ${VERSAO_ESQUEMA}`);
  });
}
