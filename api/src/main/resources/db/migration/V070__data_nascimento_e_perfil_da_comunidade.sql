-- Perfil estilo Steam (plano docs/planos/perfil-estilo-steam.md, decisões 2, 6, 7 e 10).

-- A) Data de nascimento do aluno (opcional). Dado pessoal: nunca em log, auditoria nem DTO que outro aluno recebe. A faixa
-- de data de registro (1900 até hoje) é da API (FaixaDeData.REGISTRO); o CHECK só barra o que nunca existiu.
ALTER TABLE aluno ADD COLUMN data_nascimento date;
ALTER TABLE aluno ADD CONSTRAINT ck_aluno_data_nascimento CHECK (data_nascimento IS NULL OR data_nascimento >= DATE '1900-01-01');

-- B) Preferências do perfil na comunidade.
-- perfil_reservado é NULO e SEM DEFAULT de propósito: nulo = "o aluno não escolheu" e vale a regra da idade (menor ou sem data
-- de nascimento nasce reservado). Um NOT NULL DEFAULT false deixaria todo aluno novo visível, inclusive menor.
ALTER TABLE aluno ADD COLUMN perfil_reservado boolean;
ALTER TABLE aluno ADD COLUMN perfil_cor varchar(20);
ALTER TABLE aluno ADD COLUMN perfil_moldura varchar(20);
-- Até 4 tipos de conquista (TipoConquista) separados por vírgula, na ordem escolhida; nulo = nenhum destaque.
ALTER TABLE aluno ADD COLUMN perfil_destaques varchar(200);

-- Decisão 2: os alunos que já existem são todos adultos (palavra do Gustavo em 10/11) e entram visíveis, com a escolha "não
-- reservado" gravada. Só as linhas de hoje: o aluno criado depois nasce com perfil_reservado nulo. Anonimizado fica sem escolha.
UPDATE aluno SET perfil_reservado = false WHERE anonimizado_em IS NULL;

-- C) A data de nascimento passa a ter efeito na anamnese: o envio cria pendência (ou preenche o campo vazio) como nos outros
-- destinos. Link público da inscrição continua sem destino nenhum (o validador só aceita destino na anamnese).
-- NOT VALID (como na V067) = vale para as linhas novas sem rereler as antigas: uma linha antiga fora da lista não derruba a migration.
ALTER TABLE anamnese_pendencia DROP CONSTRAINT IF EXISTS ck_anamnese_pendencia_destino;
ALTER TABLE anamnese_pendencia ADD CONSTRAINT ck_anamnese_pendencia_destino
    CHECK (destino IN ('PESO', 'OBJETIVO', 'CPF', 'TELEFONE', 'ENDERECO', 'SEXO', 'DATA_NASCIMENTO')) NOT VALID;
