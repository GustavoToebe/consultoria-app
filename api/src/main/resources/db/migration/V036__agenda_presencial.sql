-- Agenda presencial do consultório (28/10): compromissos marcados pela equipe com um aluno (consulta, retorno, avaliação).
-- Só a equipe marca; o aluno só vê os próprios. Sem recorrência, sem lembrete, sem integração externa.
-- O horário é um instante (timestamptz); a API converte sempre para o horário de Brasília (America/Sao_Paulo), nunca o fuso
-- do servidor. fim = inicio + duração, guardado para a conferência de sobreposição (inicio < fim do outro e fim > inicio).
-- A observação é texto livre da equipe e pode ter dado de saúde: nunca em log nem na auditoria; a anonimização do aluno e o
-- "Excluir minha conta" apagam todos os compromissos dele.
CREATE TABLE compromisso (
    id               uuid PRIMARY KEY,
    consultoria_id   uuid NOT NULL REFERENCES consultoria (id),
    aluno_id         uuid NOT NULL,
    responsavel_id   uuid,
    inicio           timestamptz NOT NULL,
    duracao_minutos  integer NOT NULL CHECK (duracao_minutos BETWEEN 5 AND 480),
    fim              timestamptz NOT NULL,
    local            varchar(120),
    observacao       varchar(500),
    situacao         varchar(20) NOT NULL DEFAULT 'AGENDADO'
        CHECK (situacao IN ('AGENDADO', 'REALIZADO', 'CANCELADO', 'FALTOU')),
    criado_por       uuid,
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now(),
    versao           bigint NOT NULL DEFAULT 0,
    CONSTRAINT compromisso_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT ck_compromisso_fim CHECK (fim > inicio),
    CONSTRAINT fk_compromisso_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE,
    -- Membro removido: o compromisso fica, sem responsável (a API exige um ao gravar de novo).
    CONSTRAINT fk_compromisso_responsavel FOREIGN KEY (consultoria_id, responsavel_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (responsavel_id),
    CONSTRAINT fk_compromisso_criado_por FOREIGN KEY (consultoria_id, criado_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (criado_por)
);

-- Agenda por período, conflito do responsável (só os não cancelados) e os compromissos de um aluno.
CREATE INDEX ix_compromisso_periodo ON compromisso (consultoria_id, inicio);
CREATE INDEX ix_compromisso_responsavel ON compromisso (consultoria_id, responsavel_id, inicio) WHERE situacao <> 'CANCELADO';
CREATE INDEX ix_compromisso_aluno ON compromisso (consultoria_id, aluno_id, inicio);

-- Permissões novas nos perfis padrão, como as da inscrição (V012): função e gatilho próprios, em vez de reescrever
-- criar_perfis_padrao. O gatilho roda depois do consultoria_perfis_padrao (ordem alfabética dos nomes), quando os perfis já
-- existem. O Administrador já tem tudo (acesso total); Treinador, Nutricionista e Assistente marcam e atendem.
CREATE FUNCTION public.criar_permissoes_agenda(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into perfil_permissao(perfil_id,codigo)
 select p.id, c.codigo from perfil p cross join (values ('AGENDA_LER'), ('AGENDA_ALTERAR')) as c(codigo)
 where p.consultoria_id = cid
   and p.id in (md5(cid::text || ':Treinador')::uuid, md5(cid::text || ':Nutricionista')::uuid,
                md5(cid::text || ':Assistente')::uuid)
 on conflict do nothing;
end; $$;

CREATE FUNCTION public.consultoria_perfis_padrao_agenda() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_permissoes_agenda(new.id); return new; end; $$;

CREATE TRIGGER consultoria_perfis_padrao_agenda AFTER INSERT ON public.consultoria
    FOR EACH ROW EXECUTE FUNCTION public.consultoria_perfis_padrao_agenda();

-- Consultorias que já existem (os perfis padrão que ainda estão lá).
SELECT criar_permissoes_agenda(id) FROM consultoria;
