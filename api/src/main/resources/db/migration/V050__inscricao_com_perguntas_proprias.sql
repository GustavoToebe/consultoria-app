-- "Quero ser aluno" com as perguntas do treinador (docs/planos/inscricao-com-perguntas-proprias.md, D2 a D9).
-- Sem compatibilidade: ainda não há cliente real.

-- 1. Terceira finalidade do questionário: as perguntas da página pública de inscrição. O padrão continua um por
--    finalidade (ux_questionario_padrao já é por consultoria e finalidade).
ALTER TABLE questionario DROP CONSTRAINT ck_questionario_finalidade;
ALTER TABLE questionario ADD CONSTRAINT ck_questionario_finalidade
    CHECK (finalidade IN ('ATUALIZACAO', 'ANAMNESE', 'INSCRICAO'));

-- 2. Padrão de inscrição de cada consultoria, publicado (v1): o que a página mostra embaixo dos campos fixos. Reproduz a
--    página de antes: a "Observação" deixou de ser campo fixo e virou uma pergunta de texto livre, opcional, que o
--    treinador pode tirar ou trocar. Os outros campos de antes (e-mail, sexo, objetivo, "o que procura", modalidade,
--    previsão de início e "como conheceu") continuam fixos e o treinador só pode escondê-los (D4).
--    Nome ocupado por um questionário ativo da consultoria: usa o nome alternativo (o índice de nome não deixa repetir).
CREATE FUNCTION public.criar_questionario_inscricao_padrao(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
 modelo jsonb := '{"formato":2,"instrucoes":[],"secoes":[{"uid":"inscricao-mais","titulo":"Mais sobre você","perguntas":[{"id":"observacao","tipo":"TEXTO_LONGO","rotulo":"Observação","obrigatoria":false,"ajuda":"Algo mais que a equipe deva saber? Informações de saúde ficam para depois, se a inscrição for aceita."}]}]}'::jsonb;
 nome_livre varchar(120) := 'Inscrição';
begin
 if exists (select 1 from questionario where consultoria_id = cid and finalidade = 'INSCRICAO' and padrao) then
   return;
 end if;
 if exists (select 1 from questionario where consultoria_id = cid and lower(nome) = lower(nome_livre) and not arquivado) then
   nome_livre := 'Inscrição (padrão)';
 end if;
 insert into questionario(id,consultoria_id,nome,descricao,finalidade,padrao,rascunho,versao_publicada,publicado_em)
 values (md5(cid::text || ':questionario-inscricao')::uuid, cid, nome_livre,
         'Perguntas da página "Quero ser aluno", embaixo dos campos fixos.', 'INSCRICAO', true, modelo, 1, now());
 insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo)
 values (md5(cid::text || ':questionario-inscricao:1')::uuid, cid, md5(cid::text || ':questionario-inscricao')::uuid, 1, modelo);
end; $$;

CREATE FUNCTION public.consultoria_questionario_inscricao_padrao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_questionario_inscricao_padrao(new.id); return new; end; $$;

CREATE TRIGGER consultoria_questionario_inscricao_padrao AFTER INSERT ON public.consultoria
    FOR EACH ROW EXECUTE FUNCTION public.consultoria_questionario_inscricao_padrao();

SELECT criar_questionario_inscricao_padrao(id) FROM consultoria;

-- 3. Respostas da inscrição, com a versão do questionário fixada no envio (D9). Dado pessoal: nunca em log nem na
--    auditoria; saem com a inscrição (retenção de 180 dias e anonimização do aluno). As duas colunas andam juntas: sem
--    padrão de inscrição publicado no envio, nenhuma das duas. A versão referenciada segura a exclusão do questionário
--    (o serviço responde 409 QUESTIONARIO_EM_USO antes).
ALTER TABLE inscricao ADD COLUMN questionario_versao_id uuid;
ALTER TABLE inscricao ADD COLUMN respostas jsonb;
ALTER TABLE inscricao ADD CONSTRAINT fk_inscricao_questionario_versao FOREIGN KEY (consultoria_id, questionario_versao_id)
    REFERENCES questionario_versao (consultoria_id, id);
ALTER TABLE inscricao ADD CONSTRAINT ck_inscricao_respostas CHECK ((questionario_versao_id IS NULL) = (respostas IS NULL));
CREATE INDEX ix_inscricao_questionario_versao ON inscricao (questionario_versao_id) WHERE questionario_versao_id IS NOT NULL;

-- 4. Campos fixos que o treinador escondeu da página (D4), separados por vírgula (vazio = todos visíveis). Nome, WhatsApp
--    e a ciência do texto nunca se escondem; a lista fechada fica no CampoDaInscricao. A coluna "observacao" da inscrição
--    fica para as inscrições já recebidas; nada novo grava nela.
ALTER TABLE inscricao_configuracao ADD COLUMN campos_ocultos varchar(200) NOT NULL DEFAULT ''
    CONSTRAINT ck_inscricao_campos_ocultos CHECK (campos_ocultos ~ '^[A-Z_,]*$');
