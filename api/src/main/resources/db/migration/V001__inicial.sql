-- Schema inicial do consultoria-app: o banco como ele era ao fim das 26 migrations anteriores, numa só.
-- Gerado de um banco migrado (pg_dump --schema-only) e limpo. O catálogo público (V002 e V003) é gerado por
-- scripts/catalogo/ e não se edita à mão.

CREATE FUNCTION public.consultoria_perfis_padrao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_perfis_padrao(new.id); return new; end; $$;

CREATE FUNCTION public.consultoria_questionario_padrao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_questionario_padrao(new.id); return new; end; $$;

CREATE FUNCTION public.criar_perfis_padrao(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into perfil(id,consultoria_id,nome,acesso_total,sistema)
 values (md5(cid::text || ':Administrador')::uuid,cid,'Administrador',true,true);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Treinador')::uuid,cid,'Treinador');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Treinador')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR', 'REGISTRO_LER', 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Nutricionista')::uuid,cid,'Nutricionista');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Nutricionista')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_SENSIVEL_LER', 'REGISTRO_LER', 'TREINO_LER', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Assistente')::uuid,cid,'Assistente');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Assistente')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'TREINO_LER', 'DIETA_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'QUESTIONARIO_LER']);
end; $$;

CREATE FUNCTION public.criar_questionario_padrao(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare modelo jsonb;
begin
 select conteudo into modelo from atualizacao_modelo order by versao desc limit 1;
 insert into questionario(id,consultoria_id,nome,descricao,padrao,rascunho,versao_publicada,publicado_em)
 values (md5(cid::text || ':questionario-padrao')::uuid,cid,'Padrão','Questionário de atualização padrão da consultoria.',true,modelo,1,now());
 insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo)
 values (md5(cid::text || ':questionario-padrao:1')::uuid,cid,md5(cid::text || ':questionario-padrao')::uuid,1,modelo);
end; $$;

CREATE FUNCTION public.questionario_versao_imutavel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin raise exception 'Versão publicada de questionário não pode ser alterada.' using errcode = 'integrity_constraint_violation'; end; $$;

CREATE FUNCTION public.usuario_perfil_inicial() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
 if new.papel='TREINADOR' and new.perfil_id is null then
   new.perfil_id=md5(new.consultoria_id::text || ':Administrador')::uuid;
 end if;
 return new;
end; $$;

CREATE TABLE public.alimento (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    nome character varying(160) NOT NULL,
    base_quantidade numeric(8,2) DEFAULT 100 NOT NULL,
    base_unidade character varying(10) DEFAULT 'g'::character varying NOT NULL,
    kcal numeric(8,2) NOT NULL,
    proteina numeric(8,2) NOT NULL,
    carboidrato numeric(8,2) NOT NULL,
    gordura numeric(8,2) NOT NULL,
    gramas_por_unidade numeric(8,2),
    fonte character varying(200),
    ativo boolean DEFAULT true NOT NULL,
    origem character varying(20) DEFAULT 'MANUAL'::character varying NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    CONSTRAINT alimento_base_unidade_check CHECK (((base_unidade)::text = ANY ((ARRAY['g'::character varying, 'ml'::character varying, 'un'::character varying])::text[]))),
    CONSTRAINT alimento_origem_check CHECK (((origem)::text = ANY ((ARRAY['MANUAL'::character varying, 'CATALOGO'::character varying, 'IMPORTACAO'::character varying])::text[])))
);

CREATE TABLE public.aluno (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    email character varying(254),
    objetivo character varying(200),
    observacoes text,
    ativo boolean DEFAULT true NOT NULL,
    inativado_em timestamp with time zone,
    convite_hash character(64),
    convite_expira_em timestamp with time zone,
    usuario_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    dias_atualizacao integer,
    responsavel_id uuid,
    questionario_id uuid,
    CONSTRAINT aluno_dias_atualizacao_check CHECK (((dias_atualizacao >= 1) AND (dias_atualizacao <= 365)))
);

CREATE TABLE public.atualizacao (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    pasta_id uuid NOT NULL,
    data_atualizacao date NOT NULL,
    estado character varying(20) NOT NULL,
    respostas jsonb DEFAULT '{}'::jsonb NOT NULL,
    enviada_em timestamp with time zone,
    atraso_ate date,
    atraso_motivo character varying(300),
    atraso_avisado_em timestamp with time zone,
    feedback text,
    feedback_em timestamp with time zone,
    feedback_editado_em timestamp with time zone,
    feedback_por uuid,
    feedback_visto_em timestamp with time zone,
    versao bigint DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    questionario_versao_id uuid,
    CONSTRAINT atualizacao_estado_check CHECK (((estado)::text = ANY ((ARRAY['ABERTA'::character varying, 'ENVIADA'::character varying, 'REVISADA'::character varying])::text[]))),
    CONSTRAINT ck_atualizacao_versao_no_envio CHECK ((((estado)::text = 'ABERTA'::text) OR (questionario_versao_id IS NOT NULL)))
);

