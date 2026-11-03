-- Meta do peso (cor da variação, plano cor-da-variacao-do-peso): o treinador decide a direção, o app só pinta.
--   consultoria.meta_do_peso  padrão dos alunos; nasce REDUZIR e as consultorias que já existem também
--   aluno.meta_do_peso        nula = vale a da consultoria; dado sensível (como o objetivo), zerada na anonimização
ALTER TABLE consultoria
    ADD COLUMN meta_do_peso varchar(10) NOT NULL DEFAULT 'REDUZIR'
        CONSTRAINT consultoria_meta_do_peso_check CHECK (meta_do_peso IN ('REDUZIR', 'AUMENTAR', 'SEM_META'));

ALTER TABLE aluno
    ADD COLUMN meta_do_peso varchar(10)
        CONSTRAINT aluno_meta_do_peso_check CHECK (meta_do_peso IS NULL OR meta_do_peso IN ('REDUZIR', 'AUMENTAR', 'SEM_META'));
