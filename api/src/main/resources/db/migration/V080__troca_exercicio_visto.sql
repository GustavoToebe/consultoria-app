-- "Visto" do treinador numa troca de exercício (plano alertas-de-troca, passo 1; molde da V040). A troca "só hoje" não tem
-- tabela: é lida das séries concluídas (execucao_serie.exercicio_id diferente do principal da versão). O visto guarda só a
-- chave natural dessa troca derivada: aluno + dia + versão do plano + exercício do plano (uid) + alternativa usada, a mesma
-- chave que o TrocasDeExercicioService usa para juntar as séries numa troca. Uma linha por troca vista (marcar de novo não
-- duplica; desfazer apaga a linha). Sem texto livre: a anonimização e a exportação do aluno não precisam mexer aqui.
-- Sem FK para execucao_serie nem para a versão do plano: a troca é derivada e some se o aluno desfaz (o mesmo registro volta
-- ao exercício do plano), e o visto órfão é inofensivo (o GET e a pendência só mostram trocas que ainda existem; se o aluno
-- trocar de novo para a mesma alternativa no mesmo dia, o visto antigo volta a valer, pois é a mesma troca). A limpeza fica
-- por conta do ON DELETE CASCADE do aluno (excluir o aluno) e do usuário (a pessoa que deu o visto).
-- A permissão é a REGISTRO_REAGIR da V040 (nenhuma permissão nova).
CREATE TABLE troca_exercicio_visto (
    id                       uuid PRIMARY KEY,
    consultoria_id           uuid NOT NULL REFERENCES consultoria (id),
    aluno_id                 uuid NOT NULL,
    data                     date NOT NULL,
    plano_versao_id          uuid NOT NULL,
    exercicio_uid            uuid NOT NULL,
    alternativa_exercicio_id uuid NOT NULL,
    usuario_id               uuid NOT NULL,
    visto_em                 timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_troca_exercicio_visto_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_troca_exercicio_visto_usuario FOREIGN KEY (consultoria_id, usuario_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE CASCADE,
    -- Também serve às leituras por aluno e período (aluno_id e data à frente).
    CONSTRAINT ux_troca_exercicio_visto_troca
        UNIQUE (aluno_id, data, plano_versao_id, exercicio_uid, alternativa_exercicio_id)
);