CREATE TABLE public.atualizacao_modelo (
    id uuid NOT NULL,
    versao integer NOT NULL,
    conteudo jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.auditoria (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    usuario_id uuid,
    acao character varying(60) NOT NULL,
    entidade character varying(40) NOT NULL,
    entidade_id uuid,
    resumo character varying(300) NOT NULL,
    ip character varying(45),
    user_agent character varying(200),
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.catalogo_alimento (
    id uuid NOT NULL,
    nome character varying(160) NOT NULL,
    base_quantidade numeric(8,2) DEFAULT 100 NOT NULL,
    base_unidade character varying(10) DEFAULT 'g'::character varying NOT NULL,
    kcal numeric(8,2) NOT NULL,
    proteina numeric(8,2) NOT NULL,
    carboidrato numeric(8,2) NOT NULL,
    gordura numeric(8,2) NOT NULL,
    gramas_por_unidade numeric(8,2),
    fonte character varying(200) NOT NULL,
    grupo character varying(80),
    codigo_fonte character varying(20),
    tracos character varying(60),
    nome_busca character varying(200) NOT NULL
);

CREATE TABLE public.catalogo_exercicio (
    id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    grupo_muscular character varying(60),
    equipamento character varying(60),
    modalidade character varying(20) NOT NULL,
    instrucoes text,
    fonte character varying(200),
    nome_busca character varying(160) NOT NULL
);

CREATE TABLE public.cobranca_local (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    competencia_inicio date NOT NULL,
    competencia_fim date NOT NULL,
    vencimento date NOT NULL,
    valor numeric(12,2) NOT NULL,
    situacao character varying(10) NOT NULL,
    pago_em date,
    CONSTRAINT cobranca_local_check CHECK ((competencia_fim >= competencia_inicio)),
    CONSTRAINT cobranca_local_situacao_check CHECK (((situacao)::text = ANY ((ARRAY['ABERTA'::character varying, 'PAGA'::character varying, 'CANCELADA'::character varying, 'ISENTA'::character varying])::text[]))),
    CONSTRAINT cobranca_local_valor_check CHECK ((valor >= (0)::numeric))
);

CREATE TABLE public.consultoria (
    id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    slug character varying(60) NOT NULL,
    cor_primaria character varying(7) DEFAULT '#C62828'::character varying NOT NULL,
    fonte_titulo character varying(20) DEFAULT 'PADRAO'::character varying NOT NULL,
    tema_padrao character varying(10) DEFAULT 'ESCURO'::character varying NOT NULL,
    logo bytea,
    logo_tipo character varying(20),
    logo_versao integer DEFAULT 0 NOT NULL,
    configuracao jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    CONSTRAINT consultoria_cor_primaria_check CHECK (((cor_primaria)::text ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT consultoria_fonte_titulo_check CHECK (((fonte_titulo)::text = ANY ((ARRAY['PADRAO'::character varying, 'METAL'::character varying, 'ESPORTIVA'::character varying, 'CONDENSADA'::character varying])::text[]))),
    CONSTRAINT consultoria_logo_tipo_check CHECK (((logo_tipo)::text = ANY ((ARRAY['image/png'::character varying, 'image/jpeg'::character varying])::text[]))),
    CONSTRAINT consultoria_tema_padrao_check CHECK (((tema_padrao)::text = ANY ((ARRAY['ESCURO'::character varying, 'CLARO'::character varying])::text[])))
);

CREATE TABLE public.conta_comercial_local (
    consultoria_id uuid NOT NULL,
    cliente jsonb NOT NULL,
    contratacao jsonb NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.direitos_locais (
    consultoria_id uuid NOT NULL,
    contratacao_id uuid NOT NULL,
    versao bigint NOT NULL,
    situacao character varying(20) NOT NULL,
    acesso_liberado boolean NOT NULL,
    motivo_bloqueio character varying(300),
    vigente_ate date,
    plano_codigo character varying(60) NOT NULL,
    plano_nome character varying(120) NOT NULL,
    limites jsonb DEFAULT '{}'::jsonb NOT NULL,
    funcionalidades text[] DEFAULT '{}'::text[] NOT NULL,
    confirmado_em timestamp with time zone NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT direitos_locais_situacao_check CHECK (((situacao)::text = ANY ((ARRAY['TRIAL'::character varying, 'ATIVA'::character varying, 'INADIMPLENTE'::character varying, 'BLOQUEADA'::character varying, 'CANCELADA'::character varying])::text[])))
);

CREATE TABLE public.ergogenico (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    categoria character varying(20) NOT NULL,
    nome character varying(120) NOT NULL,
    nome_busca character varying(120) NOT NULL,
    principio_ativo character varying(160),
    principio_busca character varying(160) DEFAULT ''::character varying NOT NULL,
    concentracao character varying(40),
    apresentacao character varying(40),
    observacao character varying(500),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    CONSTRAINT ergogenico_categoria_check CHECK (((categoria)::text = ANY ((ARRAY['INJETAVEL'::character varying, 'ORAL'::character varying, 'PEPTIDEO'::character varying, 'MEDICAMENTO'::character varying, 'OUTRO'::character varying])::text[])))
);

CREATE TABLE public.execucao_serie (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    plano_versao_id uuid NOT NULL,
    sessao_uid uuid NOT NULL,
    exercicio_uid uuid NOT NULL,
    serie_uid uuid NOT NULL,
    exercicio_id uuid,
    serie_trabalho boolean DEFAULT false NOT NULL,
    data date NOT NULL,
    carga numeric(7,2),
    unidade character varying(10) DEFAULT 'kg'::character varying NOT NULL,
    repeticoes integer,
    concluida boolean DEFAULT false NOT NULL,
    observacao character varying(500),
    alterado_no_aparelho_em timestamp with time zone NOT NULL,
    recebido_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT execucao_serie_carga_check CHECK (((carga IS NULL) OR ((carga >= (0)::numeric) AND (carga <= (2000)::numeric)))),
    CONSTRAINT execucao_serie_repeticoes_check CHECK (((repeticoes IS NULL) OR ((repeticoes >= 0) AND (repeticoes <= 500))))
);

CREATE TABLE public.exercicio (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    grupo_muscular character varying(60),
    equipamento character varying(60),
    modalidade character varying(20) DEFAULT 'MAQUINA'::character varying NOT NULL,
    video_url character varying(500),
    observacoes text,
    ativo boolean DEFAULT true NOT NULL,
    origem character varying(20) DEFAULT 'MANUAL'::character varying NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    CONSTRAINT exercicio_modalidade_check CHECK (((modalidade)::text = ANY ((ARRAY['LIVRE'::character varying, 'MAQUINA'::character varying, 'ELASTICO'::character varying, 'PESO_CORPORAL'::character varying, 'CARDIO'::character varying, 'OUTRO'::character varying])::text[]))),
    CONSTRAINT exercicio_origem_check CHECK (((origem)::text = ANY ((ARRAY['MANUAL'::character varying, 'CATALOGO'::character varying, 'IMPORTACAO'::character varying])::text[])))
);

CREATE TABLE public.integracao_nonce (
    chave_id character varying(80) NOT NULL,
    nonce character varying(128) NOT NULL,
    recebido_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.integracao_operacao (
    idempotency_key uuid NOT NULL,
    tipo character varying(40) NOT NULL,
    hash_corpo character(64) NOT NULL,
    status_http integer NOT NULL,
    resposta jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.lesao_aluno (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    regiao character varying(80) NOT NULL,
    descricao character varying(500),
    data_inicio date,
    data_fim date,
    situacao character varying(20) NOT NULL,
    observacao character varying(500),
    registrado_por uuid NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesao_aluno_check CHECK (((data_fim IS NULL) OR (data_inicio IS NULL) OR (data_fim >= data_inicio))),
    CONSTRAINT lesao_aluno_situacao_check CHECK (((situacao)::text = ANY ((ARRAY['ATIVA'::character varying, 'EM_RECUPERACAO'::character varying, 'RECUPERADA'::character varying])::text[])))
);

CREATE TABLE public.login_tentativa (
    chave character varying(100) NOT NULL,
    janela_ate timestamp with time zone NOT NULL,
    tentativas integer NOT NULL,
    CONSTRAINT login_tentativa_tentativas_check CHECK ((tentativas >= 1))
);

CREATE TABLE public.pasta_modelo (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    versao bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.pasta_plano (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    titulo character varying(120) NOT NULL,
    inicio date,
    fim date,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    arquivado boolean DEFAULT false NOT NULL,
    concluida_em timestamp with time zone,
    questionario_id uuid
);

CREATE TABLE public.perfil (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    descricao character varying(500),
    acesso_total boolean DEFAULT false NOT NULL,
    sistema boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT perfil_check CHECK (((NOT sistema) OR (acesso_total AND ativo)))
);

CREATE TABLE public.perfil_permissao (
    perfil_id uuid NOT NULL,
    codigo character varying(60) NOT NULL
);

CREATE TABLE public.plano_dieta (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid,
    titulo character varying(120) NOT NULL,
    inicio date,
    fim date,
    ativo boolean DEFAULT false NOT NULL,
    rascunho jsonb NOT NULL,
    rascunho_alterado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao_publicada integer DEFAULT 0 NOT NULL,
    publicado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    pasta_id uuid,
    arquivado boolean DEFAULT false NOT NULL
);

CREATE TABLE public.plano_dieta_versao (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    plano_id uuid NOT NULL,
    numero integer NOT NULL,
    titulo character varying(120) NOT NULL,
    inicio date,
    fim date,
    conteudo jsonb NOT NULL,
    publicado_em timestamp with time zone DEFAULT now() NOT NULL,
    publicado_por uuid NOT NULL
);

CREATE TABLE public.plano_mobilidade (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid,
    titulo character varying(120) NOT NULL,
    inicio date,
    fim date,
    ativo boolean DEFAULT false NOT NULL,
    rascunho jsonb NOT NULL,
    rascunho_alterado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao_publicada integer DEFAULT 0 NOT NULL,
    publicado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    pasta_id uuid,
    arquivado boolean DEFAULT false NOT NULL
);

CREATE TABLE public.plano_mobilidade_versao (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    plano_id uuid NOT NULL,
    numero integer NOT NULL,
    titulo character varying(120) NOT NULL,
    inicio date,
    fim date,
    conteudo jsonb NOT NULL,
    publicado_em timestamp with time zone DEFAULT now() NOT NULL,
    publicado_por uuid NOT NULL
);

CREATE TABLE public.plano_treino (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid,
    titulo character varying(120) NOT NULL,
    inicio date,
    fim date,
    ativo boolean DEFAULT false NOT NULL,
    rascunho jsonb NOT NULL,
    rascunho_alterado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao_publicada integer DEFAULT 0 NOT NULL,
    publicado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    pasta_id uuid,
    arquivado boolean DEFAULT false NOT NULL
);

CREATE TABLE public.plano_treino_versao (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    plano_id uuid NOT NULL,
    numero integer NOT NULL,
    titulo character varying(120) NOT NULL,
    inicio date,
    fim date,
    conteudo jsonb NOT NULL,
    publicado_em timestamp with time zone DEFAULT now() NOT NULL,
    publicado_por uuid NOT NULL
);

CREATE TABLE public.questionario (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    descricao character varying(400),
    padrao boolean DEFAULT false NOT NULL,
    arquivado boolean DEFAULT false NOT NULL,
    rascunho jsonb NOT NULL,
    rascunho_alterado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao_publicada integer DEFAULT 0 NOT NULL,
    publicado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    CONSTRAINT questionario_check CHECK (((NOT padrao) OR ((NOT arquivado) AND (versao_publicada > 0))))
);

CREATE TABLE public.questionario_versao (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    questionario_id uuid NOT NULL,
    numero integer NOT NULL,
    conteudo jsonb NOT NULL,
    publicado_em timestamp with time zone DEFAULT now() NOT NULL,
    publicado_por uuid
);

CREATE TABLE public.receita (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    tipo character varying(20) NOT NULL,
    nome character varying(120) NOT NULL,
    descricao character varying(400),
    conteudo jsonb NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL,
    pasta_id uuid,
    CONSTRAINT receita_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['SERIES'::character varying, 'PLANO_TREINO'::character varying, 'PLANO_DIETA'::character varying, 'METODOLOGIA'::character varying, 'SESSAO_TREINO'::character varying, 'REFEICAO'::character varying, 'PASTA_PLANO'::character varying, 'MOBILIDADE'::character varying])::text[])))
);

CREATE TABLE public.refresh_token (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    token_hash character(64) NOT NULL,
    cliente character varying(10) NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    usado_em timestamp with time zone,
    revogado_em timestamp with time zone,
    CONSTRAINT refresh_token_cliente_check CHECK (((cliente)::text = ANY ((ARRAY['WEB'::character varying, 'NATIVO'::character varying])::text[])))
);

CREATE TABLE public.registro_peso (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    aluno_id uuid NOT NULL,
    data date NOT NULL,
    peso_kg numeric(5,2) NOT NULL,
    observacao character varying(300),
    registrado_por uuid NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT registro_peso_peso_kg_check CHECK (((peso_kg > (0)::numeric) AND (peso_kg < (500)::numeric)))
);

CREATE TABLE public.suplemento (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    nome character varying(120) NOT NULL,
    nome_busca character varying(120) NOT NULL,
    marca character varying(80),
    categoria character varying(60),
    porcao character varying(80),
    porcoes_por_embalagem character varying(40),
    sabores jsonb DEFAULT '[]'::jsonb NOT NULL,
    link character varying(500),
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    versao bigint DEFAULT 0 NOT NULL
);

CREATE TABLE public.usuario (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    email character varying(254) NOT NULL,
    nome character varying(120) NOT NULL,
    senha_hash character varying(100) NOT NULL,
    papel character varying(20) NOT NULL,
    aluno_id uuid,
    ativo boolean DEFAULT true NOT NULL,
    credenciais_versao bigint DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_login_em timestamp with time zone,
    perfil_id uuid,
    telefone character varying(20),
    CONSTRAINT ck_usuario_perfil CHECK (((((papel)::text = 'TREINADOR'::text) AND (perfil_id IS NOT NULL)) OR (((papel)::text = 'ALUNO'::text) AND (perfil_id IS NULL)))),
    CONSTRAINT usuario_papel_check CHECK (((papel)::text = ANY ((ARRAY['TREINADOR'::character varying, 'ALUNO'::character varying])::text[])))
);

CREATE TABLE public.usuario_convite (
    id uuid NOT NULL,
    consultoria_id uuid NOT NULL,
    email character varying(254) NOT NULL,
    nome character varying(120) NOT NULL,
    perfil_id uuid NOT NULL,
    codigo_hash character(64) NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    usado_em timestamp with time zone,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.alimento
    ADD CONSTRAINT alimento_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aluno
    ADD CONSTRAINT aluno_convite_hash_key UNIQUE (convite_hash);

ALTER TABLE ONLY public.aluno
    ADD CONSTRAINT aluno_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.aluno
    ADD CONSTRAINT aluno_usuario_id_key UNIQUE (usuario_id);

ALTER TABLE ONLY public.atualizacao_modelo
    ADD CONSTRAINT atualizacao_modelo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.atualizacao_modelo
    ADD CONSTRAINT atualizacao_modelo_versao_key UNIQUE (versao);

ALTER TABLE ONLY public.atualizacao
    ADD CONSTRAINT atualizacao_pasta_id_key UNIQUE (pasta_id);

ALTER TABLE ONLY public.atualizacao
    ADD CONSTRAINT atualizacao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalogo_alimento
    ADD CONSTRAINT catalogo_alimento_nome_key UNIQUE (nome);

ALTER TABLE ONLY public.catalogo_alimento
    ADD CONSTRAINT catalogo_alimento_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.catalogo_exercicio
    ADD CONSTRAINT catalogo_exercicio_nome_key UNIQUE (nome);

ALTER TABLE ONLY public.catalogo_exercicio
    ADD CONSTRAINT catalogo_exercicio_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cobranca_local
    ADD CONSTRAINT cobranca_local_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.consultoria
    ADD CONSTRAINT consultoria_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.consultoria
    ADD CONSTRAINT consultoria_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.conta_comercial_local
    ADD CONSTRAINT conta_comercial_local_pkey PRIMARY KEY (consultoria_id);

ALTER TABLE ONLY public.direitos_locais
    ADD CONSTRAINT direitos_locais_pkey PRIMARY KEY (consultoria_id);

ALTER TABLE ONLY public.ergogenico
    ADD CONSTRAINT ergogenico_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.execucao_serie
    ADD CONSTRAINT execucao_serie_aluno_id_plano_versao_id_serie_uid_data_key UNIQUE (aluno_id, plano_versao_id, serie_uid, data);

ALTER TABLE ONLY public.execucao_serie
    ADD CONSTRAINT execucao_serie_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exercicio
    ADD CONSTRAINT exercicio_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.integracao_nonce
    ADD CONSTRAINT integracao_nonce_pkey PRIMARY KEY (chave_id, nonce);

ALTER TABLE ONLY public.integracao_operacao
    ADD CONSTRAINT integracao_operacao_pkey PRIMARY KEY (idempotency_key);

ALTER TABLE ONLY public.lesao_aluno
    ADD CONSTRAINT lesao_aluno_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.login_tentativa
    ADD CONSTRAINT login_tentativa_pkey PRIMARY KEY (chave);

ALTER TABLE ONLY public.pasta_modelo
    ADD CONSTRAINT pasta_modelo_id_consultoria_id_key UNIQUE (id, consultoria_id);

ALTER TABLE ONLY public.pasta_modelo
    ADD CONSTRAINT pasta_modelo_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pasta_plano
    ADD CONSTRAINT pasta_plano_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_consultoria_id_id_key UNIQUE (consultoria_id, id);

ALTER TABLE ONLY public.perfil_permissao
    ADD CONSTRAINT perfil_permissao_pkey PRIMARY KEY (perfil_id, codigo);

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plano_dieta
    ADD CONSTRAINT plano_dieta_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plano_dieta_versao
    ADD CONSTRAINT plano_dieta_versao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plano_dieta_versao
    ADD CONSTRAINT plano_dieta_versao_plano_id_numero_key UNIQUE (plano_id, numero);

ALTER TABLE ONLY public.plano_mobilidade
    ADD CONSTRAINT plano_mobilidade_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plano_mobilidade_versao
    ADD CONSTRAINT plano_mobilidade_versao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plano_mobilidade_versao
    ADD CONSTRAINT plano_mobilidade_versao_plano_id_numero_key UNIQUE (plano_id, numero);

ALTER TABLE ONLY public.plano_treino
    ADD CONSTRAINT plano_treino_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plano_treino_versao
    ADD CONSTRAINT plano_treino_versao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plano_treino_versao
    ADD CONSTRAINT plano_treino_versao_plano_id_numero_key UNIQUE (plano_id, numero);

ALTER TABLE ONLY public.questionario
    ADD CONSTRAINT questionario_consultoria_id_id_key UNIQUE (consultoria_id, id);

ALTER TABLE ONLY public.questionario
    ADD CONSTRAINT questionario_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.questionario_versao
    ADD CONSTRAINT questionario_versao_consultoria_id_id_key UNIQUE (consultoria_id, id);

ALTER TABLE ONLY public.questionario_versao
    ADD CONSTRAINT questionario_versao_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.questionario_versao
    ADD CONSTRAINT questionario_versao_questionario_id_numero_key UNIQUE (questionario_id, numero);

ALTER TABLE ONLY public.receita
    ADD CONSTRAINT receita_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT refresh_token_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT refresh_token_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.registro_peso
    ADD CONSTRAINT registro_peso_aluno_id_data_key UNIQUE (aluno_id, data);

ALTER TABLE ONLY public.registro_peso
    ADD CONSTRAINT registro_peso_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.suplemento
    ADD CONSTRAINT suplemento_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuario_convite
    ADD CONSTRAINT usuario_convite_codigo_hash_key UNIQUE (codigo_hash);

ALTER TABLE ONLY public.usuario_convite
    ADD CONSTRAINT usuario_convite_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT ux_usuario_consultoria_id UNIQUE (consultoria_id, id);

CREATE INDEX ix_aluno_consultoria ON public.aluno USING btree (consultoria_id, ativo, nome);

CREATE INDEX ix_atualizacao_aluno ON public.atualizacao USING btree (aluno_id);

CREATE INDEX ix_atualizacao_painel ON public.atualizacao USING btree (consultoria_id, estado, data_atualizacao);

CREATE INDEX ix_atualizacao_questionario_versao ON public.atualizacao USING btree (questionario_versao_id);

CREATE INDEX ix_auditoria_consultoria_data ON public.auditoria USING btree (consultoria_id, criado_em DESC);

CREATE INDEX ix_catalogo_alimento_nome_busca ON public.catalogo_alimento USING btree (nome_busca);

CREATE INDEX ix_catalogo_exercicio_nome_busca ON public.catalogo_exercicio USING btree (nome_busca);

CREATE INDEX ix_cobranca_local_consultoria ON public.cobranca_local USING btree (consultoria_id, competencia_inicio DESC);

CREATE INDEX ix_ergogenico_categoria ON public.ergogenico USING btree (consultoria_id, categoria) WHERE ativo;

CREATE INDEX ix_exec_aluno_data ON public.execucao_serie USING btree (consultoria_id, aluno_id, data DESC);

CREATE INDEX ix_exec_aluno_exercicio ON public.execucao_serie USING btree (aluno_id, exercicio_id, data DESC);

CREATE INDEX ix_exec_consultoria_recebido ON public.execucao_serie USING btree (consultoria_id, recebido_em DESC);

CREATE INDEX ix_integracao_nonce_recebido ON public.integracao_nonce USING btree (recebido_em);

CREATE INDEX ix_lesao_aluno ON public.lesao_aluno USING btree (consultoria_id, aluno_id, data_inicio DESC NULLS LAST);

CREATE INDEX ix_login_tentativa_janela ON public.login_tentativa USING btree (janela_ate);

CREATE INDEX ix_pasta_plano_aluno ON public.pasta_plano USING btree (consultoria_id, aluno_id, criado_em DESC);

CREATE INDEX ix_peso_consultoria ON public.registro_peso USING btree (consultoria_id, aluno_id, data DESC);

CREATE INDEX ix_plano_dieta_aluno ON public.plano_dieta USING btree (consultoria_id, aluno_id, criado_em DESC);

CREATE INDEX ix_plano_dieta_pasta ON public.plano_dieta USING btree (consultoria_id, pasta_id);

CREATE INDEX ix_plano_dieta_versao_consultoria ON public.plano_dieta_versao USING btree (consultoria_id, plano_id);

CREATE INDEX ix_plano_mobilidade_aluno ON public.plano_mobilidade USING btree (consultoria_id, aluno_id, criado_em DESC);

CREATE INDEX ix_plano_mobilidade_pasta ON public.plano_mobilidade USING btree (consultoria_id, pasta_id);

CREATE INDEX ix_plano_mobilidade_versao_consultoria ON public.plano_mobilidade_versao USING btree (consultoria_id, plano_id);

CREATE INDEX ix_plano_treino_aluno ON public.plano_treino USING btree (consultoria_id, aluno_id, criado_em DESC);

CREATE INDEX ix_plano_treino_pasta ON public.plano_treino USING btree (consultoria_id, pasta_id);

CREATE INDEX ix_plano_treino_versao_consultoria ON public.plano_treino_versao USING btree (consultoria_id, plano_id);

CREATE INDEX ix_receita_consultoria ON public.receita USING btree (consultoria_id, tipo, ordem);

CREATE INDEX ix_refresh_usuario ON public.refresh_token USING btree (usuario_id);

CREATE INDEX ix_suplemento_categoria ON public.suplemento USING btree (consultoria_id, categoria) WHERE ativo;

CREATE INDEX ix_usuario_consultoria ON public.usuario USING btree (consultoria_id);

CREATE INDEX ix_usuario_convite_consultoria_email ON public.usuario_convite USING btree (consultoria_id, lower((email)::text));

CREATE UNIQUE INDEX ux_alimento_nome ON public.alimento USING btree (consultoria_id, lower((nome)::text)) WHERE ativo;

CREATE UNIQUE INDEX ux_ergogenico_nome ON public.ergogenico USING btree (consultoria_id, nome_busca, COALESCE(concentracao, ''::character varying), COALESCE(apresentacao, ''::character varying)) WHERE ativo;

CREATE UNIQUE INDEX ux_exercicio_nome ON public.exercicio USING btree (consultoria_id, lower((nome)::text)) WHERE ativo;

CREATE UNIQUE INDEX ux_perfil_nome ON public.perfil USING btree (consultoria_id, lower((nome)::text));

CREATE UNIQUE INDEX ux_plano_dieta_ativo ON public.plano_dieta USING btree (aluno_id) WHERE ativo;

CREATE UNIQUE INDEX ux_plano_mobilidade_ativo ON public.plano_mobilidade USING btree (aluno_id) WHERE ativo;

CREATE UNIQUE INDEX ux_plano_treino_ativo ON public.plano_treino USING btree (aluno_id) WHERE ativo;

CREATE UNIQUE INDEX ux_questionario_nome ON public.questionario USING btree (consultoria_id, lower((nome)::text)) WHERE (NOT arquivado);

CREATE UNIQUE INDEX ux_questionario_padrao ON public.questionario USING btree (consultoria_id) WHERE padrao;

CREATE UNIQUE INDEX ux_suplemento_nome ON public.suplemento USING btree (consultoria_id, nome_busca) WHERE ativo;

CREATE UNIQUE INDEX ux_usuario_email ON public.usuario USING btree (lower((email)::text));

CREATE TRIGGER consultoria_perfis_padrao AFTER INSERT ON public.consultoria FOR EACH ROW EXECUTE FUNCTION public.consultoria_perfis_padrao();

CREATE TRIGGER consultoria_questionario_padrao AFTER INSERT ON public.consultoria FOR EACH ROW EXECUTE FUNCTION public.consultoria_questionario_padrao();

CREATE TRIGGER questionario_versao_imutavel BEFORE UPDATE ON public.questionario_versao FOR EACH ROW EXECUTE FUNCTION public.questionario_versao_imutavel();

CREATE TRIGGER usuario_perfil_inicial BEFORE INSERT ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.usuario_perfil_inicial();

ALTER TABLE ONLY public.alimento
    ADD CONSTRAINT alimento_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.aluno
    ADD CONSTRAINT aluno_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.aluno
    ADD CONSTRAINT aluno_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id);

ALTER TABLE ONLY public.atualizacao
    ADD CONSTRAINT atualizacao_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.atualizacao
    ADD CONSTRAINT atualizacao_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.atualizacao
    ADD CONSTRAINT atualizacao_feedback_por_fkey FOREIGN KEY (feedback_por) REFERENCES public.usuario(id);

ALTER TABLE ONLY public.atualizacao
    ADD CONSTRAINT atualizacao_pasta_id_fkey FOREIGN KEY (pasta_id) REFERENCES public.pasta_plano(id);

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_consultoria_id_usuario_id_fkey FOREIGN KEY (consultoria_id, usuario_id) REFERENCES public.usuario(consultoria_id, id);

ALTER TABLE ONLY public.cobranca_local
    ADD CONSTRAINT cobranca_local_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.conta_comercial_local
    ADD CONSTRAINT conta_comercial_local_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.direitos_locais
    ADD CONSTRAINT direitos_locais_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.ergogenico
    ADD CONSTRAINT ergogenico_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.execucao_serie
    ADD CONSTRAINT execucao_serie_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.execucao_serie
    ADD CONSTRAINT execucao_serie_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.execucao_serie
    ADD CONSTRAINT execucao_serie_plano_versao_id_fkey FOREIGN KEY (plano_versao_id) REFERENCES public.plano_treino_versao(id);

ALTER TABLE ONLY public.exercicio
    ADD CONSTRAINT exercicio_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.aluno
    ADD CONSTRAINT fk_aluno_questionario FOREIGN KEY (consultoria_id, questionario_id) REFERENCES public.questionario(consultoria_id, id) ON DELETE SET NULL (questionario_id);

ALTER TABLE ONLY public.aluno
    ADD CONSTRAINT fk_aluno_responsavel FOREIGN KEY (consultoria_id, responsavel_id) REFERENCES public.usuario(consultoria_id, id);

ALTER TABLE ONLY public.atualizacao
    ADD CONSTRAINT fk_atualizacao_questionario_versao FOREIGN KEY (consultoria_id, questionario_versao_id) REFERENCES public.questionario_versao(consultoria_id, id);

ALTER TABLE ONLY public.pasta_plano
    ADD CONSTRAINT fk_pasta_questionario FOREIGN KEY (consultoria_id, questionario_id) REFERENCES public.questionario(consultoria_id, id) ON DELETE SET NULL (questionario_id);

ALTER TABLE ONLY public.receita
    ADD CONSTRAINT fk_receita_pasta FOREIGN KEY (pasta_id, consultoria_id) REFERENCES public.pasta_modelo(id, consultoria_id);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_aluno FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_perfil FOREIGN KEY (consultoria_id, perfil_id) REFERENCES public.perfil(consultoria_id, id);

ALTER TABLE ONLY public.lesao_aluno
    ADD CONSTRAINT lesao_aluno_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.lesao_aluno
    ADD CONSTRAINT lesao_aluno_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.lesao_aluno
    ADD CONSTRAINT lesao_aluno_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuario(id);

ALTER TABLE ONLY public.pasta_modelo
    ADD CONSTRAINT pasta_modelo_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.pasta_plano
    ADD CONSTRAINT pasta_plano_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.pasta_plano
    ADD CONSTRAINT pasta_plano_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.perfil_permissao
    ADD CONSTRAINT perfil_permissao_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfil(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plano_dieta
    ADD CONSTRAINT plano_dieta_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.plano_dieta
    ADD CONSTRAINT plano_dieta_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.plano_dieta
    ADD CONSTRAINT plano_dieta_pasta_id_fkey FOREIGN KEY (pasta_id) REFERENCES public.pasta_plano(id);

ALTER TABLE ONLY public.plano_dieta_versao
    ADD CONSTRAINT plano_dieta_versao_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.plano_dieta_versao
    ADD CONSTRAINT plano_dieta_versao_plano_id_fkey FOREIGN KEY (plano_id) REFERENCES public.plano_dieta(id);

ALTER TABLE ONLY public.plano_dieta_versao
    ADD CONSTRAINT plano_dieta_versao_publicado_por_fkey FOREIGN KEY (publicado_por) REFERENCES public.usuario(id);

ALTER TABLE ONLY public.plano_mobilidade
    ADD CONSTRAINT plano_mobilidade_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.plano_mobilidade
    ADD CONSTRAINT plano_mobilidade_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.plano_mobilidade
    ADD CONSTRAINT plano_mobilidade_pasta_id_fkey FOREIGN KEY (pasta_id) REFERENCES public.pasta_plano(id);

ALTER TABLE ONLY public.plano_mobilidade_versao
    ADD CONSTRAINT plano_mobilidade_versao_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.plano_mobilidade_versao
    ADD CONSTRAINT plano_mobilidade_versao_plano_id_fkey FOREIGN KEY (plano_id) REFERENCES public.plano_mobilidade(id);

ALTER TABLE ONLY public.plano_mobilidade_versao
    ADD CONSTRAINT plano_mobilidade_versao_publicado_por_fkey FOREIGN KEY (publicado_por) REFERENCES public.usuario(id);

ALTER TABLE ONLY public.plano_treino
    ADD CONSTRAINT plano_treino_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.plano_treino
    ADD CONSTRAINT plano_treino_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.plano_treino
    ADD CONSTRAINT plano_treino_pasta_id_fkey FOREIGN KEY (pasta_id) REFERENCES public.pasta_plano(id);

ALTER TABLE ONLY public.plano_treino_versao
    ADD CONSTRAINT plano_treino_versao_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.plano_treino_versao
    ADD CONSTRAINT plano_treino_versao_plano_id_fkey FOREIGN KEY (plano_id) REFERENCES public.plano_treino(id);

ALTER TABLE ONLY public.plano_treino_versao
    ADD CONSTRAINT plano_treino_versao_publicado_por_fkey FOREIGN KEY (publicado_por) REFERENCES public.usuario(id);

ALTER TABLE ONLY public.questionario
    ADD CONSTRAINT questionario_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.questionario_versao
    ADD CONSTRAINT questionario_versao_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.questionario_versao
    ADD CONSTRAINT questionario_versao_consultoria_id_questionario_id_fkey FOREIGN KEY (consultoria_id, questionario_id) REFERENCES public.questionario(consultoria_id, id) ON DELETE CASCADE;

ALTER TABLE ONLY public.receita
    ADD CONSTRAINT receita_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.refresh_token
    ADD CONSTRAINT refresh_token_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuario(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.registro_peso
    ADD CONSTRAINT registro_peso_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.aluno(id);

ALTER TABLE ONLY public.registro_peso
    ADD CONSTRAINT registro_peso_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.registro_peso
    ADD CONSTRAINT registro_peso_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES public.usuario(id);

ALTER TABLE ONLY public.suplemento
    ADD CONSTRAINT suplemento_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT usuario_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.usuario_convite
    ADD CONSTRAINT usuario_convite_consultoria_id_criado_por_fkey FOREIGN KEY (consultoria_id, criado_por) REFERENCES public.usuario(consultoria_id, id);

ALTER TABLE ONLY public.usuario_convite
    ADD CONSTRAINT usuario_convite_consultoria_id_fkey FOREIGN KEY (consultoria_id) REFERENCES public.consultoria(id);

ALTER TABLE ONLY public.usuario_convite
    ADD CONSTRAINT usuario_convite_consultoria_id_perfil_id_fkey FOREIGN KEY (consultoria_id, perfil_id) REFERENCES public.perfil(consultoria_id, id);

INSERT INTO public.atualizacao_modelo VALUES ('b4c3e9d2-5a07-4b6e-9c11-2f7d6a8e1c42', 2, '{"secoes": [{"uid": "secao-1", "titulo": "Atualização", "perguntas": [{"id": "data", "tipo": "DATA_AUTOMATICA", "rotulo": "Atualização", "obrigatoria": false}, {"id": "peso", "tipo": "PESO", "rotulo": "Peso (em jejum)", "obrigatoria": true}, {"id": "fotos", "tipo": "FOTOS", "rotulo": "Fotos em jejum", "obrigatoria": false}, {"id": "psicologico", "tipo": "TEXTO_LONGO", "rotulo": "Como foi o seu psicológico durante o mês?", "obrigatoria": false}, {"id": "sono", "tipo": "NOTA", "rotulo": "De 0 a 10, como foi o seu sono?", "destaque": true, "obrigatoria": true, "rotuloCurto": "Sono"}, {"id": "estresse", "tipo": "TEXTO_LONGO", "rotulo": "Passou algum momento de estresse?", "obrigatoria": false}]}, {"uid": "secao-2", "titulo": "✅ Alimentar", "perguntas": [{"id": "alim_desempenho", "tipo": "NOTA", "rotulo": "Desempenho (0 a 10)", "destaque": true, "obrigatoria": true, "rotuloCurto": "Alimentar"}, {"id": "alim_faltou", "tipo": "TEXTO_LONGO", "rotulo": "Sentiu que faltou algo durante a dieta?", "obrigatoria": false}, {"id": "alim_livre", "tipo": "TEXTO_LONGO", "rotulo": "O que comeu em cada refeição livre e em qual quantidade?", "obrigatoria": false}, {"id": "alim_digestao", "tipo": "TEXTO", "rotulo": "Como está sua digestão?", "obrigatoria": false}, {"id": "alim_fome", "tipo": "TEXTO", "rotulo": "Momento que mais ficou com fome", "obrigatoria": false}, {"id": "alim_enjoou", "tipo": "TEXTO_LONGO", "rotulo": "Algum alimento que enjoou ou gostaria de substituir?", "obrigatoria": false}, {"id": "alim_incluir", "tipo": "TEXTO_LONGO", "rotulo": "Gostaria de comer algo durante as refeições (e em qual refeição)?", "obrigatoria": false}]}, {"uid": "secao-3", "titulo": "✅ Treino", "perguntas": [{"id": "treino_dias", "tipo": "TEXTO", "rotulo": "Quantos dias por semana está conseguindo treinar?", "obrigatoria": false, "ajudaAutomatica": "MEDIA_DIAS_TREINO"}, {"id": "treino_desempenho", "tipo": "NOTA", "rotulo": "Desempenho (0 a 10)", "destaque": true, "obrigatoria": true, "rotuloCurto": "Treino"}, {"id": "treino_dores", "tipo": "TEXTO_LONGO", "rotulo": "Sentiu dores ou dificuldades? Quais as dores? Em quais exercícios?", "obrigatoria": false}, {"id": "treino_descanso", "tipo": "TEXTO", "rotulo": "Precisou fazer descanso no meio da semana? Se sim, qual dia?", "obrigatoria": false}, {"id": "treino_acrescentar", "tipo": "TEXTO_LONGO", "rotulo": "Algo a acrescentar?", "obrigatoria": false}]}, {"uid": "secao-4", "titulo": "Feedbacks dos treinos durante esse período", "perguntas": [{"id": "fb_recuperacao", "tipo": "TEXTO_LONGO", "rotulo": "De 0 a 10, como foi a recuperação de cada dia?", "obrigatoria": false}, {"id": "fb_dores", "tipo": "TEXTO_LONGO", "rotulo": "Sentiu dores durante a semana?", "obrigatoria": false}, {"id": "fb_fadiga", "tipo": "TEXTO_LONGO", "rotulo": "Sentiu muita fadiga durante a semana?", "obrigatoria": false}, {"id": "fb_desgastante", "tipo": "TEXTO", "rotulo": "Qual dia foi mais desgastante?", "obrigatoria": false}, {"id": "fb_substituiu", "tipo": "TEXTO_LONGO", "rotulo": "Teve algum exercício que substituiu por não ter o maquinário próprio na sua academia? Se sim, quais?", "obrigatoria": false}, {"id": "fb_recuperou", "tipo": "TEXTO_LONGO", "rotulo": "Seu músculo recuperou até a próxima sessão de treino? (ajuda: \"Exemplo: treinei perna na segunda e na outra sessão de pernas treinei com dores\")", "obrigatoria": false}, {"id": "fb_pos_treino", "dias": [1, 2, 3, 4, 5, 6], "tipo": "NOTAS_POR_DIA", "rotulo": "De 0 a 10, como você se sentiu pós-treino nos dias abaixo", "obrigatoria": false}, {"id": "fb_mes", "tipo": "TEXTO_LONGO", "rotulo": "Me diz brevemente um feedback desse mês ou alguma observação relevante para o seu desenvolvimento", "obrigatoria": false}]}], "formato": 2, "instrucoes": ["O feedback deve ser enviado no dia da atualização. Caso ocorram atrasos, avise previamente.", "Atualização de peso e fotos em jejum"]}', '2026-10-13 18:07:52.009071+00');
