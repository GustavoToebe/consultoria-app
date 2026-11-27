-- Sugestão de planos comerciais na inscrição pública (link completo e ficha rápida). Número provisório: a main pode ter
-- chegado antes; renumerar no merge e acertar as contagens dos testes de migration.
-- 1) `questionario.mostrar_preco_dos_planos`: opção do link (a configuração de inscrição mora no questionário, uma por link),
--    DESLIGADA por padrão: o preço só vai à página pública se a consultoria ligar.
-- 2) `inscricao.plano_comercial_id`: plano comercial que a pessoa escolheu na página (nulo = não escolheu, ou escreveu "Outro").
--    FK composta (a inscrição nunca aponta para plano de outra consultoria); apagar o plano só limpa a coluna (SET NULL da
--    lista de colunas: sem ela, o SET NULL tentaria anular `consultoria_id`, que é NOT NULL). PG 15+ (o projeto usa o 18).
ALTER TABLE questionario ADD COLUMN mostrar_preco_dos_planos boolean NOT NULL DEFAULT false;

ALTER TABLE inscricao ADD COLUMN plano_comercial_id uuid;

ALTER TABLE inscricao ADD CONSTRAINT fk_inscricao_plano_comercial
    FOREIGN KEY (consultoria_id, plano_comercial_id) REFERENCES plano_comercial (consultoria_id, id)
    ON DELETE SET NULL (plano_comercial_id);

-- O SET NULL da FK ao apagar o plano (só as inscrições que escolheram um entram no índice).
CREATE INDEX ix_inscricao_plano_comercial ON inscricao (consultoria_id, plano_comercial_id) WHERE plano_comercial_id IS NOT NULL;
