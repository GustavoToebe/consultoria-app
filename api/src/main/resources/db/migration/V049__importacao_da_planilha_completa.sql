-- Importação da planilha completa (fase 1): cada linha criada guarda a importação que a criou, para o "Desfazer"
-- apagar só o que ela criou e continua intocado. Nulo = criado à mão (ou por outro caminho). A importação some pela
-- retenção de um ano (ImportacaoRetencao): a coluna volta a nulo e a linha fica, como qualquer cadastro feito à mão.
-- Não guarda valor nenhum da planilha; só o vínculo.

ALTER TABLE aluno ADD COLUMN importacao_id uuid REFERENCES importacao (id) ON DELETE SET NULL;
ALTER TABLE registro_peso ADD COLUMN importacao_id uuid REFERENCES importacao (id) ON DELETE SET NULL;
ALTER TABLE exercicio ADD COLUMN importacao_id uuid REFERENCES importacao (id) ON DELETE SET NULL;
ALTER TABLE pasta_plano ADD COLUMN importacao_id uuid REFERENCES importacao (id) ON DELETE SET NULL;
ALTER TABLE plano_treino ADD COLUMN importacao_id uuid REFERENCES importacao (id) ON DELETE SET NULL;
ALTER TABLE plano_dieta ADD COLUMN importacao_id uuid REFERENCES importacao (id) ON DELETE SET NULL;

CREATE INDEX ix_aluno_importacao ON aluno (importacao_id) WHERE importacao_id IS NOT NULL;
CREATE INDEX ix_registro_peso_importacao ON registro_peso (importacao_id) WHERE importacao_id IS NOT NULL;
CREATE INDEX ix_exercicio_importacao ON exercicio (importacao_id) WHERE importacao_id IS NOT NULL;
CREATE INDEX ix_pasta_plano_importacao ON pasta_plano (importacao_id) WHERE importacao_id IS NOT NULL;
CREATE INDEX ix_plano_treino_importacao ON plano_treino (importacao_id) WHERE importacao_id IS NOT NULL;
CREATE INDEX ix_plano_dieta_importacao ON plano_dieta (importacao_id) WHERE importacao_id IS NOT NULL;
