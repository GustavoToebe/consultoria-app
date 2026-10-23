-- Histórico da importação de planilha. Não guarda o arquivo nem valor de célula: só destino, contagens,
-- a configuração (aba, chave, regra e o índice de cada coluna) e até 1.000 erros {linha, campo, motivo}.
-- A limpeza de um ano é ImportacaoRetencao, no mesmo horário da auditoria.

CREATE TABLE importacao (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    destino        varchar(20) NOT NULL,
    nome_arquivo   varchar(200) NOT NULL,
    usuario_id     uuid NOT NULL,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    linhas         integer NOT NULL,
    novos          integer NOT NULL,
    atualizados    integer NOT NULL,
    ignorados      integer NOT NULL,
    com_erro       integer NOT NULL,
    situacao       varchar(30) NOT NULL,
    configuracao   jsonb NOT NULL,
    erros          jsonb NOT NULL,
    CONSTRAINT fk_importacao_usuario FOREIGN KEY (consultoria_id, usuario_id)
        REFERENCES usuario (consultoria_id, id)
);

CREATE INDEX ix_importacao_consultoria_criado ON importacao (consultoria_id, criado_em DESC);
