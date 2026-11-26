package br.com.treinos.api.contratos;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface ContratoAlunoRepository extends JpaRepository<ContratoAluno, UUID> {

    List<ContratoAluno> findByAlunoIdOrderByGeradoEmDescIdDesc(UUID alunoId);

    Optional<ContratoAluno> findByPedidoId(UUID pedidoId);

    /** Só o do aluno dado: de outro aluno ou consultoria não aparece. */
    Optional<ContratoAluno> findByIdAndAlunoId(UUID id, UUID alunoId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratoAluno c where c.id = :id")
    Optional<ContratoAluno> buscarParaAlterar(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContratoAluno c where c.id = :id and c.alunoId = :alunoId")
    Optional<ContratoAluno> buscarDoAlunoParaAlterar(UUID id, UUID alunoId);

    /**
     * Anonimização e "Excluir minha conta" (D16): o pendente e o cancelado saem (o PDF vai junto, pelo cascade do banco); o assinado
     * fica. O filtro de consultoria vem do {@code @TenantId}.
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from ContratoAluno c where c.alunoId = :alunoId and c.situacao <> :assinado")
    int apagarNaoAssinados(UUID alunoId, ContratoAluno.Situacao assinado);
}
