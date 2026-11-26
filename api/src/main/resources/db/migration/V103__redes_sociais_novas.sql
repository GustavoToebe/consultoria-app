-- Mais redes sociais. Aluno: YouTube, Facebook, LinkedIn e Telegram guardam o link https já normalizado pela API (o Instagram
-- e o TikTok seguem só com o usuário, V101). Consultoria: Facebook, LinkedIn e Telegram, também link https normalizado.
-- Tudo opcional e sem preenchimento retroativo; o formato é conferido pela API, como na V101.
ALTER TABLE aluno
    ADD COLUMN youtube varchar(200),
    ADD COLUMN facebook varchar(200),
    ADD COLUMN linkedin varchar(200),
    ADD COLUMN telegram varchar(200);
ALTER TABLE consultoria
    ADD COLUMN rede_facebook varchar(200),
    ADD COLUMN rede_linkedin varchar(200),
    ADD COLUMN rede_telegram varchar(200);
