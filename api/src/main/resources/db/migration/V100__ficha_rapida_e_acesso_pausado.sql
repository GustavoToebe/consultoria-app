ALTER TABLE inscricao ADD COLUMN aceita_sem_cobranca boolean NOT NULL DEFAULT false;
ALTER TABLE inscricao ADD CONSTRAINT ck_inscricao_cortesia_so_aceita
    CHECK (NOT aceita_sem_cobranca OR (situacao = 'ACEITA' AND pagamento <> 'CONFIRMADO_MANUAL'));
CREATE INDEX ix_inscricao_pagamento_criada ON inscricao (consultoria_id, pagamento, criada_em);

ALTER TABLE aluno ADD COLUMN acesso_pausado_em timestamptz;
