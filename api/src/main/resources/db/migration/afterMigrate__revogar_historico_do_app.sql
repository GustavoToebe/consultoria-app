-- Callback do Flyway: roda depois de TODA subida (também quando não há migration nova).
-- O histórico do Flyway é só do migrador. O ALTER DEFAULT PRIVILEGES de scripts/roles-banco.sql dá DML ao papel da API em toda
-- tabela que o migrador cria, inclusive o flyway_schema_history; aqui o acesso é tirado já na primeira subida, sem passo manual.
-- O histórico do módulo de autenticação (plataforma.historico_migracao) não precisa disto: o próprio módulo o deixa de fora dos grants.
-- O papel da API vem de PLATAFORMA_PAPEL_APP (placeholder papelApp). Vazio = nada a fazer (ambiente de um usuário só: testes e dev);
-- no perfil docker a variável é obrigatória, sem valor padrão. Papel informado que não existe falha a subida (melhor do que subir
-- com o histórico aberto). Papel igual ao usuário do Flyway é ignorado: revogar tiraria o acesso do próprio dono.
-- O placeholder entra só como literal entre aspas simples, fora do corpo com dollar-quote; o bloco lê o valor por current_setting.
SELECT set_config('treinos.papel_app', '${papelApp}', false);

DO $revogar$
DECLARE
    papel text := current_setting('treinos.papel_app', true);
BEGIN
    IF papel IS NOT NULL AND papel <> '' AND papel <> current_user AND to_regclass('public.flyway_schema_history') IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON TABLE public.flyway_schema_history FROM %I', papel);
    END IF;
END
$revogar$;

RESET treinos.papel_app;
