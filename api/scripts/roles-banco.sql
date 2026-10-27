-- Papéis separados do banco: quem altera o schema (migrador) não é quem roda a API (app). Banco novo, vazio, só do consultoria-app.
-- Modelo, com os marcadores trocados antes de executar (ver docs/papeis-banco.md):
--   {{banco}}  nome do banco            {{migrador}}  papel das migrations (dono do banco)     {{app}}  papel da API
--   {{senha_migrador}} / {{senha_app}}  senhas geradas fora do git
-- Executar UMA vez, com o superusuário, JÁ CONECTADO ao banco {{banco}} (criado vazio, sem dono definido) e ANTES da primeira subida
-- da API. O migrador passa a ser o dono do banco (e, no Postgres 15+, do schema public) e de todo objeto criado pelo Flyway;
-- a API recebe só dados (SELECT/INSERT/UPDATE/DELETE e sequências). Não há RLS neste banco: o app não tem (nem precisa de) BYPASSRLS.
-- Há uma cópia idêntica neste texto em api/scripts/roles-banco.sql (consultoria-app, testada) e em deploy/postgres/banco-app.sql.modelo (central-api-back, usada na VPS): mantenha as duas iguais.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{{migrador}}') THEN
        CREATE ROLE {{migrador}} LOGIN PASSWORD '{{senha_migrador}}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{{app}}') THEN
        CREATE ROLE {{app}} LOGIN PASSWORD '{{senha_app}}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
END
$$;

-- Banco novo: o dono já nasce certo, sem adoção de objetos.
ALTER DATABASE {{banco}} OWNER TO {{migrador}};
-- Só os dois papéis entram neste banco; o PUBLIC (padrão do Postgres) não.
REVOKE CONNECT ON DATABASE {{banco}} FROM PUBLIC;
GRANT CONNECT ON DATABASE {{banco}} TO {{migrador}}, {{app}};
-- Sessão parada no meio de uma transação ("idle in transaction") cai em 10 min e solta as travas: em 26/10 uma, esquecida
-- num psql, segurou uma migration por horas. Vale para toda sessão nova neste banco, superusuário inclusive.
ALTER DATABASE {{banco}} SET idle_in_transaction_session_timeout = '10min';

-- O módulo de autenticação cria o schema próprio plataforma (o dono do banco pode); a API só usa o public e o plataforma.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO {{migrador}};
GRANT USAGE ON SCHEMA public TO {{app}};

-- Tudo o que o migrador criar no public daqui para frente já nasce acessível ao app, só para dados.
-- O schema plataforma é concedido pelo próprio módulo (plataforma.auth.migracao.papel-app), a cada subida.
ALTER DEFAULT PRIVILEGES FOR ROLE {{migrador}} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {{app}};
ALTER DEFAULT PRIVILEGES FOR ROLE {{migrador}} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {{app}};

-- O histórico do Flyway é só do migrador. O ALTER DEFAULT PRIVILEGES acima daria DML ao app na tabela criada na primeira subida;
-- quem tira esse acesso, sem passo manual, é o callback db/migration/afterMigrate__revogar_historico_do_app.sql (PLATAFORMA_PAPEL_APP).
