package br.com.treinos.api.alunos;

import br.com.treinos.api.treino.PlanoTreinoVersao;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Última versão publicada de cada tipo de plano do aluno: só instante e autor (nunca conteúdo). Já filtrada pela consultoria
 * ({@code @TenantId} nas versões e nos planos); o aluno vai sempre explícito. Rascunho não tem versão, então nunca entra.
 * A entidade do {@link Repository} é só a raiz do Spring Data: as consultas leem das três tabelas de versão.
 */
interface UltimaPublicacaoRepository extends Repository<PlanoTreinoVersao, UUID> {

    record Publicacao(Instant em, UUID por) {
    }

    @Query("select new br.com.treinos.api.alunos.UltimaPublicacaoRepository$Publicacao(v.publicadoEm, v.publicadoPor) "
            + "from PlanoTreinoVersao v, PlanoTreino p where p.id = v.planoId and p.alunoId = :alunoId "
            + "order by v.publicadoEm desc, v.id desc")
    List<Publicacao> treino(UUID alunoId, Pageable limite);

    @Query("select new br.com.treinos.api.alunos.UltimaPublicacaoRepository$Publicacao(v.publicadoEm, v.publicadoPor) "
            + "from PlanoDietaVersao v, PlanoDieta p where p.id = v.planoId and p.alunoId = :alunoId "
            + "order by v.publicadoEm desc, v.id desc")
    List<Publicacao> dieta(UUID alunoId, Pageable limite);

    @Query("select new br.com.treinos.api.alunos.UltimaPublicacaoRepository$Publicacao(v.publicadoEm, v.publicadoPor) "
            + "from PlanoMobilidadeVersao v, PlanoMobilidade p where p.id = v.planoId and p.alunoId = :alunoId "
            + "order by v.publicadoEm desc, v.id desc")
    List<Publicacao> mobilidade(UUID alunoId, Pageable limite);
}
