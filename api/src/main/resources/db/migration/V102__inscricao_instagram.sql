-- Instagram opcional na inscrição por link: só o usuário já normalizado pela API (sem @), copiado ao aluno ao aceitar.
-- Nulo para quem já existia; a inscrição é apagada (não zerada) na anonimização do aluno e na retenção, levando a coluna junto.
ALTER TABLE inscricao
    ADD COLUMN instagram varchar(30);
