-- "Visto" do treinador (frente Engajamento, passo 0.5, decisão P4): a única reação ao treino que o aluno concluiu, sem
-- texto. Uma linha por sessão concluída (marcar de novo não duplica; desfazer apaga a linha). Fica numa tabela própria
-- porque a sessão concluída é gravada pelo upsert do aparelho e é só leitura no JPA. Reabrir ou concluir de novo no
-- aparelho não apaga o "Visto". Sem texto livre: a anonimização do aluno não precisa mexer aqui.
CREATE TABLE sessao_concluida_visto (
    sessao_concluida_id uuid PRIMARY KEY REFERENCES sessao_concluida (id) ON DELETE CASCADE,
    consultoria_id      uuid NOT NULL REFERENCES consultoria (id),
    aluno_id            uuid NOT NULL REFERENCES aluno (id),
    usuario_id          uuid NOT NULL,
    visto_em            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_sessao_concluida_visto_usuario FOREIGN KEY (consultoria_id, usuario_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE CASCADE
);

CREATE INDEX ix_sessao_concluida_visto_aluno ON sessao_concluida_visto (aluno_id);

-- Permissão nova REGISTRO_REAGIR ("Visto"). O Administrador já tem tudo (acesso total). Nos perfis padrão, só o Treinador:
-- é ele quem acompanha o treino (a Nutricionista lê registros, mas não reage a treino). Função e gatilho próprios, como na
-- V012: o gatilho roda depois do consultoria_perfis_padrao (ordem alfabética dos nomes), quando os perfis já existem.
CREATE FUNCTION public.criar_permissoes_retorno(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into perfil_permissao(perfil_id,codigo)
 select p.id, 'REGISTRO_REAGIR' from perfil p
 where p.consultoria_id = cid and p.id = md5(cid::text || ':Treinador')::uuid
 on conflict do nothing;
end; $$;

CREATE FUNCTION public.consultoria_perfis_padrao_retorno() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_permissoes_retorno(new.id); return new; end; $$;

CREATE TRIGGER consultoria_perfis_padrao_retorno AFTER INSERT ON public.consultoria
    FOR EACH ROW EXECUTE FUNCTION public.consultoria_perfis_padrao_retorno();

-- Consultorias que já existem (o Treinador padrão que ainda estiver lá).
SELECT criar_permissoes_retorno(id) FROM consultoria;
