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

    @Query("select c.alunoId as alunoId from ContratacaoAluno c where c.id = :id")
    Optional<Dono> donoDe(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratacaoAluno c where c.id = :id")
    Optional<ContratacaoAluno> buscarParaAlterar(UUID id);

    Optional<ContratacaoAluno> findFirstByAlunoIdAndSituacaoNot(UUID alunoId, ContratacaoAluno.Situacao situacao);

    List<ContratacaoAluno> findByAlunoIdOrderByCriadoEmDescIdDesc(UUID alunoId);

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
