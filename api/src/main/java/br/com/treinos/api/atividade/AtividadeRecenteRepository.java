package br.com.treinos.api.atividade;

import br.com.treinos.api.atualizacoes.Atualizacao;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Leituras do feed "Atividade recente" do aluno: só id e instante (nunca resposta, comentário, peso ou conteúdo de plano),
 * cada uma limitada pelo {@link Pageable}. Já filtradas pela consultoria ({@code @TenantId}); o aluno vai sempre explícito.
 * A entidade do {@link Repository} é só a raiz do Spring Data: as consultas leem de outras tabelas.
 */
interface AtividadeRecenteRepository extends Repository<Atualizacao, UUID> {

    /** Um fato com data comprovada: o id do registro e o instante em que ele aconteceu. */
    record Fato(UUID id, Instant quando) {
    }

    /** Versão publicada de um plano e a pasta dele (nula se o plano não está numa pasta). */
    record FatoDePlano(UUID id, Instant quando, UUID pastaId) {
    }

    /** Atualização enviada ({@code enviada_em}: ENVIADA e REVISADA; a aberta ainda não tem). */
    @Query("select new br.com.treinos.api.atividade.AtividadeRecenteRepository$Fato(a.id, a.enviadaEm) from Atualizacao a "
            + "where a.alunoId = :alunoId and a.enviadaEm is not null order by a.enviadaEm desc, a.id desc")
    List<Fato> atualizacoesEnviadas(UUID alunoId, Pageable limite);

    /** Sessão concluída (não reaberta): o instante em que o servidor gravou a última mudança (a conclusão), não o do aparelho. */
    @Query("select new br.com.treinos.api.atividade.AtividadeRecenteRepository$Fato(s.id, s.atualizadoEm) from SessaoConcluida s "
            + "where s.alunoId = :alunoId and s.situacao = 'ACEITO' and s.concluida = true order by s.atualizadoEm desc, s.id desc")
    List<Fato> treinosConcluidos(UUID alunoId, Pageable limite);

    @Query("select new br.com.treinos.api.atividade.AtividadeRecenteRepository$FatoDePlano(v.id, v.publicadoEm, p.pastaId) "
            + "from PlanoTreinoVersao v, PlanoTreino p where p.id = v.planoId and p.alunoId = :alunoId "
            + "order by v.publicadoEm desc, v.id desc")
    List<FatoDePlano> treinosPublicados(UUID alunoId, Pageable limite);

    @Query("select new br.com.treinos.api.atividade.AtividadeRecenteRepository$FatoDePlano(v.id, v.publicadoEm, p.pastaId) "
            + "from PlanoDietaVersao v, PlanoDieta p where p.id = v.planoId and p.alunoId = :alunoId "
            + "order by v.publicadoEm desc, v.id desc")
    List<FatoDePlano> dietasPublicadas(UUID alunoId, Pageable limite);

    @Query("select new br.com.treinos.api.atividade.AtividadeRecenteRepository$FatoDePlano(v.id, v.publicadoEm, p.pastaId) "
            + "from PlanoMobilidadeVersao v, PlanoMobilidade p where p.id = v.planoId and p.alunoId = :alunoId "
            + "order by v.publicadoEm desc, v.id desc")
    List<FatoDePlano> mobilidadesPublicadas(UUID alunoId, Pageable limite);

    /**
     * Peso lançado pela equipe: o registro de peso não guarda a origem, então fica de fora o que o próprio aluno gravou
     * ({@code registrado_por} = usuário do aluno: atualização e anamnese), o da planilha importada (todos nascem no instante
     * da importação) e o de uma data em que existe atualização enviada (o peso daquela data pertence ao item da atualização).
     * {@code criado_em} é o instante da criação da linha: sem ele a linha não entra.
     */
    @Query("select new br.com.treinos.api.atividade.AtividadeRecenteRepository$Fato(r.id, r.criadoEm) "
            + "from RegistroPeso r, Aluno al where al.id = r.alunoId and r.alunoId = :alunoId "
            + "and r.criadoEm is not null and r.importacaoId is null "
            + "and (al.usuarioId is null or r.registradoPor <> al.usuarioId) "
            + "and not exists (select 1 from Atualizacao a where a.alunoId = r.alunoId and a.dataAtualizacao = r.data "
            + "and a.enviadaEm is not null) "
            + "order by r.criadoEm desc, r.id desc")
    List<Fato> pesosDaEquipe(UUID alunoId, Pageable limite);
}
