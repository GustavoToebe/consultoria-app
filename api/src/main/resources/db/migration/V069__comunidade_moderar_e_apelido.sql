-- Comunidade: permissão própria de moderação e apelido do aluno (plano docs/planos/comunidade-perfil-e-apelido.md, decisões 3, 6 e 7).

-- A) COMUNIDADE_MODERAR substitui TREINO_ALTERAR na moderação do mural e dos aulões. Quem hoje tem TREINO_ALTERAR a recebe
-- (perfil padrão ou criado à mão: ninguém perde o que já fazia). O Administrador tem acesso total e não guarda linhas.
INSERT INTO perfil_permissao (perfil_id, codigo)
SELECT perfil_id, 'COMUNIDADE_MODERAR' FROM perfil_permissao WHERE codigo = 'TREINO_ALTERAR'
ON CONFLICT DO NOTHING;

-- Consultoria nova: o Treinador padrão nasce com a permissão. Função e gatilho próprios, como na V040: o gatilho roda depois do
-- consultoria_perfis_padrao (ordem alfabética dos nomes), quando os perfis já existem. Nas consultorias que já existem não se
-- chama a função: o INSERT acima já deu a permissão a quem tinha TREINO_ALTERAR (um Treinador que perdeu essa permissão não a ganha).
CREATE FUNCTION public.criar_permissoes_comunidade(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into perfil_permissao(perfil_id,codigo)
 select p.id, 'COMUNIDADE_MODERAR' from perfil p
 where p.consultoria_id = cid and p.id = md5(cid::text || ':Treinador')::uuid
 on conflict do nothing;
end; $$;

CREATE FUNCTION public.consultoria_perfis_padrao_comunidade() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_permissoes_comunidade(new.id); return new; end; $$;

CREATE TRIGGER consultoria_perfis_padrao_comunidade AFTER INSERT ON public.consultoria
    FOR EACH ROW EXECUTE FUNCTION public.consultoria_perfis_padrao_comunidade();

-- B) Apelido do aluno (vulgo): 2 a 24 caracteres, letras (com acento), números, espaço e _ . -. Opcional, repetido pode.
-- A regra completa (letras Unicode, sem link) é da API (ApelidoDoAlunoService). O CHECK é a rede de proteção do banco e nunca
-- recusa o que a API aceita: o Postgres não tem \p{L}, então ele só barra o tamanho, espaço nas pontas, controle e a pontuação
-- ASCII fora de _ . - (os intervalos abaixo: !-, / :-@ [-^ ` {-DEL).
ALTER TABLE aluno ADD COLUMN apelido varchar(24);
ALTER TABLE aluno ADD CONSTRAINT ck_aluno_apelido CHECK (
    apelido IS NULL OR (
        char_length(apelido) BETWEEN 2 AND 24
        AND apelido = btrim(apelido)
        AND apelido !~ '[\x01-\x1f\x21-\x2c\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]'
    )
);
