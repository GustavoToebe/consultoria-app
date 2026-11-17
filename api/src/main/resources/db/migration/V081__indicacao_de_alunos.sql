-- Indicação de alunos (plano indicacao-de-alunos, passo 1). Sem prêmio, desconto nem dinheiro: o aluno compartilha o link da
-- inscrição com um código dele e o CRM mostra quem indicou.
--
-- aluno.codigo_indicacao: identificador do link, separado do aluno.id (o id circula em rotas, exportação e auditoria; o link circula
-- em WhatsApp e prints). uuid aleatório por linha (o default volátil é calculado linha a linha, então os alunos que já existem
-- também recebem um) e único por consultoria. Nunca em log, auditoria nem resposta a outro aluno. A anonimização troca o código.
ALTER TABLE aluno ADD COLUMN codigo_indicacao uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX ux_aluno_codigo_indicacao ON aluno (consultoria_id, codigo_indicacao);

-- inscricao.indicado_por_aluno_id: quem indicou, conferido pela API dentro da consultoria do link (nulo quando o código não
-- vale: a inscrição nunca é recusada por isso). O texto livre antigo `indicado_por` continua separado.
-- FK composta com a consultoria (um aluno de outra consultoria não entra) e SET NULL só da coluna do aluno: sem a lista, o SET NULL
-- tentaria anular consultoria_id (NOT NULL). Exige PG 15+ (o projeto usa o 18). A anonimização não apaga a linha do aluno, então
-- zera a coluna por UPDATE explícito (AnonimizacaoRepositorio); o SET NULL cobre só a exclusão física do aluno.
ALTER TABLE inscricao ADD COLUMN indicado_por_aluno_id uuid;

ALTER TABLE inscricao ADD CONSTRAINT fk_inscricao_indicado_por_aluno
    FOREIGN KEY (consultoria_id, indicado_por_aluno_id) REFERENCES aluno (consultoria_id, id)
    ON DELETE SET NULL (indicado_por_aluno_id);

-- Lado da FK que não tem índice sozinho: serve ao UPDATE da anonimização e ao SET NULL da exclusão do aluno.
CREATE INDEX ix_inscricao_indicado_por_aluno ON inscricao (consultoria_id, indicado_por_aluno_id)
    WHERE indicado_por_aluno_id IS NOT NULL;
