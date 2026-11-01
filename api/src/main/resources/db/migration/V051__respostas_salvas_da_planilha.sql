-- Respostas que o treinador deu na importação da planilha completa (fase 2), guardadas na consultoria ao confirmar
-- e devolvidas como sugestão já marcada na próxima análise (o treinador ainda vê e pode trocar). Sem dado de aluno:
--   ABA        chave = sha256 dos títulos das colunas da aba (nunca o texto); resposta = o tipo da aba ou IGNORAR
--   EXERCICIO  chave = o nome comparável do exercício (sem acento, sem caixa); resposta = ACEITAR, BIBLIOTECA, CRIAR ou
--              MANTER; item_id = o exercício da biblioteca (só em BIBLIOTECA)
--   ALIMENTO   como o exercício (CRIAR vale como MANTER: alimento nunca é criado)
--   SUPLEMENTO chave = o nome comparável (sem dose); resposta = SUPLEMENTO ou SENSIVEL. O nome pode ser de medicação:
--              só volta a quem pode gravar a dieta (PASTA_ALTERAR + DIETA_ALTERAR)
-- "Esquecer as respostas salvas" apaga todas as linhas da consultoria.
CREATE TABLE importacao_resposta_salva (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    tipo           varchar(20) NOT NULL CHECK (tipo IN ('ABA', 'EXERCICIO', 'ALIMENTO', 'SUPLEMENTO')),
    chave          varchar(200) NOT NULL,
    resposta       varchar(30) NOT NULL,
    item_id        uuid,
    atualizada_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT importacao_resposta_salva_chave_key UNIQUE (consultoria_id, tipo, chave)
);
