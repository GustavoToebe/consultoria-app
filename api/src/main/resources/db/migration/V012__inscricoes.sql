-- Inscrição por link e fila de interessados (Fase A, 19/10). Sem compatibilidade: ainda não há cliente real.
-- A inscrição é dado pessoal (nome, WhatsApp, e-mail e o que a pessoa escreveu): nunca em log. Recusada ou desistente é
-- apagada sozinha depois de 180 dias (InscricaoRetencao); aceita vira aluno e segue as regras do aluno.

-- 1. Configuração do link, uma por consultoria (nasce no primeiro "ligar" ou "gerar link"). O código vai no endereço público
--    (não é segredo como o convite), mas é aleatório (144 bits): sem ele não se acha a consultoria. Trocar o código revoga o antigo.
CREATE TABLE inscricao_configuracao (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL UNIQUE REFERENCES consultoria (id),
    aberta         boolean NOT NULL DEFAULT false,
    codigo         varchar(40) NOT NULL UNIQUE CHECK (codigo ~ '^[A-Za-z0-9_-]{24,40}$'),
    responsavel_id uuid,
    texto          varchar(2000),
    atualizada_em  timestamptz NOT NULL DEFAULT now(),
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT fk_inscricao_configuracao_responsavel FOREIGN KEY (consultoria_id, responsavel_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (responsavel_id)
);

-- 2. A inscrição. A consultoria sai do código do link, nunca do corpo. Situação comercial e pagamento (só registro manual)
--    ficam separados; o aceite liga o aluno criado (uma inscrição vira no máximo um aluno).
CREATE TABLE inscricao (
    id                        uuid PRIMARY KEY,
    consultoria_id            uuid NOT NULL REFERENCES consultoria (id),
    responsavel_id            uuid,
    nome                      varchar(120) NOT NULL,
    whatsapp                  varchar(20) NOT NULL,
    email                     varchar(254),
    objetivo                  varchar(500),
    observacao                varchar(1000),
    -- Ciência do texto de privacidade da consultoria: a data e o texto que a pessoa viu (nulos quando não havia texto).
    ciencia_em                timestamptz,
    ciencia_texto             varchar(2000),
    situacao                  varchar(20) NOT NULL DEFAULT 'NOVA'
        CHECK (situacao IN ('NOVA', 'EM_CONTATO', 'EM_NEGOCIACAO', 'ACEITA', 'RECUSADA', 'DESISTIU')),
    pagamento                 varchar(20) NOT NULL DEFAULT 'NAO_CONTROLADO'
        CHECK (pagamento IN ('NAO_CONTROLADO', 'AGUARDANDO', 'CONFIRMADO_MANUAL')),
    pagamento_confirmado_por  uuid,
    pagamento_confirmado_em   timestamptz,
    aluno_id                  uuid UNIQUE REFERENCES aluno (id) ON DELETE SET NULL,
    criada_em                 timestamptz NOT NULL DEFAULT now(),
    atualizada_em             timestamptz NOT NULL DEFAULT now(),
    versao                    bigint NOT NULL DEFAULT 0,
    CONSTRAINT inscricao_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT fk_inscricao_responsavel FOREIGN KEY (consultoria_id, responsavel_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (responsavel_id),
    CONSTRAINT fk_inscricao_pagamento_por FOREIGN KEY (consultoria_id, pagamento_confirmado_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (pagamento_confirmado_por),
    CONSTRAINT ck_inscricao_pagamento_confirmado CHECK (
        (pagamento = 'CONFIRMADO_MANUAL') = (pagamento_confirmado_em IS NOT NULL)),
    CONSTRAINT ck_inscricao_aceita CHECK ((situacao = 'ACEITA') OR (aluno_id IS NULL))
);

-- Fila (situação, mais novas primeiro), "Meus" e a conferência de duplicidade por e-mail e WhatsApp.
CREATE INDEX ix_inscricao_fila ON inscricao (consultoria_id, situacao, criada_em DESC);
CREATE INDEX ix_inscricao_responsavel ON inscricao (consultoria_id, responsavel_id, criada_em DESC);
CREATE INDEX ix_inscricao_email ON inscricao (consultoria_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX ix_inscricao_whatsapp ON inscricao (consultoria_id, whatsapp);
-- Retenção: só recusadas e desistentes saem sozinhas.
CREATE INDEX ix_inscricao_retencao ON inscricao (atualizada_em) WHERE situacao IN ('RECUSADA', 'DESISTIU');
-- Aluno com o mesmo e-mail (aviso de duplicidade e 409 ALUNO_JA_EXISTE no aceite).
CREATE INDEX ix_aluno_email ON aluno (consultoria_id, lower(email)) WHERE email IS NOT NULL;

-- 3. Notas internas da equipe sobre a inscrição (andamento do contato). Saem junto com a inscrição.
CREATE TABLE inscricao_nota (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    inscricao_id   uuid NOT NULL,
    autor_id       uuid,
    texto          varchar(2000) NOT NULL,
    criada_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_inscricao_nota_inscricao FOREIGN KEY (consultoria_id, inscricao_id)
        REFERENCES inscricao (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_inscricao_nota_autor FOREIGN KEY (consultoria_id, autor_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (autor_id)
);

CREATE INDEX ix_inscricao_nota ON inscricao_nota (consultoria_id, inscricao_id, criada_em);

-- 4. Permissões novas nos perfis padrão. O Administrador já tem tudo (acesso total). Treinador e Assistente atendem
--    interessados (o Assistente já cadastra e convida alunos, e a inscrição não tem dado de saúde); a Nutricionista não
--    cadastra alunos e fica sem. Função e gatilho próprios, em vez de reescrever criar_perfis_padrao: o gatilho roda
--    depois do consultoria_perfis_padrao (ordem alfabética dos nomes), quando os perfis já existem.
CREATE FUNCTION public.criar_permissoes_inscricao(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into perfil_permissao(perfil_id,codigo)
 select p.id, c.codigo from perfil p cross join (values ('INSCRICAO_LER'), ('INSCRICAO_ALTERAR')) as c(codigo)
 where p.consultoria_id = cid
   and p.id in (md5(cid::text || ':Treinador')::uuid, md5(cid::text || ':Assistente')::uuid)
 on conflict do nothing;
end; $$;

CREATE FUNCTION public.consultoria_perfis_padrao_inscricao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_permissoes_inscricao(new.id); return new; end; $$;

CREATE TRIGGER consultoria_perfis_padrao_inscricao AFTER INSERT ON public.consultoria
    FOR EACH ROW EXECUTE FUNCTION public.consultoria_perfis_padrao_inscricao();

-- Consultorias que já existem (os perfis padrão que ainda estão lá).
SELECT criar_permissoes_inscricao(id) FROM consultoria;
