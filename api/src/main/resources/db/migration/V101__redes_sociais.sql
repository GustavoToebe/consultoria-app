-- Redes sociais da consultoria (links https já normalizados pela API) e Instagram/TikTok do aluno (só o usuário, sem @).
-- Tudo opcional e sem preenchimento retroativo. O limite de 200 do link é o da API.
ALTER TABLE consultoria
    ADD COLUMN rede_instagram varchar(200),
    ADD COLUMN rede_tiktok varchar(200),
    ADD COLUMN rede_youtube varchar(200),
    ADD COLUMN rede_x varchar(200),
    ADD COLUMN rede_site varchar(200);
ALTER TABLE aluno
    ADD COLUMN instagram varchar(30),
    ADD COLUMN tiktok varchar(24);
