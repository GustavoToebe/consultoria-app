-- Cardio na biblioteca (docs/planos/cardio-e-hiit.md, D12 a D15). Número provisório: renumerar no merge com a main e
-- acertar as contagens dos testes de migration.
-- 1) `tipo_de_cardio`: tipo do exercício de cardio (nulo = não informado). Só com modalidade CARDIO, por CHECK; a lista é
--    a do enum `Exercicio.TipoDeCardio`. Nada é preenchido em massa: as linhas atuais ficam nulas e passam no CHECK.
-- 2) `cardio_mede_distancia`/`cardio_mede_ritmo`: medidas que o editor mostra. DEFAULT true para o exercício antigo
--    continuar mostrando tudo; DEFAULT constante não reescreve a tabela (PG 11+).
-- A prescrição do treino (modo, protocolo, aquecimento...) mora no jsonb do plano e não precisa de migration.
ALTER TABLE exercicio
    ADD COLUMN tipo_de_cardio varchar(30),
    ADD COLUMN cardio_mede_distancia boolean NOT NULL DEFAULT true,
    ADD COLUMN cardio_mede_ritmo boolean NOT NULL DEFAULT true;

ALTER TABLE exercicio ADD CONSTRAINT ck_exercicio_tipo_de_cardio CHECK (tipo_de_cardio IS NULL OR (modalidade = 'CARDIO'
    AND tipo_de_cardio IN ('ESTEIRA', 'BIKE', 'ELIPTICO', 'ESCADA', 'REMO', 'CORRIDA_AO_AR_LIVRE', 'NATACAO', 'OUTRO')));
