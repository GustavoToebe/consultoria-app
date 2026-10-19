-- Fase C da anamnese (19/10): respostas alimentando o perfil do aluno sem recadastro. Sem compatibilidade: ainda não há
-- cliente real.
--
-- A pergunta da anamnese pode ter um destino no cadastro (PESO → registro de peso, OBJETIVO → aluno.objetivo; fica no
-- JSON do questionário, sem coluna). No envio, campo vazio é preenchido (linha já APLICADA com automatica = true: é a
-- origem do dado) e valor igual não muda nada, na mesma transação; valor diferente vira uma alteração PENDENTE para a
-- equipe revisar (aplicar ou descartar). A resposta original continua na anamnese: a linha só guarda o valor proposto
-- (dado sensível, LGPD: nunca em log nem na auditoria) e aponta para ela.
CREATE TABLE anamnese_pendencia (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    anamnese_id    uuid NOT NULL,
    aluno_id       uuid NOT NULL REFERENCES aluno (id),
    destino        varchar(20) NOT NULL CONSTRAINT ck_anamnese_pendencia_destino CHECK (destino IN ('PESO', 'OBJETIVO')),
    pergunta_id    varchar(40) NOT NULL,
    valor          jsonb NOT NULL,
    situacao       varchar(12) NOT NULL DEFAULT 'PENDENTE'
        CONSTRAINT ck_anamnese_pendencia_situacao CHECK (situacao IN ('PENDENTE', 'APLICADA', 'DESCARTADA')),
    automatica     boolean NOT NULL DEFAULT false,
    criada_em      timestamptz NOT NULL DEFAULT now(),
    resolvida_em   timestamptz,
    resolvida_por  uuid,
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT fk_anamnese_pendencia_anamnese FOREIGN KEY (consultoria_id, anamnese_id)
        REFERENCES anamnese (consultoria_id, id),
    CONSTRAINT ck_anamnese_pendencia_resolvida CHECK ((situacao = 'PENDENTE') = (resolvida_em IS NULL)),
    CONSTRAINT ck_anamnese_pendencia_automatica CHECK (NOT automatica OR (situacao = 'APLICADA' AND resolvida_por IS NULL)),
    -- Um destino por questionário: no máximo uma pendência por campo em cada anamnese (rede do reenvio).
    CONSTRAINT ux_anamnese_pendencia_destino UNIQUE (anamnese_id, destino)
);
CREATE INDEX ix_anamnese_pendencia_aluno ON anamnese_pendencia (consultoria_id, aluno_id) WHERE situacao = 'PENDENTE';
