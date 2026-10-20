-- Pagamentos do aluno ao treinador (Fase 1 e Fase 1B, 20/10): planos comerciais, contratações, cobranças e lançamentos
-- avulsos. Sem compatibilidade: ainda não há cliente real. Dinheiro é sempre bigint em centavos, maior que zero.
-- Observação e motivos são texto livre do treinador sobre o aluno: saem na anonimização (PagamentosDoAluno), nunca em log.
-- O módulo nasce desligado (TREINOS_PAGAMENTOS_HABILITADO). As permissões FINANCEIRO_LER e FINANCEIRO_ALTERAR não têm
-- migration: só o Administrador (acesso total) as recebe; os outros perfis padrão ficam sem.

-- 1. Chave para as FKs compostas (consultoria_id, aluno_id): o aluno de uma consultoria nunca é ligado a dado de outra.
ALTER TABLE aluno ADD CONSTRAINT aluno_consultoria_id_id_key UNIQUE (consultoria_id, id);

-- 2. Plano comercial: o que o treinador vende (não é o plano de treino nem o plano da Central). Nome único entre os ativos.
CREATE TABLE plano_comercial (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    nome           varchar(80) NOT NULL CONSTRAINT ck_plano_comercial_nome CHECK (btrim(nome) <> ''),
    valor_centavos bigint NOT NULL CONSTRAINT ck_plano_comercial_valor CHECK (valor_centavos > 0),
    periodicidade  varchar(14) NOT NULL CONSTRAINT ck_plano_comercial_periodicidade
        CHECK (periodicidade IN ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PARCELA_UNICA')),
    aceita_pix     boolean NOT NULL DEFAULT true,
    aceita_boleto  boolean NOT NULL DEFAULT false,
    aceita_cartao  boolean NOT NULL DEFAULT true,
    aceita_manual  boolean NOT NULL DEFAULT true,
    max_parcelas   integer NOT NULL DEFAULT 1 CONSTRAINT ck_plano_comercial_parcelas CHECK (max_parcelas BETWEEN 1 AND 12),
    taxa_cartao    varchar(10) NOT NULL DEFAULT 'TREINADOR' CONSTRAINT ck_plano_comercial_taxa CHECK (taxa_cartao IN ('ALUNO', 'TREINADOR')),
    arquivado_em   timestamptz,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT plano_comercial_consultoria_id_id_key UNIQUE (consultoria_id, id)
);
CREATE UNIQUE INDEX ux_plano_comercial_nome ON plano_comercial (consultoria_id, lower(nome)) WHERE arquivado_em IS NULL;

-- 3. Contratação: o plano contratado por um aluno. A periodicidade é copiada do plano (editar o plano depois não muda a
--    conta das competências de quem já contratou). "ancora" é o dia de onde as competências são contadas (início + n·k
--    meses, sempre a partir dele, nunca encadeando datas); a retomada de uma pausa a recoloca no dia da retomada.
--    Uma contratação vigente (ATIVA ou PAUSADA) por aluno.
CREATE TABLE contratacao_aluno (
    id                 uuid PRIMARY KEY,
    consultoria_id     uuid NOT NULL REFERENCES consultoria (id),
    aluno_id           uuid NOT NULL,
    plano_comercial_id uuid NOT NULL,
    periodicidade      varchar(14) NOT NULL CONSTRAINT ck_contratacao_periodicidade
        CHECK (periodicidade IN ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PARCELA_UNICA')),
    valor_centavos     bigint NOT NULL CONSTRAINT ck_contratacao_valor CHECK (valor_centavos > 0),
    motivo_valor       varchar(200),
    inicio             date NOT NULL,
    ancora             date NOT NULL,
    dia_vencimento     integer NOT NULL CONSTRAINT ck_contratacao_dia CHECK (dia_vencimento BETWEEN 1 AND 31),
    situacao           varchar(10) NOT NULL CONSTRAINT ck_contratacao_situacao CHECK (situacao IN ('ATIVA', 'PAUSADA', 'ENCERRADA')),
    encerrada_em       timestamptz,
    criado_em          timestamptz NOT NULL DEFAULT now(),
    versao             bigint NOT NULL DEFAULT 0,
    CONSTRAINT contratacao_aluno_consultoria_id_id_aluno_key UNIQUE (consultoria_id, id, aluno_id),
    CONSTRAINT fk_contratacao_aluno FOREIGN KEY (consultoria_id, aluno_id) REFERENCES aluno (consultoria_id, id),
    CONSTRAINT fk_contratacao_plano FOREIGN KEY (consultoria_id, plano_comercial_id)
        REFERENCES plano_comercial (consultoria_id, id),
    CONSTRAINT ck_contratacao_encerrada CHECK ((situacao = 'ENCERRADA') = (encerrada_em IS NOT NULL))
);
CREATE UNIQUE INDEX ux_contratacao_vigente ON contratacao_aluno (consultoria_id, aluno_id) WHERE situacao IN ('ATIVA', 'PAUSADA');
CREATE INDEX ix_contratacao_aluno ON contratacao_aluno (consultoria_id, aluno_id, criado_em DESC);
CREATE INDEX ix_contratacao_plano ON contratacao_aluno (consultoria_id, plano_comercial_id);

-- 4. Cobrança: uma por competência (início do período) da contratação. VENCIDA não é gravada: é ABERTA com vencimento
--    anterior a hoje (Brasília), calculada na leitura. "provedor" é MANUAL na Fase 1; (consultoria, provedor, id_externo)
--    é único (o NSU de um provedor é por vendedor). A unicidade (contratação, competência) é só a rede de segurança: a
--    geração confere antes de inserir e nunca depende de capturar a violação.
CREATE TABLE cobranca_aluno (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    contratacao_id uuid NOT NULL,
    aluno_id       uuid NOT NULL,
    competencia    date NOT NULL,
    valor_centavos bigint NOT NULL CONSTRAINT ck_cobranca_valor CHECK (valor_centavos > 0),
    vencimento     date NOT NULL,
    situacao       varchar(10) NOT NULL CONSTRAINT ck_cobranca_situacao
        CHECK (situacao IN ('ABERTA', 'PAGA', 'CANCELADA', 'ESTORNADA', 'CONTESTADA')),
    forma          varchar(15) CONSTRAINT ck_cobranca_forma
        CHECK (forma IN ('DINHEIRO', 'PIX_DIRETO', 'TRANSFERENCIA', 'OUTRO', 'PIX', 'BOLETO', 'CARTAO')),
    provedor       varchar(30) NOT NULL DEFAULT 'MANUAL' CONSTRAINT ck_cobranca_provedor CHECK (provedor ~ '^[A-Z0-9_]{1,30}$'),
    id_externo     varchar(100),
    pago_em        date,
    baixa_por      uuid,
    observacao     varchar(300),
    motivo         varchar(300),
    criado_em      timestamptz NOT NULL DEFAULT now(),
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT fk_cobranca_contratacao FOREIGN KEY (consultoria_id, contratacao_id, aluno_id)
        REFERENCES contratacao_aluno (consultoria_id, id, aluno_id),
    CONSTRAINT fk_cobranca_baixa_por FOREIGN KEY (consultoria_id, baixa_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (baixa_por),
    CONSTRAINT ux_cobranca_competencia UNIQUE (consultoria_id, contratacao_id, competencia),
    CONSTRAINT ux_cobranca_id_externo UNIQUE (consultoria_id, provedor, id_externo),
    CONSTRAINT ck_cobranca_paga CHECK (situacao <> 'PAGA' OR (pago_em IS NOT NULL AND forma IS NOT NULL)),
    CONSTRAINT ck_cobranca_aberta CHECK (situacao <> 'ABERTA' OR pago_em IS NULL)
);
CREATE INDEX ix_cobranca_fila ON cobranca_aluno (consultoria_id, situacao, vencimento);
CREATE INDEX ix_cobranca_aluno ON cobranca_aluno (consultoria_id, aluno_id, vencimento DESC);
CREATE INDEX ix_cobranca_contratacao ON cobranca_aluno (consultoria_id, contratacao_id, competencia DESC);
CREATE INDEX ix_cobranca_pago ON cobranca_aluno (consultoria_id, pago_em) WHERE situacao = 'PAGA';

-- 5. Lançamento avulso (entrada ou saída que não vem de cobrança): é da consultoria, sem aluno, e não entra na exportação
--    do aluno. Categoria é texto livre. O recebimento de cobrança NÃO vira lançamento: o painel soma as duas fontes.
CREATE TABLE lancamento_financeiro (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    data           date NOT NULL,
    descricao      varchar(120) NOT NULL CONSTRAINT ck_lancamento_descricao CHECK (btrim(descricao) <> ''),
    valor_centavos bigint NOT NULL CONSTRAINT ck_lancamento_valor CHECK (valor_centavos > 0),
    tipo           varchar(7) NOT NULL CONSTRAINT ck_lancamento_tipo CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    categoria      varchar(60),
    criado_por     uuid,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT fk_lancamento_criado_por FOREIGN KEY (consultoria_id, criado_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (criado_por)
);
CREATE INDEX ix_lancamento_data ON lancamento_financeiro (consultoria_id, data DESC);
