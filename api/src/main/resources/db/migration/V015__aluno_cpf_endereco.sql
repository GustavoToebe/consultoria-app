-- CPF e endereço no cadastro do aluno e novos destinos da anamnese (Fase C). Sem compatibilidade: ainda não há
-- cliente real. O telefone não ganha coluna: continua em usuario.telefone (o aluno só o tem depois de criar o acesso).
--
-- CPF e endereço são dado pessoal (LGPD): atrás de ALUNO_SENSIVEL_LER/ALTERAR, nunca em log nem em auditoria, e apagados
-- pela anonimização. O CPF é gravado formatado (123.456.789-09) e é único por consultoria quando preenchido.
ALTER TABLE aluno
    ADD COLUMN cpf         varchar(14),
    ADD COLUMN cep         varchar(9),
    ADD COLUMN logradouro  varchar(200),
    ADD COLUMN numero      varchar(20),
    ADD COLUMN complemento varchar(100),
    ADD COLUMN bairro      varchar(100),
    ADD COLUMN cidade      varchar(100),
    ADD COLUMN uf          varchar(2);

CREATE UNIQUE INDEX ux_aluno_cpf ON aluno (consultoria_id, cpf) WHERE cpf IS NOT NULL;

-- Destinos que a pergunta da anamnese pode alimentar no cadastro (V014 tinha só PESO e OBJETIVO).
ALTER TABLE anamnese_pendencia DROP CONSTRAINT ck_anamnese_pendencia_destino;
ALTER TABLE anamnese_pendencia ADD CONSTRAINT ck_anamnese_pendencia_destino
    CHECK (destino IN ('PESO', 'OBJETIVO', 'CPF', 'TELEFONE', 'ENDERECO'));
