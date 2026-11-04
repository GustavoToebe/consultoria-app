-- Inscrição do Saraiva (04/11, docs/planos/inscricao-saraiva.md): origens novas ("Por onde você conheceu") e a previsão
-- "Tô só de passagem". Só refaz os CHECK da V045 (sem nome na V045: o Postgres os chamou <tabela>_<coluna>_check); nenhum
-- dado muda e as colunas continuam varchar(20). A origem da equipe começa pela respondida, então as duas listas têm os
-- mesmos valores (a da equipe ainda tem CAMPANHA, que só vem do link).

ALTER TABLE inscricao
    DROP CONSTRAINT inscricao_origem_informada_check,
    DROP CONSTRAINT inscricao_origem_check,
    DROP CONSTRAINT inscricao_previsao_inicio_check;

ALTER TABLE inscricao
    ADD CONSTRAINT inscricao_origem_informada_check CHECK (origem_informada IN
        ('INDICACAO', 'INSTAGRAM', 'GOOGLE', 'YOUTUBE', 'TIKTOK', 'INFLUENCIADOR', 'ALUNO_DO_TIME', 'OUTRA')),
    ADD CONSTRAINT inscricao_origem_check CHECK (origem IN
        ('INDICACAO', 'INSTAGRAM', 'GOOGLE', 'YOUTUBE', 'TIKTOK', 'INFLUENCIADOR', 'ALUNO_DO_TIME', 'CAMPANHA', 'OUTRA')),
    ADD CONSTRAINT inscricao_previsao_inicio_check CHECK (previsao_inicio IN
        ('AGORA', 'ESTE_MES', 'PROXIMO_MES', 'SO_DE_PASSAGEM', 'NAO_SEI'));
