-- Agenda no estilo do Google Agenda (docs/planos/agenda-calendario.md, D2 a D5, D9, D10, D17; V043).
-- Agendas pessoais de cada membro da equipe e eventos SEM aluno (inclusive de dia inteiro e que se repetem). Só o dono vê e
-- altera: a API filtra pelo dono em toda leitura e escrita, e o banco impede evento numa agenda de outro membro (FK composta
-- com o dono). Título, local e descrição são texto livre do membro: nunca em log nem na auditoria. O evento não tem ligação
-- com aluno, então não entra na exportação nem na anonimização.
-- Membro apagado (o app só desativa): as agendas e os eventos dele vão junto, porque ninguém mais os vê.
-- Horário em Brasília: a regra guarda data e hora de parede (date + time), não instante; a API converte ao expandir.

CREATE TABLE agenda_pessoal (
    id              uuid PRIMARY KEY,
    consultoria_id  uuid NOT NULL REFERENCES consultoria (id),
    dono_id         uuid NOT NULL,
    nome            varchar(40) NOT NULL CHECK (length(btrim(nome)) > 0),
    -- Chave da paleta fixa (app/src/tema/tokens.ts, D7): a cor só identifica a agenda.
    cor             varchar(20) NOT NULL
        CHECK (cor IN ('AZUL', 'INDIGO', 'VIOLETA', 'MAGENTA', 'TURQUESA', 'ARDOSIA', 'TERRA', 'OLIVA')),
    criado_em       timestamptz NOT NULL DEFAULT now(),
    versao          bigint NOT NULL DEFAULT 0,
    CONSTRAINT agenda_pessoal_consultoria_id_id_key UNIQUE (consultoria_id, id),
    -- Alvo da FK composta do evento: agenda e evento têm de ter o mesmo dono.
    CONSTRAINT agenda_pessoal_dono_id_key UNIQUE (consultoria_id, dono_id, id),
    CONSTRAINT fk_agenda_pessoal_dono FOREIGN KEY (consultoria_id, dono_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE CASCADE
);
-- Nome único por dono, sem diferença de caixa; serve também às agendas de um dono.
CREATE UNIQUE INDEX ux_agenda_pessoal_nome ON agenda_pessoal (consultoria_id, dono_id, lower(nome));

CREATE TABLE evento_agenda (
    id               uuid PRIMARY KEY,
    consultoria_id   uuid NOT NULL REFERENCES consultoria (id),
    dono_id          uuid NOT NULL,
    agenda_id        uuid NOT NULL,
    titulo           varchar(120) NOT NULL CHECK (length(btrim(titulo)) > 0),
    descricao        varchar(1000),
    local            varchar(120),
    data_inicio      date NOT NULL,
    -- Nulo = dia inteiro (D5: um dia só). Com hora, a duração é de 5 a 1440 minutos (D3).
    hora_inicio      time,
    duracao_minutos  integer,
    recorrencia      varchar(20) NOT NULL DEFAULT 'NENHUMA'
        CHECK (recorrencia IN ('NENHUMA', 'DIARIA', 'SEMANAL', 'MENSAL', 'ANUAL', 'DIAS_UTEIS')),
    -- Máscara de 7 bits (bit 0 = segunda ... bit 6 = domingo), só na repetição semanal.
    dias_da_semana   smallint,
    -- Fim da repetição: no máximo um dos dois; nenhum = nunca termina (expandido na leitura).
    repete_ate       date,
    repete_vezes     smallint,
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now(),
    versao           bigint NOT NULL DEFAULT 0,
    CONSTRAINT evento_agenda_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT fk_evento_agenda_agenda FOREIGN KEY (consultoria_id, dono_id, agenda_id)
        REFERENCES agenda_pessoal (consultoria_id, dono_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_evento_agenda_horario CHECK ((hora_inicio IS NULL) = (duracao_minutos IS NULL)),
    CONSTRAINT ck_evento_agenda_duracao CHECK (duracao_minutos IS NULL OR duracao_minutos BETWEEN 5 AND 1440),
    CONSTRAINT ck_evento_agenda_vezes CHECK (repete_vezes IS NULL OR repete_vezes BETWEEN 2 AND 999),
    CONSTRAINT ck_evento_agenda_fim CHECK (repete_ate IS NULL OR repete_vezes IS NULL),
    CONSTRAINT ck_evento_agenda_dias CHECK (dias_da_semana IS NULL OR (recorrencia = 'SEMANAL' AND dias_da_semana BETWEEN 1 AND 127)),
    CONSTRAINT ck_evento_agenda_sem_regra CHECK (recorrencia <> 'NENHUMA' OR (repete_ate IS NULL AND repete_vezes IS NULL)),
    CONSTRAINT ck_evento_agenda_semanal CHECK (recorrencia <> 'SEMANAL' OR dias_da_semana IS NOT NULL)
);
-- Leitura por período dos eventos de um dono e contagem por agenda (a FK composta já cobre apagar a agenda).
CREATE INDEX ix_evento_agenda_dono ON evento_agenda (consultoria_id, dono_id, data_inicio);
CREATE INDEX ix_evento_agenda_agenda ON evento_agenda (consultoria_id, agenda_id);

-- Exceções de uma série: uma ocorrência cancelada ou alterada. Campos nulos herdam do evento; texto vazio ('') em
-- titulo/local/descricao quer dizer "apagado só nesta ocorrência"; dia_inteiro nulo herda. data_nova move a ocorrência.
CREATE TABLE evento_agenda_excecao (
    id               uuid PRIMARY KEY,
    consultoria_id   uuid NOT NULL REFERENCES consultoria (id),
    evento_id        uuid NOT NULL,
    data_original    date NOT NULL,
    cancelada        boolean NOT NULL DEFAULT false,
    titulo           varchar(120),
    descricao        varchar(1000),
    local            varchar(120),
    dia_inteiro      boolean,
    hora_inicio      time,
    duracao_minutos  integer CHECK (duracao_minutos IS NULL OR duracao_minutos BETWEEN 5 AND 1440),
    data_nova        date,
    CONSTRAINT evento_agenda_excecao_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT evento_agenda_excecao_unica UNIQUE (consultoria_id, evento_id, data_original),
    CONSTRAINT fk_evento_agenda_excecao_evento FOREIGN KEY (consultoria_id, evento_id)
        REFERENCES evento_agenda (consultoria_id, id) ON DELETE CASCADE
);
-- A ocorrência movida precisa aparecer na janela nova.
CREATE INDEX ix_evento_agenda_excecao_nova ON evento_agenda_excecao (consultoria_id, data_nova) WHERE data_nova IS NOT NULL;
