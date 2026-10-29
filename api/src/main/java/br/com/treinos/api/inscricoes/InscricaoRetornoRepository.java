package br.com.treinos.api.inscricoes;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Retornos da consultoria da sessão ({@code @TenantId}). */
public interface InscricaoRetornoRepository extends JpaRepository<InscricaoRetorno, UUID> {

    /** Pendentes primeiro (pela data), depois os concluídos (mais recentes primeiro). */
    @Query("select r from InscricaoRetorno r where r.inscricaoId = :inscricaoId "
            + "order by case when r.concluidoEm is null then 0 else 1 end, r.data, r.concluidoEm desc, r.id")
    List<InscricaoRetorno> daInscricao(UUID inscricaoId, Pageable limite);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from InscricaoRetorno r where r.id = :id")
    Optional<InscricaoRetorno> buscarParaAlterar(UUID id);

    /** Próximo pendente de cada inscrição da página (uma consulta; o chamador fica com o primeiro de cada uma). */
    @Query("select r from InscricaoRetorno r where r.inscricaoId in :ids and r.concluidoEm is null order by r.data, r.criadoEm")
    List<InscricaoRetorno> pendentesDe(Collection<UUID> ids);

    /** Pendentes de inscrições em atendimento, do mais antigo ao mais novo ("Meus" = os retornos com você). */
    @Query("select r from InscricaoRetorno r, Inscricao i where i.id = r.inscricaoId and r.concluidoEm is null "
            + "and i.situacao in :abertas and (:responsavelId is null or r.responsavelId = :responsavelId) "
            + "order by r.data, r.criadoEm, r.id")
    List<InscricaoRetorno> pendentes(Collection<SituacaoInscricao> abertas, UUID responsavelId, Pageable limite);

    @Query("select count(r) from InscricaoRetorno r, Inscricao i where i.id = r.inscricaoId and r.concluidoEm is null "
            + "and i.situacao in :abertas and (:responsavelId is null or r.responsavelId = :responsavelId) "
            + "and r.data >= :de and r.data <= :ate")
    long contarPendentes(Collection<SituacaoInscricao> abertas, UUID responsavelId, LocalDate de, LocalDate ate);
}
