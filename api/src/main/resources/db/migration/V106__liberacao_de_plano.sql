-- Data de liberação do plano para o aluno e aviso (docs/planos/atualizacao-pasta-e-questionarios.md, bloco E, D1 e D2).
-- `ativo` continua sendo "o plano vigente do aluno" (um por aluno e tipo, índices ux_plano_*_ativo) e `versao_publicada` a última
-- versão que o treinador publicou. A versão que o ALUNO vê passa a ser `versao_liberada` (0 = nenhuma ainda). Publicar sem data
-- liberada na hora (`versao_liberada = versao_publicada`); publicar com data deixa `liberar_em` (dia de Brasília) e o aluno segue
-- na versão anterior (ou no plano anterior, quando o plano agendado é outro: aí ele nem é `ativo` ainda). A rotina diária das
-- 00:05 e o "Liberar agora" avançam `versao_liberada`, ligam `ativo` e zeram `liberar_em`. `avisar_na_liberacao` guarda a escolha
-- "Avisar o aluno" feita na publicação para a rotina. Sem compatibilidade (D6): as linhas existentes ficam liberadas.
ALTER TABLE plano_treino
    ADD COLUMN versao_liberada integer NOT NULL DEFAULT 0,
    ADD COLUMN liberar_em date,
    ADD COLUMN avisar_na_liberacao boolean NOT NULL DEFAULT true;
ALTER TABLE plano_dieta
    ADD COLUMN versao_liberada integer NOT NULL DEFAULT 0,
    ADD COLUMN liberar_em date,
    ADD COLUMN avisar_na_liberacao boolean NOT NULL DEFAULT true;
ALTER TABLE plano_mobilidade
    ADD COLUMN versao_liberada integer NOT NULL DEFAULT 0,
    ADD COLUMN liberar_em date,
    ADD COLUMN avisar_na_liberacao boolean NOT NULL DEFAULT true;

UPDATE plano_treino SET versao_liberada = versao_publicada;
UPDATE plano_dieta SET versao_liberada = versao_publicada;
UPDATE plano_mobilidade SET versao_liberada = versao_publicada;

-- Invariantes: o aluno nunca vê versão que o treinador não publicou, e agendamento só existe com versão pendente (é isto que
-- impede, no banco, a versão futura de ser a visível). NOT VALID + VALIDATE: o padrão do projeto.
ALTER TABLE plano_treino
    ADD CONSTRAINT ck_plano_treino_liberacao CHECK (versao_liberada <= versao_publicada
        AND (liberar_em IS NULL OR versao_liberada < versao_publicada)) NOT VALID;
ALTER TABLE plano_treino VALIDATE CONSTRAINT ck_plano_treino_liberacao;
ALTER TABLE plano_dieta
    ADD CONSTRAINT ck_plano_dieta_liberacao CHECK (versao_liberada <= versao_publicada
        AND (liberar_em IS NULL OR versao_liberada < versao_publicada)) NOT VALID;
ALTER TABLE plano_dieta VALIDATE CONSTRAINT ck_plano_dieta_liberacao;
ALTER TABLE plano_mobilidade
    ADD CONSTRAINT ck_plano_mobilidade_liberacao CHECK (versao_liberada <= versao_publicada
        AND (liberar_em IS NULL OR versao_liberada < versao_publicada)) NOT VALID;
ALTER TABLE plano_mobilidade VALIDATE CONSTRAINT ck_plano_mobilidade_liberacao;

-- A rotina procura, por consultoria, o que venceu: só as linhas agendadas entram no índice.
CREATE INDEX ix_plano_treino_a_liberar ON plano_treino (consultoria_id, liberar_em) WHERE liberar_em IS NOT NULL;
CREATE INDEX ix_plano_dieta_a_liberar ON plano_dieta (consultoria_id, liberar_em) WHERE liberar_em IS NOT NULL;
CREATE INDEX ix_plano_mobilidade_a_liberar ON plano_mobilidade (consultoria_id, liberar_em) WHERE liberar_em IS NOT NULL;

-- Fila do push (V056) com tipo: COMPROMISSO (o que já existia) e PLANO_LIBERADO. No máximo um PENDENTE por usuário E tipo
-- (várias mudanças viram uma notificação só, mas um aviso de plano não esconde o de compromisso). O texto de cada tipo é fixo
-- no código (nunca na fila).
ALTER TABLE push_envio ADD COLUMN tipo varchar(20) NOT NULL DEFAULT 'COMPROMISSO'
    CONSTRAINT ck_push_envio_tipo CHECK (tipo IN ('COMPROMISSO', 'PLANO_LIBERADO'));
DROP INDEX ux_push_envio_pendente;
CREATE UNIQUE INDEX ux_push_envio_pendente ON push_envio (consultoria_id, usuario_id, tipo) WHERE situacao = 'PENDENTE';

-- Aviso dentro do app de que o plano novo está liberado (no padrão de aviso_compromisso, V042): aparece em "Suas pendências"
-- até o aluno marcar como visto. Texto fixo no app, sem dado de pessoa nem do plano; só aluno e datas. Sai com o aluno (CASCADE).
CREATE TABLE aviso_plano_liberado (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    aluno_id       uuid NOT NULL,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    visto_em       timestamptz,
    CONSTRAINT aviso_plano_liberado_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT fk_aviso_plano_liberado_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE
);
-- Os não vistos de um aluno, do mais novo ao mais antigo; e a limpeza por data.
CREATE INDEX ix_aviso_plano_liberado_nao_visto ON aviso_plano_liberado (consultoria_id, aluno_id, criado_em) WHERE visto_em IS NULL;
CREATE INDEX ix_aviso_plano_liberado_criado ON aviso_plano_liberado (consultoria_id, criado_em);
