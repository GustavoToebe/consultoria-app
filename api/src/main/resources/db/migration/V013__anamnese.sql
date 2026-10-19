-- Fase B: anamnese no motor de questionários (19/10). Sem compatibilidade: ainda não há cliente real.

-- 1. Finalidade do questionário. Todos os de hoje são de atualização; o padrão passa a ser um por finalidade.
ALTER TABLE questionario ADD COLUMN finalidade varchar(20) NOT NULL DEFAULT 'ATUALIZACAO'
    CONSTRAINT ck_questionario_finalidade CHECK (finalidade IN ('ATUALIZACAO', 'ANAMNESE'));
DROP INDEX ux_questionario_padrao;
CREATE UNIQUE INDEX ux_questionario_padrao ON questionario (consultoria_id, finalidade) WHERE padrao;

-- 2. Imagens das perguntas e das opções (escala de Bristol, aparelhos...). Pequenas (até 300 KB e 1600 px, PNG ou JPEG
--    regravados sem metadados) e no banco, como a logo: não dependem do bucket das fotos. O conteúdo do questionário
--    referencia a imagem pelo id; a que nenhum rascunho nem versão usa sai ao publicar ou excluir.
CREATE TABLE questionario_imagem (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    tipo           varchar(20) NOT NULL CONSTRAINT ck_questionario_imagem_tipo CHECK (tipo IN ('image/png', 'image/jpeg')),
    bytes          bytea NOT NULL,
    tamanho        integer NOT NULL CHECK (tamanho > 0),
    criada_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT questionario_imagem_consultoria_id_id_key UNIQUE (consultoria_id, id)
);
CREATE INDEX ix_questionario_imagem_consultoria ON questionario_imagem (consultoria_id, criada_em);

-- 3. Anamnese atribuída ao aluno: a versão publicada no momento da atribuição nunca muda depois. Respostas são dado
--    sensível (LGPD): nunca em log. Uma pendente por aluno (o índice parcial é a rede da corrida).
CREATE TABLE anamnese (
    id                     uuid PRIMARY KEY,
    consultoria_id         uuid NOT NULL REFERENCES consultoria (id),
    aluno_id               uuid NOT NULL REFERENCES aluno (id),
    questionario_versao_id uuid NOT NULL,
    situacao               varchar(12) NOT NULL
        CONSTRAINT ck_anamnese_situacao CHECK (situacao IN ('PENDENTE', 'ENVIADA', 'REVISADA', 'DISPENSADA')),
    respostas              jsonb NOT NULL DEFAULT '{}'::jsonb,
    atribuida_por          uuid,
    atribuida_em           timestamptz NOT NULL DEFAULT now(),
    enviada_em             timestamptz,
    revisada_em            timestamptz,
    revisada_por           uuid,
    dispensada_em          timestamptz,
    dispensada_por         uuid,
    dispensa_motivo        varchar(300),
    versao                 bigint NOT NULL DEFAULT 0,
    CONSTRAINT anamnese_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT fk_anamnese_questionario_versao FOREIGN KEY (consultoria_id, questionario_versao_id)
        REFERENCES questionario_versao (consultoria_id, id),
    CONSTRAINT ck_anamnese_enviada CHECK (situacao NOT IN ('ENVIADA', 'REVISADA') OR enviada_em IS NOT NULL),
    CONSTRAINT ck_anamnese_revisada CHECK (situacao <> 'REVISADA' OR revisada_em IS NOT NULL),
    CONSTRAINT ck_anamnese_dispensada CHECK (situacao <> 'DISPENSADA' OR dispensada_em IS NOT NULL)
);
CREATE UNIQUE INDEX ux_anamnese_pendente ON anamnese (consultoria_id, aluno_id) WHERE situacao = 'PENDENTE';
CREATE INDEX ix_anamnese_aluno ON anamnese (consultoria_id, aluno_id, atribuida_em DESC);
CREATE INDEX ix_anamnese_questionario_versao ON anamnese (questionario_versao_id);

-- 4. Fotos: a foto pendente pertence a uma pasta (atualização) ou a uma anamnese. "Pendente" passa a ser
--    pergunta_id nulo (o envio liga a foto à pergunta); na atualização o envio também grava atualizacao_id.
ALTER TABLE atualizacao_foto ALTER COLUMN pasta_id DROP NOT NULL;
ALTER TABLE atualizacao_foto ADD COLUMN anamnese_id uuid REFERENCES anamnese (id);
ALTER TABLE atualizacao_foto DROP CONSTRAINT ck_foto_ligada;
ALTER TABLE atualizacao_foto ADD CONSTRAINT ck_foto_destino CHECK ((pasta_id IS NULL) <> (anamnese_id IS NULL));
ALTER TABLE atualizacao_foto ADD CONSTRAINT ck_foto_ligada CHECK (atualizacao_id IS NULL OR (pergunta_id IS NOT NULL AND pasta_id IS NOT NULL));
DROP INDEX ix_foto_pendente;
CREATE INDEX ix_foto_pendente ON atualizacao_foto (criada_em) WHERE pergunta_id IS NULL AND removida_em IS NULL;
CREATE INDEX ix_foto_anamnese ON atualizacao_foto (anamnese_id) WHERE anamnese_id IS NOT NULL;

-- 5. Permissões da anamnese nos perfis padrão, como as da atualização (Treinador e Nutricionista).
CREATE OR REPLACE FUNCTION public.criar_perfis_padrao(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into perfil(id,consultoria_id,nome,acesso_total,sistema)
 values (md5(cid::text || ':Administrador')::uuid,cid,'Administrador',true,true);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Treinador')::uuid,cid,'Treinador');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Treinador')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR', 'REGISTRO_LER', 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'ANAMNESE_LER', 'ANAMNESE_ALTERAR', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Nutricionista')::uuid,cid,'Nutricionista');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Nutricionista')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_SENSIVEL_LER', 'REGISTRO_LER', 'TREINO_LER', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'ANAMNESE_LER', 'ANAMNESE_ALTERAR', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Assistente')::uuid,cid,'Assistente');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Assistente')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'TREINO_LER', 'DIETA_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'QUESTIONARIO_LER']);
end; $$;

-- Consultorias que já existem: os perfis padrão (pelo id fixo) ganham as duas permissões.
INSERT INTO perfil_permissao (perfil_id, codigo)
SELECT p.id, c.codigo
FROM perfil p
JOIN consultoria k ON p.id IN (md5(k.id::text || ':Treinador')::uuid, md5(k.id::text || ':Nutricionista')::uuid)
CROSS JOIN (VALUES ('ANAMNESE_LER'), ('ANAMNESE_ALTERAR')) AS c (codigo)
ON CONFLICT DO NOTHING;
