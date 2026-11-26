-- Ficha rápida (Fase 3, docs/planos/ficha-rapida-pos-whatsapp.md): aceite sem cobrança (cortesia) e índice dos indicadores de pagamento.
ALTER TABLE inscricao ADD COLUMN aceita_sem_cobranca boolean NOT NULL DEFAULT false;
ALTER TABLE inscricao ADD CONSTRAINT ck_inscricao_cortesia_so_aceita
    CHECK (NOT aceita_sem_cobranca OR (situacao = 'ACEITA' AND pagamento <> 'CONFIRMADO_MANUAL')) NOT VALID;
ALTER TABLE inscricao VALIDATE CONSTRAINT ck_inscricao_cortesia_so_aceita;
CREATE INDEX ix_inscricao_pagamento_criada ON inscricao (consultoria_id, pagamento, criada_em);

-- Pausa do acesso por atraso (Fase 2, docs/planos/pausar-acesso-por-atraso.md) sobre o "Desativar acesso" da V100: sem coluna
-- nova, é o motivo ATRASO. O CHECK da V100 é refeito com os dois motivos, NOT VALID e depois VALIDATE (o padrão do projeto; na
-- mesma transação do Flyway a trava do ADD vale até o fim, o que a tabela aluno, pequena, aguenta sob o lock_timeout de 60 s).
-- As linhas que já existem (nulas ou MANUAL) continuam válidas.
ALTER TABLE aluno DROP CONSTRAINT ck_aluno_acesso_desativado;
ALTER TABLE aluno ADD CONSTRAINT ck_aluno_acesso_desativado CHECK (
    (acesso_desativado_em IS NULL) = (acesso_desativado_motivo IS NULL)
    AND (acesso_desativado_motivo IS NULL OR acesso_desativado_motivo IN ('MANUAL', 'ATRASO'))) NOT VALID;
ALTER TABLE aluno VALIDATE CONSTRAINT ck_aluno_acesso_desativado;
