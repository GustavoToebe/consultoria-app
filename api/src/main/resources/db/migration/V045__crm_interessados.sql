-- CRM de interessados (29/10, docs/planos/interessados-crm.md): motivo de encerramento, reabertura em ciclos, proposta
-- negociada, qualificação e origem da inscrição, relação "mesma pessoa", histórico de eventos, retornos e respostas prontas
-- para o WhatsApp. Tudo da consultoria (FK composta). Inscrições antigas continuam valendo: os campos novos nascem nulos
-- ("Não informado") e o histórico começa com os eventos que dá para reconstruir da própria linha.

-- 1. Inscrição
ALTER TABLE inscricao
    ADD COLUMN ciclo                              int NOT NULL DEFAULT 1 CHECK (ciclo >= 1),
    ADD COLUMN motivo_encerramento                varchar(30)
        CHECK (motivo_encerramento IN ('PRECO', 'SEM_RETORNO', 'MOMENTO', 'OUTRO_SERVICO', 'SERVICO_INCOMPATIVEL', 'OUTRO')),
    ADD COLUMN motivo_detalhe                     varchar(300),
    ADD COLUMN encerrada_por                      uuid,
    ADD COLUMN encerrada_em                       timestamptz,
    ADD COLUMN aceita_em                          timestamptz,
    -- Proposta: cópia dos termos (o plano do Financeiro pode mudar ou sumir; a negociação não muda junto). Centavos.
    ADD COLUMN proposta_plano_id                  uuid,
    ADD COLUMN proposta_plano_nome                varchar(120),
    ADD COLUMN proposta_modalidade                varchar(20) CHECK (proposta_modalidade IN ('ONLINE', 'PRESENCIAL', 'HIBRIDO')),
    ADD COLUMN proposta_periodicidade             varchar(20)
        CHECK (proposta_periodicidade IN ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PARCELA_UNICA')),
    ADD COLUMN proposta_valor_referencia_centavos bigint CHECK (proposta_valor_referencia_centavos BETWEEN 0 AND 100000000),
    ADD COLUMN proposta_valor_centavos            bigint CHECK (proposta_valor_centavos BETWEEN 0 AND 100000000),
    ADD COLUMN proposta_condicoes                 varchar(500),
    ADD COLUMN proposta_atualizada_em             timestamptz,
    ADD COLUMN proposta_atualizada_por            uuid,
    -- Qualificação: o que a pessoa respondeu no formulário (nunca muda; a equipe corrige na proposta e na origem).
    ADD COLUMN interesse                          varchar(20) CHECK (interesse IN ('TREINO', 'DIETA', 'TREINO_E_DIETA', 'NAO_SEI')),
    ADD COLUMN modalidade_desejada                varchar(20)
        CHECK (modalidade_desejada IN ('ONLINE', 'PRESENCIAL', 'HIBRIDO', 'NAO_SEI')),
    ADD COLUMN previsao_inicio                    varchar(20) CHECK (previsao_inicio IN ('AGORA', 'ESTE_MES', 'PROXIMO_MES', 'NAO_SEI')),
    -- Origem: a respondida, o parâmetro do link (só [a-z0-9_-]) e a da equipe (começa pela respondida ou pelo link).
    ADD COLUMN origem_informada                   varchar(20) CHECK (origem_informada IN ('INDICACAO', 'INSTAGRAM', 'GOOGLE', 'OUTRA')),
    ADD COLUMN origem_link                        varchar(40) CHECK (origem_link ~ '^[a-z0-9_-]{1,40}$'),
    ADD COLUMN origem                             varchar(20)
        CHECK (origem IN ('INDICACAO', 'INSTAGRAM', 'GOOGLE', 'CAMPANHA', 'OUTRA')),
    -- "Mesma pessoa" confirmada pela equipe: aponta para a inscrição anterior. Nada é juntado nem apagado.
    ADD COLUMN relacionada_a                      uuid,
    -- Busca por nome sem acento (o mesmo cálculo do Buscas.semAcento para as letras do português) e pelos dígitos do
    -- WhatsApp. Colunas geradas: valem também para linhas gravadas fora da API.
    ADD COLUMN nome_busca                         varchar(120) GENERATED ALWAYS AS (lower(regexp_replace(trim(translate(nome,
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g'))) STORED,
    ADD COLUMN whatsapp_digitos                   varchar(20) GENERATED ALWAYS AS (regexp_replace(whatsapp, '\D', '', 'g')) STORED,
    ADD CONSTRAINT fk_inscricao_encerrada_por FOREIGN KEY (consultoria_id, encerrada_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (encerrada_por),
    ADD CONSTRAINT fk_inscricao_proposta_por FOREIGN KEY (consultoria_id, proposta_atualizada_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (proposta_atualizada_por),
    ADD CONSTRAINT fk_inscricao_relacionada FOREIGN KEY (consultoria_id, relacionada_a)
        REFERENCES inscricao (consultoria_id, id) ON DELETE SET NULL (relacionada_a),
    ADD CONSTRAINT ck_inscricao_relacionada_outra CHECK (relacionada_a IS NULL OR relacionada_a <> id),
    ADD CONSTRAINT ck_inscricao_motivo_so_encerrada CHECK (
        (motivo_encerramento IS NULL AND motivo_detalhe IS NULL) OR situacao IN ('RECUSADA', 'DESISTIU'));

-- Datas que dá para saber das inscrições antigas (o motivo fica "Não informado").
UPDATE inscricao SET encerrada_em = atualizada_em WHERE situacao IN ('RECUSADA', 'DESISTIU');
UPDATE inscricao SET aceita_em = atualizada_em WHERE situacao = 'ACEITA';

CREATE INDEX ix_inscricao_nome_busca ON inscricao (consultoria_id, nome_busca);
CREATE INDEX ix_inscricao_whatsapp_digitos ON inscricao (consultoria_id, whatsapp_digitos);
CREATE INDEX ix_inscricao_criada ON inscricao (consultoria_id, criada_em);
CREATE INDEX ix_inscricao_aceita ON inscricao (consultoria_id, aceita_em) WHERE aceita_em IS NOT NULL;

-- 2. Histórico: um evento por mudança (quem, quando, de/para). O detalhe é texto curto da equipe ou resumo fixo da API;
--    nunca o texto de uma mensagem preparada. Sai junto com a inscrição.
CREATE TABLE inscricao_evento (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    inscricao_id   uuid NOT NULL,
    ciclo          int NOT NULL,
    tipo           varchar(30) NOT NULL CHECK (tipo IN ('CRIADA', 'ETAPA', 'RESPONSAVEL', 'PAGAMENTO', 'ENCERRADA', 'REABERTA',
        'ACEITA', 'PROPOSTA', 'MENSAGEM_PREPARADA', 'RETORNO_MARCADO', 'RETORNO_ALTERADO', 'RETORNO_CONCLUIDO',
        'RELACIONADA', 'RELACAO_DESFEITA', 'ORIGEM')),
    de             varchar(40),
    para           varchar(40),
    motivo         varchar(30),
    detalhe        varchar(500),
    autor_id       uuid,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_inscricao_evento_inscricao FOREIGN KEY (consultoria_id, inscricao_id)
        REFERENCES inscricao (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_inscricao_evento_autor FOREIGN KEY (consultoria_id, autor_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (autor_id)
);
CREATE INDEX ix_inscricao_evento ON inscricao_evento (consultoria_id, inscricao_id, criado_em);
CREATE INDEX ix_inscricao_evento_tipo ON inscricao_evento (consultoria_id, tipo, criado_em);

INSERT INTO inscricao_evento (id, consultoria_id, inscricao_id, ciclo, tipo, criado_em)
SELECT gen_random_uuid(), consultoria_id, id, 1, 'CRIADA', criada_em FROM inscricao;
INSERT INTO inscricao_evento (id, consultoria_id, inscricao_id, ciclo, tipo, para, criado_em)
SELECT gen_random_uuid(), consultoria_id, id, 1, 'ENCERRADA', situacao, atualizada_em FROM inscricao
WHERE situacao IN ('RECUSADA', 'DESISTIU');
INSERT INTO inscricao_evento (id, consultoria_id, inscricao_id, ciclo, tipo, para, criado_em)
SELECT gen_random_uuid(), consultoria_id, id, 1, 'ACEITA', 'ACEITA', atualizada_em FROM inscricao WHERE situacao = 'ACEITA';

-- 3. Retornos (próxima ação): data de Brasília, responsável e conclusão. Só na tela; nada de notificação.
CREATE TABLE inscricao_retorno (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    inscricao_id   uuid NOT NULL,
    descricao      varchar(200) NOT NULL,
    data           date NOT NULL,
    responsavel_id uuid,
    concluido_em   timestamptz,
    concluido_por  uuid,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    criado_por     uuid,
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT inscricao_retorno_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT fk_inscricao_retorno_inscricao FOREIGN KEY (consultoria_id, inscricao_id)
        REFERENCES inscricao (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_inscricao_retorno_responsavel FOREIGN KEY (consultoria_id, responsavel_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (responsavel_id),
    CONSTRAINT fk_inscricao_retorno_concluido_por FOREIGN KEY (consultoria_id, concluido_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (concluido_por),
    CONSTRAINT fk_inscricao_retorno_criado_por FOREIGN KEY (consultoria_id, criado_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (criado_por)
);
CREATE INDEX ix_inscricao_retorno ON inscricao_retorno (consultoria_id, inscricao_id, data);
CREATE INDEX ix_inscricao_retorno_pendente ON inscricao_retorno (consultoria_id, data) WHERE concluido_em IS NULL;

-- 4. Respostas prontas para o WhatsApp, por consultoria. Variáveis {primeiro_nome}, {consultoria} e {plano}, trocadas no
--    app; o texto final nunca volta para a API.
CREATE TABLE inscricao_modelo_mensagem (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    nome           varchar(60) NOT NULL,
    texto          varchar(1000) NOT NULL,
    ordem          int NOT NULL DEFAULT 0 CHECK (ordem BETWEEN 0 AND 999),
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT uq_inscricao_modelo_nome UNIQUE (consultoria_id, nome)
);

CREATE FUNCTION public.criar_modelos_mensagem_inscricao(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into inscricao_modelo_mensagem (id, consultoria_id, nome, texto, ordem)
 select gen_random_uuid(), cid, m.nome, m.texto, m.ordem from (values
   ('Apresentação', 'Oi, {primeiro_nome}! Aqui é da {consultoria}. Recebemos sua inscrição e queremos entender melhor o que você procura. Podemos conversar por aqui?', 1),
   ('Planos', '{primeiro_nome}, pelo que você contou, o plano que combina é o {plano}. Posso explicar como funciona o acompanhamento?', 2),
   ('Retomada', 'Oi, {primeiro_nome}! Passando para saber se você ainda quer começar com a {consultoria}. Se tiver qualquer dúvida, é só me chamar.', 3),
   ('Boas-vindas', 'Que bom ter você com a gente, {primeiro_nome}! Nos próximos passos você recebe o acesso ao app da {consultoria}.', 4)
 ) as m(nome, texto, ordem)
 on conflict do nothing;
end; $$;

CREATE FUNCTION public.consultoria_modelos_mensagem_inscricao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_modelos_mensagem_inscricao(new.id); return new; end; $$;

CREATE TRIGGER consultoria_modelos_mensagem_inscricao AFTER INSERT ON public.consultoria
    FOR EACH ROW EXECUTE FUNCTION public.consultoria_modelos_mensagem_inscricao();

SELECT criar_modelos_mensagem_inscricao(id) FROM consultoria;
