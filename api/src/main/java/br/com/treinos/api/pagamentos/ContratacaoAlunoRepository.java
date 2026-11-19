package br.com.treinos.api.pagamentos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface ContratacaoAlunoRepository extends JpaRepository<ContratacaoAluno, UUID> {

    /** Só o aluno dono: lido antes de travar, para a entidade da contratação nunca entrar na sessão com estado velho. */
    interface Dono {
        UUID getAlunoId();
    }

    /** Valor e periodicidade repetidos, para a receita recorrente arredondar centavo a centavo por contratação. */
    interface GrupoRecorrente {
        PeriodoDoPlano getPeriodicidade();

        Long getValor();

        Long getQuantidade();
    }

    /** A contratação ATIVA do aluno e o plano dela, só ids (a entidade entra na sessão já travada, por {@link Travas}). */
    interface Ativa {
        UUID getId();

        UUID getPlanoComercialId();
    }

    @Query("select c.alunoId as alunoId from ContratacaoAluno c where c.id = :id")
    Optional<Dono> donoDe(UUID id);

    /** No máximo uma ATIVA por aluno (o índice {@code ux_contratacao_vigente} impede duas vigentes). */
    @Query("select c.id as id, c.planoComercialId as planoComercialId from ContratacaoAluno c "
            + "where c.alunoId = :alunoId and c.situacao = :ativa")
    Optional<Ativa> ativaDoAluno(UUID alunoId, ContratacaoAluno.Situacao ativa);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratacaoAluno c where c.id = :id")
    Optional<ContratacaoAluno> buscarParaAlterar(UUID id);

    /** Só os ids das contratações que a rotina diária de geração percorre (ativas e recorrentes), numa ordem fixa. */
    @Query("select c.id from ContratacaoAluno c where c.situacao = :ativa and c.periodicidade <> :unica order by c.id")
    List<UUID> idsAtivasRecorrentes(ContratacaoAluno.Situacao ativa, PeriodoDoPlano unica);

    Optional<ContratacaoAluno> findFirstByAlunoIdAndSituacaoNot(UUID alunoId, ContratacaoAluno.Situacao situacao);

    /** Uma só: o índice {@code ux_contratacao_vigente} (V017) impede duas ATIVA/PAUSADA do mesmo aluno. */
    Optional<ContratacaoAluno> findFirstByAlunoIdAndSituacao(UUID alunoId, ContratacaoAluno.Situacao situacao);

    List<ContratacaoAluno> findByAlunoIdOrderByCriadoEmDescIdDesc(UUID alunoId);

    @Query("select c from ContratacaoAluno c join Aluno a on a.id = c.alunoId "
            + "where c.situacao = :situacao and (:responsavelId is null or a.responsavelId = :responsavelId)")
    List<ContratacaoAluno> ativasDoEscopo(ContratacaoAluno.Situacao situacao, UUID responsavelId);

    @Query("select c.periodicidade as periodicidade, c.valorCentavos as valor, count(c) as quantidade "
            + "from ContratacaoAluno c join Aluno a on a.id = c.alunoId "
            + "where c.situacao = :ativa and c.periodicidade <> :unica "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) "
            + "group by c.periodicidade, c.valorCentavos")
    List<GrupoRecorrente> recorrentes(ContratacaoAluno.Situacao ativa, PeriodoDoPlano unica, UUID responsavelId);

    /** Só o instante da criação de cada contratação da janela (o mês de Brasília é contado em Java). */
    @Query("select c.criadoEm from ContratacaoAluno c join Aluno a on a.id = c.alunoId "
            + "where c.criadoEm >= :inicio and c.criadoEm < :fim "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    List<Instant> criadasNaJanela(Instant inicio, Instant fim, UUID responsavelId);

    @Query("select c.encerradaEm from ContratacaoAluno c join Aluno a on a.id = c.alunoId "
            + "where c.encerradaEm >= :inicio and c.encerradaEm < :fim "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    List<Instant> encerradasNaJanela(Instant inicio, Instant fim, UUID responsavelId);
}
